# ==============================================================================
# HAMPERS BY HER — TERRAFORM ROOT OUTPUTS
# ==============================================================================

output "vpc_id" {
  description = "VPC Identifier"
  value       = module.vpc.vpc_id
}

output "alb_dns_name" {
  description = "Application Load Balancer Public DNS Name"
  value       = module.loadbalancer.alb_dns_name
}

output "cloudfront_domain_name" {
  description = "CloudFront Distribution Apex Edge Domain"
  value       = module.storage_cdn.cloudfront_domain_name
}

output "aurora_endpoint" {
  description = "Aurora PostgreSQL Primary Endpoint"
  value       = module.database.aurora_endpoint
}

output "redis_primary_endpoint" {
  description = "ElastiCache Redis Primary Cluster Endpoint"
  value       = module.database.redis_primary_endpoint
}

output "ecs_cluster_name" {
  description = "ECS Fargate Cluster Name"
  value       = module.compute.cluster_name
}

output "ecs_service_name" {
  description = "ECS Fargate Application Service Name"
  value       = module.compute.service_name
}

output "media_bucket_name" {
  description = "S3 Media Derivatives Bucket Name"
  value       = module.storage_cdn.media_bucket_name
}
