# Notification System - Quick Start Guide

## ✅ Implementation Complete

The notification system has been successfully implemented! Here's what was done:

### Backend Implementation

1. **Created Notification Service** (`src/services/notificationService.js`)
   - Sends notifications via Neynar Frame Notifications API
   - Implements rate limiting (1 per 30 seconds per user)
   - Handles deduplication to prevent spam
   - Supports connection requests, matches, and messages

2. **Integrated into Swipe Controller** (`src/controllers/swipeController.js`)
   - Notifications sent when user receives connection request
   - Notifications sent when users mutually match
   - Notifications sent asynchronously (non-blocking)

### Notification Types

✅ **Connection Request** - Sent when someone right swipes you
✅ **Connection Accepted** - Sent when you mutually match with someone
⏳ **New Message** - Ready for when messaging is implemented

## 🚀 Next Steps

### 1. Environment Variables

Add to your `.env` file:

```env
FRONTEND_URL=https://your-domain.com
```

### 2. Frontend Setup

Follow the detailed guide in `docs/FRONTEND_NOTIFICATION_SETUP.md`:

1. Set up frame manifest with Neynar webhook URL
2. Install `@neynar/react` or `@farcaster/frame-sdk`
3. Wrap app with `MiniAppProvider`
4. Prompt users to add mini app
5. Handle notification clicks

### 3. Neynar Configuration

1. Get your Frame Events Webhook URL from [dev.neynar.com/app](https://dev.neynar.com/app)
2. Add it to your frame manifest: `/.well-known/farcaster.json`
3. Format: `https://api.neynar.com/f/app/<your_client_id>/event`

## 📋 Testing Checklist

- [ ] Add `FRONTEND_URL` to `.env`
- [ ] Set up frame manifest with webhook URL
- [ ] Test connection request notification
- [ ] Test connection accepted notification
- [ ] Verify notifications in Neynar dev portal
- [ ] Check server logs for notification status

## 📚 Documentation

- **Frontend Setup**: `docs/FRONTEND_NOTIFICATION_SETUP.md`
- **Implementation Details**: `docs/NOTIFICATION_IMPLEMENTATION.md`
- **Neynar Docs**: `docs/Neynar_notifications.md`

## 🔍 How It Works

1. User A swipes right on User B
   → Backend sends notification to User B: "💌 New Connection Request"

2. User B swipes right on User A (accepts)
   → Backend sends notification to both: "🎉 You're Connected!"

3. Rate limiting prevents spam (1 notification per 30 seconds per user pair)

## ⚠️ Important Notes

- Notifications are sent **asynchronously** - they won't block API responses
- Rate limiting is automatic - prevents notification spam
- Errors are logged but don't break user flows
- Users must add mini app and enable notifications to receive them

## 🐛 Troubleshooting

**Notifications not sending?**
- Check `FRONTEND_URL` is set in `.env`
- Verify Neynar API key is valid
- Check user has added mini app and enabled notifications
- Review server logs for errors

**Rate limited?**
- This is normal - wait 30 seconds between notifications
- Check logs for rate limit messages

## 📞 Support

For detailed information, see:
- `docs/FRONTEND_NOTIFICATION_SETUP.md` - Complete frontend guide
- `docs/NOTIFICATION_IMPLEMENTATION.md` - Technical details
- Neynar docs: [docs.neynar.com](https://docs.neynar.com)

