import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory cache with 5-minute TTL
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    const cacheKey = `suggest:${limit}`;
    const cached = cache.get(cacheKey);
    
    // Return cached data if valid
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Returning cached room suggestions');
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Get featured rooms first
    const { data: featuredRooms, error: featuredError } = await supabase
      .from('rooms')
      .select('id, name, is_common')
      .eq('is_featured', true)
      .order('name', { ascending: true });

    if (featuredError) {
      console.error('Error fetching featured rooms:', featuredError);
      throw featuredError;
    }

    const remainingSlots = limit - (featuredRooms?.length || 0);
    let topUsageRooms: any[] = [];
    
    // Fill remaining slots with usage-ranked rooms (excluding featured ones)
    if (remainingSlots > 0) {
      const featuredIds = (featuredRooms || []).map(r => r.id);
      
      const { data: usageRooms, error: usageError } = await supabase
        .from('room_usage_ranking')
        .select('id, name, is_common')
        .not('id', 'in', `(${featuredIds.join(',') || 'null'})`)
        .order('is_common', { ascending: false })
        .order('usage_score', { ascending: false })
        .order('name', { ascending: true })
        .limit(remainingSlots);
      
      if (usageError) {
        console.error('Error fetching usage rooms:', usageError);
        throw usageError;
      }
      topUsageRooms = usageRooms || [];
    }

    // Combine featured and usage-based rooms
    const data = [...(featuredRooms || []), ...topUsageRooms];
    const error = null;

    // Cache the result
    cache.set(cacheKey, { data, timestamp: Date.now() });
    
    // Clean old cache entries
    for (const [key, value] of cache.entries()) {
      if (Date.now() - value.timestamp > CACHE_TTL) {
        cache.delete(key);
      }
    }

    console.log(`Returning ${data?.length || 0} room suggestions`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in rooms-suggest:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
