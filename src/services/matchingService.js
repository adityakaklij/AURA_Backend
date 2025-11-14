const dbService = require('./dbService');

/**
 * Calculate intersection of two arrays (case-insensitive)
 */
function arrayIntersection(arr1, arr2) {
  if (!arr1 || !arr2 || arr1.length === 0 || arr2.length === 0) {
    return [];
  }
  
  const lower1 = arr1.map(item => String(item).toLowerCase());
  const lower2 = arr2.map(item => String(item).toLowerCase());
  
  return arr1.filter(item => 
    lower2.includes(String(item).toLowerCase())
  );
}

/**
 * Calculate match score between two personas
 * @param {Object} userPersona - Current user's persona
 * @param {Object} matchPersona - Potential match's persona
 * @returns {Object} Match score and matching keywords
 */
function calculateMatchScore(userPersona, matchPersona) {
  let score = 0;
  const matchingKeywords = {
    interests: [],
    projects: [],
    themes: [],
    channels: [],
  };

  // Core interests match (weight: 30%)
  const commonInterests = arrayIntersection(
    userPersona.core_interests || [],
    matchPersona.core_interests || []
  );
  if (commonInterests.length > 0) {
    const interestScore = (commonInterests.length / Math.max(
      (userPersona.core_interests || []).length,
      (matchPersona.core_interests || []).length,
      1
    )) * 30;
    score += interestScore;
    matchingKeywords.interests = commonInterests;
  }

  // Projects/Protocols match (weight: 25%)
  const commonProjects = arrayIntersection(
    userPersona.projects_protocols || [],
    matchPersona.projects_protocols || []
  );
  if (commonProjects.length > 0) {
    const projectScore = (commonProjects.length / Math.max(
      (userPersona.projects_protocols || []).length,
      (matchPersona.projects_protocols || []).length,
      1
    )) * 25;
    score += projectScore;
    matchingKeywords.projects = commonProjects;
  }

  // Expertise level match (weight: 15%)
  if (userPersona.expertise_level && matchPersona.expertise_level) {
    if (userPersona.expertise_level === matchPersona.expertise_level) {
      score += 15;
    } else {
      // Partial match for adjacent levels
      const levels = ['beginner', 'intermediate', 'expert'];
      const userLevel = levels.indexOf(userPersona.expertise_level);
      const matchLevel = levels.indexOf(matchPersona.expertise_level);
      if (Math.abs(userLevel - matchLevel) === 1) {
        score += 7.5;
      }
    }
  }

  // Engagement style match (weight: 10%)
  if (userPersona.engagement_style && matchPersona.engagement_style) {
    if (userPersona.engagement_style === matchPersona.engagement_style) {
      score += 10;
    }
  }

  // Content themes match (weight: 15%)
  const commonThemes = arrayIntersection(
    userPersona.content_themes || [],
    matchPersona.content_themes || []
  );
  if (commonThemes.length > 0) {
    const themeScore = (commonThemes.length / Math.max(
      (userPersona.content_themes || []).length,
      (matchPersona.content_themes || []).length,
      1
    )) * 15;
    score += themeScore;
    matchingKeywords.themes = commonThemes;
  }

  // Top channels match (weight: 5%)
  const commonChannels = arrayIntersection(
    userPersona.top_channels || [],
    matchPersona.top_channels || []
  );
  if (commonChannels.length > 0) {
    const channelScore = (commonChannels.length / Math.max(
      (userPersona.top_channels || []).length,
      (matchPersona.top_channels || []).length,
      1
    )) * 5;
    score += channelScore;
    matchingKeywords.channels = commonChannels;
  }

  // Normalize score to 0-100
  score = Math.min(100, Math.round(score * 100) / 100);

  return {
    score,
    matchingKeywords,
  };
}

/**
 * Get matching users based on persona similarity
 * @param {number} fid - Farcaster ID of the user
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Number of results per page (default: 10)
 * @returns {Promise<Object>} Matching users with pagination
 */
const getMatchingUsers = async (fid, page = 1, limit = 10) => {
  try {
    if (!fid) {
      throw new Error('FID is required');
    }

    // Get user's persona
    const userPersona = await dbService.getPersonaByFid(fid);
    if (!userPersona) {
      throw new Error('User persona not found. Please create persona first.');
    }

    // Get all FIDs that the user has already swiped on (liked or rejected)
    const swipedFids = await dbService.getSwipedUserFids(fid);
    const swipedFidsSet = new Set(swipedFids);

    // Get all other personas (exclude current user and already swiped users)
    const allPersonas = (await dbService.getAllPersonasExcept(fid)).filter(
      (persona) => !swipedFidsSet.has(persona.farcaster_fid)
    );

    if (allPersonas.length === 0) {
      return {
        matches: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    // Calculate match scores for all personas
    const matchesWithScores = allPersonas.map((persona) => {
      const matchResult = calculateMatchScore(userPersona, persona);
      return {
        persona,
        ...matchResult,
      };
    });

    // Filter to only include users with match score > 0 (actual matches)
    const actualMatches = matchesWithScores.filter((match) => match.score > 0);

    // Sort by match score (descending)
    actualMatches.sort((a, b) => b.score - a.score);

    // Pagination for actual matches
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    let paginatedMatches = actualMatches.slice(startIndex, endIndex);

    // If we don't have enough matches (or no matches at all), fill with random users
    if (paginatedMatches.length < limit) {
      const matchedFids = new Set([
        fid,
        ...swipedFids,
        ...paginatedMatches.map((m) => m.persona.farcaster_fid),
      ]);

      // Calculate how many random users we need
      const neededRandom = limit - paginatedMatches.length;

      // Get personas that are not actual matches (score = 0) and not already included
      const nonMatchingPersonas = matchesWithScores
        .filter((match) => match.score === 0)
        .filter((match) => !matchedFids.has(match.persona.farcaster_fid));

      // Shuffle and take needed amount
      const shuffledNonMatches = nonMatchingPersonas.sort(() => Math.random() - 0.5);
      const randomPersonas = shuffledNonMatches.slice(0, neededRandom);

      // Add random users as matches (with score 0 to indicate they're not matched by similarity)
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

    // Get user profiles for matched personas
    const matchedUsers = await Promise.all(
      paginatedMatches.map(async (match) => {
        const user = await dbService.getUserByFid(match.persona.farcaster_fid);
        if (!user) {
          return null;
        }

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

    // Filter out null values (users that don't exist)
    const validMatches = matchedUsers.filter((user) => user !== null);

    // Calculate total count
    // Total available = actual matches + non-matching personas (for random selection)
    const totalAvailable = actualMatches.length;
    const nonMatchingPersonas = matchesWithScores.filter((match) => match.score === 0);
    const totalRandom = nonMatchingPersonas.length;
    const totalCount = totalAvailable + totalRandom;

    return {
      matches: validMatches,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  } catch (error) {
    throw new Error(`Failed to get matching users: ${error.message}`);
  }
};

module.exports = {
  getMatchingUsers,
};



// Matching algorithm that calculates similarity scores based on:
// Core Interests (30% weight)
// Projects/Protocols (25% weight)
// Expertise Level (15% weight)
// Content Themes (15% weight)
// Engagement Style (10% weight)
// Top Channels (5% weight)
// Returns matching keywords for each category
// Sorts results by match score (highest first)
// Implements pagination (10 users per page by default)