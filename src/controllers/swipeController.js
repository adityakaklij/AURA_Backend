const dbService = require('../services/dbService');
const orchidDbService = require('../services/orchidDbService');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * Record a user swipe (like or reject)
 * @route POST /api/v1/swipe
 * @body {number} userFid - FID of the user performing the swipe (required)
 * @body {number} targetFid - FID of the user being swiped on (required)
 * @body {string} action - 'like' or 'reject' (required)
 */
const recordSwipe = asyncHandler(async (req, res) => {
  const { userFid, targetFid, action } = req.body;

  if (!userFid || !targetFid || !action) {
    return res.status(400).json({
      success: false,
      error: 'userFid, targetFid, and action are required',
    });
  }

  const userFidNumber = parseInt(userFid);
  const targetFidNumber = parseInt(targetFid);

  if (isNaN(userFidNumber) || isNaN(targetFidNumber)) {
    return res.status(400).json({
      success: false,
      error: 'userFid and targetFid must be valid numbers',
    });
  }

  if (!['like', 'reject'].includes(action)) {
    return res.status(400).json({
      success: false,
      error: 'action must be either "like" or "reject"',
    });
  }

  if (userFidNumber === targetFidNumber) {
    return res.status(400).json({
      success: false,
      error: 'User cannot swipe on themselves',
    });
  }

  const swipe = await dbService.recordSwipe(
    userFidNumber,
    targetFidNumber,
    action
  );

  // Deduct 100 points when user sends a connection request (like)
  let pointsDeducted = null;
  if (action === 'like') {
    try {
      const sourceId = `swipe_${swipe.id}_${userFidNumber}_${targetFidNumber}`;
      const pointsResult = await orchidDbService.deductPoints(
        userFidNumber,
        100,
        'connection_request_sent',
        sourceId,
        {
          targetFid: targetFidNumber,
          action: 'like',
          swipeId: swipe.id,
          description: `Deducted 100 points for sending connection request to user ${targetFidNumber}`,
        }
      );
      pointsDeducted = {
        points: 100,
        previousBalance: pointsResult.previousPoints,
        newBalance: pointsResult.newBalance,
      };
    } catch (error) {
      // Log error but don't fail the swipe operation
      console.error('Error deducting points for swipe:', error.message);
      // Continue with swipe even if points deduction fails
    }
  }

  // Check if it's a match (mutual like)
  let isMatch = false;
  if (action === 'like') {
    isMatch = await dbService.checkIfMatched(userFidNumber, targetFidNumber);
  }

  res.status(200).json({
    success: true,
    message: `Swipe recorded: ${action}`,
    data: {
      swipe,
      isMatch,
      ...(pointsDeducted && { pointsDeducted }),
    },
  });
});

/**
 * Get all matches (mutual likes/connected users) for a user
 * @route GET /api/v1/get-matches-list
 * @query {number} fid - Farcaster ID (required)
 */
const getUserMatches = asyncHandler(async (req, res) => {
  const { fid } = req.query;

  if (!fid) {
    return res.status(400).json({
      success: false,
      error: 'FID is required',
    });
  }

  const fidNumber = parseInt(fid);
  if (isNaN(fidNumber)) {
    return res.status(400).json({
      success: false,
      error: 'FID must be a valid number',
    });
  }

  const matchedFids = await dbService.getUserMatches(fidNumber);

  // Get user details for matched users
  const matchedUsers = await Promise.all(
    matchedFids.map(async (matchedFid) => {
      const user = await dbService.getUserByFid(matchedFid);
      if (!user) return null;

      return {
        fid: user.fid,
        username: user.username,
        display_name: user.display_name,
        pfp_url: user.pfp_url,
        bio_text: user.bio_text,
        follower_count: user.follower_count,
        following_count: user.following_count,
        power_badge: user.power_badge,
        score: user.score,
      };
    })
  );

  const validMatches = matchedUsers.filter((user) => user !== null);

  res.status(200).json({
    success: true,
    data: {
      matches: validMatches,
      count: validMatches.length,
    },
  });
});

/**
 * Get requests sent (users I've liked but haven't matched yet)
 * @route GET /api/v1/get-requests-sent
 * @query {number} fid - Farcaster ID (required)
 */
const getRequestsSent = asyncHandler(async (req, res) => {
  const { fid } = req.query;

  if (!fid) {
    return res.status(400).json({
      success: false,
      error: 'FID is required',
    });
  }

  const fidNumber = parseInt(fid);
  if (isNaN(fidNumber)) {
    return res.status(400).json({
      success: false,
      error: 'FID must be a valid number',
    });
  }

  const requestsSent = await dbService.getRequestsSent(fidNumber);

  // Get user details for requests sent
  const users = await Promise.all(
    requestsSent.map(async (request) => {
      const user = await dbService.getUserByFid(request.fid);
      if (!user) return null;

      return {
        fid: user.fid,
        username: user.username,
        display_name: user.display_name,
        pfp_url: user.pfp_url,
        bio_text: user.bio_text,
        follower_count: user.follower_count,
        following_count: user.following_count,
        power_badge: user.power_badge,
        score: user.score,
        requested_at: request.created_at,
      };
    })
  );

  const validUsers = users.filter((user) => user !== null);

  res.status(200).json({
    success: true,
    data: {
      requests: validUsers,
      count: validUsers.length,
    },
  });
});

