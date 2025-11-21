const neynarClient = require('../neynarConfig');
const dbService = require('./dbService');

/**
 * Notification Service
 * Handles sending notifications to users via Neynar Frame Notifications API
 * 
 * Rate Limits (enforced by Farcaster clients):
 * - 1 notification per 30 seconds per token
 * - 100 notifications per day per token
 * 
 * To keep notifications moderate and appropriate, we implement:
 * - Deduplication (don't send duplicate notifications)
 * - Rate limiting tracking
 * - Appropriate notification content
 */

// In-memory cache for rate limiting (in production, use Redis or database)
const notificationCache = new Map();

// Notification types
const NOTIFICATION_TYPES = {
  CONNECTION_REQUEST: 'connection_request',
  CONNECTION_ACCEPTED: 'connection_accepted',
  NEW_MESSAGE: 'new_message',
};

/**
 * Get notification cache key
 * @param {string} type - Notification type
 * @param {number} fid - User FID
 * @param {number} relatedFid - Related user FID (optional)
 * @returns {string} Cache key
 */
const getCacheKey = (type, fid, relatedFid = null) => {
  if (relatedFid) {
    return `${type}:${fid}:${relatedFid}`;
  }
  return `${type}:${fid}`;
};

/**
 * Check if notification was recently sent (rate limiting)
 * @param {string} cacheKey - Cache key
 * @param {number} cooldownSeconds - Cooldown period in seconds (default: 30)
 * @returns {boolean} True if notification can be sent
 */
const canSendNotification = (cacheKey, cooldownSeconds = 30) => {
  const cached = notificationCache.get(cacheKey);
  if (!cached) {
    return true;
  }

  const now = Date.now();
  const timeSinceLastNotification = (now - cached.timestamp) / 1000;
  
  return timeSinceLastNotification >= cooldownSeconds;
};

/**
 * Record notification in cache
 * @param {string} cacheKey - Cache key
 */
const recordNotification = (cacheKey) => {
  notificationCache.set(cacheKey, {
    timestamp: Date.now(),
  });

  // Clean up old cache entries (older than 1 hour)
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [key, value] of notificationCache.entries()) {
    if (value.timestamp < oneHourAgo) {
      notificationCache.delete(key);
    }
  }
};

/**
 * Get user display name for notifications
 * @param {number} fid - User FID
 * @returns {Promise<string>} Display name or username
 */
const getUserDisplayName = async (fid) => {
  try {
    const user = await dbService.getUserByFid(fid);
    if (!user) {
      return `User ${fid}`;
    }
    return user.display_name || user.username || `User ${fid}`;
  } catch (error) {
    console.error(`Error fetching user ${fid} for notification:`, error.message);
    return `User ${fid}`;
  }
};

/**
 * Get notification target URL based on type
 * @param {string} type - Notification type
 * @param {number} relatedFid - Related user FID
 * @returns {string} Target URL
 */
const getTargetUrl = (type, relatedFid = null) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://your-frame-domain.com';
  
  switch (type) {
    case NOTIFICATION_TYPES.CONNECTION_REQUEST:
      return `${baseUrl}/connections?tab=requests`;
    case NOTIFICATION_TYPES.CONNECTION_ACCEPTED:
      return relatedFid ? `${baseUrl}/connections/${relatedFid}` : `${baseUrl}/connections`;
    case NOTIFICATION_TYPES.NEW_MESSAGE:
      return relatedFid ? `${baseUrl}/messages/${relatedFid}` : `${baseUrl}/messages`;
    default:
      return baseUrl;
  }
};

/**
 * Send notification to user(s)
 * @param {Object} params - Notification parameters
 * @param {number|number[]} params.targetFids - Target FID(s) to notify
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body
 * @param {string} params.targetUrl - Target URL (optional)
 * @param {string} params.type - Notification type (for rate limiting)
 * @param {number} params.relatedFid - Related user FID (optional, for deduplication)
 * @returns {Promise<Object>} Notification result
 */
