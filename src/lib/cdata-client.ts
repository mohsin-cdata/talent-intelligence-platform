// CData Connect AI MCP Client
// Handles all interactions with CData's MCP endpoint

import { getConfig } from './config';

// CRITICAL: Table names have a LEADING SPACE due to spreadsheet naming
export const CDATA_CATALOG = 'Talent_Intelligence_Platform';
export const CDATA_SCHEMA = 'GoogleSheets';

// Table names with leading space (THIS IS REQUIRED)
export const CDATA_TABLES = {
  candidates: ' Talent Intelligence Platform Data_Candidates',
  jobs: ' Talent Intelligence Platform Data_JobRequisitions',
  placements: ' Talent Intelligence Platform Data_Placements',
  clients: ' Talent Intelligence Platform Data_Clients',
  activities: ' Talent Intelligence Platform Data_Activities',
  skills: ' Talent Intelligence Platform Data_SkillTaxonomy',
} as const;

// Helper to get fully qualified table name
export function getFullTableName(tableKey: keyof typeof CDATA_TABLES): string {
  return `[${CDATA_CATALOG}].[${CDATA_SCHEMA}].[${CDATA_TABLES[tableKey]}]`;
}

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, any>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class CDataClient {
  private endpoint: string;
  private authHeader: string;
  private requestId: number = 0;
  private initialized: boolean = false;

  constructor(email?: string, pat?: string, endpoint?: string) {
    if (email && pat) {
      // Per-user credentials (from headers)
      this.endpoint = endpoint || 'https://mcp.cloud.cdata.com/mcp';
      const authString = `${email}:${pat}`;
      this.authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;
    } else {
      // Environment credentials (from .env)
      const config = getConfig();
      this.endpoint = config.cdata.endpoint;
      this.authHeader = config.cdata.authHeader;
    }
  }

  private generateRequestId(): number {
    return ++this.requestId;
  }

  private async sendRequest(method: string, params?: Record<string, any>): Promise<any> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.generateRequestId(),
      method,
      params,
    };

    const startTime = Date.now();

    try {
      // CData MCP requires BOTH application/json AND text/event-stream in Accept header
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Authorization': this.authHeader,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorText}`);
      }

      // Handle both JSON and SSE responses
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        // Parse SSE response
        const text = await response.text();
        const lines = text.split('\n');
        let result = null;
        let error = null;

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.result !== undefined) {
                result = data.result;
              }
              if (data.error) {
                error = data.error;
              }
            } catch (e) {
              // Continue parsing
            }
          }
        }

        if (error) {
          throw new Error(`MCP Error ${error.code}: ${error.message}`);
        }

        return {
          result,
          duration: Date.now() - startTime,
        };
      }

      // Try to parse as JSON
      const text = await response.text();

      // Handle empty response
      if (!text.trim()) {
        return {
          result: null,
          duration: Date.now() - startTime,
        };
      }

      const data: MCPResponse = JSON.parse(text);

      if (data.error) {
        throw new Error(`MCP Error ${data.error.code}: ${data.error.message}`);
      }

      return {
        result: data.result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // MCP Standard Methods
  // ============================================

  /**
   * Initialize MCP connection
   */
  async initialize(): Promise<{ capabilities: any; duration: number }> {
    const { result, duration } = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'Talent Intelligence Platform',
        version: '2.0.0',
      },
    });
    return { capabilities: result, duration };
  }

  /**
   * List available tools
   */
  async listTools(): Promise<{ tools: any[]; duration: number }> {
    const { result, duration } = await this.sendRequest('tools/list', {});
    return { tools: result?.tools || [], duration };
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: Record<string, any> = {}): Promise<{ result: any; duration: number }> {
    const { result, duration } = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });
    return { result, duration };
  }

  // ============================================
  // CData-Specific Tool Methods
  // ============================================

  /**
   * Get available catalogs (data sources)
   */
  /**
   * Unwrap MCP tool text response.
   * CData MCP returns CSV data as a JSON-encoded string (quoted CSV with \r\n).
   * e.g., text = '"COL1,COL2\r\nval1,val2\r\n"'
   * This method unwraps the outer quotes and normalizes line endings.
   */
  private unwrapText(text: string): string {
    if (!text) return '';
    // If the text is a JSON-encoded string (starts and ends with "), unwrap it
    if (text.startsWith('"') && text.endsWith('"')) {
      try {
        const unwrapped = JSON.parse(text);
        if (typeof unwrapped === 'string') return unwrapped;
      } catch {}
    }
    return text;
  }

  /**
   * Parse CSV text into rows of string arrays, handling \r\n and quoted fields.
   */
  private parseCSV(text: string): { headers: string[]; rows: string[][] } {
    const unwrapped = this.unwrapText(text);
    const lines = unwrapped.split(/\r?\n/).filter((line: string) => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = lines[0].split(',').map((h: string) => h.trim().replace(/^["']|["']$/g, ''));
    const rows = lines.slice(1).map((line: string) =>
      line.split(',').map((cell: string) => cell.trim().replace(/^["']|["']$/g, ''))
    );
    return { headers, rows };
  }

  async getCatalogs(): Promise<{ catalogs: string[]; duration: number }> {
    const { result, duration } = await this.callTool('getCatalogs', {
      llmContext: { provider: 'anthropic', model: 'claude-opus-4-6', reason: 'Discover available data sources' },
    });

    const text = result?.content?.[0]?.text || '';
    if (!text) return { catalogs: [], duration };

    // Parse CSV (MCP returns quoted CSV)
    const { headers, rows } = this.parseCSV(text);
    const catalogIdx = headers.findIndex((h: string) => h.toUpperCase().includes('CATALOG'));
    const idx = catalogIdx >= 0 ? catalogIdx : 0;

    const catalogs = rows
      .map((row: string[]) => row[idx] || '')
      .filter((name: string) => name && name !== 'CData');

    console.log(`[CData getCatalogs] Found ${catalogs.length} catalogs:`, catalogs.slice(0, 5), '...');
    return { catalogs, duration };
  }

  /**
   * Get schemas for a catalog
   */
  async getSchemas(catalog: string): Promise<{ schemas: string[]; duration: number }> {
    const { result, duration } = await this.callTool('getSchemas', { catalogName: catalog });
    const text = result?.content?.[0]?.text || '';
    if (!text) return { schemas: [], duration };

    const { headers, rows } = this.parseCSV(text);
    const schemaIdx = headers.findIndex((h: string) => h.toUpperCase().includes('SCHEM'));
    const idx = schemaIdx >= 0 ? schemaIdx : (headers.length > 1 ? 1 : 0);

    const schemas = rows
      .map((row: string[]) => row[idx] || '')
      .filter((s: string) => s);

    console.log(`[CData getSchemas] ${catalog} has schemas:`, schemas);
    return { schemas, duration };
  }

  /**
   * Get tables for a schema
   */
  async getTables(catalog: string, schema: string): Promise<{ tables: string[]; duration: number }> {
    const { result, duration } = await this.callTool('getTables', { catalogName: catalog, schemaName: schema });
    const text = result?.content?.[0]?.text || '';
    if (!text) return { tables: [], duration };

    const { headers, rows } = this.parseCSV(text);
    const tableIdx = headers.findIndex((h: string) => h.toUpperCase().includes('TABLE_NAME'));
    const idx = tableIdx >= 0 ? tableIdx : (headers.length > 2 ? 2 : 0);

    const tables = rows
      .map((row: string[]) => row[idx] || '')
      .filter((t: string) => t);

    console.log(`[CData getTables] ${catalog}.${schema} has ${tables.length} tables`);
    return { tables, duration };
  }

  /**
   * Get columns for a table
   */
  async getColumns(
    catalog: string,
    schema: string,
    table: string
  ): Promise<{ columns: Array<{ name: string; type: string }>; duration: number }> {
    const { result, duration } = await this.callTool('getColumns', {
      catalogName: catalog,
      schemaName: schema,
      tableName: table,
    });
    const text = result?.content?.[0]?.text || '';
    if (!text) return { columns: [], duration };

    const { headers, rows } = this.parseCSV(text);
    const nameIdx = headers.findIndex((h: string) => h.toUpperCase().includes('COLUMN_NAME'));
    const typeIdx = headers.findIndex((h: string) => h.toUpperCase().includes('TYPE_NAME') || h.toUpperCase().includes('DATA_TYPE'));
    const nIdx = nameIdx >= 0 ? nameIdx : 0;
    const tIdx = typeIdx >= 0 ? typeIdx : 1;

    const columns = rows.map((row: string[]) => ({
      name: row[nIdx] || '',
      type: row[tIdx] || 'VARCHAR',
    })).filter((c: { name: string }) => c.name);

    return { columns, duration };
  }

  /**
   * Execute a SQL query
   * CData requires llmContext and returns {results: [{schema: [], rows: [[]]}]}
   */
  async queryData(
    query: string,
    reason: string = 'Talent Intelligence Platform query'
  ): Promise<{ rows: any[]; schema: any[]; rowCount: number; duration: number }> {
    const { result, duration } = await this.callTool('queryData', {
      query,
      llmContext: {
        provider: 'openai',
        model: 'gpt-4',
        reason,
      },
    });

    // Parse the nested response format: {results: [{schema: [], rows: [[]]}]}
    const text = result?.content?.[0]?.text;
    if (!text) {
      return { rows: [], schema: [], rowCount: 0, duration };
    }

    try {
      const parsed = JSON.parse(text);
      const resultData = parsed.results?.[0] || {};
      const schema = resultData.schema || [];
      const rawRows = resultData.rows || [];

      // Convert array-of-arrays to array-of-objects using schema
      const rows = rawRows.map((row: any[]) => {
        const obj: Record<string, any> = {};
        schema.forEach((col: { columnName: string }, i: number) => {
          obj[col.columnName] = row[i];
        });
        return obj;
      });

      return {
        rows,
        schema,
        rowCount: rows.length,
        duration,
      };
    } catch (e) {
      console.error('[CData] Failed to parse queryData response:', e, text);
      return { rows: [], schema: [], rowCount: 0, duration };
    }
  }

  /**
   * Get procedures for a schema
   */
  async getProcedures(
    catalog: string,
    schema: string
  ): Promise<{ procedures: string[]; duration: number }> {
    const { result, duration } = await this.callTool('getProcedures', { catalog, schema });
    return { procedures: result?.content?.[0]?.text ? JSON.parse(result.content[0].text) : [], duration };
  }

  /**
   * Get parameters for a procedure
   */
  async getProcedureParameters(
    catalog: string,
    schema: string,
    procedure: string
  ): Promise<{ parameters: Array<{ name: string; type: string; mode: string }>; duration: number }> {
    const { result, duration } = await this.callTool('getProcedureParameters', { catalog, schema, procedure });
    return { parameters: result?.content?.[0]?.text ? JSON.parse(result.content[0].text) : [], duration };
  }

  /**
   * Execute a stored procedure
   */
  async executeProcedure(
    catalog: string,
    schema: string,
    procedure: string,
    parameters?: Record<string, any>
  ): Promise<{ result: any; duration: number }> {
    const { result, duration } = await this.callTool('executeProcedure', {
      catalog,
      schema,
      procedure,
      parameters: parameters || {},
    });
    return { result: result?.content?.[0]?.text ? JSON.parse(result.content[0].text) : null, duration };
  }

  /**
   * Discover Google Sheets schema
   */
  async discoverGoogleSheetsSchema(): Promise<{
    catalog: string;
    schema: string;
    tables: Array<{ name: string; columns: Array<{ name: string; type: string }> }>;
    duration: number;
  }> {
    const startTime = Date.now();

    try {
      // First get catalogs to find Google Sheets
      const { catalogs } = await this.getCatalogs();

      // Look for a Google Sheets catalog
      const gsheetsCatalog = catalogs.find(
        (c: string) => c.toLowerCase().includes('google') || c.toLowerCase().includes('sheets')
      ) || catalogs[0];

      if (!gsheetsCatalog) {
        return {
          catalog: '',
          schema: '',
          tables: [],
          duration: Date.now() - startTime,
        };
      }

      // Get schemas
      const { schemas } = await this.getSchemas(gsheetsCatalog);
      const schema = schemas[0] || '';

      if (!schema) {
        return {
          catalog: gsheetsCatalog,
          schema: '',
          tables: [],
          duration: Date.now() - startTime,
        };
      }

      // Get tables
      const { tables } = await this.getTables(gsheetsCatalog, schema);

      // Get columns for each table
      const tablesWithColumns = await Promise.all(
        tables.map(async (tableName: string) => {
          const { columns } = await this.getColumns(gsheetsCatalog, schema, tableName);
          return { name: tableName, columns };
        })
      );

      return {
        catalog: gsheetsCatalog,
        schema,
        tables: tablesWithColumns,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Test connection to CData Connect AI
   */
  async testConnection(): Promise<{ connected: boolean; message: string; duration: number }> {
    const startTime = Date.now();

    try {
      // Try to initialize first
      await this.initialize();
      this.initialized = true;

      // Then list tools to verify connection
      const { tools } = await this.listTools();

      return {
        connected: true,
        message: `Connected successfully. Found ${tools.length} tool(s).`,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if this is a 406 error - might need different Accept header
      if (errorMessage.includes('406')) {
        try {
          // Try alternative approach with simplified request
          const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': this.authHeader,
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'initialize',
              params: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'Talent Intelligence Platform', version: '2.0.0' },
              },
            }),
          });

          if (response.ok) {
            return {
              connected: true,
              message: 'Connected successfully (alternative method).',
              duration: Date.now() - startTime,
            };
          }
        } catch (e) {
          // Continue to fallback
        }
      }

      // If MCP methods fail, try a simple HTTP test
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.authHeader,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'ping',
          }),
        });

        if (response.ok) {
          return {
            connected: true,
            message: 'Endpoint reachable via ping.',
            duration: Date.now() - startTime,
          };
        }

        if (response.status === 401) {
          return {
            connected: false,
            message: 'Authentication failed. Please check your email and PAT credentials.',
            duration: Date.now() - startTime,
          };
        }

        if (response.status === 403) {
          return {
            connected: false,
            message: 'Access denied. Your credentials may not have permission to access this endpoint.',
            duration: Date.now() - startTime,
          };
        }
      } catch (e) {
        // Ignore
      }

      return {
        connected: false,
        message: errorMessage,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Simple connectivity check without full MCP handshake
   */
  async ping(): Promise<{ reachable: boolean; message: string; duration: number }> {
    const startTime = Date.now();

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': this.authHeader,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        }),
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        return {
          reachable: true,
          message: `Endpoint responded in ${duration}ms`,
          duration,
        };
      }

      return {
        reachable: false,
        message: `HTTP ${response.status}: ${response.statusText}`,
        duration,
      };
    } catch (error) {
      return {
        reachable: false,
        message: error instanceof Error ? error.message : 'Request failed',
        duration: Date.now() - startTime,
      };
    }
  }
}

// Singleton instance
let cdataClient: CDataClient | null = null;

export function getCDataClient(): CDataClient {
  if (!cdataClient) {
    cdataClient = new CDataClient();
  }
  return cdataClient;
}

// Set client for per-request credentials (LangGraph nodes use getCDataClient())
export function setCDataClient(client: CDataClient): void {
  cdataClient = client;
}
