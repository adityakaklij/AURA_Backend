const tursoClient = require('../config/turso');

/**
 * Get profile ID by Farcaster FID
 * @param {number} fid - Farcaster ID
 * @returns {Promise<number|null>} Profile ID or null if not found
 */
const getProfileIdByFid = async (fid) => {
  if (!tursoClient) {
    throw new Error('Turso client not configured');
  }

  try {
    const result = await tursoClient.execute({
      sql: 'SELECT id FROM profiles WHERE farcaster_fid = ?',
      args: [fid],
    });

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].id;
  } catch (error) {
    console.error('Error getting profile ID by FID:', error);
    throw new Error(`Failed to get profile ID: ${error.message}`);
  }
};

/**
 * Get current points for a user by FID
 * @param {number} fid - Farcaster ID
 * @returns {Promise<number>} Current total points
 */
const getCurrentPoints = async (fid) => {
  if (!tursoClient) {
    throw new Error('Turso client not configured');
  }

  try {
    const profileId = await getProfileIdByFid(fid);
    if (!profileId) {
      return 0;
    }

    const result = await tursoClient.execute({
      sql: 'SELECT total_points FROM scores WHERE profile_id = ?',
      args: [profileId],
    });

    if (result.rows.length === 0) {
      return 0;
    }

    return result.rows[0].total_points || 0;
  } catch (error) {
    console.error('Error getting current points:', error);
    throw new Error(`Failed to get current points: ${error.message}`);
  }
};

/**
 * Deduct points from a user
 * @param {number} fid - Farcaster ID
 * @param {number} points - Points to deduct (positive number)
 * @param {string} ruleKey - Rule key for the point event
 * @param {string} sourceId - Source ID (e.g., swipe ID or connection ID)
 * @param {Object} evidenceData - Optional evidence data object (will be JSON stringified)
 * @returns {Promise<Object>} Updated points and event record
 */
