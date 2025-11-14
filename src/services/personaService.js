const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = require('node-fetch');
const neynarClient = require('../neynarConfig');
const dbService = require('./dbService');
const nftService = require('./nftService');
const config = require('../config/env');

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * Sample casts to reduce token usage while maintaining representativeness
 */
function sampleCasts(casts, targetCount = 100) {
  if (casts.length <= targetCount) return casts;

  // Take a representative sample across the timeline
  const step = casts.length / targetCount;
  const sampled = [];

  for (let i = 0; i < targetCount; i++) {
    const index = Math.floor(i * step);
    sampled.push(casts[index]);
  }

  return sampled;
}

/**
 * Fetch latest casts for a user
 * Fetches maximum of 100 casts (latest) - exactly 1 Neynar API call
 * Includes rate limit handling with exponential backoff
 */
async function fetchAllUserCasts(fid, maxCasts = 200) {
  const allCasts = [];
  let cursor = null;
  const limit = 100; // Max per request - matches maxCasts for single API call
  const maxRetries = 3;
  let retryDelay = 1000; // Start with 1 second delay

  try {
    while (allCasts.length < maxCasts) {
      let response = null;
      let retryCount = 0;
      let requestSuccess = false;

      // Retry logic with exponential backoff for rate limits
      while (retryCount < maxRetries && !requestSuccess) {
        try {
          const requestStart = Date.now();
          
          // Build URL with query parameters
          const baseUrl = 'https://api.neynar.com/v2/farcaster/cast/search/';
          const params = new URLSearchParams({
            limit: limit.toString(),
            q: '*', // Wildcard to match all
            author_fid: fid.toString(),
            sort_type: 'algorithmic', // Sort by algorithmic Casts sorted by engagement and time
          });
          
          // Add cursor if available (for pagination)
          if (cursor) {
            params.append('cursor', cursor);
          }
          
          const url = `${baseUrl}?${params.toString()}`;
          
          // Make direct HTTP GET request to Neynar API
          const httpResponse = await fetch(url, {
            method: 'GET',
            headers: {
              'x-api-key': config.neynarApiKey,
              'x-neynar-experimental': 'false',
              'Content-Type': 'application/json',
            },
          });
          
          // Check if request was successful
          if (!httpResponse.ok) {
            const errorText = await httpResponse.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch (e) {
              errorData = { message: errorText };
            }
            
            const error = new Error(errorData.message || `HTTP ${httpResponse.status}`);
            error.status = httpResponse.status;
            error.response = { status: httpResponse.status, data: errorData };
            throw error;
          }
          
          // Parse JSON response
          response = await httpResponse.json();
          
          requestSuccess = true;
          retryDelay = 1000; // Reset delay on success
          
          // Adaptive delay based on response time
          const responseTime = Date.now() - requestStart;
          if (responseTime > 2000) {
            retryDelay = Math.max(1500, responseTime * 0.5); // Increase delay if slow
          }
        } catch (error) {
          retryCount++;
          
          // Check if it's a rate limit error (429 or similar)
          const isRateLimit = 
            error?.status === 429 || 
            error?.response?.status === 429 ||
            error?.message?.toLowerCase().includes('rate limit') ||
            error?.message?.toLowerCase().includes('too many requests');
          
          if (isRateLimit && retryCount < maxRetries) {
            console.warn(`⚠️  Rate limited for FID ${fid}, retrying in ${retryDelay}ms (attempt ${retryCount}/${maxRetries})...`);
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            retryDelay *= 2; // Exponential backoff: 1s, 2s, 4s
          } else {
            // Not a rate limit error or max retries reached
            throw error;
          }
        }
      }

      if (!response || !response.result?.casts || response.result.casts.length === 0) {
        break;
      }

      // Map to simplified interface
      const casts = response.result.casts.map((cast) => ({
        hash: cast.hash,
        text: cast.text,
        timestamp: cast.timestamp,
        author: {
          username: cast.author.username,
          fid: cast.author.fid,
          display_name: cast.author.display_name,
        },
        reactions: {
          likes_count: cast.reactions?.likes_count || 0,
          recasts_count: cast.reactions?.recasts_count || 0,
        },
        channel: cast.channel
          ? {
              id: cast.channel.id,
              name: cast.channel.name,
            }
          : undefined,
      }));

      allCasts.push(...casts);

      // Check if there's more data
      cursor = response.result.next?.cursor || null;
      if (!cursor) break;

      // Rate limiting: wait between requests (adaptive delay)
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    console.log(`✅ Fetched ${allCasts.length} casts for FID ${fid}`);
    return allCasts;
  } catch (error) {
    console.error('Error fetching casts:', error);
    const errorMessage =
      error?.response?.data?.message || error?.message || 'Unknown error';
    throw new Error(`Failed to fetch casts for FID ${fid}: ${errorMessage}`);
  }
}

/**
 * Extract user profile from user data (from Neynar API or DB)
 * @param {Object} userData - User data object
 * @returns {Object} User profile
 */
function extractUserProfile(userData) {
  return {
    fid: userData.fid,
    username: userData.username,
    display_name: userData.display_name || userData.username,
    bio: userData.profile?.bio?.text || userData.bio_text || '',
    follower_count: userData.follower_count || 0,
    following_count: userData.following_count || 0,
  };
}

/**
 * Fetch user profile information from Neynar (only if needed)
 * @param {number} fid - Farcaster ID
 * @returns {Promise<Object>} User profile
 */
async function fetchUserProfile(fid) {
  try {
    const response = await neynarClient.fetchBulkUsers({ fids: [fid] });
    const user = response.users[0];

    if (!user) {
      throw new Error(`User with FID ${fid} not found`);
    }

    return extractUserProfile(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw new Error(`Failed to fetch profile for FID ${fid}: ${error.message}`);
  }
}

/**
 * Analyze user casts using Gemini AI
 */
async function analyzeUserWithGemini(profile, casts) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.3,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  });

  // Sample casts if too many (take representative sample)
  const sampledCasts = sampleCasts(casts, 100);

  const prompt = `You are an expert at analyzing social media behavior and extracting user traits from Farcaster posts.

Analyze the following user profile and their casts to extract key behavioral traits and interests.

USER PROFILE:
- Username: ${profile.username}
- Display Name: ${profile.display_name}
- Bio: ${profile.bio}
- Followers: ${profile.follower_count}
- Following: ${profile.following_count}

CASTS (${sampledCasts.length} samples from ${casts.length} total):
${JSON.stringify(sampledCasts, null, 2)}

Extract the following information and return ONLY a valid JSON object with this exact structure:

{
  "core_interests": ["interest1", "interest2", ...] (max 5 main topics they post about),
  "projects_protocols": ["project1", "protocol1", ...] (crypto projects, protocols, or products they mention),
  "expertise_level": "beginner" | "intermediate" | "expert" (their knowledge level in crypto/tech),
  "engagement_style": "technical" | "casual" | "educational" | "promotional" | "community-focused",
  "content_themes": ["theme1", "theme2", ...] (what types of content: memes, analysis, news, etc),
  "posting_frequency": "high" | "medium" | "low",
  "top_channels": ["channel1", "channel2", ...] (channels they post in most),
  "sentiment": "positive" | "neutral" | "negative" (overall tone),
  "summary": "A 2-3 sentence summary of this user's online persona and interests",
  "confidence_score": 0.0-1.0 (how confident you are in this analysis)
}

Focus on:
1. What topics/sectors they're most interested in (DeFi, NFTs, AI, gaming, etc)
2. Which specific projects or protocols they mention or engage with
3. Their level of technical expertise
4. Their engagement patterns and style

Return ONLY the JSON object, no other text.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON response
    const analysis = JSON.parse(text);

    console.log(`✅ Analysis complete for ${profile.username}`);
    return analysis;
  } catch (error) {
    console.error('Error analyzing with Gemini:', error);
    throw new Error(`Failed to analyze user with Gemini: ${error.message}`);
  }
}

/**
 * Create or update user persona
 * @param {number} fid - Farcaster ID
 * @param {boolean} forceRefresh - Force refresh even if recently updated (default: false)
 * @returns {Promise<Object>} Persona data with analysis
 */
const createOrUpdatePersona = async (fid, forceRefresh = false) => {
  try {
    if (!fid) {
      throw new Error('FID is required');
    }

    console.log(`\n🚀 Starting persona creation/update for FID ${fid}...`);

    // Check if persona exists and was recently updated (skip if <24 hours old)
    if (!forceRefresh) {
      const existingPersona = await dbService.getPersonaByFid(fid);
      if (existingPersona && existingPersona.analyzed_at) {
        const lastAnalyzed = new Date(existingPersona.analyzed_at);
        const hoursSinceUpdate = (Date.now() - lastAnalyzed.getTime()) / (1000 * 60 * 60);
        const RECENT_THRESHOLD_HOURS = 24; // Skip if updated within last 24 hours

        if (hoursSinceUpdate < RECENT_THRESHOLD_HOURS) {
          console.log(`⏭️  Skipping persona update - updated ${hoursSinceUpdate.toFixed(1)} hours ago (threshold: ${RECENT_THRESHOLD_HOURS}h)`);
          return {
            fid,
            profile: {
              fid: existingPersona.farcaster_fid,
              username: null, // Not stored in persona
              display_name: null,
            },
            analysis: {
              core_interests: existingPersona.core_interests,
              projects_protocols: existingPersona.projects_protocols,
              expertise_level: existingPersona.expertise_level,
              engagement_style: existingPersona.engagement_style,
              content_themes: existingPersona.content_themes,
              posting_frequency: existingPersona.posting_frequency,
              top_channels: existingPersona.top_channels,
              sentiment: existingPersona.sentiment,
              summary: existingPersona.summary,
              confidence_score: existingPersona.confidence_score,
            },
            cast_count: existingPersona.cast_count,
            analyzed_at: existingPersona.analyzed_at,
            created_at: existingPersona.created_at,
            updated_at: existingPersona.updated_at,
            skipped: true,
            reason: `Recently updated ${hoursSinceUpdate.toFixed(1)} hours ago`,
          };
        }
      }
    }

    // Step 0: Ensure user exists in database and get user data
    console.log('👤 Ensuring user exists in database...');
    let dbUser = await dbService.getUserByFid(fid);
    let userData = null;
    let profile = null;
    
    if (!dbUser) {
      // User doesn't exist, fetch from Neynar and save to database
      console.log('👤 User not found in database, fetching from Neynar...');
      const fids = [parseInt(fid)];
      const response = await neynarClient.fetchBulkUsers({ fids });

      if (
        response &&
        response.users &&
        Array.isArray(response.users) &&
        response.users.length > 0
      ) {
        userData = response.users[0];
      } else if (response && Array.isArray(response) && response.length > 0) {
        userData = response[0];
      } else if (response && typeof response === 'object' && response.fid) {
        userData = response;
      } else {
        throw new Error('User not found in Neynar API');
      }

      // Check NFT ownership
      const nftCheckResult = await nftService.checkNftOwned(userData);

      // Save user to database
      dbUser = await dbService.saveUser(userData, {
        nft_owned: nftCheckResult.owns,
        nft_verified_address: nftCheckResult.verifiedAddress,
        nft_last_verified_at: new Date().toISOString(),
      });
      console.log('✅ User saved to database');
      
      // Extract profile from fetched userData (reuse, no need to fetch again)
      profile = extractUserProfile(userData);
      console.log('✅ User profile extracted from fetched data');
    } else {
      // User exists in DB, use DB data instead of fetching from Neynar
      console.log('✅ User found in database, using DB data for profile');
      
      // Reconstruct user data structure from DB for profile extraction
      userData = {
        fid: dbUser.fid,
        username: dbUser.username,
        display_name: dbUser.display_name,
        bio_text: dbUser.bio_text,
        follower_count: dbUser.follower_count,
        following_count: dbUser.following_count,
        profile: dbUser.profile_data,
      };
      
      // Extract profile from DB data (no API call needed)
      profile = extractUserProfile(userData);
    }

    // Step 2: Fetch casts
    console.log('📝 Fetching user casts...');
    const casts = await fetchAllUserCasts(fid);

    if (casts.length === 0) {
      throw new Error('No casts found for this user');
    }

    // Step 3: Analyze with Gemini
    console.log(`🤖 Analyzing ${casts.length} casts with Gemini...`);
    const analysis = await analyzeUserWithGemini(profile, casts);

    // Step 4: Store or update in database
    console.log('💾 Storing/updating persona in database...');
    const personaData = await dbService.saveOrUpdatePersona(
      fid,
      analysis,
      casts.length
    );

    console.log(`✅ Persona creation/update complete for FID ${fid}`);

    return {
      fid,
      profile,
      analysis,
      cast_count: casts.length,
      analyzed_at: personaData.analyzed_at,
      created_at: personaData.created_at,
      updated_at: personaData.updated_at,
    };
  } catch (error) {
    console.error('❌ Error during persona creation:', error);
    throw new Error(`Failed to create/update persona: ${error.message}`);
  }
};

module.exports = {
  createOrUpdatePersona,
};

