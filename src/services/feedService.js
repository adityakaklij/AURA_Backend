const fetch = require('node-fetch');
const neynarClient = require('../neynarConfig');
const dbService = require('./dbService');
const config = require('../config/env');

/**
 * Feed Service
 * Fetches casts from connected (matched) users using Neynar Feed API
 * Optimized to minimize API calls by batching FIDs (up to 100 per call)
 */

// Maximum FIDs per API call (Neynar limit)
const MAX_FIDS_PER_CALL = 100;

/**
 * Fetch casts from multiple users using Neynar Feed API
 * Uses filter_type=fids to batch fetch casts from up to 100 users in one call
 * ALWAYS fetches maximum (100) casts to minimize API calls
 * 
 * @param {number[]} fids - Array of FIDs to fetch casts from
 * @param {number} viewerFid - Viewer FID for personalized context (optional)
 * @returns {Promise<Object>} Response with casts
 */
const fetchCastsFromFids = async (fids, viewerFid = null) => {
  try {
    if (!fids || fids.length === 0) {
      return {
        casts: [],
      };
    }

    // ALWAYS fetch maximum (100) casts per API call to minimize calls
    // Pagination will be handled on server side
    const params = {
      feed_type: 'filter',
      filter_type: 'fids',
      fids: fids.slice(0, MAX_FIDS_PER_CALL).join(','), // Limit to 100 FIDs
      limit: 100, // ALWAYS fetch max to minimize API calls
      with_recasts: true, // Include recasts
      // Note: viewer_fid is passed separately to get personalized context
      // This ensures reaction counts are accurate for the viewer
    };

    if (viewerFid) {
      params.viewer_fid = viewerFid;
    }

    // Make API call to Neynar Feed API
    // Note: Using direct fetch since neynarClient might not have this method
    const baseUrl = 'https://api.neynar.com/v2/farcaster/feed';
    const queryString = new URLSearchParams(
      Object.entries(params).reduce((acc, [key, value]) => {
        if (value !== null && value !== undefined) {
          acc[key] = value.toString();
        }
        return acc;
      }, {})
    ).toString();

    const url = `${baseUrl}?${queryString}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': config.neynarApiKey,
        'Content-Type': 'application/json',
      },
    });
    console.log('neynar is called here response');

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Neynar API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    // console.log('data', data);

    return {
      casts: data.casts || [],
    };
  } catch (error) {
    console.error('Error fetching casts from FIDs:', error.message);
    throw new Error(`Failed to fetch casts: ${error.message}`);
  }
};

/**
 * Parse timestamp from cast object
 * Handles different timestamp formats from Neynar API
 * 
 * @param {Object} cast - Cast object
 * @returns {number} Timestamp in milliseconds
 */
const parseCastTimestamp = (cast) => {
  // Try different timestamp fields
  if (cast.timestamp) {
    const ts = new Date(cast.timestamp).getTime();
    if (!isNaN(ts)) return ts;
  }
  
  if (cast.created_at) {
    const ts = new Date(cast.created_at).getTime();
    if (!isNaN(ts)) return ts;
  }
  
  // Fallback to 0 if no valid timestamp found
  return 0;
};

/**
 * Get all casts from matched users for a given user
 * IMPORTANT: Only returns casts from users who are MUTUALLY MATCHED (both users have liked each other)
 * ALWAYS fetches maximum (100) casts per API call, then paginates on server side
 * Handles batching when there are more than 100 matched users
 * 
 * @param {number} userFid - FID of the user requesting the feed
 * @param {number} limit - Maximum number of casts to return (server-side pagination)
 * @param {string} cursor - Pagination cursor (optional, for server-side pagination)
 * @returns {Promise<Object>} Response with casts, pagination info, and metadata
 */
const getConnectedUsersFeed = async (userFid, limit = 25, cursor = null) => {
  try {
    // Get all matched users (connected users)
    // getUserMatches() returns only users where BOTH have liked each other (mutual match)
    // This ensures we only show casts from truly connected users
    const matchedFids = await dbService.getUserMatches(userFid);
    
    console.log(`📊 Feed request for FID ${userFid}: Found ${matchedFids.length} matched users:`, matchedFids);

    if (matchedFids.length === 0) {
      return {
        casts: [],
        pagination: {
          hasMore: false,
          nextCursor: null,
          totalMatchedUsers: 0,
        },
        metadata: {
          matchedUsersCount: 0,
          apiCallsMade: 0,
        },
      };
    }

    let allCasts = [];
    let apiCallsMade = 0;

    // ALWAYS fetch maximum (100) casts per API call to minimize Neynar API calls
    // Pagination will be handled entirely on server side after fetching and sorting

    // If we have more than 100 matched users, we need to batch them
    if (matchedFids.length > MAX_FIDS_PER_CALL) {
      // Split FIDs into batches of 100
      const batches = [];
      for (let i = 0; i < matchedFids.length; i += MAX_FIDS_PER_CALL) {
        batches.push(matchedFids.slice(i, i + MAX_FIDS_PER_CALL));
      }

      // Fetch maximum casts (100) from each batch in parallel
      // This minimizes API calls - we get max data in one call per batch
      const batchPromises = batches.map((batch) =>
        fetchCastsFromFids(batch, userFid).catch((err) => {
          console.error(`Error fetching batch:`, err.message);
          return { casts: [] };
        })
      );

      const batchResults = await Promise.all(batchPromises);
      apiCallsMade = batches.length;

      // Merge all casts from all batches
      batchResults.forEach((result) => {
        if (result.casts && result.casts.length > 0) {
          allCasts.push(...result.casts);
        }
      });
    } else {
      // Single batch - fetch maximum (100) casts
      const result = await fetchCastsFromFids(matchedFids, userFid);
      apiCallsMade = 1;
      allCasts = result.casts || [];
    }

    // CRITICAL: Filter casts to ONLY include casts from matched users
    // Neynar Feed API might return casts from other users (embedded casts, replies, etc.)
    // We need to ensure we only return casts authored by matched users
    const matchedFidsSet = new Set(matchedFids);
    const castsBeforeFilter = allCasts.length;
    
    // Get unique author FIDs from all casts before filtering
    const authorFidsBeforeFilter = new Set(
      allCasts.map(cast => cast.author?.fid).filter(fid => fid !== undefined)
    );
    console.log(`📝 Before filtering: ${castsBeforeFilter} casts from ${authorFidsBeforeFilter.size} unique authors:`, Array.from(authorFidsBeforeFilter));
    
    allCasts = allCasts.filter((cast) => {
      // Only include casts where the author FID is in our matched users list
      const authorFid = cast.author?.fid;
      if (!authorFid) {
        return false; // Skip casts without author
      }
      
      // Check if author is in matched users list
      if (!matchedFidsSet.has(authorFid)) {
        console.log(`⚠️ Filtering out cast from non-matched user: FID ${authorFid} (cast hash: ${cast.hash?.substring(0, 10)}...)`);
        return false;
      }
      
      return true;
    });
    
    const castsAfterFilter = allCasts.length;
    const authorFidsAfterFilter = new Set(
      allCasts.map(cast => cast.author?.fid).filter(fid => fid !== undefined)
    );
    console.log(`✅ After filtering: ${castsAfterFilter} casts from ${authorFidsAfterFilter.size} matched authors:`, Array.from(authorFidsAfterFilter));

    // Sort casts by timestamp (most recent first)
    // Use proper timestamp parsing to handle different formats
    allCasts.sort((a, b) => {
      const timestampA = parseCastTimestamp(a);
      const timestampB = parseCastTimestamp(b);
      // Descending order (newest first)
      return timestampB - timestampA;
    });

    // Remove duplicates based on cast hash
    const seenHashes = new Set();
    allCasts = allCasts.filter((cast) => {
      const hash = cast.hash || cast.thread_hash;
      if (!hash || seenHashes.has(hash)) {
        return false;
      }
      seenHashes.add(hash);
      return true;
    });

    // Ensure all casts include engagement data (likes, recasts, replies counts)
    // Neynar API returns counts directly, but we ensure they're present and correct
    allCasts = allCasts.map((cast) => {
      // Ensure reactions object exists
      if (!cast.reactions) {
        cast.reactions = {
          likes: [],
          recasts: [],
          likes_count: 0,
          recasts_count: 0,
        };
      }
      
      // Handle likes count - Neynar API provides likes_count directly
      // PRIORITIZE the count from API (it's the source of truth)
      // Only use array length as fallback if count is missing
      if (cast.reactions.likes_count !== undefined && cast.reactions.likes_count !== null) {
        // Use the count from Neynar API - this is the authoritative value
        // Do NOT overwrite with array length
      } else if (Array.isArray(cast.reactions.likes)) {
        // Fallback: calculate from array if count not provided by API
        cast.reactions.likes_count = cast.reactions.likes.length;
      } else {
        // Default to 0 if neither count nor array exists
        cast.reactions.likes_count = 0;
      }
      
      // Ensure likes array exists (even if empty)
      if (!Array.isArray(cast.reactions.likes)) {
        cast.reactions.likes = [];
      }
      
      // Handle recasts count - Neynar API provides recasts_count directly
      // PRIORITIZE the count from API (it's the source of truth)
      // Only use array length as fallback if count is missing
      if (cast.reactions.recasts_count !== undefined && cast.reactions.recasts_count !== null) {
        // Use the count from Neynar API - this is the authoritative value
        // Do NOT overwrite with array length
      } else if (Array.isArray(cast.reactions.recasts)) {
        // Fallback: calculate from array if count not provided by API
        cast.reactions.recasts_count = cast.reactions.recasts.length;
      } else {
        // Default to 0 if neither count nor array exists
        cast.reactions.recasts_count = 0;
      }
      
      // Ensure recasts array exists (even if empty)
      if (!Array.isArray(cast.reactions.recasts)) {
        cast.reactions.recasts = [];
      }
      
      // Handle replies count - Neynar API provides count directly
      // PRIORITIZE the count from API (it's the source of truth)
      if (!cast.replies) {
        cast.replies = { count: 0 };
      } else if (typeof cast.replies === 'object' && cast.replies.count !== undefined && cast.replies.count !== null) {
        // Use the count from Neynar API - this is the authoritative value
        // Do NOT overwrite
      } else if (Array.isArray(cast.replies)) {
        // Fallback: calculate from array if count not provided by API
        cast.replies = { count: cast.replies.length };
      } else if (cast.replies.count === undefined || cast.replies.count === null) {
        // Default to 0 if count not provided
        cast.replies.count = 0;
      }
      
      return cast;
    });

    // Server-side pagination
    let startIndex = 0;
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString();
        const cursorData = JSON.parse(decoded);
        startIndex = cursorData.offset || 0;
      } catch (e) {
        // Invalid cursor, start from beginning
        startIndex = 0;
      }
    }

    const endIndex = startIndex + limit;
    const paginatedCasts = allCasts.slice(startIndex, endIndex);
    const finalHasMore = endIndex < allCasts.length;

    // Create next cursor
    let finalNextCursor = null;
    if (finalHasMore) {
      const cursorData = {
        offset: endIndex,
        timestamp: Date.now(),
      };
      finalNextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }

    return {
      casts: paginatedCasts,
      pagination: {
        hasMore: finalHasMore,
        nextCursor: finalNextCursor,
        totalMatchedUsers: matchedFids.length,
        castsReturned: paginatedCasts.length,
        totalCastsAvailable: allCasts.length,
      },
      metadata: {
        matchedUsersCount: matchedFids.length,
        apiCallsMade: apiCallsMade,
        batchesUsed: matchedFids.length > MAX_FIDS_PER_CALL ? Math.ceil(matchedFids.length / MAX_FIDS_PER_CALL) : 1,
        totalCastsFetched: allCasts.length,
      },
    };
  } catch (error) {
    console.error('Error in getConnectedUsersFeed:', error.message);
    throw new Error(`Failed to get connected users feed: ${error.message}`);
  }
};

/**
 * Get feed with optimized caching and batching
 * This is the main function to use for fetching the feed
 * 
 * @param {number} userFid - FID of the user requesting the feed
 * @param {Object} options - Options object
 * @param {number} options.limit - Maximum number of casts to return (default: 25, max: 100)
 * @param {string} options.cursor - Pagination cursor (optional)
 * @returns {Promise<Object>} Feed response with casts and pagination
 */
const getFeed = async (userFid, options = {}) => {
  const { limit = 25, cursor = null } = options;

  // Validate limit
  const validLimit = Math.min(Math.max(1, limit), 100);

  return await getConnectedUsersFeed(userFid, validLimit, cursor);
};

module.exports = {
  getFeed,
  getConnectedUsersFeed,
  fetchCastsFromFids,
  MAX_FIDS_PER_CALL,
};

