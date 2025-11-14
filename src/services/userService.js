const neynarClient = require('../neynarConfig');
const dbService = require('./dbService');
const nftService = require('./nftService');
const personaService = require('./personaService');

const getUserDetailsByFid = async (fid, viewerFid = null) => {
  try {
    if (!fid) {
      throw new Error('FID is required');
    }

    // Check if user exists in database
    const dbUser = await dbService.getUserByFid(fid);

    if (dbUser) {
      // Return user from database
      return {
        object: 'user',
        fid: dbUser.fid,
        username: dbUser.username,
        display_name: dbUser.display_name,
        pfp_url: dbUser.pfp_url,
        custody_address: dbUser.custody_address,
        pro: dbUser.pro_status
          ? {
              status: dbUser.pro_status,
              subscribed_at: dbUser.pro_subscribed_at,
              expires_at: dbUser.pro_expires_at,
            }
          : null,
        profile: dbUser.profile_data,
        follower_count: dbUser.follower_count,
        following_count: dbUser.following_count,
        verifications: dbUser.verifications,
        verified_addresses: dbUser.verified_addresses,
        auth_addresses: dbUser.auth_addresses,
        verified_accounts: dbUser.verified_accounts,
        power_badge: dbUser.power_badge,
        score: dbUser.score,
        nft_owned: dbUser.nft_owned || false,
        nft_verified_address: dbUser.nft_verified_address || null,
        nft_last_verified_at: dbUser.nft_last_verified_at || null,
        fromCache: true,
      };
    }

    // User not in database, fetch from Neynar
    const fids = [parseInt(fid)];
    const fetchParams = { fids };

    if (viewerFid) {
      fetchParams.viewerFid = parseInt(viewerFid);
    }

    const response = await neynarClient.fetchBulkUsers(fetchParams);

    // Extract user data from response
    // The response structure can be: { users: [...] } or direct array
    let userData = null;

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
      // Single user object returned directly
      userData = response;
    } else {
      throw new Error('User not found in Neynar API');
    }

    // Check NFT ownership only on first registration
    const nftCheckResult = await nftService.checkNftOwned(userData);

    // Save user to database with NFT ownership status
    await dbService.saveUser(userData, {
      nft_owned: nftCheckResult.owns,
      nft_verified_address: nftCheckResult.verifiedAddress,
      nft_last_verified_at: new Date().toISOString(),
    });

    // For new users, create persona in the background (non-blocking)
    // Check if persona already exists to avoid duplicate work
    const existingPersona = await dbService.getPersonaByFid(fid);
    if (!existingPersona) {
      console.log(`🔄 New user detected (FID ${fid}), creating persona in background...`);
      // Create persona in background without blocking the response
      personaService.createOrUpdatePersona(fid).catch((error) => {
        console.error(`❌ Failed to create persona for new user FID ${fid}:`, error.message);
        // Don't throw - persona creation failure shouldn't block user creation
      });
    }

    // Return user data
    return {
      ...userData,
      nft_owned: nftCheckResult.owns,
      nft_verified_address: nftCheckResult.verifiedAddress,
      fromCache: false,
    };
  } catch (error) {
    throw new Error(`Failed to fetch user details: ${error.message}`);
  }
};

/**
 * Re-verify NFT ownership for a user
 * @param {number} fid - Farcaster ID
 * @returns {Promise<Object>} Updated user with NFT ownership status
 */
const reVerifyNftOwnership = async (fid) => {
  try {
    if (!fid) {
      throw new Error('FID is required');
    }

    // Get user from database
    const dbUser = await dbService.getUserByFid(fid);

    if (!dbUser) {
      throw new Error('User not found in database');
    }

    // Get fresh user data from Neynar to check current addresses
    const fids = [parseInt(fid)];
    const response = await neynarClient.fetchBulkUsers({ fids });

    let userData = null;
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
      // If can't fetch from Neynar, use DB data
      userData = {
        fid: dbUser.fid,
        verified_addresses: dbUser.verified_addresses,
      };
    }

    // Re-verify NFT ownership
    const nftCheckResult = await nftService.reVerifyNftOwnership(userData);

    // Update user in database with new NFT status
    await dbService.updateNftOwnership(fid, {
      nft_owned: nftCheckResult.owns,
      nft_verified_address: nftCheckResult.verifiedAddress,
      nft_last_verified_at: new Date().toISOString(),
    });

    return {
      fid: parseInt(fid),
      nft_owned: nftCheckResult.owns,
      nft_verified_address: nftCheckResult.verifiedAddress,
      nft_last_verified_at: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(`Failed to re-verify NFT ownership: ${error.message}`);
  }
};

module.exports = {
  getUserDetailsByFid,
  reVerifyNftOwnership,
};
