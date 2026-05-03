import { NextRequest, NextResponse } from 'next/server';
import { getCDataClient } from '@/lib/cdata-client';
import { getConfig, validateConfig } from '@/lib/config';

// POST /api/cdata - Execute CData MCP tool calls
export async function POST(request: NextRequest) {
  try {
    const config = getConfig();
    const validation = validateConfig(config);

    if (!config.cdata.email || !config.cdata.pat) {
      return NextResponse.json(
        { error: 'CData Connect AI is not configured. Please set CDATA_EMAIL and CDATA_PAT in .env.local' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { tool, params } = body as {
      tool: string;
      params?: Record<string, any>;
    };

    if (!tool) {
      return NextResponse.json({ error: 'Tool name is required' }, { status: 400 });
    }

    const cdata = getCDataClient();
    let result: any;

    switch (tool) {
      case 'getCatalogs':
        result = await cdata.getCatalogs();
        break;

      case 'getSchemas':
        if (!params?.catalog) {
          return NextResponse.json({ error: 'catalog parameter is required' }, { status: 400 });
        }
        result = await cdata.getSchemas(params.catalog);
        break;

      case 'getTables':
        if (!params?.catalog || !params?.schema) {
          return NextResponse.json({ error: 'catalog and schema parameters are required' }, { status: 400 });
        }
        result = await cdata.getTables(params.catalog, params.schema);
        break;

      case 'getColumns':
        if (!params?.catalog || !params?.schema || !params?.table) {
          return NextResponse.json({ error: 'catalog, schema, and table parameters are required' }, { status: 400 });
        }
        result = await cdata.getColumns(params.catalog, params.schema, params.table);
        break;

      case 'queryData':
        if (!params?.catalog || !params?.query) {
          return NextResponse.json({ error: 'catalog and query parameters are required' }, { status: 400 });
        }
        result = await cdata.queryData(params.catalog, params.query);
        break;

      case 'getProcedures':
        if (!params?.catalog || !params?.schema) {
          return NextResponse.json({ error: 'catalog and schema parameters are required' }, { status: 400 });
        }
        result = await cdata.getProcedures(params.catalog, params.schema);
        break;

      case 'getProcedureParameters':
        if (!params?.catalog || !params?.schema || !params?.procedure) {
          return NextResponse.json({ error: 'catalog, schema, and procedure parameters are required' }, { status: 400 });
        }
        result = await cdata.getProcedureParameters(params.catalog, params.schema, params.procedure);
        break;

      case 'executeProcedure':
        if (!params?.catalog || !params?.schema || !params?.procedure) {
          return NextResponse.json({ error: 'catalog, schema, and procedure parameters are required' }, { status: 400 });
        }
        result = await cdata.executeProcedure(
          params.catalog,
          params.schema,
          params.procedure,
          params.parameters
        );
        break;

      case 'testConnection':
        result = await cdata.testConnection();
        break;

      case 'discoverSchema':
        result = await cdata.discoverGoogleSheetsSchema();
        break;

      default:
        return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
    }

    return NextResponse.json({
      tool,
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('CData API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'CData operation failed',
        tool: 'unknown',
        success: false,
      },
      { status: 500 }
    );
  }
}

// GET /api/cdata - Get CData connection status
export async function GET() {
  try {
    const config = getConfig();

    if (!config.cdata.email || !config.cdata.pat) {
      return NextResponse.json({
        configured: false,
        connected: false,
        message: 'CData Connect AI credentials not configured',
        endpoint: config.cdata.endpoint,
      });
    }

    const cdata = getCDataClient();
    const connectionTest = await cdata.testConnection();

    return NextResponse.json({
      configured: true,
      ...connectionTest,
      endpoint: config.cdata.endpoint,
    });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      connected: false,
      message: error instanceof Error ? error.message : 'Connection test failed',
    });
  }
}
