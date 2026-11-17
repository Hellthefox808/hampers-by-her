# RISK REGISTER & MITIGATION MATRIX — Hampers by Her

## 1. Enterprise Risk Scoring Methodology
Risks are evaluated using a standard $5\times 5$ matrix:  
$$\text{Risk Score} = \text{Likelihood (1–5)} \times \text{Impact (1–5)}$$
- **High Risk**: Score $15$–$25$ (Requires active automated controls & architectural mitigation)
- **Medium Risk**: Score $8$–$14$ (Requires monitoring, runbooks, and fallback strategies)
- **Low Risk**: Score $1$–$7$ (Acceptable baseline with operational logging)

---

## 2. Active Risk Register

| Risk ID | Category | Risk Description | Likelihood | Impact | Score | Automated Mitigation & Architectural Defense |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **RSK-001** | Payments | Primary payment gateway downtime during viral holiday drop | 3 | 5 | **15** | Sub-second Smart Router failover (`smartRouter.js`) shifts traffic to Cashfree/Stripe when success rate drops below 85%. |
| **RSK-002** | Inventory | Concurrency race condition overselling bespoke limited inventory | 3 | 4 | **12** | Redis check-and-reserve atomic locks (`atomicInventoryLock.js`) with alphabetical resource key ordering to eliminate deadlocks. |
| **RSK-003** | Logistics | Non-Delivery Reports (NDR) causing customer disputes | 3 | 4 | **12** | Automated WhatsApp HSM recovery workflow triggered immediately upon carrier webhook dispatching NDR status (`logisticsCourierService.js`). |
| **RSK-004** | Security | Prompt injection or adversarial jailbreak of Voice AI concierge | 2 | 4 | **8** | Phase 07 sanitization gate in `agentOrchestrator.js` intercepts known attack markers and terminates session before execution. |
| **RSK-005** | Resilience | Hard container crash causing data corruption of order history | 2 | 4 | **8** | Atomic file replacement (`fs.renameSync`) in `persistenceEngine.js` writes to temporary disk location before atomic swap. |
| **RSK-006** | Traffic | Sudden viral Instagram reel causing cache stampede on catalog | 4 | 3 | **12** | SingleFlight request coalescing (`cacheGrid.js`) ensures only 1 upstream query executes while 10,000 requests await shared result. |
| **RSK-007** | Quality | Accidental dispatch of uninspected bespoke luxury hamper | 2 | 5 | **10** | Mandatory Photographic QC Gate (`adminService.js`) enforces photo upload before order status can transition to `QUALITY_CHECKED`. |
