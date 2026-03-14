FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Install Haraka globally
RUN npm install -g Haraka

# Initialize Haraka directory
RUN haraka -i /app/haraka

# Install plugin dependencies
WORKDIR /app/haraka
RUN npm install redis@4

# Generate self-signed TLS cert for development
RUN mkdir -p config/tls && \
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout config/tls/tls_key.pem -out config/tls/tls_cert.pem \
    -subj "/CN=mail.localhost"

# Copy config and plugins (also mounted as volumes in dev)
COPY config/ /app/haraka/config/
COPY plugins/ /app/haraka/plugins/

EXPOSE 25 587

CMD ["haraka", "-c", "/app/haraka"]
