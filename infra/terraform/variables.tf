# ==============================================================================
# HAMPERS BY HER — TERRAFORM ROOT VARIABLES
# Parameterized Cloud Configuration for AWS ap-south-1 (Mumbai)
# ==============================================================================

variable "aws_region" {
  type        = string
  description = "Primary AWS deployment region (Mumbai)"
  default     = "ap-south-1"
}

variable "environment" {
  type        = string
  description = "Target deployment environment (development, staging, production)"
  default     = "production"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "project_name" {
  type        = string
  description = "Global project identifier"
  default     = "hampers-by-her"
}

variable "domain_name" {
  type        = string
  description = "Apex production domain name"
  default     = "hampersbyher.com"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC"
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "Multi-AZ availability zones in Mumbai"
  default     = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
}

variable "container_image" {
  type        = string
  description = "ECR image URI for the application container"
  default     = "123456789012.dkr.ecr.ap-south-1.amazonaws.com/hampers-by-her:latest"
}

variable "container_cpu" {
  type        = number
  description = "Fargate CPU units (1024 = 1 vCPU)"
  default     = 1024
}

variable "container_memory" {
  type        = number
  description = "Fargate Memory limit in MiB (2048 = 2GB)"
  default     = 2048
}

variable "min_tasks" {
  type        = number
  description = "Minimum ECS Fargate task replicas"
  default     = 2
}

variable "max_tasks" {
  type        = number
  description = "Maximum ECS Fargate task replicas during viral festival bursts"
  default     = 12
}

variable "aurora_min_acu" {
  type        = number
  description = "Aurora Serverless v2 minimum Aurora Capacity Units (ACUs)"
  default     = 0.5
}

variable "aurora_max_acu" {
  type        = number
  description = "Aurora Serverless v2 maximum Aurora Capacity Units (ACUs)"
  default     = 16.0
}

variable "redis_node_type" {
  type        = string
  description = "ElastiCache Redis node type"
  default     = "cache.t4g.medium"
}
