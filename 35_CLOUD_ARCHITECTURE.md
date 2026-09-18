<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 35_CLOUD_ARCHITECTURE.md — AWS Cloud Infrastructure, Network Topology & High-Availability Design

## 1. Purpose
This document establishes the cloud infrastructure topology, high-availability architecture, network boundaries, and cost optimization models for **Hampers by Her**. Designed for enterprise-grade reliability without premature distributed systems complexity, this architecture provisions a scalable, secure, and compliant cloud footprint on Amazon Web Services (AWS) in the `ap-south-1` (Mumbai) region. This specification governs DNS routing via Route 53, edge acceleration and DDoS defense via CloudFront + AWS WAF, containerized application runtimes on AWS ECS Fargate, managed relational data stores on Amazon Aurora Serverless v2 PostgreSQL, and in-memory caching via Amazon ElastiCache Redis.

## 2. Scope
- **In-Scope**:
  - AWS Region selection (`ap-south-1` Mumbai) and multi-Availability Zone (AZ) resilience.
  - Edge routing: Route 53 latency/failover routing, ACM TLS 1.3 certificates, CloudFront CDN, and AWS WAF rate-limiting rules.
  - VPC network architecture: 3-tier subnet topology (Public, Private Application, Isolated Database) across 3 AZs (`ap-south-1a`, `ap-south-1b`, `ap-south-1c`).
  - Application tier: AWS Application Load Balancer (ALB) routing to ECS Fargate container clusters running Next.js 15 SSR and NestJS Fastify core API.
  - Asynchronous background worker tier: ECS Fargate BullMQ queue consumers.
  - Database tier: Amazon Aurora Serverless v2 PostgreSQL with automated Multi-AZ failover and continuous backup.
  - Caching & queue tier: Amazon ElastiCache Serverless Redis cluster.
  - Object storage tier: Amazon S3 buckets (Public Derivatives and Private Customer Uploads) with Origin Access Control (OAC).
  - Secrets & key management: AWS Secrets Manager and AWS KMS.
- **Out-of-Scope**:
  - Running self-managed EC2 instances (100% serverless / container-managed abstractions).
  - Multi-region active-active database replication in MVP.

