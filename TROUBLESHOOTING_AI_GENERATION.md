# Troubleshooting AI Generation

## ✅ System Status

Everything has been rebuilt and verified:

- ✅ **API Container**: Running and healthy
- ✅ **OpenAI API Key**: Configured (164 characters)
- ✅ **Services**: AIGenerationService and PolicyEngine loaded successfully
- ✅ **Imports**: All dependencies working
- ✅ **Database**: Connected and migrations applied

## 🔍 Common Issues & Solutions

### Issue 1: "Nothing is being generated"

**Possible Causes:**
1. Frontend not sending requests correctly
2. Authentication token expired
3. Product doesn't exist
4. Frontend displaying error incorrectly

**Solutions:**

#### A. Check Browser Console for Errors
1. Open your browser's Developer Tools (F12)
2. Go to Console tab
3. Try to generate AI content
4. Look for errors (red text)
5. Share the error message

#### B. Verify Authentication
```javascript
// In browser console, check if token exists:
console.log('Token:', localStorage.getItem('token'));

// If null or expired, login again
```

#### C. Check Network Requests
1. Open Developer Tools (F12)
2. Go to Network tab
3. Try to generate AI content
4. Look for the `/generate` request
5. Click on it and check:
   - Status code (should be 200)
   - Response tab (see actual error)
   - Headers tab (check if Authorization is sent)

### Issue 2: "401 Unauthorized"

**Solution:**
- Your token has expired
- Login again to get a new token

### Issue 3: "404 Not Found"

**Solution:**
- The product doesn't exist
- Check the product ID in the URL
- Create a product first

### Issue 4: "500 Internal Server Error"

**Check API Logs:**
```bash
docker logs etsy-api --tail 50
```

Look for error messages and share them.

## 📝 Manual Testing Steps

### Step 1: Verify API is Running
```bash
curl http://localhost:8000/healthz
# Should return: {"status":"healthy"}
```

### Step 2: Login and Get Token
```bash
# Via frontend: Login at http://localhost:3000/login
# Then check browser console:
localStorage.getItem('token')
```

### Step 3: Create a Test Product
```bash
curl -X POST http://localhost:8000/api/products/import \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "TEST-001",
    "title_raw": "Blue Ceramic Mug",
    "description_raw": "A beautiful ceramic mug",
    "price": 25.00,
    "quantity": 10
  }'

# Note the product_id from response
```

### Step 4: Test AI Generation
```bash
curl -X POST http://localhost:8000/api/products/1/generate \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "style": "friendly",
    "tone": "professional"
  }'
```

**Expected Response:**
```json
{
  "ai_generation_id": 1,
  "title": "Handmade Blue Ceramic Coffee Mug - ...",
  "description": "Beautiful handcrafted...",
  "tags": ["handmade", "ceramic", "mug", ...],
  "policy_status": "passed",
  "needs_review": false,
  "message": "✅ Content generated successfully"
}
```

## 🐛 Debugging Checklist

### Frontend Issues
- [ ] Check browser console for JavaScript errors
- [ ] Check Network tab for failed requests
- [ ] Verify token exists in localStorage
- [ ] Try logging out and back in
- [ ] Clear browser cache
- [ ] Try a different browser

### Backend Issues
- [ ] Check API logs: `docker logs etsy-api --tail 100`
- [ ] Verify OpenAI key: `docker exec etsy-api python -c "import os; print('Key:', 'SET' if os.getenv('OPENAI_API_KEY') else 'NOT SET')"`
- [ ] Test imports: `docker exec etsy-api python -c "from app.services.ai_generation_service import AIGenerationService; print('OK')"`
- [ ] Restart API: `docker-compose restart api`

### Database Issues
- [ ] Check if product exists: Visit http://localhost:8000/api/products
- [ ] Verify migrations: `docker exec etsy-api alembic current`
- [ ] Check DB connection: `docker exec etsy-db psql -U postgres -d etsy_automation -c "SELECT COUNT(*) FROM products;"`

## 📊 Check API Health

