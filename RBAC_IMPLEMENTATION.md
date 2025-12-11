# RBAC + Tenancy Enforcement Implementation

**Status**: 🚧 **IN PROGRESS**

---

## ✅ **Completed Components**

### 1. **RBAC Core System** (`app/core/rbac.py`)
- ✅ Role definitions: Owner, Admin, Creator, Viewer
- ✅ Permission enum with 20+ granular permissions
- ✅ Permission matrix (ROLE_PERMISSIONS)
- ✅ Helper functions: `has_permission()`, `has_any_permission()`, `has_all_permissions()`
- ✅ Shop access control: `can_access_shop()`, `get_accessible_shop_ids()`

### 2. **RBAC Dependencies** (`app/api/dependencies/rbac.py`)
- ✅ `UserContext` model (user_id, tenant_id, role, allowed_shop_ids)
- ✅ `get_user_context()` - Resolves complete user context from JWT
- ✅ `require_permission()` - Permission-based authorization
- ✅ `require_any_permission()` - Multiple permission options
- ✅ `require_role()` - Backward-compatible role checking
- ✅ `require_shop_access()` - Shop-level access validation
- ✅ Automatic population of `request.state` for middleware

### 3. **Middleware** (`app/middleware/tenant_context.py`)
- ✅ `TenantContextMiddleware` - Attaches tenant context to request state
- ✅ Integrated into `main.py`

### 4. **Query Helpers** (`app/core/query_helpers.py`)
- ✅ `filter_by_tenant()` - Automatic tenant filtering
- ✅ `filter_by_shops()` - Shop-based filtering with role logic
- ✅ `filter_by_tenant_and_shops()` - Combined filtering
- ✅ `ensure_tenant_access()` - Defensive tenant validation
- ✅ `ensure_shop_access()` - Defensive shop validation

### 5. **Updated Endpoints** (Examples)
- ✅ Products endpoints (partial):
  - `POST /api/products/import` - CREATE_PRODUCT permission
  - `GET /api/products/` - READ_PRODUCT permission
  - `GET /api/products/{id}` - READ_PRODUCT permission
- ✅ Shops endpoints (partial):
  - `GET /api/shops/etsy/connect` - CONNECT_SHOP permission
  - `GET /api/shops/` - Tenant + shop filtering

---

## 🚧 **Remaining Work**

### 1. **Update All API Endpoints**
Need to update remaining endpoints to use RBAC:

**Products** (`apps/api/app/api/endpoints/products.py`):
- [ ] `POST /api/products/import/batch`
- [ ] `POST /api/products/import/csv`
- [ ] `PATCH /api/products/{id}`
- [ ] `DELETE /api/products/{id}`

**Shops** (`apps/api/app/api/endpoints/shops.py`):
- [ ] `POST /api/shops/etsy/callback`
- [ ] `GET /api/shops/{shop_id}`
- [ ] `DELETE /api/shops/{shop_id}`
- [ ] `POST /api/shops/{shop_id}/refresh-token`

**Listings** (`apps/api/app/api/endpoints/listings.py`):
- [ ] All endpoints

**Orders** (`apps/api/app/api/endpoints/orders.py`):
- [ ] All endpoints

**Schedules** (`apps/api/app/api/endpoints/schedules.py`):
- [ ] All endpoints

**Team** (`apps/api/app/api/endpoints/team.py`):
- [ ] Already has `require_role`, needs to migrate to `require_permission`

**AI** (`apps/api/app/api/endpoints/ai.py`):
- [ ] All endpoints

**Dashboard** (`apps/api/app/api/endpoints/dashboard.py`):
- [ ] All endpoints

**Audit** (`apps/api/app/api/endpoints/audit.py`):
- [ ] All endpoints

### 2. **JWT Token Enhancement**
- [x] `shop_ids` already passed to `create_access_token` via kwargs
- [ ] Verify `shop_ids` is stored in JWT payload
- [ ] Update login/register to include shop_ids in token

### 3. **Membership Model Enhancement**
- [ ] Add `allowed_shop_ids` column to `memberships` table (migration)
- [ ] Update membership creation/update logic
- [ ] Populate `allowed_shop_ids` from membership in `get_user_context()`

### 4. **Comprehensive Tests** (`apps/api/tests/test_rbac.py`)
- [ ] Test permission matrix (all roles + permissions)
- [ ] Test `get_user_context()` dependency
- [ ] Test `require_permission()` - positive cases
- [ ] Test `require_permission()` - negative cases (403)
- [ ] Test `require_shop_access()` - Owner/Admin (all shops)
- [ ] Test `require_shop_access()` - Creator/Viewer (restricted)
- [ ] Test cross-tenant access attempts (should fail)
- [ ] Test cross-shop access attempts (should fail)
- [ ] Test query filtering by tenant
- [ ] Test query filtering by shops
- [ ] Contract tests per role:
  - [ ] Viewer: Read-only access, no writes
  - [ ] Creator: Create/update own items, read all
  - [ ] Admin: All except billing/delete tenant
  - [ ] Owner: Full access including billing/delete

