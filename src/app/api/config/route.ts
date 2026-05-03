import { NextRequest, NextResponse } from 'next/server';
import { getClientConfig, getConfig, validateConfig } from '@/lib/config';
import { getOpenAIClient } from '@/lib/openai-client';
import { getCDataClient } from '@/lib/cdata-client';

// GET /api/config - Get client-safe configuration
export async function GET() {
  try {
    const clientConfig = getClientConfig();
    const config = getConfig();
    const validation = validateConfig(config);

    return NextResponse.json({
      ...clientConfig,
      configured: validation.valid,
      configErrors: validation.errors,
    });
  } catch (error) {
    console.error('Config API error:', error);
    return NextResponse.json(
      { error: 'Failed to get configuration' },
      { status: 500 }
    );
  }
}

// POST /api/config/test - Test connections
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testType } = body as { testType: 'openai' | 'cdata' | 'all' };

    const results: {
      openai?: { connected: boolean; message: string; model?: string };
      cdata?: { connected: boolean; message: string; duration?: number };
    } = {};

    if (testType === 'openai' || testType === 'all') {
      try {
        const openai = getOpenAIClient();
        results.openai = await openai.testConnection();
      } catch (error) {
        results.openai = {
          connected: false,
          message: error instanceof Error ? error.message : 'OpenAI test failed',
        };
      }
    }

    if (testType === 'cdata' || testType === 'all') {
      try {
        const cdata = getCDataClient();
        results.cdata = await cdata.testConnection();
      } catch (error) {
        results.cdata = {
          connected: false,
          message: error instanceof Error ? error.message : 'CData test failed',
        };
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Config test error:', error);
    return NextResponse.json(
      { error: 'Connection test failed' },
      { status: 500 }
    );
  }
}
