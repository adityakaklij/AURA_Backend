const personaService = require('../services/personaService');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * Create or update user persona
 * Fetches user data from Neynar, analyzes with Gemini AI, and stores/updates in database
 * Skips update if persona was updated within last 24 hours (unless forceRefresh=true)
 * @route POST /api/v1/create-persona
 * @body {number} fid - Farcaster ID (required)
 * @body {boolean} forceRefresh - Force refresh even if recently updated (optional, default: false)
 */
const createOrUpdatePersona = asyncHandler(async (req, res) => {
  const { fid, forceRefresh } = req.body;

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

  const shouldForceRefresh = forceRefresh === true || forceRefresh === 'true';

  const personaData = await personaService.createOrUpdatePersona(fidNumber, shouldForceRefresh);

  // Check if update was skipped
  if (personaData.skipped) {
    res.status(200).json({
      success: true,
      message: 'Persona update skipped - recently updated',
      data: personaData,
    });
  } else {
    res.status(200).json({
      success: true,
      message: 'Persona created/updated successfully',
      data: personaData,
    });
  }
});

module.exports = {
  createOrUpdatePersona,
};

