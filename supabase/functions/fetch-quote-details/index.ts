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
    const { quoteId } = await req.json();

    if (!quoteId) {
      return new Response(
        JSON.stringify({ error: 'Quote ID is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Create admin client with service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch quote
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .maybeSingle();

    if (quoteError) {
      console.error('Error fetching quote:', quoteError);
      throw quoteError;
    }

    if (!quote) {
      return new Response(
        JSON.stringify({ error: 'Quote not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      );
    }

    // Fetch sections
    const { data: sections, error: sectionsError } = await supabaseAdmin
      .from('sections')
      .select('*')
      .eq('quote_id', quoteId)
      .order('position', { ascending: true });

    if (sectionsError) {
      console.error('Error fetching sections:', sectionsError);
      throw sectionsError;
    }

    // Fetch windows if there are sections
    let windows: any[] = [];
    if (sections && sections.length > 0) {
      const sectionIds = sections.map(s => s.id);
      const { data: windowsData, error: windowsError } = await supabaseAdmin
        .from('windows')
        .select('*')
        .in('section_id', sectionIds)
        .order('position', { ascending: true });

      if (windowsError) {
        console.error('Error fetching windows:', windowsError);
        throw windowsError;
      }

      windows = windowsData || [];
    }

    return new Response(
      JSON.stringify({
        quote,
        sections: sections || [],
        windows
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error('Error in fetch-quote-details function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
