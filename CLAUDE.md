# Talent Intelligence Platform — CLAUDE.md

AI assistant context for development, modification, and recreation of this project.
Read this file fully before making any changes or writing any code.

---

## Intake — Answer These First

Before starting any work, ask the user these questions if not already answered:

1. **Goal** — Are you (a) running as-is, (b) modifying an existing feature, (c) adding a new feature, or (d) recreating from scratch with your own data source?
2. **Skill level** — Beginner (guided step-by-step), Intermediate (commands + rationale), or Advanced (constraints only)?
3. **Data source** — What database or SaaS tool holds your data? (e.g., Supabase/PostgreSQL, Snowflake, Salesforce, HubSpot, Google Sheets)
4. **LLM provider** — Which AI provider will you use? (OpenAI, Groq, DeepSeek, Gemini, Mistral, or other OpenAI-compatible)
5. **Domain** — What domain is your data? (Recruiting/HR is the default. Other domains require updating field mappings and agent prompts.)
6. **Deployment** — Local only, or deploying to Vercel/cloud?

Route your responses based on skill level: beginners get each step explained; intermediates get commands with brief rationale; advanced users get constraints and file locations only.

---

## What This App Is

A natural language intelligence platform for talent/recruiting data. Users type questions in plain English ("show me senior Java candidates available in Q3"), the app generates SQL against a live database via CData Connect AI, and returns structured results — no SQL knowledge required.

Built as a reference implementation showing how to connect AI agents to live enterprise data using CData Connect AI as the data layer.

---

## Tech Stack

| Layer | Choice | Version |
|-------|--------|---------|
| Framework | Next.js App Router | 14.1.0 |
| UI | React + Tailwind CSS + Radix UI | 18.2 / 3.4 |
| State | Zustand (with localStorage persistence) | 4.5 |
| Agent pipeline | LangGraph | latest |
| Data layer | CData Connect AI (REST + MCP) | cloud |
| Auth | AES-256-GCM client-side encryption (Web Crypto API) | — |
| LLM | Pluggable: OpenAI / Groq / DeepSeek / Gemini / Mistral | — |

Do not suggest migrating to a different framework, state manager, or auth approach without understanding the credential encryption constraint (see below).

---

## Architecture in One Page

```
Browser (React)
  └── Zustand store (encrypted credentials in localStorage)
  └── apiClient() — attaches credentials as HTTP headers on every request
        └── Next.js API routes (server-side Node.js)
              ├── /api/chat       — NL query → agent pipeline → results
              ├── /api/candidates — sidebar list (REST, cached)
              ├── /api/candidates/[id] — profile page (REST, parallel queries)
              ├── /api/schema     — schema discovery (REST-first, MCP fallback)
              ├── /api/catalogs   — available data sources
              ├── /api/query      — direct SQL execution
              └── /api/test-connection — wizard connection validation
                    └── CData Connect AI
                          ├── REST API (cloud.cdata.com/api) — deterministic queries
                          └── MCP (mcp.cloud.cdata.com/mcp) — NL agent queries only
```

**Key design decision:** REST handles all deterministic data access (sidebar, profiles, schema discovery). MCP is reserved exclusively for LLM-generated natural language queries. This separation keeps rate limit budgets independent and latency low for common operations.

---

## File Map

```
src/
  app/
    api/                    — All server-side API routes (credentials stay here, never in browser)
    candidate/[id]/         — Candidate profile page
    views/                  — Full-page views (Analytics, Logs, Settings)
    page.tsx                — Main search interface
    layout.tsx              — Root layout, auth gate

  components/
    auth/                   — Login, profile creation, profile menu
    candidates/             — CandidateCard, CandidateJourney
    layout/Sidebar.tsx      — Candidate list sidebar (hover/pin, Zustand-synced)
    search/                 — SearchBar, SearchResults, QuickQueries
    ui/                     — Shared primitives (TokenUsageBar, ExportBar, etc.)
    wizard/                 — 4-step connection setup wizard

  lib/
    agents/
      index.ts              — Orchestrator entry point
      intent-router.ts      — Classifies query intent
      nodes/                — Individual LangGraph nodes
      schema-cache.ts       — Tiered schema discovery (catalogs → tables → columns)
    api-client.ts           — Frontend fetch wrapper, injects credential headers
    auth-store.ts           — Zustand auth store with AES-256-GCM encryption
    cdata-rest-client.ts    — REST API client (POST /query, GET /columns, etc.)
    cdata-client.ts         — MCP client (NL queries only)
    field-resolver.ts       — Canonical field name → actual column name resolver
    rate-limiter.ts         — 5-layer rate limiting system
    store.ts                — App state (candidates, search results, UI state)
    crypto.ts               — AES-256-GCM encrypt/decrypt, PBKDF2 key derivation

  types/index.ts            — Shared TypeScript types

docs/
  ARCHITECTURE.md           — Detailed architecture reference
  Business_Use_Case.md      — Business context and use cases
```

---

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```env
# CData Connect AI (required)
CDATA_EMAIL=your@email.com
CDATA_PAT=your-personal-access-token
CDATA_ENDPOINT=https://mcp.cloud.cdata.com/mcp

# LLM Provider — set ONE
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
DEEPSEEK_API_KEY=...

# Optional
NEXT_PUBLIC_APP_NAME=Talent Intelligence Platform
```

