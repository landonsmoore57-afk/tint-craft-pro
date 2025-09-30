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
  roll_widths_in: number[];
  allow_equal_splits: boolean;
  trim_allowance_in: number;
  allow_rotation: boolean;
}

const DEFAULT_ROLL_CONFIG: RollConfig = {
  roll_widths_in: [48, 60, 72],
  allow_equal_splits: true,
  trim_allowance_in: 0.5,
  allow_rotation: true,
};

function buildSlitCatalog(rolls: number[] = [48, 60, 72]): [number, number][] {
  const map = new Map<number, number>();
  for (const base of [...rolls].sort((a, b) => a - b)) {
    for (let n = 1; n <= 6; n++) {
      if (base % n === 0) {
        const slit = base / n;
        const curr = map.get(slit);
        if (!curr || base < curr) map.set(slit, base);
      }
    }
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

function pickRollForSize(W: number, H: number, cfg: RollConfig = DEFAULT_ROLL_CONFIG): RollPlan | { error: string } {
  const trim = cfg.trim_allowance_in ?? 0;
  const candidates = buildSlitCatalog(cfg.roll_widths_in ?? [48, 60, 72]);
  const dims = [
    { need: W + 2 * trim, orient: 'width-across' as const },
    ...(cfg.allow_rotation ? [{ need: H + 2 * trim, orient: 'height-across' as const }] : []),
  ];
  
  let best: RollPlan | null = null;
  
  for (const d of dims) {
    for (const [slit, base] of candidates) {
      if (slit + 1e-6 >= d.need) {
        const waste = +(slit - d.need).toFixed(2);
        const plan: RollPlan = {
          slit_width_in: slit,
          base_roll_in: base as 48 | 60 | 72,
          orientation: d.orient,
          waste_in: waste,
        };
        if (slit !== base) plan.note = `${base}" roll → ${slit}" slit`;
        if (!best || plan.waste_in < best.waste_in || (plan.waste_in === best.waste_in && plan.base_roll_in < best.base_roll_in) || (plan.waste_in === best.waste_in && plan.base_roll_in === best.base_roll_in && plan.orientation === 'width-across')) {
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
    const { data: quotes, error: quotesError } = await supabaseClient.from('quotes').select(`id, quote_no, customer_name, customer_email, customer_phone, site_address, status, global_film_id, sections (id, name, room_id, custom_room_name, windows (id, width_in, height_in, quantity))`).in('id', quoteIds);
    if (quotesError) throw quotesError;

    const { data: rooms, error: roomsError } = await supabaseClient.from('rooms').select('id, name');
    if (roomsError) throw roomsError;
    const roomsMap = new Map(rooms?.map(r => [r.id, r.name]) || []);

    const rollConfig = DEFAULT_ROLL_CONFIG;
    const quotesWithCalc = quotes?.map(quote => {
      const sizeMap = new Map<string, { w: number; h: number; qty: number }>();
      const roomsMapCalc = new Map<string, Map<string, { w: number; h: number; qty: number }>>();
      const roomTotals = new Map<string, number>();

      for (const section of (quote.sections || [])) {
        const roomLabel = section.custom_room_name || (section.room_id ? roomsMap.get(section.room_id) : null) || section.name || 'Unassigned';
        if (!roomsMapCalc.has(roomLabel)) roomsMapCalc.set(roomLabel, new Map());
        const roomSizeMap = roomsMapCalc.get(roomLabel)!;

        for (const win of (section.windows || [])) {
          const qty = Math.max(1, win.quantity || 1);
          const key = `${win.width_in}x${win.height_in}`;
          const item = sizeMap.get(key) ?? { w: win.width_in, h: win.height_in, qty: 0 };
          item.qty += qty;
          sizeMap.set(key, item);
          const roomItem = roomSizeMap.get(key) ?? { w: win.width_in, h: win.height_in, qty: 0 };
          roomItem.qty += qty;
          roomSizeMap.set(key, roomItem);
          roomTotals.set(roomLabel, (roomTotals.get(roomLabel) ?? 0) + qty);
        }
      }

      const window_summary: WindowSizeRollup[] = [...sizeMap.values()].map(i => ({ width_in: i.w, height_in: i.h, area_sqft_each: +((i.w * i.h) / 144).toFixed(2), total_qty: i.qty, roll_plan: pickRollForSize(i.w, i.h, rollConfig) })).sort((a, b) => b.area_sqft_each - a.area_sqft_each || (a.width_in * a.height_in) - (b.width_in * b.height_in));

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
