// LLM Client for Talent Intelligence Platform
// Supports OpenAI and Groq (free tier available)

import OpenAI from 'openai';
import { getConfig } from './config';
import { TokenUsage, ChatMessage, LLMProvider } from '@/types';

// Token pricing (per 1K tokens)
const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI pricing
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  // Groq pricing (free tier)
  'llama-3.3-70b-versatile': { input: 0.0, output: 0.0 },
  'llama-3.1-70b-versatile': { input: 0.0, output: 0.0 },
  'llama-3.1-8b-instant': { input: 0.0, output: 0.0 },
  'llama3-70b-8192': { input: 0.0, output: 0.0 },
  'llama3-8b-8192': { input: 0.0, output: 0.0 },
  'mixtral-8x7b-32768': { input: 0.0, output: 0.0 },
  'gemma2-9b-it': { input: 0.0, output: 0.0 },
  // DeepSeek pricing
  'deepseek-chat': { input: 0.00028, output: 0.00042 },
  'deepseek-reasoner': { input: 0.00028, output: 0.00042 },
  // Gemini pricing (free tier for Flash models via AI Studio)
  'gemini-2.5-pro-preview-05-06': { input: 0.00125, output: 0.01 },
  'gemini-2.0-flash': { input: 0.0, output: 0.0 },
  'gemini-2.0-flash-lite': { input: 0.0, output: 0.0 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-1.5-flash': { input: 0.0, output: 0.0 },
  // Mistral pricing
  'mistral-large-latest': { input: 0.002, output: 0.006 },
  'mistral-medium-latest': { input: 0.0027, output: 0.0081 },
  'mistral-small-latest': { input: 0.001, output: 0.003 },
  'open-mistral-nemo': { input: 0.00015, output: 0.00015 },
  'codestral-latest': { input: 0.001, output: 0.003 },
};

// Provider configuration (all OpenAI SDK compatible)
const PROVIDER_CONFIG: Record<string, { baseURL: string; envKey: string }> = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com',
    envKey: 'DEEPSEEK_API_KEY',
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    envKey: 'GEMINI_API_KEY',
  },
  mistral: {
    baseURL: 'https://api.mistral.ai/v1',
    envKey: 'MISTRAL_API_KEY',
  },
};

export class LLMClient {
  private client: OpenAI;
  private model: string;
  private provider: LLMProvider;

  constructor(provider?: LLMProvider, model?: string, dynamicApiKey?: string) {
    const config = getConfig();

    // Determine provider - prefer Groq if available (free)
    this.provider = provider || config.llm?.provider || 'groq';
    this.model = model || config.llm?.model || 'llama-3.3-70b-versatile';

    // Get API key: prefer dynamic (per-user), fallback to env
    let apiKey: string;
    if (dynamicApiKey) {
      apiKey = dynamicApiKey;
    } else {
      const providerConfig = PROVIDER_CONFIG[this.provider];
      apiKey = process.env[providerConfig?.envKey || ''] || '';
      // Fallback for legacy config
      if (!apiKey && this.provider === 'openai') apiKey = config.openai?.apiKey || '';
      if (!apiKey && this.provider === 'groq') apiKey = (config as any).groq?.apiKey || '';
      if (!apiKey && this.provider === 'deepseek') apiKey = (config as any).deepseek?.apiKey || '';
    }

    const baseURL = (PROVIDER_CONFIG[this.provider] || PROVIDER_CONFIG.openai).baseURL;

    this.client = new OpenAI({
      apiKey: apiKey || 'dummy-key',
      baseURL,
    });

    console.log(`[LLM] Using provider: ${this.provider}, model: ${this.model}${dynamicApiKey ? ' (per-user)' : ''}`);
  }

  /**
   * Calculate estimated cost based on token usage
   */
  private calculateCost(promptTokens: number, completionTokens: number): number {
    const pricing = TOKEN_PRICING[this.model as keyof typeof TOKEN_PRICING] || { input: 0.01, output: 0.03 };
    return (promptTokens / 1000) * pricing.input + (completionTokens / 1000) * pricing.output;
  }

