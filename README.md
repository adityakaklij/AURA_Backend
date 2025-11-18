cloudflared tunnel --url http://localhost:3000

# Aura Backend

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

## API Endpoints

- `GET /` - Welcome message
- `GET /api/v1/health` - Health check endpoint



## Environment Variables

See `.env.example` for all available configuration options.

## Security Features

- Helmet.js for security headers
- CORS configuration
- Rate limiting
- Input validation ready
- Error message sanitization

## License

ISC




## Endpoings

1. User wallet related
    i.   Deposite
    ii.  Withdraw
    iii. Get current balance
    iv.  Deduct balance
    v.   Txs history

2. Auth
    i.  Login/sign up the user
    ii. Check user owns nft or not
    iii. Keep user signed up

3. Get user details
    i.   Create user profile
    ii.  Advanced filters for the users
    iii.  


NOW WORKING:
    1. Get user profile details for farcaster using Neynar apis.
    2. Create/update user persona with AI analysis (Gemini AI)

## User Endpoints

### GET /api/v1/get-user-details
Get user profile details from Farcaster using Neynar API. If the user is new, automatically creates a persona in the background and checks NFT ownership using Alchemy API.

**Query Parameters:**
- `fid` (required): Farcaster ID
- `viewerFid` (optional): Viewer FID for personalized data

**Example:**
```
GET /api/v1/get-user-details?fid=12345
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fid": 12345,
    "username": "username",
    "display_name": "Display Name",
    "nft_owned": true,
    "nft_verified_address": "0x...",
    "nft_last_verified_at": "2024-01-01T00:00:00Z",
    ...
  }
}
```

**Note:** 
- For new users, persona creation happens automatically in the background without blocking the response.
- NFT ownership is checked during onboarding using Alchemy API. Checks `primary.eth_address` first, then all addresses in `eth_addresses` array (avoiding duplicates).

### POST /api/v1/create-persona
Manually create or update user persona. Fetches user data from Neynar, analyzes with Gemini AI, and stores/updates in database. Use this endpoint for hard refresh/updates.

**Request Body:**
```json
{
  "fid": 12345
}
```

**Response:**
```json
{
  "success": true,
  "message": "Persona created/updated successfully",
  "data": {
    "fid": 12345,
    "profile": { ... },
    "analysis": {
      "core_interests": [...],
      "projects_protocols": [...],
      "expertise_level": "expert",
      "engagement_style": "technical",
      "content_themes": [...],
      "posting_frequency": "high",
      "top_channels": [...],
      "sentiment": "positive",
      "summary": "...",
      "confidence_score": 0.95
    },
    "cast_count": 500,
    "analyzed_at": "2024-01-01T00:00:00Z"
  }
}
```

### POST /api/v1/re-verify-nft
Re-verify NFT ownership for a user. Fetches fresh user data from Neynar and checks all addresses using Alchemy API.

**Request Body:**
```json
{
  "fid": 12345
}
```

**Response:**
```json
{
  "success": true,
  "message": "NFT ownership re-verified successfully",
  "data": {
    "fid": 12345,
    "nft_owned": true,
    "nft_verified_address": "0x...",
    "nft_last_verified_at": "2024-01-01T00:00:00Z"
  }
}
```

**Note:** 
- Fetches fresh user data from Neynar to get current addresses
- Checks `primary.eth_address` first, then all addresses in `eth_addresses` array
- Updates the database with the latest NFT ownership status

### GET /api/v1/get-matches
Get matching users based on persona similarity. Returns users with similar interests, projects, expertise level, and engagement style. Perfect for a professional matchmaking/swiping platform.

**Query Parameters:**
- `fid` (required): Farcaster ID of the user
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 10, max: 50)

**Example:**
```
GET /api/v1/get-matches?fid=12345&page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "fid": 67890,
        "username": "username2",
        "display_name": "Display Name 2",
        "pfp_url": "https://...",
        "bio_text": "User bio...",
        "follower_count": 100,
        "following_count": 50,
        "power_badge": false,
        "score": 85.5,
        "match_score": 87.5,
        "matching_keywords": {
          "interests": ["DeFi", "NFTs", "Web3"],
          "projects": ["Ethereum", "Base"],
          "themes": ["Analysis", "Tutorials"],
          "channels": ["dev", "general"]
        },
        "persona_summary": "User is passionate about...",
        "expertise_level": "expert",
        "engagement_style": "technical"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "totalPages": 5
    }
  }
}
```

