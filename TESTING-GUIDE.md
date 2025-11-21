# Testing Guide - Etsy Automation Platform

## 🚀 Quick Start Testing

### 1. **Register & Login**

1. Navigate to: http://localhost:3000/register
2. Fill in the form:
   - **Email**: test@example.com
   - **Name**: Test User
   - **Company Name**: My Test Company
   - **Password**: TestPass123!
3. Click "Create Account"
4. You'll be redirected to the dashboard

### 2. **Import Sample Products**

1. Go to: http://localhost:3000/products
2. Click "Import Products" button
3. Select the `sample-products.csv` file from the project root
4. Click "Choose File" and select it
5. Wait for import confirmation
6. You should see 10 products in the list

**CSV Format:**
```csv
sku,title,description,price,quantity
TSHIRT-001,Vintage Style Cotton T-Shirt,"Description here",29.99,50
```

### 3. **Test All UI Pages**

Visit each page to verify they load:

- **Dashboard**: http://localhost:3000
- **Products**: http://localhost:3000/products
  - Import products ✅
  - View product list ✅
  - Bulk select/delete ✅

- **AI Generation**: http://localhost:3000/ai
  - Select product ✅
  - View AI generation UI ✅
  - (Generate button will work once AI keys are added) ⏳

- **Listings**: http://localhost:3000/listings
  - View job queue ✅
  - See status (no jobs yet until Etsy connected) ⏳

- **Orders**: http://localhost:3000/orders
  - View orders page ✅
  - (Orders will sync once Etsy connected) ⏳

- **Schedules**: http://localhost:3000/schedules
  - View schedules ✅
  - Create schedule UI ✅
  - (Schedules work once Etsy connected) ⏳

- **Usage & Costs**: http://localhost:3000/usage
  - View cost dashboard ✅
  - (Costs tracked after AI usage) ⏳

- **Settings**: http://localhost:3000/settings
  - View organization info ✅
  - Etsy connection status ✅
  - (Connect Etsy once API keys available) ⏳

### 4. **Test Authentication**

1. **Logout**: Click user menu → Logout
2. **Login**: Go to http://localhost:3000/login
   - Use same credentials
   - Should redirect to dashboard
3. **Protected Routes**: Try accessing http://localhost:3000/products without login
   - Should redirect to login page ✅

---

## 🔑 When Etsy API Keys Are Approved

### 1. **Add Environment Variables**

Edit `apps/api/.env`:
```env
# Etsy API Credentials
ETSY_CLIENT_ID=your_keystring_here
ETSY_CLIENT_SECRET=your_shared_secret_here
ETSY_REDIRECT_URI=http://localhost:3000/api/auth/callback/etsy

# Optional: AI Provider Keys (for AI generation)
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
```

### 2. **Restart Services**

```bash
cd "C:\Users\David\Desktop\ETSY\etsy-automation-platform"
docker compose restart api
```

### 3. **Connect Your Etsy Shop**

1. Go to: http://localhost:3000/settings
2. Click "Connections" tab
3. Click "Connect Etsy Shop" button
4. Authorize on Etsy
5. You'll be redirected back
6. Shop should show as "Connected" ✅

### 4. **Test Full Flow**

**Complete Listing Flow:**

1. **Import Products** (already done above)
2. **Generate AI Content** (if AI keys added):
   - Go to AI Generation page
   - Select a product
   - Click "Generate AI Content"
   - Review and approve
3. **Create Listing Job**:
   - Backend will create listing job
   - View in Listings page
   - Job will process automatically
4. **View on Etsy**:
   - Check your Etsy shop
   - Listing should appear as draft or active

**Automated Schedule:**

1. Go to Schedules page
2. Create new schedule:
   - Name: "Daily Auto-Publish"
   - Shop: Select your connected shop
   - Frequency: Daily
   - Daily Quota: 10
   - Time Slots: 09:00, 12:00, 15:00
3. Schedule will run automatically every 5 minutes
4. Check Listings page to see created jobs

---

## 🧪 Testing Checklist

### Frontend ✅
- [x] User registration works
- [x] User login/logout works
- [x] All pages load without errors
- [x] Product import from CSV works
- [x] Navigation between pages works
- [x] Protected routes redirect to login

### Backend (Ready, waiting for Etsy API) ⏳
- [ ] Etsy OAuth connection
- [ ] Token auto-refresh
- [ ] Create Etsy listing
- [ ] Upload images to listing
- [ ] Publish listing to active
- [ ] Sync orders from Etsy
- [ ] Schedule automation runs

### Infrastructure ✅
- [x] Database tables created
- [x] Redis connection works
- [x] Docker services running
- [x] API responding to requests

---

## 🐛 Troubleshooting

### Products Page Shows Error
- Check browser console (F12)
- Verify API is running: http://localhost:8080/docs
- Check Docker logs: `docker compose logs api`

### Login Not Working
- Verify JWT keys exist: `apps/api/private.pem` and `public.pem`
- Check API logs for errors
- Try restarting: `docker compose restart api`

### Import CSV Fails
- Verify CSV has correct headers: `sku,title,description,price,quantity`
- Check for special characters in CSV
- Ensure price is numeric (e.g., `29.99` not `$29.99`)

### Settings Page Error
- Clear browser cache and hard refresh (Ctrl+Shift+R)
- Check if shops API returns array format

---

## 📊 Sample Test Data

**10 Products Created:**
1. Vintage Style Cotton T-Shirt - $29.99
2. Handmade Ceramic Coffee Mug - $24.99
3. Modern Abstract Art Print - $19.99
4. Natural Soy Wax Candle - $16.99
5. Premium Leather Notebook - $34.99
6. Custom Wooden Keychain - $12.99
7. Waterproof Vinyl Sticker Pack - $8.99
8. Handmade Beaded Bracelet - $22.99
9. Decorative Throw Pillow Cover - $18.99
10. Eco-Friendly Canvas Tote Bag - $15.99

**Total Value**: $206.90
**Total Quantity**: 1,005 units

---

## 🎯 Next Steps After Etsy Approval

1. Add Etsy API credentials to `.env`
2. Restart services
3. Connect your Etsy shop in Settings
4. Test creating one listing manually
5. Set up automated schedules
6. Monitor in Listings page
7. Check orders sync in Orders page

---

## 💡 Tips

- **Use Chrome DevTools** (F12) to debug frontend issues
- **Check Docker logs** for backend errors: `docker compose logs -f api`
- **API Documentation**: Visit http://localhost:8080/docs for interactive API docs
- **Database Access**: Use a PostgreSQL client to connect to `localhost:5432`
- **Redis Monitoring**: Use Redis CLI: `docker compose exec redis redis-cli`

---

## 🆘 Need Help?

If you encounter any issues:

1. Check this guide first
2. Review Docker logs: `docker compose logs api web`
3. Verify all services are running: `docker compose ps`
4. Restart everything: `docker compose down && docker compose up -d`
5. Check browser console for frontend errors

---

**Current Platform Status:**
- ✅ Core platform complete and functional
- ⏳ Waiting for Etsy API approval to test integrations
- ✅ All UI pages built and accessible
- ✅ Database and infrastructure ready
- ✅ Background workers configured
