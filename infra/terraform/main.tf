# ==============================================================================
# HAMPERS BY HER — PRODUCTION TERRAFORM INFRASTRUCTURE AS CODE (ROOT STACK)
# Multi-AZ AWS ap-south-1 Topology: VPC, ECS Fargate, Aurora PG 16, Redis 7.2,
# ALB, CloudFront OAC, WAFv2, and IAM Least Privilege Governance
# ==============================================================================

terraform {
  required_version = ">= 1.8.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Production S3 State Backend with DynamoDB Distributed Locking
  # Run `terraform init` with -backend-config for environment segregation
  # backend "s3" {
  #   bucket         = "hampers-by-her-tfstate-ap-south-1"
  #   key            = "production/terraform.tfstate"
  #   region         = "ap-south-1"
  #   dynamodb_table = "hampers-by-her-tflocks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Repository  = "https://github.com/hampersbyher/atelier-commerce"
    }
  }
}

# ------------------------------------------------------------------------------
# 1. Network Foundation (VPC, Subnets, Gateways)
# ------------------------------------------------------------------------------
module "vpc" {
  source             = "./modules/vpc"
  project_name       = var.project_name
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
}

# ------------------------------------------------------------------------------
# 2. Security Boundaries (Security Groups & WAFv2)
# ------------------------------------------------------------------------------
module "security" {
  source       = "./modules/security"
  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.vpc.vpc_id
}

# ------------------------------------------------------------------------------
# 3. Identity & Access Management (IAM Roles)
# ------------------------------------------------------------------------------
module "iam" {
  source       = "./modules/iam"
  project_name = var.project_name
  environment  = var.environment
}

# ------------------------------------------------------------------------------
# 4. Data Layer (Aurora PostgreSQL Serverless v2 & ElastiCache Redis)
# ------------------------------------------------------------------------------
module "database" {
  source                   = "./modules/database"
  project_name             = var.project_name
  environment              = var.environment
  db_subnet_group_name     = module.vpc.db_subnet_group_name
  redis_subnet_group_name  = module.vpc.redis_subnet_group_name
  aurora_security_group_id = module.security.aurora_security_group_id
  redis_security_group_id  = module.security.redis_security_group_id
  aurora_min_acu           = var.aurora_min_acu
  aurora_max_acu           = var.aurora_max_acu
  redis_node_type          = var.redis_node_type
}

# ------------------------------------------------------------------------------
# 5. Load Balancing (ALB & HTTPS Redirect)
# ------------------------------------------------------------------------------
module "loadbalancer" {
  source                = "./modules/loadbalancer"
  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  public_subnet_ids     = module.vpc.public_subnet_ids
  alb_security_group_id = module.security.alb_security_group_id
  waf_web_acl_arn       = module.security.waf_web_acl_arn
}

# ------------------------------------------------------------------------------
# 6. Compute Layer (ECS Fargate Cluster, Tasks & Auto-Scaling)
# ------------------------------------------------------------------------------
module "compute" {
  source                 = "./modules/compute"
  project_name           = var.project_name
  environment            = var.environment
  container_image        = var.container_image
  container_cpu          = var.container_cpu
  container_memory       = var.container_memory
  min_tasks              = var.min_tasks
  max_tasks              = var.max_tasks
  private_app_subnet_ids = module.vpc.private_app_subnet_ids
  ecs_security_group_id  = module.security.ecs_security_group_id
  target_group_arn       = module.loadbalancer.target_group_arn
  ecs_execution_role_arn = module.iam.ecs_execution_role_arn
  ecs_task_role_arn      = module.iam.ecs_task_role_arn
  database_endpoint      = module.database.aurora_endpoint
  redis_endpoint         = module.database.redis_primary_endpoint
}

# ------------------------------------------------------------------------------
# 7. Storage & Edge Acceleration (S3 & CloudFront OAC)
# ------------------------------------------------------------------------------
module "storage_cdn" {
  source       = "./modules/storage_cdn"
  project_name = var.project_name
  environment  = var.environment
  alb_dns_name = module.loadbalancer.alb_dns_name
  domain_name  = var.domain_name
}
