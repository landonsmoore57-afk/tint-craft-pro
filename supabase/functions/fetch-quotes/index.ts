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

    // Fetch all quotes
    const { data: quotes, error } = await supabaseAdmin
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching quotes:', error);
      throw error;
    }

    // Get all quote IDs that have job assignments
    const { data: assignedQuoteIds } = await supabaseAdmin
      .from('job_assignments')
      .select('quote_id');

    // Create a Set of assigned quote IDs for fast lookup
    const assignedIds = new Set(assignedQuoteIds?.map(a => a.quote_id) || []);

    // Transform to include is_scheduled flag
    const quotesWithScheduled = quotes?.map(quote => ({
      ...quote,
      is_scheduled: assignedIds.has(quote.id),
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