## 3. Context
Commerce platforms must deliver uninterrupted checkout during high-stakes holiday surges (e.g., Diwali gift drops, Valentine's Day eve) while avoiding hundreds of thousands of rupees in idle infrastructure bills during off-peak periods. Hampers by Her establishes an elastic serverless container architecture that scales up dynamically from 2 containers to 12 containers within 90 seconds of load detection, and scales back down when traffic subsides.

```
                     [Global / India Internet Traffic]
                                     │
                                     ▼
                     [Route 53 DNS + ACM TLS 1.3]
                                     │
                                     ▼
                     [AWS WAF] (Rate Limits, Bot Control)
                                     │
                                     ▼
                 [Amazon CloudFront CDN (Global Edge)]
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼ (Static / Media)                      ▼ (Dynamic / API)
         [Amazon S3 Buckets]                  [Application Load Balancer]
      (Catalog Derivatives & Assets)                     │
                                                         ▼
                                       ┌───────────────────────────────────┐
                                       │ AWS VPC (ap-south-1 / 3 Multi-AZ) │
                                       │                                   │
                                       │   [Private App Subnets]           │
                                       │   ├── Next.js SSR Tasks (Fargate) │
                                       │   ├── NestJS API Tasks (Fargate)  │
                                       │   └── Worker Tasks (BullMQ)       │
                                       │                                   │
                                       │   [Isolated DB Subnets]           │
                                       │   ├── Aurora Serverless v2 PG     │
                                       │   └── ElastiCache Redis Cluster   │
                                       └───────────────────────────────────┘
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-CLD-01**: Multi-AZ High Availability: All infrastructure components must span across at least two Availability Zones (`ap-south-1a` and `ap-south-1b`).
- **FR-CLD-02**: Traffic Segregation: Separate public-facing traffic (`hampersbyher.com`), admin operations (`admin.hampersbyher.com`), API gateways (`api.hampersbyher.com`), and media assets (`cdn.hampersbyher.com`).
- **FR-CLD-03**: Auto-Scaling Policies: ECS Fargate services scale dynamically based on Target Tracking Scaling (average CPU utilization target = 65%; ALB request count target = 1,000 req/min per task).
- **FR-CLD-04**: Egress Traffic Lockdown: Backend containers reside in private subnets with no public IP addresses; outbound traffic to external payment gateways (Razorpay) and Meta APIs routes strictly via dual AWS NAT Gateways.
- **FR-CLD-05**: Disaster Recovery RTO & RPO: Recovery Point Objective (RPO) $\le 5\text{ minutes}$; Recovery Time Objective (RTO) $\le 30\text{ minutes}$.

### 4.2 Non-Functional Requirements
- **NFR-CLD-01**: Uptime SLA: 99.95% availability for commercial checkout routes (maximum allowable unplanned downtime $< 22$ minutes/month).
- **NFR-CLD-02**: Cold Start & Provisioning: New ECS Fargate tasks must pass health checks and accept live production traffic within 45 seconds of launch.
- **NFR-CLD-03**: Cost Efficiency: Baseline off-peak cloud infrastructure cost maintained under ₹20,000/month (~$240 USD).

## 5. Architecture & Design

### 5.1 Subnet Architecture & IP Address Management (IPAM)
| Subnet Name | Availability Zone | CIDR Block | Route Table Target | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `public-1a` | `ap-south-1a` | `10.0.1.0/24` | Internet Gateway | ALB, NAT Gateway A |
| `public-1b` | `ap-south-1b` | `10.0.2.0/24` | Internet Gateway | ALB, NAT Gateway B |
| `public-1c` | `ap-south-1c` | `10.0.3.0/24` | Internet Gateway | Spares |
| `app-private-1a`| `ap-south-1a` | `10.0.10.0/24`| NAT Gateway A | ECS Next.js & NestJS |
| `app-private-1b`| `ap-south-1b` | `10.0.11.0/24`| NAT Gateway B | ECS Next.js & NestJS |
| `app-private-1c`| `ap-south-1c` | `10.0.12.0/24`| NAT Gateway A | Background Workers |
| `db-isolated-1a`| `ap-south-1a` | `10.0.20.0/24`| Local Only | Aurora PostgreSQL Primary |
| `db-isolated-1b`| `ap-south-1b` | `10.0.21.0/24`| Local Only | Aurora PostgreSQL Replica |
| `db-isolated-1c`| `ap-south-1c` | `10.0.22.0/24`| Local Only | ElastiCache Redis Cluster |

### 5.2 Security Group Ingress / Egress Matrix
```
[Internet] ── HTTPS 443 ──► [ALB Security Group]
                                   │
                                   ▼ TCP 3000 / 4000
                       [ECS App Security Group]
                                   │
                    ┌──────────────┴──────────────┐
                    ▼ TCP 5432                    ▼ TCP 6379
          [Aurora DB SG]               [Redis Cache SG]
          (Ingress strictly            (Ingress strictly
           from ECS App SG)             from ECS App SG)
```

## 6. Business Rules
1. **Production Isolation**: Production and Staging environments reside in separate AWS accounts within an AWS Organization to ensure developer experimentation can never impact production databases or customer orders.
2. **KMS Customer Managed Keys (CMK)**: All production storage (Aurora tablespaces, S3 buckets, ElastiCache volumes, EBS task volumes) must be encrypted using customer-managed KMS keys with automated annual rotation.
3. **Budget Alarms**: AWS Cost Anomaly Detection triggers an instant high-priority Slack notification if daily projected spend deviates by more than 25% from historical baselines.

## 7. Technical Details

### 7.1 Terraform Multi-AZ ECS Fargate Cluster Definition
```hcl
resource "aws_ecs_cluster" "commerce_cluster" {
  name = "hbh-commerce-production"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_service" "api_service" {
  name            = "hbh-backend-api"
  cluster         = aws_ecs_cluster.commerce_cluster.id
  task_definition = aws_ecs_task_definition.backend_api.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = [aws_subnet.app_private_1a.id, aws_subnet.app_private_1b.id]
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend_tg.arn
    container_name   = "nestjs-api"
    container_port   = 4000
  }

  deployment_controller {
    type = "ECS"
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  lifecycle {
    ignore_changes = [desired_count]
  }
}
```

### 7.2 Aurora Serverless v2 PostgreSQL Configuration
```hcl
resource "aws_rds_cluster" "aurora_postgres" {
  cluster_identifier      = "hbh-aurora-postgres-prod"
  engine                  = "aurora-postgresql"
  engine_version          = "16.2"
  database_name           = "hbh_prod"
  master_username         = "hbh_admin"
  manage_master_user_password = true
  db_subnet_group_name    = aws_db_subnet_group.isolated_db.name
  vpc_security_group_ids  = [aws_security_group.aurora_db.id]
  storage_encrypted       = true
  kms_key_id              = aws_kms_key.database_key.arn
  backup_retention_period = 30
  preferred_backup_window = "19:00-20:00" # 00:30-01:30 IST

  serverlessv2_scaling_configuration {
    min_capacity = 0.5  # 1 GB RAM (Off-peak savings)
    max_capacity = 16.0 # 32 GB RAM (Surge capacity)
  }
}
```

## 8. Dependencies
- **Cloud Provider**: Amazon Web Services (AWS) Asia Pacific (Mumbai) `ap-south-1`.
- **Upstream Modules**: `DevOpsModule`, `CI_CDModule`, `DatabaseDesign`.
- **Core AWS Services**: Route 53, CloudFront, WAF, ALB, ECS Fargate, ECR, Aurora Serverless v2, ElastiCache Redis, S3, Secrets Manager, KMS, CloudWatch.

## 9. Security (Network Hardening & Blast Radius Controls)
- **Zero Public IP for Compute**: All ECS tasks run without public IPs; outbound network connectivity is proxied exclusively through redundant NAT Gateways.
- **Origin Access Control (OAC)**: Public S3 asset buckets reject any direct web requests; only authenticated requests signed by the CloudFront service principal are granted `s3:GetObject` permissions.
- **WAF Managed Rule Sets**: AWS WAF inspects all inbound requests, applying:
  - `AWSManagedRulesCommonRuleSet` (OWASP Core Protection).
  - `AWSManagedRulesKnownBadInputsRuleSet` (SQLi, Log4j, Remote File Inclusion).
  - `AWSManagedRulesAmazonIpReputationList` (Tor exit nodes, known botnets).

## 10. Failure Modes & Resilience
1. **Single Availability Zone Failure in Mumbai**: If AWS experiences a physical power or network outage in AZ `ap-south-1a`, Route 53 and the ALB automatically divert all traffic to `ap-south-1b`. Aurora Serverless automatically promotes the read replica in `1b` to Primary writer within 30 seconds.
2. **Database Primary Crash**: Aurora Serverless v2 executes automatic failover to the replica instance in under 35 seconds without data loss, utilizing shared distributed storage volume.

## 11. Testing (Cloud & Infrastructure Audits)
- **Multi-AZ Failover Drills**: Executing manual cluster failover (`aws rds failover-db-cluster`) on Staging during pre-release testing to verify zero broken transactions.
- **WAF Rate Limit Penetration**: Simulating rapid request floods using k6 to confirm that the WAF returns HTTP 403 Forbidden after 300 requests.

## 12. Observability & Monitoring
- **Metrics Tracked**:
  - `aws.alb.target_response_time_p95`.
  - `aws.ecs.cpu_utilization` and `aws.ecs.memory_utilization`.
  - `aws.aurora.serverless_database_capacity_acua`.
  - `aws.elasticache.cache_hits_vs_misses`.
- **Dashboards**: CloudWatch Executive Operational Cockpit displaying live infrastructure health and estimated monthly spend tracker.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: corporate_firewall_vpn_requirement
  status: TO_VERIFY
  source_required: brand_owner
  impact: low
  temporary_assumption: "Standard AWS WAF IP whitelisting sufficient for workshop/admin access; dedicated AWS Client VPN deferred"

unknown:
  field: domain_name_registrar_transfer
  status: TO_VERIFY
  source_required: brand_owner
  impact: high
  temporary_assumption: "DNS nameservers delegated to Route 53 hosted zone while domain registration remains with current registrar (GoDaddy / Namecheap)"
```

## 14. Future Evolution
- Multi-Region Read Replicas deployed in AWS Europe (Frankfurt) or North America (Virginia) if international diaspora gifting traffic grows significantly.
- Automated spot-fleet task execution for non-critical image processing workers to reduce compute costs by 60%.

## 15. References
- AWS Architecture Center (D2C Retail & Ecommerce Best Practices): https://aws.amazon.com/architecture/
- Amazon Aurora Serverless v2 Architecture: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html
- AWS WAF Security Automations: https://aws.amazon.com/solutions/implementations/aws-waf-security-automations/
