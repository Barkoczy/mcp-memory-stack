# Production Setup

Complete guide for deploying MCP Memory Stack in production environments.

## Prerequisites

### System Requirements
- **OS**: Ubuntu 22.04 LTS or RHEL 9+ (recommended)
- **CPU**: 4+ cores (8+ recommended)  
- **RAM**: 8GB minimum (16GB+ recommended)
- **Storage**: 100GB+ SSD with backup strategy
- **Network**: Static IP, firewall configured

### Software Dependencies
```bash
# Docker Engine (latest stable)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Docker Compose v2
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

## Pre-deployment Checklist

### 1. System Verification
```bash
# Verify system resources
free -h
df -h
docker system df

# Check Docker daemon
docker info
docker version
```

### 2. Network Setup
```bash
# Create production network
docker network create --driver bridge \
  --subnet=172.20.0.0/16 \
  --gateway=172.20.0.1 \
  mcp_prod_network
```

### 3. Configuration Validation
```bash
# Validate compose files
docker-compose -f docker-compose.prod.yml config
```

## Deployment Process

### 1. Pull Latest Images
```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull
```

### 2. Start Services
```bash
# Start services in production mode
docker-compose -f docker-compose.prod.yml up -d

# Verify deployment
docker-compose -f docker-compose.prod.yml ps
```

### 3. Health Verification
```bash
# Check service health
curl -f http://localhost:3334/health

# Check database connectivity
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_isready -U mcp_prod_user -d mcp_memory_prod

# Verify logs
docker-compose -f docker-compose.prod.yml logs --tail=50
```

## Load Balancer Setup

### Nginx Configuration
```nginx
upstream mcp_backend {
    server 127.0.0.1:3333;
    # Add more servers for load balancing
    # server 127.0.0.1:3334;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;
    
    location /api/ {
        proxy_pass http://mcp_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## High Availability Setup

### Multi-Instance Deployment
```yaml
# docker-compose.ha.yml
version: '3.8'
services:
  mcp-memory-1:
    image: mcp-memory-stack:latest
    ports:
      - "3333:3333"
    environment:
      - NODE_ENV=production
      - INSTANCE_ID=1
      
  mcp-memory-2:
    image: mcp-memory-stack:latest
    ports:
      - "3334:3333"
    environment:
      - NODE_ENV=production
      - INSTANCE_ID=2
```

### Database Replication
```bash
# Configure PostgreSQL primary-replica setup
# See PostgreSQL documentation for detailed setup
```

## Backup Strategy

### Automated Backups
```bash
#!/bin/bash
# backup-script.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/mcp-memory"

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U mcp_prod_user mcp_memory_prod \
  > $BACKUP_DIR/db_backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
```

### Backup Verification
```bash
# Test backup restoration
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U mcp_prod_user -d mcp_memory_test < backup_YYYYMMDD.sql
```

## Scaling Considerations

### Horizontal Scaling
- **Read Replicas**: Scale read operations
- **API Instances**: Multiple API server instances
- **Load Balancing**: Distribute traffic across instances

### Vertical Scaling
- **CPU**: Increase for embedding computations
- **Memory**: More RAM for caching and vector operations
- **Storage**: SSD for better I/O performance

### Resource Limits
```yaml
# In docker-compose.prod.yml
services:
  mcp-memory:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

## Health Checks

### Application Health
```bash
# Built-in health endpoint
curl -f http://localhost:3334/health

# Response should be:
# {"status":"healthy","database":"connected","timestamp":"..."}
```

### Database Health
```bash
# PostgreSQL health check
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_isready -U mcp_prod_user -d mcp_memory_prod
```

### Custom Health Monitoring
```bash
#!/bin/bash
# health-monitor.sh

# Check API health
if ! curl -f -s http://localhost:3334/health > /dev/null; then
    echo "API health check failed"
    # Notify monitoring system
    exit 1
fi

# Check memory operations
if ! curl -f -s http://localhost:3333/api/v1/memories?limit=1 > /dev/null; then
    echo "Memory operations check failed"
    exit 1
fi

echo "All health checks passed"
```

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs service_name

# Check resource constraints
docker stats
free -h
df -h

# Verify secrets and environment
ls -la secrets/
env | grep -E "(NODE_ENV|DATABASE_URL)"
```

### Database Connection Issues
```bash
# Check database status
docker-compose -f docker-compose.prod.yml exec postgres \
  pg_isready -U mcp_prod_user

# Check network connectivity
docker network ls
docker network inspect mcp_prod_network
```

### Performance Issues
```bash
# Check resource usage
docker stats --no-stream

# Analyze slow queries
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U mcp_prod_user -d mcp_memory_prod \
  -c "SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

## Emergency Recovery

### Service Recovery
```bash
# Quick restart
docker-compose -f docker-compose.prod.yml restart

# Full recovery with cleanup
docker-compose -f docker-compose.prod.yml down
docker system prune -f
docker-compose -f docker-compose.prod.yml up -d
```

### Database Recovery
```bash
# Stop services
docker-compose -f docker-compose.prod.yml stop mcp-memory

# Restore from backup
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U mcp_prod_user -d mcp_memory_prod < backup_YYYYMMDD.sql

# Restart services
docker-compose -f docker-compose.prod.yml start
```

## Production Checklist

Before going live, ensure:

- [ ] All secrets generated and secured
- [ ] SSL/TLS certificates configured
- [ ] Firewall rules configured
- [ ] Monitoring and alerting setup
- [ ] Backup strategy implemented
- [ ] Load balancer configured (if needed)
- [ ] Health checks passing
- [ ] Performance testing completed
- [ ] Security scan completed
- [ ] Documentation updated
- [ ] Support team trained

## Support

For production issues:
1. Check this troubleshooting guide
2. Review monitoring dashboards  
3. Analyze application logs
4. Contact support with:
   - Error messages
   - System metrics
   - Recent changes
   - Steps to reproduce

---

**⚠️ Important**: Always test changes in staging before applying to production!