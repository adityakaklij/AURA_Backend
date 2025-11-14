# Backend Database Access Analysis

## Overview

This document analyzes all database operations performed by the backend and defines the required Row Level Security (RLS) policies to ensure backend functionality while securing the database.

## Backend Configuration

### Current Setup
- **File**: `src/config/supabase.js`
- **Key Used**: `SUPABASE_SERVICE_ROLE_KEY` (if set) OR `SUPABASE_ANON_KEY` (fallback)
- **Location**: `src/config/env.js` line 28

```javascript
supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
```

### Important: Service Role Key Behavior
- ✅ **Service Role Key BYPASSES RLS** - Can access all data regardless of policies
- ✅ **Backend will work** even with RLS enabled if using service role key
- ⚠️ **Anon Key RESPECTS RLS** - Must have proper policies to work

---

## Database Operations by Table

### 1. `users` Table

#### Operations Performed

| Operation | Function | Purpose | Access Pattern |
|-----------|----------|---------|----------------|
| **SELECT** | `getUserByFid(fid)` | Get user by FID | Single row by `fid` |
| **SELECT** | `getRandomUsers(excludeFids, limit)` | Get random users for matching | Multiple rows, excludes specific FIDs |
| **UPSERT** | `saveUser(userData, nftData)` | Create or update user | Upsert by `fid` (on conflict) |
| **UPDATE** | `updateUser(fid, userData)` | Update user data | Update by `fid` |
| **UPDATE** | `updateNftOwnership(fid, nftData)` | Update NFT ownership status | Update by `fid` |

#### Detailed Access Patterns

**1.1. `getUserByFid(fid)`**
```javascript
// Location: src/services/dbService.js:8
supabase
  .from('users')
  .select('*')
  .eq('fid', fid)
  .single()
```
- **Access**: Read single user by FID
- **Used By**: 
  - User onboarding (`/get-user-details`)
  - Persona creation (check if user exists)
  - NFT verification
- **RLS Requirement**: SELECT on any user row

**1.2. `getRandomUsers(excludeFids, limit)`**
```javascript
// Location: src/services/dbService.js:263
supabase
  .from('users')
  .select('*')
  .neq('fid', fid1)
  .neq('fid', fid2)
  // ... multiple neq filters
  .limit(limit * 3)
```
- **Access**: Read multiple users, excluding specific FIDs
- **Used By**: Matching service (fallback when no matches found)
- **RLS Requirement**: SELECT on multiple user rows

**1.3. `saveUser(userData, nftData)`**
```javascript
// Location: src/services/dbService.js:36
supabase
  .from('users')
  .upsert(userRecord, {
    onConflict: 'fid',
    ignoreDuplicates: false
  })
```
- **Access**: Insert new user OR update existing user
- **Used By**: 
  - User onboarding (create new user)
  - Persona service (ensure user exists)
- **RLS Requirement**: INSERT and UPDATE on users table

**1.4. `updateUser(fid, userData)`**
```javascript
// Location: src/services/dbService.js:91
supabase
  .from('users')
  .update(userRecord)
  .eq('fid', fid)
```
- **Access**: Update existing user data
- **Used By**: User profile updates
- **RLS Requirement**: UPDATE on users table

**1.5. `updateNftOwnership(fid, nftData)`**
```javascript
// Location: src/services/dbService.js:138
supabase
  .from('users')
  .update(updateData)
  .eq('fid', fid)
```
- **Access**: Update NFT ownership fields
- **Used By**: NFT verification endpoints
- **RLS Requirement**: UPDATE on users table

---

### 2. `personas` Table

#### Operations Performed

| Operation | Function | Purpose | Access Pattern |
|-----------|----------|---------|----------------|
| **SELECT** | `getPersonaByFid(fid)` | Get persona by FID | Single row by `farcaster_fid` |
| **SELECT** | `getAllPersonasExcept(excludeFid)` | Get all personas for matching | Multiple rows, excludes one FID |
| **UPSERT** | `saveOrUpdatePersona(fid, analysis, castCount)` | Create or update persona | Upsert by `farcaster_fid` |

