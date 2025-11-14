# Neynar API Credits Analysis

## Neynar Endpoints We're Using

Based on code analysis, we're using **2 Neynar API endpoints**:

### 1. `fetchBulkUsers` (User Profile Endpoint)
**Location**: Used in multiple places
- `src/services/userService.js` - `getUserDetailsByFid()`
- `src/services/userService.js` - `reVerifyNftOwnership()`
- `src/services/personaService.js` - `createOrUpdatePersona()` (only if user not in DB)

**Purpose**: Fetch user profile data (username, display_name, bio, follower counts, addresses, etc.)

**When Called**:
- New user onboarding (user doesn't exist in DB)
- Manual NFT re-verification
- Persona creation for new users (only if user not in DB)

### 2. `searchCasts` (Cast Search Endpoint)
**Location**: `src/services/personaService.js` - `fetchAllUserCasts()`

**Purpose**: Fetch user's casts (posts) for persona analysis

**When Called**:
- Every persona creation/update (unless skipped due to recent update)
- Fetches latest 100 casts per user

## Credit Consumption Analysis

### Neynar Pricing Reference
According to [Neynar Pricing](https://dev.neynar.com/pricing):

**Credit Costs** (typical structure):
- Different endpoints have different credit costs
- Credits are consumed per API call
- Rate limits vary by plan

**Note**: Exact credit costs per endpoint may vary. Check your Neynar dashboard for precise costs.

### Current API Call Pattern

#### Scenario 1: New User Onboarding
```
1. getUserDetailsByFid() 
   → fetchBulkUsers: 1 call
   
2. Background persona creation
   → fetchBulkUsers: 0 calls (user already in DB)
   → searchCasts: 1 call (latest 100 casts)

Total Neynar calls: 2 calls
```

#### Scenario 2: Existing User - Persona Update
```
1. createOrUpdatePersona()
   → fetchBulkUsers: 0 calls (uses DB data)
   → searchCasts: 1 call (latest 100 casts)

Total Neynar calls: 1 call
```

#### Scenario 3: Recently Updated Persona (<24 hours)
```
1. createOrUpdatePersona()
   → Skipped (returns existing persona)
   
Total Neynar calls: 0 calls ✅
```

### Credit Consumption Breakdown

#### Per New User
- `fetchBulkUsers`: **1 call** × credits per call
- `searchCasts`: **1 call** × credits per call
- **Total**: **2 Neynar API calls**

#### Per Persona Update (Existing User)
- `searchCasts`: **1 call** × credits per call
- **Total**: **1 Neynar API call**

#### Per Persona Update (Recently Updated)
- **Total**: **0 Neynar API calls** (skipped)

### Cast Fetching Credit Consumption

**Current Implementation**:
- `fetchAllUserCasts()` fetches **latest 100 casts**
- Uses `searchCasts` endpoint with `limit: 100`
- **Exactly 1 API call** per persona creation/update

**Credits per Cast Fetch**:
- **1 call** to `searchCasts` endpoint
- Credit cost depends on Neynar's pricing for `searchCasts`
- Typically, search endpoints may cost more than simple fetch endpoints

**Monthly Estimate** (Example):
- 100 new users/month: 100 × 1 = **100 searchCasts calls**
- 200 persona updates/month: 200 × 1 = **200 searchCasts calls**
- **Total**: ~300 `searchCasts` calls/month

### Total Credit Consumption Estimate

**Assumptions** (check your Neynar dashboard for exact costs):
- `fetchBulkUsers`: ~1-5 credits per call (typical for user data)
- `searchCasts`: ~5-10 credits per call (search endpoints typically cost more)

**Monthly Estimate** (100 new users, 200 updates):
```
fetchBulkUsers: 100 calls × 3 credits = 300 credits
searchCasts: 300 calls × 7 credits = 2,100 credits
─────────────────────────────────────────────
Total: ~2,400 credits/month
```

**With 24-hour skip optimization**:
- If 50% of updates are skipped (recently updated):
- `searchCasts`: 150 calls × 7 credits = 1,050 credits
- **Total**: ~1,350 credits/month (44% reduction)

## Optimization Impact

### Before Optimizations
- Multiple `searchCasts` calls per persona (10-100+ calls)
- Duplicate `fetchBulkUsers` calls
- No skip logic for recent updates

**Estimated**: 10,000-50,000+ credits/month for 100 users

### After Optimizations
- **1 `searchCasts` call** per persona (maxCasts = 100, limit = 100)
- **0-1 `fetchBulkUsers` calls** (reuses DB data)
- **Skip logic** for recent updates (<24 hours)

**Estimated**: 1,350-2,400 credits/month for 100 users

**Savings**: ~95% reduction in credit consumption! 🎉

## Recommendations

### 1. Monitor Credit Usage
- Check your Neynar dashboard regularly
- Track credits consumed per endpoint
- Set up alerts for high usage

### 2. Further Optimization (If Needed)
- **Cache casts in database**: Store casts, only fetch new ones
- **Increase skip threshold**: Skip updates if <48 hours old
- **Batch operations**: Queue persona updates to avoid spikes

### 3. Rate Limit Management
- Current: 500 requests/minute (Starter plan)
- With 1 call per persona: Can handle 500 persona updates/minute
- Current implementation is well within limits

## Key Takeaways

✅ **We're using 2 endpoints**: `fetchBulkUsers` and `searchCasts`

✅ **Cast fetching**: Exactly **1 API call** per persona (latest 100 casts)

✅ **Credit consumption**: 
- New user: ~2 calls
- Persona update: ~1 call
- Recent update: 0 calls (skipped)

✅ **Optimization impact**: ~95% reduction in API calls and credits

## Next Steps

1. **Check your Neynar dashboard** for exact credit costs per endpoint
2. **Monitor usage** over a week to get accurate monthly estimates
3. **Adjust skip threshold** if needed (currently 24 hours)
4. **Consider caching** if credit costs are still high

---

**Reference**: [Neynar Pricing](https://dev.neynar.com/pricing)

