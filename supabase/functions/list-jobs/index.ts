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
  area_sqft_each: number;
  total_qty: number;
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
        if (!best || plan.waste_in < best.waste_in || (plan.waste_in === best.waste_in && plan.base_roll_in < best.base_roll_in) || (plan.waste_in === best.waste_in && plan.base_roll_in === best.base_roll_in && plan.slit_width_in === plan.base_roll_in) || (plan.waste_in === best.waste_in && plan.base_roll_in === best.base_roll_in && plan.slit_width_in === best.slit_width_in && plan.orientation === 'width-across')) {
          best = plan;
        }
        break;
      }
    }
  }
  return best ?? { error: 'Oversize — no roll fits' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });

    const url = new URL(req.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    if (!from || !to) {
      return new Response(JSON.stringify({ error: 'from and to date parameters required (YYYY-MM-DD)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: assignments, error: assignError } = await supabaseClient.from('job_assignments').select('id, quote_id, job_date').gte('job_date', from).lte('job_date', to).order('job_date', { ascending: true });
    if (assignError) throw assignError;
    if (!assignments || assignments.length === 0) {
      return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const quoteIds = [...new Set(assignments.map(a => a.quote_id))];
    const { data: quotes, error: quotesError } = await supabaseClient.from('quotes').select(`id, quote_no, customer_name, customer_email, customer_phone, site_address, status, global_film_id, sections (id, name, room_id, custom_room_name, section_film_id, windows (id, width_in, height_in, quantity, window_film_id))`).in('id', quoteIds);
    if (quotesError) throw quotesError;

    // Fetch all films for resolving
    const { data: films, error: filmsError } = await supabaseClient.from('films').select('id, brand, series, name, vlt');
    if (filmsError) throw filmsError;
    const filmsMap = new Map(films?.map(f => [f.id, f]) || []);

    const { data: rooms, error: roomsError } = await supabaseClient.from('rooms').select('id, name');
    if (roomsError) throw roomsError;
    const roomsMap = new Map(rooms?.map(r => [r.id, r.name]) || []);

    const rollConfig = DEFAULT_ROLL_CONFIG;
    const quotesWithCalc = quotes?.map(quote => {
      // Helper to resolve film (window > section > global)
      const resolveFilm = (win: any, section: any) => {
        const filmId = win.window_film_id || section.section_film_id || quote.global_film_id;
        return filmId ? filmsMap.get(filmId) : null;
      };

      const sizeMap = new Map<string, { w: number; h: number; qty: number; film_id: string | null; film_display: string }>();
      const roomsMapCalc = new Map<string, Map<string, { w: number; h: number; qty: number }>>();
      const roomTotals = new Map<string, number>();

      for (const section of (quote.sections || [])) {
        const roomLabel = section.custom_room_name || (section.room_id ? roomsMap.get(section.room_id) : null) || section.name || 'Unassigned';
        if (!roomsMapCalc.has(roomLabel)) roomsMapCalc.set(roomLabel, new Map());
        const roomSizeMap = roomsMapCalc.get(roomLabel)!;

        for (const win of (section.windows || [])) {
          const qty = Math.max(1, win.quantity || 1);
          
          // Resolve film for this window
          const film = resolveFilm(win, section);
          const film_id = film?.id ?? null;
          const film_display = film 
            ? `${film.brand} ${film.series} ${film.name}${film.vlt != null ? ` ${film.vlt}%` : ''}`
            : 'No Film';
          
          const key = `${win.width_in}x${win.height_in}|${film_id ?? 'none'}`;
          const item = sizeMap.get(key) ?? { w: win.width_in, h: win.height_in, qty: 0, film_id, film_display };
          item.qty += qty;
          sizeMap.set(key, item);
          
          const roomKey = `${win.width_in}x${win.height_in}`;
          const roomItem = roomSizeMap.get(roomKey) ?? { w: win.width_in, h: win.height_in, qty: 0 };
          roomItem.qty += qty;
          roomSizeMap.set(roomKey, roomItem);
          roomTotals.set(roomLabel, (roomTotals.get(roomLabel) ?? 0) + qty);
        }
      }

      const window_summary: WindowSizeRollup[] = [...sizeMap.values()].map(i => ({ 
        width_in: i.w, 
        height_in: i.h, 
        area_sqft_each: +((i.w * i.h) / 144).toFixed(2), 
        total_qty: i.qty,
        film_id: i.film_id,
        film_display: i.film_display,
        roll_plan: pickRollForSize(i.w, i.h, rollConfig) 
      })).sort((a, b) => 
        a.film_display.localeCompare(b.film_display) || 
        b.area_sqft_each - a.area_sqft_each || 
        (a.width_in * a.height_in) - (b.width_in * b.height_in)
      );

      const rooms_summary: RoomSizeRollup[] = [...roomsMapCalc.entries()].map(([room, sizeMap]) => {
        const sizes = [...sizeMap.values()].map(i => ({ width_in: i.w, height_in: i.h, area_sqft_each: +((i.w * i.h) / 144).toFixed(2), total_qty: i.qty, roll_plan: pickRollForSize(i.w, i.h, rollConfig) })).sort((a, b) => b.area_sqft_each - a.area_sqft_each || (a.width_in * a.height_in) - (b.width_in * b.height_in));
        return { room_label: room, total_windows_qty: roomTotals.get(room) ?? 0, sizes };
      }).sort((a, b) => { if (a.room_label === 'Unassigned') return 1; if (b.room_label === 'Unassigned') return -1; return a.room_label.localeCompare(b.room_label, undefined, { numeric: true }); });

      return { quote_id: quote.id, quote_no: quote.quote_no, customer_name: quote.customer_name, site_address: quote.site_address, status: quote.status, window_summary, rooms_summary };
    }) || [];

    const dateGroups = new Map<string, any[]>();
    for (const assignment of assignments) {
      if (!dateGroups.has(assignment.job_date)) dateGroups.set(assignment.job_date, []);
      const quoteData = quotesWithCalc.find(q => q.quote_id === assignment.quote_id);
      if (quoteData) dateGroups.get(assignment.job_date)!.push({ assignment_id: assignment.id, ...quoteData });
    }

    const result = [...dateGroups.entries()].map(([date, items]) => ({ job_date: date, items }));
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error in list-jobs:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
