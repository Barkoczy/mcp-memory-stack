# Security Configuration

Comprehensive security setup guide for MCP Memory Stack following 2025 security best practices.

## Security Hardening

### System-Level Security
```bash
# Enable firewall
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Configure fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Enable audit logging
sudo systemctl enable auditd
sudo systemctl start auditd
```

### Docker Security
```bash
# Run Docker Bench Security
docker run --rm --net host --pid host --userns host --cap-add audit_control \
  -e DOCKER_CONTENT_TRUST=$DOCKER_CONTENT_TRUST \
  -v /var/lib:/var/lib:ro \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /usr/lib/systemd:/usr/lib/systemd:ro \
  -v /etc:/etc:ro --label docker_bench_security \
  docker/docker-bench-security
```

## Secrets Management

### 1. Generate Production Secrets
```bash
# Navigate to project directory
cd mcp-memory-stack

# Generate secure secrets
chmod +x secrets/generate-secrets.sh
./secrets/generate-secrets.sh

# Verify permissions
ls -la secrets/
# Should show 600 permissions on all .txt files
```

### 2. Secret Rotation
```bash
# Rotate secrets (recommended every 90 days)
./secrets/generate-secrets.sh

# Update running services
docker-compose -f docker-compose.prod.yml restart
```

### 3. Environment Variables Security
```bash
# Production environment variables (.env.production)
NODE_ENV=production
LOG_LEVEL=info

# Database credentials (use secrets/db-password.txt)
POSTGRES_PASSWORD_FILE=/run/secrets/db_password

# API keys (use secrets/api-keys.txt)
API_KEYS_FILE=/run/secrets/api_keys

# JWT secret (use secrets/jwt-secret.txt)
JWT_SECRET_FILE=/run/secrets/jwt_secret

# Security settings
DOCKER_CONTENT_TRUST=1
COMPOSE_DOCKER_CLI_BUILD=1
DOCKER_BUILDKIT=1
```

## SSL/TLS Configuration

### Using Let's Encrypt
```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com

# Set up auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Custom Certificates
```bash
# Create SSL directory
mkdir -p ssl/

# Copy your certificates
cp yourdomain.crt ssl/
cp yourdomain.key ssl/
cp ca-bundle.crt ssl/

