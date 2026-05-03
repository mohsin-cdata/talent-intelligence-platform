// Schema Mapping Engine - Deterministic pattern-based schema mapping for HR/talent data
// No LLM calls. Pure vocabulary scoring + pattern matching.
//
// Detects HR sub-domain (staffing, ats, hris, generic_hr, generic)
// Maps columns to semantic roles (primary_id, primary_name, email, status, etc.)
// Resolves pipeline stages to 6 canonical stages with platform aliases
// Supports PascalCase, camelCase, snake_case, SCREAMING_SNAKE

import { CachedSchema } from './agents/types';
import {
  HRSubDomain,
  CanonicalStage,
  SemanticRole,
  EntityType,
  ColumnMapping,
  TableMap,
  SchemaMap,
} from './agents/types';

// ── Name Normalization ──
// Converts any casing convention to lowercase word array

export function normalizeColumnName(name: string): string[] {
  // SCREAMING_SNAKE: FIRST_NAME -> ['first', 'name']
  if (name === name.toUpperCase() && name.includes('_')) {
    return name.toLowerCase().split('_').filter(Boolean);
  }
  // snake_case: first_name -> ['first', 'name']
  if (name.includes('_')) {
    return name.toLowerCase().split('_').filter(Boolean);
  }
  // PascalCase/camelCase: FirstName / firstName -> ['first', 'name']
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

// ── Sub-Domain Detection ──
// Vocabulary scoring to detect which HR domain the schema belongs to

const SUBDOMAIN_VOCAB: Record<HRSubDomain, string[]> = {
  staffing: [
    'placement', 'bill rate', 'pay rate', 'margin', 'contract type',
    'extension', 'submittal', 'client rating', 'recruiter owner',
    'availability status', 'hourly rate', 'bench', 'w2', 'c2c', '1099',
    'requisition', 'fill', 'time to fill', 'spread',
  ],
  ats: [
    'application', 'applicant', 'resume', 'cover letter', 'pipeline',
    'stage', 'workflow', 'screening', 'offer letter', 'onboarding',
    'rejection', 'referral', 'source', 'career page', 'job posting',
    'hiring manager', 'interview', 'scorecard',
  ],
  hris: [
    'employee', 'department', 'manager', 'payroll', 'benefits',
    'leave', 'attendance', 'performance review', 'compensation',
    'termination', 'promotion', 'training', 'compliance',
    'org chart', 'headcount', 'fte', 'pto',
  ],
  generic_hr: [
    'candidate', 'job', 'skill', 'experience', 'education',
    'salary', 'location', 'status', 'activity', 'note',
    'contact', 'phone', 'email',
  ],
  generic: [],
};

export function detectHRSubDomain(cache: CachedSchema): HRSubDomain {
  // Collect all column names and table names
  const allNames: string[] = [];
  for (const tables of Object.values(cache.tables)) {
    for (const table of tables) {
      allNames.push(...normalizeColumnName(table));
    }
  }
  for (const columns of Object.values(cache.columns)) {
    for (const col of columns) {
      allNames.push(...normalizeColumnName(col.name));
    }
  }

  const corpus = allNames.join(' ');

  const scores: Record<HRSubDomain, number> = {
    staffing: 0, ats: 0, hris: 0, generic_hr: 0, generic: 0,
  };

  for (const [domain, vocab] of Object.entries(SUBDOMAIN_VOCAB) as [HRSubDomain, string[]][]) {
    for (const term of vocab) {
      const words = term.split(' ');
      if (words.every(w => corpus.includes(w))) {
        scores[domain]++;
      }
    }
  }

  // Find highest
  let best: HRSubDomain = 'generic';
  let bestScore = 0;
  for (const [domain, score] of Object.entries(scores) as [HRSubDomain, number][]) {
    if (score > bestScore) {
      bestScore = score;
      best = domain;
    }
  }

  // If generic_hr ties with generic, prefer generic_hr
  if (best === 'generic' && scores.generic_hr > 0) {
    best = 'generic_hr';
  }

  return best;
}

// ── Entity Type Detection ──

const ENTITY_PATTERNS: Record<EntityType, string[]> = {
  person: ['candidate', 'applicant', 'employee', 'contact', 'person', 'worker', 'consultant', 'contractor'],
  job: ['job', 'requisition', 'position', 'opening', 'posting', 'vacancy', 'req'],
  placement: ['placement', 'assignment', 'engagement', 'booking', 'deployment'],
  activity: ['activity', 'event', 'log', 'action', 'note', 'communication', 'interaction', 'touchpoint'],
  organization: ['client', 'company', 'organization', 'account', 'firm', 'employer', 'vendor'],
  generic: [],
};

function detectEntityType(tableName: string): EntityType {
  const words = normalizeColumnName(tableName).join(' ');
  let best: EntityType = 'generic';
  let bestCount = 0;

  for (const [entity, patterns] of Object.entries(ENTITY_PATTERNS) as [EntityType, string[]][]) {
    const count = patterns.filter(p => words.includes(p)).length;
    if (count > bestCount) {
      bestCount = count;
      best = entity;
    }
  }

  return best;
}

// ── Semantic Role Mapping ──
// Pattern banks for column-to-role inference

interface RolePattern {
  role: SemanticRole;
  patterns: string[][];  // each inner array is a set of words that must ALL appear
  boost?: EntityType[];  // boost confidence for these entity types
}

const ROLE_PATTERNS: RolePattern[] = [
  // Names (before IDs, so "name" in compound columns is checked first)
  { role: 'primary_name', patterns: [['first', 'name'], ['given', 'name'], ['full', 'name']] },
  { role: 'secondary_name', patterns: [['last', 'name'], ['surname'], ['family', 'name']] },

  // Title/description
  { role: 'title', patterns: [['title'], ['job', 'title'], ['position', 'title'], ['headline']] },
  { role: 'description', patterns: [['description'], ['summary'], ['bio'], ['overview'], ['about']] },

  // Contact
  { role: 'email', patterns: [['email'], ['e', 'mail'], ['email', 'address']] },
  { role: 'phone', patterns: [['phone'], ['mobile'], ['telephone'], ['cell']] },
  { role: 'url', patterns: [['url'], ['link'], ['linkedin'], ['website'], ['profile', 'url']] },

  // Location
  { role: 'city', patterns: [['city'], ['town'], ['municipality']] },
  { role: 'state', patterns: [['state'], ['province'], ['region']] },
  { role: 'zip', patterns: [['zip'], ['zip', 'code'], ['postal'], ['postal', 'code']] },

  // Status/category
  { role: 'status', patterns: [['status'], ['availability', 'status'], ['state'], ['stage']] },
  { role: 'category', patterns: [['category'], ['type'], ['classification'], ['group']] },

  // Numeric
  { role: 'rate', patterns: [['rate'], ['hourly', 'rate'], ['bill', 'rate'], ['pay', 'rate'], ['salary']] },
  { role: 'rating', patterns: [['rating'], ['score'], ['rank']] },
  { role: 'experience', patterns: [['experience'], ['years', 'experience'], ['tenure']] },
  { role: 'amount', patterns: [['amount'], ['total'], ['count'], ['margin']] },

  // Dates
  { role: 'date_created', patterns: [['created'], ['date', 'added'], ['created', 'at'], ['added', 'date']] },
  { role: 'date_modified', patterns: [['modified'], ['updated'], ['last', 'modified'], ['updated', 'at']] },
  { role: 'date_start', patterns: [['start', 'date'], ['begin', 'date'], ['from', 'date'], ['posted', 'date']] },
  { role: 'date_end', patterns: [['end', 'date'], ['expiry'], ['close', 'date'], ['target', 'date']] },

  // Relationships
  { role: 'tags', patterns: [['skills'], ['tags'], ['keywords'], ['certifications'], ['languages']] },
  { role: 'parent_id', patterns: [['parent', 'id']] },
  { role: 'owner', patterns: [['owner'], ['recruiter'], ['assigned'], ['manager'], ['account', 'manager']] },
];

function mapColumnRole(
  colName: string,
  entityType: EntityType,
  colIndex: number,
  totalColumns: number,
  tableName: string,
): ColumnMapping | null {
  const words = normalizeColumnName(colName);
  const wordStr = words.join(' ');
  const tableWords = normalizeColumnName(tableName).join(' ');

  // Special handling for ID columns
  if (words[words.length - 1] === 'id') {
    // Check if this is the table's own ID (e.g., CandidateId in Candidates table)
    // or a foreign key (e.g., CandidateId in Placements table)
    const idPrefix = words.slice(0, -1).join(' '); // e.g., 'candidate' from 'candidate id'
    const isOwnId = colIndex === 0 || tableWords.includes(idPrefix) || words.length === 1;

    if (isOwnId) {
      return { role: 'primary_id', columnName: colName, confidence: 0.95 };
    } else {
      return { role: 'parent_id', columnName: colName, confidence: 0.85 };
    }
  }

  let bestRole: SemanticRole | null = null;
  let bestConfidence = 0;

  for (const rp of ROLE_PATTERNS) {
    for (const pattern of rp.patterns) {
      const allMatch = pattern.every(p => wordStr.includes(p));
      if (!allMatch) continue;

      // Base confidence from pattern specificity
      let confidence = pattern.length / words.length;

      // Exact match bonus
      if (pattern.length === words.length) {
        confidence = Math.min(confidence + 0.2, 1.0);
      }

      // Entity type boost
      if (rp.boost && rp.boost.includes(entityType)) {
        confidence = Math.min(confidence + 0.1, 1.0);
      }

      // Avoid false 'status' for 'availability_status' etc.
      if (rp.role === 'status' && wordStr === 'state' && entityType !== 'generic') {
        confidence *= 0.5; // 'state' is ambiguous (US state vs status)
      }

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestRole = rp.role;
      }
    }
  }

  if (!bestRole || bestConfidence < 0.2) return null;

  return {
    role: bestRole,
    columnName: colName,
    confidence: Math.round(bestConfidence * 100) / 100,
  };
}