  /**
   * Execute API call with retry logic for rate limits
   */
  private async executeWithRetry<T>(
    operation: (model: string) => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 2000
  ): Promise<T> {
    let lastError: Error | null = null;
    let currentModel = this.model;

    // Fallback models for Groq (smaller/faster models)
    const groqFallbackModels = [
      'llama-3.1-8b-instant',  // Fastest, uses fewer tokens
      'gemma2-9b-it',          // Google's smaller model
    ];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation(currentModel);
      } catch (error: any) {
        lastError = error;

        // Check if it's a rate limit error
        if (error?.status === 429 || error?.code === 'rate_limit_exceeded') {
          const errorMsg = error.message || '';

          // Check if it's a DAILY limit (TPD) vs minute limit (TPM)
          const isDailyLimit = errorMsg.includes('per day') || errorMsg.includes('TPD');
          const isMinuteLimit = errorMsg.includes('per minute') || errorMsg.includes('TPM');

          if (isDailyLimit) {
            // Daily limit hit - try fallback model or throw clear error
            if (this.provider === 'groq' && attempt < groqFallbackModels.length) {
              currentModel = groqFallbackModels[attempt];
              console.log(`[LLM] Daily limit hit. Trying fallback model: ${currentModel}`);
              continue;
            }
            // No more fallbacks - throw descriptive error
            throw new Error(
              `Groq daily token limit reached (100K tokens/day on free tier). ` +
              `Please wait until tomorrow or upgrade at https://console.groq.com/settings/billing`
            );
          }

          if (isMinuteLimit) {
            // Per-minute limit - wait and retry
            const waitMatch = errorMsg.match(/try again in (\d+(?:\.\d+)?)/i);
            const waitTime = waitMatch ? Math.min(parseFloat(waitMatch[1]) * 1000, 10000) : baseDelay * (attempt + 1);

            console.log(`[LLM] Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }

          // Unknown rate limit type - wait and retry
          const waitTime = baseDelay * (attempt + 1);
          console.log(`[LLM] Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // For other errors, throw immediately
        throw error;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Generate SQL from natural language query
   */
  async generateSQL(
    userQuery: string,
    schema: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<{
    sql: string;
    explanation: string;
    tokenUsage: TokenUsage;
  }> {
    const systemPrompt = `You are a SQL expert for a CData Connect AI talent database.

DATABASE SCHEMA:
${schema}

TIPS:
- For "top" candidates: ORDER BY [AvgRating] DESC,[YearsExperience] DESC
- Always add LIMIT 50 unless user specifies otherwise

CRITICAL: You MUST respond with ONLY a valid JSON object. No text before or after.
Your response must be exactly this format:
{"sql": "YOUR SQL QUERY HERE", "explanation": "Brief explanation here"}

Do NOT include any other text, markdown, or code blocks. ONLY the JSON object.`;

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-5).map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: userQuery },
    ];

    try {
      const response = await this.executeWithRetry(async (model) => {
        return await this.client.chat.completions.create({
          model,
          messages,
          temperature: 0.1,
          max_tokens: 1000,
          // Only use JSON mode for OpenAI
          ...(this.provider === 'openai' && { response_format: { type: 'json_object' } }),
        });
      });

      const content = response.choices[0]?.message?.content || '{}';

      // Parse JSON - handle cases where model returns non-JSON responses
      let parsed;
      try {
        // Try direct parse first
        parsed = JSON.parse(content);
      } catch {
        // Try to extract JSON from markdown code block
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try { parsed = JSON.parse(jsonMatch[1]); } catch { parsed = null; }
        }

        if (!parsed) {
          // Try to find JSON object in the response
          const objectMatch = content.match(/\{[\s\S]*\}/);
          if (objectMatch) {
            try { parsed = JSON.parse(objectMatch[0]); } catch { parsed = null; }
          }
        }

        if (!parsed) {
          // Last resort: model returned raw SQL without JSON wrapper
          // Extract SQL from content (handles "sql SELECT...", "SELECT...", etc.)
          const rawContent = content.trim();
          const sqlMatch = rawContent.match(/^(?:sql\s+)?(SELECT[\s\S]+)/i);
          if (sqlMatch) {
            console.log('[LLM] Model returned raw SQL instead of JSON, wrapping it');
            parsed = { sql: sqlMatch[1].trim(), explanation: 'Query generated from natural language' };
          } else {
            parsed = { sql: '', explanation: 'Failed to parse response' };
          }
        }
      }

      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;

      return {
        sql: parsed.sql || '',
        explanation: parsed.explanation || '',
        tokenUsage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          estimatedCost: this.calculateCost(promptTokens, completionTokens),
        },
      };
    } catch (error) {
      console.error('[LLM] Error generating SQL:', error);
      throw error;
    }
  }

