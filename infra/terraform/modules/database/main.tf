# ==============================================================================
# DATABASE MODULE — AURORA POSTGRESQL 16 SERVERLESS V2 & ELASTICACHE REDIS 7.2
# ==============================================================================

# Master Password Generation
resource "random_password" "db_master_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# 1. Amazon Aurora Serverless v2 PostgreSQL Cluster
resource "aws_rds_cluster" "aurora" {
  cluster_identifier      = "${var.project_name}-${var.environment}-aurora"
  engine                  = "aurora-postgresql"
  engine_version          = "16.2"
  database_name           = "hampers_by_her"
  master_username         = "hbh_admin"
  master_password         = random_password.db_master_password.result
  db_subnet_group_name    = var.db_subnet_group_name
  vpc_security_group_ids  = [var.aurora_security_group_id]
  storage_encrypted       = true
  deletion_protection     = var.environment == "production" ? true : false
  skip_final_snapshot     = var.environment == "production" ? false : true
  final_snapshot_identifier = "${var.project_name}-${var.environment}-final-snap"
  backup_retention_period = 30
  preferred_backup_window = "19:00-20:00"

  serverlessv2_scaling_configuration {
    min_capacity = var.aurora_min_acu
    max_capacity = var.aurora_max_acu
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-aurora"
  }
}

# Multi-AZ Aurora Cluster Instances (High Availability)
resource "aws_rds_cluster_instance" "aurora_instances" {
  count               = 2
  identifier          = "${var.project_name}-${var.environment}-aurora-node-${count.index + 1}"
  cluster_identifier = aws_rds_cluster.aurora.id
  instance_class      = "db.serverless"
  engine              = aws_rds_cluster.aurora.engine
  engine_version      = aws_rds_cluster.aurora.engine_version
  publicly_accessible = false

  tags = {
    Name = "${var.project_name}-${var.environment}-aurora-node-${count.index + 1}"
  }
}

# 2. Amazon ElastiCache Redis 7.2 Replication Group
resource "random_password" "redis_auth_token" {
  length  = 32
  special = false
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.project_name}-${var.environment}-redis"
  description                = "In-memory caching, distributed locks, and SingleFlight coalescing"
  engine                     = "redis"
  engine_version             = "7.2"
  node_type                  = var.redis_node_type
  num_cache_clusters         = 2
  parameter_group_name       = "default.redis7"
  port                       = 6379
  subnet_group_name          = var.redis_subnet_group_name
  security_group_ids         = [var.redis_security_group_id]
  automatic_failover_enabled = true
  multi_az_enabled           = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth_token.result

  tags = {
    Name = "${var.project_name}-${var.environment}-redis"
  }
}