/**
 * Get requests received (users who have liked me but I haven't liked back)
 * @route GET /api/v1/get-requests-received
 * @query {number} fid - Farcaster ID (required)
 */
const getRequestsReceived = asyncHandler(async (req, res) => {
  const { fid } = req.query;

  if (!fid) {
    return res.status(400).json({
      success: false,
      error: 'FID is required',
    });
  }

  const fidNumber = parseInt(fid);
  if (isNaN(fidNumber)) {
    return res.status(400).json({
      success: false,
      error: 'FID must be a valid number',
    });
  }

  const requestsReceived = await dbService.getRequestsReceived(fidNumber);

  // Get user details for requests received
  const users = await Promise.all(
    requestsReceived.map(async (request) => {
      const user = await dbService.getUserByFid(request.fid);
      if (!user) return null;

      return {
        fid: user.fid,
        username: user.username,
        display_name: user.display_name,
        pfp_url: user.pfp_url,
        bio_text: user.bio_text,
        follower_count: user.follower_count,
        following_count: user.following_count,
        power_badge: user.power_badge,
        score: user.score,
        requested_at: request.created_at,
      };
    })
  );

  const validUsers = users.filter((user) => user !== null);

  res.status(200).json({
    success: true,
    data: {
      requests: validUsers,
      count: validUsers.length,
    },
  });
});

/**
 * Get all connection data (requests sent, received, and connected)
 * @route GET /api/v1/get-connections
 * @query {number} fid - Farcaster ID (required)
 */
const getConnections = asyncHandler(async (req, res) => {
  const { fid } = req.query;

  if (!fid) {
    return res.status(400).json({
      success: false,
      error: 'FID is required',
    });
  }

  const fidNumber = parseInt(fid);
  if (isNaN(fidNumber)) {
    return res.status(400).json({
      success: false,
      error: 'FID must be a valid number',
    });
  }

  // Get all three types of connections in parallel
  const [requestsSent, requestsReceived, connectedUsers] = await Promise.all([
    dbService.getRequestsSent(fidNumber),
    dbService.getRequestsReceived(fidNumber),
    dbService.getUserMatches(fidNumber),
  ]);

  // Helper function to get user details
  const getUserDetails = async (fid, createdAt = null) => {
    const user = await dbService.getUserByFid(fid);
    if (!user) return null;

    return {
      fid: user.fid,
      username: user.username,
      display_name: user.display_name,
      pfp_url: user.pfp_url,
      bio_text: user.bio_text,
      follower_count: user.follower_count,
      following_count: user.following_count,
      power_badge: user.power_badge,
      score: user.score,
      ...(createdAt && { requested_at: createdAt }),
    };
  };

  // Get user details for all
  const [sentUsers, receivedUsers, connectedUsersDetails] = await Promise.all([
    Promise.all(requestsSent.map((r) => getUserDetails(r.fid, r.created_at))),
    Promise.all(requestsReceived.map((r) => getUserDetails(r.fid, r.created_at))),
    Promise.all(connectedUsers.map((fid) => getUserDetails(fid))),
  ]);

  res.status(200).json({
    success: true,
    data: {
      requests_sent: {
        users: sentUsers.filter((u) => u !== null),
        count: sentUsers.filter((u) => u !== null).length,
      },
      requests_received: {
        users: receivedUsers.filter((u) => u !== null),
        count: receivedUsers.filter((u) => u !== null).length,
      },
      connected: {
        users: connectedUsersDetails.filter((u) => u !== null),
        count: connectedUsersDetails.filter((u) => u !== null).length,
      },
    },
  });
});

/**
 * Accept or reject a received request
 * @route POST /api/v1/accept-request
 * @body {number} userFid - FID of the user handling the request (required)
 * @body {number} targetFid - FID of the user whose request is being handled (required)
 * @body {string} action - 'accept' or 'reject' (required)
 */
