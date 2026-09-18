<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# 37_BACKUP_DR.md — Backup Engineering, Disaster Recovery & Business Continuity Architecture

## 1. Purpose
This document establishes the enterprise backup engineering standards, automated Point-in-Time Recovery (PITR) procedures, disaster recovery (DR) runbooks, and business continuity protocols for **Hampers by Her**. Gifting businesses operate against immutable calendar deadlines: losing order data during holiday surges or being unable to verify customer payments due to database corruption causes unrecoverable brand damage. This specification formalizes strict Recovery Point Objectives (RPO $\le$ 5 minutes) and Recovery Time Objectives (RTO $\le$ 30 minutes), defining automated database snapshot lifecycle management, S3 object versioning with MFA Delete, and step-by-step restoration sequences.

## 2. Scope
- **In-Scope**:
  - Amazon Aurora Serverless v2 PostgreSQL automated continuous backup and 35-day Point-in-Time Recovery (PITR).
  - Nightly encrypted database snapshots copied cross-region to AWS Europe/Frankfurt (`eu-central-1`) for ransomware air-gapping.
  - S3 Object Versioning and Lifecycle Rules for public product media and private customer polaroids.
  - S3 Object Lock (Compliance Mode) and MFA Delete on critical financial ledgers and invoices.
  - ElastiCache Redis replication and automated snapshotting.
  - Disaster Recovery Runbook: ordered multi-tier restoration protocol.
  - Reconciliation protocol with external payment gateways (Razorpay) and carriers (Shiprocket) post-recovery.
- **Out-of-Scope**:
  - Physical off-site magnetic tape storage (cloud-native AWS multi-region storage prioritized).

## 3. Context
Backups are an unverified hypothesis until a successful restore is demonstrated. Relying on basic SQL dumps without automated restore drills leads to silent backup failures (e.g., missing enum types, truncated blobs, broken foreign keys). Hampers by Her establishes an automated monthly restore test into an isolated sandbox database, mathematically verifying record counts and schema integrity.

```
[Production Aurora Cluster (ap-south-1)]
       │
       ├── Continuous WAL Archiving (5-min granular PITR)
       ├── Daily Automated Snapshot (02:00 IST) ──► KMS Re-encrypt
       │                                                 │
       │                                                 ▼ (AWS Backup Copy Job)
       └── Cross-Region Air-Gap ─────────────────► [Vault S3/RDS (eu-central-1)]
                                                         │
                                                         ▼ (Monthly Automated Drill)
                                                   [DR Sandbox Restore & Check]
```

## 4. Requirements
### 4.1 Functional Requirements
- **FR-BKP-01**: Continuous Transaction Log Archiving: Aurora PostgreSQL continuous WAL archiving enabling restoration to any millisecond within the past 35 days.
- **FR-BKP-02**: Cross-Region Air-Gapped Snapshots: Nightly automated job copying encrypted snapshots to secondary region (`eu-central-1`), protected by a separate AWS KMS key.
- **FR-BKP-03**: S3 Object Versioning & Delete Protection: Enable versioning on all S3 buckets; enable MFA Delete on `hbh-invoices-permanent` to prevent rogue or compromised admin credential deletion.
- **FR-BKP-04**: Post-Restore State Reconciliation: Following a database restore to timestamp $T$, an automated reconciliation worker queries Razorpay Payments API for transactions captured between $T$ and $T_{\text{now}}$, generating missing `orders` and `payments` records without manual intervention.
- **FR-BKP-05**: Automated Bi-Annual Disaster Drill: Scripted disaster simulation spinning up the full infrastructure stack in a staging account from cold backups.

### 4.2 Non-Functional Requirements
- **NFR-BKP-01**: Recovery Point Objective (RPO): Maximum allowable data loss window $\le 5\text{ minutes}$.
- **NFR-BKP-02**: Recovery Time Objective (RTO): Total time from disaster declaration to full customer traffic resumption $\le 30\text{ minutes}$.
- **NFR-BKP-03**: Backup Immutability: Backup snapshots locked via AWS Backup Vault Lock preventing modification or deletion even by root account users.

## 5. Architecture & Design

### 5.1 Disaster Recovery Tier Classification
| Asset / Tier | Backup Mechanism | Frequency | Retention Window | Storage Class / Region |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL Database**| Aurora Continuous PITR | Real-time WAL | 35 Days | Aurora Storage (`ap-south-1`) |
| **Air-Gap DB Snapshots**| AWS Backup Cross-Region | Daily (02:00 IST) | 90 Days | S3 Glacier (`eu-central-1`) |
| **Customer Gift Media**| S3 Versioning | Real-time | 365 Days | S3 Standard / Glacier Instant |
| **Invoices & Tax PDFs** | S3 Object Lock Compliance| Real-time | 7 Years (Statutory)| S3 Glacier Deep Archive |
| **Terraform State** | S3 Versioning + DynamoDB | On Every Commit | Indefinite | S3 Standard Encrypted |

### 5.2 Ordered Restoration Sequence
```
STEP 1: Infrastructure Plane
  └── Verify VPC, Subnets, Security Groups via Terraform apply
STEP 2: Database Restoration
  └── Restore Aurora Cluster to Target PITR Timestamp (aws rds restore-db-cluster-to-point-in-time)
STEP 3: Secrets & Encryption Verification
  └── Validate KMS Key Grants and AWS Secrets Manager Access
STEP 4: Application Container Spin-Up
  └── Deploy ECS Fargate Services (point to restored Aurora DB cluster endpoint)
STEP 5: Storage & Media Verification
  └── Mount CloudFront OAC to S3 versioned buckets
STEP 6: External Ledger Reconciliation
  └── Run reconciler script against Razorpay & Shiprocket APIs
STEP 7: Health Check Verification & DNS Cutover
  └── Verify /health/readiness ──► Route 53 DNS switch to live traffic
```

