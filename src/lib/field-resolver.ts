// Field Resolver - resolves field values from any casing convention
//
// Handles: PascalCase (FirstName), camelCase (firstName), snake_case (first_name), SCREAMING_SNAKE (FIRST_NAME)
// Components use canonical names; this resolves to whatever the data actually has.

type Row = Record<string, any>;

// Canonical field name -> all known aliases (lowercase for matching)
const FIELD_ALIASES: Record<string, string[]> = {
  // Identity
  firstName: ['firstname', 'first_name', 'fname', 'givenname', 'given_name'],
  lastName: ['lastname', 'last_name', 'lname', 'surname', 'familyname', 'family_name'],
  fullName: ['fullname', 'full_name', 'name', 'displayname', 'display_name'],
  email: ['email', 'emailaddress', 'email_address', 'e_mail'],
  phone: ['phone', 'phonenumber', 'phone_number', 'telephone', 'mobile', 'cell'],
  title: ['title', 'jobtitle', 'job_title', 'position', 'role'],

  // IDs
  candidateId: ['candidateid', 'candidate_id', 'cand_id', 'id'],
  reqId: ['reqid', 'req_id', 'requisitionid', 'requisition_id', 'jobid', 'job_id'],
  placementId: ['placementid', 'placement_id'],
  clientId: ['clientid', 'client_id'],
  activityId: ['activityid', 'activity_id'],
  skillId: ['skillid', 'skill_id'],

  // Professional
  skills: ['skills', 'skill', 'skillset', 'skill_set', 'requiredskills', 'required_skills'],
  status: ['status', 'candidatestatus', 'candidate_status', 'jobstatus', 'job_status'],
  hourlyRate: ['hourlyrate', 'hourly_rate', 'rate', 'payrate', 'pay_rate', 'billrate', 'bill_rate'],
  yearsExperience: ['yearsexperience', 'years_experience', 'experience', 'yrs_experience', 'yrsexperience'],
  source: ['source', 'candidatesource', 'candidate_source', 'leadsource', 'lead_source'],

  // Location
  city: ['city', 'location', 'metro'],
  state: ['state', 'region', 'province', 'statecode', 'state_code'],
  country: ['country', 'countrycode', 'country_code'],

  // URLs
  linkedinUrl: ['linkedinurl', 'linkedin_url', 'linkedin', 'linkedinprofile', 'linkedin_profile'],

  // Organization
  companyName: ['companyname', 'company_name', 'company', 'organization', 'org', 'clientname', 'client_name'],
  industry: ['industry', 'sector'],

  // Job specific
  jobTitle: ['jobtitle', 'job_title', 'positiontitle', 'position_title'],
  minRate: ['minrate', 'min_rate', 'minimumrate', 'minimum_rate'],
  maxRate: ['maxrate', 'max_rate', 'maximumrate', 'maximum_rate'],
  hiringManager: ['hiringmanager', 'hiring_manager'],
  priority: ['priority', 'urgency'],

  // Placement specific
  startDate: ['startdate', 'start_date', 'datestart', 'date_start'],
  endDate: ['enddate', 'end_date', 'dateend', 'date_end'],
  billRate: ['billrate', 'bill_rate'],
  payRate: ['payrate', 'pay_rate'],
  clientRating: ['clientrating', 'client_rating', 'rating'],

  // Activity specific
  activityType: ['activitytype', 'activity_type', 'type'],
  activityDate: ['activitydate', 'activity_date'],
  notes: ['notes', 'note', 'description', 'comments', 'comment'],
  recruiterName: ['recruitername', 'recruiter_name', 'recruiter', 'recruiterowner', 'recruiter_owner'],

  // Dates
  dateAdded: ['dateadded', 'date_added', 'datecreated', 'date_created', 'createdat', 'created_at', 'createdon'],
  dateModified: ['datemodified', 'date_modified', 'updatedat', 'updated_at', 'modifiedon', 'modified_on'],
  dateOpened: ['dateopened', 'date_opened'],
  dateClosed: ['dateclosed', 'date_closed'],

  // Taxonomy
  skillName: ['skillname', 'skill_name'],
  category: ['category', 'skillcategory', 'skill_category'],
  demandLevel: ['demandlevel', 'demand_level'],
  avgRate: ['avgrate', 'avg_rate', 'averagerate', 'average_rate'],

  // Employment
  employmentType: ['employmenttype', 'employment_type', 'emptype', 'emp_type'],
  remotePreference: ['remotepreference', 'remote_preference', 'remotepref', 'remote_pref', 'workpreference', 'work_preference'],
  clearance: ['clearance', 'securityclearance', 'security_clearance'],
  availableDate: ['availabledate', 'available_date', 'availabilitydate', 'availability_date'],
  placementCount: ['placementcount', 'placement_count', 'totalplacements', 'total_placements'],
  summary: ['summary', 'bio', 'about', 'profilesummary', 'profile_summary'],
  avgRating: ['avgrating', 'avg_rating', 'averagerating', 'average_rating'],

  // Misc
  accountManager: ['accountmanager', 'account_manager'],
  activeReqs: ['activereqs', 'active_reqs', 'activerequisitions'],
};

