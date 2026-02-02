# Deployment Quick Start Guide

## 🎯 Two Deployment Options for Client Testing

---

## **Option 1: Render Free Tier** ⚡ FASTEST (30 minutes)

**Best for:** Quick demos, client testing, proof of concept

### What You Get (Free):
- ✅ API + Frontend live
- ✅ PostgreSQL database (90 days)
- ✅ Public URL immediately
- ❌ Background workers disabled (tasks run synchronously)
- ⚠️ API sleeps after 15 min (30s wake-up time)

### Quick Steps:
1. **Sign up for Upstash** (free Redis): https://upstash.com
2. **Sign up for Render**: https://render.com
3. **Follow:** `RENDER_DEPLOYMENT_GUIDE.md`

### Timeline:
- ⏱️ Setup: 10 minutes
- 🏗️ Build: 15 minutes  
- ✅ **Live in 30 minutes**

### URL Format:
- Frontend: `https://etsy-web.onrender.com`
- API: `https://etsy-api.onrender.com`

---

## **Option 2: Google Cloud** 🏆 FULL FEATURED (1 hour)

**Best for:** Production-ready, full functionality, long-term testing

### What You Get (Free for 90 days):
- ✅ **$300 credit** for 90 days
- ✅ ALL features working (workers, jobs, scheduling)
- ✅ Professional infrastructure
- ✅ Monitoring (Grafana)
- ✅ Full control

### Quick Steps:
1. **Sign up for Google Cloud**: https://cloud.google.com/free
2. **Follow:** `GOOGLE_CLOUD_DEPLOYMENT_GUIDE.md`
3. **Or use auto-deploy script:** `deploy-gcloud.sh`

### Timeline:
- ⏱️ Account setup: 15 minutes
- 🏗️ VM setup: 15 minutes
- 📦 Deployment: 30 minutes
- ✅ **Live in 1 hour**

### URL Format:
- All services: `http://YOUR_VM_IP:PORT`
- Optional: Set up custom domain with HTTPS

---

## **Comparison Table:**

| Feature | Render Free | Google Cloud Trial |
|---------|-------------|-------------------|
| **Cost** | Free (forever with limits) | $300 credit (90 days) |
| **Setup Time** | 30 minutes | 1 hour |
| **Background Jobs** | ❌ Disabled | ✅ Enabled |
| **API Cold Starts** | ⚠️ 30s after sleep | ✅ Always on |
| **Database** | ✅ 90 days | ✅ Unlimited |
| **Redis** | ✅ Upstash (10K/day) | ✅ Unlimited |
| **Monitoring** | ⚠️ Basic | ✅ Full (Grafana) |
| **Custom Domain** | ✅ Easy | ✅ Full control |
| **Scalability** | ⚠️ Limited | ✅ Auto-scale |
| **Best For** | Quick demos | Production testing |

---

## **Recommended Approach:**

### **Week 1: Render Free Tier**
1. Deploy to Render today (30 minutes)
2. Share with client immediately
3. Get feedback on UI/UX
4. Test basic workflows

### **Week 2: Google Cloud**
1. Set up Google Cloud over weekend (1 hour)
2. Deploy full stack
3. Enable all features (workers, scheduling)
4. Let client test complete functionality
5. Monitor with Grafana

### **Week 3+: Decision Point**
- **Keep Google Cloud** if happy ($30/month after credit)
- **Upgrade Render** to paid ($21/month)
- **Switch to Oracle Cloud** (always free, requires setup)

---

## **Files You Need:**

### For Render:
- ✅ `render.yaml` - Service configuration
- ✅ `apps/api/Dockerfile.render` - API build config
- ✅ `RENDER_DEPLOYMENT_GUIDE.md` - Step-by-step guide

### For Google Cloud:
- ✅ `docker-compose.yml` - Already configured
- ✅ `deploy-gcloud.sh` - Auto-deploy script
- ✅ `GOOGLE_CLOUD_DEPLOYMENT_GUIDE.md` - Complete guide

---

## **Quick Deploy Commands:**

### Render (after setup):
```bash
# 1. Set up Upstash Redis
# 2. Push to GitHub
# 3. Connect Render to GitHub
# 4. Add environment variables
# Done! (automated)
```

### Google Cloud (after VM setup):
```bash
# SSH into VM
git clone https://github.com/yourusername/etsy-automation-platform.git
cd etsy-automation-platform
chmod +x deploy-gcloud.sh
./deploy-gcloud.sh
# Follow prompts
# Done!
```

---

## **Need Help?**

1. **Render Issues:**
   - Check: `RENDER_DEPLOYMENT_GUIDE.md`
   - Logs: Render Dashboard → Service → Logs

2. **Google Cloud Issues:**
   - Check: `GOOGLE_CLOUD_DEPLOYMENT_GUIDE.md`
   - Logs: `docker-compose logs`

3. **Environment Variables:**
   - See: `.env.example` for all required vars

---

## **URLs After Deployment:**

### Render:
```
Frontend: https://etsy-web.onrender.com
API:      https://etsy-api.onrender.com
Docs:     https://etsy-api.onrender.com/docs
```

### Google Cloud:
```
Frontend: http://YOUR_VM_IP:3000
API:      http://YOUR_VM_IP:8080
Docs:     http://YOUR_VM_IP:8080/docs
Grafana:  http://YOUR_VM_IP:3001
Adminer:  http://YOUR_VM_IP:8081
```

---

## **Cost Summary:**

### Render Free:
- **Now:** $0/month (with limitations)
- **Remove limits:** $21/month

### Google Cloud:
- **Trial (90 days):** $0 with $300 credit
- **After trial:** 
  - Keep full: ~$30/month
  - Downgrade to free tier: $0/month (limited resources)

### Oracle Cloud Always Free:
- **Forever:** $0/month
- **Setup:** More complex
- **Guide:** Available on request

---

## **Client Demo Checklist:**

Before sharing with client:

1. ✅ Test registration/login
2. ✅ Connect a test Etsy shop
3. ✅ Import sample products
4. ✅ Generate AI content
5. ✅ Create test schedule
6. ✅ Check all pages load
7. ✅ Verify mobile responsive
8. ✅ Share URL + test credentials

---

## **Ready to Deploy?**

1. **For quick demo NOW:**  
   👉 Follow `RENDER_DEPLOYMENT_GUIDE.md`

2. **For full functionality this weekend:**  
   👉 Follow `GOOGLE_CLOUD_DEPLOYMENT_GUIDE.md`

3. **Want both? (Recommended)**  
   👉 Start with Render today, add Google Cloud this weekend

Good luck with your deployment! 🚀
