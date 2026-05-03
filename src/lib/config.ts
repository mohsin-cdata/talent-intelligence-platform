// Configuration management for Talent Intelligence Platform

import { LLMProvider } from '@/types';

export interface AppConfig {
  // OpenAI
  openai: {
    apiKey: string;
    model: string;
    maxTokens: number;
  };
  // Groq (Free tier)
  groq: {
    apiKey: string;
    model: string;
  };
  // DeepSeek
  deepseek: {
    apiKey: string;
    model: string;
  };
  // LLM settings (which provider to use)
  llm: {
    provider: LLMProvider;
    model: string;
  };
  // CData Connect AI
  cdata: {
    endpoint: string;
    email: string;
    pat: string;
    workspaceId?: string;
    authHeader: string;
  };
  // Google Sheets
  googleSheets: {
    spreadsheetId: string;
    tables: string[];
  };
  // Limits
  limits: {
    dailyTokenLimit: number;
    warnTokenThreshold: number;
  };
  // Features
  features: {
    enableWriteOperations: boolean;
    enableSQLPreview: boolean;
    enableActivityLogging: boolean;
  };
  // App
  app: {
    name: string;
    version: string;
  };
}

// Get configuration from environment variables
export function getConfig(): AppConfig {
  const email = process.env.CDATA_EMAIL || '';
  const pat = process.env.CDATA_PAT || '';

  // Create Basic Auth header from email:PAT
  const authString = `${email}:${pat}`;
  const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;

  // Determine which provider to use - default to Groq (free)
  const llmProvider = (process.env.LLM_PROVIDER || 'groq') as LLMProvider;
  const defaultModel = llmProvider === 'groq'
    ? 'llama-3.3-70b-versatile'
    : llmProvider === 'deepseek'
    ? 'deepseek-chat'
    : 'gpt-4-turbo-preview';

  return {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      maxTokens: 4096,
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY || '',
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    },
    llm: {
      provider: llmProvider,
      model: process.env.LLM_MODEL || defaultModel,
    },
    cdata: {
      endpoint: process.env.CDATA_MCP_ENDPOINT || 'https://mcp.cloud.cdata.com/mcp',
      email,
      pat,
      workspaceId: process.env.CDATA_WORKSPACE_ID,
      authHeader,
    },
    googleSheets: {
      spreadsheetId: process.env.GOOGLE_SHEETS_ID || '',
      tables: (process.env.GOOGLE_SHEETS_TABLES || 'Candidates,JobRequisitions,Placements,Clients,Activities,SkillTaxonomy').split(','),
    },
    limits: {
      dailyTokenLimit: parseInt(process.env.DAILY_TOKEN_LIMIT || '100000', 10),
      warnTokenThreshold: parseInt(process.env.WARN_TOKEN_THRESHOLD || '80000', 10),
    },
    features: {
      enableWriteOperations: process.env.ENABLE_WRITE_OPERATIONS === 'true',
      enableSQLPreview: process.env.ENABLE_SQL_PREVIEW !== 'false',
      enableActivityLogging: process.env.ENABLE_ACTIVITY_LOGGING !== 'false',
    },
    app: {
      name: process.env.NEXT_PUBLIC_APP_NAME || 'Talent Intelligence Platform',
      version: process.env.NEXT_PUBLIC_APP_VERSION || '2.0.0',
    },
  };
}

// Validate required configuration
export function validateConfig(config: AppConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check LLM API key based on provider
  if (config.llm.provider === 'openai' && !config.openai.apiKey) {
    errors.push('OPENAI_API_KEY is required when using OpenAI provider');
  }
  if (config.llm.provider === 'groq' && !config.groq.apiKey) {
    errors.push('GROQ_API_KEY is required when using Groq provider (get free key at console.groq.com)');
  }
  if (config.llm.provider === 'deepseek' && !config.deepseek.apiKey) {
    errors.push('DEEPSEEK_API_KEY is required when using DeepSeek provider');
  }

  if (!config.cdata.email || !config.cdata.pat) {
    errors.push('CDATA_EMAIL and CDATA_PAT are required for CData Connect AI authentication');
  }

  if (!config.googleSheets.spreadsheetId) {
    errors.push('GOOGLE_SHEETS_ID is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Client-safe config (no secrets)
export interface ClientConfig {
  app: {
    name: string;
    version: string;
  };
  features: {
    enableWriteOperations: boolean;
    enableSQLPreview: boolean;
  };
  limits: {
    dailyTokenLimit: number;
    warnTokenThreshold: number;
  };
  dataSources: {
    googleSheets: {
      connected: boolean;
      tables: string[];
    };
    cdata: {
      connected: boolean;
      endpoint: string;
    };
  };
}

export function getClientConfig(): ClientConfig {
  const config = getConfig();

  return {
    app: config.app,
    features: {
      enableWriteOperations: config.features.enableWriteOperations,
      enableSQLPreview: config.features.enableSQLPreview,
    },
    limits: config.limits,
    dataSources: {
      googleSheets: {
        connected: !!config.googleSheets.spreadsheetId,
        tables: config.googleSheets.tables,
      },
      cdata: {
        connected: !!(config.cdata.email && config.cdata.pat),
        endpoint: config.cdata.endpoint,
      },
    },
  };
}