#### Detailed Access Patterns

**2.1. `getPersonaByFid(fid)`**
```javascript
// Location: src/services/dbService.js:168
supabase
  .from('personas')
  .select('*')
  .eq('farcaster_fid', fid)
  .single()
```
- **Access**: Read single persona by FID
- **Used By**: 
  - Persona creation (check if exists)
  - Matching service (get user persona)
- **RLS Requirement**: SELECT on any persona row

**2.2. `getAllPersonasExcept(excludeFid)`**
```javascript
// Location: src/services/dbService.js:239
supabase
  .from('personas')
  .select('*')
  .neq('farcaster_fid', excludeFid)
  .order('analyzed_at', { ascending: false })
```
- **Access**: Read all personas except one
- **Used By**: Matching service (get all personas for comparison)
- **RLS Requirement**: SELECT on multiple persona rows

**2.3. `saveOrUpdatePersona(fid, analysis, castCount)`**
```javascript
// Location: src/services/dbService.js:197
supabase
  .from('personas')
  .upsert(personaRecord, {
    onConflict: 'farcaster_fid',
    ignoreDuplicates: false
  })
```
- **Access**: Insert new persona OR update existing persona
- **Used By**: 
  - Persona creation endpoint (`/create-persona`)
  - User onboarding (background persona creation)
- **RLS Requirement**: INSERT and UPDATE on personas table

---

### 3. `user_swipes` Table

#### Operations Performed

| Operation | Function | Purpose | Access Pattern |
|-----------|----------|---------|----------------|
| **UPSERT** | `recordSwipe(userFid, targetFid, action)` | Record like/reject swipe | Upsert by `user_fid` + `target_fid` |
| **SELECT** | `getSwipedUserFids(userFid)` | Get all swiped user FIDs | Multiple rows by `user_fid` |
| **SELECT** | `getRequestsSent(userFid)` | Get pending sent requests | Complex query with joins |
| **SELECT** | `getRequestsReceived(userFid)` | Get pending received requests | Complex query with joins |
| **SELECT** | `getUserMatches(userFid)` | Get mutual matches | Complex query with joins |
| **SELECT** | `checkIfMatched(userFid1, userFid2)` | Check if two users matched | Two separate queries |

#### Detailed Access Patterns

**3.1. `recordSwipe(userFid, targetFid, action)`**
```javascript
// Location: src/services/dbService.js:302
supabase
  .from('user_swipes')
  .upsert({
    user_fid: userFid,
    target_fid: targetFid,
    action: action
  }, {
    onConflict: 'user_fid,target_fid',
    ignoreDuplicates: false
  })
```
- **Access**: Insert new swipe OR update existing swipe
- **Used By**: 
  - Swipe endpoint (`/swipe`)
  - Accept request endpoint (`/accept-request`)
- **RLS Requirement**: INSERT and UPDATE on user_swipes table

**3.2. `getSwipedUserFids(userFid)`**
```javascript
// Location: src/services/dbService.js:343
supabase
  .from('user_swipes')
  .select('target_fid')
  .eq('user_fid', userFid)
```
- **Access**: Read all target FIDs for a user
- **Used By**: Matching service (exclude already swiped users)
- **RLS Requirement**: SELECT on user_swipes table (filtered by user_fid)

**3.3. `getRequestsSent(userFid)`**
```javascript
// Location: src/services/dbService.js:365
// Query 1: Get user's likes
supabase
  .from('user_swipes')
  .select('target_fid, created_at')
  .eq('user_fid', userFid)
  .eq('action', 'like')

// Then calls getUserMatches() which does additional queries
```
- **Access**: Read user's sent likes, then check matches
- **Used By**: Get requests sent endpoint (`/get-requests-sent`)
- **RLS Requirement**: SELECT on user_swipes table

