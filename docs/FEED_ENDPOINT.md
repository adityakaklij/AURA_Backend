# Connected Users Feed Endpoint

## Overview

The feed endpoint returns casts (posts) from all users who have mutually matched (connected) with the requesting user. Casts are sorted by timestamp with the most recent first. The endpoint is optimized to minimize Neynar API calls by batching up to 100 user FIDs per API call.

## Endpoint

**GET** `/api/v1/feed`

## Authentication

No authentication required (public endpoint).

## Query Parameters

| Parameter | Type   | Required | Default | Description                                                                 |
|-----------|--------|----------|---------|-----------------------------------------------------------------------------|
| `fid`     | number | Yes      | -       | Farcaster ID of the user requesting the feed                                |
| `limit`   | number | No       | 25      | Maximum number of casts to return (min: 1, max: 100)                        |
| `cursor`  | string | No       | null    | Pagination cursor for fetching the next page (returned in previous response) |

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "casts": [
      {
        "hash": "0x...",
        "author": {
          "fid": 123,
          "username": "username",
          "display_name": "Display Name",
          "pfp_url": "https://...",
          "follower_count": 100,
          "following_count": 50
        },
        "text": "Cast content...",
        "timestamp": "2024-01-01T00:00:00Z",
        "embeds": [],
        "reactions": {
          "likes": [],
          "recasts": []
        },
        "replies": {
          "count": 0
        }
      }
    ],
    "pagination": {
      "hasMore": true,
      "nextCursor": "base64_encoded_cursor_string",
      "totalMatchedUsers": 45,
      "castsReturned": 25,
      "totalCastsAvailable": 150
    },
    "metadata": {
      "matchedUsersCount": 45,
      "apiCallsMade": 1,
      "batchesUsed": 1
    }
  }
}
```

### Error Response (400 Bad Request)

```json
{
  "success": false,
  "error": "fid is required"
}
```

```json
{
  "success": false,
  "error": "limit must be a number between 1 and 100"
}
```

### Error Response (500 Internal Server Error)

```json
{
  "success": false,
  "error": "Failed to get connected users feed: [error message]"
}
```

## Response Fields

### Casts Array

Each cast object contains:
- `hash` - Unique cast identifier
- `author` - Author information (FID, username, display name, profile picture, etc.)
- `text` - Cast content text
- `timestamp` - ISO 8601 timestamp of when the cast was created
- `embeds` - Array of embedded content (images, links, etc.)
- `reactions` - Object containing likes and recasts
- `replies` - Object containing reply count

### Pagination Object

- `hasMore` (boolean) - Whether there are more casts available
- `nextCursor` (string|null) - Cursor to use for fetching the next page
- `totalMatchedUsers` (number) - Total number of matched/connected users
- `castsReturned` (number) - Number of casts in current response
- `totalCastsAvailable` (number) - Total casts fetched (may be more than returned due to pagination)

### Metadata Object

- `matchedUsersCount` (number) - Number of matched users
- `apiCallsMade` (number) - Number of Neynar API calls made (optimization metric)
- `batchesUsed` (number) - Number of batches used (1 if ≤100 users, more if >100 users)

## Usage Examples

### Basic Request

```bash
curl -X GET "https://your-api.com/api/v1/feed?fid=123&limit=25"
```

### With Pagination

```bash
# First page
curl -X GET "https://your-api.com/api/v1/feed?fid=123&limit=25"

# Next page (using cursor from previous response)
curl -X GET "https://your-api.com/api/v1/feed?fid=123&limit=25&cursor=base64_encoded_cursor"
```

### JavaScript/TypeScript Example

```javascript
async function fetchFeed(userFid, limit = 25, cursor = null) {
  const params = new URLSearchParams({
    fid: userFid.toString(),
    limit: limit.toString(),
  });
  
  if (cursor) {
    params.append('cursor', cursor);
  }
  
  const response = await fetch(`/api/v1/feed?${params.toString()}`);
  const data = await response.json();
  
  if (data.success) {
    return {
      casts: data.data.casts,
      pagination: data.data.pagination,
      metadata: data.data.metadata,
    };
  } else {
    throw new Error(data.error);
  }
}

// Usage
const feed = await fetchFeed(123, 25);
console.log(`Fetched ${feed.casts.length} casts`);
console.log(`API calls made: ${feed.metadata.apiCallsMade}`);

// Fetch next page
if (feed.pagination.hasMore) {
  const nextPage = await fetchFeed(123, 25, feed.pagination.nextCursor);
}
```

### React Example

```jsx
import { useState, useEffect } from 'react';

