# Points System Integration

## Overview

The points system integrates with the Orchid database (Turso) to manage user points for connection-related actions. Points are deducted when users send connection requests and rewarded when connections are accepted.

## Database Schema

The Orchid database uses the following tables (see `Ordhid_DB_Schema.md`):

- **`profiles`**: User profiles with `farcaster_fid` field
- **`scores`**: User point balances (`profile_id`, `total_points`)
- **`point_events`**: Transaction log (`profile_id`, `rule_key`, `delta`, `source_id`, `evidence`, `created_at`)

## Points Rules

### 1. Connection Request Sent (Like)
- **Action**: User swipes right (likes) another user
- **Points**: **-100 points** (deducted)
- **Rule Key**: `connection_request_sent`
- **When**: Immediately when user sends a connection request

### 2. Connection Request Accepted
- **Action**: User accepts a received connection request
- **Points**: **+200 points** (rewarded to both users)
- **Rule Key**: `connection_request_accepted`
- **When**: When request is accepted (both users get rewarded)

### 3. Connection Request Rejected
- **Action**: User rejects a received connection request
- **Points**: **0 points** (no change)
- **When**: When request is rejected

## Implementation Details

### Turso Database Connection

**Configuration** (`src/config/turso.js`):
- Uses `@libsql/client` to connect to Turso
- Requires `TURSO_CONNECTION_URL` and `TURSO_AUTH_TOKEN` environment variables
- Gracefully handles missing configuration (logs warning, operations fail gracefully)

### Orchid DB Service

**File**: `src/services/orchidDbService.js`

**Functions**:
- `getProfileIdByFid(fid)`: Get profile ID from Farcaster FID
- `getCurrentPoints(fid)`: Get current point balance
- `deductPoints(fid, points, ruleKey, sourceId, evidence)`: Deduct points
- `addPoints(fid, points, ruleKey, sourceId, evidence)`: Add points
- `getRecentTransactions(fid, limit)`: Get transaction history
- `getPointsSummary(fid, limit)`: Get points and transactions

### Integration Points

#### 1. Swipe Endpoint (`POST /api/v1/swipe`)

**Location**: `src/controllers/swipeController.js`

**Behavior**:
- When `action === 'like'`: Deducts 100 points from user
- When `action === 'reject'`: No points change
- Points deduction is non-blocking (swipe succeeds even if points fail)

**Response includes**:
```json
{
  "success": true,
  "data": {
    "swipe": {...},
    "isMatch": false,
    "pointsDeducted": {
      "points": 100,
      "previousBalance": 500,
      "newBalance": 400
    }
  }
}
```

#### 2. Accept Request Endpoint (`POST /api/v1/accept-request`)

**Location**: `src/controllers/swipeController.js`

**Behavior**:
- When `action === 'accept'`: Rewards 200 points to both users
- When `action === 'reject'`: No points change
- Points reward is non-blocking (accept succeeds even if points fail)

**Response includes**:
```json
{
  "success": true,
  "data": {
    "swipe": {...},
    "action": "accept",
    "isMatch": true,
    "pointsRewarded": {
      "userReward": {
        "fid": 12345,
        "points": 200,
        "previousBalance": 400,
        "newBalance": 600
      },
      "targetReward": {
        "fid": 67890,
        "points": 200,
        "previousBalance": 300,
        "newBalance": 500
      }
    }
  }
}
```

#### 3. Get Points Endpoint (`GET /api/v1/points`)

**Location**: `src/controllers/swipeController.js`

**Query Parameters**:
- `fid` (required): Farcaster ID
- `limit` (optional): Number of transactions per page (default: 20, max: 100)
- `page` (optional): Page number for pagination (default: 1)