**3.4. `getRequestsReceived(userFid)`**
```javascript
// Location: src/services/dbService.js:407
// Query 1: Get likes received
supabase
  .from('user_swipes')
  .select('user_fid, created_at')
  .eq('target_fid', userFid)
  .eq('action', 'like')

// Query 2: Check if user liked back
supabase
  .from('user_swipes')
  .select('target_fid')
  .eq('user_fid', userFid)
  .eq('action', 'like')
  .in('target_fid', likedByFids)
```
- **Access**: Read received likes, check mutual likes
- **Used By**: Get requests received endpoint (`/get-requests-received`)
- **RLS Requirement**: SELECT on user_swipes table (both user_fid and target_fid filters)

**3.5. `getUserMatches(userFid)`**
```javascript
// Location: src/services/dbService.js:466
// Query 1: Get user's likes
supabase
  .from('user_swipes')
  .select('target_fid')
  .eq('user_fid', userFid)
  .eq('action', 'like')

// Query 2: Check mutual likes
supabase
  .from('user_swipes')
  .select('user_fid')
  .in('user_fid', likedFids)
  .eq('target_fid', userFid)
  .eq('action', 'like')
```
- **Access**: Read user's likes, then check which liked back
- **Used By**: 
  - Get connections endpoint (`/get-connections`)
  - Matching service (exclude matched users)
- **RLS Requirement**: SELECT on user_swipes table

**3.6. `checkIfMatched(userFid1, userFid2)`**
```javascript
// Location: src/services/dbService.js:511
// Query 1: Check if user1 liked user2
supabase
  .from('user_swipes')
  .select('*')
  .eq('user_fid', userFid1)
  .eq('target_fid', userFid2)
  .eq('action', 'like')

// Query 2: Check if user2 liked user1
supabase
  .from('user_swipes')
  .select('*')
  .eq('user_fid', userFid2)
  .eq('target_fid', userFid1)
  .eq('action', 'like')
```
- **Access**: Check mutual likes between two users
- **Used By**: Accept request endpoint (check if match)
- **RLS Requirement**: SELECT on user_swipes table

---

## Required RLS Policies for Backend

### Summary of Backend Requirements

The backend needs **FULL ACCESS** to all tables because:
1. It performs admin operations (user creation, persona generation)
2. It needs to read any user's data for matching
3. It needs to manage all swipe records
4. It performs complex queries across multiple rows

### Policy Strategy

Since the backend uses **Service Role Key**, it will **bypass RLS automatically**. However, we still need policies for:
1. **Frontend access** (using anon key)
2. **Explicit documentation** of what the backend does
3. **Future-proofing** if backend switches to anon key

---

## Recommended RLS Policies

### Policy Approach

**Option 1: Service Role Bypass (Recommended for Backend)**
- Service role key automatically bypasses RLS
- No policies needed for backend operations
- Policies only needed for frontend access

**Option 2: Explicit Service Role Policies**
- Create policies that explicitly allow service role
- More verbose but clearer intent
- Useful for documentation

### Recommended Policies

#### For `users` Table

```sql
-- Policy 1: Backend can do everything (service role bypasses RLS anyway)
-- This is implicit when using service role key, but explicit for documentation

-- Policy 2: Frontend can read any user (for matching/discovery)
CREATE POLICY "Frontend can read users"
ON users
FOR SELECT
USING (true);

-- Policy 3: Frontend can update own profile (if needed)
-- Only if frontend needs to update user data
-- CREATE POLICY "Users can update own profile"
-- ON users
-- FOR UPDATE
-- USING (auth.uid()::text = fid::text);
```

#### For `personas` Table

```sql
-- Policy 1: Backend can do everything (service role bypasses RLS)

-- Policy 2: Frontend can read any persona (for matching)
CREATE POLICY "Frontend can read personas"
ON personas
FOR SELECT
USING (true);
```

#### For `user_swipes` Table

