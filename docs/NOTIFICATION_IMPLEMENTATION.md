# Notification Implementation Summary

## Overview

This document summarizes the notification system implementation using Neynar Frame Notifications API. The system sends notifications to users for important events while maintaining moderation and appropriate frequency.

## Implementation Details

### Files Created

1. **`src/services/notificationService.js`**
   - Core notification service
   - Handles sending notifications via Neynar API
   - Implements rate limiting and deduplication
   - Provides helper functions for different notification types

### Files Modified

1. **`src/controllers/swipeController.js`**
   - Added notification calls for connection requests
   - Added notification calls for connection accepted (mutual matches)
   - Notifications sent asynchronously to not block API responses

## Notification Types

### 1. Connection Request Notification

**Trigger:** When User A right swipes (likes) User B

**Notification Details:**
- **Title:** "💌 New Connection Request"
- **Body:** "[User A's name] wants to connect with you!"
- **Target URL:** `/connections?tab=requests`
- **Rate Limit:** 1 per 30 seconds per user pair

**Implementation:**
```javascript
// Automatically called in recordSwipe() when action === 'like' and not a match
notificationService.notifyConnectionRequest(userFid, targetFid);
```

### 2. Connection Accepted Notification

**Trigger:** When two users mutually match (both swipe right on each other)

**Notification Details:**
- **Title:** "🎉 You're Connected!"
- **Body:** "You and [Other User's name] are now connected!"
- **Target URL:** `/connections/{fid}` or `/connections`
- **Rate Limit:** 1 per 30 seconds per user pair

**Implementation:**
```javascript
// Called when isMatch === true in recordSwipe() or acceptRequest()
notificationService.notifyConnectionAccepted(userFid1, userFid2);
```

### 3. New Message Notification (Ready for Future)

**Trigger:** When a connected user sends a message (not yet implemented)

**Notification Details:**
- **Title:** "💬 New Message"
- **Body:** "[User's name]: [Message preview]"
- **Target URL:** `/messages/{fid}` or `/messages`
- **Rate Limit:** 1 per 30 seconds per user pair

**Implementation:**
```javascript
// Ready to use when messaging is implemented
notificationService.notifyNewMessage(fromFid, toFid, messagePreview);
```

## Rate Limiting & Moderation

### Built-in Rate Limiting

The service implements rate limiting to prevent notification spam:

1. **Per-User Rate Limit:** 1 notification per 30 seconds per notification type
2. **Deduplication:** Same notification type for same user pair is cached
3. **Automatic Cleanup:** Cache entries older than 1 hour are removed

### Rate Limit Enforcement

- Farcaster clients enforce: 1 notification per 30 seconds per token, 100 per day per token
- Our service adds an additional layer to prevent duplicate notifications
- Rate-limited notifications are logged but don't fail the operation

### Moderation Features

1. **Appropriate Content:** Clear, concise notification titles and bodies
2. **Actionable Links:** Each notification links to relevant page
3. **Non-Blocking:** Notifications sent asynchronously, don't affect API response time
4. **Error Handling:** Notification failures are logged but don't break user flows

## Configuration

### Environment Variables

Add to `.env`:

```env
# Frontend URL for notification target URLs
FRONTEND_URL=https://your-domain.com

# Neynar API Key (already configured)
NEYNAR_API_KEY=your_neynar_api_key
```

### Neynar Setup

