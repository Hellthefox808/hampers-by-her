output "aurora_endpoint" { value = aws_rds_cluster.aurora.endpoint }
output "aurora_reader_endpoint" { value = aws_rds_cluster.aurora.reader_endpoint }
output "redis_primary_endpoint" { value = aws_elasticache_replication_group.redis.primary_endpoint_address }
output "db_name" { value = aws_rds_cluster.aurora.database_name }
output "db_user" { value = aws_rds_cluster.aurora.master_username }
