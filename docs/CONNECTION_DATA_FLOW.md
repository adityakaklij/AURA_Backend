# Connection Data Flow - How Data is Updated

## When a User Accepts a Request

### Data Update Flow

1. **User accepts request** → `POST /api/v1/accept-request`
   - `userFid`: User accepting the request
   - `targetFid`: User who sent the request
   - `action`: "accept"

2. **Swipe is recorded** → `dbService.recordSwipe()`
   - **Table**: `user_swipes`
   - **Action**: `upsert` (insert or update)
   - **Data stored**:
     ```sql
     user_fid: userFid (the one accepting)
     target_fid: targetFid (the one who sent request)
     action: 'like'
     created_at: current timestamp
     updated_at: current timestamp
     ```

3. **Match is checked** → `dbService.checkIfMatched()`
   - Checks if both users have liked each other
   - Queries `user_swipes` table:
     - Does `userFid` like `targetFid`? (just created)
     - Does `targetFid` like `userFid`? (should exist from original request)

4. **Connection is created** (if mutual like)
   - Both users now have `action='like'` records in `user_swipes`
   - The `user_matches` view automatically reflects this
   - `getUserMatches()` will return this connection

## Data Storage

### Primary Table: `user_swipes`
- Stores all swipe actions (likes and rejects)
- Each row represents one user's action toward another
- Unique constraint: `(user_fid, target_fid)` - one swipe per user pair

### View: `user_matches`
- Automatically calculated view
- Shows mutual matches (both users have liked each other)
- Updated in real-time as `user_swipes` table changes

## Example Flow

### Scenario: User A accepts User B's request

**Before Accept:**
```
user_swipes table:
- user_fid: B, target_fid: A, action: 'like' (User B liked User A)
```

**After Accept:**
```
user_swipes table:
- user_fid: B, target_fid: A, action: 'like' (User B liked User A)
- user_fid: A, target_fid: B, action: 'like' (User A accepted - now likes User B) ✅ NEW

user_matches view:
- user1_fid: A, user2_fid: B, matched_at: timestamp ✅ NEW CONNECTION
```

## Where Data is Updated

### ✅ **Data IS Updated Immediately**

1. **`user_swipes` table** - Updated via `recordSwipe()` upsert
2. **`user_matches` view** - Automatically reflects changes (real-time)
3. **Connection endpoints** - Query the database directly, so they see updates immediately

### Endpoints That Reflect the Update

- `GET /api/v1/get-matches-list` - Shows connected users
- `GET /api/v1/get-connections` - Shows all connection data
- `GET /api/v1/get-requests-received` - Removes accepted user from list
- `GET /api/v1/get-requests-sent` - Updates based on match status

## Verification

The data update happens in:
- **File**: `src/services/dbService.js`
- **Function**: `recordSwipe()` (line 302)
- **Method**: `upsert` - ensures data is inserted or updated
- **Table**: `user_swipes`

The connection check happens in:
- **File**: `src/services/dbService.js`
- **Function**: `checkIfMatched()` (line 511)
- **Method**: Queries `user_swipes` table for mutual likes

## Potential Issues

If connections aren't showing up, check:

1. **Database transaction** - Ensure the upsert completed successfully
2. **Query timing** - The data should be immediately available (no caching)
3. **Match logic** - Verify both users have `action='like'` records
4. **View refresh** - The `user_matches` view is real-time, no refresh needed

## Debugging

Added console logs in `acceptRequest()` to track:
- ✅ When swipe is recorded
- 🔍 When match is checked
- 🎉 When new connection is created

Check server logs to verify the flow is working correctly.

