# Feed Casts Verification

## Question 1: Which casts are being returned?

### ✅ **Answer: Only casts from MUTUALLY MATCHED users**

The feed endpoint **ONLY** returns casts from users who are **mutually matched and connected**. Here's how it works:

1. **`getUserMatches(userFid)`** function checks:
   - Users that the current user has liked (right-swiped)
   - **AND** those users have also liked the current user back
   - Returns only FIDs where **BOTH** users have liked each other

2. **Database Logic** (from `dbService.getUserMatches`):
   ```javascript
   // Step 1: Get users I've liked
   userLikes = users where user_fid = me AND action = 'like'
   
   // Step 2: Check which of those users have also liked me back
   mutualLikes = users where user_fid IN (userLikes) 
                 AND target_fid = me 
                 AND action = 'like'
   
   // Result: Only users where BOTH have liked each other
   ```

3. **Feed Service**:
   - Fetches casts **ONLY** from the matched FIDs returned above
   - Does **NOT** include casts from:
     - Users I've liked but haven't liked me back (pending requests)
     - Users who liked me but I haven't liked back (received requests)
     - Users I've rejected
     - Users who rejected me

### Verification

You can verify this by:
1. Check matched users: `GET /api/v1/get-matches-list?fid=YOUR_FID`
2. Check feed: `GET /api/v1/feed?fid=YOUR_FID`
3. All casts in feed should be from users in the matches list

---

## Question 2: Does it return counts of likes and other engagement data?

### ✅ **Answer: YES - All engagement data is included**

The feed endpoint returns **complete engagement data** for each cast:

### Engagement Data Included:

1. **Likes Count**:
   ```json
   {
     "reactions": {
       "likes": [...],           // Array of users who liked
       "likes_count": 42         // Total count
     }
   }
   ```

2. **Recasts Count**:
   ```json
   {
     "reactions": {
       "recasts": [...],         // Array of users who recast
       "recasts_count": 15       // Total count
     }
   }
   ```

3. **Replies Count**:
   ```json
   {
     "replies": {
       "count": 8                // Total reply count
     }
   }
   ```

### Data Processing

The service ensures engagement data is always present:

1. **From Neynar API**: The Feed API returns cast objects with engagement data
2. **Normalization**: The service normalizes the data to ensure:
   - If Neynar returns arrays, we calculate counts
   - If counts are missing, we set them to 0
   - All casts have consistent structure

### Example Response

```json
{
  "success": true,
  "data": {
    "casts": [
      {
        "hash": "0xabc123...",
        "author": {
          "fid": 123,
          "username": "alice",
          "display_name": "Alice",
          "pfp_url": "https://...",
          "follower_count": 1000,
          "following_count": 500
        },
        "text": "Check out this amazing project!",
        "timestamp": "2024-01-15T10:30:00Z",
        "embeds": [...],
        "reactions": {
          "likes": [...],           // Array of like objects
          "likes_count": 42,        // ✅ Total likes count
          "recasts": [...],         // Array of recast objects
          "recasts_count": 15       // ✅ Total recasts count
        },
        "replies": {
          "count": 8                // ✅ Total replies count
        }
      }
    ],
    "pagination": {...},
    "metadata": {...}
  }
}
```

### Complete Cast Object Structure

Each cast includes:

- **Basic Info**:
  - `hash` - Unique cast identifier
  - `text` - Cast content
  - `timestamp` - When cast was created
  - `embeds` - Embedded content (images, links, etc.)

- **Author Info**:
  - `author.fid` - Author's Farcaster ID
  - `author.username` - Username
  - `author.display_name` - Display name
  - `author.pfp_url` - Profile picture URL
  - `author.follower_count` - Follower count
  - `author.following_count` - Following count

- **Engagement Metrics** (✅ Always included):
  - `reactions.likes_count` - Number of likes
  - `reactions.recasts_count` - Number of recasts
  - `replies.count` - Number of replies

---

## Summary

### ✅ Casts Source
- **ONLY** from mutually matched/connected users
- Both users must have liked each other
- No casts from pending requests or rejected users

### ✅ Engagement Data
- **Likes count** - Always included
- **Recasts count** - Always included
- **Replies count** - Always included
- Data is normalized and consistent

### Verification Endpoint

Test the feed:
```bash
GET /api/v1/feed?fid=YOUR_FID&limit=10
```

Check that:
1. All casts are from users in your matches list
2. Each cast has `reactions.likes_count`, `reactions.recasts_count`, and `replies.count`

