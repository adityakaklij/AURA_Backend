const multer = require('multer');
const voiceSearchService = require('../services/voiceSearchService');
const asyncHandler = require('../middleware/asyncHandler');

// Configure multer for in-memory file storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max file size (OpenAI Whisper limit)
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    const allowedMimeTypes = [
      'audio/webm',
      'audio/mp3',
      'audio/mpeg',
      'audio/wav',
      'audio/m4a',
      'audio/ogg',
      'audio/flac',
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`), false);
    }
  },
});

/**
 * Handle voice search endpoint
 * @route POST /api/v1/voice-search
 * @body {File} audio - Audio file (multipart/form-data)
 * @body {number} fid - Farcaster ID of the user making the search (required)
 * @body {number} page - Page number (optional, default: 1)
 * @body {number} limit - Results per page (optional, default: 10, max: 50)
 */
const voiceSearch = [
  upload.single('audio'),
  asyncHandler(async (req, res, next) => {
    // Handle multer errors
    if (req.fileValidationError) {
      return res.status(400).json({
        success: false,
        error: req.fileValidationError,
      });
    }
    const { fid, page, limit } = req.body;
    const audioFile = req.file;

    // Validate FID
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

    // Validate audio file
    if (!audioFile) {
      return res.status(400).json({
        success: false,
        error: 'Audio file is required',
      });
    }

    // Validate pagination parameters
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

    // Process voice search
    const result = await voiceSearchService.searchUsersByVoice(
      audioFile.buffer,
      audioFile.mimetype,
      fidNumber,
      pageNumber,
      limitNumber
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  }),
  // Error handler for multer
  (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File too large. Maximum size is 25MB',
        });
      }
      return res.status(400).json({
        success: false,
        error: `File upload error: ${error.message}`,
      });
    }
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message || 'File upload error',
      });
    }
    next();
  },
];

/**
 * Handle voice search with transcript (alternative endpoint)
 * @route POST /api/v1/voice-search-text
 * @body {string} transcript - Text transcript (JSON)
 * @body {number} fid - Farcaster ID of the user making the search (required)
 * @body {number} page - Page number (optional, default: 1)
 * @body {number} limit - Results per page (optional, default: 10, max: 50)
 */
const voiceSearchWithTranscript = asyncHandler(async (req, res) => {
  const { transcript, fid, page, limit } = req.body;

  // Validate FID
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

  // Validate transcript
  if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Transcript is required and must be a non-empty string',
    });
  }

  // Validate pagination parameters
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

  try {
    // Extract interests/query from transcript
    const interests = voiceSearchService.extractInterests(transcript);
    const query = voiceSearchService.parseDiscoveryQuery(transcript);
    
    // Combine all keywords for matching
    const allKeywords = [
      ...(query.chains || []),
      ...(query.protocols || []),
      ...(query.topics || []),
      ...interests,
    ];
    
    const uniqueKeywords = Array.from(new Set(allKeywords));

    if (uniqueKeywords.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          transcript,
          query,
          interests,
          matches: [],
          pagination: {
            page: pageNumber,
            limit: limitNumber,
            total: 0,
            totalPages: 0,
          },
        },
      });
    }

    // Get all personas (exclude current user and swiped users)
    const dbService = require('../services/dbService');
    const swipedFids = await dbService.getSwipedUserFids(fidNumber);
    const swipedFidsSet = new Set([fidNumber, ...swipedFids]);

    const allPersonas = (await dbService.getAllPersonasExcept(fidNumber)).filter(
      (persona) => !swipedFidsSet.has(persona.farcaster_fid)
    );

    if (allPersonas.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          transcript,
          query,
          interests,
          matches: [],
          pagination: {
            page: pageNumber,
            limit: limitNumber,
            total: 0,
            totalPages: 0,
          },
        },
      });
    }

    // Calculate match scores
    const arrayIntersection = (arr1, arr2) => {
      if (!arr1 || !arr2 || arr1.length === 0 || arr2.length === 0) return [];
      const lower1 = arr1.map(item => String(item).toLowerCase());
      const lower2 = arr2.map(item => String(item).toLowerCase());
      return arr1.filter(item => lower2.includes(String(item).toLowerCase()));
    };

    const calculateQueryMatchScore = (queryKeywords, persona) => {
      let score = 0;
      const matchingKeywords = {
        interests: [],
        projects: [],
        themes: [],
        channels: [],
      };

      const commonInterests = arrayIntersection(queryKeywords, persona.core_interests || []);
      if (commonInterests.length > 0) {
        score += (commonInterests.length / Math.max(queryKeywords.length, 1)) * 30;
        matchingKeywords.interests = commonInterests;
      }

      const commonProjects = arrayIntersection(queryKeywords, persona.projects_protocols || []);
      if (commonProjects.length > 0) {
        score += (commonProjects.length / Math.max(queryKeywords.length, 1)) * 25;
        matchingKeywords.projects = commonProjects;
      }

      const commonThemes = arrayIntersection(queryKeywords, persona.content_themes || []);
      if (commonThemes.length > 0) {
        score += (commonThemes.length / Math.max(queryKeywords.length, 1)) * 15;
        matchingKeywords.themes = commonThemes;
      }

      const commonChannels = arrayIntersection(queryKeywords, persona.top_channels || []);
      if (commonChannels.length > 0) {
        score += (commonChannels.length / Math.max(queryKeywords.length, 1)) * 5;
        matchingKeywords.channels = commonChannels;
      }

      score = Math.min(100, Math.round(score * 100) / 100);
      return { score, matchingKeywords };
    };

    const matchesWithScores = allPersonas.map((persona) => {
      const matchResult = calculateQueryMatchScore(uniqueKeywords, persona);
      return { persona, ...matchResult };
    });

    const actualMatches = matchesWithScores.filter((match) => match.score > 0);
    actualMatches.sort((a, b) => b.score - a.score);

    // Pagination
    const startIndex = (pageNumber - 1) * limitNumber;
    const endIndex = startIndex + limitNumber;
    let paginatedMatches = actualMatches.slice(startIndex, endIndex);

    // Fill with random users if needed
    if (paginatedMatches.length < limitNumber) {
      const matchedFids = new Set([
        fidNumber,
        ...swipedFids,
        ...paginatedMatches.map((m) => m.persona.farcaster_fid),
      ]);

      const neededRandom = limitNumber - paginatedMatches.length;
      const nonMatchingPersonas = matchesWithScores
        .filter((match) => match.score === 0)
        .filter((match) => !matchedFids.has(match.persona.farcaster_fid));

      const shuffledNonMatches = nonMatchingPersonas.sort(() => Math.random() - 0.5);
      const randomPersonas = shuffledNonMatches.slice(0, neededRandom);

      const randomMatches = randomPersonas.map((match) => ({
        persona: match.persona,
        score: 0,
        matchingKeywords: {
          interests: [],
          projects: [],
          themes: [],
          channels: [],
        },
      }));

      paginatedMatches = [...paginatedMatches, ...randomMatches];
    }

    // Get user profiles
    const matchedUsers = await Promise.all(
      paginatedMatches.map(async (match) => {
        const user = await dbService.getUserByFid(match.persona.farcaster_fid);
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
          match_score: match.score,
          matching_keywords: match.matchingKeywords,
          persona_summary: match.persona.summary,
          expertise_level: match.persona.expertise_level,
          engagement_style: match.persona.engagement_style,
        };
      })
    );

    const validMatches = matchedUsers.filter((user) => user !== null);
    const totalAvailable = actualMatches.length;
    const nonMatchingPersonas = matchesWithScores.filter((match) => match.score === 0);
    const totalCount = totalAvailable + nonMatchingPersonas.length;

    res.status(200).json({
      success: true,
      data: {
        transcript,
        query,
        interests,
        matches: validMatches,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNumber),
        },
      },
    });
  } catch (error) {
    throw error;
  }
});

module.exports = {
  voiceSearch,
  voiceSearchWithTranscript,
};

