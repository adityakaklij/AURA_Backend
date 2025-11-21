# Frontend Notification Setup Guide

This document outlines the steps required to integrate Neynar Frame Notifications into your frontend application.

## Overview

The backend notification service is now implemented and will automatically send notifications for:
1. **Connection Requests** - When someone right swipes (likes) a user
2. **Connection Accepted** - When two users mutually match (both swipe right)
3. **New Messages** - When a connected user sends a message (ready for future messaging feature)

## Prerequisites

1. Neynar Developer Account - Sign up at [neynar.com](https://neynar.com)
2. Neynar App created with Client ID
3. Frontend application running on a domain (required for mini app manifest)

## Step 1: Configure Mini App Manifest

### 1.1 Get Your Neynar Webhook URL

1. Navigate to [dev.neynar.com/app](https://dev.neynar.com/app)
2. Click on your app
3. Copy the **Frame Events Webhook URL** (format: `https://api.neynar.com/f/app/<your_client_id>/event`)

### 1.2 Update Your Frame Manifest

Your frame manifest must be accessible at: `https://your-domain.com/.well-known/farcaster.json`

**Example manifest structure:**

```json
{
  "accountAssociation": {
    "header": "your-header-value",
    "payload": "your-payload-value",
    "signature": "your-signature-value"
  },
  "frame": {
    "version": "4.2.0",
    "name": "Your App Name",
    "iconUrl": "https://your-domain.com/icon.png",
    "splashImageUrl": "https://your-domain.com/splash.png",
    "splashBackgroundColor": "#f7f7f7",
    "homeUrl": "https://your-domain.com",
    "webhookUrl": "https://api.neynar.com/f/app/<your_client_id>/event"
  }
}
```

**Important:** The `webhookUrl` field must be set to your Neynar Frame Events Webhook URL.

### 1.3 Manifest Caching

Farcaster clients may cache your manifest. To force a refresh in Warpcast:
- Go to Settings > Developer Tools > Domains
- Enter your Frame URL
- Click "Check domain status" to force refresh

## Step 2: Install Required Dependencies

### Option A: Using @neynar/react (Recommended)

```bash
npm install @neynar/react
```

### Option B: Using Frame SDK Directly

```bash
yarn add @farcaster/frame-sdk
```

## Step 3: Set Up MiniAppProvider

### 3.1 Wrap Your App with MiniAppProvider

```javascript
// App.js or _app.js (Next.js)
import { MiniAppProvider } from '@neynar/react';

export default function App() {
  return (
    <MiniAppProvider>
      {/* Your app components */}
    </MiniAppProvider>
  );
}
```

## Step 4: Prompt Users to Add Mini App

### 4.1 Using @neynar/react Hook

```javascript
import { useMiniApp } from '@neynar/react';

export default function HomePage() {
  const { isSDKLoaded, addMiniApp, context } = useMiniApp();

  const handleAddMiniApp = async () => {
    if (!isSDKLoaded) {
      console.log('SDK not loaded yet');
      return;
    }
    
    const result = await addMiniApp();
    
    if (result.added) {
      if (result.notificationDetails) {
        console.log('Mini app added with notifications enabled');
        console.log('Notification token:', result.notificationDetails.token);
        // Optionally save token to your backend for tracking
      } else {
        console.log('Mini app added but notifications not enabled');
      }
    } else {
      console.log('Failed to add mini app:', result.reason);
      // result.reason can be: 'invalid_domain_manifest' or 'rejected_by_user'
    }
  };

  // Check if mini app is already added
  const isAdded = context?.added || false;
  const hasNotifications = context?.notificationDetails !== undefined;

  return (
    <div>
      {!isAdded && (
        <button onClick={handleAddMiniApp}>
          Add Mini App
        </button>
      )}
      
      {isAdded && !hasNotifications && (
        <div>
          <p>Mini app added! Enable notifications to receive updates.</p>
          <button onClick={handleAddMiniApp}>
            Enable Notifications
          </button>
        </div>
      )}
      
      {isAdded && hasNotifications && (
        <p>✅ Mini app added with notifications enabled</p>
      )}
    </div>
  );
}
```

### 4.2 Using Frame SDK Directly

```typescript
import sdk from "@farcaster/frame-sdk";

const result = await sdk.actions.addFrame();

if (result.added && result.notificationDetails) {
  console.log('Notification token:', result.notificationDetails.token);
}
```

## Step 5: Handle Notification Clicks

When users click on notifications, they will be directed to the `target_url` specified in the notification. The backend automatically sets appropriate URLs:

- **Connection Requests**: `/connections?tab=requests`
- **Connection Accepted**: `/connections/{fid}` or `/connections`
- **New Messages**: `/messages/{fid}` or `/messages`

### 5.1 Handle Deep Links

```javascript
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation'; // Next.js
// or use useSearchParams from react-router-dom

export default function ConnectionsPage() {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    // Check if user came from notification
    const tab = searchParams.get('tab');
    if (tab === 'requests') {
      // Show requests tab
      setActiveTab('requests');
    }
  }, [searchParams]);
}
```

### 5.2 Handle User-Specific Routes

```javascript
// /connections/[fid].js or similar
import { useRouter } from 'next/router';

export default function ConnectionDetailPage() {
  const router = useRouter();
  const { fid } = router.query;
  
  // Load connection details for the specific user
  useEffect(() => {
    if (fid) {
      fetchConnectionDetails(fid);
    }
  }, [fid]);
}
```

## Step 6: Environment Variables

Add the following environment variable to your frontend:

```env
# Frontend URL (used for notification target URLs)
NEXT_PUBLIC_FRONTEND_URL=https://your-domain.com
# or
REACT_APP_FRONTEND_URL=https://your-domain.com
```

**Important:** Update the backend `.env` file with the same URL:

```env
FRONTEND_URL=https://your-domain.com
```

## Step 7: Testing Notifications

### 7.1 Test Connection Request Notification

1. User A swipes right on User B
2. User B should receive a notification: "💌 New Connection Request - [User A] wants to connect with you!"

### 7.2 Test Connection Accepted Notification

1. User A swipes right on User B (User B receives notification)
2. User B swipes right on User A (accepts request)
3. Both users should receive notification: "🎉 You're Connected! - You and [Other User] are now connected!"

### 7.3 Verify Notifications in Dev Portal

1. Go to [dev.neynar.com](https://dev.neynar.com)
2. Navigate to your app
3. Click the "Mini App" tab
4. View notification analytics and history

## Step 8: Notification Best Practices

### 8.1 User Experience

- **Don't spam**: The backend implements rate limiting (1 notification per 30 seconds per user)
- **Clear messaging**: Notifications have clear titles and bodies
- **Actionable**: Each notification links to the relevant page

### 8.2 Handling Notification States

```javascript
// Check if user has notifications enabled
const { context } = useMiniApp();
const hasNotifications = context?.notificationDetails !== undefined;

// Show appropriate UI based on notification state
if (!hasNotifications) {
  // Show prompt to enable notifications
}
```

### 8.3 Notification Preferences (Future Enhancement)

Consider adding user preferences for:
- Notification types (connection requests, messages, etc.)
- Quiet hours
- Frequency limits

## Step 9: Troubleshooting

### Issue: Notifications not being received

**Check:**
1. Mini app manifest has correct `webhookUrl`
2. User has added the mini app
3. User has enabled notifications
4. Backend `FRONTEND_URL` is set correctly
5. Check Neynar dev portal for notification status

### Issue: "invalid_domain_manifest" error

**Solutions:**
1. Verify manifest is accessible at `/.well-known/farcaster.json`
2. Check manifest JSON is valid
3. Ensure `webhookUrl` is correct
4. Force refresh manifest cache in Warpcast

### Issue: Notifications rate limited

**This is expected behavior:**
- Rate limit: 1 notification per 30 seconds per user
- Daily limit: 100 notifications per user
- The backend automatically handles rate limiting

## Step 10: Future Enhancements

### 10.1 Message Notifications

When you implement messaging, the backend is ready to send notifications:

```javascript
// Backend will automatically call:
notificationService.notifyNewMessage(fromFid, toFid, messagePreview);
```

### 10.2 Custom Notification Types

You can extend the notification service to support:
- Profile views
- New matches
- Special events
- Promotional notifications (use sparingly)

## API Reference

### Backend Notification Endpoints

The backend automatically sends notifications. No additional API calls needed from frontend.

### Notification Types

1. **CONNECTION_REQUEST** - Sent when user receives a right swipe
2. **CONNECTION_ACCEPTED** - Sent when two users mutually match
3. **NEW_MESSAGE** - Sent when user receives a message (ready for future use)

## Support

For issues or questions:
1. Check Neynar documentation: [docs.neynar.com](https://docs.neynar.com)
2. Review backend logs for notification errors
3. Check Neynar dev portal for notification analytics

## Summary Checklist

- [ ] Neynar app created with Client ID
- [ ] Frame manifest created with `webhookUrl` set
- [ ] Manifest accessible at `/.well-known/farcaster.json`
- [ ] `@neynar/react` or `@farcaster/frame-sdk` installed
- [ ] `MiniAppProvider` wrapping app
- [ ] User prompt to add mini app implemented
- [ ] Notification click handlers implemented
- [ ] `FRONTEND_URL` environment variable set
- [ ] Backend `FRONTEND_URL` environment variable set
- [ ] Tested connection request notifications
- [ ] Tested connection accepted notifications
- [ ] Verified notifications in Neynar dev portal

