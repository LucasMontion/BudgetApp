import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pdfBase64, isCard, budgetItems } = await req.json()

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY secret not set on this function.')

    const categoriesBlock = budgetItems?.length
      ? `Available budget categories to match against:\n${JSON.stringify(budgetItems)}\n\n`
      : ''

    const prompt = isCard
      ? `${categoriesBlock}Analyze this credit card statement. Extract ALL transactions and return ONLY a valid JSON array — no markdown, no explanation, no other text.

Each element must have exactly these fields:
{
  "date": "YYYY-MM-DD",
  "description": "merchant name or original description",
  "amount": 12.50,
  "type": "purchase" | "payment" | "credit",
  "suggestedSection": "bills" | "variable" | "income" | "savings" | null,
  "suggestedSubcategory": "exact name from categories list above, or null"
}

Rules:
- purchase = charge on the card (expense)
- payment = payment made to reduce the card balance
- credit = refund or credit applied to the card
- amount is always a positive number
- match suggestedSubcategory to an existing category name when possible`
      : `${categoriesBlock}Analyze this bank statement. Extract ALL transactions and return ONLY a valid JSON array — no markdown, no explanation, no other text.

Each element must have exactly these fields:
{
  "date": "YYYY-MM-DD",
  "description": "original description",
  "amount": 12.50,
  "type": "debit" | "credit",
  "suggestedSection": "bills" | "variable" | "income" | "savings" | null,
  "suggestedSubcategory": "exact name from categories list above, or null"
}

Rules:
- debit = money leaving the account (expense)
- credit = money entering the account (income/deposit)
- amount is always a positive number
- match suggestedSubcategory to an existing category name when possible`

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
            },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    })

    if (!anthropicRes.ok) {
      const err = await anthropicRes.json().catch(() => ({}))
      throw new Error(err.error?.message || `Anthropic API error ${anthropicRes.status}`)
    }

    const data = await anthropicRes.json()
    const text = data.content?.[0]?.text ?? ''
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Could not parse transactions from AI response.')
    const transactions = JSON.parse(match[0])

    return new Response(JSON.stringify({ transactions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
