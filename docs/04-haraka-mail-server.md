# Haraka Mail Server Setup

## Why Haraka?

| Aspect | Haraka | Postfix |
|--------|--------|---------|
| Language | Node.js | C |
| Configuration | JS plugins | Config files |
| Customization | Full programmatic | Limited |
| Bounce Handling | Direct webhooks | Parse logs |

## Directory Structure

```
infrastructure/haraka/
├── config/
│   ├── smtp.ini           # Main settings
│   ├── plugins            # Plugin load order
│   ├── dkim_sign.ini      # DKIM config
│   └── outbound.ini       # Rate limits
├── plugins/
│   ├── auth_api.js        # Auth against API
│   ├── rate_limit.js      # Per-account limits
│   ├── add_tracking.js    # Add headers
│   ├── delivery_webhook.js # Delivery callback
│   └── bounce_webhook.js   # Bounce callback
├── dkim/
│   └── yourdomain.com/
│       └── default.pem    # DKIM private key
└── Dockerfile
```

## Core Configuration

### config/smtp.ini
```ini
[main]
listen=[::0]:25,[::0]:587
nodes=4
daemonize=false

[headers]
add_received=true
show_version=false
```

### config/outbound.ini
```ini
[main]
concurrency_max=100
pool_concurrency_max=10

[gmail.com]
rate=10/s
max_connections=20

[outlook.com]
rate=5/s
max_connections=15

[default]
rate=20/s
max_connections=50
```

## DNS Records Required

```dns
; A Record
mail.yourdomain.com.    IN  A       YOUR_IP

; MX Record
yourdomain.com.         IN  MX  10  mail.yourdomain.com.

; Reverse DNS (PTR)
YOUR_IP                 IN  PTR     mail.yourdomain.com.

; SPF
yourdomain.com.         IN  TXT     "v=spf1 ip4:YOUR_IP -all"

; DKIM
default._domainkey.     IN  TXT     "v=DKIM1; k=rsa; p=..."

; DMARC
_dmarc.yourdomain.com.  IN  TXT     "v=DMARC1; p=quarantine"
```

## Custom Plugins

### auth_api.js
Authenticates SMTP users against your API database.

### delivery_webhook.js
POSTs to your API when email is delivered or bounces.

### rate_limit.js
Limits emails per account per hour using Redis.

## Docker Setup

```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN npm install -g Haraka
RUN haraka -i /app/haraka
COPY config/ /app/haraka/config/
COPY plugins/ /app/haraka/plugins/
EXPOSE 25 587
CMD ["haraka", "-c", "/app/haraka"]
```