// Build a reverse lookup: lowercase key -> canonical name
const REVERSE_LOOKUP: Record<string, string> = {};
for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
  REVERSE_LOOKUP[canonical.toLowerCase()] = canonical;
  for (const alias of aliases) {
    REVERSE_LOOKUP[alias.toLowerCase()] = canonical;
  }
}

/**
 * Get a field value from a row, trying all known aliases.
 * Returns undefined if not found.
 */
export function getField(row: Row | null | undefined, canonicalName: string): any {
  if (!row) return undefined;

  // Direct match first (fast path)
  if (row[canonicalName] !== undefined) return row[canonicalName];

  // Get aliases for this canonical name
  const aliases = FIELD_ALIASES[canonicalName];
  if (!aliases) {
    // No known aliases -- try case-insensitive match on the row keys
    const lower = canonicalName.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === lower) return row[key];
    }
    return undefined;
  }

  // Try each alias against the row keys (case-insensitive)
  const rowKeysLower = new Map<string, string>();
  for (const key of Object.keys(row)) {
    rowKeysLower.set(key.toLowerCase(), key);
  }

  for (const alias of aliases) {
    const actualKey = rowKeysLower.get(alias);
    if (actualKey && row[actualKey] !== undefined) return row[actualKey];
  }

  return undefined;
}

/**
 * Get display name from a row (tries multiple field combinations)
 */
export function getDisplayName(row: Row | null | undefined): string {
  if (!row) return 'Unknown';

  const firstName = getField(row, 'firstName');
  const lastName = getField(row, 'lastName');
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return String(firstName);
  if (lastName) return String(lastName);

  const fullName = getField(row, 'fullName');
  if (fullName) return String(fullName);

  const companyName = getField(row, 'companyName');
  if (companyName) return String(companyName);

  const jobTitle = getField(row, 'jobTitle');
  if (jobTitle) return String(jobTitle);

  const skillName = getField(row, 'skillName');
  if (skillName) return String(skillName);

  return 'Unknown';
}

/**
 * Get the primary ID from a row
 */
export function getPrimaryId(row: Row | null | undefined): string | null {
  if (!row) return null;
  const id = getField(row, 'candidateId')
    || getField(row, 'reqId')
    || getField(row, 'placementId')
    || getField(row, 'clientId')
    || getField(row, 'activityId')
    || getField(row, 'skillId');
  return id != null ? String(id) : null;
}

/**
 * Get subtitle (title/status) from a row
 */
export function getSubtitle(row: Row | null | undefined): string {
  if (!row) return '';
  const title = getField(row, 'title');
  if (title) return String(title);
  const status = getField(row, 'status');
  if (status) return String(status);
  return '';
}

/**
 * Get initials from a display name
 */
export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

/**
 * Resolve the actual column name from a set of available columns.
 * Given a canonical field name (e.g. 'candidateId') and an array of actual column names
 * (e.g. ['candidate_id', 'first_name', ...]), returns the matching actual column name.
 * Returns null if no match found.
 */
export function resolveColumnName(canonicalName: string, availableColumns: string[]): string | null {
  if (!availableColumns || availableColumns.length === 0) return null;

  // Build a lowercase -> actual name map
  const lowerMap = new Map<string, string>();
  for (const col of availableColumns) {
    lowerMap.set(col.toLowerCase(), col);
  }

  // Direct match
  const direct = lowerMap.get(canonicalName.toLowerCase());
  if (direct) return direct;

  // Try aliases
  const aliases = FIELD_ALIASES[canonicalName];
  if (aliases) {
    for (const alias of aliases) {
      const match = lowerMap.get(alias);
      if (match) return match;
    }
  }

  return null;
}
