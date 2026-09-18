<!-- HAMPERS-BY-HER | E2E COMMERCE SYSTEM | DOCUMENT CONTROLLED -->
# RECOVERY_RUNBOOK.md — Disaster Recovery, Emergency Procedures & System Restoration Playbook

## 1. Purpose
This runbook provides emergency operational procedures, copy-pasteable AWS CLI commands, and incident mitigation workflows for restoring the **Hampers by Her** digital commerce platform following a major disaster, critical data corruption, payment gateway failure, or severe infrastructure outage. It operationalizes the principles defined in `37_BACKUP_DR.md` and `42_DEPLOYMENT_RUNBOOK.md`.

## 2. Emergency Escalation Quorum
In the event of a Severity 1 (P0) incident:
1. **Primary On-Call SRE / DevOps Lead**: Initiates incident bridge and assesses infrastructure state.
2. **Lead Software Architect**: Directs recovery playbook selection and database cutover.
3. **Head of Atelier Operations**: Manages physical studio dispatch holds and manual WhatsApp customer notifications.
4. **Brand Founder**: Authorizes public maintenance notices or emergency transaction freezes.

---

## 3. Playbook 1: Aurora PostgreSQL Point-in-Time Recovery (PITR)
**Trigger Condition**: Catastrophic database corruption, accidental table drop, or ransomware incident.

```bash
#!/usr/bin/env bash
# Variables
RESTORE_TIME="2026-09-18T10:00:00Z" # Exact UTC timestamp prior to corruption
SOURCE_CLUSTER="hampers-by-her-prod-aurora"
TARGET_CLUSTER="hampers-by-her-prod-aurora-restored-$(date +%s)"
TARGET_INSTANCE="hampers-by-her-prod-aurora-restored-inst-1"

echo "Step 1: Initiating Aurora Point-in-Time Recovery..."
aws rds restore-db-cluster-to-point-in-time \
  --source-db-cluster-identifier "$SOURCE_CLUSTER" \
  --db-cluster-identifier "$TARGET_CLUSTER" \
  --restore-type "copy-on-write" \
  --restore-to-time "$RESTORE_TIME" \
  --db-subnet-group-name "hampers-by-her-prod-db-subnets" \
  --vpc-security-group-ids "sg-aurora-postgres" \
  --region ap-south-1

echo "Step 2: Waiting for restored cluster to become available..."
aws rds wait db-cluster-available \
  --db-cluster-identifier "$TARGET_CLUSTER" \
  --region ap-south-1

echo "Step 3: Creating primary DB instance in restored cluster..."
aws rds create-db-instance \
  --db-cluster-identifier "$TARGET_CLUSTER" \
  --db-instance-identifier "$TARGET_INSTANCE" \
  --db-instance-class "db.serverless" \
  --engine "aurora-postgresql" \
  --region ap-south-1

aws rds wait db-instance-available \
  --db-instance-identifier "$TARGET_INSTANCE" \
  --region ap-south-1

echo "Step 4: Update Route 53 private DNS record or ECS DATABASE_URL secret..."
# Fetch new cluster endpoint
NEW_ENDPOINT=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$TARGET_CLUSTER" \
  --query 'DBClusters[0].Endpoint' \
  --output text \
  --region ap-south-1)

echo "Restored Database Endpoint: $NEW_ENDPOINT"
echo "Step 5: Run Razorpay payment reconciliation job to sync orders placed during restore window:"
# Trigger ECS reconciliation worker
aws ecs run-task \
  --cluster hampers-by-her-prod-cluster \
  --task-definition hampers-by-her-worker-task:latest \
  --launch-type FARGATE \
  --overrides '{"containerOverrides": [{"name": "worker", "command": ["npm", "run", "reconcile:payments"]}]}' \
  --region ap-south-1
```

---

## 4. Playbook 2: ElastiCache Redis Cluster Flush & Cold-Start Rehydration
**Trigger Condition**: Redis memory corruption, corrupted cache keys, or cluster crash.