const sendNotification = async ({
  targetFids,
  title,
  body,
  targetUrl = null,
  type = null,
  relatedFid = null,
}) => {
  try {
    // Ensure targetFids is an array
    const fidsArray = Array.isArray(targetFids) ? targetFids : [targetFids];
    
    if (fidsArray.length === 0) {
      throw new Error('No target FIDs provided');
    }

    // Filter FIDs that can receive notifications (rate limiting)
    const fidsToNotify = [];
    for (const fid of fidsArray) {
      if (type) {
        const cacheKey = getCacheKey(type, fid, relatedFid);
        if (canSendNotification(cacheKey)) {
          fidsToNotify.push(fid);
          recordNotification(cacheKey);
        } else {
          console.log(`⏸️  Rate limit: Skipping notification to FID ${fid} (type: ${type})`);
        }
      } else {
        // If no type specified, allow notification (but still track it)
        fidsToNotify.push(fid);
      }
    }

    if (fidsToNotify.length === 0) {
      return {
        success: false,
        message: 'All notifications rate limited',
        sent: 0,
        skipped: fidsArray.length,
      };
    }

    // Prepare notification payload
    const notification = {
      title: title.substring(0, 100), // Limit title length
      body: body.substring(0, 500), // Limit body length
      target_url: targetUrl || getTargetUrl(type, relatedFid),
    };

    // Send notification via Neynar API
    // Empty targetFids array means "all users with notifications enabled"
    // We pass specific FIDs to target only those users
    const response = await neynarClient.publishFrameNotifications({
      targetFids: fidsToNotify,
      notification,
    });

    console.log(`✅ Notification sent to ${fidsToNotify.length} user(s): ${title}`);

    return {
      success: true,
      message: 'Notification sent successfully',
      sent: fidsToNotify.length,
      skipped: fidsArray.length - fidsToNotify.length,
      response,
    };
  } catch (error) {
    console.error('❌ Error sending notification:', error.message);
    
    // Don't throw error - notifications are non-critical
    return {
      success: false,
      message: error.message || 'Failed to send notification',
      sent: 0,
      skipped: Array.isArray(targetFids) ? targetFids.length : 1,
      error: error.message,
    };
  }
};

/**
 * Notify user about connection request (right swipe)
 * @param {number} fromFid - FID of user who sent the request
 * @param {number} toFid - FID of user who received the request
 * @returns {Promise<Object>} Notification result
 */
const notifyConnectionRequest = async (fromFid, toFid) => {
  try {
    const fromUserName = await getUserDisplayName(fromFid);
    
    return await sendNotification({
      targetFids: [toFid],
      title: '💌 New Connection Request',
      body: `${fromUserName} wants to connect with you!`,
      type: NOTIFICATION_TYPES.CONNECTION_REQUEST,
      relatedFid: fromFid,
    });
  } catch (error) {
    console.error('Error in notifyConnectionRequest:', error.message);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Notify users about connection accepted (mutual match)
 * @param {number} userFid1 - First user FID
 * @param {number} userFid2 - Second user FID
 * @returns {Promise<Object>} Notification result
 */
const notifyConnectionAccepted = async (userFid1, userFid2) => {
  try {
    const [user1Name, user2Name] = await Promise.all([
      getUserDisplayName(userFid1),
      getUserDisplayName(userFid2),
    ]);

    // Notify both users
    const [result1, result2] = await Promise.all([
      sendNotification({
        targetFids: [userFid1],
        title: '🎉 You\'re Connected!',
        body: `You and ${user2Name} are now connected!`,
        type: NOTIFICATION_TYPES.CONNECTION_ACCEPTED,
        relatedFid: userFid2,
      }),
      sendNotification({
        targetFids: [userFid2],
        title: '🎉 You\'re Connected!',
        body: `You and ${user1Name} are now connected!`,
        type: NOTIFICATION_TYPES.CONNECTION_ACCEPTED,
        relatedFid: userFid1,
      }),
    ]);

    return {
      success: result1.success || result2.success,
      user1: result1,
      user2: result2,
    };
  } catch (error) {
    console.error('Error in notifyConnectionAccepted:', error.message);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Notify user about new message (for future messaging feature)
 * @param {number} fromFid - FID of user who sent the message
 * @param {number} toFid - FID of user who received the message
 * @param {string} messagePreview - Preview of the message (optional)
 * @returns {Promise<Object>} Notification result
 */
const notifyNewMessage = async (fromFid, toFid, messagePreview = null) => {
  try {
    const fromUserName = await getUserDisplayName(fromFid);
    
    let body = `New message from ${fromUserName}`;
    if (messagePreview) {
      body = `${fromUserName}: ${messagePreview.substring(0, 100)}`;
    }

    return await sendNotification({
      targetFids: [toFid],
      title: '💬 New Message',
      body: body,
      type: NOTIFICATION_TYPES.NEW_MESSAGE,
      relatedFid: fromFid,
    });
  } catch (error) {
    console.error('Error in notifyNewMessage:', error.message);
    return {
      success: false,
      message: error.message,
    };
  }
};

module.exports = {
  sendNotification,
  notifyConnectionRequest,
  notifyConnectionAccepted,
  notifyNewMessage,
  NOTIFICATION_TYPES,
};