// ── Table Mapping ──

export function mapTableColumns(
  tableName: string,
  columns: { name: string; type: string }[],
  subDomain: HRSubDomain,
  fullyQualifiedName: string,
): TableMap {
  const entityType = detectEntityType(tableName);
  const mappings: ColumnMapping[] = [];
  const usedRoles = new Set<SemanticRole>();

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const mapping = mapColumnRole(col.name, entityType, i, columns.length, tableName);
    if (mapping && !usedRoles.has(mapping.role)) {
      mappings.push(mapping);
      usedRoles.add(mapping.role);
    }
  }

  // Second pass: assign 'primary_name' to 'title' for job entities if missing
  if (entityType === 'job' && !usedRoles.has('primary_name') && usedRoles.has('title')) {
    // title IS the primary name for jobs
    const titleMapping = mappings.find(m => m.role === 'title');
    if (titleMapping) {
      mappings.push({ role: 'primary_name', columnName: titleMapping.columnName, confidence: 0.7 });
    }
  }

  // For organizations, company name is primary name
  if (entityType === 'organization' && !usedRoles.has('primary_name')) {
    const companyCol = columns.find(c => {
      const w = normalizeColumnName(c.name).join(' ');
      return w.includes('company') || w.includes('organization') || w.includes('firm');
    });
    if (companyCol) {
      mappings.push({ role: 'primary_name', columnName: companyCol.name, confidence: 0.8 });
    }
  }

  return {
    fullyQualifiedName,
    entityType,
    columns: mappings,
    subDomain,
  };
}

