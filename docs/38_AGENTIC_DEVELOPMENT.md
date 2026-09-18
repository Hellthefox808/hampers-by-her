<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 38_AGENTIC_DEVELOPMENT.md — Agentic Engineering Governance, Context Harness & AI Guardrails

## 1. Purpose
This document establishes the operational principles, context harness engineering standards, architectural guardrails, and quality boundaries for deploying autonomous AI coding agents (such as Antigravity, Claude Code, GitHub Copilot) within the **Hampers by Her** codebase. AI agents are designated as powerful engineering force-multipliers and implementation accelerators, but must **never** be permitted to act as autonomous architectural decision-makers. This specification enforces strict anti-hallucination protocols, progressive context loading, deterministic verification loops, and automated safety fences to prevent architectural drift, secret leakage, and destructive migrations.

## 2. Scope
- **In-Scope**:
  - The 10-step Autonomous Engineering Loop: `OBSERVE` ──► `RESEARCH` ──► `MODEL` ──► `ARCHITECT` ──► `IMPLEMENT` ──► `TEST` ──► `AUDIT` ──► `DOCUMENT` ──► `RECONCILE` ──► `COMMIT`.
  - Context window discipline and progressive loading via `44_MASTER_INDEX.md`.
  - Anti-hallucination protocols and strict enforcement of the `unknown:` schema block for unverified business facts.
  - Safe tool execution boundaries (prohibiting unreviewed destructive shell commands, production deployments, and secret exfiltration).
  - Code generation quality standards: strict TypeScript typing, parameterized SQL, zero ad-hoc libraries.
  - Integration of repository skills, prompt templates, and architectural verification tests.
- **Out-of-Scope**:
  - Autonomous deployment to production without human peer review and cryptographic release tagging.

## 3. Context
Without strict engineering guardrails, AI coding agents frequently introduce "hallucinated complexity": silently importing massive third-party npm packages for simple utilities, inventing mock APIs that diverge from real backend schemas, generating unindexed database queries that cause production latency spikes, or fabricating unverified business claims (e.g., claiming Hampers by Her has "Free delivery to all 28 states within 2 hours"). This document enshrines strict discipline into the development workflow.

```
[Agent Task Input]
       │
       ▼
[Context Harness: Load 44_MASTER_INDEX.md] ── Extract Scope & Constraints
       │
       ▼
[Research & Plan Phase] ── Explicit implementation_plan.md created
       │
       ▼ (Approval Gate)
[Atomic Implementation Phase] ── Smallest safe diff applied
       │
       ▼
[Deterministic Verification Loop]
  ├── `npm run lint` (ESLint strict check)
  ├── `npm run typecheck` (`tsc --noEmit`)
  ├── `npm test` (Unit & Integration tests)
  └── `npm run build` (Production compilation)
       │
       ▼ (Passes All Gates)
[Documentation Sync & Master Index Update] ── Update ChangeLog & Status
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-AGT-01**: Mandatory Context Ingestion: Before editing any file, agents must load the relevant domain specification from `/docs/` and verify existing database schemas and API contracts.
- **FR-AGT-02**: Unknown Fact Protocol: If a business fact (pricing, serviceable pincodes, owner contact details) cannot be confirmed from official assets or Instagram evidence logs, agents must NEVER fabricate it; agents MUST emit the structured `unknown:` block.
- **FR-AGT-03**: Zero-Drift Policy: Agents are strictly prohibited from refactoring unrelated modules or introducing new architectural patterns (e.g., swapping NestJS for Express, or adding Tailwind plugins) without an approved Architecture Decision Record (ADR).
- **FR-AGT-04**: Smallest Safe Change: Code modifications must be atomic, focused, and accompanied by corresponding unit/integration test fixtures.
- **FR-AGT-05**: Continuous Documentation Parity: Every code mutation that touches an entity, API endpoint, or configuration must update the corresponding markdown specification file in both root and `/docs/`.

### 4.2 Non-Functional Requirements
- **NFR-AGT-01**: Verifiability: 100% of agent code modifications must be verified via local test execution before being reported to human reviewers.
- **NFR-AGT-02**: Dependency Discipline: Agents cannot add new third-party dependencies without explicit architectural justification and license validation (MIT/Apache-2.0 only).
- **NFR-AGT-03**: Secret Safety: Zero credentials, private tokens, or test passwords hardcoded into source files or documentation.

## 5. Architecture & Design

### 5.1 The Agentic Development Loop
```
STEP 1: OBSERVE & LOAD CONTEXT
  └── Read 44_MASTER_INDEX.md + relevant domain file (e.g., 15_HAMPER_BUILDER.md)
STEP 2: RESEARCH BOUNDARIES
  └── Check docs/research/INSTAGRAM_EVIDENCE_LOG.md to ensure no business fact is fabricated
STEP 3: PROPOSE PLAN
  └── Draft implementation_plan.md specifying files to create, modify, and test
STEP 4: EXECUTE SURGICAL EDITS
  └── Apply code modifications using precise search-and-replace tools
STEP 5: RUN VERIFICATION SUITE
  └── Execute: lint ──► typecheck ──► test ──► build
STEP 6: TRIAGE & SELF-HEAL
  └── If compiler or tests fail: read error trace ──► find root cause ──► apply fix
STEP 7: CROSS-DOCUMENT RECONCILIATION
  └── Re-read modified documentation ──► detect contradictions ──► fix & propagate
STEP 8: UPDATE AUDIT TRAIL
  └── Record changes in 44_MASTER_INDEX.md change log