const acceptRequest = asyncHandler(async (req, res) => {
  const { userFid, targetFid, action } = req.body;

  if (!userFid || !targetFid || !action) {
    return res.status(400).json({
      success: false,
      error: 'userFid, targetFid, and action are required',
    });
  }

  const userFidNumber = parseInt(userFid);
  const targetFidNumber = parseInt(targetFid);

  if (isNaN(userFidNumber) || isNaN(targetFidNumber)) {
    return res.status(400).json({
      success: false,
      error: 'userFid and targetFid must be valid numbers',
    });
  }

  if (!['accept', 'reject'].includes(action)) {
    return res.status(400).json({
      success: false,
      error: 'action must be either "accept" or "reject"',
    });
  }

  if (userFidNumber === targetFidNumber) {
    return res.status(400).json({
      success: false,
      error: 'User cannot handle request from themselves',
    });
  }

  // Verify that targetFid has actually liked userFid (request exists)
  const requestsReceived = await dbService.getRequestsReceived(userFidNumber);
  const requestExists = requestsReceived.some((req) => req.fid === targetFidNumber);

  if (!requestExists) {
    return res.status(400).json({
      success: false,
      error: 'No pending request found from this user',
    });
  }

  // Record the swipe action
  const swipeAction = action === 'accept' ? 'like' : 'reject';
  const swipe = await dbService.recordSwipe(
    userFidNumber,
    targetFidNumber,
    swipeAction
  );

  // Check if it's now a match (only for accept action)
  let isMatch = false;
  if (action === 'accept') {
    isMatch = await dbService.checkIfMatched(userFidNumber, targetFidNumber);
  }

  // Reward points when request is accepted
  let pointsRewarded = null;
  if (action === 'accept') {
    try {
      const sourceId = `connection_${swipe.id}_${userFidNumber}_${targetFidNumber}`;
      
      // Reward both users 200 points each
      const [userReward, targetReward] = await Promise.all([
        orchidDbService.addPoints(
          userFidNumber,
          200,
          'connection_request_accepted',
          sourceId,
          {
            targetFid: targetFidNumber,
            action: 'accept',
            swipeId: swipe.id,
            isMatch: isMatch,
            description: `Rewarded 200 points for accepting connection request from user ${targetFidNumber}`,
          }
        ).catch((err) => {
          console.error(`Error rewarding points to user ${userFidNumber}:`, err.message);
          return null;
        }),
        orchidDbService.addPoints(
          targetFidNumber,
          200,
          'connection_request_accepted',
          sourceId,
          {
            targetFid: userFidNumber,
            action: 'accept',
            swipeId: swipe.id,
            isMatch: isMatch,
            description: `Rewarded 200 points for connection request being accepted by user ${userFidNumber}`,
          }
        ).catch((err) => {
          console.error(`Error rewarding points to user ${targetFidNumber}:`, err.message);
          return null;
        }),
      ]);

      if (userReward || targetReward) {
        pointsRewarded = {
          userReward: userReward ? {
            fid: userFidNumber,
            points: 200,
            previousBalance: userReward.previousPoints,
            newBalance: userReward.newBalance,
          } : null,
          targetReward: targetReward ? {
            fid: targetFidNumber,
            points: 200,
            previousBalance: targetReward.previousPoints,
            newBalance: targetReward.newBalance,
          } : null,
        };
      }
    } catch (error) {
      // Log error but don't fail the accept operation
      console.error('Error rewarding points for connection:', error.message);
      // Continue with accept even if points reward fails
    }
  }

  res.status(200).json({
    success: true,
    message: `Request ${action}ed successfully`,
    data: {
      swipe,
      action,
      isMatch,
      message:
        action === 'accept'
          ? isMatch
            ? 'You are now connected!'
            : 'Request accepted. Waiting for their response.'
          : 'Request rejected.',
      ...(pointsRewarded && { pointsRewarded }),
    },
  });
});

/**
 * Get current points and recent transactions for a user with pagination
 * @route GET /api/v1/points
 * @query {number} fid - Farcaster ID (required)
 * @query {number} limit - Number of transactions to return (optional, default: 20, max: 100)
 * @query {number} page - Page number for pagination (optional, default: 1)
 */
const getPoints = asyncHandler(async (req, res) => {
  const { fid, limit, page } = req.query;

  if (!fid) {
    return res.status(400).json({
      success: false,
      error: 'FID is required',
    });
  }

  const fidNumber = parseInt(fid);
  if (isNaN(fidNumber)) {
    return res.status(400).json({
      success: false,
      error: 'FID must be a valid number',
    });
  }

  const transactionLimit = limit ? parseInt(limit) : 20;
  if (isNaN(transactionLimit) || transactionLimit < 1 || transactionLimit > 100) {
    return res.status(400).json({
      success: false,
      error: 'Limit must be a number between 1 and 100',
    });
  }

  const pageNumber = page ? parseInt(page) : 1;
  if (isNaN(pageNumber) || pageNumber < 1) {
    return res.status(400).json({
      success: false,
      error: 'Page must be a positive number',
    });
  }

  const offset = (pageNumber - 1) * transactionLimit;

  try {
    const pointsSummary = await orchidDbService.getPointsSummary(fidNumber, transactionLimit, offset);

    res.status(200).json({
      success: true,
      data: pointsSummary,
    });
  } catch (error) {
    // If profile doesn't exist in Orchid DB, return 0 points
    if (error.message.includes('Profile not found') || error.message.includes('not configured')) {
      res.status(200).json({
        success: true,
        data: {
          fid: fidNumber,
          currentPoints: 0,
          transactions: [],
          pagination: {
            total: 0,
            limit: transactionLimit,
            offset: offset,
            hasMore: false,
          },
        },
      });
    } else {
      throw error;
    }
  }
});

module.exports = {
  recordSwipe,
  getUserMatches,
  getRequestsSent,
  getRequestsReceived,
  getConnections,
  acceptRequest,
  getPoints,
};

