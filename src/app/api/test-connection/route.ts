import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, credentials } = body as {
      type: 'llm' | 'cdata';
      credentials: Record<string, string>;
    };

    if (type === 'cdata') {
      const { email, pat, endpoint } = credentials;
      if (!email || !pat) {
        return NextResponse.json({ connected: false, message: 'Email and PAT are required' });
      }

      const authString = `${email}:${pat}`;
      const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;
      const mcpEndpoint = endpoint || 'https://mcp.cloud.cdata.com/mcp';

      try {
        const response = await fetch(mcpEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            Authorization: authHeader,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: { name: 'TIP Connection Test', version: '1.0' },
            },
          }),
        });

        if (response.ok) {
          return NextResponse.json({ connected: true, message: 'CData Connect AI connection successful' });
        }

        if (response.status === 401) {
          return NextResponse.json({ connected: false, message: 'Authentication failed - check email and PAT' });
        }

        return NextResponse.json({
          connected: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
        });
      } catch (err) {
        return NextResponse.json({
          connected: false,
          message: err instanceof Error ? err.message : 'Connection failed',
        });
      }
    }

    if (type === 'llm') {
      const { provider, apiKey, model } = credentials;
      if (!apiKey) {
        return NextResponse.json({ connected: false, message: 'API key is required' });
      }

      const baseURLs: Record<string, string> = {
        openai: 'https://api.openai.com/v1',
        groq: 'https://api.groq.com/openai/v1',
        deepseek: 'https://api.deepseek.com',
      };

      const baseURL = baseURLs[provider] || baseURLs.groq;
      const testModel = model || (provider === 'groq' ? 'llama-3.3-70b-versatile' : provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');

      try {
        const response = await fetch(`${baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: testModel,
            messages: [{ role: 'user', content: 'Hello' }],
            max_tokens: 5,
          }),
        });

        if (response.ok) {
          return NextResponse.json({
            connected: true,
            message: `${provider} connection successful (${testModel})`,
          });
        }

        if (response.status === 401) {
          return NextResponse.json({ connected: false, message: 'Invalid API key' });
        }

        const errorData = await response.json().catch(() => ({}));
        return NextResponse.json({
          connected: false,
          message: errorData?.error?.message || `HTTP ${response.status}`,
        });
      } catch (err) {
        return NextResponse.json({
          connected: false,
          message: err instanceof Error ? err.message : 'Connection failed',
        });
      }
    }

    return NextResponse.json({ connected: false, message: 'Invalid test type' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { connected: false, message: error instanceof Error ? error.message : 'Test failed' },
      { status: 500 }
    );
  }
}
