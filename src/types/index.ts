// Core domain types for Talent Intelligence Platform

export type AvailabilityStatus = 'Active' | 'Passive' | 'Placed' | 'Bench';
export type EmploymentType = 'W2' | 'C2C' | '1099';
export type RemotePreference = 'On-site' | 'Hybrid' | 'Remote';
export type JobStatus = 'Open' | 'Filled' | 'Closed' | 'On Hold';
export type Priority = 'High' | 'Medium' | 'Low';
export type Urgency = 'Immediate' | '1-2 Weeks' | '30 Days' | 'Flexible';

export interface Candidate {
  candidateId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  summary: string;
  skills: string[];
  certifications: string[];
  yearsExperience: number;
  education: string;
  degree: string;
  city: string;
  state: string;
  zipCode: string;
  timezone: string;
  availabilityStatus: AvailabilityStatus;
  availableDate: string;
  hourlyRate: number;
  annualSalary: number;
  employmentType: EmploymentType;
  remotePreference: RemotePreference;
  willingToRelocate: boolean;
  clearance: string;
  languages: string[];
  industryExperience: string[];
  placementCount: number;
  avgRating: number;
  lastContactDate: string;
  linkedInUrl: string;
  recruiterOwner: string;
  source: string;
  status: string;
}

export interface JobRequisition {
  reqId: string;
  jobTitle: string;
  clientName: string;
  clientIndustry: string;
  department: string;
  description: string;
  responsibilities: string[];
  qualifications: string[];
  requiredSkills: string[];
  niceToHaveSkills: string[];
  yearsExperienceRequired: number;
  city: string;
  state: string;
  zipCode: string;
  timezone: string;
  remoteOption: 'Yes' | 'No' | 'Hybrid';
  minRate: number;
  maxRate: number;
  budgetType: string;
  preferredEmploymentType: EmploymentType;
  status: JobStatus;
  priority: Priority;
  urgency: Urgency;
  clearanceRequired: string;
  interviewProcess: string;
  postedDate: string;
  targetStartDate: string;
  recruiterOwner: string;
  submittalsCount: number;
  interviewsScheduled: number;
}

export interface Placement {
  placementId: string;
  candidateId: string;
  reqId: string;
  clientName: string;
  jobTitle: string;
  startDate: string;
  endDate: string | null;
  billRate: number;
  payRate: number;
  status: 'Active' | 'Completed' | 'Terminated';
  recruiterName: string;
  margin: number;
  contractType: string;
  extensionCount: number;
  clientRating: number;
  candidateRating: number;
  notes: string;
}

export interface Client {
  clientId: string;
  companyName: string;
  industry: string;
  city: string;
  state: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  activeReqs: number;
  totalPlacements: number;
  contractType: string;
  paymentTerms: string;
  notes: string;
  accountManager: string;
  clientSince: string;
  lastActivityDate: string;
}

export interface Activity {
  activityId: string;
  candidateId: string;
  activityType: 'Call' | 'Email' | 'Submittal' | 'Interview' | 'Offer';
  activityDate: string;
  notes: string;
  recruiterName: string;
  relatedReqId: string | null;
  duration: number | null;
  outcome: 'Positive' | 'Neutral' | 'Negative' | 'Pending' | 'Accepted';
}

export interface SkillTaxonomy {
  skillId: string;
  canonicalName: string;
  synonyms: string[];
  category: string;
  subCategory: string;
  relatedSkills: string[];
  demandLevel: 'High' | 'Medium' | 'Low';
  averageRate: number;
}

// Match scoring types
export interface MatchScore {
  total: number;
  skillsScore: number;
  locationScore: number;
  availabilityScore: number;
  compensationScore: number;
  performanceScore: number;
  breakdown: MatchBreakdown;
}

export interface MatchBreakdown {
  matchedSkills: string[];
  missingSkills: string[];
  locationMatch: 'Exact' | 'Within Radius' | 'Remote OK' | 'No Match';
  distanceMiles: number | null;
  rateWithinBudget: boolean;
  availabilityMatch: boolean;
}