function FeedComponent({ userFid }) {
  const [casts, setCasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    fetchFeed();
  }, [userFid]);

  const fetchFeed = async (nextCursor = null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        fid: userFid.toString(),
        limit: '25',
      });
      
      if (nextCursor) {
        params.append('cursor', nextCursor);
      }
      
      const response = await fetch(`/api/v1/feed?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        if (nextCursor) {
          // Append to existing casts for infinite scroll
          setCasts(prev => [...prev, ...data.data.casts]);
        } else {
          // Replace casts for initial load
          setCasts(data.data.casts);
        }
        
        setCursor(data.data.pagination.nextCursor);
        setHasMore(data.data.pagination.hasMore);
      }
    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (hasMore && cursor) {
      fetchFeed(cursor);
    }
  };

  return (
    <div>
      {casts.map((cast) => (
        <div key={cast.hash}>
          <h3>{cast.author.display_name}</h3>
          <p>{cast.text}</p>
          <small>{new Date(cast.timestamp).toLocaleString()}</small>
        </div>
      ))}
      
      {loading && <p>Loading...</p>}
      
      {hasMore && !loading && (
        <button onClick={loadMore}>Load More</button>
      )}
    </div>
  );
}
```

## Optimization Details

### API Call Minimization

The endpoint is optimized to minimize Neynar API calls:

1. **Batching**: Up to 100 user FIDs can be included in a single API call
2. **Single Batch (≤100 users)**: 1 API call, uses Neynar's native pagination
3. **Multiple Batches (>100 users)**: 
   - Fetches casts from all batches in parallel
   - Merges and sorts all casts by timestamp
   - Implements manual pagination with cursor-based offset

### Example Scenarios

**Scenario 1: 45 Matched Users**
- API Calls: 1
- Batches: 1
- Efficiency: Optimal ✅

**Scenario 2: 150 Matched Users**
- API Calls: 2 (batches of 100 + 50)
- Batches: 2
- Efficiency: Good ✅

**Scenario 3: 500 Matched Users**
- API Calls: 5 (5 batches of 100)
- Batches: 5
- Efficiency: Acceptable ✅

### Cast Sorting

All casts are sorted by timestamp in descending order (most recent first), regardless of:
- Which user posted them
- Which batch they came from
- When they were fetched

## Pagination Strategy

### Single Batch (≤100 Users)

Uses Neynar's native cursor-based pagination:
- Cursor is returned directly from Neynar API
- More efficient and reliable
- Supports real-time updates

### Multiple Batches (>100 Users)

Uses custom offset-based pagination:
- Cursor contains base64-encoded offset and timestamp
- Fetches all casts from all batches, then paginates locally
- First page fetches enough casts to cover limit + buffer
- Subsequent pages use cursor to determine offset

## Rate Limiting

The endpoint respects Neynar API rate limits. If you encounter rate limiting:
- Reduce the number of matched users (unmatch some users)
- Increase time between requests
- Implement client-side caching

## Error Handling

### Common Errors

1. **Missing FID**: Returns 400 with error message
2. **Invalid Limit**: Returns 400 if limit is not between 1-100
3. **Neynar API Error**: Returns 500 with error details
4. **No Matched Users**: Returns empty casts array with `hasMore: false`

### Error Recovery

- Invalid cursor: Treated as first page (cursor ignored)
- API failure: Individual batch failures are logged but don't fail entire request
- Network errors: Should be retried with exponential backoff

## Best Practices

### Frontend Implementation

1. **Caching**: Cache feed data client-side to reduce API calls
2. **Infinite Scroll**: Use cursor-based pagination for smooth infinite scroll
3. **Error Handling**: Handle errors gracefully and show user-friendly messages
4. **Loading States**: Show loading indicators during fetch
5. **Refresh**: Allow users to manually refresh feed

### Performance Tips

1. **Limit Size**: Use reasonable limit values (25-50 is optimal)
2. **Pagination**: Always use pagination instead of fetching all casts
3. **Debouncing**: Debounce rapid requests if implementing pull-to-refresh
4. **Caching**: Cache feed data for a few minutes to reduce server load

## Testing

### Test Cases

1. **No Matched Users**: Should return empty array
2. **Single Matched User**: Should return their casts
3. **Multiple Matched Users (≤100)**: Should return merged casts
4. **Many Matched Users (>100)**: Should batch and merge correctly
5. **Pagination**: Should work correctly for both single and multiple batches
6. **Invalid Parameters**: Should return appropriate errors

### Example Test Requests

```bash
# Test with no matches
curl "https://your-api.com/api/v1/feed?fid=999999&limit=10"

# Test with single match
curl "https://your-api.com/api/v1/feed?fid=123&limit=10"

# Test pagination
curl "https://your-api.com/api/v1/feed?fid=123&limit=10&cursor=test_cursor"
```

## Related Endpoints

- `GET /api/v1/get-matches-list` - Get list of matched users
- `GET /api/v1/get-connections` - Get all connection data

## Support

For issues or questions:
- Check server logs for detailed error messages
- Verify Neynar API key is valid
- Ensure matched users exist (use `/get-matches-list` to verify)
- Review Neynar API documentation for feed endpoint details

