# Adminer Setup - Access via Live URL

## Overview
Access Adminer database tool at: `https://etsyauto.bigbotdrivers.com/adminer`

## Step 1: Update docker-compose.yml

The Adminer service is already configured (no port mapping needed - accessed via nginx).

## Step 2: Configure Nginx

**On your server, edit the nginx config:**

```bash
sudo nano /etc/nginx/sites-available/etsyauto.bigbotdrivers.com
```

**Add this location block BEFORE the main `location /` block:**

```nginx
    # Adminer Database Tool (add before location /)
    location /adminer {
        proxy_pass http://localhost:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support (if needed)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
```

**OR if Adminer is in Docker network, use:**

```nginx
    # Adminer Database Tool (add before location /)
    location /adminer {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
```

**Wait!** Since Adminer is in Docker, you need to expose it on localhost first. Update docker-compose.yml:

```yaml
  adminer:
    image: adminer:latest
    container_name: etsy-adminer
    ports:
      - "127.0.0.1:8081:8080"  # Expose on localhost only
    environment:
      ADMINER_DEFAULT_SERVER: db
    depends_on:
      db:
        condition: service_healthy
    networks:
      - etsy-network
```

## Step 3: Test and Reload Nginx

```bash
# Test nginx config
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx
```

## Step 4: Start Adminer

```bash
cd /home/deploy/etsyauto
docker compose up -d adminer
```

## Step 5: Access Adminer

Open in browser: `https://etsyauto.bigbotdrivers.com/adminer`

**Login:**
- **System:** `PostgreSQL`
- **Server:** `db`
- **Username:** `postgres`
- **Password:** (your `DB_PASSWORD` from `.env`)
- **Database:** `etsy_platform`

## Security Recommendation (Optional but Highly Recommended)

Add HTTP Basic Authentication to protect Adminer:

```bash
# Create password file
sudo apt-get install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd admin
# Enter a strong password when prompted
```

Then update nginx config:

```nginx
    location /adminer {
        auth_basic "Adminer Access";
        auth_basic_user_file /etc/nginx/.htpasswd;
        
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

This adds an extra login layer before accessing Adminer.