1. Create Neynar app at [dev.neynar.com](https://dev.neynar.com)
2. Get Client ID from app settings
3. Frame Events Webhook URL: `https://api.neynar.com/f/app/<client_id>/event`
4. Add webhook URL to frame manifest (see FRONTEND_NOTIFICATION_SETUP.md)

## Usage Examples

### Sending Custom Notification

```javascript
const notificationService = require('./services/notificationService');

// Send notification to specific users
await notificationService.sendNotification({
  targetFids: [123, 456], // Array of FIDs
  title: 'Custom Title',
  body: 'Custom message body',
  targetUrl: 'https://your-domain.com/custom-page',
  type: 'custom_type', // For rate limiting
  relatedFid: 789, // Optional, for deduplication
});
```

### Checking Notification Status

Notifications are sent asynchronously. Check server logs for:
- `✅ Notification sent to X user(s): [title]`
- `⏸️ Rate limit: Skipping notification to FID X`
- `❌ Error sending notification: [error message]`

## Error Handling

### Graceful Degradation

- Notification failures don't break user flows
- Errors are logged but not thrown
- API responses succeed even if notifications fail

### Error Logging

All notification errors are logged with:
- Error message
- Target FIDs
- Notification type
- Timestamp

## Testing

### Manual Testing

1. **Test Connection Request:**
   - User A swipes right on User B
   - Check User B receives notification
   - Verify notification links to requests page

2. **Test Connection Accepted:**
   - User A swipes right on User B
   - User B swipes right on User A
   - Check both users receive "You're Connected!" notification

3. **Test Rate Limiting:**
   - Send multiple connection requests quickly
   - Verify only first notification is sent
   - Check logs for rate limit messages

### Monitoring

1. **Neynar Dev Portal:**
   - View notification analytics
   - Check delivery rates
   - Monitor open rates

2. **Server Logs:**
   - Monitor notification success/failure
   - Track rate limiting
   - Identify errors

## Future Enhancements

### Planned Features

1. **Message Notifications:**
   - Integrate when messaging system is implemented
   - Send preview of message in notification

2. **Notification Preferences:**
   - User settings for notification types
   - Quiet hours
   - Frequency preferences

3. **Advanced Targeting:**
   - Filter by user segments
   - A/B testing notifications
   - Personalized content

4. **Analytics:**
   - Track notification effectiveness
   - User engagement metrics
   - Conversion tracking

## API Reference

### notificationService.notifyConnectionRequest(fromFid, toFid)

Sends notification when user receives connection request.

**Parameters:**
- `fromFid` (number): FID of user who sent request
- `toFid` (number): FID of user who received request

**Returns:** Promise<Object> with success status and details

### notificationService.notifyConnectionAccepted(userFid1, userFid2)

Sends notification to both users when they mutually match.

**Parameters:**
- `userFid1` (number): First user FID
- `userFid2` (number): Second user FID

**Returns:** Promise<Object> with success status for both users

### notificationService.notifyNewMessage(fromFid, toFid, messagePreview)

Sends notification when user receives new message (ready for future use).

**Parameters:**
- `fromFid` (number): FID of user who sent message
- `toFid` (number): FID of user who received message
- `messagePreview` (string, optional): Preview of message content

**Returns:** Promise<Object> with success status

### notificationService.sendNotification(params)

Low-level function to send custom notifications.

**Parameters:**
- `targetFids` (number|number[]): Target FID(s)
- `title` (string): Notification title (max 100 chars)
- `body` (string): Notification body (max 500 chars)
- `targetUrl` (string, optional): Target URL
- `type` (string, optional): Notification type for rate limiting
- `relatedFid` (number, optional): Related FID for deduplication

**Returns:** Promise<Object> with success status and details

## Troubleshooting

### Notifications Not Sending

1. **Check Neynar API Key:**
   - Verify `NEYNAR_API_KEY` is set in `.env`
   - Check key is valid in Neynar dashboard

2. **Check User Has Mini App Added:**
   - User must have added mini app to their Farcaster client
   - User must have enabled notifications

3. **Check Rate Limits:**
   - Review server logs for rate limit messages
   - Verify notification wasn't sent recently

4. **Check Neynar Dev Portal:**
   - View notification history
   - Check for delivery errors
   - Verify webhook URL is correct

### Notification Errors

Common errors and solutions:

- **"No target FIDs provided"**: Ensure FIDs are valid numbers
- **"All notifications rate limited"**: Wait 30 seconds before retrying
- **API errors**: Check Neynar API status and key validity

## Security Considerations

1. **API Key Security:**
   - Never expose Neynar API key in frontend
   - Store in environment variables only
   - Use service role key for backend

2. **User Privacy:**
   - Only send notifications to users who have opted in
   - Respect user notification preferences
   - Don't send sensitive information in notifications

3. **Rate Limiting:**
   - Prevents abuse and spam
   - Protects against API rate limits
   - Maintains good user experience

## Support

For issues or questions:
- Review this documentation
- Check Neynar documentation: [docs.neynar.com](https://docs.neynar.com)
- Review server logs
- Check Neynar dev portal analytics

