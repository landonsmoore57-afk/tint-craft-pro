import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-token, x-app-actor-id, x-app-actor-role',
}

interface QuotePayload {
  quote: any
  sections: any[]
}

const APP_TOKEN = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const appToken = req.headers.get('x-app-token')

    if (!APP_TOKEN || appToken !== APP_TOKEN) {
      console.error('Invalid app token - expected:', APP_TOKEN ? 'token set' : 'no token', 'received:', appToken ? 'token provided' : 'no token')
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Optional: capture actor for auditing
    const actorId = req.headers.get('x-app-actor-id') || null
    const actorRole = req.headers.get('x-app-actor-role') || null
    console.log('Actor:', actorId, actorRole)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { 'x-client-info': 'save-quote-fn' }
        }
      }
    )

    const body: QuotePayload = await req.json()
    const { quote, sections } = body

    console.log('Saving quote:', quote.id ? `Update ${quote.id}` : 'New quote')

    // 1) Upsert quote
    const { data: upsertedQuote, error: qErr } = await supabase
      .from('quotes')
      .upsert(quote)
      .select()
      .single()

    if (qErr) {
      console.error('Quote upsert error:', qErr)
      throw qErr
    }

    console.log('Quote saved:', upsertedQuote.id)

    // Delete existing sections if updating
    if (quote.id) {
      await supabase.from('sections').delete().eq('quote_id', quote.id)
    }

    // 2) Insert sections with windows
    for (let sIndex = 0; sIndex < sections.length; sIndex++) {
      const section = sections[sIndex]
      
      const { data: newSection, error: sErr } = await supabase
        .from('sections')
        .insert({
          quote_id: upsertedQuote.id,
          name: section.name,
          room_id: section.room_id,
          custom_room_name: section.custom_room_name,
          section_film_id: section.section_film_id,
          position: sIndex,
        })
        .select()
        .single()

      if (sErr) {
        console.error('Section insert error:', sErr)
        throw sErr
      }

      // 3) Insert windows for this section
      if (section.windows && section.windows.length > 0) {
        const windowsToInsert = section.windows.map((window: any, wIndex: number) => ({
          section_id: newSection.id,
          label: window.label,
          width_in: window.width_in,
          height_in: window.height_in,
          quote_width_in: window.quote_width_in || null,
          quote_height_in: window.quote_height_in || null,
          quantity: window.quantity,
          waste_factor_percent: window.waste_factor_percent,
          window_film_id: window.window_film_id,
          override_sell_per_sqft: window.override_sell_per_sqft,
          position: wIndex,
        }))

        const { error: wErr } = await supabase
          .from('windows')
          .insert(windowsToInsert)

        if (wErr) {
          console.error('Windows insert error:', wErr)
          throw wErr
        }
      }
    }

    console.log('Quote save complete:', upsertedQuote.id)

    return new Response(
      JSON.stringify({ ok: true, quote: upsertedQuote }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e: any) {
    console.error('save-quote error:', e)
    return new Response(
      JSON.stringify({ error: e?.message ?? 'Save failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
