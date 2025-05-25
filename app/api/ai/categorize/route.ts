import { NextResponse } from 'next/server'
import { type CategorizeRequest, type CategoryResponse } from '@/types/email'
import { GoogleGenerativeAI } from '@google/generative-ai'

const logger = {
  info: (message: string, data?: any) => console.log(`[CategorizeAPI] ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[CategorizeAPI] ${message}`, error || '')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

const categorizePrompt = `
Analyze the email address and determine its category based on:
- Domain type (personal, corporate, educational)
- Common patterns in email addresses
- Context from the name if available
- Typical usage patterns

Categories:
- personal (friends, family)
- work (business, corporate)
- education (schools, universities)
- shopping (retail, e-commerce)
- social (social media, networking)
- other (miscellaneous)

Return a JSON object with:
{
  "category": "category_name",
  "confidence": 0.95,
  "reasoning": "explanation"
}

Be concise and accurate in your analysis.
Respond ONLY with a JSON object. Do not include any explanation, markdown, or extra text before or after the JSON.

`

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7)
  logger.info(`[${requestId}] Processing categorize request`)

  try {
    const body = await request.json() as CategorizeRequest
    logger.info(`[${requestId}] Request body`, body)

    if (!body.email) {
      logger.error(`[${requestId}] Missing email in request`)
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const prompt = `${categorizePrompt}\n\nEmail: ${body.email}${body.name ? `\nName: ${body.name}` : ''}${body.context ? `\nContext: ${body.context}` : ''}`
    const result = await model.generateContent(prompt)
    const response = await result.response
    const content = response.text()

    try {
        const raw = content.match(/\{[\s\S]*?\}/)?.[0]

        if (!raw) {
          logger.error(`[${requestId}] No JSON object found in response`, content)
          return NextResponse.json(
            { error: 'No JSON object found in AI response' },
            { status: 500 }
          )
        }

      const result = JSON.parse(raw) as CategoryResponse
      logger.info(`[${requestId}] Categorization result`, result)

      return NextResponse.json(result)
    } catch (error) {
      logger.error(`[${requestId}] Failed to parse AI response`, error)
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      )
    }
  } catch (error) {
    logger.error(`[${requestId}] Request failed`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 