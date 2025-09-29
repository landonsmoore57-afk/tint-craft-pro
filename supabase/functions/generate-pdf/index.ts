import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FilmData {
  id: string;
  brand: string;
  series: string;
  name: string;
  vlt: number | null;
  sell_per_sqft: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { quoteId } = await req.json();

    if (!quoteId) {
      return new Response(
        JSON.stringify({ error: 'Quote ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch quote data
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (quoteError) throw quoteError;

    // Fetch sections with rooms
    const { data: sections, error: sectionsError } = await supabase
      .from('sections')
      .select('*, rooms(name)')
      .eq('quote_id', quoteId)
      .order('position');

    if (sectionsError) throw sectionsError;

    // Fetch windows
    const { data: windows, error: windowsError } = await supabase
      .from('windows')
      .select('*')
      .in('section_id', sections.map((s: any) => s.id))
      .order('position');

    if (windowsError) throw windowsError;

    // Fetch films
    const { data: films, error: filmsError } = await supabase
      .from('films')
      .select('*');

    if (filmsError) throw filmsError;

    // Fetch company settings
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;

    // Calculate quote totals (replicate client-side logic)
    const filmMap = new Map(films.map((f: FilmData) => [f.id, f]));
    
    const resolveFilm = (windowFilmId: string | null, sectionFilmId: string | null, globalFilmId: string | null) => {
      if (windowFilmId && filmMap.has(windowFilmId)) return filmMap.get(windowFilmId);
      if (sectionFilmId && filmMap.has(sectionFilmId)) return filmMap.get(sectionFilmId);
      if (globalFilmId && filmMap.has(globalFilmId)) return filmMap.get(globalFilmId);
      return null;
    };

    let subtotal = 0;
    const calculatedSections: any[] = [];

    for (const section of sections) {
      const sectionWindows = windows.filter((w: any) => w.section_id === section.id);
      const calculatedWindows: any[] = [];

      for (const window of sectionWindows) {
        const areaSqft = (window.width_in * window.height_in) / 144;
        const lineAreaSqft = areaSqft * window.quantity;
        const effectiveAreaSqft = lineAreaSqft * (1 + window.waste_factor_percent / 100);
        const resolvedFilm = resolveFilm(window.window_film_id, section.section_film_id, quote.global_film_id);
        const sellPerSqft = window.override_sell_per_sqft ?? resolvedFilm?.sell_per_sqft ?? 0;
        const lineTotal = effectiveAreaSqft * sellPerSqft;

        calculatedWindows.push({
          ...window,
          area_sqft: areaSqft,
          effective_area_sqft: effectiveAreaSqft,
          resolved_film: resolvedFilm,
          sell_per_sqft: sellPerSqft,
          line_total: lineTotal,
        });

        subtotal += lineTotal;
      }

      calculatedSections.push({
        ...section,
        windows: calculatedWindows,
        section_total: calculatedWindows.reduce((sum, w) => sum + w.line_total, 0),
      });
    }

    const discountFlatAmount = Math.min(quote.discount_flat || 0, subtotal);
    const subtotalAfterFlat = subtotal - discountFlatAmount;
    const discountPercentAmount = subtotalAfterFlat * ((quote.discount_percent || 0) / 100);
    const subtotalAfterDiscounts = subtotalAfterFlat - discountPercentAmount;
    const travelFee = quote.travel_fee || 0;
    const taxableBase = quote.travel_taxable ? subtotalAfterDiscounts + travelFee : subtotalAfterDiscounts;
    const taxAmount = taxableBase * ((quote.tax_percent || 0) / 100);
    const grandTotal = subtotalAfterDiscounts + travelFee + taxAmount;
    const depositDue = grandTotal * ((quote.deposit_percent || 0) / 100);

    // Generate HTML
    const html = generatePDFHTML({
      quote,
      sections: calculatedSections,
      settings: settings || {
        company_name: 'STL Window Tinting',
        brand_color_hex: '#0891B2',
        logo_url: null,
        pdf_footer_terms: 'Payment Terms: 50% deposit due upon approval. Balance due upon completion.',
      },
      totals: {
        subtotal,
        discount_flat_amount: discountFlatAmount,
        discount_percent_amount: discountPercentAmount,
        subtotal_after_discounts: subtotalAfterDiscounts,
        travel_fee: travelFee,
        taxable_base: taxableBase,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        deposit_due: depositDue,
      },
      filmMap,
    });

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="quote-${quote.quote_number}.html"`,
      },
    });
  } catch (error: any) {
    console.error('PDF generation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generatePDFHTML({ quote, sections, settings, totals, filmMap }: any): string {
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  
  const formatSqft = (sqft: number) => sqft.toFixed(2);

  const usedFilms = new Set<string>();
  sections.forEach((section: any) => {
    section.windows.forEach((window: any) => {
      if (window.resolved_film) {
        usedFilms.add(window.resolved_film.id);
      }
    });
  });

  const filmLegend = Array.from(usedFilms)
    .map(filmId => filmMap.get(filmId))
    .filter(Boolean);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #1e293b;
      background: white;
      padding: 40px;
    }
    .header {
      border-bottom: 4px solid ${settings.brand_color_hex};
      padding-bottom: 20px;
      margin-bottom: 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo { max-height: 60px; max-width: 200px; }
    .company-name { font-size: 28px; font-weight: bold; color: ${settings.brand_color_hex}; }
    .customer-block {
      background: #f8fafc;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .customer-block h2 { color: ${settings.brand_color_hex}; margin-bottom: 15px; }
    .info-row { display: grid; grid-template-columns: 150px 1fr; margin-bottom: 8px; }
    .info-label { font-weight: 600; color: #64748b; }
    .totals-summary {
      background: linear-gradient(135deg, ${settings.brand_color_hex}15, ${settings.brand_color_hex}05);
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      border-left: 4px solid ${settings.brand_color_hex};
    }
    .totals-summary h2 { color: ${settings.brand_color_hex}; margin-bottom: 15px; }
    .total-row { 
      display: flex; 
      justify-content: space-between; 
      padding: 8px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .total-row:last-child { border-bottom: none; font-weight: bold; font-size: 18px; }
    .film-legend {
      background: #f1f5f9;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .film-legend h3 { color: #475569; margin-bottom: 10px; font-size: 14px; }
    .film-item { margin-bottom: 8px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { 
      background: ${settings.brand_color_hex}; 
      color: white; 
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 14px;
    }
    td { 
      padding: 10px 8px; 
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
    }
    .section-header {
      background: #f8fafc;
      font-weight: bold;
      color: ${settings.brand_color_hex};
    }
    .section-total {
      background: #f1f5f9;
      font-weight: bold;
      text-align: right;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
      font-size: 12px;
      color: #64748b;
      line-height: 1.8;
    }
    .page-break { page-break-after: always; }
    @media print {
      body { padding: 20px; }
      .page-break { page-break-after: always; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${settings.logo_url ? `<img src="${settings.logo_url}" alt="Logo" class="logo">` : `<div class="company-name">${settings.company_name}</div>`}
    </div>
    <div style="text-align: right;">
      <div style="font-size: 24px; font-weight: bold; color: ${settings.brand_color_hex};">QUOTE</div>
      <div style="font-size: 18px; margin-top: 5px;">${quote.quote_number}</div>
    </div>
  </div>

  <div class="customer-block">
    <h2>Customer Information</h2>
    <div class="info-row">
      <div class="info-label">Customer:</div>
      <div>${quote.customer_name}</div>
    </div>
    ${quote.customer_email ? `
    <div class="info-row">
      <div class="info-label">Email:</div>
      <div>${quote.customer_email}</div>
    </div>` : ''}
    ${quote.customer_phone ? `
    <div class="info-row">
      <div class="info-label">Phone:</div>
      <div>${quote.customer_phone}</div>
    </div>` : ''}
    ${quote.site_address ? `
    <div class="info-row">
      <div class="info-label">Site Address:</div>
      <div>${quote.site_address}</div>
    </div>` : ''}
    <div class="info-row">
      <div class="info-label">Date:</div>
      <div>${new Date(quote.created_at).toLocaleDateString()}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Status:</div>
      <div>${quote.status}</div>
    </div>
  </div>

  <div class="totals-summary">
    <h2>Quote Summary</h2>
    <div class="total-row">
      <span>Subtotal:</span>
      <span>${formatCurrency(totals.subtotal)}</span>
    </div>
    ${totals.discount_flat_amount > 0 ? `
    <div class="total-row">
      <span>Discount (Flat):</span>
      <span>-${formatCurrency(totals.discount_flat_amount)}</span>
    </div>` : ''}
    ${totals.discount_percent_amount > 0 ? `
    <div class="total-row">
      <span>Discount (${quote.discount_percent}%):</span>
      <span>-${formatCurrency(totals.discount_percent_amount)}</span>
    </div>` : ''}
    ${totals.travel_fee > 0 ? `
    <div class="total-row">
      <span>Travel Fee:</span>
      <span>${formatCurrency(totals.travel_fee)}</span>
    </div>` : ''}
    ${totals.tax_amount > 0 ? `
    <div class="total-row">
      <span>Tax (${quote.tax_percent}%):</span>
      <span>${formatCurrency(totals.tax_amount)}</span>
    </div>` : ''}
    <div class="total-row">
      <span>Grand Total:</span>
      <span>${formatCurrency(totals.grand_total)}</span>
    </div>
    ${totals.deposit_due > 0 ? `
    <div class="total-row">
      <span>Deposit Due (${quote.deposit_percent}%):</span>
      <span>${formatCurrency(totals.deposit_due)}</span>
    </div>` : ''}
  </div>

  ${filmLegend.length > 0 ? `
  <div class="film-legend">
    <h3>FILMS USED IN THIS QUOTE</h3>
    ${filmLegend.map((film: any) => `
      <div class="film-item">
        <strong>${film.brand} ${film.series} - ${film.name}</strong>
        ${film.vlt !== null ? ` • ${film.vlt}% VLT` : ''} • ${formatCurrency(film.sell_per_sqft)}/sqft
      </div>
    `).join('')}
  </div>` : ''}

  <table>
    <thead>
      <tr>
        <th>Room</th>
        <th>Window</th>
        <th>Dimensions</th>
        <th>Qty</th>
        <th>Eff. SqFt</th>
        <th>$/SqFt</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${sections.map((section: any) => `
        <tr class="section-header">
          <td colspan="7">${section.custom_room_name || section.rooms?.name || section.name}</td>
        </tr>
        ${section.windows.map((window: any) => `
          <tr>
            <td></td>
            <td>${window.label}</td>
            <td>${window.width_in}" × ${window.height_in}"</td>
            <td>${window.quantity}</td>
            <td>${formatSqft(window.effective_area_sqft)}</td>
            <td>${formatCurrency(window.sell_per_sqft)}</td>
            <td>${formatCurrency(window.line_total)}</td>
          </tr>
        `).join('')}
        <tr class="section-total">
          <td colspan="6">Section Total:</td>
          <td>${formatCurrency(section.section_total)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${quote.notes_customer ? `
  <div style="background: #fffbeb; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 30px;">
    <h3 style="color: #92400e; margin-bottom: 10px;">Notes</h3>
    <p style="white-space: pre-wrap;">${quote.notes_customer}</p>
  </div>` : ''}

  <div class="footer">
    <div style="font-weight: bold; margin-bottom: 10px;">${settings.company_name}</div>
    ${settings.pdf_footer_terms ? `<div style="margin-bottom: 15px;">${settings.pdf_footer_terms}</div>` : ''}
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
      <div style="display: flex; justify-content: space-between;">
        <div>Customer Signature: _______________________</div>
        <div>Date: _____________</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
