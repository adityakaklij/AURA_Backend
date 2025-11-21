const feedService = require('../services/feedService');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * Get feed of casts from connected (matched) users
 * @route GET /api/v1/feed
 * @query {number} fid - Farcaster ID of the user requesting the feed (required)
 * @query {number} limit - Maximum number of casts to return (optional, default: 25, max: 100)
 * @query {string} cursor - Pagination cursor for next page (optional)
 * @access Public
 */
const getFeed = asyncHandler(async (req, res) => {
  const { fid, limit, cursor } = req.query;

  // Validate required parameters
  if (!fid) {
    return res.status(400).json({
      success: false,
      error: 'fid is required',
    });
  }

  const fidNumber = parseInt(fid);
  if (isNaN(fidNumber)) {
    return res.status(400).json({
      success: false,
      error: 'fid must be a valid number',
    });
  }

  // Validate limit
  let limitNumber = 25; // default
  if (limit) {
    limitNumber = parseInt(limit);
    if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
      return res.status(400).json({
        success: false,
        error: 'limit must be a number between 1 and 100',
      });
    }
  }

  try {
    const feedData = await feedService.getFeed(fidNumber, {
      limit: limitNumber,
      cursor: cursor || null,
    });

    res.status(200).json({
      success: true,
      data: {
        casts: feedData.casts,
        pagination: feedData.pagination,
        metadata: feedData.metadata,
      },
    });
  } catch (error) {
    // Error handler middleware will catch this
    throw error;
  }
});

module.exports = {
  getFeed,
};

