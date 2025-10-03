import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Jobber OAuth flow');

    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');
    const returnUrl = url.searchParams.get('return_url');

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!returnUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing return_url parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate state parameter to verify callback (includes return URL)
    const state = `${userId}:${returnUrl}:${crypto.randomUUID()}`;

    const AUTH_URL = 'https://api.getjobber.com/api/oauth/authorize';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const params = new URLSearchParams({
      client_id: Deno.env.get('JOBBER_CLIENT_ID')!,
      redirect_uri: `${supabaseUrl}/functions/v1/jobber-oauth-callback`,
      response_type: 'code',
      scope: [
        'clients:read', 'clients:write',
        'properties:read', 'properties:write',
        'quotes:read', 'quotes:write',
      ].join(' '),
      state,
    });

    const redirectUrl = `${AUTH_URL}?${params.toString()}`;
    console.log('Redirecting to Jobber authorization:', redirectUrl);

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl,
      },
    });
  } catch (error: any) {
    console.error('Error in jobber-oauth-start:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to start OAuth flow' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