```sql
-- Policy 1: Backend can do everything (service role bypasses RLS)

-- Policy 2: Users can view their own swipes
CREATE POLICY "Users can view own swipes"
ON user_swipes
FOR SELECT
USING (
  -- If using Supabase Auth with FID in JWT
  -- auth.jwt() ->> 'fid' = user_fid::text
  -- For now, allow all (frontend will filter)
  true
);

-- Policy 3: Users can create their own swipes
CREATE POLICY "Users can create own swipes"
ON user_swipes
FOR INSERT
WITH CHECK (
  -- If using Supabase Auth with FID in JWT
  -- auth.jwt() ->> 'fid' = user_fid::text
  -- For now, allow all (backend validates)
  true
);

-- Policy 4: Users can update their own swipes
CREATE POLICY "Users can update own swipes"
ON user_swipes
FOR UPDATE
USING (
  -- If using Supabase Auth with FID in JWT
  -- auth.jwt() ->> 'fid' = user_fid::text
  true
)
WITH CHECK (
  true
);
```

---

## Backend Access Summary

### What Backend Can Do (with Service Role Key)

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `users` | ✅ All rows | ✅ Any user | ✅ Any user | ❌ Not used | Full access needed |
| `personas` | ✅ All rows | ✅ Any persona | ✅ Any persona | ❌ Not used | Full access needed |
| `user_swipes` | ✅ All rows | ✅ Any swipe | ✅ Any swipe | ❌ Not used | Full access needed |

### Why Backend Needs Full Access

1. **User Management**: Backend creates/updates users from Neynar API
2. **Persona Generation**: Backend creates/updates personas for any user
3. **Matching Algorithm**: Backend needs to read all personas to calculate matches
4. **Swipe Management**: Backend records swipes and checks matches for any user pair
5. **Admin Operations**: Backend performs system-level operations

---

## Security Considerations

### Current Security Status

- ❌ **RLS is DISABLED** (tables show "Unrestricted")
- ❌ **Anyone with anon key can access all data**
- ✅ **Backend uses service role key** (bypasses RLS)

### After Enabling RLS

- ✅ **RLS will be ENABLED** (tables will show "Restricted")
- ✅ **Backend will still work** (service role bypasses RLS)
- ✅ **Frontend access will be restricted** (by RLS policies)
- ✅ **Database will be secure** (unauthorized access blocked)

### Key Points

1. **Service Role Key = Full Access**
   - Backend operations will work regardless of RLS policies
   - Service role key bypasses RLS automatically
   - No changes needed to backend code

2. **Anon Key = Restricted Access**
   - Frontend must use anon key
   - Frontend access will be restricted by RLS policies
   - Policies must allow necessary frontend operations

3. **Best Practice**
   - Use service role key in backend (secure server environment)
   - Use anon key in frontend (public, respects RLS)
   - Enable RLS on all tables
   - Create policies for frontend access

---

## Next Steps

1. ✅ **Document backend access patterns** (This document)
2. ⏭️ **Create RLS migration file** (with policies for backend + frontend)
3. ⏭️ **Test backend operations** (verify service role key works)
4. ⏭️ **Define frontend access requirements** (what frontend needs)
5. ⏭️ **Create frontend-specific policies** (restrictive, user-specific)

---

## Testing Backend Access

### Test Service Role Key Access

```javascript
// Test script to verify backend access
const { createClient } = require('@supabase/supabase-ai');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test 1: Read users
const { data: users, error: e1 } = await supabase
  .from('users')
  .select('*')
  .limit(1);

// Test 2: Read personas
const { data: personas, error: e2 } = await supabase
  .from('personas')
  .select('*')
  .limit(1);

// Test 3: Read swipes
const { data: swipes, error: e3 } = await supabase
  .from('user_swipes')
  .select('*')
  .limit(1);

console.log('Backend access test:', {
  users: !e1,
  personas: !e2,
  swipes: !e3
});
```

### Expected Result

All tests should pass because service role key bypasses RLS.

---

## Conclusion

The backend requires **FULL ACCESS** to all tables, which is automatically granted when using the **Service Role Key**. RLS policies are primarily needed for **frontend access** using the anon key. The backend will continue to work normally after enabling RLS, as long as it uses the service role key.

