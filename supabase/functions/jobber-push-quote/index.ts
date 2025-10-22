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

    // 1b. Load rooms for room name resolution
    const { data: rooms } = await supabase.from('rooms').select('*');

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

    // 6. Calculate room-based quote totals
    const totals = calculateQuoteTotal(quote, filmsMap, gasket, rooms || []);
    console.log('Calculated grand total:', totals.grandTotal);

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

    // Build room-based line items
    const lineItems: any[] = [];

    // Add room line items
    totals.roomTotals.forEach((room: any) => {
      const filmRemovalText = room.hasFilmRemoval ? ' + film removal' : '';
      lineItems.push({
        name: room.roomLabel,
        description: `${room.windowCount} window${room.windowCount !== 1 ? 's' : ''} - Window tinting${filmRemovalText}`,
        unitPrice: Math.round(room.subtotal * 100) / 100,
        quantity: 1,
        saveToProductsAndServices: false
      });
    });

    // Add materials if applicable
    if (totals.materialsTotal > 0) {
      lineItems.push({
        name: 'Materials',
        description: 'Security film gasket and caulk',
        unitPrice: Math.round(totals.materialsTotal * 100) / 100,
        quantity: 1,
        saveToProductsAndServices: false
      });
    }

    // Add travel fee if applicable
    if (totals.travelFee > 0) {
      lineItems.push({
        name: 'Travel Fee',
        description: 'Travel to job site',
        unitPrice: Math.round(totals.travelFee * 100) / 100,
        quantity: 1,
        saveToProductsAndServices: false
      });
    }

    console.log('=== LINE ITEMS BEING SENT TO JOBBER ===');
    console.log(JSON.stringify(lineItems, null, 2));
    console.log(`Total line items: ${lineItems.length}`);
    console.log(`Expected total: $${totals.grandTotal.toFixed(2)}`);
    
    console.log('Creating quote with variables:', JSON.stringify({
      clientId: clientId,
      propertyId: propertyId,
      title: quote.customer_type || 'Residential',
      lineItems: lineItems
    }, null, 2));

    const quoteResult = await jobberGraphQL(JOBBER_API, headers, quoteMutation, {
      clientId: clientId,
      propertyId: propertyId,
      title: quote.customer_type || 'Residential',
      lineItems: lineItems
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
      total: formatCurrency(totals.grandTotal),
      message: `Quote #${jobberQuote.quoteNumber} created in Jobber with total ${formatCurrency(totals.grandTotal)}`
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

// Helper: Calculate room-based quote totals
function calculateQuoteTotal(quote: any, filmsMap: Map<string, any>, gasket: any, rooms: any[]) {
  console.log('=== STARTING ROOM-BASED CALCULATIONS ===');
  
  const resolveFilm = (windowFilmId: string | null, sectionFilmId: string | null, globalFilmId: string | null) => {
    if (windowFilmId && filmsMap.has(windowFilmId)) return filmsMap.get(windowFilmId);
    if (sectionFilmId && filmsMap.has(sectionFilmId)) return filmsMap.get(sectionFilmId);
    if (globalFilmId && filmsMap.has(globalFilmId)) return filmsMap.get(globalFilmId);
    return null;
  };

  // Track totals per room
  const roomTotals = new Map<string, {
    roomLabel: string;
    windowCount: number;
    subtotal: number;
    hasFilmRemoval: boolean;
  }>();
  
  let totalLinearFeetSecurity = 0;

  // Process each section and its windows
  for (const section of (quote.sections || [])) {
    // Resolve room name (same logic as quoteCalculations.ts)
    let roomLabel = 'Unassigned';
    
    if (section.custom_room_name) {
      roomLabel = section.custom_room_name;
    } else if (section.room_id) {
      const room = rooms.find((r: any) => r.id === section.room_id);
      roomLabel = room?.name || section.name || 'Unassigned';
    } else if (section.name) {
      roomLabel = section.name;
    }

    console.log(`Processing section in room: ${roomLabel}`);

    // Check if section has manual price override
    if (section.is_price_overridden && section.manual_override_total != null) {
      console.log(`  Section has manual override: $${section.manual_override_total}`);
      
      const roomData = roomTotals.get(roomLabel) || {
        roomLabel,
        windowCount: 0,
        subtotal: 0,
        hasFilmRemoval: false
      };
      
      roomData.windowCount += (section.windows || []).reduce((sum: number, w: any) => sum + (w.quantity || 1), 0);
      roomData.subtotal += section.manual_override_total;
      
      // Check if any windows have film removal for label
      const hasFilmRemoval = (section.windows || []).some((w: any) => (w.film_removal_fee_per_sqft || 0) > 0);
      if (hasFilmRemoval) {
        roomData.hasFilmRemoval = true;
      }
      
      roomTotals.set(roomLabel, roomData);
      
      // Still track security film for materials calculation
      for (const window of (section.windows || [])) {
        const resolvedFilm = resolveFilm(window.window_film_id, section.section_film_id, quote.global_film_id);
        const isSecurity = resolvedFilm?.security_film ?? false;
        if (isSecurity) {
          const linearFeet = (window.quantity || 1) * (2 * (window.width_in + window.height_in) / 12);
          totalLinearFeetSecurity += linearFeet;
        }
      }
      
      continue; // Skip window-by-window calculation for this section
    }

    // Calculate totals for windows in this section
    for (const window of (section.windows || [])) {
      console.log(`  Processing window: ${window.label}, film_removal_fee_per_sqft:`, window.film_removal_fee_per_sqft);
      
      const quantity = window.quantity || 1;
      let lineTotal = 0;
      
      // Use quote dimensions if present, otherwise use exact
      const useQuoteDims = window.quote_width_in != null && window.quote_height_in != null;
      const width = useQuoteDims ? window.quote_width_in : window.width_in;
      const height = useQuoteDims ? window.quote_height_in : window.height_in;

      // Check if window has manual price override
      if (window.is_price_overridden && window.manual_price != null) {
        console.log(`    Window has manual override: $${window.manual_price}`);
        lineTotal = window.manual_price * quantity;
      } else {
        const wasteFactorPercent = window.waste_factor_percent || 0;

        // Calculate area
        const areaSqft = (width * height) / 144;
        const lineAreaSqft = areaSqft * quantity;
        const effectiveAreaSqft = lineAreaSqft * (1 + wasteFactorPercent / 100);

        // Resolve film (window → section → global precedence)
        const resolvedFilm = resolveFilm(window.window_film_id, section.section_film_id, quote.global_film_id);
        const baseSellPerSqft = window.override_sell_per_sqft ?? resolvedFilm?.sell_per_sqft ?? 0;
        const filmRemovalFee = window.film_removal_fee_per_sqft ?? 0;
        const sellPerSqft = baseSellPerSqft + filmRemovalFee;
        
        console.log(`    Film removal fee: $${filmRemovalFee}, Total sell per sqft: $${sellPerSqft}`);

        // Calculate window line total
        lineTotal = effectiveAreaSqft * sellPerSqft;
      }

      // Resolve film for tracking purposes (outside conditional)
      const resolvedFilm = resolveFilm(window.window_film_id, section.section_film_id, quote.global_film_id);
      const filmRemovalFee = window.film_removal_fee_per_sqft ?? 0;

      // Add to room total
      const roomData = roomTotals.get(roomLabel) || {
        roomLabel,
        windowCount: 0,
        subtotal: 0,
        hasFilmRemoval: false
      };
      
      roomData.windowCount += quantity;
      roomData.subtotal += lineTotal;
      if (filmRemovalFee > 0) {
        console.log(`    Setting hasFilmRemoval=true for room: ${roomLabel}`);
        roomData.hasFilmRemoval = true;
      }
      roomTotals.set(roomLabel, roomData);

      // Track security film for materials
      const isSecurity = resolvedFilm?.security_film ?? false;
      if (isSecurity) {
        // Always use exact dimensions for materials (perimeter-based)
        const linearFeet = quantity * (2 * (window.width_in + window.height_in) / 12);
        totalLinearFeetSecurity += linearFeet;
      }

      console.log(`  Window: ${width}x${height}, qty: ${quantity}, price: $${lineTotal.toFixed(2)}`);
    }
  }

  console.log('=== ROOM TOTALS ===');
  roomTotals.forEach((room, label) => {
    console.log(`${label}: ${room.windowCount} windows, $${room.subtotal.toFixed(2)}, hasFilmRemoval: ${room.hasFilmRemoval}`);
  });

  // Calculate materials
  let materialsTotal = 0;
  if (totalLinearFeetSecurity > 0 && gasket) {
    materialsTotal = totalLinearFeetSecurity * gasket.sell_per_linear_ft;
    console.log(`Materials: ${totalLinearFeetSecurity.toFixed(2)} LF × $${gasket.sell_per_linear_ft} = $${materialsTotal.toFixed(2)}`);
  }

  // Calculate subtotals
  const windowsSubtotal = Array.from(roomTotals.values())
    .reduce((sum, room) => sum + room.subtotal, 0);
  
  const subtotal = windowsSubtotal + materialsTotal;
  
  // Apply discounts
  const discountFlatAmount = Math.min(quote.discount_flat || 0, subtotal);
  const subtotalAfterFlat = subtotal - discountFlatAmount;
  const discountPercentAmount = subtotalAfterFlat * ((quote.discount_percent || 0) / 100);
  const subtotalAfterDiscounts = subtotalAfterFlat - discountPercentAmount;
  
  // Travel fee
  const travelFee = quote.travel_fee || 0;
  
  // Calculate tax
  const taxableBase = quote.travel_taxable ? subtotalAfterDiscounts + travelFee : subtotalAfterDiscounts;
  const taxAmount = taxableBase * ((quote.tax_percent || 0) / 100);
  
  // Grand total
  let grandTotal = Math.round((subtotalAfterDiscounts + travelFee + taxAmount) * 100) / 100;
  
  // Check if quote has manual price override
  if (quote.is_price_overridden && quote.manual_override_total != null) {
    console.log(`Quote has manual override: $${quote.manual_override_total}`);
    grandTotal = quote.manual_override_total;
  }

  console.log('=== FINAL TOTALS ===');
  console.log(`Windows Subtotal: $${windowsSubtotal.toFixed(2)}`);
  console.log(`Materials: $${materialsTotal.toFixed(2)}`);
  console.log(`Subtotal: $${subtotal.toFixed(2)}`);
  console.log(`Discount (Flat): -$${discountFlatAmount.toFixed(2)}`);
  console.log(`Discount (Percent): -$${discountPercentAmount.toFixed(2)}`);
  console.log(`Subtotal After Discounts: $${subtotalAfterDiscounts.toFixed(2)}`);
  console.log(`Travel Fee: $${travelFee.toFixed(2)}`);
  console.log(`Tax (${quote.tax_percent || 0}%): $${taxAmount.toFixed(2)}`);
  console.log(`GRAND TOTAL: $${grandTotal.toFixed(2)}`);

  return {
    roomTotals: Array.from(roomTotals.values()),
    materialsTotal,
    travelFee,
    subtotal,
    taxAmount,
    grandTotal
  };
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