// Query types
export interface QueryTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
  examplePrompt?: string;
  category: 'Search' | 'Analysis' | 'Reporting' | 'Matching';
  parameters?: QueryParameter[];
}

export interface QueryParameter {
  name: string;
  type: 'text' | 'number' | 'select' | 'multiselect';
  label: string;
  options?: string[];
  required: boolean;
}

export interface QueryResult {
  query: string;
  sql: string;
  results: any[];
  rowCount: number;
  executionTime: number;
  tokenUsage: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sql?: string;
  results?: any[];
  resultType?: ResultType;
  tokenUsage?: TokenUsage;
}

// Result type detection
export type ResultType = 'candidates' | 'jobs' | 'placements' | 'clients' | 'activities' | 'generic';

// Query Log for tracking
export interface QueryLog {
  id: string;
  timestamp: Date;
  query: string;
  sql: string;
  success: boolean;
  error?: string;
  tokenUsage: TokenUsage;
  duration: number;
  rowCount: number;
  resultType: ResultType;
}

// Dashboard stats
export interface DashboardStats {
  totalCandidates: number;
  activeCandidates: number;
  benchCandidates: number;
  openRequisitions: number;
  activePlacements: number;
  thisMonthPlacements: number;
  averageTimeToFill: number;
  averageMargin: number;
}

// MCP Tool types
export type MCPTool =
  | 'getCatalogs'
  | 'getSchemas'
  | 'getTables'
  | 'getColumns'
  | 'queryData'
  | 'getProcedures'
  | 'getProcedureParameters'
  | 'executeProcedure';

export interface MCPToolCall {
  tool: MCPTool;
  parameters: Record<string, any>;
  timestamp: Date;
  duration: number;
  success: boolean;
  result?: any;
  error?: string;
}

// Theme types
export type Theme = 'light' | 'dark' | 'system';

// LLM Providers
export type LLMProvider = 'openai' | 'groq' | 'deepseek' | 'gemini' | 'mistral';

// Provider metadata for UI
export const LLM_PROVIDERS: { id: LLMProvider; name: string; badge: 'Free' | 'Paid'; badgeColor: string; description: string; keyPrefix: string; keyUrl: string }[] = [
  { id: 'groq', name: 'Groq', badge: 'Free', badgeColor: 'bg-green-100 text-green-700', description: 'Llama & Mixtral models, fast inference', keyPrefix: 'gsk_', keyUrl: 'https://console.groq.com/keys' },
  { id: 'gemini', name: 'Google Gemini', badge: 'Free', badgeColor: 'bg-green-100 text-green-700', description: 'Gemini 2.0 Flash free tier', keyPrefix: 'AI', keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'deepseek', name: 'DeepSeek', badge: 'Paid', badgeColor: 'bg-purple-100 text-purple-700', description: 'Low cost, $0.28/1M tokens', keyPrefix: 'sk-', keyUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 'mistral', name: 'Mistral AI', badge: 'Paid', badgeColor: 'bg-orange-100 text-orange-700', description: 'European AI, strong reasoning', keyPrefix: '', keyUrl: 'https://console.mistral.ai/api-keys/' },
  { id: 'openai', name: 'OpenAI', badge: 'Paid', badgeColor: 'bg-blue-100 text-blue-700', description: 'GPT-4o, GPT-5, o-series models', keyPrefix: 'sk-', keyUrl: 'https://platform.openai.com/api-keys' },
];