# Set proper permissions
chmod 644 ssl/*.crt
chmod 600 ssl/*.key
```

### Nginx SSL Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "no-referrer-when-downgrade";
}
```

## Authentication & Authorization

### API Key Authentication
```bash
# Generate API keys
openssl rand -hex 32 > secrets/api-key-admin.txt
openssl rand -hex 32 > secrets/api-key-readonly.txt

# Use in requests
curl -H "X-API-Key: $(cat secrets/api-key-admin.txt)" \
  http://localhost:3333/api/v1/memories
```

### JWT Token Configuration
```bash
# Generate JWT secret
openssl rand -base64 64 > secrets/jwt-secret.txt

# Environment configuration
JWT_SECRET_FILE=/run/secrets/jwt_secret
JWT_EXPIRATION=1h
JWT_ISSUER=mcp-memory-stack
```

### Role-Based Access Control
```yaml
# roles.yml configuration
roles:
  admin:
    permissions:
      - memory:create
      - memory:read
      - memory:update
      - memory:delete
      - system:admin
      
  user:
    permissions:
      - memory:create
      - memory:read
      - memory:update
      
  readonly:
    permissions:
      - memory:read
```

## Network Security

### Docker Network Isolation
```bash
# Create isolated network
docker network create --driver bridge \
  --subnet=172.20.0.0/16 \
  --gateway=172.20.0.1 \
  --opt com.docker.network.bridge.name=br-mcp \
  mcp_prod_network
```

### Firewall Rules
```bash
# Application-specific rules
sudo ufw allow from 172.20.0.0/16 to any port 5432  # PostgreSQL
sudo ufw allow from 172.20.0.0/16 to any port 6379  # Redis

# External access (only HTTPS)
sudo ufw allow 443/tcp
sudo ufw deny 80/tcp  # Redirect to HTTPS
sudo ufw deny 3333/tcp  # Block direct API access
```

### VPN Access (Optional)
```bash
# For admin access, consider VPN
sudo apt-get install openvpn
# Configure OpenVPN server for admin access
```

## Database Security

### PostgreSQL Hardening
```sql
-- Create dedicated database user
CREATE USER mcp_prod_user WITH PASSWORD 'strong_password';
CREATE DATABASE mcp_memory_prod OWNER mcp_prod_user;

-- Grant minimal permissions
GRANT CONNECT ON DATABASE mcp_memory_prod TO mcp_prod_user;
GRANT USAGE ON SCHEMA public TO mcp_prod_user;
GRANT CREATE ON SCHEMA public TO mcp_prod_user;

-- Enable row-level security
ALTER DATABASE mcp_memory_prod SET row_security = on;
```

### Connection Security
```bash
# PostgreSQL configuration (postgresql.conf)
ssl = on
ssl_cert_file = '/var/lib/postgresql/ssl/server.crt'
ssl_key_file = '/var/lib/postgresql/ssl/server.key'
ssl_ca_file = '/var/lib/postgresql/ssl/ca.crt'

# Host-based authentication (pg_hba.conf)
hostssl mcp_memory_prod mcp_prod_user 172.20.0.0/16 md5
```

## Application Security

### Container Security
```dockerfile
# Security-focused Dockerfile
FROM node:20-slim

# Create non-root user
RUN groupadd -r mcpuser && useradd -r -g mcpuser mcpuser

# Set working directory
WORKDIR /app

# Copy and set ownership
COPY --chown=mcpuser:mcpuser . .

# Drop privileges
USER mcpuser

# Security labels
LABEL security.no-new-privileges=true
```

### Container Runtime Security
```yaml
# docker-compose.yml security settings
services:
  mcp-memory:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=100m
```

### Input Validation
```javascript
// API input validation
const createMemorySchema = {
  type: 'object',
  properties: {
    type: { type: 'string', maxLength: 50 },
    content: { type: 'object' },
    source: { type: 'string', maxLength: 255 },
    tags: { 
      type: 'array', 
      items: { type: 'string', maxLength: 50 },
      maxItems: 10
    }
  },
  required: ['type', 'content'],
  additionalProperties: false
};
```

## Monitoring & Auditing

### Security Logging
```bash
# Enable audit logging for Docker
echo 'DOCKER_OPTS="--log-driver=journald"' >> /etc/default/docker

# Configure rsyslog for centralized logging
echo 'docker.* @@logserver:514' >> /etc/rsyslog.conf
```

### Intrusion Detection
```bash
# Install AIDE for file integrity monitoring
sudo apt-get install aide
sudo aideinit
sudo cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db

# Schedule daily checks
echo '0 2 * * * /usr/bin/aide --check' | sudo crontab -
```

### Security Metrics
```yaml
# Prometheus security metrics
security_events_total:
  help: "Total security events"
  type: counter
  labels: [type, severity]

failed_auth_attempts:
  help: "Failed authentication attempts"
  type: counter
  labels: [source_ip, endpoint]

suspicious_requests:
  help: "Suspicious request patterns"
  type: counter
  labels: [pattern, action]
```

## Compliance & Standards

### CIS Docker Benchmark Compliance
- ✅ Non-root containers
- ✅ Read-only filesystems  
- ✅ Dropped capabilities
- ✅ Resource limits
- ✅ Security scanning
- ✅ Secrets management

### OWASP Guidelines
- ✅ Input validation
- ✅ Authentication & authorization
- ✅ Secure communication (HTTPS)
- ✅ Error handling
- ✅ Logging & monitoring

### Regular Security Tasks

#### Weekly
```bash
# Vulnerability scan
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image --severity HIGH,CRITICAL mcp-memory-stack

# Check for failed login attempts
sudo grep "Failed password" /var/log/auth.log | tail -20
```

#### Monthly
```bash
# Security audit
./scripts/security-audit.sh

# Update security patches
sudo apt-get update && sudo apt-get upgrade

# Rotate API keys
./secrets/rotate-api-keys.sh
```

#### Quarterly
```bash
# Penetration testing
# Schedule external security assessment

# Review access logs
# Analyze authentication patterns

# Update security policies
# Review and update security documentation
```

## Incident Response

### Security Incident Checklist
1. **Identify** - Detect and analyze the incident
2. **Contain** - Limit the scope and impact
3. **Eradicate** - Remove the threat
4. **Recover** - Restore normal operations
5. **Learn** - Document lessons learned

### Emergency Procedures
```bash
# Immediate threat response
docker-compose -f docker-compose.prod.yml stop

# Isolate affected containers
docker network disconnect mcp_prod_network container_name

# Preserve evidence
docker logs container_name > incident_logs_$(date +%Y%m%d).txt

# Notify security team
# Follow incident response procedures
```

## Security Checklist

Before production deployment:

- [ ] All default passwords changed
- [ ] Secrets properly generated and stored
- [ ] SSL/TLS certificates configured
- [ ] Firewall rules implemented
- [ ] Database access restricted
- [ ] Container security configured
- [ ] Monitoring and alerting active
- [ ] Backup encryption enabled
- [ ] Incident response plan ready
- [ ] Security training completed

---

**🔒 Remember**: Security is an ongoing process, not a one-time setup. Regularly review and update your security measures.