// ── Schema Map Builder ──

export function buildSchemaMap(cache: CachedSchema): SchemaMap {
  const subDomain = detectHRSubDomain(cache);
  const tables: Record<string, TableMap> = {};

  for (const catalog of cache.catalogs) {
    const schemas = cache.schemas[catalog] || [];
    for (const schema of schemas) {
      const tableKey = `${catalog}.${schema}`;
      const tableNames = cache.tables[tableKey] || [];

      for (const table of tableNames) {
        const colKey = `${catalog}.${schema}.${table}`;
        const columns = cache.columns[colKey] || [];
        const fqn = `[${catalog}].[${schema}].[${table}]`;

        tables[fqn] = mapTableColumns(table, columns, subDomain, fqn);
      }
    }
  }

  return {
    tables,
    subDomain,
    timestamp: Date.now(),
  };
}

// ── Accessor Helpers ──

export function getColumnByRole(tableMap: TableMap, role: SemanticRole): string | null {
  const mapping = tableMap.columns.find(c => c.role === role);
  return mapping ? mapping.columnName : null;
}

export function getDisplayName(row: Record<string, any>, tableMap: TableMap): string {
  const firstName = getColumnByRole(tableMap, 'primary_name');
  const lastName = getColumnByRole(tableMap, 'secondary_name');
  const title = getColumnByRole(tableMap, 'title');

  if (firstName && lastName && row[firstName] && row[lastName]) {
    return `${row[firstName]} ${row[lastName]}`;
  }
  if (firstName && row[firstName]) {
    return String(row[firstName]);
  }
  if (title && row[title]) {
    return String(row[title]);
  }

  // Fallback: first non-id string value
  for (const mapping of tableMap.columns) {
    if (mapping.role !== 'primary_id' && row[mapping.columnName]) {
      return String(row[mapping.columnName]);
    }
  }

  return 'Unknown';
}

// ── Pipeline Stage Resolution ──

const STAGE_ALIASES: Record<CanonicalStage, string[]> = {
  sourced: ['sourced', 'new', 'identified', 'prospect', 'lead', 'passive', 'cold'],
  screening: ['screening', 'screened', 'phone screen', 'pre-screen', 'reviewed', 'qualified', 'active'],
  submitted: ['submitted', 'submittal', 'presented', 'sent to client', 'client review', 'shortlisted'],
  interview: ['interview', 'interviewed', 'meeting', 'technical interview', 'panel', 'onsite', 'final round'],
  offer: ['offer', 'offered', 'negotiation', 'offer extended', 'pending offer', 'accepted'],
  placed: ['placed', 'hired', 'onboarded', 'started', 'active placement', 'deployed', 'engaged'],
};

export function resolveStage(value: string, _subDomain?: HRSubDomain): CanonicalStage | null {
  if (!value) return null;
  const lower = value.toLowerCase().trim();

  for (const [stage, aliases] of Object.entries(STAGE_ALIASES) as [CanonicalStage, string[]][]) {
    if (aliases.some(a => lower === a || lower.includes(a))) {
      return stage;
    }
  }

  return null;
}

// ── Module-Level Cache ──

let cachedSchemaMap: SchemaMap | null = null;

export function getSchemaMap(): SchemaMap | null {
  return cachedSchemaMap;
}

export function setSchemaMap(map: SchemaMap): void {
  cachedSchemaMap = map;
}

export function clearSchemaMap(): void {
  cachedSchemaMap = null;
}