**Matching Algorithm:**
The matching algorithm calculates similarity based on:
- **Core Interests** (30% weight): Common interests between users
- **Projects/Protocols** (25% weight): Shared crypto projects or protocols
- **Expertise Level** (15% weight): Similar knowledge level
- **Content Themes** (15% weight): Common content types
- **Engagement Style** (10% weight): Similar engagement patterns
- **Top Channels** (5% weight): Common channels they post in

Results are sorted by match score (highest first) and paginated.

**Note:** User must have a persona created before using this endpoint. If persona doesn't exist, call `/create-persona` first or use `/get-user-details` which automatically creates persona for new users.

**Important:** 
- This endpoint automatically excludes users that have already been swiped on (liked or rejected) by the requesting user.
- **Matching Logic:** The endpoint first returns users with matching interests (match_score > 0), sorted by similarity. If there are not enough matches to fill the page, it automatically fills the remaining slots with random users from the database (match_score = 0).

### POST /api/v1/swipe
Record a user swipe (like or reject) in the matchmaking platform. Used by frontend when users swipe left (reject) or right (like) on other users.

**Request Body:**
```json
{
  "userFid": 12345,
  "targetFid": 67890,
  "action": "like"
}
```

**Parameters:**
- `userFid` (required): FID of the user performing the swipe
- `targetFid` (required): FID of the user being swiped on
- `action` (required): Either `"like"` or `"reject"`

**Response:**
```json
{
  "success": true,
  "message": "Swipe recorded: like",
  "data": {
    "swipe": {
      "id": "uuid",
      "user_fid": 12345,
      "target_fid": 67890,
      "action": "like",
      "created_at": "2024-01-01T00:00:00Z"
    },
    "isMatch": true
  }
}
```

**Note:** The `isMatch` field will be `true` if both users have liked each other (mutual match). This happens automatically when a user likes someone who has already liked them.

### GET /api/v1/get-matches-list
Get all matches (mutual likes/connected users) for a user. Returns list of users who have mutually liked each other.

**Query Parameters:**
- `fid` (required): Farcaster ID of the user

**Example:**
```
GET /api/v1/get-matches-list?fid=12345
```

**Response:**
```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "fid": 67890,
        "username": "username2",
        "display_name": "Display Name 2",
        "pfp_url": "https://...",
        "bio_text": "User bio...",
        "follower_count": 100,
        "following_count": 50,
        "power_badge": false,
        "score": 85.5
      }
    ],
    "count": 1
  }
}
```

### GET /api/v1/get-requests-sent
Get requests sent (users I've liked but haven't matched yet). Returns list of users the current user has liked, excluding mutual matches.

**Query Parameters:**
- `fid` (required): Farcaster ID of the user

**Example:**
```
GET /api/v1/get-requests-sent?fid=12345
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "fid": 67890,
        "username": "username2",
        "display_name": "Display Name 2",
        "pfp_url": "https://...",
        "bio_text": "User bio...",
        "follower_count": 100,
        "following_count": 50,
        "power_badge": false,
        "score": 85.5,
        "requested_at": "2024-01-01T00:00:00Z"
      }
    ],
    "count": 1
  }
}
```