// Available Models by Provider
export const LLM_MODELS: Record<LLMProvider, readonly { id: string; name: string; description: string; category: string }[]> = {
  openai: [
    { id: 'gpt-5.2', name: 'GPT-5.2', description: 'Most advanced', category: 'Flagship' },
    { id: 'gpt-5.2-codex', name: 'GPT-5.2-Codex', description: 'Agentic coding', category: 'Flagship' },
    { id: 'gpt-5.1', name: 'GPT-5.1', description: 'Previous flagship', category: 'Flagship' },
    { id: 'gpt-5', name: 'GPT-5', description: 'Reasoning model', category: 'Flagship' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Faster reasoning', category: 'Flagship' },
    { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Coding, instruction following', category: 'General' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Balanced cost', category: 'General' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', description: 'Fast, lightweight', category: 'General' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Multimodal', category: 'General' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast multimodal', category: 'General' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Legacy turbo', category: 'Legacy' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and cheap', category: 'Legacy' },
    { id: 'o3', name: 'o3', description: 'Complex reasoning', category: 'Reasoning' },
    { id: 'o4-mini', name: 'o4-mini', description: 'Fast reasoning', category: 'Reasoning' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Best quality', category: 'Llama' },
    { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', description: 'Great for SQL', category: 'Llama' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Fast', category: 'Llama' },
    { id: 'llama3-70b-8192', name: 'Llama 3 70B', description: 'Reliable', category: 'Llama' },
    { id: 'llama3-8b-8192', name: 'Llama 3 8B', description: 'Fastest', category: 'Llama' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Good for coding', category: 'Mixtral' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B', description: 'Google model', category: 'Gemma' },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek V3.2', description: 'Chat, SQL, coding', category: 'General' },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1', description: 'Complex reasoning, CoT', category: 'Reasoning' },
  ],
  gemini: [
    { id: 'gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro', description: 'Most capable, thinking', category: 'Pro' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast and capable', category: 'Flash' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: 'Fastest, lightweight', category: 'Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Long context (1M tokens)', category: 'Pro' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Balanced speed/quality', category: 'Flash' },
  ],
  mistral: [
    { id: 'mistral-large-latest', name: 'Mistral Large', description: 'Most capable', category: 'Large' },
    { id: 'mistral-medium-latest', name: 'Mistral Medium', description: 'Balanced', category: 'Medium' },
    { id: 'mistral-small-latest', name: 'Mistral Small', description: 'Fast and efficient', category: 'Small' },
    { id: 'open-mistral-nemo', name: 'Mistral Nemo', description: 'Open source, 12B', category: 'Open' },
    { id: 'codestral-latest', name: 'Codestral', description: 'Optimized for code', category: 'Code' },
  ],
};

// For backwards compatibility
export const OPENAI_MODELS = LLM_MODELS.openai;
export type OpenAIModelId = string;

// App Settings
export interface AppSettings {
  theme: Theme;
  resultsPerPage: number;
  showSQLQueries: boolean;
  llmProvider: LLMProvider;
  selectedModel: string;
  enableRouting: boolean;
}

// ============================================
// Auth & Profile Types
// ============================================

export type UserRole = 'recruiter' | 'hiring_manager' | 'admin' | 'analyst' | 'viewer';

export const USER_ROLES: { id: UserRole; label: string; description: string }[] = [
  { id: 'recruiter', label: 'Recruiter', description: 'Source and place candidates' },
  { id: 'hiring_manager', label: 'Hiring Manager', description: 'Review candidates and manage requisitions' },
  { id: 'admin', label: 'Admin', description: 'Full platform access and configuration' },
  { id: 'analyst', label: 'Analyst', description: 'Data analysis and reporting' },
  { id: 'viewer', label: 'Viewer', description: 'Read-only access to data' },
];

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  salt: string;
}

export interface StoredProfile {
  profile: UserProfile;
  passwordHash: string;
  passwordSalt: string;
  credentials: EncryptedData | null;
}

export interface UserCredentials {
  llm: {
    provider: LLMProvider;
    apiKey: string;
    model: string;
  } | null;
  cdata: {
    email: string;
    pat: string;
    endpoint: string;
  } | null;
  dataSource: {
    lockedTables: string[];
  } | null;
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'testing' | 'error';

export interface ConnectionState {
  llm: ConnectionStatus;
  cdata: ConnectionStatus;
  lastTested?: string;
}
