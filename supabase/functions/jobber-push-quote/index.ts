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
    console.log('Processing push-quote request');

    const { quoteId, userId } = await req.json();

    if (!quoteId) {
      return json({ ok: false, error: 'Missing quoteId' }, 400);
    }

    if (!userId) {
      return json({ ok: false, error: 'Missing userId' }, 400);
    }

    console.log('Loading quote data:', quoteId, 'for user:', userId);

    // Use service role key for all database operations (app uses custom PIN auth)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load quote with sections and windows
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select(`
        *,
        sections (
          *,
          windows (*)
        )
      `)
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
      console.error('Quote not found:', quoteError);
      return json({ ok: false, error: 'Quote not found' }, 404);
    }

    console.log('Loading Jobber tokens for user:', userId);

    const { data: tokens, error: tokensError } = await supabase
      .from('integration_jobber_tokens')
      .select('*')
      .eq('account_id', userId)
      .single();

    if (tokensError || !tokens) {
      console.error('Jobber not connected:', tokensError);
      return json({ ok: false, error: 'Jobber not connected. Please connect Jobber in Settings first.' }, 400);
    }

    // Check if token is expired
    const expiresAt = new Date(tokens.expires_at);
    const now = new Date();
    
    if (expiresAt <= now) {
      console.log('Token expired, refreshing...');
      // TODO: Implement token refresh
      return json({ ok: false, error: 'Jobber token expired. Please reconnect Jobber in Settings.' }, 400);
    }

    console.log('Pushing quote to Jobber via GraphQL');

    const JOBBER_API = 'https://api.getjobber.com/api/graphql';
    const headers = {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
      'X-JOBBER-GRAPHQL-VERSION': '2024-10-01',
    };

    // Step 1: Create or find client in Jobber
    const clientMutation = `
      mutation CreateClient($input: ClientCreateInput!) {
        clientCreate(input: $input) {
          client {
            id
          }
          userErrors {
            message
            path
          }
        }
      }
    `;

    const clientResult = await gql(JOBBER_API, headers, clientMutation, {
      input: {
        name: quote.customer_name,
        emails: quote.customer_email ? [{ address: quote.customer_email }] : [],
        phones: quote.customer_phone ? [{ number: quote.customer_phone }] : [],
      }
    });

    if (clientResult.clientCreate.userErrors.length > 0) {
      console.error('Failed to create client:', clientResult.clientCreate.userErrors);
      return json({ 
        ok: false, 
        error: `Jobber error: ${clientResult.clientCreate.userErrors[0].message}` 
      }, 400);
    }

    const clientId = clientResult.clientCreate.client.id;
    console.log('Created/found Jobber client:', clientId);

    // Step 2: Create property if site address exists
    let propertyId = null;
    if (quote.site_address) {
      const propertyMutation = `
        mutation CreateProperty($input: PropertyCreateInput!) {
          propertyCreate(input: $input) {
            property {
              id
            }
            userErrors {
              message
              path
            }
          }
        }
      `;

      const propertyResult = await gql(JOBBER_API, headers, propertyMutation, {
        input: {
          clientId,
          address: {
            street1: quote.site_address,
          }
        }
      });

      if (propertyResult.propertyCreate.userErrors.length === 0) {
        propertyId = propertyResult.propertyCreate.property.id;
        console.log('Created Jobber property:', propertyId);
      }
    }

    // Step 3: Create quote in Jobber
    const quoteMutation = `
      mutation CreateQuote($input: QuoteCreateInput!) {
        quoteCreate(input: $input) {
          quote {
            id
          }
          userErrors {
            message
            path
          }
        }
      }
    `;

    // Build line items from sections and windows
    const lineItems = [];
    for (const section of (quote.sections || [])) {
      for (const window of (section.windows || [])) {
        lineItems.push({
          name: `${section.name} - ${window.label}`,
          description: `${window.width_in}" x ${window.height_in}" (Qty: ${window.quantity})`,
          unitCost: window.override_sell_per_sqft || 0,
          quantity: window.quantity || 1,
        });
      }
    }

    const quoteInput: any = {
      clientId,
      title: `Quote #${quote.quote_number}`,
      lineItems,
    };

    if (propertyId) {
      quoteInput.propertyId = propertyId;
    }

    const quoteResult = await gql(JOBBER_API, headers, quoteMutation, {
      input: quoteInput
    });

    if (quoteResult.quoteCreate.userErrors.length > 0) {
      console.error('Failed to create quote:', quoteResult.quoteCreate.userErrors);
      return json({ 
        ok: false, 
        error: `Jobber error: ${quoteResult.quoteCreate.userErrors[0].message}` 
      }, 400);
    }

    const jobberQuoteId = quoteResult.quoteCreate.quote.id;
    console.log('Successfully created Jobber quote:', jobberQuoteId);

    return json({ 
      ok: true, 
      jobberQuoteId,
      message: 'Quote pushed to Jobber successfully' 
    });

  } catch (error: any) {
    console.error('Error in jobber-push-quote:', error);
    return json({ 
      ok: false, 
      error: error?.message || 'Failed to push quote to Jobber' 
    }, 500);
  }
});

async function gql(endpoint: string, headers: any, query: string, variables?: any) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });

  const result = await response.json();
  
  if (result.errors) {
    throw new Error(result.errors.map((x: any) => x.message).join('; '));
  }

  return result.data;
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