  /**
   * Analyze query results and generate natural language response
   */
  async analyzeResults(
    userQuery: string,
    sql: string,
    results: any[],
    conversationHistory: ChatMessage[] = []
  ): Promise<{
    response: string;
    tokenUsage: TokenUsage;
  }> {
    const systemPrompt = `You are a helpful AI assistant for a Talent Intelligence Platform. Format responses in **Markdown**.

## Response Format:
- Use **bold** for names, key values, and important metrics
- Use bullet points with candidate names like: **John Smith** - Senior Java Dev, 8 yrs, $95/hr
- Add a "## Key Insights" section highlighting patterns
- Add a "## Next Steps" section with actionable suggestions
- Use \`inline code\` for technical skills
- Keep it concise but structured
- Format currency as USD with no decimals

## Data Context:
Candidates (W2/C2C/1099), Job Requisitions, Placements, Skills`;

    // Send compact data preview (CSV-style) to reduce tokens
    const previewRows = results.slice(0, 10);
    let dataPreview: string;
    if (previewRows.length > 0) {
      const cols = Object.keys(previewRows[0]);
      const header = cols.join(' | ');
      const rows = previewRows.map(r => cols.map(c => String(r[c] ?? '').substring(0, 60)).join(' | '));
      dataPreview = [header, ...rows].join('\n');
    } else {
      dataPreview = '(no results)';
    }

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-3).map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user',
        content: `User asked: "${userQuery}"\nSQL: ${sql}\n${results.length} rows returned (showing ${previewRows.length}):\n${dataPreview}\n\nSummarize concisely.`,
      },
    ];

    try {
      const response = await this.executeWithRetry(async (model) => {
        return await this.client.chat.completions.create({
          model,
          messages,
          temperature: 0.5,
          max_tokens: 800,
        });
      });

      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;

      return {
        response: response.choices[0]?.message?.content || 'Unable to analyze results.',
        tokenUsage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          estimatedCost: this.calculateCost(promptTokens, completionTokens),
        },
      };
    } catch (error) {
      console.error('[LLM] Error analyzing results:', error);
      throw error;
    }
  }

  /**
   * Chat completion for general questions
   */
  async chat(
    userMessage: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<{
    response: string;
    tokenUsage: TokenUsage;
  }> {
    const systemPrompt = `You are an AI assistant for a Talent Intelligence Platform used by recruiters and staffing professionals.

You can help with:
- Finding candidates with specific skills
- Matching candidates to job requisitions
- Analyzing placement performance
- Understanding market rates
- General recruiting questions

If the user's question requires data from the database, suggest they rephrase it as a data query starting with "Find", "Show", "List", or "What".`;

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10).map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await this.executeWithRetry(async (model) => {
        return await this.client.chat.completions.create({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 1000,
        });
      });

      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;

      return {
        response: response.choices[0]?.message?.content || 'I apologize, I could not generate a response.',
        tokenUsage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          estimatedCost: this.calculateCost(promptTokens, completionTokens),
        },
      };
    } catch (error) {
      console.error('[LLM] Error in chat:', error);
      throw error;
    }
  }

  /**
   * Raw completion for agent loops (ReAct pattern)
   * Returns content + token counts without any JSON parsing
   */
  async rawCompletion(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<{
    content: string;
    promptTokens: number;
    completionTokens: number;
    estimatedCost: number;
  }> {
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const response = await this.executeWithRetry(async (model) => {
      return await this.client.chat.completions.create({
        model,
        messages: openaiMessages,
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens ?? 1000,
      });
    });

    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;

    return {
      content: response.choices[0]?.message?.content || '',
      promptTokens,
      completionTokens,
      estimatedCost: this.calculateCost(promptTokens, completionTokens),
    };
  }

  /**
   * Test LLM connection
   */
  async testConnection(): Promise<{ connected: boolean; message: string; model: string; provider: string }> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      });

      return {
        connected: true,
        message: `${this.provider.toUpperCase()} connection successful`,
        model: this.model,
        provider: this.provider,
      };
    } catch (error) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Connection failed',
        model: this.model,
        provider: this.provider,
      };
    }
  }

  getProvider(): LLMProvider {
    return this.provider;
  }

  getModel(): string {
    return this.model;
  }
}

// For backwards compatibility
export class OpenAIClient extends LLMClient {
  constructor() {
    super();
  }
}

// Singleton instance - recreate when settings change
let llmClient: LLMClient | null = null;

export function getOpenAIClient(): LLMClient {
  if (!llmClient) {
    llmClient = new LLMClient();
  }
  return llmClient;
}

// Set client for per-request credentials (LangGraph nodes use getOpenAIClient())
export function setOpenAIClient(client: LLMClient): void {
  llmClient = client;
}

// Reset client (call when settings change)
export function resetLLMClient(): void {
  llmClient = null;
}
