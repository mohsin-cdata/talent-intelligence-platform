import { NextRequest, NextResponse } from 'next/server';
import { getCDataClient, CDataClient } from '@/lib/cdata-client';
import { CDataRestClient, getRestClient } from '@/lib/cdata-rest-client';
import { getConfig } from '@/lib/config';
import { gatewayCheck, recordOutcome, incrementGlobalCounter, persistQuery } from '@/lib/rate-limiter';
import { getSchemaMap } from '@/lib/schema-mapping';
import {
  getCachedSchema,
  getSchemaTier,
  discoverSchemaAtTier,
  upgradeTierInBackground,
} from '@/lib/agents/schema-cache';
import type { SchemaTier } from '@/lib/agents/types';

// Cache for schema data (route-level, separate from schema-cache.ts server cache)
let schemaCache: any = null;
let schemaCacheTime: number = 0;
const SCHEMA_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// GET /api/schema - Get database schema
// Supports ?tier=1|2|3 for progressive discovery
// ?tier=1 returns catalogs only (fastest)
// ?tier=2 returns catalogs + tables
// ?tier=3 returns full schema with columns (default)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';
    const requestedTier = parseInt(searchParams.get('tier') || '3', 10) as SchemaTier;
    const tier: SchemaTier = [1, 2, 3].includes(requestedTier) ? requestedTier : 3;

    const now = Date.now();

    // Return cached schema if available, not expired, and at sufficient tier
    const currentTier = getSchemaTier();
    if (!refresh && schemaCache && now - schemaCacheTime < SCHEMA_CACHE_TTL && currentTier && currentTier >= tier) {
      const schemaMap = getSchemaMap();
      return NextResponse.json({
        ...schemaCache,
        cached: true,
        tier: currentTier,
        cacheAge: Math.round((now - schemaCacheTime) / 1000),
        schemaMapSummary: schemaMap ? {
          subDomain: schemaMap.subDomain,
          tableCount: Object.keys(schemaMap.tables).length,
          entityTypes: [...new Set(Object.values(schemaMap.tables).map(t => t.entityType))],
          timestamp: schemaMap.timestamp,
        } : null,
      });
    }

    const config = getConfig();

    // If CData is not configured, return static schema
    if (!config.cdata.email || !config.cdata.pat) {
      const staticSchema = {
        source: 'static',
        spreadsheetId: config.googleSheets.spreadsheetId,
        tables: [
          {
            name: 'Candidates',
            columns: [
              { name: 'CandidateId', type: 'string' },
              { name: 'FirstName', type: 'string' },
              { name: 'LastName', type: 'string' },
              { name: 'Email', type: 'string' },
              { name: 'Phone', type: 'string' },
              { name: 'Title', type: 'string' },
              { name: 'Summary', type: 'string' },
              { name: 'Skills', type: 'string' },
              { name: 'Certifications', type: 'string' },
              { name: 'YearsExperience', type: 'number' },
              { name: 'Education', type: 'string' },
              { name: 'Degree', type: 'string' },
              { name: 'City', type: 'string' },
              { name: 'State', type: 'string' },
              { name: 'ZipCode', type: 'string' },
              { name: 'Timezone', type: 'string' },
              { name: 'AvailabilityStatus', type: 'string' },
              { name: 'AvailableDate', type: 'date' },
              { name: 'HourlyRate', type: 'number' },
              { name: 'AnnualSalary', type: 'number' },
              { name: 'EmploymentType', type: 'string' },
              { name: 'RemotePreference', type: 'string' },
              { name: 'WillingToRelocate', type: 'boolean' },
              { name: 'Clearance', type: 'string' },
              { name: 'Languages', type: 'string' },
              { name: 'IndustryExperience', type: 'string' },
              { name: 'PlacementCount', type: 'number' },
              { name: 'AvgRating', type: 'number' },
              { name: 'LastContactDate', type: 'date' },
              { name: 'LinkedInUrl', type: 'string' },
              { name: 'RecruiterOwner', type: 'string' },
              { name: 'Source', type: 'string' },
              { name: 'Status', type: 'string' },
            ],
          },
          {
            name: 'JobRequisitions',
            columns: [
              { name: 'ReqId', type: 'string' },
              { name: 'JobTitle', type: 'string' },
              { name: 'ClientName', type: 'string' },
              { name: 'ClientIndustry', type: 'string' },
              { name: 'Department', type: 'string' },
              { name: 'Description', type: 'string' },
              { name: 'Responsibilities', type: 'string' },
              { name: 'Qualifications', type: 'string' },
              { name: 'RequiredSkills', type: 'string' },
              { name: 'NiceToHaveSkills', type: 'string' },
              { name: 'YearsExperienceRequired', type: 'number' },
              { name: 'City', type: 'string' },
              { name: 'State', type: 'string' },
              { name: 'ZipCode', type: 'string' },
              { name: 'Timezone', type: 'string' },
              { name: 'RemoteOption', type: 'string' },
              { name: 'MinRate', type: 'number' },
              { name: 'MaxRate', type: 'number' },
              { name: 'BudgetType', type: 'string' },
              { name: 'PreferredEmploymentType', type: 'string' },
              { name: 'Status', type: 'string' },
              { name: 'Priority', type: 'string' },
              { name: 'Urgency', type: 'string' },
              { name: 'ClearanceRequired', type: 'string' },
              { name: 'InterviewProcess', type: 'string' },
              { name: 'PostedDate', type: 'date' },
              { name: 'TargetStartDate', type: 'date' },
              { name: 'RecruiterOwner', type: 'string' },
              { name: 'SubmittalsCount', type: 'number' },
              { name: 'InterviewsScheduled', type: 'number' },
            ],
          },
          {
            name: 'Placements',
            columns: [
              { name: 'PlacementId', type: 'string' },
              { name: 'CandidateId', type: 'string' },
              { name: 'ReqId', type: 'string' },
              { name: 'ClientName', type: 'string' },
              { name: 'JobTitle', type: 'string' },
              { name: 'StartDate', type: 'date' },
              { name: 'EndDate', type: 'date' },
              { name: 'BillRate', type: 'number' },
              { name: 'PayRate', type: 'number' },
              { name: 'Status', type: 'string' },
              { name: 'RecruiterName', type: 'string' },
              { name: 'Margin', type: 'number' },
              { name: 'ContractType', type: 'string' },
              { name: 'ExtensionCount', type: 'number' },
              { name: 'ClientRating', type: 'number' },
              { name: 'CandidateRating', type: 'number' },
              { name: 'Notes', type: 'string' },
            ],
          },
          {
            name: 'Clients',
            columns: [
              { name: 'ClientId', type: 'string' },
              { name: 'CompanyName', type: 'string' },
              { name: 'Industry', type: 'string' },
              { name: 'City', type: 'string' },
              { name: 'State', type: 'string' },
              { name: 'ContactName', type: 'string' },
              { name: 'ContactEmail', type: 'string' },
              { name: 'ContactPhone', type: 'string' },
              { name: 'ActiveReqs', type: 'number' },
              { name: 'TotalPlacements', type: 'number' },
              { name: 'ContractType', type: 'string' },
              { name: 'PaymentTerms', type: 'string' },
              { name: 'Notes', type: 'string' },
              { name: 'AccountManager', type: 'string' },
              { name: 'ClientSince', type: 'date' },
              { name: 'LastActivityDate', type: 'date' },
            ],
          },
          {
            name: 'Activities',
            columns: [
              { name: 'ActivityId', type: 'string' },
              { name: 'CandidateId', type: 'string' },
              { name: 'ActivityType', type: 'string' },
              { name: 'ActivityDate', type: 'date' },
              { name: 'Notes', type: 'string' },
              { name: 'RecruiterName', type: 'string' },
              { name: 'RelatedReqId', type: 'string' },
              { name: 'Duration', type: 'number' },
              { name: 'Outcome', type: 'string' },
            ],
          },
          {
            name: 'SkillTaxonomy',
            columns: [
              { name: 'SkillId', type: 'string' },
              { name: 'CanonicalName', type: 'string' },
              { name: 'Synonyms', type: 'string' },
              { name: 'Category', type: 'string' },
              { name: 'SubCategory', type: 'string' },
              { name: 'RelatedSkills', type: 'string' },
              { name: 'DemandLevel', type: 'string' },
              { name: 'AverageRate', type: 'number' },
            ],
          },
        ],
      };

      schemaCache = staticSchema;
      schemaCacheTime = now;

      return NextResponse.json({
        ...staticSchema,
        cached: false,
        note: 'Using static schema. Configure CData credentials for dynamic schema discovery.',
      });
    }

    // Gate before hitting CData for dynamic schema
    const gate = gatewayCheck('/api/schema');
    if (!gate.allowed) {
      return NextResponse.json({ error: 'Rate limited', rateLimited: true, reason: gate.reason }, { status: 429 });
    }

    // Progressive tiered discovery
    try {
      const headerEmail = request.headers.get('x-cdata-email');
      const headerPAT = request.headers.get('x-cdata-pat');
      const email = headerEmail || config.cdata.email;
      const pat = headerPAT || config.cdata.pat;

      const rest = new CDataRestClient(email, pat);
      const mcp: CDataClient = (headerEmail && headerPAT)
        ? new CDataClient(headerEmail, headerPAT)
        : getCDataClient();

      const startTime = Date.now();
      const discovered = await discoverSchemaAtTier(tier, rest, mcp);
      const duration = Date.now() - startTime;

      // If we got a lower tier, trigger background upgrade to tier 3
      if (discovered.tier < 3) {
        upgradeTierInBackground(3, rest, mcp).catch(() => {});
      }

      // Format response
      const catalogDetails = discovered.catalogs.map(catalog => {
        const schemas = discovered.schemas[catalog] || [];
        const schemasWithTables = schemas.map(schemaName => {
          const tableKey = `${catalog}.${schemaName}`;
          const tables = (discovered.tables[tableKey] || []).map(name => ({
            name,
            displayName: name.replace(/^[ _]+/, '').replace(/_/g, ' '),
            hasColumns: !!discovered.columns[`${catalog}.${schemaName}.${name}`]?.length,
          }));
          return { schema: schemaName, tables };
        });
        return {
          catalog,
          schemas: schemasWithTables,
          tableCount: schemasWithTables.reduce((sum, s) => sum + s.tables.length, 0),
        };
      });

      const schemaMapObj = getSchemaMap();
      const dynamicSchema = {
        source: 'cdata',
        tier: discovered.tier,
        catalogs: catalogDetails,
        totalCatalogs: catalogDetails.length,
        totalTables: catalogDetails.reduce((sum, c) => sum + c.tableCount, 0),
        discoveryDuration: duration,
        schemaMapSummary: schemaMapObj ? {
          subDomain: schemaMapObj.subDomain,
          tableCount: Object.keys(schemaMapObj.tables).length,
          entityTypes: [...new Set(Object.values(schemaMapObj.tables).map(t => t.entityType))],
          timestamp: schemaMapObj.timestamp,
        } : null,
      };

      schemaCache = dynamicSchema;
      schemaCacheTime = now;

      recordOutcome('/api/schema', true);
      incrementGlobalCounter();
      persistQuery({ ts: Date.now(), route: '/api/schema', status: 'success' });
      return NextResponse.json({ ...dynamicSchema, cached: false });
    } catch (schemaError) {
      recordOutcome('/api/schema', false);
      persistQuery({ ts: Date.now(), route: '/api/schema', status: 'error' });
      throw schemaError;
    }
  } catch (error) {
    console.error('Schema API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get schema' },
      { status: 500 }
    );
  }
}