### GET /api/v1/get-requests-received
Get requests received (users who have liked me but I haven't liked back). Returns list of users who have liked the current user, but user hasn't liked back yet.

**Query Parameters:**
- `fid` (required): Farcaster ID of the user

**Example:**
```
GET /api/v1/get-requests-received?fid=12345
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "fid": 67890,
        "username": "username2",
        "display_name": "Display Name 2",
        "pfp_url": "https://...",
        "bio_text": "User bio...",
        "follower_count": 100,
        "following_count": 50,
        "power_badge": false,
        "score": 85.5,
        "requested_at": "2024-01-01T00:00:00Z"
      }
    ],
    "count": 1
  }
}
```

### GET /api/v1/get-connections
Get all connection data (requests sent, received, and connected users) in a single request. This is a comprehensive endpoint that returns all connection-related data.

**Query Parameters:**
- `fid` (required): Farcaster ID of the user

**Example:**
```
GET /api/v1/get-connections?fid=12345
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requests_sent": {
      "users": [
        {
          "fid": 67890,
          "username": "username2",
          "display_name": "Display Name 2",
          "pfp_url": "https://...",
          "bio_text": "User bio...",
          "follower_count": 100,
          "following_count": 50,
          "power_badge": false,
          "score": 85.5,
          "requested_at": "2024-01-01T00:00:00Z"
        }
      ],
      "count": 1
    },
    "requests_received": {
      "users": [
        {
          "fid": 11111,
          "username": "username3",
          "display_name": "Display Name 3",
          "pfp_url": "https://...",
          "bio_text": "User bio...",
          "follower_count": 200,
          "following_count": 100,
          "power_badge": false,
          "score": 90.0,
          "requested_at": "2024-01-02T00:00:00Z"
        }
      ],
      "count": 1
    },
    "connected": {
      "users": [
        {
          "fid": 22222,
          "username": "username4",
          "display_name": "Display Name 4",
          "pfp_url": "https://...",
          "bio_text": "User bio...",
          "follower_count": 150,
          "following_count": 75,
          "power_badge": false,
          "score": 88.0
        }
      ],
      "count": 1
    }
  }
}
```

### POST /api/v1/accept-request
Accept or reject a received request. Users can handle pending requests from the same interface.

**Request Body:**
```json
{
  "userFid": 12345,
  "targetFid": 67890,
  "action": "accept"
}
```

**Parameters:**
- `userFid` (required): FID of the user handling the request
- `targetFid` (required): FID of the user whose request is being handled
- `action` (required): Either `"accept"` or `"reject"`

**Accept Action Response:**
```json
{
  "success": true,
  "message": "Request accepted successfully",
  "data": {
    "swipe": {
      "id": "uuid",
      "user_fid": 12345,
      "target_fid": 67890,
      "action": "like",
      "created_at": "2024-01-01T00:00:00Z"
    },
    "action": "accept",
    "isMatch": true,
    "message": "You are now connected!"
  }
}
```

**Reject Action Response:**
```json
{
  "success": true,
  "message": "Request rejected successfully",
  "data": {
    "swipe": {
      "id": "uuid",
      "user_fid": 12345,
      "target_fid": 67890,
      "action": "reject",
      "created_at": "2024-01-01T00:00:00Z"
    },
    "action": "reject",
    "isMatch": false,
    "message": "Request rejected."
  }
}
```

**Note:** 
- The endpoint verifies that a pending request exists before handling it
- **Accept**: Records a "like" swipe. If `isMatch` is `true`, both users have now liked each other and are connected
- **Reject**: Records a "reject" swipe. The request is rejected and the user won't appear in future matches
- Both actions remove the user from the "requests received" list

## Database Schema

### user_swipes Table
Tracks user swipes (likes/rejects) in the matchmaking platform:
- `id`: UUID primary key
- `user_fid`: FID of the user performing the swipe
- `target_fid`: FID of the user being swiped on
- `action`: 'like' or 'reject'
- `created_at`: Timestamp when swipe was recorded
- `updated_at`: Timestamp when swipe was last updated
- Unique constraint on (user_fid, target_fid) - ensures a user can only swipe once per target

### user_matches View
Automatically created view showing mutual matches (when both users have liked each other).

**Migration:** Run `database/migration_add_user_swipes_table.sql` to create the table and view.

Smart Contract:
{
    "success": true,
    "message": "Persona created/updated successfully",
    "data": {
        "fid": 857720,
        "profile": {
            "fid": 857720,
            "username": "adityak.eth",
            "display_name": "Aditya Kaklij",
            "bio": "Founder at Resmic.\nBuilding a decentralised payment infrastructure.",
            "follower_count": 11,
            "following_count": 29
        },
        "analysis": {
            "core_interests": [
                "Decentralized Payments",
                "Crypto",
                "Web3",
                "Payment Infrastructure",
                "Blockchain Technology"
            ],
            "projects_protocols": [
                "Resmic",
                "AURA",
                "MOVE"
            ],
            "expertise_level": "expert",
            "engagement_style": "educational",
            "content_themes": [
                "Analysis",
                "Product Updates",
                "Industry Commentary",
                "Tutorials"
            ],
            "posting_frequency": "low",
            "top_channels": [
                "dev"
            ],
            "sentiment": "positive",
            "summary": "Aditya Kaklij is the founder of Resmic, a decentralized payment infrastructure. He is passionate about crypto payments, web3, and reducing payment fees for businesses. He shares insights on building payment infrastructure and advocates for the benefits of decentralized solutions.",
            "confidence_score": 0.9
        },
        "cast_count": 14,
        "analyzed_at": "2025-11-13T06:03:37.781+00:00",
        "created_at": "2025-11-13T06:03:38.533503+00:00",
        "updated_at": "2025-11-13T06:03:38.533503+00:00"
    }
}# AURA_Backend
