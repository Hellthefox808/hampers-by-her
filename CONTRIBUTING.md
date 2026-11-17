# CONTRIBUTING.md — Hampers by Her Engineering Standards & Contribution Guide

Welcome to the **Hampers by Her** engineering repository. This document establishes the guidelines, workflows, and quality contracts required to contribute to the digital commerce platform and artisanal operating system.

---

## 1. Operating Identity & Core Tenets

All engineering contributions must adhere to the **Zero-Placeholder Law**:
- **Never submit stubs or placeholders**: `// TODO`, `...`, and truncated configurations are strictly forbidden.
- **Everything Is Connected**: Features are complete only when all 10 layers (Frontend $\rightarrow$ State $\rightarrow$ API $\rightarrow$ Backend $\rightarrow$ Domain Services $\rightarrow$ Database $\rightarrow$ Events $\rightarrow$ Integrations $\rightarrow$ Observability $\rightarrow$ Docs) are operational.
- **Anti-Hallucination Protocol**: Unknown business parameters must be recorded in the `unknown:` registry rather than guessed.

---

## 2. 10-Step Autonomous Engineering Loop

Every session, pull request, or feature development must follow this sequential loop:
1. **UNDERSTAND**: Read requirements and determine intent without assumptions.
2. **DISCOVER**: Inspect repository context, `.agent/context/current-state.md`, and code.
3. **TRACE DEPENDENCIES**: Map affected dependencies across all layers.
4. **PLAN**: Formulate clear architectural plan with upfront verification criteria.
5. **IMPLEMENT**: Make atomic, surgically precise, TypeScript-strict modifications.
6. **VALIDATE**: Run the smallest relevant test script immediately.
7. **TEST**: Run full regression test suite (`npm test`).
8. **REVIEW**: Confirm zero leaked secrets, zero console noise, zero unverified claims.
9. **DOCUMENT**: Synchronize all affected specifications in root and `/docs/`.
10. **CHECKPOINT**: Update `.agent/context/current-state.md` and follow-up registers.

---

## 3. Git Workflow & Commit Standards

### 3.1 Branching Strategy
- `main`: Production-ready, fully verified branch. Direct pushes are restricted.
- `feat/<feature-name>`: New capabilities (e.g., `feat/dynamic-upi-routing`).
- `fix/<bug-name>`: Bug fixes (e.g., `fix/cart-price-drift`).
- `infra/<infra-name>`: Infrastructure and DevOps modifications (e.g., `infra/k8s-manifests`).

### 3.2 Commit Message Convention
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```text
<type>(<scope>): <short description in imperative mood>

[optional body explaining technical reasoning]

[optional footer referencing ADR or issue]
```
Allowed types: `feat`, `fix`, `perf`, `refactor`, `infra`, `docs`, `test`, `chore`.

---

## 4. Local Development Environment

### 4.1 Prerequisites
- Node.js 22 LTS or higher
- Docker & Docker Compose v2+
- Git 2.40+

### 4.2 Quickstart
```bash
# Clone the repository
git clone https://github.com/hampersbyher/atelier-commerce.git
cd atelier-commerce

# Install dependencies
npm install

# Start local full-stack development environment (App + Postgres + Redis + LocalStack)
docker compose up -d

# Verify all quality gates pass
npm run verify
```

---

## 5. Quality Verification Gates

Prior to opening a pull request, run the master quality pipeline:
```bash
npm run verify
```
This executes:
1. `npm run audit:docs`: 100% compliance across all 44 core specifications against Section 40.
2. `npm test`: 219+ tests passing with 0 failures across all 61 test suites.
3. `npm run build:apk`: Verification of the native Android Voice AI application artifact.

Pull requests failing any of these gates will be rejected automatically by CI.
