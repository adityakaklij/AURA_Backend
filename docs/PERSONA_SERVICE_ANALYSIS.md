# Persona Service Analysis & Optimization

## Current Flow Overview

The persona service creates/updates user personas by:
1. Checking if user exists in DB
2. Fetching user profile (if needed)
3. Fetching user casts from Neynar
4. Analyzing casts with Gemini AI
5. Storing persona in database

## API Call Breakdown

### Per Persona Creation/Update

#### Scenario 1: New User (Not in DB)
```
1. fetchBulkUsers (Neynar)          → 1 call
2. checkNftOwned (Alchemy)          → 1-3 calls (checks multiple addresses)
3. searchCasts (Neynar)             → 1-∞ calls (depends on user's cast count)
   - maxCasts = 100
   - limit = 100 per request
   - If user has ≤100 casts: 1 call
   - If user has >100 casts: Multiple calls (currently limited to 100, but loop continues)
4. generateContent (Gemini)         → 1 call

Total: 4-6+ API calls minimum
```

#### Scenario 2: Existing User (In DB)
```
1. searchCasts (Neynar)             → 1-∞ calls
2. generateContent (Gemini)         → 1 call

Total: 2+ API calls minimum
```

### Critical Issue: Cast Fetching

**Current Implementation** (`fetchAllUserCasts`):
```javascript
async function fetchAllUserCasts(fid, maxCasts = 100) {
  // Loop continues until maxCasts reached OR no more casts
  while (allCasts.length < maxCasts) {
    const response = await neynarClient.searchCasts({...});
    // 500ms delay between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
```

**Problems**:
1. **Always fetches fresh casts** - No caching, even if persona was created recently
2. **Multiple API calls** - For users with many casts, makes multiple sequential calls
3. **500ms delay may not be enough** - Neynar rate limits might be stricter
4. **No incremental fetching** - Always fetches from beginning, even if only new casts needed
5. **No rate limit handling** - No retry logic or exponential backoff

## Rate Limiting Issues

### Neynar API Rate Limits
- **searchCasts**: Likely has strict rate limits (exact limits not documented)
- **fetchBulkUsers**: Also has rate limits
- **Current delay**: 500ms between requests may not be sufficient

### Why You're Hitting Rate Limits

1. **Multiple sequential calls**: Each persona creation makes 1+ `searchCasts` calls
2. **No caching**: Every persona update refetches all casts
3. **Background jobs**: `getUserDetailsByFid` triggers persona creation in background
4. **No rate limit handling**: No retry logic or exponential backoff
5. **Concurrent requests**: Multiple users onboarding simultaneously

## Optimization Strategies

### 1. **Cache Casts in Database** ⭐ HIGHEST IMPACT

**Current**: Casts are fetched fresh every time
**Solution**: Store casts in database and only fetch new ones

**Implementation**:
- Create `user_casts` table to store casts
- Store: `fid`, `cast_hash`, `cast_data`, `timestamp`, `created_at`
- On persona update:
  - Check last cast timestamp in DB
  - Only fetch casts newer than last stored cast
  - Merge with existing casts for analysis

**Expected Savings**: 70-90% reduction in cast API calls

### 2. **Reduce maxCasts Limit** ⭐ QUICK WIN

**Current**: `maxCasts = 100`
**Solution**: Reduce to 50-75 casts

**Rationale**:
- Gemini only analyzes 100 sampled casts anyway
- Most users don't need 100 casts for accurate persona
- Reduces API calls by 50%

**Implementation**:
```javascript
async function fetchAllUserCasts(fid, maxCasts = 50) { // Reduced from 100
```

### 3. **Add Rate Limit Handling** ⭐ CRITICAL

**Current**: No retry logic, fixed 500ms delay
**Solution**: Implement exponential backoff with retry

**Implementation**:
```javascript
async function fetchAllUserCasts(fid, maxCasts = 50) {
  const maxRetries = 3;
  let retryDelay = 1000; // Start with 1 second
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await neynarClient.searchCasts({...});
      // Success - reset retry delay
      retryDelay = 1000;
      break;
    } catch (error) {
      if (error.status === 429) { // Rate limited
        console.log(`Rate limited, waiting ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}
