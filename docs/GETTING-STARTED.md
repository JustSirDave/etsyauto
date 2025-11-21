# Getting Started with Etsy Automation Platform

Welcome to the Etsy Automation Platform! This guide will help you get started with automating your Etsy shop listings using AI-powered content generation.

## 📚 Table of Contents

- [What is Etsy Automation Platform?](#what-is-etsy-automation-platform)
- [Quick Start (5 Minutes)](#quick-start-5-minutes)
- [Detailed Setup](#detailed-setup)
- [Your First Listing](#your-first-listing)
- [Next Steps](#next-steps)

---

## What is Etsy Automation Platform?

The Etsy Automation Platform is a comprehensive tool that helps Etsy sellers:

✅ **Import products** in bulk from CSV/JSON files
✅ **Generate AI-powered content** with optimized titles, descriptions, and tags
✅ **Publish listings automatically** to Etsy with rate limiting
✅ **Schedule automated publishing** to maintain consistent shop activity
✅ **Sync orders** from Etsy for fulfillment tracking
✅ **Track costs** for AI generation and API usage
✅ **Ensure policy compliance** with built-in guardrails

---

## Quick Start (5 Minutes)

### Step 1: Create Your Account

1. Navigate to the registration page: `http://localhost:3000/register`
2. Fill in your details:
   - **Email**: Your business email
   - **Name**: Your full name
   - **Company Name**: Your business/organization name
   - **Password**: Strong password (8+ characters)
3. Click **"Create Account"**
4. You'll be automatically logged in and redirected to the dashboard

### Step 2: Connect Your Etsy Shop

1. Go to **Settings** → **Connections** tab
2. Click **"Connect Etsy Shop"** button
3. You'll be redirected to Etsy to authorize the app
4. Grant the requested permissions:
   - Read shop information
   - Create and manage listings
   - Read orders/transactions
5. You'll be redirected back to the platform
6. Your shop status should show **"Connected"** ✅

### Step 3: Import Your First Products

1. Navigate to **Products** page
2. Click **"Import Products"** button
3. Choose your import method:
   - **CSV Upload**: Select a CSV file with your products
   - **JSON Upload**: Upload a JSON file with product data
4. Wait for the import to complete
5. Your products will appear in the product list

**CSV Format Example:**
```csv
sku,title,description,price,quantity
PROD-001,Handmade Mug,Beautiful ceramic mug,24.99,10
```

### Step 4: Generate AI Content (Optional)

1. Go to **AI Generation** page
2. Select a product from the left sidebar
3. Click **"Generate AI Content"**
4. Review the generated:
   - Title (optimized for Etsy search)
   - Description (compelling and detailed)
   - Tags (13 relevant keywords)
   - SEO title
5. Click **"Approve & Ready to List"** if satisfied

### Step 5: Publish Your First Listing

**Manual Method:**
- Approved products will automatically queue for publishing
- Check **Listings** page to see job status
- Jobs process automatically in the background

**Automated Method:**
1. Go to **Schedules** page
2. Click **"Create Schedule"**
3. Configure:
   - **Name**: "Daily Auto-Publish"
   - **Shop**: Select your connected shop
   - **Frequency**: Daily
   - **Daily Quota**: 10 (listings per day)
   - **Time Slots**: Choose publish times (e.g., 9:00, 12:00, 15:00)
4. Click **"Create"**
5. Schedule will run automatically every 5 minutes

**That's it!** Your platform is now set up and ready to automate your Etsy listings! 🎉

---

## Detailed Setup

### Prerequisites

Before you begin, ensure you have:

- ✅ An active Etsy seller account
- ✅ Etsy API credentials (keystring and shared secret)
- ✅ Products ready to list (CSV file or product data)
- ✅ (Optional) OpenAI or Anthropic API key for AI generation

### Getting Etsy API Credentials

1. **Apply for Etsy API Access**:
   - Visit: https://www.etsy.com/developers/register
   - Create a new app
   - Fill in app details:
     - **App Name**: "My Etsy Automation"
     - **App Description**: "Automated listing management"
     - **Callback URL**: `http://localhost:3000/api/auth/callback/etsy`

2. **Wait for Approval**:
   - Etsy reviews API applications manually
   - Approval typically takes 1-3 business days
   - You'll receive an email when approved

3. **Get Your Credentials**:
   - Once approved, go to your app dashboard
   - Copy your **Keystring** (Client ID)
   - Copy your **Shared Secret** (Client Secret)

4. **Configure the Platform**:
   - Add credentials to your `.env` file (see Configuration section)

### Configuration

Edit `apps/api/.env` file:

```env
# Required: Etsy API Credentials
ETSY_CLIENT_ID=your_keystring_here
ETSY_CLIENT_SECRET=your_shared_secret_here
ETSY_REDIRECT_URI=http://localhost:3000/api/auth/callback/etsy

# Optional: AI Providers (choose one or both)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Image Storage (for advanced usage)
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
```

After updating `.env`:
```bash
# Restart the API service
docker compose restart api
```

---

## Your First Listing

Let's walk through publishing your first listing step-by-step.

### Option A: Manual Publishing (Recommended for First Time)

1. **Prepare Your Product**:
   - Have product details ready (SKU, title, description, price, quantity)
   - Optional: Product images (URLs or files)

2. **Import the Product**:
   - Go to **Products** page
   - Click **"Import Products"**
   - Upload your CSV or JSON file
   - Verify product appears in the list

3. **Generate AI Content** (Optional but Recommended):
   - Go to **AI Generation** page
   - Select your product from the sidebar
   - Click **"Generate AI Content"**
   - Wait 5-10 seconds for generation
   - Review the content:
     - ✅ Title is under 140 characters
     - ✅ Description is compelling
     - ✅ Tags are relevant
     - ✅ No policy violations
   - Click **"Approve & Ready to List"**

4. **Monitor Publishing**:
   - Go to **Listings** page
   - Find your listing job in the queue
   - Watch the status change:
     - **Pending** → **Processing** → **Completed**
   - If status is **Failed**, click retry button
   - Click the Etsy listing ID to view on Etsy

5. **Verify on Etsy**:
   - Log into your Etsy shop
   - Check your listings
   - Your new listing should appear as Active or Draft

### Option B: Automated Scheduling

1. **Set Up a Schedule**:
   - Go to **Schedules** page
   - Click **"Create Schedule"**
   - Fill in details:
     ```
     Name: Morning Auto-Publish
     Shop: [Your Connected Shop]
     Frequency: Daily
     Daily Quota: 5
     Time Slots: 09:00
     ```
   - Click **"Create"**

2. **Prepare Products**:
   - Import multiple products at once
   - Generate AI content for all products
   - Approve the AI content

3. **Let It Run**:
   - The schedule runs automatically every 5 minutes
   - It will publish up to your daily quota
   - Monitor progress in **Listings** page

4. **Adjust as Needed**:
   - Pause schedule if needed (toggle button)
   - Change daily quota
   - Add more time slots for distribution

---

## Next Steps

Now that you're set up, explore these features:

### 1. **Bulk Product Import**
- Import 100+ products at once
- Use CSV templates for consistency
- Track import batches

### 2. **AI Content Optimization**
- Generate variations
- A/B test different titles
- Optimize for Etsy search

### 3. **Order Management**
- Sync orders from Etsy
- Track fulfillment status
- Monitor shipping

### 4. **Cost Tracking**
- View AI generation costs
- Track API usage
- Monitor monthly spending

### 5. **Advanced Scheduling**
- Create multiple schedules
- Stagger publishing times
- Optimize for peak traffic

---

## 🎓 Learning Resources

- **User Manual**: See `USER-MANUAL.md` for complete feature documentation
- **FAQ**: See `FAQ.md` for common questions
- **Troubleshooting**: See `TROUBLESHOOTING.md` for help with issues
- **API Documentation**: Visit `http://localhost:8080/docs` for API reference

---

## 💡 Pro Tips

1. **Start Small**: Begin with 5-10 products to learn the workflow
2. **Review AI Content**: Always review generated content before publishing
3. **Use Schedules**: Automate publishing for consistent shop activity
4. **Monitor Costs**: Check Usage & Costs page regularly
5. **Test First**: Use draft mode to test before going live
6. **Stay Compliant**: The platform checks for policy violations automatically

---

## 🆘 Need Help?

- **Documentation**: Check the `docs/` folder
- **API Issues**: Check `docker compose logs api`
- **Frontend Issues**: Check browser console (F12)
- **Support**: Create an issue on GitHub

---

## ✅ Checklist for Success

- [ ] Account created and verified
- [ ] Etsy shop connected
- [ ] First product imported
- [ ] AI content generated and approved
- [ ] First listing published successfully
- [ ] Schedule created (if using automation)
- [ ] Orders syncing correctly
- [ ] Costs being tracked

**Congratulations!** You're now ready to scale your Etsy business with automation! 🚀

---

**Last Updated**: 2025
**Version**: 1.0.0 (Beta)