```bash
# Step 1: Flush corrupted cache keys without dropping persistent reservation keys
# Connect via AWS Systems Manager Bastion:
redis-cli -h hampers-by-her-prod-redis.cache.amazonaws.com -p 6379 -a "$REDIS_AUTH_TOKEN" --tls

# Flush ephemeral search and category cache keys
EVAL "for i, name in ipairs(redis.call('KEYS', 'cache:*')) do redis.call('DEL', name) end" 0

# Step 2: In case of catastrophic Redis node failure, restart cluster via AWS CLI:
aws elasticache reboot-cache-cluster \
  --cache-cluster-id "hampers-by-her-prod-redis-001" \
  --region ap-south-1

# Step 3: Application service automatically rehydrates catalog from Aurora upon cache miss
```

---

## 5. Playbook 3: Payment Webhook Outage & Offline Reconciliation
**Trigger Condition**: Webhook listener down, Razorpay network drop, or signature mismatch spike.

```bash
# Step 1: Inspect failed webhooks in Dead-Letter Queue (DLQ)
aws sqs receive-message \
  --queue-url "https://sqs.ap-south-1.amazonaws.com/123456789012/hampers-by-her-webhook-dlq" \
  --max-number-of-messages 10 \
  --region ap-south-1

# Step 2: Trigger server-side Razorpay polling reconciliation
# Queries Razorpay API directly for all payments captured in the last 6 hours:
aws ecs run-task \
  --cluster hampers-by-her-prod-cluster \
  --task-definition hampers-by-her-cron-task:latest \
  --launch-type FARGATE \
  --overrides '{"containerOverrides": [{"name": "cron", "command": ["node", "dist/scripts/razorpay-reconciliation.js", "--hours=6"]}]}' \
  --region ap-south-1
```

---

## 6. Playbook 4: Emergency CloudFront WAF DDoS / Bot Attack Lockdown
**Trigger Condition**: Scraping attack, inventory cart-hoarding bot assault, or HTTP 5xx flood.

```bash
# Step 1: Apply emergency rate limit rule (100 requests per 5 minutes per IP)
aws wafv2 update-web-acl \
  --scope CLOUDFRONT \
  --id "waf-hampers-by-her-core" \
  --name "HampersByHerWAF" \
  --default-action Allow={} \
  --region us-east-1 \
  --cli-input-json file://emergency-rate-limit-waf.json

# Step 2: Block offending autonomous ASNs or high-risk IP ranges
aws wafv2 update-ip-set \
  --scope CLOUDFRONT \
  --name "HampersByHerBlockedIPs" \
  --id "ip-set-blocked" \
  --addresses "198.51.100.0/24" "203.0.113.0/24" \
  --region us-east-1

# Step 3: Flush edge cache
aws cloudfront create-invalidation \
  --distribution-id E1A2B3C4D5E6F7 \
  --paths "/*"
```

---

## 7. Playbook 5: Compromised Credentials Emergency Revocation
**Trigger Condition**: Accidental public commit of API keys or detected token leakage.

```bash
# Step 1: Immediately rotate IAM User access keys
aws iam update-access-key --access-key-id "AKIAIOSFODNN7EXAMPLE" --status Inactive
aws iam delete-access-key --access-key-id "AKIAIOSFODNN7EXAMPLE"

# Step 2: Force immediate rotation of secrets in AWS Secrets Manager
aws secretsmanager rotate-secret \
  --secret-id "hampers-by-her/prod/razorpay" \
  --region ap-south-1

aws secretsmanager rotate-secret \
  --secret-id "hampers-by-her/prod/meta-token" \
  --region ap-south-1

# Step 3: Restart ECS services to inject new rotated secrets into container runtime
aws ecs update-service \
  --cluster hampers-by-her-prod-cluster \
  --service hampers-by-her-prod-api \
  --force-new-deployment \
  --region ap-south-1
```

---

## 8. Incident Post-Mortem Standard
Within 24 hours of resolving any Severity 1 incident, the team must complete a Blameless Post-Mortem document cataloging:
1. Root Cause Summary (5 Whys Analysis).
2. Timeline of events (Detection, Escalation, Mitigation, Resolution).
3. Financial & Customer Impact (Orders delayed, payments pending).
4. Action Items & Preventative Engineering tickets.

<!-- DOCUMENT END: RECOVERY_RUNBOOK.md -->