```bash
# 1. Check if API is running
curl http://localhost:8000/healthz

# 2. Check OpenAI key is set
docker exec etsy-api python -c "import os; print('OpenAI Key:', 'CONFIGURED' if os.getenv('OPENAI_API_KEY') else 'NOT SET')"

# 3. Test imports
docker exec etsy-api python -c "from app.services.ai_generation_service import AIGenerationService; from app.services.policy_engine import PolicyEngine; print('✅ All imports OK')"

# 4. Check API logs for errors
docker logs etsy-api --tail 50

# 5. Check web container
docker logs etsy-web --tail 20
```

## 🔄 Full Restart Procedure

If nothing works, try a complete restart:

```bash
# 1. Stop everything
docker-compose down

# 2. Remove volumes (WARNING: This deletes data!)
docker volume prune -f

# 3. Rebuild without cache
docker-compose build --no-cache

# 4. Start everything
docker-compose up -d

# 5. Wait for services to be healthy
sleep 30

# 6. Check health
docker-compose ps
docker logs etsy-api --tail 20
```

## 🎯 What to Check in Frontend

### In the Products Page:
1. Click "Generate AI Content" button
2. Watch for:
   - Loading spinner
   - Success message
   - Error message
   - Generated content appearing

### In Browser Console:
```javascript
// Check if API URL is correct
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);

// Should be: http://localhost:8000 or your API URL
```

### In Network Tab:
Look for request to:
```
POST http://localhost:8000/api/products/{id}/generate
```

Check:
- Status code
- Request headers (Authorization should be present)
- Request body (should have model, style, tone)
- Response (check for errors)

## 🚨 Common Error Messages

### "OpenAI API key not configured"
**Solution:** Set OPENAI_API_KEY in your `.env` file

### "Product not found"
**Solution:** Make sure the product exists and you have access to it

### "Permission denied"
**Solution:** Your user role doesn't have GENERATE_CONTENT permission

### "OpenAI generation failed: Error code: 429"
**Solution:** OpenAI API quota exceeded. Check your OpenAI account

### "Invalid JSON response from OpenAI"
**Solution:** OpenAI returned malformed data. Try again or check OpenAI status

## 📞 How to Report Issues

When reporting issues, please provide:

1. **Error Message** (exact text)
2. **Browser Console Output** (screenshot or copy/paste)
3. **API Logs**:
   ```bash
   docker logs etsy-api --tail 100 > api_logs.txt
   ```
4. **Network Request/Response** (from Network tab)
5. **Steps to Reproduce**
6. **Expected vs Actual Behavior**

## ✅ Verification Commands

Run these to verify everything is working:

```bash
# 1. Services running
docker-compose ps

# 2. API health
curl http://localhost:8000/healthz

# 3. OpenAI configured
docker exec etsy-api python -c "from app.core.config import settings; print('✅ OpenAI Key:', 'SET' if settings.OPENAI_API_KEY else '❌ NOT SET')"

# 4. Imports working
docker exec etsy-api python -c "from app.services.ai_generation_service import AIGenerationService; print('✅ Imports OK')"

# 5. Database connected
docker exec etsy-api python -c "from app.core.database import engine; conn = engine.connect(); print('✅ DB Connected'); conn.close()"
```

If all show ✅, the backend is working correctly.

## 🎓 Testing via Python Script

Use the provided `test_generation.py`:

1. Get your auth token from browser localStorage
2. Update the TOKEN variable in the script
3. Run:
   ```bash
   python test_generation.py
   ```

## 💡 Quick Fixes

### Fix 1: Clear and Restart
```bash
docker-compose restart api worker beat web
```

### Fix 2: Rebuild API Only
```bash
docker-compose build api
docker-compose up -d api
```

### Fix 3: Check Specific Product
```bash
# Replace {id} with your product ID
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/products/{id}
```

---

**Still having issues?**

1. Check browser console for errors
2. Check API logs: `docker logs etsy-api --tail 50`
3. Share the exact error message
4. Try the manual testing steps above

