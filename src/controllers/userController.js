const userService = require('../services/userService');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * Get user details by FID
 * Checks database first, if not found, fetches from Neynar and saves to database
 * NFT ownership is checked only on first registration
 * @route GET /api/v1/get-user-details
 * @query {number} fid - Farcaster ID (required)
 * @query {number} viewerFid - Optional viewer FID for personalized data
 */
const getUserDetails = asyncHandler(async (req, res) => {
  const { fid, viewerFid } = req.query;

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

  const userDetails = await userService.getUserDetailsByFid(
    fidNumber,
    viewerFid ? parseInt(viewerFid) : null
  );

  res.status(200).json({
    success: true,
    data: userDetails,
  });
});

/**
 * Re-verify NFT ownership for a user
 * @route POST /api/v1/re-verify-nft
 * @body {number} fid - Farcaster ID (required)
 */
const reVerifyNft = asyncHandler(async (req, res) => {
  const { fid } = req.body;

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

  const result = await userService.reVerifyNftOwnership(fidNumber);

  res.status(200).json({
    success: true,
    message: 'NFT ownership re-verified successfully',
    data: result,
  });
});

module.exports = {
  getUserDetails,
  reVerifyNft,
};

