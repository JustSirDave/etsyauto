# Etsy Automation Platform - User Manual

Complete guide to all features and functionality.

## 📑 Table of Contents

1. [Dashboard](#dashboard)
2. [Products Management](#products-management)
3. [AI Content Generation](#ai-content-generation)
4. [Listings & Jobs](#listings--jobs)
5. [Orders](#orders)
6. [Schedules](#schedules)
7. [Usage & Costs](#usage--costs)
8. [Settings](#settings)

---

## Dashboard

The Dashboard is your central hub for monitoring platform activity.

### Overview Cards

**Active Listings**
- Shows total number of active listings on Etsy
- Click to view all listings

**Pending Jobs**
- Number of listing jobs waiting to be published
- Yellow indicator for pending work

**Orders Today**
- Orders received from Etsy today
- Real-time sync from Etsy API

**AI Credits Used**
- Total AI generation credits used this month
- Monitor spending against your budget

### Recent Activity

View the latest:
- Listing publications
- Order updates
- AI generations
- Schedule runs

### Quick Actions

- **Import Products**: Jump to product import
- **Generate AI**: Go to AI generation page
- **Sync Orders**: Manually trigger order sync
- **View Reports**: Access usage reports

---

## Products Management

Manage your product catalog before listing to Etsy.

### Viewing Products

**Product List View**:
- **SKU**: Unique product identifier
- **Title**: Product name
- **Price**: Selling price
- **Quantity**: Available stock
- **Status**:
  - `pending` - Waiting for AI generation
  - `ready` - Approved and ready to list
  - `listed` - Already published to Etsy
- **Batch ID**: Import batch identifier

**Pagination**:
- 20 products per page
- Use Previous/Next buttons
- Shows total count

### Importing Products

#### CSV Import

**Required Columns**:
```csv
sku,title,description,price,quantity
```

**Optional Columns**:
```csv
images,tags,category,weight,dimensions
```

**Example CSV**:
```csv
sku,title,description,price,quantity
MUG-001,Ceramic Coffee Mug,"Handmade ceramic mug, 12oz",24.99,10
SHIRT-002,Cotton T-Shirt,"100% cotton tee",19.99,50
```

**Steps**:
1. Click **"Import Products"**
2. Choose **CSV** option
3. Select your CSV file
4. Click **"Upload"**
5. Wait for processing
6. View imported products in list

**Import Validation**:
- SKU must be unique
- Price must be numeric
- Quantity must be integer
- Title max 140 characters

#### JSON Import

**Single Product**:
```json
{
  "sku": "PROD-001",
  "title": "Handmade Mug",
  "description": "Beautiful ceramic mug",
  "price": 24.99,
  "quantity": 10,
  "images": ["https://example.com/image1.jpg"],
  "tags": ["ceramic", "mug", "handmade"]
}
```

**Batch Import**:
```json
{
  "products": [
    {
      "sku": "PROD-001",
      "title": "Product 1",
      "price": 19.99,
      "quantity": 10
    },
    {
      "sku": "PROD-002",
      "title": "Product 2",
      "price": 29.99,
      "quantity": 5
    }
  ]
}
```

### Bulk Actions

**Selecting Products**:
- Click checkbox next to each product
- Click header checkbox to select all on page
- Selected count shows in blue banner

**Available Actions**:
- **Delete**: Permanently remove products
- **Change Status**: Bulk status update (coming soon)
- **Export**: Download as CSV (coming soon)

### Filtering & Search

**Filter by Status**:
- All products
- Pending only
- Ready only
- Listed only

**Filter by Batch**:
- Select batch ID from dropdown
- View all products from specific import

**Search** (coming soon):
- Search by SKU
- Search by title
- Search by tags

---

## AI Content Generation

Generate optimized Etsy listing content using AI.

### How It Works

1. **Select Product**: Choose from pending products
2. **Generate**: AI creates optimized content
3. **Review**: Check for quality and compliance
4. **Approve**: Mark as ready to list

### Generated Content

**Title** (Max 140 characters):
- SEO-optimized for Etsy search
- Includes key product attributes
- Front-loads important keywords
- Character counter shows usage

**Description**:
- Compelling product narrative
- Benefits-focused
- Structured with bullet points
- Call-to-action included
- Policy-compliant language

**Tags** (13 tags max):
- Relevant keywords
- Long-tail search terms
- Category-specific
- Trend-aware

**SEO Title**:
- Search engine optimized
- Includes category and attributes
- Broader than listing title

### Policy Compliance

**Automatic Checks**:
- ❌ Prohibited items
- ❌ Trademark violations
- ❌ Banned keywords
- ❌ Medical claims
- ❌ Guarantee language

**Warning Display**:
```
⚠️ Policy Violations Detected
• Avoid using "guaranteed" in description
• Remove trademark "Brand Name"
```

### AI Provider Settings

**Supported Providers**:
- **OpenAI** (GPT-4, GPT-3.5)
- **Anthropic** (Claude 3)

**Cost Tracking**:
- Each generation tracked
- Cost per request shown
- Monthly totals in Usage page

### Regeneration

Don't like the result?
1. Click **"Regenerate"**
2. AI creates new variation
3. Compare with previous
4. Choose best version

### Manual Editing

Want to customize?
1. Generate AI content
2. Copy to clipboard
3. Edit in external editor
4. Paste back (coming soon)

---

## Listings & Jobs

Track and manage Etsy listing publication jobs.

### Job Statuses

**Pending** ⏳:
- Job created, waiting to run
- Will process automatically
- Can be cancelled

**Scheduled** 📅:
- Scheduled for future time
- Part of automated schedule
- Can be cancelled

**Processing** ⚙️:
- Currently publishing to Etsy
- Creating listing
- Uploading images
- Do not cancel

**Completed** ✅:
- Successfully published
- Etsy listing ID available
- View on Etsy link active

**Failed** ❌:
- Publishing error occurred
- Error message shown
- Can retry (up to 3 times)

**Cancelled** 🚫:
- Manually cancelled
- Will not run

### Job Details

Each job shows:
- **Job ID**: Unique identifier
- **Product**: Product name and SKU
- **Shop**: Target Etsy shop
- **Status**: Current state
- **Etsy Listing ID**: After successful publish
- **Retry Count**: Number of retry attempts (max 3)
- **Created**: When job was created
- **Error Message**: If failed

### Managing Jobs

**Retry Failed Job**:
1. Find failed job in list
2. Click retry icon (🔄)
3. Job resets to pending
4. Will attempt again

**Cancel Pending Job**:
1. Find pending/scheduled job
2. Click cancel icon (❌)
3. Confirm cancellation
4. Job will not run

**View on Etsy**:
1. Find completed job
2. Click Etsy listing ID
3. Opens in new tab
4. View published listing

### Auto-Refresh

- Page refreshes every 5 seconds
- See real-time status updates
- Monitor processing jobs
- No manual refresh needed

### Filtering Jobs

**By Status**:
- All jobs
- Pending only
- Processing only
- Completed only
- Failed only

**By Date**:
- Today
- Last 7 days
- Last 30 days
- Custom range

---

## Orders

Sync and manage orders from your Etsy shop.

### Order Sync

**Automatic Sync**:
- Syncs every hour automatically
- Fetches last 100 orders
- Updates existing orders
- Creates new orders

**Manual Sync**:
1. Click **"Sync Orders"** button
2. Wait for sync to complete
3. View updated orders

### Order Information

**Order Details**:
- **Order ID**: Etsy receipt ID
- **Buyer**: Customer email
- **Status**: Current fulfillment status
- **Items**: Number of items in order
- **Total**: Order total amount
- **Date**: Order creation date

**Fulfillment Status**:
- **Pending** ⏳: Payment processing
- **Processing** 📦: Being prepared
- **Shipped** 🚚: In transit
- **Delivered** ✅: Completed
- **Cancelled** ❌: Cancelled/refunded

### Tracking Information

**Shipment Tracking**:
- Carrier name (USPS, FedEx, UPS, etc.)
- Tracking number
- Click to view on carrier site
- Updates from Etsy

### Order Actions

**View on Etsy**:
- Click external link icon
- Opens order in Etsy dashboard
- View full order details
- Process refunds/cancellations

### Printful Integration

(Coming Soon)
- Auto-create Printful orders
- Sync tracking from Printful
- Update Etsy automatically

---

## Schedules

Automate listing publication with intelligent scheduling.

### Creating a Schedule

**Basic Settings**:
```
Name: Daily Morning Listings
Shop: [Select Connected Shop]
Frequency: Daily
Daily Quota: 10 listings
```

**Time Slots**:
- Add multiple times per day
- Distributes listings throughout day
- Example: 09:00, 12:00, 15:00

**Frequency Options**:
- **Hourly**: Runs every hour
- **Daily**: Runs once per day at specified times

### How Schedules Work

1. **Schedule Checks** (every 5 minutes):
   - Is schedule active?
   - Is it time to run?
   - Is daily quota remaining?

2. **Product Selection**:
   - Finds products with status `ready`
   - Has approved AI generation
   - Not already in queue

3. **Job Creation**:
   - Creates listing jobs
   - Up to daily quota limit
   - Triggers background workers

4. **Next Run Calculation**:
   - Calculates next time slot
   - Updates schedule
   - Continues until quota filled

### Managing Schedules

**Pause Schedule**:
1. Find active schedule
2. Click pause button (⏸️)
3. Schedule stops running
4. Can resume anytime

**Resume Schedule**:
1. Find paused schedule
2. Click play button (▶️)
3. Schedule resumes
4. Runs at next time slot

**Edit Schedule** (coming soon):
- Change daily quota
- Modify time slots
- Update frequency

**Delete Schedule**:
1. Click delete button (🗑️)
2. Confirm deletion
3. Schedule permanently removed
4. Running jobs continue

### Schedule Statistics

**Per Schedule**:
- Total runs
- Total listings created
- Success rate
- Last run time
- Next run time

**Global**:
- Active schedules count
- Total daily quota
- Listings published today

### Best Practices

**Quota Management**:
- Start with 5-10 per day
- Increase gradually
- Monitor Etsy response
- Avoid appearing spammy

**Time Distribution**:
- Space out time slots
- Avoid batch publishing
- Match peak traffic times
- Consider time zones

**Multiple Schedules**:
- Different shops
- Different product categories
- Different time zones
- A/B testing

---

## Usage & Costs

Track AI generation costs and API usage.

### Cost Dashboard

**Summary Cards**:
- **Today**: Costs for current day
- **This Month**: Month-to-date costs
- **Last Month**: Previous month total
- **All Time**: Lifetime costs

### Cost Breakdown

**By Provider**:
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude 3)
- Each shows total cost
- Percentage of total

**By Resource Type**:
- AI Text Generation
- Image Processing (coming soon)
- API Calls
- Each with quantity and cost

### Cost History

**Detailed Table**:
- Date/Time
- Resource type
- Provider
- Operation
- Quantity (tokens, requests)
- Unit cost
- Total cost

**Pagination**:
- 50 records per page
- Date range filtering
- Export to CSV (coming soon)

### Daily Cost Chart

**Visual Chart**:
- Bar graph of daily costs
- Last 30 days
- Hover for exact amounts
- Identify spending trends

### Budget Alerts

(Coming Soon)
- Set monthly budget
- Email alerts at thresholds
- 50%, 75%, 90%, 100%
- Spending recommendations

### Cost Optimization Tips

**Reduce Costs**:
1. Use GPT-3.5 instead of GPT-4
2. Batch process products
3. Cache generated content
4. Reuse approved templates
5. Optimize prompts

**Monitor Usage**:
- Check daily
- Set budgets
- Track ROI
- Compare providers

---

## Settings

Configure your account, connections, and preferences.

### Connections Tab

**Etsy Shop**:
- **Status**: Connected/Not Connected
- **Shop Name**: Display name
- **Shop ID**: Etsy shop ID
- **Connected Date**: When connected
- **Actions**: Disconnect, Reconnect

**Connect New Shop**:
1. Click **"Connect Etsy Shop"**
2. Redirected to Etsy
3. Grant permissions
4. Redirected back
5. Shop connected ✅

**Disconnect Shop**:
1. Click disconnect button
2. Confirm action
3. Shop marked as revoked
4. Can reconnect anytime

### Organization Tab

**Company Information**:
- Organization name
- Your role (Owner, Admin, Creator, Viewer)
- Member count
- Created date

**Billing Tier**:
- Current plan (Starter, Pro, Enterprise)
- Monthly quota
- Features enabled
- Upgrade/downgrade

### Team Tab

(Coming Soon)

**Team Members**:
- Invite members
- Assign roles
- Manage permissions
- Remove members

**Roles**:
- **Owner**: Full access
- **Admin**: Manage settings
- **Creator**: Create listings
- **Viewer**: Read-only

### Notifications Tab

(Coming Soon)

**Email Notifications**:
- Job completed
- Job failed
- Schedule ran
- Daily summary
- Weekly report

**Notification Preferences**:
- Email frequency
- Digest mode
- Critical only
- All events

### API Keys Tab

(Coming Soon)

**Platform API Key**:
- Generate API keys
- Use with external tools
- Webhooks
- Integrations

### Advanced Settings

**Rate Limiting**:
- Etsy API rate limit display
- Current usage
- Remaining quota
- Reset time

**Data Export**:
- Export all products
- Export all listings
- Export cost data
- Download as CSV/JSON

**Delete Account**:
- Permanently delete
- Cannot be undone
- Requires password confirmation

---

## Keyboard Shortcuts

(Coming Soon)

**Global**:
- `Ctrl/Cmd + K`: Quick search
- `G D`: Go to Dashboard
- `G P`: Go to Products
- `G L`: Go to Listings
- `?`: Show keyboard shortcuts

**Products**:
- `N`: New product
- `I`: Import products
- `Ctrl/Cmd + A`: Select all
- `Delete`: Delete selected

**AI Generation**:
- `Space`: Generate content
- `Enter`: Approve content
- `R`: Regenerate

---

## Mobile Access

(Coming Soon)

Currently optimized for desktop. Mobile app in development.

**Current Mobile Support**:
- ✅ Responsive design
- ✅ View dashboard
- ✅ View products
- ⏳ Limited editing
- ⏳ No image upload

---

## API Documentation

**Interactive API Docs**:
Visit: `http://localhost:8080/docs`

**Authentication**:
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

**Import Products**:
```bash
curl -X POST http://localhost:8080/api/products/import/batch \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"products":[...]}'
```

See full API reference at `/docs` endpoint.

---

## Support & Resources

- **Documentation**: `/docs` folder
- **API Docs**: `http://localhost:8080/docs`
- **GitHub Issues**: Report bugs
- **Email Support**: support@example.com

---

**Last Updated**: 2025
**Version**: 1.0.0 (Beta)
