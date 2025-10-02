import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const includeInactive = url.searchParams.get('include_inactive') === 'true';

    if (!query) {
      return new Response(JSON.stringify([]), {
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

    const searchPattern = `*${query}*`;
    const lowerQuery = query.toLowerCase().trim();
    
    // Check if query is numeric (for VLT search)
    const numericQuery = parseFloat(query);
    const isNumeric = !isNaN(numericQuery);
    
    // Check if searching for security films
    const isSecuritySearch = lowerQuery.includes('security');
    
    let queryBuilder = supabase
      .from('films')
      .select('id, brand, series, name, vlt, sku, active, cost_per_sqft, sell_per_sqft, security_film, notes');
    
    // Build comprehensive search conditions
    const searchConditions = [
      `brand.ilike.${searchPattern}`,
      `series.ilike.${searchPattern}`,
      `name.ilike.${searchPattern}`,
      `sku.ilike.${searchPattern}`,
      `notes.ilike.${searchPattern}`
    ];
    
    // Add VLT search if numeric
    if (isNumeric) {
      searchConditions.push(`vlt.eq.${Math.round(numericQuery)}`);
    }
    
    queryBuilder = queryBuilder.or(searchConditions.join(','));
    
    // Filter by security_film if searching for "security"
    if (isSecuritySearch) {
      queryBuilder = queryBuilder.eq('security_film', true);
    }
    
    if (!includeInactive) {
      queryBuilder = queryBuilder.eq('active', true);
    }
    
    queryBuilder = queryBuilder
      .order('brand', { ascending: true })
      .order('series', { ascending: true })
      .order('name', { ascending: true })
      .limit(limit);

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Error searching films:', error);
      throw error;
    }

    console.log(`Found ${data?.length || 0} films matching "${query}"`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in films-search:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
