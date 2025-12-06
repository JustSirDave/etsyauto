# Check Production Server Logs

## Commands to Run on Production Server

### 1. Check Recent API Logs (Last 100 lines)
```bash
docker logs etsy-api --tail 100
```

### 2. Check Logs for Registration Errors
```bash
docker logs etsy-api --tail 200 | grep -i "register\|error\|exception\|traceback" -A 5 -B 5
```

### 3. Check Logs from Last 10 Minutes
```bash
docker logs etsy-api --since 10m
```

### 4. Check All Recent Errors
```bash
docker logs etsy-api --tail 500 | grep -i "error\|exception\|traceback\|failed" -A 10 -B 5
```

### 5. Follow Logs in Real-Time
```bash
docker logs etsy-api -f
```
(Press Ctrl+C to stop)

### 6. Check Specific Registration Endpoint Errors
```bash
docker logs etsy-api --tail 1000 | grep -i "/api/auth/register" -A 20 -B 5
```

### 7. Export Full Logs to File
```bash
docker logs etsy-api > api_logs.txt 2>&1
# Then search the file
grep -i "register\|error\|exception" api_logs.txt -A 10 -B 5
```

### 8. Check JWT-Related Errors
```bash
docker logs etsy-api --tail 500 | grep -i "jwt\|token\|key" -A 5 -B 5
```

## What to Look For

1. **JWT Key Errors**: Look for messages like:
   - "JWT keys not found"
   - "Invalid key format"
   - "KeyError" or "AttributeError" related to JWT

2. **Database Errors**: Look for:
   - "connection failed"
   - "relation does not exist"
   - "permission denied"

3. **Python Exceptions**: Look for:
   - `Traceback (most recent call last):`
   - `File "/app/...`
   - `Exception: ...`

4. **Registration-Specific Errors**: Look for:
   - Errors in `/api/auth/register` endpoint
   - User creation failures
   - Tenant creation failures

## Quick Diagnostic Script

Run this on your production server to get a comprehensive error report:

```bash
#!/bin/bash
echo "=== Recent API Errors ==="
docker logs etsy-api --tail 500 | grep -i "error\|exception\|traceback" -A 10 | tail -50

echo ""
echo "=== Registration Endpoint Activity ==="
docker logs etsy-api --tail 1000 | grep -i "/api/auth/register" -A 20 | tail -30

echo ""
echo "=== JWT Key Status ==="
docker exec etsy-api python -c "from app.core.config import settings; print('Private key length:', len(settings.JWT_PRIVATE_KEY)); print('Public key length:', len(settings.JWT_PUBLIC_KEY))" 2>&1

echo ""
echo "=== Database Connection ==="
docker exec etsy-api python -c "from app.core.database import engine; from sqlalchemy import inspect; inspector = inspect(engine); print('Connected:', len(inspector.get_table_names()), 'tables found')" 2>&1
```

Save this as `check_logs.sh`, make it executable (`chmod +x check_logs.sh`), and run it.

