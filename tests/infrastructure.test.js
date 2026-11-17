/**
 * Hampers by Her — Production Infrastructure, Docker & IaC Verification Test Suite
 * Validates Dockerfile security posture, docker-compose topology, Terraform IaC
 * modules, SRE Prometheus alerting rules, and deployment automation scripts.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

describe("Hampers by Her Production Infrastructure & DevOps Suite", () => {
  const rootDir = path.resolve(__dirname, "..");
  const dockerfilePath = path.join(rootDir, "Dockerfile");
  const dockerignorePath = path.join(rootDir, ".dockerignore");
  const dockerComposePath = path.join(rootDir, "docker-compose.yml");
  const terraformDir = path.join(rootDir, "infra", "terraform");
  const prometheusConfigPath = path.join(rootDir, "infra", "observability", "prometheus.yml");
  const alertsConfigPath = path.join(rootDir, "infra", "observability", "alerts.yml");
  const deployVerifyScriptPath = path.join(rootDir, "infra", "scripts", "deploy_verify.sh");
  const backupRestoreScriptPath = path.join(rootDir, "infra", "scripts", "backup_restore.sh");

  // ---------------------------------------------------------------------------
  // 1. Dockerfile Security & Multi-Stage Architecture
  // ---------------------------------------------------------------------------
  describe("1. Dockerfile Production Hardening", () => {
    test("Dockerfile exists and is non-empty", () => {
      assert.ok(fs.existsSync(dockerfilePath), "Dockerfile must exist");
      const content = fs.readFileSync(dockerfilePath, "utf8");
      assert.ok(content.length > 500, "Dockerfile should contain complete configuration");
    });

    test("Enforces 3-stage multi-stage build (dependencies -> builder -> runner)", () => {
      const content = fs.readFileSync(dockerfilePath, "utf8");
      assert.ok(content.includes("AS dependencies"), "Must have dependencies stage");
      assert.ok(content.includes("AS builder"), "Must have builder verification stage");
      assert.ok(content.includes("AS runner"), "Must have hardened runner stage");
    });

    test("Enforces unprivileged non-root user execution (USER node)", () => {
      const content = fs.readFileSync(dockerfilePath, "utf8");
      assert.ok(content.includes("USER node"), "Container must drop root privileges to node user");
      assert.ok(content.includes("--chown=node:node"), "Files must be owned by node user");
    });

    test("Uses minimal Alpine base image and traps signals via dumb-init", () => {
      const content = fs.readFileSync(dockerfilePath, "utf8");
      assert.ok(content.includes("node:22-alpine"), "Must use hardened Node.js 22 Alpine base image");
      assert.ok(content.includes("dumb-init"), "Must include dumb-init for PID 1 signal trapping");
    });

    test("Defines container HEALTHCHECK probe against /health endpoint", () => {
      const content = fs.readFileSync(dockerfilePath, "utf8");
      assert.ok(content.includes("HEALTHCHECK"), "Must define container HEALTHCHECK instruction");
      assert.ok(content.includes("http://localhost:3000/health"), "Must poll /health endpoint");
    });

    test(".dockerignore prevents leaking secrets, git history, and test artifacts", () => {
      assert.ok(fs.existsSync(dockerignorePath), ".dockerignore must exist");
      const content = fs.readFileSync(dockerignorePath, "utf8");
      assert.ok(content.includes(".git"), "Must ignore .git");
      assert.ok(content.includes("node_modules"), "Must ignore local node_modules");
      assert.ok(content.includes("android/"), "Must ignore local android source");
      assert.ok(content.includes("tests/"), "Must ignore test files in production runner");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Local Development Orchestration (docker-compose.yml)
  // ---------------------------------------------------------------------------
  describe("2. Docker Compose Full-Stack Orchestration", () => {
    test("docker-compose.yml exists and declares all 5 core services", () => {
      assert.ok(fs.existsSync(dockerComposePath), "docker-compose.yml must exist");
      const content = fs.readFileSync(dockerComposePath, "utf8");
      assert.ok(content.includes("app:"), "Must declare app service");
      assert.ok(content.includes("postgres:"), "Must declare postgres service");
      assert.ok(content.includes("redis:"), "Must declare redis service");
      assert.ok(content.includes("localstack:"), "Must declare localstack service");
      assert.ok(content.includes("prometheus:"), "Must declare prometheus service");
    });

    test("PostgreSQL service configures pgvector extension and initialization scripts", () => {
      const content = fs.readFileSync(dockerComposePath, "utf8");
      assert.ok(content.includes("pgvector/pgvector:pg16"), "Must use pgvector PG16 image");
      assert.ok(content.includes("01-ddl.sql"), "Must mount DDL initialization script");
      assert.ok(content.includes("02-schema.sql"), "Must mount platform schema script");
      assert.ok(content.includes("pg_isready"), "Must configure postgres healthcheck");
    });

    test("Redis service configures authentication and LRU memory cap", () => {
      const content = fs.readFileSync(dockerComposePath, "utf8");
      assert.ok(content.includes("redis:7.2-alpine"), "Must use Redis 7.2 Alpine");
      assert.ok(content.includes("--requirepass"), "Must enforce Redis authentication");
      assert.ok(content.includes("--maxmemory 256mb"), "Must cap Redis memory usage");
      assert.ok(content.includes("--maxmemory-policy allkeys-lru"), "Must use LRU eviction policy");
    });

    test("Enforces network microsegmentation and persistent storage volumes", () => {
      const content = fs.readFileSync(dockerComposePath, "utf8");
      assert.ok(content.includes("frontend-net"), "Must declare frontend network");
      assert.ok(content.includes("backend-net"), "Must declare backend network");
      assert.ok(content.includes("pgdata:"), "Must declare persistent pgdata volume");
      assert.ok(content.includes("redisdata:"), "Must declare persistent redisdata volume");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Terraform Infrastructure as Code (IaC) Stack
  // ---------------------------------------------------------------------------
  describe("3. Terraform AWS Cloud Infrastructure Modules", () => {
    test("Root Terraform files exist with valid provider configuration", () => {
      assert.ok(fs.existsSync(path.join(terraformDir, "main.tf")), "Root main.tf must exist");
      assert.ok(fs.existsSync(path.join(terraformDir, "variables.tf")), "Root variables.tf must exist");
      assert.ok(fs.existsSync(path.join(terraformDir, "outputs.tf")), "Root outputs.tf must exist");

      const mainContent = fs.readFileSync(path.join(terraformDir, "main.tf"), "utf8");
      assert.ok(mainContent.includes("provider \"aws\""), "Must configure AWS provider");
      assert.ok(mainContent.includes("module \"vpc\""), "Must call vpc module");
      assert.ok(mainContent.includes("module \"compute\""), "Must call compute module");
      assert.ok(mainContent.includes("module \"database\""), "Must call database module");
    });

    test("VPC module implements 3-tier subnets across 3 Availability Zones", () => {
      const vpcMain = fs.readFileSync(path.join(terraformDir, "modules", "vpc", "main.tf"), "utf8");
      assert.ok(vpcMain.includes("aws_subnet\" \"public\""), "Must declare public subnets");
      assert.ok(vpcMain.includes("aws_subnet\" \"private_app\""), "Must declare private app subnets");
      assert.ok(vpcMain.includes("aws_subnet\" \"isolated_db\""), "Must declare isolated DB subnets");
      assert.ok(vpcMain.includes("aws_nat_gateway"), "Must provision NAT gateways for outbound traffic");
    });

    test("Security module strictly isolates database and cache ports to ECS tasks", () => {
      const secMain = fs.readFileSync(path.join(terraformDir, "modules", "security", "main.tf"), "utf8");
      assert.ok(secMain.includes("from_port       = 5432"), "Port 5432 must be restricted");
      assert.ok(secMain.includes("from_port       = 6379"), "Port 6379 must be restricted");
      assert.ok(secMain.includes("security_groups = [aws_security_group.ecs.id]"), "Must reference ECS SG");
      assert.ok(secMain.includes("aws_wafv2_web_acl"), "Must define AWS WAFv2 Web ACL");
      assert.ok(secMain.includes("RateLimitPerIp"), "Must enforce IP-based rate limiting");
    });

    test("Compute module configures ECS Fargate rolling updates and auto-scaling", () => {
      const compMain = fs.readFileSync(path.join(terraformDir, "modules", "compute", "main.tf"), "utf8");
      assert.ok(compMain.includes("launch_type                       = \"FARGATE\""), "Must use Fargate launch type");
      assert.ok(compMain.includes("deployment_minimum_healthy_percent = 100"), "Zero downtime: min 100%");
      assert.ok(compMain.includes("deployment_maximum_percent         = 200"), "Zero downtime: max 200%");
      assert.ok(compMain.includes("ECSServiceAverageCPUUtilization"), "Must configure CPU auto-scaling");
      assert.ok(compMain.includes("ECSServiceAverageMemoryUtilization"), "Must configure Memory auto-scaling");
    });

    test("Database module provisions Aurora Serverless v2 and Multi-AZ ElastiCache", () => {
      const dbMain = fs.readFileSync(path.join(terraformDir, "modules", "database", "main.tf"), "utf8");
      assert.ok(dbMain.includes("engine                  = \"aurora-postgresql\""), "Must use Aurora PostgreSQL");
      assert.ok(dbMain.includes("serverlessv2_scaling_configuration"), "Must configure Serverless v2 ACUs");
      assert.ok(dbMain.includes("aws_rds_cluster_instance"), "Must declare cluster instances");
      assert.ok(dbMain.includes("automatic_failover_enabled = true"), "Must enable Redis automatic failover");
      assert.ok(dbMain.includes("transit_encryption_enabled = true"), "Must enforce TLS in transit for cache");
    });

    test("Storage & CDN module provisions S3 bucket with OAC and CloudFront distribution", () => {
      const storageMain = fs.readFileSync(path.join(terraformDir, "modules", "storage_cdn", "main.tf"), "utf8");
      assert.ok(storageMain.includes("aws_s3_bucket_public_access_block"), "Must block all public S3 access");
      assert.ok(storageMain.includes("aws_cloudfront_origin_access_control"), "Must configure Origin Access Control");
      assert.ok(storageMain.includes("viewer_protocol_policy = \"redirect-to-https\""), "Must redirect HTTP to HTTPS");
    });
  });

  // ---------------------------------------------------------------------------
  // 4. SRE Observability & Alerting Configurations
  // ---------------------------------------------------------------------------
  describe("4. SRE Prometheus Observability & Alerting", () => {
    test("Prometheus configuration declares scrape jobs for app, redis, and postgres", () => {
      assert.ok(fs.existsSync(prometheusConfigPath), "prometheus.yml must exist");
      const content = fs.readFileSync(prometheusConfigPath, "utf8");
      assert.ok(content.includes("job_name: \"hbh-app\""), "Must scrape app");
      assert.ok(content.includes("job_name: \"hbh-redis\""), "Must scrape redis");
      assert.ok(content.includes("job_name: \"hbh-postgres\""), "Must scrape postgres");
    });

    test("Alerts configuration specifies critical thresholds for availability, error rate, and lag", () => {
      assert.ok(fs.existsSync(alertsConfigPath), "alerts.yml must exist");
      const content = fs.readFileSync(alertsConfigPath, "utf8");
      assert.ok(content.includes("alert: ServiceDown"), "Must monitor service downtime");
      assert.ok(content.includes("alert: HighHttpErrorRate"), "Must monitor 5xx error rate > 1%");
      assert.ok(content.includes("alert: HighApiLatencyP99"), "Must monitor P99 latency > 500ms");
      assert.ok(content.includes("alert: HighEventLoopLag"), "Must monitor Event Loop lag > 70ms");
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Operational Deployment & Disaster Recovery Scripts
  // ---------------------------------------------------------------------------
  describe("5. Operational Automation Scripts", () => {
    test("deploy_verify.sh script verifies health probe and core API endpoints", () => {
      assert.ok(fs.existsSync(deployVerifyScriptPath), "deploy_verify.sh must exist");
      const content = fs.readFileSync(deployVerifyScriptPath, "utf8");
      assert.ok(content.includes("/health"), "Must verify health endpoint");
      assert.ok(content.includes("/api/v1/catalog/products"), "Must verify catalog endpoint");
      assert.ok(content.includes("/api/v1/admin/orders"), "Must verify admin orders endpoint");
    });

    test("backup_restore.sh script implements on-demand Aurora snapshots and local persistence backup", () => {
      assert.ok(fs.existsSync(backupRestoreScriptPath), "backup_restore.sh must exist");
      const content = fs.readFileSync(backupRestoreScriptPath, "utf8");
      assert.ok(content.includes("create-db-cluster-snapshot"), "Must execute Aurora cluster snapshot");
      assert.ok(content.includes("data/backups"), "Must back up local atelier store");
    });
  });
});
