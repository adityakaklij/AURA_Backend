const supabase = require('../config/supabase');

/**
 * Get user from database by FID
 * @param {number} fid - Farcaster ID
 * @returns {Promise<Object|null>} User data from database or null if not found
 */
const getUserByFid = async (fid) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('fid', fid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    throw new Error(`Database error: ${error.message}`);
  }
};

/**
 * Save user data to database
 * @param {Object} userData - User data from Neynar API
 * @param {Object} nftData - Optional NFT ownership data
 * @returns {Promise<Object>} Saved user data
 */
const saveUser = async (userData, nftData = {}) => {
  try {
    // Extract and structure the user data
    const user = userData;
    
    const userRecord = {
      fid: user.fid,
      username: user.username || null,
      display_name: user.display_name || null,
      pfp_url: user.pfp_url || null,
      custody_address: user.custody_address || null,
      bio_text: user.profile?.bio?.text || null,
      follower_count: user.follower_count || 0,
      following_count: user.following_count || 0,
      verifications: user.verifications || [],
      verified_addresses: user.verified_addresses || {},
      auth_addresses: user.auth_addresses || [],
      verified_accounts: user.verified_accounts || [],
      power_badge: user.power_badge || false,
      score: user.score || user.experimental?.neynar_user_score || null,
      pro_status: user.pro?.status || null,
      pro_subscribed_at: user.pro?.subscribed_at || null,
      pro_expires_at: user.pro?.expires_at || null,
      profile_data: user.profile || {},
      raw_data: user, // Store complete raw data
      nft_owned: nftData.nft_owned || false,
      nft_verified_address: nftData.nft_verified_address || null,
      nft_last_verified_at: nftData.nft_last_verified_at || null,
    };

    const { data, error } = await supabase
      .from('users')
      .upsert(userRecord, {
        onConflict: 'fid',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    throw new Error(`Failed to save user to database: ${error.message}`);
  }
};

/**
 * Update user data in database
 * @param {number} fid - Farcaster ID
 * @param {Object} userData - Updated user data from Neynar API
 * @returns {Promise<Object>} Updated user data
 */
const updateUser = async (fid, userData) => {
  try {
    const userRecord = {
      fid: userData.fid,
      username: userData.username || null,
      display_name: userData.display_name || null,
      pfp_url: userData.pfp_url || null,
      custody_address: userData.custody_address || null,
      bio_text: userData.profile?.bio?.text || null,
      follower_count: userData.follower_count || 0,
      following_count: userData.following_count || 0,
      verifications: userData.verifications || [],
      verified_addresses: userData.verified_addresses || {},
      auth_addresses: userData.auth_addresses || [],
      verified_accounts: userData.verified_accounts || [],
      power_badge: userData.power_badge || false,
      score: userData.score || userData.experimental?.neynar_user_score || null,
      pro_status: userData.pro?.status || null,
      pro_subscribed_at: userData.pro?.subscribed_at || null,
      pro_expires_at: userData.pro?.expires_at || null,
      profile_data: userData.profile || {},
      raw_data: userData,
    };

    const { data, error } = await supabase
      .from('users')
      .update(userRecord)
      .eq('fid', fid)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    throw new Error(`Failed to update user in database: ${error.message}`);
  }
};

/**
 * Update NFT ownership status for a user
 * @param {number} fid - Farcaster ID
 * @param {Object} nftData - NFT ownership data
 * @returns {Promise<Object>} Updated user data
 */
const updateNftOwnership = async (fid, nftData) => {
  try {
    const updateData = {
      nft_owned: nftData.nft_owned || false,
      nft_verified_address: nftData.nft_verified_address || null,
      nft_last_verified_at: nftData.nft_last_verified_at || null,
    };

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('fid', fid)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    throw new Error(`Failed to update NFT ownership: ${error.message}`);
  }
};

/**
 * Get persona from database by FID
 * @param {number} fid - Farcaster ID
 * @returns {Promise<Object|null>} Persona data from database or null if not found
 */
const getPersonaByFid = async (fid) => {
  try {
    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .eq('farcaster_fid', fid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    throw new Error(`Database error: ${error.message}`);
  }
};

/**
 * Save or update persona analysis in database
 * @param {number} fid - Farcaster ID
 * @param {Object} analysis - Persona analysis data
 * @param {number} castCount - Number of casts analyzed
 * @returns {Promise<Object>} Saved persona data
 */
const saveOrUpdatePersona = async (fid, analysis, castCount) => {
  try {
    const personaRecord = {
      farcaster_fid: fid,
      core_interests: analysis.core_interests || [],
      projects_protocols: analysis.projects_protocols || [],
      expertise_level: analysis.expertise_level || null,
      engagement_style: analysis.engagement_style || null,
      content_themes: analysis.content_themes || [],
      posting_frequency: analysis.posting_frequency || null,
      top_channels: analysis.top_channels || [],
      sentiment: analysis.sentiment || null,
      summary: analysis.summary || null,
      confidence_score: analysis.confidence_score || null,
      cast_count: castCount || 0,
      analyzed_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('personas')
      .upsert(personaRecord, {
        onConflict: 'farcaster_fid',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    throw new Error(`Failed to save persona to database: ${error.message}`);
  }
};

/**
 * Get all personas except the specified FID
 * @param {number} excludeFid - Farcaster ID to exclude
 * @returns {Promise<Array>} Array of persona data
 */
const getAllPersonasExcept = async (excludeFid) => {
  try {
    const { data, error } = await supabase
      .from('personas')
      .select('*')
      .neq('farcaster_fid', excludeFid)
      .order('analyzed_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    throw new Error(`Database error: ${error.message}`);
  }
};

/**
 * Get random users from database (excluding specified FIDs)
 * @param {Array<number>} excludeFids - Array of FIDs to exclude
 * @param {number} limit - Number of random users to return
 * @returns {Promise<Array>} Array of user data
 */
const getRandomUsers = async (excludeFids = [], limit = 10) => {
  try {
    let query = supabase
      .from('users')
      .select('*')
      .limit(limit * 3); // Get more than needed for randomization

    // Exclude specified FIDs
    if (excludeFids.length > 0) {
      for (const fid of excludeFids) {
        query = query.neq('fid', fid);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Shuffle array and return limited results
    const shuffled = data.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  } catch (error) {
    throw new Error(`Database error: ${error.message}`);
  }
};

/**
 * Record a user swipe (like or reject)
 * @param {number} userFid - FID of the user performing the swipe
 * @param {number} targetFid - FID of the user being swiped on
 * @param {string} action - 'like' or 'reject'
 * @returns {Promise<Object>} Swipe record
 */
const recordSwipe = async (userFid, targetFid, action) => {
  try {
    if (!['like', 'reject'].includes(action)) {
      throw new Error('Action must be either "like" or "reject"');
    }

    if (userFid === targetFid) {
      throw new Error('User cannot swipe on themselves');
    }

    const { data, error } = await supabase
      .from('user_swipes')
      .upsert(
        {
          user_fid: userFid,
          target_fid: targetFid,
          action: action,
        },
        {
          onConflict: 'user_fid,target_fid',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    throw new Error(`Failed to record swipe: ${error.message}`);
  }
};

/**
 * Get all FIDs that a user has swiped on (liked or rejected)
 * @param {number} userFid - FID of the user
 * @returns {Promise<Array>} Array of target FIDs
 */
const getSwipedUserFids = async (userFid) => {
  try {
    const { data, error } = await supabase
      .from('user_swipes')
      .select('target_fid')
      .eq('user_fid', userFid);

    if (error) {
      throw error;
    }

    return (data || []).map((swipe) => swipe.target_fid);
  } catch (error) {
    throw new Error(`Failed to get swiped users: ${error.message}`);
  }
};

/**
 * Get requests sent (users I've liked but haven't matched yet)
 * @param {number} userFid - FID of the user
 * @returns {Promise<Array>} Array of FIDs that user has liked
 */
const getRequestsSent = async (userFid) => {
  try {
    // Get all users that the current user has liked
    const { data: userLikes, error: error1 } = await supabase
      .from('user_swipes')
      .select('target_fid, created_at')
      .eq('user_fid', userFid)
      .eq('action', 'like');

    if (error1) {
      throw error1;
    }

    if (!userLikes || userLikes.length === 0) {
      return [];
    }

    const likedFids = userLikes.map((swipe) => swipe.target_fid);

    // Get mutual matches to exclude them
    const matchedFids = await getUserMatches(userFid);
    const matchedFidsSet = new Set(matchedFids);

    // Filter out matched users (only return pending requests)
    const pendingRequests = userLikes
      .filter((swipe) => !matchedFidsSet.has(swipe.target_fid))
      .map((swipe) => ({
        fid: swipe.target_fid,
        created_at: swipe.created_at,
      }));

    return pendingRequests;
  } catch (error) {
    throw new Error(`Failed to get requests sent: ${error.message}`);
  }
};

/**
 * Get requests received (users who have liked me but I haven't liked back)
 * @param {number} userFid - FID of the user
 * @returns {Promise<Array>} Array of FIDs that have liked the user
 */
const getRequestsReceived = async (userFid) => {
  try {
    // Get all users who have liked the current user
    const { data: receivedLikes, error: error1 } = await supabase
      .from('user_swipes')
      .select('user_fid, created_at')
      .eq('target_fid', userFid)
      .eq('action', 'like');

    if (error1) {
      throw error1;
    }

    if (!receivedLikes || receivedLikes.length === 0) {
      return [];
    }

    const likedByFids = receivedLikes.map((swipe) => swipe.user_fid);

    // Get mutual matches to exclude them
    const matchedFids = await getUserMatches(userFid);
    const matchedFidsSet = new Set(matchedFids);

    // Check which ones the current user has NOT liked back
    const { data: myLikes, error: error2 } = await supabase
      .from('user_swipes')
      .select('target_fid')
      .eq('user_fid', userFid)
      .eq('action', 'like')
      .in('target_fid', likedByFids);

    if (error2) {
      throw error2;
    }

    const myLikedFids = new Set((myLikes || []).map((swipe) => swipe.target_fid));

    // Filter: users who liked me, but I haven't liked back, and not matched
    const pendingRequests = receivedLikes
      .filter(
        (swipe) =>
          !myLikedFids.has(swipe.user_fid) && !matchedFidsSet.has(swipe.user_fid)
      )
      .map((swipe) => ({
        fid: swipe.user_fid,
        created_at: swipe.created_at,
      }));

    return pendingRequests;
  } catch (error) {
    throw new Error(`Failed to get requests received: ${error.message}`);
  }
};

/**
 * Get all matches (mutual likes) for a user
 * @param {number} userFid - FID of the user
 * @returns {Promise<Array>} Array of matched user FIDs
 */
const getUserMatches = async (userFid) => {
  try {
    // Get all users that the current user has liked
    const { data: userLikes, error: error1 } = await supabase
      .from('user_swipes')
      .select('target_fid')
      .eq('user_fid', userFid)
      .eq('action', 'like');

    if (error1) {
      throw error1;
    }

    if (!userLikes || userLikes.length === 0) {
      return [];
    }

    const likedFids = userLikes.map((swipe) => swipe.target_fid);

    // Check which of those users have also liked the current user
    const { data: mutualLikes, error: error2 } = await supabase
      .from('user_swipes')
      .select('user_fid')
      .in('user_fid', likedFids)
      .eq('target_fid', userFid)
      .eq('action', 'like');

    if (error2) {
      throw error2;
    }

    const matchedFids = (mutualLikes || []).map((swipe) => swipe.user_fid);

    return matchedFids;
  } catch (error) {
    throw new Error(`Failed to get user matches: ${error.message}`);
  }
};

/**
 * Check if two users have matched (mutual likes)
 * @param {number} userFid1 - First user FID
 * @param {number} userFid2 - Second user FID
 * @returns {Promise<boolean>} True if matched
 */
const checkIfMatched = async (userFid1, userFid2) => {
  try {
    // Check if user1 liked user2
    const { data: swipe1, error: error1 } = await supabase
      .from('user_swipes')
      .select('*')
      .eq('user_fid', userFid1)
      .eq('target_fid', userFid2)
      .eq('action', 'like')
      .limit(1);

    if (error1) {
      throw error1;
    }

    // Check if user2 liked user1
    const { data: swipe2, error: error2 } = await supabase
      .from('user_swipes')
      .select('*')
      .eq('user_fid', userFid2)
      .eq('target_fid', userFid1)
      .eq('action', 'like')
      .limit(1);

    if (error2) {
      throw error2;
    }

    // Both must have liked each other
    return (swipe1 || []).length > 0 && (swipe2 || []).length > 0;
  } catch (error) {
    throw new Error(`Failed to check match: ${error.message}`);
  }
};

module.exports = {
  getUserByFid,
  saveUser,
  updateUser,
  updateNftOwnership,
  getPersonaByFid,
  saveOrUpdatePersona,
  getAllPersonasExcept,
  getRandomUsers,
  recordSwipe,
  getSwipedUserFids,
  getRequestsSent,
  getRequestsReceived,
  getUserMatches,
  checkIfMatched,
};

