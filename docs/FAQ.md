# Frequently Asked Questions (FAQ)

Common questions about the Etsy Automation Platform.

## 📑 Table of Contents

- [General Questions](#general-questions)
- [Account & Billing](#account--billing)
- [Etsy Integration](#etsy-integration)
- [Products & Importing](#products--importing)
- [AI Content Generation](#ai-content-generation)
- [Listings & Publishing](#listings--publishing)
- [Schedules & Automation](#schedules--automation)
- [Orders & Fulfillment](#orders--fulfillment)
- [Troubleshooting](#troubleshooting)
- [Security & Privacy](#security--privacy)

---

## General Questions

### What is the Etsy Automation Platform?

The Etsy Automation Platform is a comprehensive tool that helps Etsy sellers automate their listing creation and management. It features:
- Bulk product import
- AI-powered content generation
- Automated publishing schedules
- Order synchronization
- Cost tracking

### Do I need technical knowledge to use this?

No! The platform is designed to be user-friendly. If you can use Etsy's seller dashboard, you can use this platform. Basic computer skills are all you need.

### Is this official Etsy software?

No, this is a third-party tool that integrates with Etsy's official API. It's built to comply with all Etsy policies and guidelines.

### What are the system requirements?

- **Browser**: Modern browser (Chrome, Firefox, Safari, Edge)
- **Internet**: Stable internet connection
- **Etsy Account**: Active Etsy seller account
- **API Access**: Approved Etsy API application

### How much does it cost?

Current pricing tiers:
- **Starter**: $X/month - Up to 100 listings/month
- **Pro**: $X/month - Up to 500 listings/month
- **Enterprise**: Custom - Unlimited listings

Plus costs for AI generation (typically $0.01-0.05 per listing).

---

## Account & Billing

### How do I create an account?

1. Go to the registration page
2. Enter email, name, company name, and password
3. Click "Create Account"
4. Verify your email
5. Start using the platform

### Can I have multiple team members?

Yes! You can invite team members with different roles:
- **Owner**: Full access
- **Admin**: Manage settings and members
- **Creator**: Create and manage listings
- **Viewer**: View-only access

### How do I upgrade my plan?

Go to Settings → Billing and select your desired plan. Changes take effect immediately.

### What payment methods do you accept?

- Credit/Debit cards (Visa, Mastercard, Amex)
- PayPal (coming soon)
- Bank transfer for Enterprise plans

### Is there a free trial?

Yes! New accounts get a 14-day free trial with full access to all features.

### Can I cancel anytime?

Yes, cancel anytime from Settings → Billing. No cancellation fees. Your data is retained for 30 days.

---

## Etsy Integration

### How do I connect my Etsy shop?

1. Go to Settings → Connections
2. Click "Connect Etsy Shop"
3. Log into Etsy and authorize
4. You'll be redirected back
5. Shop appears as connected

### Why do I need Etsy API credentials?

Etsy requires all third-party apps to use official API credentials for security. This ensures:
- Secure authentication
- Rate limiting compliance
- Policy enforcement
- Audit trails

### How long does Etsy API approval take?

Typically 1-3 business days. Etsy reviews applications manually to ensure compliance.

### What permissions does the app need?

The app requests:
- **Read shop information**: View your shop details
- **Create/manage listings**: Publish and edit listings
- **Read orders**: Sync order information
- **Profile access**: Verify your identity

### Can I connect multiple Etsy shops?

Yes! Connect multiple shops from Settings → Connections. Each shop is managed separately.

### Will this violate Etsy's terms of service?

No. The platform is designed to comply with all Etsy policies:
- Uses official API
- Respects rate limits
- Checks content policies
- Follows best practices

### How often do tokens refresh?

OAuth tokens refresh automatically every hour to prevent expiration. You'll never need to reconnect manually.

---

## Products & Importing

### What file formats can I import?

- **CSV**: Comma-separated values
- **JSON**: JavaScript Object Notation

### What's the maximum import size?

- Up to 1,000 products per import
- CSV file size: 10MB max
- JSON file size: 10MB max

### What fields are required for import?

**Required**:
- SKU (unique identifier)
- Title
- Price
- Quantity

**Optional**:
- Description
- Images
- Tags
- Category
- Weight/Dimensions

### Can I import product images?

Yes, in two ways:
1. **URL method**: Include image URLs in CSV/JSON
2. **Upload method**: Upload images after import (coming soon)

### What if I have duplicate SKUs?

Duplicate SKUs are rejected. Each SKU must be unique. Update existing products instead of creating duplicates.

### Can I edit products after import?

Yes, edit any product field from the Products page. Changes are saved immediately.

### How do I delete products?

1. Select products (checkboxes)
2. Click delete button
3. Confirm deletion
4. Products are permanently removed

### Can I export my products?

Yes! Export products as CSV or JSON from Products page → Export button.

---

## AI Content Generation

### Which AI providers are supported?

- **OpenAI**: GPT-4, GPT-4-turbo, GPT-3.5-turbo
- **Anthropic**: Claude 3 (Opus, Sonnet, Haiku)

### How much does AI generation cost?

Costs vary by provider and model:
- **GPT-3.5**: ~$0.01 per listing
- **GPT-4**: ~$0.05 per listing
- **Claude 3**: ~$0.02 per listing

Exact costs shown in Usage & Costs page.

### Can I use my own AI API keys?

Yes! Add your keys to Settings → API Keys. This gives you:
- Direct billing from AI provider
- No markup
- Full control

### How long does generation take?

Typically 5-15 seconds per product, depending on:
- Provider selected
- Model selected
- Server load

### Can I regenerate content?

Yes! Click "Regenerate" to create a new variation. Compare and choose the best version.

### Does AI check Etsy policies?

Yes! The platform includes policy guardrails that check for:
- Prohibited items
- Trademark violations
- Medical claims
- Guarantee language
- Banned keywords

### Can I edit AI-generated content?

Yes, you can edit any field before approving. Manual edits are preserved.

### What languages are supported?

Currently English only. Additional languages coming soon:
- Spanish
- French
- German
- Italian

---

## Listings & Publishing

### How long does publishing take?

Usually 30-60 seconds per listing, including:
- Creating draft on Etsy
- Uploading images
- Activating listing

### Why did my listing fail?

Common reasons:
- **Rate limit**: Too many requests to Etsy
- **Invalid data**: Missing required fields
- **Image error**: Image upload failed
- **Authentication**: Token expired
- **Etsy error**: Etsy API temporary issue

Check error message for details.

### Can I retry failed listings?

Yes! Click the retry button (up to 3 attempts). If still failing, check error message.

### How many listings can I publish per day?

Limits vary by plan:
- **Starter**: 100/day
- **Pro**: 500/day
- **Enterprise**: Unlimited

Etsy also has their own limits (~1000/day typically).

### Can I schedule listings for future dates?

Yes! Use the Schedules feature to automate publishing at specific times.

### What happens if I'm rate limited?

The platform automatically:
1. Detects rate limit
2. Waits appropriate time
3. Retries automatically
4. No intervention needed

### Can I publish to multiple shops?

Yes! Select target shop when creating schedule or manual job.

---

## Schedules & Automation

### How do schedules work?

Schedules automatically:
1. Check for ready products every 5 minutes
2. Create listing jobs up to daily quota
3. Publish throughout the day
4. Reset quota at midnight

### What's a daily quota?

Maximum number of listings to publish per day. Helps:
- Avoid appearing spammy
- Spread out shop activity
- Stay within rate limits
- Maintain quality

### Can I have multiple schedules?

Yes! Create multiple schedules for:
- Different shops
- Different product categories
- Different times
- Different quotas

### What are time slots?

Specific times when listings publish. Example:
- 09:00 - Morning batch
- 12:00 - Midday batch
- 15:00 - Afternoon batch

Distributes listings instead of bulk publishing.

### Can I pause a schedule?

Yes! Click pause button. Schedule stops but is not deleted. Resume anytime.

### What if quota runs out?

Schedule stops for the day. Resets at midnight. Remaining products publish next day.

### Do schedules run on weekends?

Yes, schedules run every day unless paused. Configure differently for weekends (coming soon).

---

## Orders & Fulfillment

### How often do orders sync?

Automatically every hour. Manual sync available anytime.

### What order information is synced?

- Order ID
- Buyer email
- Items count
- Total amount
- Status
- Tracking info
- Ship date

### Can I fulfill orders from the platform?

Not directly. View orders here, fulfill in Etsy. Tracking syncs back automatically.

### Does this integrate with Printful?

Coming soon! Auto-create Printful orders and sync tracking.

### Can I export orders?

Yes! Export as CSV for accounting or fulfillment purposes.

### What order statuses are available?

- **Pending**: Payment processing
- **Processing**: Being prepared
- **Shipped**: In transit
- **Delivered**: Completed
- **Cancelled**: Cancelled/refunded

---

## Troubleshooting

### I can't log in

**Try these steps**:
1. Check email/password spelling
2. Reset password if forgotten
3. Clear browser cache
4. Try incognito/private mode
5. Check for typos in email

### Products won't import

**Common issues**:
- CSV format incorrect (check headers)
- Duplicate SKUs
- Invalid data (non-numeric price)
- File too large (>10MB)
- Special characters in file

### Etsy shop won't connect

**Possible reasons**:
- API credentials incorrect
- Redirect URI mismatch
- Etsy API not approved yet
- Browser blocking popup
- Already connected elsewhere

### Listings stuck in "Processing"

**Usually means**:
- High Etsy API load
- Rate limiting active
- Network issue

**Wait 5-10 minutes**. If still stuck, click retry.

### AI generation not working

**Check**:
- API key configured correctly
- Sufficient credits/balance
- Provider service status
- Network connection

### Orders not syncing

**Verify**:
- Shop still connected
- Token not expired
- Etsy API operational
- Correct shop selected

### Page shows error

**Debug steps**:
1. Check browser console (F12)
2. Refresh page (Ctrl+R)
3. Clear cache (Ctrl+Shift+R)
4. Check Docker logs
5. Restart services

---

## Security & Privacy

### Is my data secure?

Yes! Security measures:
- ✅ HTTPS encryption
- ✅ Password hashing (bcrypt)
- ✅ JWT token authentication
- ✅ OAuth tokens encrypted at rest
- ✅ Database encryption
- ✅ Regular security audits

### Who can see my data?

Only you and your team members. Data is:
- Tenant-isolated
- Role-based access
- Not shared with third parties
- Not used for training AI

### How long is data retained?

- **Active account**: Indefinitely
- **Cancelled account**: 30 days
- **Deleted account**: Immediately purged
- **Backups**: 90 days

### Can I export all my data?

Yes! Request full data export from Settings → Data Export. Includes:
- All products
- All listings
- All orders
- All usage data

### Is AI training on my data?

No! Your product data is:
- Never used for AI training
- Never shared with AI providers
- Sent only for generation
- Deleted after processing

### What about GDPR compliance?

Platform is GDPR compliant:
- ✅ Right to access data
- ✅ Right to deletion
- ✅ Right to export
- ✅ Right to rectification
- ✅ Privacy by design

### How do I delete my account?

Settings → Advanced → Delete Account. Requires:
- Password confirmation
- Cannot be undone
- Data deleted in 24 hours

---

## Still Have Questions?

**Contact Support**:
- **Email**: support@example.com
- **GitHub Issues**: Report bugs
- **Documentation**: Check `/docs` folder
- **API Docs**: `http://localhost:8080/docs`

**Response Times**:
- Critical issues: 1 hour
- General support: 24 hours
- Feature requests: 1 week

---

**Last Updated**: 2025
**Version**: 1.0.0 (Beta)
