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
  security_film: boolean;
}

interface MaterialData {
  id: string;
  key: string;
  name: string;
  sell_per_linear_ft: number;
  active: boolean;
}

// Color manipulation helpers
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join('');
}

function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const amount = Math.round(2.55 * percent);
  return rgbToHex(
    Math.min(255, rgb.r + amount),
    Math.min(255, rgb.g + amount),
    Math.min(255, rgb.b + amount)
  );
}

function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const amount = Math.round(2.55 * percent);
  return rgbToHex(
    Math.max(0, rgb.r - amount),
    Math.max(0, rgb.g - amount),
    Math.max(0, rgb.b - amount)
  );
}

function normalizeBrandColor(hex: string | null): string {
  if (!hex) return '#0891B2';
  const normalized = hex.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) return '#0891B2';
  return normalized;
}

// Fetch and convert logo to base64 data URL
async function fetchLogoAsDataUrl(logoUrl: string | null): Promise<{ dataUrl: string | null; error: string | null }> {
  if (!logoUrl) {
    return { dataUrl: null, error: 'No logo URL provided' };
  }

  try {
    console.log('Fetching logo from:', logoUrl);

    // Handle data URLs directly
    if (logoUrl.startsWith('data:')) {
      return { dataUrl: logoUrl, error: null };
    }

    // Fetch the image
    const response = await fetch(logoUrl);
    
    if (!response.ok) {
      console.error('Logo fetch failed:', response.status, response.statusText);
      return { dataUrl: null, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    
    // Validate content type
    if (!contentType.startsWith('image/')) {
      console.error('Invalid content type:', contentType);
      return { dataUrl: null, error: 'Not an image' };
    }

    // Get image bytes
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Check size (4MB max)
    if (bytes.length > 4 * 1024 * 1024) {
      console.error('Logo too large:', bytes.length, 'bytes');
      return { dataUrl: null, error: 'File too large' };
    }

    if (bytes.length === 0) {
      console.error('Empty logo file');
      return { dataUrl: null, error: 'Empty file' };
    }

    // Convert to base64
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    const dataUrl = `data:${contentType};base64,${base64}`;
    console.log('Logo converted to data URL');
    console.log('- Content Type:', contentType);
    console.log('- Base64 length:', base64.length);
    console.log('- Data URL length:', dataUrl.length);
    console.log('- Data URL preview:', dataUrl.substring(0, 100));
    
    return { dataUrl, error: null };
  } catch (error: any) {
    console.error('Logo fetch error:', error.message);
    return { dataUrl: null, error: error.message };
  }
}

// Generate monogram fallback
function generateMonogram(companyName: string, brandColor: string): string {
  const initials = companyName
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return `
    <div style="
      width: 56px;
      height: 56px;
      background: ${brandColor};
      color: white;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 700;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    ">
      ${initials}
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { quoteId, summary } = await req.json();

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

    // Fetch materials
    const { data: materials, error: materialsError } = await supabase
      .from('materials')
      .select('*')
      .eq('active', true);

    if (materialsError) throw materialsError;

    // Fetch company settings
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;

    const companySettings = settings || {
      company_name: 'STL Window Tinting',
      brand_color_hex: '#0891B2',
      logo_url: null,
      pdf_footer_terms: 'Payment Terms: 50% deposit due upon approval. Balance due upon completion.',
      theme_style: 'Modern',
      tagline: null,
    };

    // Fetch and embed logo
    const { dataUrl: logoDataUrl, error: logoError } = await fetchLogoAsDataUrl(companySettings.logo_url);
    if (logoError) {
      console.log('Logo fetch failed, using monogram fallback:', logoError);
    }

    // Calculate quote totals (replicate client-side logic)
    const filmMap = new Map(films.map((f: FilmData) => [f.id, f]));
    
    const resolveFilm = (windowFilmId: string | null, sectionFilmId: string | null, globalFilmId: string | null) => {
      if (windowFilmId && filmMap.has(windowFilmId)) return filmMap.get(windowFilmId);
      if (sectionFilmId && filmMap.has(sectionFilmId)) return filmMap.get(sectionFilmId);
      if (globalFilmId && filmMap.has(globalFilmId)) return filmMap.get(globalFilmId);
      return null;
    };

    let windowsSubtotal = 0;
    let totalLinearFeetSecurity = 0;
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
        
        // Calculate linear feet for security film
        const isSecurity = resolvedFilm?.security_film ?? false;
        const linearFeet = isSecurity 
          ? window.quantity * (2 * (window.width_in + window.height_in) / 12)
          : 0;
        
        if (linearFeet > 0) {
          totalLinearFeetSecurity += linearFeet;
        }
        
        // Track if override was used
        const hasOverride = window.override_sell_per_sqft !== null || 
                          (window.window_film_id !== null && window.window_film_id !== section.section_film_id && window.window_film_id !== quote.global_film_id);

        calculatedWindows.push({
          ...window,
          area_sqft: areaSqft,
          effective_area_sqft: effectiveAreaSqft,
          resolved_film: resolvedFilm,
          sell_per_sqft: sellPerSqft,
          line_total: lineTotal,
          linear_feet: linearFeet,
          is_security: isSecurity,
          has_override: hasOverride,
        });

        windowsSubtotal += lineTotal;
      }

      calculatedSections.push({
        ...section,
        windows: calculatedWindows,
        section_total: calculatedWindows.reduce((sum, w) => sum + w.line_total, 0),
      });
    }

    // Build summaries (same logic as client-side)
    const gasket = materials?.find((m: MaterialData) => m.key === 'gasket');
    const caulk = materials?.find((m: MaterialData) => m.key === 'caulk');

    const calculateSummary = (
      key: string,
      label: string,
      materialsUnitPrice: number
    ) => {
      const materialsTotal = totalLinearFeetSecurity * materialsUnitPrice;
      const subtotal = windowsSubtotal + materialsTotal;
      const discountFlatAmount = Math.min(quote.discount_flat || 0, subtotal);
      const subtotalAfterFlat = subtotal - discountFlatAmount;
      const discountPercentAmount = subtotalAfterFlat * ((quote.discount_percent || 0) / 100);
      const subtotalAfterDiscounts = subtotalAfterFlat - discountPercentAmount;
      const travelFee = quote.travel_fee || 0;
      const taxableBase = quote.travel_taxable ? subtotalAfterDiscounts + travelFee : subtotalAfterDiscounts;
      const taxAmount = taxableBase * ((quote.tax_percent || 0) / 100);
      const grandTotal = subtotalAfterDiscounts + travelFee + taxAmount;
      const depositDue = grandTotal * ((quote.deposit_percent || 0) / 100);
      const totalSavings = discountFlatAmount + discountPercentAmount;

      return {
        key,
        label,
        subtotal,
        materials_total: materialsTotal,
        materials_unit_price: materialsUnitPrice,
        discount_flat_amount: discountFlatAmount,
        discount_percent_amount: discountPercentAmount,
        subtotal_after_discounts: subtotalAfterDiscounts,
        travel_fee: travelFee,
        tax_amount: taxAmount,
        grand_total: grandTotal,
        deposit_due: depositDue,
        total_savings: totalSavings,
      };
    };

    const summaries = [
      calculateSummary('no_materials', 'No Materials', 0),
      ...(gasket ? [calculateSummary('gasket', 'Gasket', gasket.sell_per_linear_ft)] : []),
      ...(caulk ? [calculateSummary('caulk', 'Caulk', caulk.sell_per_linear_ft)] : []),
    ];

    // Window size rollup
    const sizeMap = new Map<string, { w: number; h: number; qty: number }>();
    for (const section of calculatedSections) {
      for (const win of section.windows) {
        const key = `${win.width_in}x${win.height_in}`;
        const item = sizeMap.get(key) ?? { w: win.width_in, h: win.height_in, qty: 0 };
        item.qty += Math.max(1, win.quantity || 1);
        sizeMap.set(key, item);
      }
    }
    const windowSizeRollup = [...sizeMap.values()]
      .map(i => ({
        width_in: i.w,
        height_in: i.h,
        total_qty: i.qty,
        area_sqft_each: +((i.w * i.h) / 144).toFixed(2),
      }))
      .sort((a, b) => b.area_sqft_each - a.area_sqft_each || (a.width_in * a.height_in) - (b.width_in * b.height_in));

    // Determine which summaries to render
    const selectedSummaries = summary === 'all' 
      ? summaries 
      : summaries.filter(s => s.key === summary || summary === undefined);
    
    if (selectedSummaries.length === 0) {
      selectedSummaries.push(summaries[0]); // Default to no_materials
    }

    // Generate HTML
    const html = generatePDFHTML({
      quote,
      sections: calculatedSections,
      settings: companySettings,
      logoDataUrl,
      themeStyle: companySettings.theme_style || 'Modern',
      summaries: selectedSummaries,
      totalLinearFeetSecurity,
      windowSizeRollup,
      filmMap,
    });

    console.log('Generating HTML with logo:', logoDataUrl ? 'Yes' : 'No');
    console.log('Theme style:', companySettings.theme_style);
    
    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
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

function generatePDFHTML({ quote, sections, settings, logoDataUrl, themeStyle, summaries, totalLinearFeetSecurity, windowSizeRollup, filmMap }: any): string {
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  
  const formatSqft = (sqft: number) => sqft.toFixed(2);

  const brandColor = normalizeBrandColor(settings.brand_color_hex);
  const brandTint = lightenColor(brandColor, 42);
  const brandShade = darkenColor(brandColor, 18);
  const brandPattern = lightenColor(brandColor, 48);
  
  // Theme-specific styling
  const isModern = themeStyle === 'Modern';
  const isMinimal = themeStyle === 'Minimal';
  const isBold = themeStyle === 'Bold';

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

  const logoHtml = logoDataUrl 
    ? `<img src="${logoDataUrl}" alt="${settings.company_name} Logo" style="max-height: 56px; max-width: 200px; object-fit: contain; display: block;">`
    : generateMonogram(settings.company_name, brandColor);
  
  console.log('Logo HTML generated:', logoDataUrl ? 'Using data URL image' : 'Using monogram');
  console.log('Logo data URL length:', logoDataUrl?.length || 0);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @media print {
      body { padding: 0; }
      .header { page-break-inside: avoid; }
      .hero-band { page-break-inside: avoid; }
      .totals-card { page-break-inside: avoid; }
      .section-header { page-break-before: auto; page-break-after: avoid; }
    }
    
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
      line-height: 1.6;
      color: ${isMinimal ? '#000000' : '#1e293b'};
      background: white;
      padding: 32px;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: ${isBold ? '32px' : '24px'};
      ${isMinimal 
        ? `background: white; border-bottom: 3px solid ${brandColor};` 
        : isModern
        ? `background: linear-gradient(135deg, ${brandPattern} 0%, ${brandTint} 100%);
           background-image: 
             repeating-linear-gradient(
               45deg,
               ${brandColor}08 0px,
               ${brandColor}08 1px,
               transparent 1px,
               transparent 20px
             ),
             linear-gradient(135deg, ${brandPattern} 0%, ${brandTint} 100%);`
        : `background: ${brandColor}; color: white;`
      }
      border-radius: ${isMinimal ? '0' : '12px'};
      margin-bottom: ${isBold ? '40px' : '32px'};
      box-shadow: ${isMinimal ? 'none' : '0 2px 8px rgba(0,0,0,0.06)'};
    }
    
    .logo-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-start;
    }
    
    .logo-container img {
      display: block;
      max-height: 56px;
      max-width: 200px;
      height: auto;
      width: auto;
      object-fit: contain;
    }
    
    .company-info {
      text-align: right;
    }
    
    .company-name { 
      font-size: ${isBold ? '24px' : '20px'}; 
      font-weight: ${isBold ? '800' : '700'}; 
      color: ${isBold ? 'white' : isMinimal ? '#000000' : brandShade};
      margin-bottom: 4px;
    }
    
    .tagline {
      font-size: 13px;
      color: #64748b;
      font-style: italic;
    }
    
    .quote-label {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      font-weight: 600;
    }
    
    .quote-number {
      font-size: 24px;
      font-weight: 700;
      color: ${brandColor};
    }
    
    .hero-band {
      ${isMinimal 
        ? `background: #f8f9fa; color: #000000; border-left: 4px solid ${brandColor};`
        : `background: linear-gradient(135deg, ${brandColor} 0%, ${brandShade} 100%); color: white;`
      }
      padding: ${isBold ? '48px' : '32px'};
      border-radius: ${isMinimal ? '0' : '12px'};
      margin-bottom: ${isMinimal ? '24px' : '-20px'};
      box-shadow: ${isMinimal ? 'none' : `0 4px 12px ${brandColor}40`};
      position: relative;
      z-index: 1;
    }
    
    .hero-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .grand-total-section h2 {
      font-size: ${isBold ? '16px' : '14px'};
      font-weight: ${isBold ? '700' : '600'};
      opacity: ${isMinimal ? '0.7' : '0.9'};
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    
    .grand-total-amount {
      font-size: 48px;
      font-weight: 700;
      line-height: 1;
    }
    
    .deposit-info {
      font-size: 16px;
      opacity: 0.9;
      margin-top: 12px;
    }
    
    .quote-meta {
      text-align: right;
      opacity: 0.95;
    }
    
    .quote-meta div {
      font-size: 13px;
      margin-bottom: 4px;
    }
    
    .customer-card {
      background: white;
      padding: 32px;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      margin-top: 40px;
      margin-bottom: 32px;
    }
    
    .customer-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    
    .info-item {
      display: flex;
      align-items: start;
      gap: 12px;
    }
    
    .icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    
    .info-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 4px;
    }
    
    .info-value {
      font-size: 15px;
      color: #1e293b;
      font-weight: 500;
    }
    
    .film-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 32px;
      padding: 20px;
      background: ${brandTint}20;
      border-radius: 12px;
      border: 1px solid ${brandTint};
    }
    
    .film-chip {
      background: white;
      padding: 10px 16px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    
    .film-chip strong {
      color: ${brandShade};
      font-weight: 600;
    }
    
    .vlt-badge {
      background: ${brandTint};
      color: ${brandShade};
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-bottom: 32px;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    
    th { 
      background: ${brandColor}; 
      color: white; 
      padding: 16px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    th:nth-child(n+4) {
      text-align: right;
    }
    
    td { 
      padding: 14px 12px; 
      border-bottom: 1px solid #f1f5f9;
      font-size: 14px;
    }
    
    td:nth-child(n+4) {
      text-align: right;
    }
    
    tr:nth-child(even) {
      background: ${brandTint}10;
    }
    
    .section-header {
      background: ${brandTint}40 !important;
      font-weight: 700;
      color: ${brandShade};
      font-size: 15px;
    }
    
    .section-header td {
      padding: 16px 12px;
      border-bottom: 2px solid ${brandTint};
    }
    
    .room-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      ${isMinimal
        ? `background: white; color: ${brandColor}; border: 2px solid ${brandColor};`
        : `background: ${brandColor}; color: white;`
      }
      padding: ${isBold ? '10px 18px' : '6px 14px'};
      border-radius: ${isMinimal ? '4px' : '20px'};
      font-size: ${isBold ? '16px' : '14px'};
      font-weight: ${isBold ? '700' : '400'};
    }
    
    .section-label {
      font-size: 11px;
      opacity: 0.8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .section-total {
      background: ${brandTint}30 !important;
      font-weight: 700;
      font-size: 15px;
    }
    
    .section-total td {
      padding: 14px 12px;
      border-bottom: 2px solid ${brandTint};
    }
    
    .override-badge {
      display: inline-block;
      background: #f59e0b;
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      margin-left: 6px;
      text-transform: uppercase;
    }
    
    .savings-banner {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      margin-bottom: 32px;
      text-align: center;
      font-size: 16px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }
    
    .notes-block {
      background: #fffbeb;
      padding: 20px 24px;
      border-radius: 12px;
      border-left: 4px solid #f59e0b;
      margin-bottom: 32px;
    }
    
    .notes-block h3 {
      color: #92400e;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    
    .notes-block p {
      color: #78350f;
      font-size: 14px;
      line-height: 1.7;
      white-space: pre-wrap;
    }
    
    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 2px solid ${brandTint};
    }
    
    .footer-content {
      font-size: 12px;
      color: #64748b;
      line-height: 1.8;
    }
    
    .footer-company {
      font-weight: 700;
      color: ${brandShade};
      font-size: 14px;
      margin-bottom: 12px;
    }
    
    .signature-line {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .signature-box {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .signature-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
    }
    
    .signature-underline {
      width: 250px;
      border-bottom: 2px solid #cbd5e1;
      height: 40px;
    }
    
    @media print {
      body { padding: 16px; }
      .page-break { page-break-after: always; }
      table { page-break-inside: avoid; }
      .section-header { page-break-after: avoid; }
      .customer-card, .hero-band { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-container">
      ${logoHtml}
      ${settings.tagline ? `<div class="tagline">${settings.tagline}</div>` : ''}
    </div>
    <div class="company-info">
      <div class="company-name">${settings.company_name}</div>
      <div class="quote-label">Quote</div>
      <div class="quote-number">${quote.quote_number || 'Draft'}</div>
    </div>
  </div>

  ${summaries.map((summary: any, idx: number) => `
    ${idx > 0 ? '<div style="page-break-before: always;"></div>' : ''}
    
    <div class="hero-band">
      <div class="hero-content">
        <div class="grand-total-section">
          <h2>Total Investment ${summaries.length > 1 ? `— ${summary.label}` : ''}</h2>
          <div class="grand-total-amount">${formatCurrency(summary.grand_total)}</div>
          ${summary.deposit_due > 0 ? `
            <div class="deposit-info">Deposit Due: ${formatCurrency(summary.deposit_due)}</div>
          ` : ''}
        </div>
        <div class="quote-meta">
          <div class="quote-label">Quote Number</div>
          <div class="quote-number">${quote.quote_number}</div>
          <div style="margin-top: 12px;">${new Date(quote.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div>Status: <strong>${quote.status}</strong></div>
        </div>
      </div>
    </div>
    
    ${idx === 0 ? `

  <div class="customer-card">
    <div class="customer-grid">
      <div class="info-item">
        <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
        <div>
          <div class="info-label">Customer</div>
          <div class="info-value">${quote.customer_name}</div>
        </div>
      </div>
      
      ${quote.site_address ? `
      <div class="info-item">
        <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        <div>
          <div class="info-label">Site Address</div>
          <div class="info-value">${quote.site_address}</div>
        </div>
      </div>
      ` : ''}
      
      ${quote.customer_email ? `
      <div class="info-item">
        <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
        <div>
          <div class="info-label">Email</div>
          <div class="info-value">${quote.customer_email}</div>
        </div>
      </div>
      ` : ''}
      
      ${quote.customer_phone ? `
      <div class="info-item">
        <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
        </svg>
        <div>
          <div class="info-label">Phone</div>
          <div class="info-value">${quote.customer_phone}</div>
        </div>
      </div>
      ` : ''}
    </div>
  </div>

    ${summary.total_savings > 0 ? `
      <div class="savings-banner">
        🎉 You're saving ${formatCurrency(summary.total_savings)} on this quote!
      </div>
    ` : ''}

  ${filmLegend.length > 0 ? `
    <div class="film-chips">
      ${filmLegend.map((film: any) => `
        <div class="film-chip">
          <strong>${film.brand} ${film.series} ${film.name}</strong>
          ${film.vlt !== null ? `<span class="vlt-badge">${film.vlt}% VLT</span>` : ''}
          <span style="color: #64748b;">•</span>
          <span>${formatCurrency(film.sell_per_sqft)}/sqft</span>
        </div>
      `).join('')}
    </div>
  ` : ''}

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
          <td colspan="7">
            <span class="room-pill">
              <span class="section-label">Section</span>
              <span>${section.custom_room_name || section.rooms?.name || section.name}</span>
            </span>
          </td>
        </tr>
        ${section.windows.map((window: any) => `
          <tr>
            <td></td>
            <td>${window.label}</td>
            <td>${window.width_in}" × ${window.height_in}"</td>
            <td>${window.quantity}</td>
            <td>${formatSqft(window.effective_area_sqft)}</td>
            <td>
              ${formatCurrency(window.sell_per_sqft)}
              ${window.has_override ? '<span class="override-badge">Override</span>' : ''}
            </td>
            <td>${formatCurrency(window.line_total)}</td>
          </tr>
        `).join('')}
        <tr class="section-total">
          <td colspan="6" style="text-align: right; padding-right: 12px;">Section Total:</td>
          <td>${formatCurrency(section.section_total)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

    <!-- Totals Card -->
    <div class="totals-card">
      <h3 style="font-size: 16px; font-weight: 700; color: ${brandShade}; margin-bottom: 16px;">Quote Summary${summaries.length > 1 ? ` — ${summary.label}` : ''}</h3>
      
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 14px;">
        <div style="display: flex; justify-between;">
          <span style="color: #64748b;">Subtotal</span>
          <span style="font-weight: 600;">${formatCurrency(summary.subtotal)}</span>
        </div>
        
        ${summary.materials_total > 0 ? `
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="display: flex; flex-direction: column;">
              <span style="color: #64748b;">Materials (${summary.label})</span>
              <span style="font-size: 12px; color: #94a3b8;">${totalLinearFeetSecurity.toFixed(2)} ft @ ${formatCurrency(summary.materials_unit_price)}/ft</span>
            </div>
            <span style="font-weight: 600; color: ${brandColor};">${formatCurrency(summary.materials_total)}</span>
          </div>
        ` : ''}
        
        ${summary.discount_flat_amount > 0 ? `
          <div style="display: flex; justify-between;">
            <span style="color: #64748b;">Discount (Flat)</span>
            <span style="font-weight: 600; color: #10b981;">-${formatCurrency(summary.discount_flat_amount)}</span>
          </div>
        ` : ''}
        
        ${summary.discount_percent_amount > 0 ? `
          <div style="display: flex; justify-between;">
            <span style="color: #64748b;">Discount (%)</span>
            <span style="font-weight: 600; color: #10b981;">-${formatCurrency(summary.discount_percent_amount)}</span>
          </div>
        ` : ''}
        
        ${summary.travel_fee > 0 ? `
          <div style="display: flex; justify-between;">
            <span style="color: #64748b;">Travel Fee</span>
            <span style="font-weight: 600;">${formatCurrency(summary.travel_fee)}</span>
          </div>
        ` : ''}
        
        <div style="display: flex; justify-between;">
          <span style="color: #64748b;">Tax</span>
          <span style="font-weight: 600;">${formatCurrency(summary.tax_amount)}</span>
        </div>
        
        <div style="border-top: 2px solid ${brandTint}; padding-top: 12px; display: flex; justify-between; align-items: center;">
          <span style="font-weight: 700; font-size: 16px;">Grand Total</span>
          <span style="font-weight: 700; font-size: 20px; color: ${brandColor};">${formatCurrency(summary.grand_total)}</span>
        </div>
        
        ${summary.deposit_due > 0 ? `
          <div style="background: ${brandTint}20; padding: 12px 16px; border-radius: 8px; border: 1px solid ${brandTint};">
            <div style="display: flex; justify-between; align-items: center;">
              <div>
                <div style="font-weight: 600; color: ${brandShade};">Deposit Due</div>
                <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Due upon signing</div>
              </div>
              <span style="font-weight: 700; font-size: 18px; color: ${brandShade};">${formatCurrency(summary.deposit_due)}</span>
            </div>
          </div>
        ` : ''}
      </div>
    </div>

    ${idx === 0 && windowSizeRollup.length > 0 ? `
      <div style="margin-top: 32px; background: white; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h3 style="font-size: 16px; font-weight: 700; color: ${brandShade}; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"/>
          </svg>
          Window Summary
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: ${brandTint}20; border-bottom: 2px solid ${brandTint};">
              <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Size (W×H in)</th>
              <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Area (sq ft each)</th>
              <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${windowSizeRollup.map((item: any, i: number) => `
              <tr style="${i % 2 === 1 ? `background: ${brandTint}10;` : ''}">
                <td style="padding: 10px; font-family: monospace;">${item.width_in}×${item.height_in}</td>
                <td style="padding: 10px; text-align: right; font-family: monospace;">${formatSqft(item.area_sqft_each)}</td>
                <td style="padding: 10px; text-align: right; font-weight: 600;">${item.total_qty}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}
    ` : ''}
  `).join('')}

  ${quote.notes_customer ? `
    <div class="notes-block">
      <h3>Important Notes</h3>
      <p>${quote.notes_customer}</p>
    </div>
  ` : ''}

  <div class="footer">
    <div class="footer-company">${settings.company_name}</div>
    <div class="footer-content">
      ${settings.pdf_footer_terms || ''}
    </div>
    
    <div class="signature-line">
      <div class="signature-box">
        <div class="signature-label">Customer Signature</div>
        <div class="signature-underline"></div>
      </div>
      <div class="signature-box">
        <div class="signature-label">Date</div>
        <div class="signature-underline" style="width: 150px;"></div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}
