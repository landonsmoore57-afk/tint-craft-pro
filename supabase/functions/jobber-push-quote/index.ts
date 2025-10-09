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

    // 1. Load quote data with all necessary relationships
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

    console.log('Quote loaded:', quote.quote_number);

    // 2. Load films and materials for calculation
    const { data: films } = await supabase.from('films').select('*');
    const { data: materials } = await supabase.from('materials').select('*').eq('active', true);
    
    const filmsMap = new Map(films?.map((f: any) => [f.id, f]) || []);
    const gasket = materials?.find((m: any) => m.key === 'gasket');
    const caulk = materials?.find((m: any) => m.key === 'caulk');

    // 3. Get Jobber tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('integration_jobber_tokens')
      .select('*')
      .eq('account_id', userId)
      .single();

    if (tokensError || !tokens) {
      console.error('Jobber not connected:', tokensError);
      return json({ ok: false, error: 'Jobber not connected. Please connect Jobber in Settings.' }, 400);
    }

    // 4. Check and refresh token if needed
    let accessToken = tokens.access_token;
    const expiresAt = new Date(tokens.expires_at);
    
    if (expiresAt <= new Date()) {
      console.log('Token expired, refreshing...');
      
      const refreshResponse = await fetch('https://api.getjobber.com/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          client_id: Deno.env.get('JOBBER_CLIENT_ID')!,
          client_secret: Deno.env.get('JOBBER_CLIENT_SECRET')!,
        }),
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        console.error('Token refresh failed:', refreshResponse.status, errorText);
        return json({ ok: false, error: 'Jobber token expired. Please reconnect Jobber in Settings.' }, 400);
      }

      const refreshData = await refreshResponse.json();
      console.log('Token refresh response:', JSON.stringify(refreshData, null, 2));
      
      accessToken = refreshData.access_token;
      
      // Calculate new expiration time
      // Jobber's expires_in is in seconds, but validate it first
      let newExpiresAt: string;
      if (refreshData.expires_in && typeof refreshData.expires_in === 'number' && refreshData.expires_in > 0) {
        // Use provided expiration time
        newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();
      } else {
        // Fallback: assume 1 hour expiration
        console.warn('No valid expires_in in refresh response, using 1 hour default');
        newExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
      }
      
      // Update tokens in database
      const { error: updateError } = await supabase
        .from('integration_jobber_tokens')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token || tokens.refresh_token,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('account_id', userId);
      
      if (updateError) {
        console.error('Failed to update tokens:', updateError);
        // Don't fail the request, just log the error
      }
      
      console.log('Token refreshed successfully, new expiration:', newExpiresAt);
    }

    // 5. Set up Jobber API
    const JOBBER_API = 'https://api.getjobber.com/api/graphql';
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-JOBBER-GRAPHQL-VERSION': '2023-11-15',
    };

    // 6. Calculate quote total
    const grandTotal = calculateQuoteTotal(quote, filmsMap, gasket, caulk);
    console.log('Calculated grand total:', grandTotal);

    // 7. Create or find client in Jobber
    console.log('=== Creating/Finding Jobber Client ===');
    
    let clientId = null;
    let propertyId = null;

    // Try to search for existing client (simplified - just create new if this fails)
    try {
      const searchQuery = `
        query SearchClients($searchTerm: String!) {
          clients(first: 5, searchTerm: $searchTerm) {
            edges {
              node {
                id
                companyName
              }
            }
          }
        }
      `;

      const searchResult = await jobberGraphQL(JOBBER_API, headers, searchQuery, {
        searchTerm: quote.customer_name
      });

      const edges = searchResult?.clients?.edges || [];
      
      if (edges.length > 0) {
        clientId = edges[0].node.id;
        console.log('Found existing client:', clientId);
      }
    } catch (e: any) {
      console.log('Client search failed or not supported:', e.message);
      // Not a critical error - we'll just create a new client
    }

    // Create new client if not found
    if (!clientId) {
      console.log('Creating new client...');
      
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

      const clientInput: any = {
        companyName: quote.customer_name || 'Customer',
      };

      // Add optional fields if available
      if (quote.customer_email) {
        clientInput.emails = [{ 
          address: quote.customer_email, 
          description: "PRIMARY"
        }];
      }
      if (quote.customer_phone) {
        clientInput.phones = [{ 
          number: quote.customer_phone, 
          description: "MOBILE"
        }];
      }

      const clientResult = await jobberGraphQL(JOBBER_API, headers, clientMutation, {
        input: clientInput
      });

      if (clientResult.clientCreate.userErrors?.length) {
        const errors = clientResult.clientCreate.userErrors.map((e: any) => e.message).join('; ');
        console.error('Client creation failed:', errors);
        return json({ ok: false, error: `Failed to create client: ${errors}` }, 400);
      }

      clientId = clientResult.clientCreate.client.id;
      console.log('Client created:', clientId);
    }

    // 8. Get or create property
    console.log('=== Getting/Creating Property ===');
    
    // First, query for existing properties
    const propertiesQuery = `
      query GetClientProperties($clientId: EncodedId!) {
        client(id: $clientId) {
          properties {
            id
          }
        }
      }
    `;

    let propertiesResult = await jobberGraphQL(JOBBER_API, headers, propertiesQuery, { 
      clientId 
    });

    console.log('Initial properties check:', JSON.stringify(propertiesResult, null, 2));

    let properties = propertiesResult?.client?.properties || [];
    
    // If no properties exist, create one
    if (properties.length === 0) {
      console.log('No properties found, creating new property...');
      
      const propertyMutation = `
        mutation CreateProperty($clientId: EncodedId!, $input: PropertyCreateInput!) {
          propertyCreate(clientId: $clientId, input: $input) {
            userErrors {
              message
              path
            }
          }
        }
      `;

      const propertyInput: any = {
        // Add a name for the property - this may be required
        propertyName: quote.site_address || 'Primary Location'
      };
      
      // Add address if available
      if (quote.site_address) {
        propertyInput.address = {
          street1: quote.site_address,
        };
      }

      console.log('Creating property with input:', JSON.stringify(propertyInput, null, 2));

      const propertyResult = await jobberGraphQL(JOBBER_API, headers, propertyMutation, { 
        clientId: clientId,
        input: propertyInput
      });

      // Check for errors
      if (propertyResult.propertyCreate?.userErrors?.length) {
        const errors = propertyResult.propertyCreate.userErrors.map((e: any) => e.message).join('; ');
        console.error('Property creation failed:', errors);
        return json({ ok: false, error: `Failed to create property: ${errors}` }, 400);
      }

      console.log('Property created successfully, waiting 2 seconds...');
      
      // Increase wait time to 2 seconds for Jobber's eventual consistency
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Query again for the newly created property
      console.log('Querying for newly created property...');
      propertiesResult = await jobberGraphQL(JOBBER_API, headers, propertiesQuery, { 
        clientId 
      });

      console.log('Properties after creation:', JSON.stringify(propertiesResult, null, 2));

      properties = propertiesResult?.client?.properties || [];
      
      if (properties.length === 0) {
        console.error('Property was created but still not found in query');
        return json({ 
          ok: false, 
          error: 'Property creation succeeded but property not found after 2 seconds. This may be a Jobber API delay. Please try again in a moment.'
        }, 500);
      }
    }
    
    // Use the first property (or the newly created one)
    propertyId = properties[0].id;
    console.log('Using property:', propertyId);

    // 9. Create quote in Jobber
    console.log('=== Creating Jobber Quote ===');
    
    const quoteMutation = `
      mutation CreateQuote(
        $clientId: EncodedId!,
        $propertyId: EncodedId!,
        $title: String!,
        $lineItems: [QuoteCreateLineItemAttributes!]!
      ) {
        quoteCreate(attributes: {
          clientId: $clientId,
          propertyId: $propertyId,
          title: $title,
          lineItems: $lineItems
        }) {
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

    // Build line item description
    const windowCount = quote.sections?.reduce((sum: number, section: any) => {
      return sum + (section.windows?.reduce((wSum: number, window: any) => {
        return wSum + (window.quantity || 1);
      }, 0) || 0);
    }, 0) || 0;

    const description = [
      `Quote #${quote.quote_number}`,
      quote.site_address ? `Location: ${quote.site_address}` : null,
      windowCount > 0 ? `Total Windows: ${windowCount}` : null,
      quote.notes_customer || 'Complete window tinting installation',
    ].filter(Boolean).join('\n');

    console.log('Creating quote with variables:', JSON.stringify({
      clientId: clientId,
      propertyId: propertyId,
      title: `Quote #${quote.quote_number} - ${quote.customer_name}`,
      lineItems: [{
        name: 'Window Tinting Service',
        description: description,
        unitCost: grandTotal,
        quantity: 1,
        saveToProductsAndServices: false
      }]
    }, null, 2));

    const quoteResult = await jobberGraphQL(JOBBER_API, headers, quoteMutation, {
      clientId: clientId,
      propertyId: propertyId,
      title: `Quote #${quote.quote_number} - ${quote.customer_name}`,
      lineItems: [
        {
          name: 'Window Tinting Service',
          description: description,
          unitCost: grandTotal,
          quantity: 1,
          saveToProductsAndServices: false
        }
      ]
    });

    if (quoteResult.quoteCreate?.userErrors?.length) {
      const errors = quoteResult.quoteCreate.userErrors.map((e: any) => e.message).join('; ');
      console.error('Quote creation failed:', errors);
      return json({ ok: false, error: `Failed to create quote: ${errors}` }, 400);
    }

    const jobberQuote = quoteResult.quoteCreate?.quote;
    if (!jobberQuote?.id) {
      console.error('No quote returned from Jobber');
      return json({ ok: false, error: 'Failed to create quote in Jobber' }, 400);
    }

    console.log('=== SUCCESS ===');
    console.log('Jobber quote created:', jobberQuote.id, 'Quote Number:', jobberQuote.quoteNumber);

    return json({ 
      ok: true, 
      jobberQuote,
      clientId,
      propertyId,
      total: formatCurrency(grandTotal),
      message: `Quote #${jobberQuote.quoteNumber} created in Jobber with total ${formatCurrency(grandTotal)}`
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

// Helper: Calculate quote total (replicates client-side logic)
function calculateQuoteTotal(quote: any, filmsMap: Map<string, any>, gasket: any, caulk: any): number {
  const resolveFilm = (windowFilmId: string | null, sectionFilmId: string | null, globalFilmId: string | null) => {
    if (windowFilmId && filmsMap.has(windowFilmId)) return filmsMap.get(windowFilmId);
    if (sectionFilmId && filmsMap.has(sectionFilmId)) return filmsMap.get(sectionFilmId);
    if (globalFilmId && filmsMap.has(globalFilmId)) return filmsMap.get(globalFilmId);
    return null;
  };

  let windowsSubtotal = 0;
  let totalLinearFeetSecurity = 0;

  for (const section of (quote.sections || [])) {
    for (const window of (section.windows || [])) {
      // Use quote dimensions if present, otherwise use exact
      const useQuoteDims = window.quote_width_in != null && window.quote_height_in != null;
      const width = useQuoteDims ? window.quote_width_in : window.width_in;
      const height = useQuoteDims ? window.quote_height_in : window.height_in;

      // Calculate area
      const areaSqft = (width * height) / 144;
      const lineAreaSqft = areaSqft * window.quantity;
      const effectiveAreaSqft = lineAreaSqft * (1 + (window.waste_factor_percent || 0) / 100);
      
      // Get film and pricing
      const resolvedFilm = resolveFilm(window.window_film_id, section.section_film_id, quote.global_film_id);
      const sellPerSqft = window.override_sell_per_sqft ?? resolvedFilm?.sell_per_sqft ?? 0;
      const lineTotal = effectiveAreaSqft * sellPerSqft;
      
      windowsSubtotal += lineTotal;

      // Calculate linear feet for security film (always use exact dimensions for materials)
      const isSecurity = resolvedFilm?.security_film ?? false;
      if (isSecurity) {
        const linearFeet = window.quantity * (2 * (window.width_in + window.height_in) / 12);
        totalLinearFeetSecurity += linearFeet;
      }
    }
  }

  // Calculate materials (using no materials for simplicity - can be enhanced later)
  const materialsTotal = 0; // Or calculate based on gasket/caulk if needed

  // Calculate discounts and totals
  const subtotal = windowsSubtotal + materialsTotal;
  const discountFlatAmount = Math.min(quote.discount_flat || 0, subtotal);
  const subtotalAfterFlat = subtotal - discountFlatAmount;
  const discountPercentAmount = subtotalAfterFlat * ((quote.discount_percent || 0) / 100);
  const subtotalAfterDiscounts = subtotalAfterFlat - discountPercentAmount;
  
  const travelFee = quote.travel_fee || 0;
  const taxableBase = quote.travel_taxable ? subtotalAfterDiscounts + travelFee : subtotalAfterDiscounts;
  const taxAmount = taxableBase * ((quote.tax_percent || 0) / 100);
  
  const grandTotal = subtotalAfterDiscounts + travelFee + taxAmount;

  return Math.round(grandTotal * 100) / 100; // Round to 2 decimal places
}

// Helper: Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

// Helper: JSON response
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
