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
    // Create admin client with service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all quotes with job assignment status
    const { data: quotes, error } = await supabaseAdmin
      .from('quotes')
      .select(`
        *,
        job_assignments (id)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching quotes:', error);
      throw error;
    }

    // Transform to include is_scheduled flag
    const quotesWithScheduled = quotes?.map(quote => ({
      ...quote,
      is_scheduled: Array.isArray(quote.job_assignments) && quote.job_assignments.length > 0,
      job_assignments: undefined // Remove the raw join data
    })) || [];

    return new Response(
      JSON.stringify(quotesWithScheduled),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error('Error in fetch-quotes function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});