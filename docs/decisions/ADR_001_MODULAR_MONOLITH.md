<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# ADR 001: Adoption of Modular Monolith Architecture

## Status
APPROVED

## Date
2026-09-18

## Context
Hampers by Her is transitioning from an unorganized Instagram DM/WhatsApp manual selling process to an automated, high-conversion digital commerce platform. During holiday campaigns (Rakhi, Diwali, Valentine's, New Year), order volume can spike 10x–20x. 

The engineering team evaluated three primary architectural topologies:
1. **Microservices Architecture**: Separate services for Auth, Catalog, Builder, Cart, Orders, Payments, Notifications, and Logistics.
2. **Pure Serverless (AWS Lambda + DynamoDB)**: Cold starts during checkout, eventual consistency complexity, and distributed state limitations.
3. **Modular Monolith (NestJS / Fastify + PostgreSQL + Redis)**: Single deployable artifact with strictly enforced domain boundaries, in-memory interfaces, and asynchronous event queues.

## Decision
We adopt the **Modular Monolith** architecture pattern.
- The platform will run as containerized services on AWS ECS Fargate.
- Domain modules (Catalog, Hamper Builder, Pricing, Orders, Payments, CRM, WhatsApp) reside in a single codebase under `src/modules/`.
- Cross-module communication is restricted to exported TypeScript interfaces for queries and an in-memory/Redis event bus for domain events.
- Direct database cross-joins across module repository boundaries are prohibited via ESLint architectural guardrails.

## Consequences
### Positive
- High developer velocity and simplified local testing (single database connection, single command to run the entire backend).
- Strict ACID transaction guarantees during checkout (cart, inventory decrement, and order creation occur in a single atomic database transaction).
- Zero distributed transaction sagas or two-phase commit overhead.
- Predictable operational cost (avoiding microservice infrastructure bloat).

### Negative / Trade-Offs
- The entire application is deployed as a single unit (mitigated via zero-downtime blue/green deployments on ECS Fargate).
- Requires discipline to prevent code leakage across boundaries (enforced by automated architectural linting in CI/CD).

## Compliance & Future Path
If a specific module (such as the 11-step Hamper Builder or the WhatsApp webhook consumer) encounters independent CPU or memory scaling bottlenecks in the future, its bounded context is already decoupled and can be carved out into an independent microservice with minimal refactoring.
