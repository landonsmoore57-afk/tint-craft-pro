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
    console.log('Processing Jobber OAuth callback');

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
      return htmlError('Missing authorization code', `${url.origin}/settings?jobber=error`);
    }

    if (!state) {
      return htmlError('Missing state parameter', `${url.origin}/settings?jobber=error`);
    }

    // Extract user ID and return URL from state
    // Split by | to avoid issues with : in URLs
    const stateParts = state.split('|');
    const userId = stateParts[0];
    const returnUrl = stateParts[1];
    
    if (!userId || !returnUrl) {
      return htmlError('Invalid state parameter', `${url.origin}/settings?jobber=error`);
    }

    console.log('Exchanging code for tokens');

    // Exchange code for tokens
    const tokenRes = await fetch('https://api.getjobber.com/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${url.origin}/jobber-oauth-callback`,
        client_id: Deno.env.get('JOBBER_CLIENT_ID')!,
        client_secret: Deno.env.get('JOBBER_CLIENT_SECRET')!,
      }),
    });

    const tokens = await tokenRes.json();
    console.log('Token exchange response:', JSON.stringify(tokens, null, 2));

    if (!tokenRes.ok) {
      console.error('Token exchange failed:', tokens);
      return htmlError(
        tokens?.error_description || 'Token exchange failed',
        `${url.origin}/settings?jobber=error`
      );
    }

    console.log('Tokens received, saving to database');

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate expiration with validation
    let expiresAt: string;
    if (tokens.expires_in && typeof tokens.expires_in === 'number' && tokens.expires_in > 0) {
      expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    } else {
      console.warn('No valid expires_in in token response, using 1 hour default');
      expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    }

    // Upsert tokens into database
    const { error: dbError } = await supabase
      .from('integration_jobber_tokens')
      .upsert({
        account_id: userId,
        jobber_account_id: tokens.account_id ?? null,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'account_id'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return htmlError('Failed to save tokens', `${url.origin}/settings?jobber=error`);
    }

    console.log('Jobber connected successfully');

    // Redirect back to settings with success message using HTTP 302
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${returnUrl}/settings?jobber=connected`,
      },
    });
  } catch (error: any) {
    console.error('Error in jobber-oauth-callback:', error);
    // Try to get return URL from state if available
    const url = new URL(req.url);
    const state = url.searchParams.get('state');
    const returnUrl = state?.split('|')[1] || url.origin;
    return htmlError(error?.message || 'OAuth callback failed', `${returnUrl}/settings?jobber=error`);
  }
});

function htmlRedirect(url: string) {
  return new Response(
    `<!DOCTYPE html>
    <html>
      <head>
        <meta http-equiv="refresh" content="0;url=${url}">
        <title>Redirecting...</title>
      </head>
      <body>
        <p>Connecting to Jobber... <a href="${url}">Click here if not redirected</a></p>
      </body>
    </html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}

function htmlError(msg: string, backUrl: string) {
  return new Response(
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Jobber Connection Error</title>
        <style>
          body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
          h3 { color: #dc2626; }
          pre { background: #f3f4f6; padding: 10px; border-radius: 4px; }
          a { color: #0891b2; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h3>Jobber Connection Failed</h3>
        <pre>${msg}</pre>
        <p><a href="${backUrl}">Return to Settings</a></p>
      </body>
    </html>`,
    {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}
