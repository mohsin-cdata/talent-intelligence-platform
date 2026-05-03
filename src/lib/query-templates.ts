import { QueryTemplate } from '@/types';

export const queryTemplates: QueryTemplate[] = [
  // Search Templates
  {
    id: 'find-candidates-by-skill',
    title: 'Find candidates with specific skills',
    description: 'Search for candidates matching required skills and experience level',
    prompt: 'Find all candidates with {skills} skills and at least {years} years of experience',
    examplePrompt: 'Find all candidates with Java, Python skills and at least 5 years of experience',
    category: 'Search',
    parameters: [
      { name: 'skills', type: 'text', label: 'Skills (comma-separated)', required: true },
      { name: 'years', type: 'number', label: 'Minimum Years Experience', required: false },
    ],
  },
  {
    id: 'available-in-location',
    title: 'Available candidates in location',
    description: 'Find candidates available within a radius of a specific location',
    prompt: 'Find available candidates within {radius} miles of {location} with {skills} skills',
    examplePrompt: 'Find available candidates within 50 miles of Austin, TX',
    category: 'Search',
    parameters: [
      { name: 'location', type: 'text', label: 'City, State or Zip', required: true },
      { name: 'radius', type: 'number', label: 'Radius (miles)', required: true },
      { name: 'skills', type: 'text', label: 'Required Skills', required: false },
    ],
  },
  {
    id: 'bench-candidates',
    title: 'Bench candidates ready for placement',
    description: 'List all bench candidates sorted by availability date',
    prompt: 'Show all bench candidates available for immediate placement, sorted by their skills and last contact date',
    examplePrompt: 'Show all bench candidates available for immediate placement, sorted by their skills and last contact date',
    category: 'Search',
  },

  // Matching Templates
  {
    id: 'match-candidates-to-job',
    title: 'Match candidates to job requisition',
    description: 'Find best matching candidates for a specific job based on skills, location, and rate',
    prompt: 'Find the top 10 candidates that best match job requisition {reqId}, considering skills, location, availability, and compensation',
    examplePrompt: 'Find the top 10 candidates for a Senior Java Developer role in Austin, TX',
    category: 'Matching',
    parameters: [
      { name: 'reqId', type: 'text', label: 'Job Requisition ID', required: true },
    ],
  },
  {
    id: 'skills-gap-analysis',
    title: 'Skills gap for job description',
    description: 'Analyze what skills are missing from your candidate pool for a job',
    prompt: 'What skills are we missing in our candidate pool to fill the {jobTitle} role at {clientName}? Compare our available candidates against the job requirements.',
    examplePrompt: 'What skills are we missing in our candidate pool for a Cloud Architect role?',
    category: 'Matching',
    parameters: [
      { name: 'jobTitle', type: 'text', label: 'Job Title', required: true },
      { name: 'clientName', type: 'text', label: 'Client Name', required: false },
    ],
  },
  {
    id: 'compensation-comparison',
    title: 'Compare compensation across types',
    description: 'Normalize W2, C2C, and 1099 rates for fair comparison',
    prompt: 'Compare candidates for {skill} skills showing their rates normalized across W2, C2C, and 1099 employment types',
    examplePrompt: 'Compare candidates for React skills showing their rates normalized across W2, C2C, and 1099 employment types',
    category: 'Matching',
    parameters: [
      { name: 'skill', type: 'text', label: 'Primary Skill', required: true },
    ],
  },

  // Analysis Templates
  {
    id: 'placement-performance',
    title: 'Placement performance analysis',
    description: 'Analyze placement success rates and margins by recruiter or client',
    prompt: 'Show placement performance metrics including average margin, client ratings, and extension rates grouped by {groupBy}',
    examplePrompt: 'Show placement performance metrics including average margin, client ratings, and extension rates grouped by Recruiter',
    category: 'Analysis',
    parameters: [
      {
        name: 'groupBy',
        type: 'select',
        label: 'Group By',
        options: ['Recruiter', 'Client', 'Skill', 'Employment Type'],
        required: true,
      },
    ],
  },
  {
    id: 'activity-summary',
    title: 'Recruiter activity summary',
    description: 'Summarize recruiter activities over a time period',
    prompt: 'Show a summary of all recruiter activities in the last {days} days, including calls, emails, submittals, and interviews',
    examplePrompt: 'Show a summary of all recruiter activities in the last 30 days, including calls, emails, submittals, and interviews',
    category: 'Analysis',
    parameters: [
      { name: 'days', type: 'number', label: 'Days', required: true },
    ],
  },

  // Reporting Templates
  {
    id: 'client-pipeline',
    title: 'Client pipeline report',
    description: 'View the hiring pipeline for a specific client',
    prompt: 'Show the complete hiring pipeline for {clientName} including open requisitions, submitted candidates, interviews scheduled, and recent placements',
    examplePrompt: 'Show the complete hiring pipeline for TechCorp including open requisitions, submitted candidates, interviews scheduled, and recent placements',
    category: 'Reporting',
    parameters: [
      { name: 'clientName', type: 'text', label: 'Client Name', required: true },
    ],
  },
  {
    id: 'market-rate-analysis',
    title: 'Market rate analysis',
    description: 'Analyze market rates for specific skills',
    prompt: 'What are the current market rates for {skills} skills? Show average, min, and max rates by employment type and location',
    examplePrompt: 'What are the current market rates for Python, AWS skills? Show average, min, and max rates by employment type and location',
    category: 'Reporting',
    parameters: [
      { name: 'skills', type: 'text', label: 'Skills', required: true },
    ],
  },
];

export const getTemplatesByCategory = (category: QueryTemplate['category']) => {
  return queryTemplates.filter((t) => t.category === category);
};

export const getTemplateById = (id: string) => {
  return queryTemplates.find((t) => t.id === id);
};