### 5. **Endpoint Audit**
- [ ] Verify NO endpoint bypasses RBAC checks
- [ ] Ensure all data access is filtered by tenant_id
- [ ] Ensure shop-scoped resources filter by shop_id
- [ ] Add logging for authorization failures

---

## 📋 **Permission Matrix**

| Permission | Owner | Admin | Creator | Viewer |
|-----------|-------|-------|---------|--------|
| MANAGE_BILLING | ✅ | ❌ | ❌ | ❌ |
| DELETE_TENANT | ✅ | ❌ | ❌ | ❌ |
| MANAGE_TEAM | ✅ | ✅ | ❌ | ❌ |
| UPDATE_TENANT_SETTINGS | ✅ | ✅ | ❌ | ❌ |
| CONNECT_SHOP | ✅ | ✅ | ❌ | ❌ |
| DISCONNECT_SHOP | ✅ | ✅ | ❌ | ❌ |
| CREATE_PRODUCT | ✅ | ✅ | ✅ | ❌ |
| READ_PRODUCT | ✅ | ✅ | ✅ | ✅ |
| UPDATE_PRODUCT | ✅ | ✅ | ✅* | ❌ |
| DELETE_PRODUCT | ✅ | ✅ | ❌ | ❌ |
| CREATE_LISTING | ✅ | ✅ | ✅ | ❌ |
| READ_LISTING | ✅ | ✅ | ✅ | ✅ |
| UPDATE_LISTING | ✅ | ✅ | ✅* | ❌ |
| PUBLISH_LISTING | ✅ | ✅ | ✅* | ❌ |
| READ_ORDER | ✅ | ✅ | ✅ | ✅ |
| SYNC_ORDER | ✅ | ✅ | ❌ | ❌ |
| CREATE_SCHEDULE | ✅ | ✅ | ✅ | ❌ |
| READ_SCHEDULE | ✅ | ✅ | ✅ | ✅ |
| UPDATE_SCHEDULE | ✅ | ✅ | ✅* | ❌ |
| GENERATE_CONTENT | ✅ | ✅ | ✅ | ❌ |
| READ_AUDIT_LOG | ✅ | ✅ | ❌ | ✅ |

\* Creator can only update/delete own items (enforced at application level)

---

## 🔒 **Security Guarantees**

### ✅ **Implemented**
1. **Tenant Isolation**: All queries automatically filter by `tenant_id`
2. **Role-Based Access**: Permissions checked at endpoint level
3. **Shop-Level Access**: Owner/Admin see all shops, Creator/Viewer are restricted
4. **Defensive Checks**: `ensure_tenant_access()` and `ensure_shop_access()` for defense in depth

### 🚧 **In Progress**
1. **Complete Endpoint Coverage**: ~30% updated, ~70% remaining
2. **Comprehensive Testing**: Test suite needs to be created
3. **Membership Enhancement**: `allowed_shop_ids` storage in database

---

## 🎯 **Usage Examples**

### **Permission-Based Endpoint**
```python
@router.post("/products")
async def create_product(
    request: ProductRequest,
    context: UserContext = Depends(require_permission(Permission.CREATE_PRODUCT)),
    db: Session = Depends(get_db)
):
    product = Product(tenant_id=context.tenant_id, ...)
    db.add(product)
    db.commit()
```

### **Shop-Aware Endpoint**
```python
@router.get("/shops/{shop_id}/listings")
async def get_listings(
    shop_id: int,
    context: UserContext = Depends(require_shop_access("shop_id")),
    db: Session = Depends(get_db)
):
    # shop_id is already validated to be accessible
    listings = db.query(Listing).filter(Listing.shop_id == shop_id).all()
```

### **Query Filtering**
```python
# Automatic tenant filtering
query = filter_by_tenant(
    db.query(Product),
    context.tenant_id,
    Product.tenant_id
)

# Tenant + shop filtering
query = filter_by_tenant_and_shops(
    db.query(ListingJob),
    ListingJob.tenant_id,
    ListingJob.shop_id,
    context,
    db
)
```

---

## 📝 **Next Steps**

1. **Complete Endpoint Updates** (Priority: High)
   - Update all remaining endpoints systematically
   - Ensure no bypasses exist

2. **Create Test Suite** (Priority: High)
   - Contract tests for each role
   - Negative test cases (cross-tenant, cross-shop)
   - Integration tests

3. **Database Migration** (Priority: Medium)
   - Add `allowed_shop_ids` to `memberships` table
   - Populate from membership in `get_user_context()`

4. **Documentation** (Priority: Medium)
   - Update API documentation with required permissions
   - Add RBAC guide for developers

5. **Monitoring & Logging** (Priority: Low)
   - Log authorization failures
   - Add metrics for permission checks

---

**Last Updated**: December 9, 2025  
**Implementation Status**: 30% Complete

