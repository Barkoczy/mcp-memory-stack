# Secrets Management

This directory contains sensitive configuration files for the MCP Memory Stack production deployment.

## Security Best Practices

### 🔐 Secret Generation
- Use the provided `generate-secrets.sh` script to create secure secrets
- All secrets are generated using cryptographically secure random functions
- Minimum 32-character length for passwords
- JWT secrets use 64-byte hex encoding

### 🛡️ File Permissions
- All secret files have 600 permissions (owner read/write only)
- Secrets directory has 700 permissions (owner access only)
- Never store secrets in version control

### 🔄 Secret Rotation
- Rotate secrets regularly (recommended: every 90 days)
- Use blue-green deployment for zero-downtime secret rotation
- Keep backup of previous secrets during rotation period

### 📁 File Structure
```
secrets/
├── db_password.txt          # Database user password
├── db_root_password.txt     # Database root password  
├── jwt_secret.txt           # JWT signing secret
├── api_key.txt              # API authentication key
├── generate-secrets.sh      # Secret generation script
└── README.md               # This file
```

### 🚀 Production Deployment
1. Run `./generate-secrets.sh` to create secrets
2. Verify file permissions are correct
3. Backup secrets to secure location
4. Deploy using `docker-compose -f docker-compose.prod.yml up -d`

### 🔍 Monitoring
- Monitor secret file access logs
- Set up alerts for unauthorized access attempts
- Regular security audits of secret management

### 📋 Compliance
- Follows OWASP secrets management guidelines
- Compatible with SOC 2 Type II requirements
- Supports PCI DSS compliance for payment processing