## 6. Business Rules
1. **Never Replay Destructive DDL on Live DB**: In case of accidental table drop or bad migration, do NOT attempt in-place data recovery. Always restore a parallel clone cluster, export the damaged table, and surgically import the missing records.
2. **Statutory 7-Year Tax Record Retention**: In accordance with the Indian Goods and Services Tax (GST) Act, all tax invoices, customer billing records, and payment logs must be preserved in tamper-proof immutable storage for a minimum of 7 fiscal years.
3. **Mandatory Post-Incident Post-Mortem**: Any disaster event requiring backup restoration mandates a blameless post-mortem document published within 48 hours detailing root cause, actual RTO/RPO achieved, and preventive action items.

## 7. Technical Details

### 7.1 Automated Point-in-Time Restore CLI Command
```bash
# Example restoration to 2 minutes prior to accidental corruption event
RESTORE_TIME="2026-09-18T08:15:00.000Z"

aws rds restore-db-cluster-to-point-in-time \
  --source-db-cluster-identifier hbh-aurora-postgres-prod \
  --target-db-cluster-identifier hbh-aurora-postgres-restored \
  --restore-to-time "${RESTORE_TIME}" \
  --db-subnet-group-name hbh-isolated-db-subnets \
  --vpc-security-group-ids sg-0191fa2b8a2171e0 \
  --kms-key-id arn:aws:kms:ap-south-1:123456789012:key/hbh-db-key
```

### 7.2 Post-Restore Razorpay Reconciliation Script (`scripts/reconcile-gateway.ts`)
```typescript
import Razorpay from 'razorpay';
import { PrismaClient } from '@prisma/client';

export async function reconcileMissingPayments(fromTimestampUnix: number): Promise<void> {
  const prisma = new PrismaClient();
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

  console.log(`Reconciling captured payments since ${new Date(fromTimestampUnix * 1000).toISOString()}...`);

  const payments = await razorpay.payments.all({
    from: fromTimestampUnix,
    count: 100,
  });

  for (const payment of payments.items) {
    if (payment.status === 'captured') {
      const existing = await prisma.payment.findUnique({
        where: { gatewayPaymentId: payment.id },
      });

      if (!existing) {
        console.warn(`Discrepancy found! Re-hydrating payment record for ${payment.id}...`);
        await prisma.payment.create({
          data: {
            gatewayPaymentId: payment.id,
            gatewayOrderId: payment.order_id,
            amountPaise: BigInt(payment.amount),
            currency: payment.currency,
            status: 'CAPTURED',
            paymentMethod: payment.method.toUpperCase(),
            metadata: payment,
          },
        });
      }
    }
  }
}
```

## 8. Dependencies
- **Cloud Services**: Amazon Aurora Serverless v2, AWS Backup, AWS S3, AWS KMS, AWS Route 53.
- **External Dependencies**: Razorpay Payments API, Shiprocket Logistics API.

## 9. Security
- **Air-Gap IAM Isolation**: The secondary cross-region backup vault in `eu-central-1` is governed by a restricted IAM role that cannot be deleted or assumed by standard developer credentials.
- **KMS Key Segregation**: Backup snapshots are re-encrypted with a dedicated DR KMS key during cross-region replication, protecting against primary region key compromise.

## 10. Failure Modes & Resilience
1. **Ransomware / Malicious Root Credential Compromise**: AWS Backup Vault Lock prevents snapshot deletion even by the AWS account root user until the legal retention period expires.
2. **Accidental Production Table Truncation**: Engineers identify the exact timestamp of truncation, initiate PITR to 60 seconds prior, clone the restored table, and re-insert into the active production cluster within 20 minutes.

## 11. Testing (DR Drills & Verification)
- **Monthly Automated Restore Validation**: AWS Lambda periodically spins up a temporary Aurora instance from the latest snapshot, executes a test suite verifying table row counts, and terminates the temporary instance.
- **Bi-Annual Regional Outage Drill**: Simulating complete loss of Mumbai AZ-1a and AZ-1b, validating traffic cutover to surviving AZs.

## 12. Observability & Monitoring
- **Metrics Tracked**:
  - `aws.backup.job_status` (Daily alert on failure).
  - `aurora.backup_retention_period_days`.
  - `s3.replication_latency_seconds`.
- **Alerts**: Immediate P0 PagerDuty alert if AWS Backup daily snapshot job fails.

## 13. Open Questions & Unknowns
```yaml
unknown:
  field: secondary_aws_region_selection
  status: TO_VERIFY
  source_required: brand_owner
  impact: low
  temporary_assumption: "AWS Europe (Frankfurt) eu-central-1 selected as secondary air-gap region; can be relocated to Hyderabad ap-south-2 if domestic residency mandated"

unknown:
  field: statutory_gst_auditor_data_format
  status: TO_VERIFY
  source_required: brand_owner
  impact: low
  temporary_assumption: "Standard GSTR-1 compliant JSON/CSV exports archived alongside raw invoices"
```

## 14. Future Evolution
- Automated Instant Database Cloning: Utilizing Aurora Fast Clone for zero-copy staging database refreshes.
- Active-Active Multi-Region Aurora Global Databases if overseas international diaspora gifting reaches $>30\%$ of total revenue.

## 15. References
- AWS Disaster Recovery of Workloads in the Cloud: https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-of-workloads-on-aws/
- Amazon Aurora Backups and Restoration: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Managing.Backups.html
- India Goods and Services Tax (GST) Record Retention Rules: https://www.cbic.gov.in/
