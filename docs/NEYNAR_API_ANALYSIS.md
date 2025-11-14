# Neynar API Call Analysis & Optimization

## Current Neynar API Calls

### 1. **userService.js - getUserDetailsByFid()**
**Location**: `src/services/userService.js:55`
- **API Call**: `neynarClient.fetchBulkUsers()`
- **When**: Only when user doesn't exist in database
- **Frequency**: Once per new user
- **Status**: ✅ OPTIMIZED - Only called when necessary

### 2. **userService.js - reVerifyNftOwnership()**
**Location**: `src/services/userService.js:131`
- **API Call**: `neynarClient.fetchBulkUsers()`
- **When**: Every time endpoint is called (manual re-verification)
- **Frequency**: On-demand (user-initiated)
- **Status**: ✅ ACCEPTABLE - This is intentional for fresh data

### 3. **personaService.js - fetchUserProfile()**
**Location**: `src/services/personaService.js:113`
- **API Call**: `neynarClient.fetchBulkUsers()` (ONLY when needed)
- **When**: Only called if user data is not available from DB or already fetched
- **Frequency**: Rarely called (only as fallback)
- **Status**: ✅ **OPTIMIZED** - Now uses DB data or reuses fetched data

### 4. **personaService.js - fetchAllUserCasts()**
**Location**: `src/services/personaService.js:37`
- **API Call**: `neynarClient.searchCasts()` (MULTIPLE CALLS)
- **When**: Every time persona is created/updated
- **Frequency**: **10-100+ calls per persona** (paginated, 100 casts per call)
- **Status**: ⚠️ **HIGH VOLUME** - This is the biggest API usage

### 5. **personaService.js - createOrUpdatePersona()**
**Location**: `src/services/personaService.js:219`
- **API Call**: `neynarClient.fetchBulkUsers()` (ONLY if user doesn't exist in DB)
- **When**: Only when creating persona for user not in DB
- **Frequency**: Once per new user persona
- **Status**: ✅ **OPTIMIZED** - Reuses fetched data, uses DB data when available

## Issues Identified

### 🔴 **CRITICAL ISSUES**

#### 1. **Duplicate User Profile Fetches in personaService** ✅ **FIXED**
**Problem**: 
- ~~`createOrUpdatePersona()` fetches user data to save to DB (line 208)~~
- ~~Then immediately calls `fetchUserProfile()` which fetches the same user again (line 240)~~
- ~~**Result**: 2 API calls for the same user data~~

**Solution Implemented**:
- Added `extractUserProfile()` helper function to extract profile from any user data source
- When user is fetched from Neynar, profile is extracted from the same data (no second fetch)
- When user exists in DB, profile is extracted from DB data (no API call at all)

**Impact**: ✅ Eliminated duplicate API calls - 50% reduction achieved

#### 2. **High Volume Cast Fetching**
**Problem**:
- `fetchAllUserCasts()` makes paginated calls (100 casts per call)
- For a user with 1000 casts = 10 API calls
- For a user with 5000 casts = 50 API calls
- **No caching mechanism**

**Impact**: 10-100+ API calls per persona creation/update

### 🟡 **MODERATE ISSUES**

#### 3. **No Caching for User Profiles** ✅ **FIXED**
**Problem**: 
- ~~User profiles are fetched from Neynar even if we just saved them to DB~~
- ~~Could use DB data instead of re-fetching~~

**Solution Implemented**:
- `createOrUpdatePersona()` now checks DB first
- If user exists in DB, extracts profile from DB data (no API call)
- Only fetches from Neynar if user doesn't exist in DB
- Reuses fetched data when creating new user (no duplicate fetch)

**Impact**: ✅ Eliminated unnecessary API calls when user exists in DB - 100% reduction for existing users

#### 4. **No Caching for Casts**
**Problem**:
- Casts are fetched fresh every time persona is updated
- No mechanism to check if casts have changed

**Impact**: Re-fetching all casts on every persona update

## Optimization Recommendations

### Priority 1: Fix Duplicate User Fetches

**Solution**: Reuse user data in `createOrUpdatePersona()`

```javascript
// Instead of fetching twice:
// 1. Fetch to save to DB
// 2. Fetch again for profile

// Do this:
// 1. Fetch once
// 2. Save to DB
// 3. Use same data for profile
```

**Expected Savings**: 50% reduction in user profile API calls

### Priority 2: Cache Casts in Database

**Solution**: Store casts in database with timestamp

**Benefits**:
- Only fetch new casts since last update
- Reduce API calls by 80-90% for updates
- Still fetch fresh on first creation

**Expected Savings**: 80-90% reduction in cast API calls for updates

### Priority 3: Use DB Data When Available

**Solution**: Use user data from DB instead of re-fetching

**Benefits**:
- Eliminate redundant fetches
- Faster response times
- Reduce API usage

**Expected Savings**: 30-40% reduction in user profile API calls

### Priority 4: Add Cast Fetching Strategy

**Solution**: 
- First creation: Fetch all casts
- Updates: Only fetch casts since last analysis
- Add option to force full refresh

**Expected Savings**: 70-80% reduction in cast API calls for updates

## Current API Call Estimates (After Optimization)

### Per New User (First Time)
- `getUserDetailsByFid()`: 1 call (fetchBulkUsers)
- `createOrUpdatePersona()` (background): 
  - 1 call (fetchBulkUsers - if not in DB) ✅ Only if needed
  - ~~1 call (fetchBulkUsers - fetchUserProfile)~~ ✅ ELIMINATED - Reuses fetched data
  - 10-100 calls (searchCasts - paginated)
- **Total**: 12-102 calls per new user (same, but no duplicate user fetches)

### Per Persona Update (Existing User)
- `createOrUpdatePersona()`:
  - ~~1 call (fetchBulkUsers - fetchUserProfile)~~ ✅ ELIMINATED - Uses DB data
  - 10-100 calls (searchCasts - paginated)
- **Total**: 10-100 calls per update (reduced from 11-101)

### Savings Summary
- ✅ **New users**: Eliminated 1 redundant user fetch (50% reduction in user profile calls)
- ✅ **Existing users**: Eliminated 1 user fetch per update (100% reduction in user profile calls for updates)
- ✅ **Overall**: Significant reduction in unnecessary API calls

## Recommended Implementation Plan

1. **Phase 1** (Quick Win): ✅ **COMPLETED** - Fixed duplicate user fetches in personaService
   - Eliminated duplicate `fetchUserProfile()` calls
   - Reuse fetched user data
   - Use DB data when available
2. **Phase 2** (High Impact): Implement cast caching in database (Future)
3. **Phase 3** (Optimization): ✅ **COMPLETED** - Use DB data instead of re-fetching
4. **Phase 4** (Advanced): Incremental cast fetching (Future)

## Files to Modify

1. `src/services/personaService.js` - Fix duplicate fetches, add caching
2. `database/` - Add casts table for caching
3. `src/services/dbService.js` - Add cast caching methods