Get your CData PAT at: https://cloud.cdata.com/settings/tokens

---

## Connecting Your Data Source

The app works with any database or SaaS tool supported by CData Connect AI (350+ sources).

1. Log in to https://cloud.cdata.com
2. Go to Sources > Add Connection > select your connector
3. Fill in credentials and click Save & Test
4. Note the connection name — this becomes your catalog name in queries

**For Supabase (PostgreSQL):** Use the Session Pooler host (`aws-1-...pooler.supabase.com`), username format `postgres.[project-ref]`, and set SSL Server Cert to `*`. See `docs/` for the full guide.

**For other sources:** The app auto-discovers schema on first load. No hardcoded table names — `findTable()` in `schema-cache.ts` matches tables by keyword heuristics.

---

## Constraints & Non-Obvious Behavior

**1. Credentials never touch the server filesystem.**
They live in the browser's encrypted localStorage. The API routes receive them as HTTP headers (`X-CData-Email`, `X-CData-PAT`, `X-LLM-API-Key`, etc.) and never persist them. Do not add any server-side credential storage.

**2. `zipRows()` must check three column name formats.**
CData REST API returns column metadata with `columnName` (camelCase) in schema endpoints but sometimes `COLUMN_NAME` (uppercase) in query results. `zipRows()` in `cdata-rest-client.ts` handles all three variants (`columnName`, `COLUMN_NAME`, `name`). Do not simplify this to one format.

**3. `getLedgerCount()` must exclude `blocked` entries.**
The rate limiter ledger (`data/query-ledger.jsonl`) records every request. Counting `blocked` entries toward the ceiling causes a death spiral: blocked requests inflate the count, which triggers more blocks. Only `success` and `error` entries count toward limits.

**4. Never add `candidatesLoading` to sidebar `useEffect` deps.**
The sidebar fetches candidates once on mount. Adding loading state to the effect dependencies causes it to re-trigger on every state change, resulting in a continuous fetch loop. Use a `useRef(fetchAttempted)` guard instead.

**5. React StrictMode double-renders in dev.**
Next.js dev mode runs effects twice. Route-level gateway checks on high-frequency routes exhaust rate limits immediately. Keep gateway checks at the REST client layer only, not at the route level for frequently-called endpoints.

**6. Numeric IDs must be unquoted in PostgreSQL.**
When building SQL for integer primary keys, detect numeric IDs (`/^\d+$/.test(id)`) and use unquoted values. CData does not always coerce `'9169'` to `9169` for integer columns.

**7. `findTable()` accepts an optional `preferCatalog` third parameter.**
When multiple connected sources have similarly-named tables, always pass the preferred catalog name to avoid matching the wrong source.

**8. Schema cache is shared across all requests.**
Column resolution happens once per table per hour. Do not duplicate schema fetching in individual API routes — use `getCachedSchema()` and let the cache layer handle refresh.

---

## Modifying the App

**Swap the data source:**
1. Add your new connection in CData Connect AI
2. Update `CDATA_ENDPOINT` in `.env.local` if using a different workspace
3. Schema is auto-discovered — no hardcoded table names to change
4. Update keyword heuristics in `schema-cache.ts` `findTable()` if your table names differ significantly from recruiting conventions (`candidate`, `placement`, `activit`)

**Add a new LLM provider:**
1. Add the API key to `.env.local`
2. Register the provider in `src/lib/openai-client.ts` (uses OpenAI-compatible interface)
3. Add it to the provider list in `src/components/wizard/steps/LLMProviderStep.tsx`

**Add a new agent node:**
1. Create the node in `src/lib/agents/nodes/`
2. Register it in `src/lib/agents/graph.ts`
3. Add routing logic in `src/lib/agents/nodes/intent-router.ts`

**Add a new field to the field resolver:**
1. Add the canonical name and its aliases to `src/lib/field-resolver.ts`
2. The resolver handles PascalCase, camelCase, snake_case, and SCREAMING_SNAKE automatically

**Change the domain (from recruiting to another use case):**
1. Update field mappings in `src/lib/field-resolver.ts`
2. Update agent prompts in `src/lib/agents/nodes/query-builder.ts` and `analyzer.ts`
3. Update `CandidateJourney` stages in `src/components/candidates/CandidateJourney.tsx`
4. Update quick query suggestions in `src/components/search/QuickQueries.tsx`

---

## Running the App

```bash
npm install
cp .env.local.example .env.local
# Fill in .env.local with your keys
npm run dev
# Open http://localhost:3000
```

Or double-click `start.bat` (Windows) / run `./start.sh` (Mac/Linux) for guided setup.

**To clear rate limiter state between dev sessions:**
Delete `data/query-ledger.jsonl` and restart the dev server.

---

## Recreating from Scratch

If recreating this app from scratch with your own data source:

1. Answer the intake questions at the top of this file
2. Run `npx create-next-app@14 your-app-name --typescript --tailwind --app`
3. Install dependencies: `npm install zustand @langchain/core @langchain/langgraph @langchain/openai lucide-react recharts framer-motion`
4. Build in this order: auth store → crypto → API client → REST client → schema cache → field resolver → rate limiter → agent nodes → UI components
5. The agent pipeline (LangGraph) is the most complex part — build and test it standalone before wiring to the UI
6. Connect your CData data source before building the schema-dependent components

The `docs/ARCHITECTURE.md` has the full system design. Start there.
