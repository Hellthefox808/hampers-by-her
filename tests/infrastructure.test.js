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
  const k8sDir = path.join(rootDir, "infra", "k8s");
  const githubDir = path.join(rootDir, ".github");
  const reportsDir = path.join(rootDir, "docs", "reports");

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

  // ---------------------------------------------------------------------------
  // 6. Kubernetes Enterprise Manifests (infra/k8s/)
  // ---------------------------------------------------------------------------
  describe("6. Kubernetes Enterprise Manifests", () => {
    test("namespace.yaml enforces restricted Pod Security Standards", () => {
      const nsPath = path.join(k8sDir, "namespace.yaml");
      assert.ok(fs.existsSync(nsPath), "namespace.yaml must exist");
      const content = fs.readFileSync(nsPath, "utf8");
      assert.ok(content.includes("kind: Namespace"), "Must define Namespace kind");
      assert.ok(content.includes("name: hampers-by-her"), "Must define hampers-by-her namespace");
      assert.ok(content.includes("pod-security.kubernetes.io/enforce: restricted"), "Must enforce restricted PSS");
    });

    test("configmap.yaml and secret.yaml.example configure runtime environment safely", () => {
      const cmPath = path.join(k8sDir, "configmap.yaml");
      const secPath = path.join(k8sDir, "secret.yaml.example");
      assert.ok(fs.existsSync(cmPath), "configmap.yaml must exist");
      assert.ok(fs.existsSync(secPath), "secret.yaml.example must exist");
      const cmContent = fs.readFileSync(cmPath, "utf8");
      const secContent = fs.readFileSync(secPath, "utf8");
      assert.ok(cmContent.includes("NODE_ENV: \"production\""), "ConfigMap must set NODE_ENV=production");
      assert.ok(cmContent.includes("AWS_REGION: \"ap-south-1\""), "ConfigMap must set ap-south-1 region");
      assert.ok(secContent.includes("kind: Secret"), "Must declare Kubernetes Secret template");
      assert.ok(secContent.includes("DATABASE_URL"), "Must declare DATABASE_URL key");
      assert.ok(secContent.includes("JWT_SECRET"), "Must declare JWT_SECRET key");
    });

    test("deployment.yaml enforces zero-downtime rolling updates, non-root security, and health probes", () => {
      const depPath = path.join(k8sDir, "deployment.yaml");
      assert.ok(fs.existsSync(depPath), "deployment.yaml must exist");
      const content = fs.readFileSync(depPath, "utf8");
      assert.ok(content.includes("replicas: 3"), "Must run 3 initial replicas");
      assert.ok(content.includes("type: RollingUpdate"), "Must use RollingUpdate strategy");
      assert.ok(content.includes("maxSurge: 1"), "Must allow maxSurge: 1");
      assert.ok(content.includes("maxUnavailable: 0"), "Must enforce zero-downtime maxUnavailable: 0");
      assert.ok(content.includes("runAsNonRoot: true"), "Must enforce runAsNonRoot");
      assert.ok(content.includes("runAsUser: 1000"), "Must run as UID 1000");
      assert.ok(content.includes("allowPrivilegeEscalation: false"), "Must disallow privilege escalation");
      assert.ok(content.includes("- ALL"), "Must drop ALL Linux capabilities");
      assert.ok(content.includes("livenessProbe:"), "Must define livenessProbe");
      assert.ok(content.includes("readinessProbe:"), "Must define readinessProbe");
      assert.ok(content.includes("path: /health"), "Probes must target /health");
    });

    test("service.yaml exposes ClusterIP on port 3000", () => {
      const svcPath = path.join(k8sDir, "service.yaml");
      assert.ok(fs.existsSync(svcPath), "service.yaml must exist");
      const content = fs.readFileSync(svcPath, "utf8");
      assert.ok(content.includes("kind: Service"), "Must define Service kind");
      assert.ok(content.includes("type: ClusterIP"), "Must use ClusterIP type");
      assert.ok(content.includes("port: 3000"), "Must expose port 3000");
    });

    test("hpa.yaml configures autoscaling/v2 from 2 to 12 replicas on CPU and Memory", () => {
      const hpaPath = path.join(k8sDir, "hpa.yaml");
      assert.ok(fs.existsSync(hpaPath), "hpa.yaml must exist");
      const content = fs.readFileSync(hpaPath, "utf8");
      assert.ok(content.includes("apiVersion: autoscaling/v2"), "Must use autoscaling/v2");
      assert.ok(content.includes("minReplicas: 2"), "Must set minReplicas: 2");
      assert.ok(content.includes("maxReplicas: 12"), "Must set maxReplicas: 12");
      assert.ok(content.includes("averageUtilization: 65"), "Must target 65% CPU utilization");
      assert.ok(content.includes("averageUtilization: 75"), "Must target 75% Memory utilization");
    });

    test("ingress.yaml configures AWS ALB with HTTPS redirect and health checks", () => {
      const ingPath = path.join(k8sDir, "ingress.yaml");
      assert.ok(fs.existsSync(ingPath), "ingress.yaml must exist");
      const content = fs.readFileSync(ingPath, "utf8");
      assert.ok(content.includes("kind: Ingress"), "Must define Ingress kind");
      assert.ok(content.includes("alb.ingress.kubernetes.io/ssl-redirect: \"443\""), "Must redirect HTTP to HTTPS");
      assert.ok(content.includes("alb.ingress.kubernetes.io/healthcheck-path: \"/health\""), "Must healthcheck /health");
      assert.ok(content.includes("host: hampersbyher.com"), "Must route hampersbyher.com");
    });

    test("pdb.yaml enforces PodDisruptionBudget with minAvailable: 2", () => {
      const pdbPath = path.join(k8sDir, "pdb.yaml");
      assert.ok(fs.existsSync(pdbPath), "pdb.yaml must exist");
      const content = fs.readFileSync(pdbPath, "utf8");
      assert.ok(content.includes("kind: PodDisruptionBudget"), "Must define PodDisruptionBudget");
      assert.ok(content.includes("minAvailable: 2"), "Must preserve at least 2 available pods");
    });
  });

  // ---------------------------------------------------------------------------
  // 7. CI/CD DevSecOps Workflows, GitHub Governance & Section 26 Reports
  // ---------------------------------------------------------------------------
  describe("7. CI/CD Workflows, GitHub Governance & Deliverable Reports", () => {
    test("CI workflow runs docs audit, test suite, Trivy scan, and Terraform format check", () => {
      const ciPath = path.join(githubDir, "workflows", "ci.yml");
      assert.ok(fs.existsSync(ciPath), "ci.yml must exist");
      const content = fs.readFileSync(ciPath, "utf8");
      assert.ok(content.includes("npm run audit:docs"), "CI must run documentation audit");
      assert.ok(content.includes("npm test"), "CI must execute regression tests");
      assert.ok(content.includes("aquasecurity/trivy-action"), "CI must run Trivy container security scan");
      assert.ok(content.includes("terraform fmt -check -recursive infra/terraform/"), "CI must lint Terraform IaC");
    });

    test("Deploy workflow uses keyless AWS OIDC, ECR push, ECS rolling deploy, and health guard", () => {
      const deployPath = path.join(githubDir, "workflows", "deploy.yml");
      assert.ok(fs.existsSync(deployPath), "deploy.yml must exist");
      const content = fs.readFileSync(deployPath, "utf8");
      assert.ok(content.includes("id-token: write"), "Deploy must enable OIDC id-token permission");
      assert.ok(content.includes("aws-actions/configure-aws-credentials@v4"), "Deploy must use AWS OIDC action");
      assert.ok(content.includes("aws-actions/amazon-ecs-deploy-task-definition@v2"), "Deploy must roll ECS service");
      assert.ok(content.includes("https://hampersbyher.com/health"), "Deploy must verify live /health endpoint");
    });

    test("GitHub repository governance files (README, CONTRIBUTING, CHANGELOG, CODEOWNERS, templates) exist", () => {
      const governanceFiles = [
        path.join(rootDir, "README.md"),
        path.join(rootDir, "CONTRIBUTING.md"),
        path.join(rootDir, "CHANGELOG.md"),
        path.join(githubDir, "CODEOWNERS"),
        path.join(githubDir, "pull_request_template.md"),
        path.join(githubDir, "ISSUE_TEMPLATE", "bug_report.md"),
        path.join(githubDir, "ISSUE_TEMPLATE", "feature_request.md"),
      ];
      for (const filePath of governanceFiles) {
        assert.ok(fs.existsSync(filePath), `Governance file must exist: ${path.basename(filePath)}`);
        const content = fs.readFileSync(filePath, "utf8");
        assert.ok(content.trim().length > 100, `Governance file must be substantive: ${path.basename(filePath)}`);
      }
    });

    test("All 10 Section 26 Master Deliverable Reports exist in docs/reports/ and are complete", () => {
      const requiredReports = [
        "EXECUTIVE_SUMMARY.md",
        "SECURITY_AUDIT_REPORT.md",
        "PERFORMANCE_BENCHMARK_REPORT.md",
        "ACCESSIBILITY_WCAG_REPORT.md",
        "TESTING_COVERAGE_REPORT.md",
        "DEPLOYMENT_READINESS_REPORT.md",
        "GITHUB_READINESS_REPORT.md",
        "RISK_REGISTER.md",
        "TECHNICAL_DEBT_REPORT.md",
        "RELEASE_NOTES_v2.0.0.md",
      ];
      for (const report of requiredReports) {
        const fullPath = path.join(reportsDir, report);
        assert.ok(fs.existsSync(fullPath), `Deliverable report must exist: ${report}`);
        const content = fs.readFileSync(fullPath, "utf8");
        assert.ok(content.trim().length > 300, `Deliverable report must be comprehensive: ${report}`);
        assert.ok(!content.includes("TODO"), `Zero-Placeholder violation (TODO) in ${report}`);
      }
    });
  });
});
