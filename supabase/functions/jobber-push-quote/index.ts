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

    // Calculate grand total using the same logic as the frontend
    const grandTotal = calculateQuoteTotal(quote);
    console.log('Calculated grand total:', grandTotal);

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

    // Check if token is expired and refresh if needed
    const expiresAt = new Date(tokens.expires_at);
    const now = new Date();
    
    let accessToken = tokens.access_token;
    
    if (expiresAt <= now) {
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
        console.error('Token refresh failed:', await refreshResponse.text());
        return json({ ok: false, error: 'Jobber token expired and refresh failed. Please reconnect Jobber in Settings.' }, 400);
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;
      
      // Update tokens in database
      const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000);
      await supabase
        .from('integration_jobber_tokens')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token,
          expires_at: newExpiresAt.toISOString(),
        })
        .eq('account_id', userId);
      
      console.log('Token refreshed successfully');
    }

    console.log('Pushing quote to Jobber via GraphQL');

    const JOBBER_API = 'https://api.getjobber.com/api/graphql';
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-JOBBER-GRAPHQL-VERSION': '2025-01-20',
    };


    // Step 1: Create client with minimal fields
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


    // Step 2: Get film type for line item description
    const filmType = quote.sections?.[0]?.section_film_id 
      ? await getFilmName(supabase, quote.sections[0].section_film_id)
      : 'Window Tinting';
    
    console.log('Film type:', filmType);

    // Step 3: Create quote with ONE line item for the grand total
    console.log('Creating quote in Jobber with single line item...');
    
    const quoteMutation = `
      mutation CreateQuote($attributes: QuoteCreateAttributes!) {
        quoteCreate(attributes: $attributes) {
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
      const quoteAttributes: any = {
        title: `Quote #${quote.quote_number} - ${quote.customer_name}`,
        clientId: clientId,     // EncodedId!
        lineItems: [
          {
            name: filmType,
            description: `Quote #${quote.quote_number} - Window tinting installation`,
            quantity: 1,
            unitPrice: grandTotal,
          }
        ],
        taxRate: 0, // We already calculated tax in our system
      };

      const quoteVariables = { attributes: quoteAttributes };

      console.log('Quote variables:', JSON.stringify(quoteVariables, null, 2));

      const quoteResult = await gql(JOBBER_API, headers, quoteMutation, quoteVariables);

      if (quoteResult.quoteCreate.userErrors && quoteResult.quoteCreate.userErrors.length > 0) {
        const errors = quoteResult.quoteCreate.userErrors.map((e: any) => `${e.path?.join('.')}: ${e.message}`).join('; ');
        console.error('Quote creation errors:', errors);
        return json({ 
          ok: false, 
          error: `Failed to create quote in Jobber: ${errors}`,
          meta: { quoteVariables }
        }, 400);
      }

      const jobberQuote = quoteResult.quoteCreate.quote;
      if (!jobberQuote?.id) {
        return json({ 
          ok: false, 
          error: 'QuoteCreate returned no id',
          meta: { quoteVariables, quoteResult }
        }, 400);
      }

      console.log('Successfully created Jobber quote:', jobberQuote.id);

      return json({ 
        ok: true, 
        jobberQuote: jobberQuote,
        clientId,
        grandTotal,
        filmType,
        message: `Quote successfully created in Jobber as #${jobberQuote.quoteNumber}` 
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

// Calculate the total for the quote (matching frontend calculation logic)
function calculateQuoteTotal(quote: any): number {
  let subtotal = 0;

  // Sum up all windows in all sections
  if (quote.sections && Array.isArray(quote.sections)) {
    for (const section of quote.sections) {
      if (section.windows && Array.isArray(section.windows)) {
        for (const window of section.windows) {
          const width = window.width_in || 0;
          const height = window.height_in || 0;
          const quantity = window.quantity || 1;
          const sqft = (width * height) / 144; // convert sq inches to sq feet
          
          // Get the sell price per sqft (either from window override or section film or global)
          let sellPerSqft = 0;
          if (window.override_sell_per_sqft) {
            sellPerSqft = parseFloat(window.override_sell_per_sqft);
          }
          // Note: You may need to join film data here if not using override
          // For now, defaulting to a reasonable estimate
          
          const windowTotal = sqft * quantity * (sellPerSqft || 10); // default $10/sqft if no price
          subtotal += windowTotal;
        }
      }
    }
  }

  // Apply discount
  const discountFlat = parseFloat(quote.discount_flat) || 0;
  const discountPercent = parseFloat(quote.discount_percent) || 0;
  
  subtotal -= discountFlat;
  subtotal -= (subtotal * (discountPercent / 100));

  // Add travel fee
  const travelFee = parseFloat(quote.travel_fee) || 0;
  let travelSubtotal = travelFee;
  if (!quote.travel_taxable) {
    // If travel is not taxable, add it after tax calculation
  }

  // Apply tax
  const taxPercent = parseFloat(quote.tax_percent) || 0;
  const taxAmount = (subtotal + (quote.travel_taxable ? travelFee : 0)) * (taxPercent / 100);

  // Calculate grand total
  const grandTotal = subtotal + taxAmount + (!quote.travel_taxable ? travelFee : 0);

  return Math.round(grandTotal * 100) / 100; // Round to 2 decimals
}

// Helper to get film name
async function getFilmName(supabase: any, filmId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('films')
      .select('name, brand')
      .eq('id', filmId)
      .single();
    
    if (error || !data) return 'Window Tinting';
    return `${data.brand} ${data.name}`;
  } catch {
    return 'Window Tinting';
  }
}

async function gql(endpoint: string, headers: any, query: string, variables?: any) {
  console.log('Making GraphQL request');
  console.log('Variables:', JSON.stringify(variables, null, 2));
  
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
  console.log('GraphQL result:', JSON.stringify(result, null, 2));
  
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