```

### 4. **Skip Recent Updates** ⭐ QUICK WIN

**Current**: Always updates persona, even if recently updated
**Solution**: Check `analyzed_at` timestamp, skip if updated recently

**Implementation**:
```javascript
const createOrUpdatePersona = async (fid, forceRefresh = false) => {
  // Check if persona exists and was recently updated
  const existingPersona = await dbService.getPersonaByFid(fid);
  const RECENT_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
  
  if (existingPersona && !forceRefresh) {
    const lastAnalyzed = new Date(existingPersona.analyzed_at);
    const hoursSinceUpdate = (Date.now() - lastAnalyzed.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceUpdate < 24) {
      console.log(`⏭️  Skipping persona update - updated ${hoursSinceUpdate.toFixed(1)} hours ago`);
      return existingPersona;
    }
  }
  
  // Continue with update...
}
```

**Expected Savings**: 80-90% reduction in unnecessary updates

### 5. **Batch Cast Fetching** ⭐ MEDIUM IMPACT

**Current**: Sequential API calls with 500ms delay
**Solution**: Increase delay or implement smarter batching

**Implementation**:
```javascript
// Increase delay between requests
await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second instead of 500ms

// Or implement adaptive delay based on response time
const responseTime = Date.now() - requestStart;
const adaptiveDelay = Math.max(1000, responseTime * 1.5);
await new Promise((resolve) => setTimeout(resolve, adaptiveDelay));
```

### 6. **Incremental Cast Fetching** ⭐ HIGH IMPACT (Requires DB)

**Current**: Always fetches from beginning
**Solution**: Only fetch casts since last analysis

**Implementation**:
```javascript
async function fetchNewCasts(fid, sinceTimestamp) {
  // Only fetch casts newer than sinceTimestamp
  const response = await neynarClient.searchCasts({
    authorFid: fid,
    limit: 100,
    // Use timestamp filter if Neynar API supports it
  });
  
  // Merge with existing casts from DB
  const existingCasts = await dbService.getCastsByFid(fid);
  return mergeCasts(existingCasts, newCasts);
}
```

### 7. **Queue System for Background Jobs** ⭐ MEDIUM IMPACT

**Current**: Background persona creation runs immediately
**Solution**: Queue persona creation jobs with rate limiting

**Benefits**:
- Prevents concurrent API calls
- Better rate limit management
- Retry failed jobs
- Priority queue for manual refreshes

## Recommended Implementation Priority

### Phase 1: Quick Wins (Implement First)
1. ✅ **Skip Recent Updates** - Check `analyzed_at`, skip if <24 hours
2. ✅ **Reduce maxCasts** - Change from 100 to 50
3. ✅ **Add Rate Limit Handling** - Exponential backoff for 429 errors
4. ✅ **Increase Delay** - Change from 500ms to 1000ms between requests

**Expected Impact**: 50-70% reduction in API calls

### Phase 2: High Impact (Implement Next)
1. ✅ **Cache Casts in Database** - Store casts, only fetch new ones
2. ✅ **Incremental Fetching** - Only fetch casts since last analysis

**Expected Impact**: 80-95% reduction in API calls

### Phase 3: Advanced (Future)
1. ✅ **Queue System** - Background job queue with rate limiting
2. ✅ **Smart Sampling** - Fetch fewer casts, use better sampling strategy

## Current API Call Estimates

### Per New User Onboarding
- `getUserDetailsByFid`: 1 call (fetchBulkUsers)
- Background persona creation: 1-2+ calls (searchCasts)
- **Total**: 2-3+ calls per new user

### Per Persona Update (Manual)
- `create-persona` endpoint: 1-2+ calls (searchCasts)
- **Total**: 1-2+ calls per update

### Per 100 Users Onboarding
- **Current**: 200-300+ Neynar API calls
- **After Phase 1**: 100-150 calls (50% reduction)
- **After Phase 2**: 20-50 calls (80-90% reduction)

## Immediate Actions

1. **Add skip logic for recent updates** (5 minutes)
2. **Reduce maxCasts to 50** (1 minute)
3. **Increase delay to 1000ms** (1 minute)
4. **Add rate limit error handling** (10 minutes)

These quick wins should immediately reduce rate limit issues by 50-70%.

