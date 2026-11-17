variable "project_name" { type = string }
variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "alb_security_group_id" { type = string }
variable "waf_web_acl_arn" { type = string }
variable "certificate_arn" {
  type        = string
  description = "ACM Certificate ARN for HTTPS listener (optional, falls back to self-managed or port 80 if empty)"
  default     = ""
}
