output "vpc_id" { value = aws_vpc.main.id }
output "vpc_cidr" { value = aws_vpc.main.cidr_block }
output "public_subnet_ids" { value = aws_subnet.public[*].id }
output "private_app_subnet_ids" { value = aws_subnet.private_app[*].id }
output "isolated_db_subnet_ids" { value = aws_subnet.isolated_db[*].id }
output "db_subnet_group_name" { value = aws_db_subnet_group.aurora.name }
output "redis_subnet_group_name" { value = aws_elasticache_subnet_group.redis.name }
