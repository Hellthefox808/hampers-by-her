<!-- HAMPERS BY HER | PULL REQUEST TEMPLATE -->
## 1. Description & Context
Provide a concise summary of the changes, architectural reasoning, and business intent.

## 2. Type of Change
- [ ] `feat`: New customer-facing or platform capability
- [ ] `fix`: Bug fix with reproduction test case
- [ ] `perf`: Measured performance or algorithmic optimization
- [ ] `refactor`: Structural improvement without behavioral regression
- [ ] `infra`: Infrastructure as Code, Docker, or CI/CD pipeline modification
- [ ] `docs`: Architectural specification or documentation synchronization

## 3. Section 81 Definition of Done Checklist
- [ ] **Tests**: Smallest unit/integration test added and passes (`npm test`).
- [ ] **Full Regression**: All 219+ automated regression tests pass cleanly.
- [ ] **Section 40 Audit**: All 44 core specifications compliant (`npm run audit:docs`).
- [ ] **Security**: OWASP ASVS verification complete; zero plain-text secrets or API keys.
- [ ] **Non-Root**: Docker container executions run under unprivileged user (`node`).
- [ ] **Performance**: Response times within budget ($LCP \le 2.2$s, $INP \le 150$ms, API $p99 \le 500$ms).
- [ ] **Documentation**: Affected root markdown and `docs/` specifications updated.
- [ ] **Context Harness**: `.agent/context/current-state.md` and follow-up ledgers synchronized.

## 4. Verification Evidence & Test Output
```text
Paste terminal output from `npm run verify` here.
```
