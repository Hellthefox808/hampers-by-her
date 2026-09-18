# INFRASTRUCTURE STATE — Hampers by Her

## 1. Cloud Architecture (AWS ap-south-1 Mumbai)
- **Compute**: AWS ECS Fargate running multi-stage Docker containers for Next.js and NestJS.
- **Relational Database**: Amazon Aurora PostgreSQL Serverless v2 across 2 Availability Zones.
- **In-Memory Cache**: Amazon ElastiCache for Redis 7.2 (cluster mode disabled, 1 primary + 1 replica).
- **Object Storage & CDN**: Amazon S3 private bucket for media + CloudFront CDN with TLS 1.3 and Origin Access Control (OAC).

## 2. Infrastructure as Code (IaC)
- **Tool**: Terraform v1.8+ (`33_DEVOPS.md`, `35_CLOUD_ARCHITECTURE.md`).
- **State Backend**: S3 bucket with DynamoDB state locking.

## 3. Environment Strategy
- **Development**: Local Docker Compose with PostgreSQL 16, Redis 7.2, and LocalStack.
- **Staging**: `staging.hampersbyher.com` on AWS ECS Fargate.
- **Production**: `hampersbyher.com` with auto-scaling (min 2, max 10 tasks) for festival traffic bursts.
