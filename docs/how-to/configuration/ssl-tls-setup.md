# SSL/TLS Configuration

Complete guide for setting up SSL/TLS certificates for secure HTTPS communication in MCP Memory Stack.

## Overview

SSL/TLS encryption is essential for production deployments to secure:
- REST API communication
- MCP protocol data transmission
- Database connections
- Admin interfaces

## Certificate Options

### 1. Let's Encrypt (Recommended for Production)

**Pros**: Free, automated renewal, trusted by all browsers
**Best for**: Production domains with public DNS

#### Setup with Certbot

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com

# Certificate files will be created at:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

#### Automatic Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Setup auto-renewal cron job
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 2. Self-Signed Certificates

**Pros**: Free, works offline, quick setup
**Best for**: Development, testing, internal networks

#### Generate Self-Signed Certificate

```bash
# Create SSL directory
mkdir -p ssl/

# Generate private key
openssl genrsa -out ssl/private.key 2048

# Generate certificate signing request
openssl req -new -key ssl/private.key -out ssl/certificate.csr

# Generate self-signed certificate (valid for 365 days)
openssl x509 -req -days 365 -in ssl/certificate.csr \
  -signkey ssl/private.key -out ssl/certificate.crt

# Set proper permissions
chmod 600 ssl/private.key
chmod 644 ssl/certificate.crt
```

#### Interactive Certificate Generation

```bash
# One-liner with prompts
openssl req -x509 -newkey rsa:2048 -keyout ssl/private.key \
  -out ssl/certificate.crt -days 365 -nodes

# You'll be prompted for:
# Country Name: US
# State: California
# City: San Francisco
# Organization: Your Organization
# Organizational Unit: IT Department
# Common Name: yourdomain.com (IMPORTANT!)
# Email: admin@yourdomain.com
```

### 3. Commercial Certificates

**Pros**: Highest trust, warranty, support
**Best for**: Enterprise production environments

#### Setup Commercial Certificate

```bash
# Generate private key
openssl genrsa -out ssl/yourdomain.key 2048

# Generate certificate signing request
openssl req -new -key ssl/yourdomain.key -out ssl/yourdomain.csr

# Submit CSR to Certificate Authority (CA)
# Download issued certificate and intermediate certificates

# Combine certificates (if needed)
cat yourdomain.crt intermediate.crt > ssl/fullchain.crt
```

## Nginx Configuration

### Basic HTTPS Setup

```nginx
# /etc/nginx/sites-available/mcp-memory
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

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
    
    # SSL session cache
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "no-referrer-when-downgrade";
    
    # Proxy to MCP Memory Stack
    location /api/ {
        proxy_pass http://127.0.0.1:3333;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support (if needed)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:3334;
        proxy_set_header Host $host;
    }
    
    # Static files (if any)
    location / {
        root /var/www/mcp-memory;
        try_files $uri $uri/ =404;
    }
}
```

### Advanced Security Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # Enhanced SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/yourdomain.com/chain.pem;
    
    # Modern SSL settings (Mozilla Modern profile)
    ssl_protocols TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # SSL optimization
    ssl_session_cache shared:SSL:50m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    
    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;
    
    # Enhanced security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'" always;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
    
    # API endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:3333;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout settings
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 30s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
}
```

## Docker Compose SSL Configuration

### Development with Self-Signed Certificates

```yaml
# docker-compose.ssl.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl/certs:ro
    depends_on:
      - mcp-memory
    networks:
      - mcp_network

  mcp-memory:
    # ... existing configuration
    environment:
      - HTTPS_ENABLED=true
      - SSL_CERT_PATH=/etc/ssl/certs/certificate.crt
      - SSL_KEY_PATH=/etc/ssl/private/private.key
    volumes:
      - ./ssl:/etc/ssl/certs:ro
