import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0"

const APP_TOKEN = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-app-token,x-app-actor-id,x-app-actor-role",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers, status: 204 })

  try {
    const token = req.headers.get('x-app-token') || ''
    
    console.log('Save-quote auth check:', {
      hasAppToken: !!APP_TOKEN,
      appTokenLength: APP_TOKEN?.length,
      receivedToken: token?.substring(0, 20) + '...',
      receivedTokenLength: token?.length,
      tokensMatch: token === APP_TOKEN
    })
    
    if (!APP_TOKEN || token !== APP_TOKEN) {
      console.error('Token mismatch!')
      return new Response(JSON.stringify({ ok: false, code: 'BAD_TOKEN', error: 'Not authenticated' }), { status: 401, headers })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { 'x-client-info': 'save-quote' } } }
    )

    const { quote, sections } = await req.json()

    // upsert quote
    const { data: savedQuote, error: qErr } = await supabase.from('quotes').upsert(quote).select().single()
    if (qErr) return new Response(JSON.stringify({ ok: false, code: 'DB_QUOTE', error: qErr.message }), { status: 500, headers })

    // delete old sections if updating
    if (quote.id) {
      await supabase.from('sections').delete().eq('quote_id', quote.id)
    }

    // upsert sections
    const sectionsInput = (sections ?? []).map((s: any, i: number) => ({ 
      id: s.id,
      quote_id: savedQuote.id,
      name: s.name,
      room_id: s.room_id,
      custom_room_name: s.custom_room_name,
      section_film_id: s.section_film_id,
      position: i
    }))
    const { data: savedSections, error: sErr } = await supabase.from('sections').upsert(sectionsInput).select()
    if (sErr) return new Response(JSON.stringify({ ok: false, code: 'DB_SECTIONS', error: sErr.message }), { status: 500, headers })

    // upsert windows (flatten)
    const windowsInput = sectionsInput.flatMap((s: any, i: number) =>
      (sections?.[i]?.windows ?? []).map((w: any, j: number) => ({ 
        id: w.id,
        section_id: savedSections[i].id,
        label: w.label,
        width_in: w.width_in,
        height_in: w.height_in,
        quote_width_in: w.quote_width_in,
        quote_height_in: w.quote_height_in,
        quantity: w.quantity,
        waste_factor_percent: w.waste_factor_percent,
        window_film_id: w.window_film_id,
        override_sell_per_sqft: w.override_sell_per_sqft,
        film_removal_fee_per_sqft: w.film_removal_fee_per_sqft ?? 0,
        position: j
      }))
    )
    if (windowsInput.length) {
      const { error: wErr } = await supabase.from('windows').upsert(windowsInput)
      if (wErr) return new Response(JSON.stringify({ ok: false, code: 'DB_WINDOWS', error: wErr.message }), { status: 500, headers })
    }

    return new Response(JSON.stringify({ ok: true, quote: savedQuote }), { status: 200, headers })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, code: 'UNEXPECTED', error: e?.message ?? 'Save failed' }), { status: 500, headers })
  }
})
