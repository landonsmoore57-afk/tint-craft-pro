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

    // 4. Check and refresh token if needed (with 5-minute buffer)
    console.log('=== Checking Jobber Authentication ===');
    
    let accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    const expiresAt = tokens.expires_at;
    
    // Check if token is expired or will expire in the next 5 minutes
    const now = new Date();
    const expiryDate = new Date(expiresAt);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
    const needsRefresh = expiryDate <= fiveMinutesFromNow;
    
    console.log('Token status:', {
      expiresAt: expiresAt,
      now: now.toISOString(),
      expiresIn: Math.round((expiryDate.getTime() - now.getTime()) / 1000 / 60) + ' minutes',
      needsRefresh: needsRefresh
    });
    
    if (needsRefresh) {
      console.log('Token expires soon or is expired, refreshing...');
      
      try {
        const tokenResponse = await fetch('https://api.getjobber.com/api/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: Deno.env.get('JOBBER_CLIENT_ID')!,
            client_secret: Deno.env.get('JOBBER_CLIENT_SECRET')!,
          }),
        });
    
        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('Token refresh failed:', tokenResponse.status, errorText);
          return json({ 
            ok: false, 
            error: 'Jobber connection expired. Please reconnect to Jobber in your settings.' 
          }, 401);
        }
    
        const refreshData = await tokenResponse.json();
        accessToken = refreshData.access_token;
        
        // Calculate new expiry time (tokens typically last 2 hours)
        let newExpiresAt: string;
        if (refreshData.expires_in && typeof refreshData.expires_in === 'number' && refreshData.expires_in > 0) {
          newExpiresAt = new Date(now.getTime() + refreshData.expires_in * 1000).toISOString();
        } else {
          console.warn('No valid expires_in in token response, using 1 hour default');
          newExpiresAt = new Date(now.getTime() + 3600 * 1000).toISOString();
        }
    
        // Update tokens in database
        const { error: updateError } = await supabase
          .from('integration_jobber_tokens')
          .update({
            access_token: refreshData.access_token,
            refresh_token: refreshData.refresh_token || refreshToken,
            expires_at: newExpiresAt,
            updated_at: now.toISOString(),
          })
          .eq('account_id', userId);
        
        if (updateError) {
          console.error('Failed to update tokens:', updateError);
        } else {
          console.log('Tokens refreshed successfully. New expiry:', newExpiresAt);
        }
      } catch (error) {
        console.error('Token refresh error:', error);
        return json({ 
          ok: false, 
          error: 'Failed to refresh Jobber connection. Please reconnect to Jobber in your settings.' 
        }, 401);
      }
    } else {
      console.log('Token is still valid, no refresh needed');
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
          description: "MAIN"
        }];
      }
      if (quote.customer_phone) {
        clientInput.phones = [{ 
          number: quote.customer_phone, 
          description: "MAIN"
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
    
    // Query for existing properties - FIXED FIELD NAME
    const propertiesQuery = `
      query GetClientProperties($clientId: EncodedId!) {
        client(id: $clientId) {
          clientProperties {
            nodes {
              id
            }
          }
        }
      }
    `;

    let propertiesResult = await jobberGraphQL(JOBBER_API, headers, propertiesQuery, { 
      clientId 
    });

    console.log('Initial properties check:', JSON.stringify(propertiesResult, null, 2));

    let properties = propertiesResult?.client?.clientProperties?.nodes || [];
    
    // If no properties exist, create one
    if (properties.length === 0) {
      console.log('No properties found, creating new property...');
      
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

      const propertyInput: any = {
        properties: [
          {
            address: {
              street1: quote.site_address || "Service Location"
            }
          }
        ]
      };
      
      // Optional: Add a name for the property
      if (quote.site_address) {
        propertyInput.properties[0].name = quote.site_address.split(',')[0];
      }

      console.log('Creating property with input:', JSON.stringify(propertyInput, null, 2));

      const propertyResult = await jobberGraphQL(JOBBER_API, headers, propertyMutation, { 
        clientId: clientId,
        input: propertyInput
      });

      console.log('Property creation result:', JSON.stringify(propertyResult, null, 2));

      // Check for errors
      if (propertyResult.propertyCreate?.userErrors?.length) {
        const errors = propertyResult.propertyCreate.userErrors.map((e: any) => e.message).join('; ');
        console.error('Property creation failed:', errors);
        return json({ ok: false, error: `Failed to create property: ${errors}` }, 400);
      }

      // Get the property ID from the properties array
      const createdProperties = propertyResult.propertyCreate?.properties;
      const createdProperty = createdProperties?.[0];
      
      if (!createdProperty?.id) {
        console.error('Property creation succeeded but no property ID returned');
        return json({ 
          ok: false, 
          error: 'Property creation completed but no property ID was returned.'
        }, 500);
      }

      propertyId = createdProperty.id;
      console.log('Property created with ID:', propertyId);
    } else {
      // Use existing property
      propertyId = properties[0].id;
      console.log('Using existing property:', propertyId);
    }

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

    console.log('=== LINE ITEMS BEING SENT TO JOBBER ===');
    console.log('Line item unitPrice:', grandTotal);
    
    console.log('Creating quote with variables:', JSON.stringify({
      clientId: clientId,
      propertyId: propertyId,
      title: `Quote #${quote.quote_number} - ${quote.customer_name}`,
      lineItems: [{
        name: 'Window Tinting Service',
        description: description,
        unitPrice: grandTotal,
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
          unitPrice: grandTotal,
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

  // Calculate materials based on security film
  // If there's security film, use gasket pricing; otherwise no materials
  let materialsTotal = 0;
  if (totalLinearFeetSecurity > 0 && gasket) {
    materialsTotal = totalLinearFeetSecurity * gasket.sell_per_linear_ft;
  }

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