```

### Production with Let's Encrypt

```yaml
# docker-compose.prod.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - mcp-memory
    restart: unless-stopped

  certbot:
    image: certbot/certbot
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt
      - /var/lib/letsencrypt:/var/lib/letsencrypt
    command: certonly --webroot --webroot-path=/var/www/certbot --email admin@yourdomain.com --agree-tos --no-eff-email -d yourdomain.com
    profiles:
      - certbot  # Only run when explicitly called
```

## Application-Level SSL Configuration

### Express.js HTTPS Server

```javascript
// src/core/https-server.js
import https from 'https';
import fs from 'fs';
import express from 'express';

export function createHTTPSServer(app, config) {
  if (!config.ssl.enabled) {
    return null;
  }

  const options = {
    key: fs.readFileSync(config.ssl.keyPath),
    cert: fs.readFileSync(config.ssl.certPath)
  };

  // Add intermediate certificates if available
  if (config.ssl.caPath) {
    options.ca = fs.readFileSync(config.ssl.caPath);
  }

  const httpsServer = https.createServer(options, app);
  
  httpsServer.listen(config.ssl.port, () => {
    console.log(`HTTPS server listening on port ${config.ssl.port}`);
  });

  return httpsServer;
}
```

### Configuration Support

```javascript
// src/config.js
export const config = {
  ssl: {
    enabled: process.env.SSL_ENABLED === 'true',
    port: process.env.SSL_PORT || 443,
    keyPath: process.env.SSL_KEY_PATH || '/etc/ssl/private/private.key',
    certPath: process.env.SSL_CERT_PATH || '/etc/ssl/certs/certificate.crt',
    caPath: process.env.SSL_CA_PATH || null,
    
    // Security options
    protocols: ['TLSv1.2', 'TLSv1.3'],
    ciphers: 'ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512',
    honorCipherOrder: true,
    
    // HSTS settings
    hstsMaxAge: 31536000, // 1 year
    hstsIncludeSubDomains: true,
    hstsPreload: true
  }
};
```

## Database SSL Configuration

### PostgreSQL SSL Setup

```bash
# Generate server certificate for PostgreSQL
openssl req -new -x509 -days 365 -nodes -text \
  -out server.crt -keyout server.key \
  -subj "/CN=postgres.yourdomain.com"

# Copy to PostgreSQL data directory
sudo cp server.crt /var/lib/postgresql/data/
sudo cp server.key /var/lib/postgresql/data/
sudo chmod 600 /var/lib/postgresql/data/server.key
sudo chown postgres:postgres /var/lib/postgresql/data/server.*
```

### PostgreSQL Configuration

```bash
# postgresql.conf
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
ssl_ca_file = 'ca.crt'  # If using client certificates
ssl_crl_file = 'server.crl'  # Certificate revocation list

# Client authentication
ssl_prefer_server_ciphers = on
ssl_protocols = 'TLSv1.2,TLSv1.3'
```

### Database Connection String

```bash
# SSL connection string
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# SSL with certificate verification
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=verify-full&sslcert=client.crt&sslkey=client.key&sslrootcert=ca.crt
```

## SSL Testing and Validation

### Test SSL Configuration

```bash
# Test SSL certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Check certificate details
openssl x509 -in ssl/certificate.crt -text -noout

# Verify certificate chain
openssl verify -CAfile ca.crt certificate.crt

# Test specific SSL protocols
openssl s_client -connect yourdomain.com:443 -tls1_2
openssl s_client -connect yourdomain.com:443 -tls1_3
```

### Online SSL Testing

```bash
# SSL Labs test (automated)
curl -s "https://api.ssllabs.com/api/v3/analyze?host=yourdomain.com&publish=off&startNew=on"

# Certificate transparency logs
curl -s "https://crt.sh/?q=yourdomain.com&output=json"
```

### Local Testing

```bash
# Test HTTPS endpoint
curl -v https://yourdomain.com/health

# Test with self-signed certificate (ignore verification)
curl -k https://yourdomain.com/health