**Response**:
```json
{
  "success": true,
  "data": {
    "fid": 12345,
    "currentPoints": 600,
    "transactions": [
      {
        "id": 1,
        "rule_key": "connection_request_accepted",
        "delta": 200,
        "source_id": "connection_123_12345_67890",
        "evidence": {
          "fid": 12345,
          "targetFid": 67890,
          "action": "accept",
          "swipeId": "c8b74b87-3bd8-43d9-b61f-771651a823f9",
          "isMatch": true,
          "description": "Rewarded 200 points for accepting connection request from user 67890",
          "verifiedAt": "2024-01-01T00:00:00Z"
        },
        "created_at": "2024-01-01T00:00:00Z"
      },
      {
        "id": 2,
        "rule_key": "connection_request_sent",
        "delta": -100,
        "source_id": "swipe_456_12345_67890",
        "evidence": {
          "fid": 12345,
          "targetFid": 67890,
          "action": "like",
          "swipeId": "69a74812-a991-4173-b4b6-d90cae3af467",
          "description": "Deducted 100 points for sending connection request to user 67890",
          "verifiedAt": "2024-01-01T00:00:00Z"
        },
        "created_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "total": 50,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

**Pagination**:
- Use `page` parameter to navigate through pages
- `hasMore` indicates if there are more transactions available
- `total` shows the total number of transactions
- `offset` shows the current offset (calculated as `(page - 1) * limit`)

## Error Handling

### Insufficient Points
- If user doesn't have enough points when sending a connection request, the deduction fails
- Error is logged but swipe operation still succeeds
- Frontend should check `pointsDeducted` in response to handle insufficient points

### Profile Not Found
- If user doesn't exist in Orchid DB, points operations fail gracefully
- `getPoints` endpoint returns 0 points if profile not found
- Other endpoints log error but continue with main operation

### Turso Connection Issues
- If Turso is not configured, operations fail gracefully
- Warning is logged at startup
- Main operations (swipe, accept) continue to work

## Transaction Logging

All point transactions are logged in `point_events` table with:
- **`rule_key`**: Type of transaction (`connection_request_sent`, `connection_request_accepted`)
- **`delta`**: Point change (positive for rewards, negative for deductions)
- **`source_id`**: Unique identifier for the source action (e.g., `swipe_123_456_789`)
- **`evidence`**: JSON string containing structured transaction data (see below)
- **`created_at`**: Timestamp of the transaction

### Evidence Format

The `evidence` field is stored as a JSON string with the following structure:

**For Connection Request Sent (Like)**:
```json
{
  "fid": 12345,
  "targetFid": 67890,
  "action": "like",
  "swipeId": "uuid-of-swipe",
  "description": "Deducted 100 points for sending connection request to user 67890",
  "verifiedAt": "2024-01-01T00:00:00Z"
}
```

**For Connection Request Accepted**:
```json
{
  "fid": 12345,
  "targetFid": 67890,
  "action": "accept",
  "swipeId": "uuid-of-swipe",
  "isMatch": true,
  "description": "Rewarded 200 points for accepting connection request from user 67890",
  "verifiedAt": "2024-01-01T00:00:00Z"
}
```

This structured format allows for:
- Easy querying by FID or targetFid
- Tracking relationships between users
- Future analytics and reporting
- Backward compatibility (old string evidence is still supported)

## Environment Variables

Add to `.env`:
```env
# Turso Database Configuration (Orchid DB)
TURSO_CONNECTION_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token-here
```

## Installation

Install the required package:
```bash
npm install @libsql/client
```

## Testing

### Test Points Deduction
```bash
curl -X POST http://localhost:3000/api/v1/swipe \
  -H "Content-Type: application/json" \
  -d '{
    "userFid": 12345,
    "targetFid": 67890,
    "action": "like"
  }'
```

### Test Points Reward
```bash
curl -X POST http://localhost:3000/api/v1/accept-request \
  -H "Content-Type: application/json" \
  -d '{
    "userFid": 67890,
    "targetFid": 12345,
    "action": "accept"
  }'
```

### Test Get Points (with pagination)
```bash
# Get first page (20 transactions)
curl "http://localhost:3000/api/v1/points?fid=12345"

# Get second page
curl "http://localhost:3000/api/v1/points?fid=12345&page=2"

# Get custom page size
curl "http://localhost:3000/api/v1/points?fid=12345&limit=50&page=1"
```

## Notes

1. **Non-blocking Operations**: Points operations are non-blocking. If points fail, the main operation (swipe/accept) still succeeds.

2. **Idempotency**: Points are deducted/rewarded once per action. The `source_id` ensures uniqueness.

3. **Balance Checks**: Points deduction checks balance before deducting. If insufficient, error is thrown but operation continues.

4. **Transaction Logging**: All point changes are logged for audit purposes.

5. **Profile Mapping**: System maps Farcaster FID to Orchid profile ID using `farcaster_fid` field in `profiles` table.

