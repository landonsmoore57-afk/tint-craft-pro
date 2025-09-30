import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WindowSizeRollup {
  width_in: number;
  height_in: number;
  area_sqft_each: number;
  total_qty: number;
}

interface RoomSize {
  width_in: number;
  height_in: number;
  area_sqft_each: number;
  total_qty: number;
}

interface RoomSizeRollup {
  room_label: string;
  total_windows_qty: number;
  sizes: RoomSize[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get query params
    const url = new URL(req.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    if (!from || !to) {
      return new Response(
        JSON.stringify({ error: 'from and to date parameters required (YYYY-MM-DD)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching jobs from ${from} to ${to}`);

    // Fetch job assignments in date range
    const { data: assignments, error: assignError } = await supabaseClient
      .from('job_assignments')
      .select('id, quote_id, job_date')
      .gte('job_date', from)
      .lte('job_date', to)
      .order('job_date', { ascending: true });

    if (assignError) throw assignError;

    if (!assignments || assignments.length === 0) {
      return new Response(
        JSON.stringify([]),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${assignments.length} job assignments`);

    // Get unique quote IDs
    const quoteIds = [...new Set(assignments.map(a => a.quote_id))];

    // Fetch all quotes with sections and windows
    const { data: quotes, error: quotesError } = await supabaseClient
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
          windows (
            id,
            width_in,
            height_in,
            quantity
          )
        )
      `)
      .in('id', quoteIds);

    if (quotesError) throw quotesError;

    // Fetch rooms for room name resolution
    const { data: rooms, error: roomsError } = await supabaseClient
      .from('rooms')
      .select('id, name');

    if (roomsError) throw roomsError;

    const roomsMap = new Map(rooms?.map(r => [r.id, r.name]) || []);

    // Calculate summaries for each quote
    const quotesWithCalc = quotes?.map(quote => {
      // Calculate window_size_rollup
      const sizeMap = new Map<string, { w: number; h: number; qty: number }>();
      
      // Calculate rooms_summary
      const roomsMapCalc = new Map<string, Map<string, { w: number; h: number; qty: number }>>();
      const roomTotals = new Map<string, number>();

      for (const section of (quote.sections || [])) {
        // Resolve room label
        const roomLabel = section.custom_room_name || 
                          (section.room_id ? roomsMap.get(section.room_id) : null) || 
                          section.name || 
                          'Unassigned';

        if (!roomsMapCalc.has(roomLabel)) {
          roomsMapCalc.set(roomLabel, new Map());
        }
        const roomSizeMap = roomsMapCalc.get(roomLabel)!;

        for (const win of (section.windows || [])) {
          const qty = Math.max(1, win.quantity || 1);
          const key = `${win.width_in}x${win.height_in}`;

          // Global rollup
          const item = sizeMap.get(key) ?? { w: win.width_in, h: win.height_in, qty: 0 };
          item.qty += qty;
          sizeMap.set(key, item);

          // Room rollup
          const roomItem = roomSizeMap.get(key) ?? { w: win.width_in, h: win.height_in, qty: 0 };
          roomItem.qty += qty;
          roomSizeMap.set(key, roomItem);

          roomTotals.set(roomLabel, (roomTotals.get(roomLabel) ?? 0) + qty);
        }
      }

      // Format window_summary
      const window_summary: WindowSizeRollup[] = [...sizeMap.values()]
        .map(i => ({
          width_in: i.w,
          height_in: i.h,
          area_sqft_each: +((i.w * i.h) / 144).toFixed(2),
          total_qty: i.qty,
        }))
        .sort((a, b) => 
          b.area_sqft_each - a.area_sqft_each ||
          (a.width_in * a.height_in) - (b.width_in * b.height_in)
        );

      // Format rooms_summary
      const rooms_summary: RoomSizeRollup[] = [...roomsMapCalc.entries()]
        .map(([room, sizeMap]) => {
          const sizes = [...sizeMap.values()]
            .map(i => ({
              width_in: i.w,
              height_in: i.h,
              area_sqft_each: +((i.w * i.h) / 144).toFixed(2),
              total_qty: i.qty,
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
        quote_id: quote.id,
        quote_no: quote.quote_no,
        customer_name: quote.customer_name,
        site_address: quote.site_address,
        status: quote.status,
        window_summary,
        rooms_summary,
      };
    }) || [];

    // Group by date
    const dateGroups = new Map<string, any[]>();
    for (const assignment of assignments) {
      const dateKey = assignment.job_date;
      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, []);
      }
      
      const quoteData = quotesWithCalc.find(q => q.quote_id === assignment.quote_id);
      if (quoteData) {
        dateGroups.get(dateKey)!.push({
          assignment_id: assignment.id,
          ...quoteData,
        });
      }
    }

    // Format response
    const result = [...dateGroups.entries()].map(([date, items]) => ({
      job_date: date,
      items,
    }));

    console.log(`Returning ${result.length} date groups`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in list-jobs:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
