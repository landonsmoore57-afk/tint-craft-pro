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

    const body = await req.json();
    console.log('Request body:', JSON.stringify(body));
    
    const { quoteId, userId } = body;

    if (!quoteId) {
      console.error('Missing quoteId in request');
      return json({ ok: false, error: 'Missing quoteId' }, 400);
    }

    if (!userId) {
      console.error('Missing userId in request');
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
      'X-JOBBER-GRAPHQL-VERSION': '2025-01-20',
    };

    console.log('Testing API connection with a simple query first...');
    
    // First, let's try a simple query to verify the connection and see the schema
    const testQuery = `
      query {
        account {
          id
          name
        }
      }
    `;
    
    try {
      const testResult = await gql(JOBBER_API, headers, testQuery);
      console.log('API connection successful:', JSON.stringify(testResult));
    } catch (error: any) {
      console.error('API connection test failed:', error.message);
      return json({ 
        ok: false, 
        error: `Jobber API connection failed: ${error.message}. Please check your Jobber connection in Settings.` 
      }, 400);
    }

    // Step 1: Try to create client with minimal fields
    console.log('Attempting to create/find client...');
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

    let clientId = null;
    
    try {
      const clientResult = await gql(JOBBER_API, headers, clientMutation, {
        input: {
          companyName: quote.customer_name,
        }
      });

      if (clientResult.clientCreate.userErrors && clientResult.clientCreate.userErrors.length > 0) {
        const errors = clientResult.clientCreate.userErrors.map((e: any) => `${e.path?.join('.')}: ${e.message}`).join('; ');
        console.error('Client creation errors:', errors);
        return json({ 
          ok: false, 
          error: `Failed to create client in Jobber: ${errors}` 
        }, 400);
      }

      clientId = clientResult.clientCreate.client.id;
      console.log('Created Jobber client:', clientId);
    } catch (error: any) {
      console.error('Client creation failed:', error.message);
      return json({ 
        ok: false, 
        error: `Failed to create client: ${error.message}` 
      }, 400);
    }

    // Step 2: Always create property (required for quotes in Jobber)
    console.log('Creating property for quote...');
    
    // Helper to parse address into separate fields
    const parseAddress = (raw: string | null) => {
      if (!raw) {
        return { 
          street1: 'Service Location', 
          street2: null, 
          city: '', 
          province: '', 
          postalCode: '', 
          country: 'US' 
        };
      }
      
      // Try to parse: "1411 Cypress Dr Pacific, MO 63069"
      const match = raw.match(/^(.+?)\s+([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
      if (!match) {
        return { 
          street1: raw, 
          street2: null, 
          city: '', 
          province: '', 
          postalCode: '', 
          country: 'US' 
        };
      }
      
      const [, street1, city, province, postalCode] = match;
      return { street1, street2: null, city, province, postalCode, country: 'US' };
    };
    
    const propertyMutation = `
      mutation CreateProperty($clientId: EncodedId!, $input: PropertyCreateInput!) {
        propertyCreate(clientId: $clientId, input: $input) {
          properties {
            id
          }
          userErrors {
            message
            path
          }
        }
      }
    `;

    let propertyId = null;
    try {
      const address = parseAddress(quote.site_address);
      const propertyVariables = {
        clientId: clientId,
        input: {
          name: 'Service Location',
          address: address
        }
      };
      
      console.log('Property variables:', JSON.stringify(propertyVariables, null, 2));
      
      const propertyResult = await gql(JOBBER_API, headers, propertyMutation, propertyVariables);

      const errs = propertyResult?.propertyCreate?.userErrors ?? [];
      if (errs.length > 0) {
        const errors = errs.map((e: any) => `${(e.path || []).join('.')}: ${e.message}`).join('; ');
        console.error('Property creation errors:', errors);
        console.error('Property result:', JSON.stringify(propertyResult, null, 2));
        return json({ 
          ok: false, 
          error: `Failed to create property in Jobber: ${errors}` 
        }, 400);
      }

      const propsArr = propertyResult?.propertyCreate?.properties ?? [];
      if (propsArr.length > 0) {
        propertyId = propsArr[0].id;
        console.log('Created Jobber property:', propertyId);
      } else {
        return json({ 
          ok: false, 
          error: 'Failed to create property (required for quotes)' 
        }, 400);
      }
    } catch (error: any) {
      console.error('Property creation failed:', error.message);
      return json({ 
        ok: false, 
        error: `Failed to create property: ${error.message}` 
      }, 400);
    }

    // Step 3: Create quote in Jobber
    console.log('Creating quote in Jobber...');
    
    const quoteMutation = `
      mutation CreateQuote($input: QuoteCreateInput!) {
        quoteCreate(input: $input) {
          quote {
            id
            quoteNumber
            quoteStatus
          }
          userErrors {
            message
            path
          }
        }
      }
    `;

    try {
      const quoteResult = await gql(JOBBER_API, headers, quoteMutation, {
        input: {
          title: `Quote #${quote.quote_number} - ${quote.customer_name}`,
          clientId: clientId,
          propertyId: propertyId,
        }
      });

      if (quoteResult.quoteCreate.userErrors && quoteResult.quoteCreate.userErrors.length > 0) {
        const errors = quoteResult.quoteCreate.userErrors.map((e: any) => `${e.path?.join('.')}: ${e.message}`).join('; ');
        console.error('Quote creation errors:', errors);
        return json({ 
          ok: false, 
          error: `Failed to create quote in Jobber: ${errors}` 
        }, 400);
      }

      const jobberQuoteId = quoteResult.quoteCreate.quote.id;
      console.log('Successfully created Jobber quote:', jobberQuoteId);

      return json({ 
        ok: true, 
        jobberQuoteId,
        clientId,
        propertyId,
        message: 'Quote pushed to Jobber successfully. You can now add line items manually in Jobber.' 
      });
    } catch (error: any) {
      console.error('Quote creation failed:', error.message);
      return json({ 
        ok: false, 
        error: `Failed to create quote: ${error.message}` 
      }, 400);
    }

  } catch (error: any) {
    console.error('Error in jobber-push-quote:', error);
    return json({ 
      ok: false, 
      error: error?.message || 'Failed to push quote to Jobber' 
    }, 500);
  }
});

async function gql(endpoint: string, headers: any, query: string, variables?: any) {
  console.log('Making GraphQL request to:', endpoint);
  console.log('Variables:', JSON.stringify(variables));
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables })
  });

  console.log('Response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('GraphQL request failed:', errorText);
    throw new Error(`GraphQL request failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  console.log('GraphQL result:', JSON.stringify(result));
  
  if (result.errors) {
    console.error('GraphQL errors:', result.errors);
    throw new Error(result.errors.map((x: any) => x.message).join('; '));
  }

  if (!result.data) {
    console.error('No data in GraphQL response:', result);
    throw new Error('No data returned from GraphQL API');
  }

  return result.data;
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
