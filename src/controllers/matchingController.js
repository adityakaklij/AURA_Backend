const matchingService = require('../services/matchingService');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * Get matching users based on persona similarity
 * @route GET /api/v1/get-matches
 * @query {number} fid - Farcaster ID (required)
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Results per page (default: 10)
 */
const getMatchingUsers = asyncHandler(async (req, res) => {
  const { fid, page, limit } = req.query;

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

  const pageNumber = page ? parseInt(page) : 1;
  const limitNumber = limit ? parseInt(limit) : 10;

  if (pageNumber < 1) {
    return res.status(400).json({
      success: false,
      error: 'Page must be greater than 0',
    });
  }

  if (limitNumber < 1 || limitNumber > 50) {
    return res.status(400).json({
      success: false,
      error: 'Limit must be between 1 and 50',
    });
  }

  const result = await matchingService.getMatchingUsers(
    fidNumber,
    pageNumber,
    limitNumber
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  getMatchingUsers,
};

