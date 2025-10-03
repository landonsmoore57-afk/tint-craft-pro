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
    console.log('=== Starting Jobber Push Quote ===');

    const body = await req.json();
    const { quoteId, userId } = body;

    if (!quoteId || !userId) {
      return json({ ok: false, error: 'Missing quoteId or userId' }, 400);
    }

    console.log('Quote ID:', quoteId, 'User ID:', userId);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Load quote data
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
      console.error('Quote not found:', quoteError);
      return json({ ok: false, error: 'Quote not found' }, 404);
    }

    console.log('Quote loaded:', quote.quote_number);

    // 2. Get Jobber tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('integration_jobber_tokens')
      .select('*')
      .eq('account_id', userId)
      .single();

    if (tokensError || !tokens) {
      console.error('Jobber not connected:', tokensError);
      return json({ ok: false, error: 'Jobber not connected. Please connect Jobber in Settings.' }, 400);
    }

    // 3. Check and refresh token if needed
    let accessToken = tokens.access_token;
    const expiresAt = new Date(tokens.expires_at);
    
    if (expiresAt <= new Date()) {
      console.log('Token expired, refreshing...');
      
      const refreshResponse = await fetch('https://api.getjobber.com/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id: Deno.env.get('JOBBER_CLIENT_ID'),
          client_secret: Deno.env.get('JOBBER_CLIENT_SECRET'),
        }),
      });

      if (!refreshResponse.ok) {
        console.error('Token refresh failed');
        return json({ ok: false, error: 'Jobber token expired. Please reconnect Jobber in Settings.' }, 400);
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;
      
      await supabase
        .from('integration_jobber_tokens')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        })
        .eq('account_id', userId);
      
      console.log('Token refreshed');
    }

    // 4. Set up Jobber API
    const JOBBER_API = 'https://api.getjobber.com/api/graphql';
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-JOBBER-GRAPHQL-VERSION': '2025-01-20',
    };

    // 5. First, let's introspect the quoteCreate mutation to see what it expects
    console.log('=== Introspecting quoteCreate mutation ===');
    const introspectionQuery = `
      query IntrospectQuoteCreate {
        __type(name: "Mutation") {
          fields {
            name
            args {
              name
              type {
                name
                kind
                ofType {
                  name
                  kind
                }
              }
            }
          }
        }
      }
    `;

    try {
      const introspectionResult = await jobberGraphQL(JOBBER_API, headers, introspectionQuery);
      const quoteCreateField = introspectionResult.__type?.fields?.find((f: any) => f.name === 'quoteCreate');
      console.log('quoteCreate mutation details:', JSON.stringify(quoteCreateField, null, 2));
    } catch (e: any) {
      console.error('Introspection failed:', e.message);
    }

    // 6. Create client in Jobber
    console.log('=== Creating Jobber Client ===');
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

    const clientResult = await jobberGraphQL(JOBBER_API, headers, clientMutation, {
      input: {
        companyName: quote.customer_name || 'Customer',
      }
    });

    if (clientResult.clientCreate.userErrors?.length) {
      const errors = clientResult.clientCreate.userErrors.map((e: any) => e.message).join('; ');
      console.error('Client creation failed:', errors);
      return json({ ok: false, error: `Failed to create client: ${errors}` }, 400);
    }

    const clientId = clientResult.clientCreate.client.id;
    console.log('Client created:', clientId);

    // 7. Calculate total from quote
    const grandTotal = calculateQuoteTotal(quote);
    console.log('Grand total:', grandTotal);

    // 8. Now introspect QuoteCreateAttributes to see what fields it accepts
    console.log('=== Introspecting QuoteCreateAttributes ===');
    const attributesIntrospection = `
      query IntrospectQuoteCreateAttributes {
        __type(name: "QuoteCreateAttributes") {
          name
          inputFields {
            name
            type {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
      }
    `;

    let attributesFields: any[] = [];
    try {
      const attributesResult = await jobberGraphQL(JOBBER_API, headers, attributesIntrospection);
      attributesFields = attributesResult.__type?.inputFields || [];
      console.log('QuoteCreateAttributes fields:', JSON.stringify(attributesFields, null, 2));
    } catch (e: any) {
      console.error('Attributes introspection failed:', e.message);
    }

    // 9. Create quote in Jobber using the correct attributes structure
    console.log('=== Creating Jobber Quote ===');
    
    const quoteMutation = `
      mutation CreateQuote($attributes: QuoteCreateAttributes!) {
        quoteCreate(attributes: $attributes) {
          quote {
            id
            quoteNumber
          }
          userErrors {
            message
            path
          }
        }
      }
    `;

    // Build attributes object based on what we discovered
    const attributes: any = {
      title: `Quote #${quote.quote_number} - ${quote.customer_name}`,
      clientId: clientId,
    };

    // Try adding line items if the field exists
    if (attributesFields.some((f: any) => f.name === 'lineItems')) {
      attributes.lineItems = [
        {
          name: 'Window Tinting Service',
          description: 'Complete window tinting installation',
          quantity: 1.0,
          unitPrice: grandTotal,
        }
      ];
    }

    const quoteVariables = { attributes };
    console.log('Quote variables:', JSON.stringify(quoteVariables, null, 2));

    const quoteResult = await jobberGraphQL(JOBBER_API, headers, quoteMutation, quoteVariables);

    if (quoteResult.quoteCreate?.userErrors?.length) {
      const errors = quoteResult.quoteCreate.userErrors.map((e: any) => e.message).join('; ');
      console.error('Quote creation failed:', errors);
      return json({ ok: false, error: `Failed to create quote: ${errors}` }, 400);
    }

    const jobberQuote = quoteResult.quoteCreate?.quote;
    if (!jobberQuote?.id) {
      console.error('No quote returned');
      return json({ ok: false, error: 'Failed to create quote in Jobber' }, 400);
    }

    console.log('=== SUCCESS ===');
    console.log('Jobber quote created:', jobberQuote.id, jobberQuote.quoteNumber);

    return json({ 
      ok: true, 
      jobberQuote,
      clientId,
      message: `Quote #${jobberQuote.quoteNumber} created in Jobber`
    });

  } catch (error: any) {
    console.error('=== ERROR ===');
    console.error(error);
    return json({ ok: false, error: error.message || 'Failed to push quote' }, 500);
  }
});

// Helper: Make GraphQL request to Jobber
async function jobberGraphQL(endpoint: string, headers: any, query: string, variables?: any) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });

  const result = await response.json();
  
  if (!response.ok) {
    console.error('GraphQL HTTP error:', response.status, result);
    throw new Error(`HTTP ${response.status}`);
  }
  
  if (result.errors) {
    console.error('GraphQL errors:', result.errors);
    throw new Error(result.errors.map((x: any) => x.message).join('; '));
  }

  return result.data;
}

// Helper: Calculate quote total
function calculateQuoteTotal(quote: any): number {
  // For now, return a simple placeholder
  // You can implement the full calculation logic later
  return 1000.00;
}

// Helper: JSON response
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
