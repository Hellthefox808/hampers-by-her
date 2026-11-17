output "alb_security_group_id" { value = aws_security_group.alb.id }
output "ecs_security_group_id" { value = aws_security_group.ecs.id }
output "aurora_security_group_id" { value = aws_security_group.aurora.id }
output "redis_security_group_id" { value = aws_security_group.redis.id }
output "waf_web_acl_arn" { value = aws_wafv2_web_acl.main.arn }
