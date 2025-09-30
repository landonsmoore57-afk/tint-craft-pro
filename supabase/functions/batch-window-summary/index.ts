import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RollPlan {
  slit_width_in: number;
  base_roll_in: 48 | 60 | 72;
  orientation: 'width-across' | 'height-across';
  waste_in: number;
  note?: string;
}

interface WindowSizeRollup {
  width_in: number;
  height_in: number;
  total_qty: number;
  area_sqft_each: number;
  film_id: string | null;
  film_display: string;
  roll_plan?: RollPlan | { error: string };
}

interface RoomSize {
  width_in: number;
  height_in: number;
  area_sqft_each: number;
  total_qty: number;
  roll_plan?: RollPlan | { error: string };
}

interface RoomSizeRollup {
  room_label: string;
  total_windows_qty: number;
  sizes: RoomSize[];
}

interface RollConfig {
  roll_widths_in?: number[];
  allow_equal_splits?: boolean;
  cross_trim_in?: number;
  allow_rotation?: boolean;
  exact_base_match_has_no_cross_trim?: boolean;
}

const DEFAULT_ROLL_CONFIG: RollConfig = {
  roll_widths_in: [48, 60, 72],
  allow_equal_splits: true,
  cross_trim_in: 0.5,
  allow_rotation: true,
  exact_base_match_has_no_cross_trim: true,
};

function buildSlitCatalog(bases: number[] = [48, 60, 72]): Array<{ slit: number; base: number }> {
  const map = new Map<number, number>();
  for (const b of [...bases].sort((a, b) => a - b)) {
    for (let n = 1; n <= 6; n++) {
      if (b % n === 0) {
        const slit = b / n;
        const prev = map.get(slit);
        if (!prev || b < prev) map.set(slit, b);
      }
    }
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([slit, base]) => ({ slit, base }));
}

function pickRollForSize(W: number, H: number, cfg: RollConfig = DEFAULT_ROLL_CONFIG): RollPlan | { error: string } {
  const bases = (cfg.roll_widths_in ?? [48, 60, 72]).slice().sort((a, b) => a - b);
  const crossTrim = cfg.cross_trim_in ?? 0;
  const allowRot = cfg.allow_rotation !== false;

  // 1) Exact base match wins
  for (const [dim, orient] of [[W, 'width-across'] as const, [H, 'height-across'] as const]) {
    if (bases.includes(dim)) {
      return { slit_width_in: dim, base_roll_in: dim as 48 | 60 | 72, orientation: orient, waste_in: 0, note: 'Exact base match' };
    }
  }

  // 2) 36" fallback
  for (const [dim, orient] of [[W, 'width-across'] as const, [H, 'height-across'] as const]) {
    if (dim === 36) {
      return { slit_width_in: 36, base_roll_in: 72, orientation: orient, waste_in: 0, note: '36-inch fallback (72→36)' };
    }
  }

  // 3) Minimal-waste
  const candidates = buildSlitCatalog(bases);
  type Plan = { slit_width_in: number; base_roll_in: 48 | 60 | 72; orientation: 'width-across' | 'height-across'; waste_in: number; note?: string };
  let best: Plan | null = null;

  const orientations: Array<{ need: number; orient: Plan['orientation'] }> = [{ need: W + 2 * crossTrim, orient: 'width-across' }];
  if (allowRot) orientations.push({ need: H + 2 * crossTrim, orient: 'height-across' });

  for (const d of orientations) {
    for (const { slit, base } of candidates) {
      if (slit + 1e-6 >= d.need) {
        const waste = +(slit - d.need).toFixed(2);
        const plan: Plan = { slit_width_in: slit, base_roll_in: base as 48 | 60 | 72, orientation: d.orient, waste_in: waste, note: slit !== base ? `Minimal waste (${base}→${slit})` : undefined };
        if (
          !best ||
          plan.waste_in < best.waste_in ||
          (plan.waste_in === best.waste_in && plan.base_roll_in < best.base_roll_in) ||
          (plan.waste_in === best.waste_in && plan.base_roll_in === best.base_roll_in && plan.slit_width_in === plan.base_roll_in) ||
          (plan.waste_in === best.waste_in &&
            plan.base_roll_in === best.base_roll_in && plan.slit_width_in === best.slit_width_in &&
            plan.orientation === 'width-across')
        ) {
          best = plan;
        }
        break;
      }
    }
  }
  
  return best ?? { error: 'Oversize — no roll fits' };
}

