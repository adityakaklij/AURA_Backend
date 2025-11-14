const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const personaController = require('../controllers/personaController');
const matchingController = require('../controllers/matchingController');
const swipeController = require('../controllers/swipeController');
const voiceSearchController = require('../controllers/voiceSearchController');

/**
 * @route GET /get-user-details
 * @desc Get user profile details from Farcaster using Neynar API
 * Checks database first, if not found, fetches from Neynar and saves to database
 * NFT ownership is checked only on first registration
 * @query {number} fid - Farcaster ID (required)
 * @query {number} viewerFid - Optional viewer FID for personalized data
 * @access Public
 */
router.get('/get-user-details', userController.getUserDetails);

/**
 * @route POST /re-verify-nft
 * @desc Re-verify NFT ownership for a user
 * Checks all user addresses (primary and verified) for NFT ownership
 * @body {number} fid - Farcaster ID (required)
 * @access Public
 */
router.post('/re-verify-nft', userController.reVerifyNft);

/**
 * @route POST /create-persona
 * @desc Create or update user persona
 * Fetches user data from Neynar, analyzes with Gemini AI, and stores/updates in database
 * If persona already exists, it will be updated with new analysis
 * @body {number} fid - Farcaster ID (required)
 * @access Public
 */
router.post('/create-persona', personaController.createOrUpdatePersona);

/**
 * @route GET /get-matches
 * @desc Get matching users based on persona similarity
 * Returns users with similar interests, projects, and expertise level
 * Excludes users that have already been swiped on (liked or rejected)
 * @query {number} fid - Farcaster ID (required)
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Results per page (default: 10, max: 50)
 * @access Public
 */
router.get('/get-matches', matchingController.getMatchingUsers);

/**
 * @route POST /swipe
 * @desc Record a user swipe (like or reject)
 * Used by frontend to record user swipes in the matchmaking platform
 * @body {number} userFid - FID of the user performing the swipe (required)
 * @body {number} targetFid - FID of the user being swiped on (required)
 * @body {string} action - 'like' or 'reject' (required)
 * @access Public
 */
router.post('/swipe', swipeController.recordSwipe);

/**
 * @route GET /get-matches-list
 * @desc Get all matches (mutual likes/connected users) for a user
 * Returns list of users who have mutually liked each other
 * @query {number} fid - Farcaster ID (required)
 * @access Public
 */
router.get('/get-matches-list', swipeController.getUserMatches);

/**
 * @route GET /get-requests-sent
 * @desc Get requests sent (users I've liked but haven't matched yet)
 * Returns list of users the current user has liked, excluding mutual matches
 * @query {number} fid - Farcaster ID (required)
 * @access Public
 */
router.get('/get-requests-sent', swipeController.getRequestsSent);

/**
 * @route GET /get-requests-received
 * @desc Get requests received (users who have liked me but I haven't liked back)
 * Returns list of users who have liked the current user, but user hasn't liked back
 * @query {number} fid - Farcaster ID (required)
 * @access Public
 */
router.get('/get-requests-received', swipeController.getRequestsReceived);

/**
 * @route GET /get-connections
 * @desc Get all connection data (requests sent, received, and connected users)
 * Returns comprehensive connection data in a single request
 * @query {number} fid - Farcaster ID (required)
 * @access Public
 */
router.get('/get-connections', swipeController.getConnections);

/**
 * @route POST /accept-request
 * @desc Accept or reject a received request
 * Accept: like back a user who has already liked you (creates mutual match)
 * Reject: reject a user's request
 * @body {number} userFid - FID of the user handling the request (required)
 * @body {number} targetFid - FID of the user whose request is being handled (required)
 * @body {string} action - 'accept' or 'reject' (required)
 * @access Public
 */
router.post('/accept-request', swipeController.acceptRequest);

/**
 * @route GET /points
 * @desc Get current points and recent transactions for a user with pagination
 * Returns current point balance and paginated point transaction history
 * @query {number} fid - Farcaster ID (required)
 * @query {number} limit - Number of transactions per page (optional, default: 20, max: 100)
 * @query {number} page - Page number for pagination (optional, default: 1)
 * @access Public
 */
router.get('/points', swipeController.getPoints);

/**
 * @route POST /voice-search
 * @desc Search users by voice query
 * Accepts audio file, transcribes using OpenAI Whisper, extracts interests, and returns matching users
 * @body {File} audio - Audio file (multipart/form-data, max 25MB)
 * @body {number} fid - Farcaster ID of the user making the search (required)
 * @body {number} page - Page number (optional, default: 1)
 * @body {number} limit - Results per page (optional, default: 10, max: 50)
 * @access Public
 */
router.post('/voice-search', voiceSearchController.voiceSearch);

/**
 * @route POST /voice-search-text
 * @desc Search users by text transcript (alternative to audio upload)
 * Accepts text transcript, extracts interests, and returns matching users
 * @body {string} transcript - Text transcript (required)
 * @body {number} fid - Farcaster ID of the user making the search (required)
 * @body {number} page - Page number (optional, default: 1)
 * @body {number} limit - Results per page (optional, default: 10, max: 50)
 * @access Public
 */
router.post('/voice-search-text', voiceSearchController.voiceSearchWithTranscript);

module.exports = router;