```

### 5.2 Structured Unknown Schema Contract
Whenever an agent encounters an unverified business requirement, it must document it using this exact YAML structure:
```yaml
unknown:
  field: [Exact Parameter Name, e.g., dispatch_hub_pincode]
  status: TO_VERIFY
  source_required: brand_owner | legal_counsel | logistics_partner
  impact: high | medium | low
  temporary_assumption: [Explicit, conservative baseline used for engineering]
```

## 6. Business Rules
1. **No Silent Overwrites**: An agent must never silently overwrite or reverse an established architectural decision. If a technical conflict arises between documents, the agent must execute: `DETECT` ──► `EXPLAIN` ──► `DECIDE` ──► `UPDATE` ──► `PROPAGATE`.
2. **Deterministic Pricing Primacy**: An agent must never move pricing calculation logic into the frontend client; client calculations are strictly for optimistic UI rendering, while server calculations remain authoritative.
3. **No Phantom Code (YAGNI Enforcement)**: Agents must write code strictly satisfying current requirements; speculative abstractions, unused generic factories, and premature microservices must be pruned.

## 7. Technical Details

### 7.1 Pre-Commit Git Verification Hook (`.husky/pre-commit`)
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🤖 Running Automated Agentic Safety Pre-Commit Gates..."

# 1. Check for staged secrets or API keys
if git diff --cached | grep -E "(sk_live_|rzp_live_|EAAB[0-9a-zA-Z]+)"; then
  echo "❌ CRITICAL SECURITY ALERT: Detected potential live API keys in staged files!"
  exit 1
fi

# 2. Strict Typecheck & Lint
npm run lint -- --max-warnings=0
npm run typecheck

# 3. Fast Unit Test Suite
npm run test:unit

echo "✅ Pre-commit verification passed."
```

### 7.2 Agent Behavioral Rules (`AGENTS.md` in repository root)
```markdown
# AGENTS.md — Instructions for AI Coding Assistants
1. Always read `44_MASTER_INDEX.md` first to understand current architecture state.
2. Monetary values are strictly `BIGINT` in Paise. Never use floating point.
3. Use Next.js 15 App Router and React Server Components. Do not add `'use client'` unless state or browser APIs are required.
4. All Prisma queries must use explicit `select` or `include` to avoid over-fetching.
5. If an Instagram fact is unverified, use `unknown:` block. Never invent product names or prices.
6. Run `npm test` after modifying code. Never claim completion without passing tests.
```

## 8. Dependencies
- **Tooling**: Git, Husky (Pre-commit hooks), ESLint, TypeScript Compiler (`tsc`), Vitest, Antigravity IDE agent runner.
- **Repository Guides**: `AGENTS.md`, `44_MASTER_INDEX.md`, `/docs/decisions/` ADR catalog.

## 9. Security
- **Command Whitelisting**: Terminal commands executed by agents are restricted to safe inspection, testing, and compilation tools (`npm`, `git status`, `git diff`, `docker build`). Destructive commands (`rm -rf /`, `DROP DATABASE`, `aws s3 rm --recursive`) require explicit interactive human authorization.
- **Environment Isolation**: Agents develop against mock databases (Testcontainers / Docker local); live production AWS credentials are never exposed in agent runtime environments.

## 10. Failure Modes & Resilience
1. **Agent Hallucination Loop**: If an agent attempts to fix a test failure by repeatedly refactoring unrelated modules, the context harness detects cyclomatic churn, halts the agent turn, and prompts for human architectural clarification.
2. **Context Window Degradation**: When conversation context nears maximum token capacity, the agent summarizes completed phase deliverables into the persistent `implementation_plan.md` artifact and resumes from a clean checkpoint.

## 11. Testing (Agent Governance Verification)
- **Agent Output Linting**: Automated checks verifying that all generated markdown files contain the mandatory 15 Section-40 headings.
- **Secret Detection Tests**: CI pipeline runs `gitleaks` and `trufflehog` on all agent pull requests to ensure zero accidental credential leaks.

## 12. Observability & Monitoring
- **Metrics Tracked**:
  - `agent.changes.files_modified_count`.
  - `agent.verification.test_pass_rate_first_run`.
  - `agent.pr.review_rejection_count`.
  - `agent.hallucination_incidents_logged`.
- **Dashboards**: Pull Request Quality Dashboard tracking agent contribution velocity versus human review cycle times.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: agent_automated_pr_author_identity
  status: TO_VERIFY
  source_required: brand_owner
  impact: low
  temporary_assumption: "Agent contributions authored under dedicated bot user 'hbh-atelier-bot[bot]' with verified GPG commit signing"

unknown:
  field: llm_budget_for_continuous_evals
  status: TO_VERIFY
  source_required: brand_owner
  impact: low
  temporary_assumption: "Standard Gemini 1.5 Flash / Claude 3.5 Sonnet token budgets used for agentic engineering workflows"
```

## 14. Future Evolution
- Self-Healing CI Pipeline: Background agent automatically inspects test failure stack traces in CI, reproduces the failure in a local container, generates a minimal fix PR, and tags the author for review.
- Automated Architectural Regression Sentinel: AI bot that audits all incoming PRs against ADR guidelines and flags architectural drift before human review.

## 15. References
- Anthropic Claude Code Engineering Guidelines: https://docs.anthropic.com/
- OWASP Top 10 for Large Language Model Applications: https://owasp.org/www-project-top-10-for-large-language-model-applications/
- Martin Fowler on Effective Pair Programming: https://martinfowler.com/articles/on-pair-programming.html