function formatRollPlan(plan: RollPlan | { error: string } | undefined): string {
  if (!plan) return 'N/A';
  if ('error' in plan) return plan.error;
  const { slit_width_in, base_roll_in, orientation, waste_in, note } = plan;
  if (note === 'Exact base match') return `${base_roll_in}" roll (exact fit, ${orientation})`;
  if (note === '36-inch fallback (72→36)') return `72" roll → 36" slit (${orientation})`;
  if (slit_width_in !== base_roll_in) return `${base_roll_in}" roll → ${slit_width_in}" slit (${orientation}, waste ${waste_in.toFixed(2)}")`;
  return `${base_roll_in}" roll (${orientation}, waste ${waste_in.toFixed(2)}")`;
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
        global_film_id,
        sections (
          id,
          name,
          room_id,
          custom_room_name,
          section_film_id,
          windows (
            id,
            width_in,
            height_in,
            quantity,
            window_film_id
          )
        )
      `)
      .in('id', ids)
      .order('customer_name');

    if (quotesError) {
      console.error('Error fetching quotes:', quotesError);
      throw quotesError;
    }

    // Fetch rooms
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, name')
      .order('name');

    if (roomsError) {
      console.error('Error fetching rooms:', roomsError);
      throw roomsError;
    }

    // Fetch all films for resolving
    const { data: films, error: filmsError } = await supabase
      .from('films')
      .select('id, brand, series, name, vlt');

    if (filmsError) {
      console.error('Error fetching films:', filmsError);
      throw filmsError;
    }

    const filmsMap = new Map(films?.map(f => [f.id, f]) || []);

    if (!quotes || quotes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid quotes found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate window rollup for each quote
    const quotesWithRollup = quotes.map(quote => {
      // Helper to resolve film (window > section > global)
      const resolveFilm = (win: any, section: any) => {
        const filmId = win.window_film_id || section.section_film_id || quote.global_film_id;
        return filmId ? filmsMap.get(filmId) : null;
      };

      const sizeMap = new Map<string, { w: number; h: number; qty: number; film_id: string | null; film_display: string }>();
      
      if (quote.sections) {
        for (const section of quote.sections) {
          if (section.windows) {
            for (const win of section.windows) {
              // Resolve film for this window
              const film = resolveFilm(win, section);
              const film_id = film?.id ?? null;
              const film_display = film 
                ? `${film.brand} ${film.series} ${film.name}${film.vlt != null ? ` ${film.vlt}%` : ''}`
                : 'No Film';
              
              const key = `${win.width_in}x${win.height_in}|${film_id ?? 'none'}`;
              const item = sizeMap.get(key) ?? { w: win.width_in, h: win.height_in, qty: 0, film_id, film_display };
              item.qty += Math.max(1, win.quantity || 1);
              sizeMap.set(key, item);
            }
          }
        }
      }

      const rollConfig = DEFAULT_ROLL_CONFIG;
      const rollup: WindowSizeRollup[] = [...sizeMap.values()]
        .map(i => ({
          width_in: i.w,
          height_in: i.h,
          total_qty: i.qty,
          area_sqft_each: +((i.w * i.h) / 144).toFixed(2),
          film_id: i.film_id,
          film_display: i.film_display,
          roll_plan: pickRollForSize(i.w, i.h, rollConfig),
        }))
        .sort((a, b) => 
          a.film_display.localeCompare(b.film_display) || 
          b.area_sqft_each - a.area_sqft_each || 
          (a.width_in * a.height_in) - (b.width_in * b.height_in)
        );

      // Calculate rooms summary
      const roomsMap = new Map<string, Map<string, { w: number; h: number; qty: number }>>();
      const roomTotals = new Map<string, number>();
      
      if (quote.sections) {
        for (const section of quote.sections) {
          // Resolve room label: custom_room_name > rooms.name > section.name > 'Unassigned'
          let roomLabel = 'Unassigned';
          if (section.custom_room_name) {
            roomLabel = section.custom_room_name;
          } else if (section.room_id) {
            const room = rooms?.find((r: any) => r.id === section.room_id);
            roomLabel = room?.name || section.name || 'Unassigned';
          } else if (section.name) {
            roomLabel = section.name;
          }

          if (!roomsMap.has(roomLabel)) {
            roomsMap.set(roomLabel, new Map());
          }
          const roomSizeMap = roomsMap.get(roomLabel)!;

          if (section.windows) {
            for (const win of section.windows) {
              const qty = Math.max(1, win.quantity || 1);
              const key = `${win.width_in}x${win.height_in}`;
              const item = roomSizeMap.get(key) ?? { w: win.width_in, h: win.height_in, qty: 0 };
              item.qty += qty;
              roomSizeMap.set(key, item);

              roomTotals.set(roomLabel, (roomTotals.get(roomLabel) ?? 0) + qty);
            }
          }
        }
      }

      const roomsRollup: RoomSizeRollup[] = [...roomsMap.entries()]
        .map(([room, roomSizeMap]) => {
          const sizes = [...roomSizeMap.values()]
            .map(i => ({
              width_in: i.w,
              height_in: i.h,
              area_sqft_each: +((i.w * i.h) / 144).toFixed(2),
              total_qty: i.qty,
              roll_plan: pickRollForSize(i.w, i.h, rollConfig),
            }))
            .sort((a, b) =>
              b.area_sqft_each - a.area_sqft_each ||
              (a.width_in * a.height_in) - (b.width_in * b.height_in)
            );

          return {
            room_label: room,
            total_windows_qty: roomTotals.get(room) ?? 0,
            sizes,
          };
        })
        .sort((a, b) => {
          if (a.room_label === 'Unassigned') return 1;
          if (b.room_label === 'Unassigned') return -1;
          return a.room_label.localeCompare(b.room_label, undefined, { numeric: true });
        });

      return {
        ...quote,
        window_size_rollup: rollup,
        rooms_summary: roomsRollup,
      };
    });

    // Generate PDF HTML
    const html = generateBatchPDFHTML(quotesWithRollup);

    // Return HTML for browser print dialog (same approach as single quote PDF)
    return new Response(html, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html',
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
                <th style="padding: 12px; text-align: left; border: 1px solid #dee2e6;">Film</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #dee2e6;">Size (W×H in)</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">Area (sq ft each)</th>
                <th style="padding: 12px; text-align: right; border: 1px solid #dee2e6;">Qty</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #dee2e6;">Roll Size</th>
              </tr>
            </thead>
            <tbody>
              ${quote.window_size_rollup.map((item: WindowSizeRollup, idx: number) => `
                <tr style="background: ${idx % 2 === 0 ? '#f8f9fa' : 'white'};">
                  <td style="padding: 10px; border: 1px solid #dee2e6; font-size: 12px; font-weight: 500;">${item.film_display}</td>
                  <td style="padding: 10px; border: 1px solid #dee2e6; font-family: monospace;">${item.width_in}×${item.height_in}</td>
                  <td style="padding: 10px; text-align: right; border: 1px solid #dee2e6; font-family: monospace;">${item.area_sqft_each}</td>
                  <td style="padding: 10px; text-align: right; border: 1px solid #dee2e6; font-weight: 600;">${item.total_qty}</td>
                  <td style="padding: 10px; border: 1px solid #dee2e6; font-size: 12px;">${formatRollPlan(item.roll_plan)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p style="color: #6c757d;">No windows in this quote</p>'}
      </div>

      ${quote.rooms_summary && quote.rooms_summary.length > 0 ? `
      <div style="margin-top: 24px;">
        <h3 style="color: #0891B2; margin-bottom: 15px;">Rooms Summary</h3>
        ${quote.rooms_summary.map((room: RoomSizeRollup, roomIdx: number) => `
          <div style="margin-bottom: ${roomIdx < quote.rooms_summary.length - 1 ? '20px' : '0'};">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding: 8px 12px; background: #e0f2fe; border-radius: 6px;">
              <span style="font-weight: 600; color: #0891B2;">${room.room_label}</span>
              <span style="background: #0891B2; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                ${room.total_windows_qty} ${room.total_windows_qty === 1 ? 'window' : 'windows'}
              </span>
            </div>
            <table style="width: 100%; border-collapse: collapse; background: white; margin-bottom: 12px;">
              <thead>
                <tr style="background: #e0f2fe;">
                  <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6; font-size: 11px; text-transform: uppercase;">Size (W×H in)</th>
                  <th style="padding: 10px; text-align: right; border: 1px solid #dee2e6; font-size: 11px; text-transform: uppercase;">Area (sq ft each)</th>
                  <th style="padding: 10px; text-align: right; border: 1px solid #dee2e6; font-size: 11px; text-transform: uppercase;">Qty</th>
                  <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6; font-size: 11px; text-transform: uppercase;">Roll Size</th>
                </tr>
              </thead>
              <tbody>
                ${room.sizes.map((size: RoomSize, sizeIdx: number) => `
                  <tr style="background: ${sizeIdx % 2 === 0 ? '#f8f9fa' : 'white'};">
                    <td style="padding: 8px 10px; border: 1px solid #dee2e6; font-family: monospace;">${size.width_in}×${size.height_in}</td>
                    <td style="padding: 8px 10px; text-align: right; border: 1px solid #dee2e6; font-family: monospace;">${size.area_sqft_each}</td>
                    <td style="padding: 8px 10px; text-align: right; border: 1px solid #dee2e6; font-weight: 600;">${size.total_qty}</td>
                    <td style="padding: 8px 10px; border: 1px solid #dee2e6; font-size: 11px;">${formatRollPlan(size.roll_plan)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}
      </div>
      ` : ''}
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