const deductPoints = async (fid, points, ruleKey, sourceId, evidenceData = null) => {
  if (!tursoClient) {
    throw new Error('Turso client not configured');
  }

  if (points <= 0) {
    throw new Error('Points to deduct must be positive');
  }

  try {
    const profileId = await getProfileIdByFid(fid);
    if (!profileId) {
      throw new Error(`Profile not found for FID: ${fid}`);
    }

    // Check current balance
    const currentPoints = await getCurrentPoints(fid);
    if (currentPoints < points) {
      throw new Error(`Insufficient points. Current: ${currentPoints}, Required: ${points}`);
    }

    // Start transaction
    const delta = -points; // Negative for deduction
    const createdAt = new Date().toISOString();

    // Format evidence as JSON string if evidenceData is provided
    let evidence = null;
    if (evidenceData) {
      evidence = JSON.stringify({
        fid: fid,
        ...evidenceData,
        verifiedAt: createdAt,
      });
    }

    // Insert point event
    const eventResult = await tursoClient.execute({
      sql: `
        INSERT INTO point_events (profile_id, rule_key, delta, source_id, evidence, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [profileId, ruleKey, delta, sourceId, evidence, createdAt],
    });

    // Update scores table
    await tursoClient.execute({
      sql: `
        INSERT INTO scores (profile_id, total_points)
        VALUES (?, ?)
        ON CONFLICT(profile_id) DO UPDATE SET total_points = total_points + ?
      `,
      args: [profileId, delta, delta],
    });

    const newBalance = currentPoints + delta;

    return {
      profileId,
      previousPoints: currentPoints,
      pointsDeducted: points,
      newBalance,
      eventId: eventResult.lastInsertRowid,
    };
  } catch (error) {
    console.error('Error deducting points:', error);
    throw error;
  }
};

/**
 * Add points to a user
 * @param {number} fid - Farcaster ID
 * @param {number} points - Points to add (positive number)
 * @param {string} ruleKey - Rule key for the point event
 * @param {string} sourceId - Source ID (e.g., swipe ID or connection ID)
 * @param {Object} evidenceData - Optional evidence data object (will be JSON stringified)
 * @returns {Promise<Object>} Updated points and event record
 */
const addPoints = async (fid, points, ruleKey, sourceId, evidenceData = null) => {
  if (!tursoClient) {
    throw new Error('Turso client not configured');
  }

  if (points <= 0) {
    throw new Error('Points to add must be positive');
  }

  try {
    const profileId = await getProfileIdByFid(fid);
    if (!profileId) {
      throw new Error(`Profile not found for FID: ${fid}`);
    }

    const currentPoints = await getCurrentPoints(fid);
    const delta = points; // Positive for addition
    const createdAt = new Date().toISOString();

    // Format evidence as JSON string if evidenceData is provided
    let evidence = null;
    if (evidenceData) {
      evidence = JSON.stringify({
        fid: fid,
        ...evidenceData,
        verifiedAt: createdAt,
      });
    }

    // Insert point event
    const eventResult = await tursoClient.execute({
      sql: `
        INSERT INTO point_events (profile_id, rule_key, delta, source_id, evidence, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [profileId, ruleKey, delta, sourceId, evidence, createdAt],
    });

    // Update scores table
    await tursoClient.execute({
      sql: `
        INSERT INTO scores (profile_id, total_points)
        VALUES (?, ?)
        ON CONFLICT(profile_id) DO UPDATE SET total_points = total_points + ?
      `,
      args: [profileId, delta, delta],
    });

    const newBalance = currentPoints + delta;

    return {
      profileId,
      previousPoints: currentPoints,
      pointsAdded: points,
      newBalance,
      eventId: eventResult.lastInsertRowid,
    };
  } catch (error) {
    console.error('Error adding points:', error);
    throw error;
  }
};

/**
 * Get recent point transactions for a user with pagination
 * @param {number} fid - Farcaster ID
 * @param {number} limit - Number of transactions to return (default: 20)
 * @param {number} offset - Number of transactions to skip (default: 0)
 * @returns {Promise<Object>} Object with transactions array and total count
 */
const getRecentTransactions = async (fid, limit = 20, offset = 0) => {
  if (!tursoClient) {
    throw new Error('Turso client not configured');
  }

  try {
    const profileId = await getProfileIdByFid(fid);
    if (!profileId) {
      return {
        transactions: [],
        total: 0,
        limit,
        offset,
      };
    }

    // Get total count
    const countResult = await tursoClient.execute({
      sql: 'SELECT COUNT(*) as total FROM point_events WHERE profile_id = ?',
      args: [profileId],
    });
    const total = countResult.rows[0].total || 0;

    // Get paginated transactions
    const result = await tursoClient.execute({
      sql: `
        SELECT 
          id,
          rule_key,
          delta,
          source_id,
          evidence,
          created_at
        FROM point_events
        WHERE profile_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
      args: [profileId, limit, offset],
    });

    const transactions = result.rows.map((row) => {
      // Try to parse evidence as JSON, fallback to string if it's not valid JSON
      let evidence = row.evidence;
      if (evidence) {
        try {
          evidence = JSON.parse(evidence);
        } catch (e) {
          // If it's not valid JSON, keep as string (for backward compatibility)
        }
      }

      return {
        id: row.id,
        rule_key: row.rule_key,
        delta: row.delta,
        source_id: row.source_id,
        evidence: evidence,
        created_at: row.created_at,
      };
    });

    return {
      transactions,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  } catch (error) {
    console.error('Error getting recent transactions:', error);
    throw new Error(`Failed to get recent transactions: ${error.message}`);
  }
};

/**
 * Get points and recent transactions for a user with pagination
 * @param {number} fid - Farcaster ID
 * @param {number} limit - Number of transactions to return (default: 20)
 * @param {number} offset - Number of transactions to skip (default: 0)
 * @returns {Promise<Object>} Points summary and transactions
 */
const getPointsSummary = async (fid, limit = 20, offset = 0) => {
  try {
    const [currentPoints, transactionsData] = await Promise.all([
      getCurrentPoints(fid),
      getRecentTransactions(fid, limit, offset),
    ]);

    return {
      fid,
      currentPoints,
      transactions: transactionsData.transactions,
      pagination: {
        total: transactionsData.total,
        limit: transactionsData.limit,
        offset: transactionsData.offset,
        hasMore: transactionsData.hasMore,
      },
    };
  } catch (error) {
    console.error('Error getting points summary:', error);
    throw error;
  }
};

module.exports = {
  getProfileIdByFid,
  getCurrentPoints,
  deductPoints,
  addPoints,
  getRecentTransactions,
  getPointsSummary,
};