# Test specific cipher
curl --tlsv1.2 --ciphers ECDHE-RSA-AES256-GCM-SHA384 https://yourdomain.com/health
```

## Monitoring and Maintenance

### Certificate Expiration Monitoring

```bash
#!/bin/bash
# check-ssl-expiry.sh

DOMAIN="yourdomain.com"
THRESHOLD_DAYS=30

# Get certificate expiration date
EXPIRY_DATE=$(openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | \
  openssl x509 -noout -dates | grep notAfter | cut -d= -f2)

# Convert to timestamp
EXPIRY_TIMESTAMP=$(date -d "$EXPIRY_DATE" +%s)
CURRENT_TIMESTAMP=$(date +%s)

# Calculate days remaining
DAYS_REMAINING=$(( (EXPIRY_TIMESTAMP - CURRENT_TIMESTAMP) / 86400 ))

if [ $DAYS_REMAINING -lt $THRESHOLD_DAYS ]; then
  echo "WARNING: SSL certificate expires in $DAYS_REMAINING days"
  # Send alert (email, Slack, etc.)
else
  echo "SSL certificate is valid for $DAYS_REMAINING more days"
fi
```

### Automated Certificate Renewal

```bash
#!/bin/bash
# renew-certificates.sh

# Renew Let's Encrypt certificates
certbot renew --quiet

# Reload nginx configuration
nginx -s reload

# Restart application if needed
docker-compose restart nginx

# Log renewal
echo "$(date): SSL certificates renewed" >> /var/log/ssl-renewal.log
```

### Health Check with SSL

```javascript
// Health check with SSL validation
export async function checkSSLHealth(hostname, port = 443) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(port, hostname, (err) => {
      if (err) {
        reject(err);
        return;
      }

      const cert = socket.getPeerCertificate();
      const valid_from = new Date(cert.valid_from);
      const valid_to = new Date(cert.valid_to);
      const now = new Date();

      const daysUntilExpiry = Math.floor((valid_to - now) / (1000 * 60 * 60 * 24));

      resolve({
        valid: true,
        valid_from,
        valid_to,
        daysUntilExpiry,
        issuer: cert.issuer,
        subject: cert.subject
      });

      socket.end();
    });

    socket.on('error', reject);
  });
}
```

## Security Best Practices

### Certificate Management

1. **Use strong private keys** (2048-bit RSA minimum, 4096-bit recommended)
2. **Protect private keys** (chmod 600, secure storage)
3. **Regular rotation** (annual certificate renewal)
4. **Certificate transparency** monitoring
5. **Backup certificates** securely

### SSL/TLS Configuration

1. **Disable weak protocols** (SSLv2, SSLv3, TLSv1.0, TLSv1.1)
2. **Use strong ciphers** (AEAD ciphers preferred)
3. **Enable HSTS** with reasonable max-age
4. **Implement OCSP stapling**
5. **Regular security testing**

### Monitoring and Alerting

1. **Certificate expiration alerts** (30 days warning)
2. **SSL configuration monitoring**
3. **Protocol usage analytics**
4. **Security vulnerability scanning**
5. **Performance impact monitoring**

## Troubleshooting

### Common Issues

**Certificate not trusted:**
```bash
# Check certificate chain
openssl s_client -connect yourdomain.com:443 -showcerts

# Verify intermediate certificates are included
curl -I https://yourdomain.com
```

**Mixed content warnings:**
```bash
# Ensure all resources use HTTPS
grep -r "http://" /var/www/html/
```

**Performance issues:**
```bash
# Monitor SSL handshake time
curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com/health
```

**Certificate renewal failures:**
```bash
# Check certbot logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log

# Test renewal manually
sudo certbot renew --dry-run
```

For additional troubleshooting, see [Common Issues](../troubleshooting/common-issues.md).

---

This guide covers comprehensive SSL/TLS setup for secure MCP Memory Stack deployment. Always test configurations in staging before applying to production.