import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WindowSizeRollup {
  width_in: number;
  height_in: number;
  total_qty: number;
  area_sqft_each: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Quote IDs array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating batch window summary for ${ids.length} quotes`);

    // Fetch quotes with sections and windows
    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select(`
        id,
        quote_no,
        customer_name,
        customer_email,
        customer_phone,
        site_address,
        status,
        sections (
          id,
          windows (
            id,
            width_in,
            height_in,
            quantity
          )
        )
      `)
      .in('id', ids)
      .order('customer_name');

    if (quotesError) {
      console.error('Error fetching quotes:', quotesError);
      throw quotesError;
    }

    if (!quotes || quotes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid quotes found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate window rollup for each quote
    const quotesWithRollup = quotes.map(quote => {
      const sizeMap = new Map<string, { w: number; h: number; qty: number }>();
      
      if (quote.sections) {
        for (const section of quote.sections) {
          if (section.windows) {
            for (const win of section.windows) {
              const key = `${win.width_in}x${win.height_in}`;
              const item = sizeMap.get(key) ?? { w: win.width_in, h: win.height_in, qty: 0 };
              item.qty += Math.max(1, win.quantity || 1);
              sizeMap.set(key, item);
            }
          }
        }
      }

      const rollup: WindowSizeRollup[] = [...sizeMap.values()]
        .map(i => ({
          width_in: i.w,
          height_in: i.h,
          total_qty: i.qty,
          area_sqft_each: +((i.w * i.h) / 144).toFixed(2),
        }))
        .sort((a, b) => b.area_sqft_each - a.area_sqft_each || (a.width_in * a.height_in) - (b.width_in * b.height_in));

      return {
        ...quote,
        window_size_rollup: rollup,
      };
    });

    // Generate PDF HTML
    const html = generateBatchPDFHTML(quotesWithRollup);

    // Generate PDF using Puppeteer or similar (placeholder for actual PDF generation)
    const pdfResponse = await fetch('https://api.html2pdf.app/v1/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html,
        options: {
          format: 'Letter',
          margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
        },
      }),
    });

    if (!pdfResponse.ok) {
      console.error('PDF generation failed');
      // Return HTML for debugging if PDF generation fails
      return new Response(html, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }

    const pdfBlob = await pdfResponse.blob();

    return new Response(pdfBlob, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="window-summary-batch-${Date.now()}.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('Error in batch-window-summary:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateBatchPDFHTML(quotes: any[]): string {
  const now = new Date().toLocaleString();
  
  const quoteBlocks = quotes.map(quote => `
    <div class="quote-section" style="page-break-after: always; margin-bottom: 40px;">
      <div style="background: #0891B2; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 24px;">${quote.customer_name}</h2>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">Quote #${quote.quote_no}</p>
      </div>
      
      <div style="padding: 20px; background: #f8f9fa; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 8px 8px;">
        ${quote.site_address ? `<p><strong>Site:</strong> ${quote.site_address}</p>` : ''}
        ${quote.customer_phone ? `<p><strong>Phone:</strong> ${quote.customer_phone}</p>` : ''}
        ${quote.customer_email ? `<p><strong>Email:</strong> ${quote.customer_email}</p>` : ''}
        <p><strong>Status:</strong> <span style="text-transform: capitalize;">${quote.status}</span></p>
      </div>

      <div style="margin-top: 20px;">
        <h3 style="color: #0891B2; margin-bottom: 15px;">Window Summary</h3>
        ${quote.window_size_rollup.length > 0 ? `
          <table style="width: 100%; border-collapse: collapse; background: white;">
            <thead>
              <tr style="background: #0891B2; color: white;">
                <th style="padding: 12px; text-align: left; border: 1px solid #dee2e6;">Size (W×H in)</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">Area (sq ft each)</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${quote.window_size_rollup.map((item: WindowSizeRollup, idx: number) => `
                <tr style="background: ${idx % 2 === 0 ? '#f8f9fa' : 'white'};">
                  <td style="padding: 10px; border: 1px solid #dee2e6; font-family: monospace;">${item.width_in}×${item.height_in}</td>
                  <td style="padding: 10px; text-align: right; border: 1px solid #dee2e6; font-family: monospace;">${item.area_sqft_each}</td>
                  <td style="padding: 10px; text-align: right; border: 1px solid #dee2e6; font-weight: 600;">${item.total_qty}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p style="color: #6c757d;">No windows in this quote</p>'}
      </div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 20px;
          color: #212529;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 3px solid #0891B2;
        }
        .header h1 {
          color: #0891B2;
          margin: 0 0 10px 0;
        }
        .header p {
          color: #6c757d;
          margin: 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Window Summary — Batch Export</h1>
        <p>Generated: ${now}</p>
        <p>${quotes.length} quote${quotes.length !== 1 ? 's' : ''}</p>
      </div>
      
      ${quoteBlocks}
      
      <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #dee2e6; text-align: center; color: #6c757d; font-size: 12px;">
        ${quotes.length !== quotes.filter(q => q.window_size_rollup.length > 0).length ? 
          '<p>Note: Some quotes have no windows and were included with empty summaries.</p>' : ''}
      </div>
    </body>
    </html>
  `;
}
