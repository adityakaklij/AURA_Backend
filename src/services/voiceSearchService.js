const fetch = require('node-fetch');
const FormData = require('form-data');
const config = require('../config/env');
const dbService = require('./dbService');
const matchingService = require('./matchingService');

// Comprehensive crypto vocabulary with phonetic variations
const CRYPTO_VOCABULARY = {
  // Blockchains & Layer 1s
  chains: {
    "ethereum": ["ethereum", "ether", "eth", "etherium", "ethernum"],
    "bitcoin": ["bitcoin", "btc", "bit coin"],
    "solana": ["solana", "sol", "sollana"],
    "base": ["base", "base chain", "basechain"],
    "polygon": ["polygon", "matic", "polygone"],
    "arbitrum": ["arbitrum", "arb", "arbitron"],
    "optimism": ["optimism", "op", "optimistic"],
    "avalanche": ["avalanche", "avax", "avalanch"],
    "bsc": ["bsc", "binance smart chain", "bnb chain", "binance"],
    "polkadot": ["polkadot", "dot", "polka dot"],
    "cardano": ["cardano", "ada"],
    "cosmos": ["cosmos", "atom"],
    "near": ["near", "near protocol"],
    "aptos": ["aptos", "apt"],
    "sui": ["sui", "sui network"],
  },
  
  // Protocols & DeFi
  protocols: {
    "defi": ["defi", "decentralized finance", "de fi"],
    "nft": ["nft", "nfts", "non fungible", "non-fungible"],
    "dao": ["dao", "daos", "decentralized autonomous"],
    "dex": ["dex", "decentralized exchange"],
    "uniswap": ["uniswap", "uni", "uniswape"],
    "aave": ["aave", "ave", "aava"],
    "compound": ["compound", "comp"],
    "makerdao": ["maker", "makerdao", "maker dao"],
    "curve": ["curve", "curve finance", "crv"],
    "pancakeswap": ["pancakeswap", "pancake", "cake"],
    "opensea": ["opensea", "open sea"],
    "blur": ["blur", "blur marketplace"],
    "lido": ["lido", "steth", "liquid staking"],
    "eigenlayer": ["eigenlayer", "eigen layer", "restaking"],
    "aevo": ["aevo", "derivatives"],
  },
  
  // Concepts & Technologies
  concepts: {
    "smart contracts": ["smart contract", "smart contracts", "contract"],
    "web3": ["web3", "web 3", "web three"],
    "blockchain": ["blockchain", "block chain"],
    "crypto": ["crypto", "cryptocurrency", "cryptocurrencies"],
    "staking": ["staking", "stake", "staked"],
    "yield farming": ["yield farming", "yield farm", "farming"],
    "liquidity": ["liquidity", "liquid", "liquidity provider"],
    "governance": ["governance", "voting", "proposal"],
    "minting": ["minting", "mint", "minted"],
    "mining": ["mining", "mine", "miner"],
    "validator": ["validator", "validation", "validating"],
    "consensus": ["consensus", "proof of stake", "proof of work", "pos", "pow"],
    "layer 2": ["layer 2", "layer two", "l2", "scaling"],
    "rollup": ["rollup", "rollups", "zk rollup", "optimistic rollup"],
    "bridge": ["bridge", "cross chain", "cross-chain"],
    "wallet": ["wallet", "wallets", "cold storage"],
    "oracle": ["oracle", "chainlink", "price feed"],
    "token": ["token", "tokens", "erc20", "erc-20"],
    "metaverse": ["metaverse", "meta verse", "virtual world"],
    "gamefi": ["gamefi", "game fi", "play to earn"],
    "socialfi": ["socialfi", "social fi", "social finance"],
  },
  
  // Trading & Finance
  trading: {
    "trading": ["trading", "trade", "trader"],
    "hodl": ["hodl", "hold", "holding"],
    "fomo": ["fomo", "fear of missing out"],
    "fud": ["fud", "fear uncertainty doubt"],
    "bull market": ["bull market", "bull", "bullish"],
    "bear market": ["bear market", "bear", "bearish"],
    "whale": ["whale", "whales", "large holder"],
    "ath": ["ath", "all time high", "all-time high"],
    "dca": ["dca", "dollar cost averaging"],
    "roi": ["roi", "return on investment"],
    "market cap": ["market cap", "market capitalization", "mcap"],
    "liquidity pool": ["liquidity pool", "lp", "pool"],
    "arbitrage": ["arbitrage", "arbitrage trading"],
    "leverage": ["leverage", "leveraged", "margin"],
    "futures": ["futures", "perpetual", "perps"],
    "options": ["options", "calls", "puts"],
  },
  
  // Roles & Positions
  roles: {
    "developer": ["developer", "dev", "engineer", "programmer"],
    "founder": ["founder", "co-founder", "cofounder", "creator"],
    "ceo": ["ceo", "chief executive"],
    "cto": ["cto", "chief technology officer"],
    "designer": ["designer", "design", "ux", "ui"],
    "product manager": ["product manager", "pm", "product"],
    "marketer": ["marketer", "marketing", "growth"],
    "community": ["community", "community manager", "mod"],
    "investor": ["investor", "vc", "venture capital"],
    "trader": ["trader", "trading", "day trader"],
    "builder": ["builder", "building", "buidl"],
    "researcher": ["researcher", "research", "analyst"],
  },
  
  // Slang & Culture
  slang: {
    "gm": ["gm", "good morning"],
    "wagmi": ["wagmi", "we're all gonna make it"],
    "ngmi": ["ngmi", "not gonna make it"],
    "degen": ["degen", "degenerate"],
    "ape": ["ape", "aping", "aped"],
    "moon": ["moon", "mooning", "to the moon"],
    "ser": ["ser", "sir"],
    "fren": ["fren", "friend"],
    "rekt": ["rekt", "wrecked", "liquidated"],
    "diamond hands": ["diamond hands", "hodler"],
    "paper hands": ["paper hands", "weak hands"],
    "wen": ["wen", "when"],
  }
};

/**
 * Simple Levenshtein distance for typo detection
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(0));
  
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Extract interests from natural speech with enhanced crypto vocabulary
 */
function extractInterests(transcript) {
  const text = transcript.toLowerCase();
  const interests = new Set();

  // Check all vocabulary categories and use CANONICAL forms for matched words
  Object.entries(CRYPTO_VOCABULARY).forEach(([category, terms]) => {
    Object.entries(terms).forEach(([canonical, variations]) => {
      let foundMatch = false;
      
      // Check multi-word phrases first (more specific)
      variations.forEach(variant => {
        if (variant.includes(" ")) {
          const regex = new RegExp(`\\b${variant.replace(/\s+/g, "\\s+")}\\b`, "i");
          if (regex.test(text)) {
            foundMatch = true;
          }
        } else {
          // Single word - must match as whole word
          const regex = new RegExp(`\\b${variant}\\b`, "i");
          if (regex.test(text)) {
            foundMatch = true;
          }
        }
      });
      
      if (foundMatch) {
        // Use canonical form, properly capitalized
        const formatted = canonical.split(" ").map(w => 
          w.charAt(0).toUpperCase() + w.slice(1)
        ).join(" ");
        interests.add(formatted);
      }
    });
  });

  // Additional hobby/personal interests (non-crypto)
  const hobbies = [
    "music", "travel", "traveling", "food", "cooking", "fitness", "gym", "yoga", "running",
    "art", "photography", "gaming", "reading", "writing", "hiking", "cycling", "swimming",
    "coffee", "wine", "movies", "netflix", "anime", "sports", "basketball", "football", "soccer"
  ];
  hobbies.forEach(hobby => {
    const regex = new RegExp(`\\b${hobby}\\b`, "i");
    const match = transcript.match(regex);
    if (match) {
      const actualWord = match[0];
      const formatted = actualWord === "traveling" || actualWord === "Traveling" 
        ? "Travel" 
        : actualWord.charAt(0).toUpperCase() + actualWord.slice(1).toLowerCase();
      interests.add(formatted);
    }
  });

  return Array.from(interests);
}

/**
 * Parse discovery query into structured format
 */
function parseDiscoveryQuery(transcript) {
  const text = transcript.toLowerCase();
  const query = {
    rawQuery: transcript,
    keywords: []
  };

  const foundChains = [];
  const foundProtocols = [];
  const foundTopics = [];

  // Extract chains
  Object.entries(CRYPTO_VOCABULARY.chains).forEach(([canonical, variations]) => {
    let matched = false;
    
    variations.forEach(variant => {
      if (variant.includes(" ")) {
        const regex = new RegExp(`\\b${variant.replace(/\s+/g, "\\s+")}\\b`, "i");
        if (regex.test(text)) {
          matched = true;
        }
      } else {
        const regex = new RegExp(`\\b${variant}\\b`, "i");
        if (regex.test(text)) {
          matched = true;
        }
      }
    });
    
    if (matched) {
      const formatted = canonical.split(" ").map(w => 
        w.charAt(0).toUpperCase() + w.slice(1)
      ).join(" ");
      foundChains.push(formatted);
    }
  });

  // Extract protocols
  Object.entries(CRYPTO_VOCABULARY.protocols).forEach(([canonical, variations]) => {
    let matched = false;
    
    variations.forEach(variant => {
      if (variant.includes(" ")) {
        const regex = new RegExp(`\\b${variant.replace(/\s+/g, "\\s+")}\\b`, "i");
        if (regex.test(text)) {
          matched = true;
        }
      } else {
        const regex = new RegExp(`\\b${variant}\\b`, "i");
        if (regex.test(text)) {
          matched = true;
        }
      }
    });
    
    if (matched) {
      const formatted = canonical.split(" ").map(w => 
        w.charAt(0).toUpperCase() + w.slice(1)
      ).join(" ");
      foundProtocols.push(formatted);
    }
  });

  // Extract roles and concepts as topics
  const topicCategories = [CRYPTO_VOCABULARY.roles, CRYPTO_VOCABULARY.concepts, CRYPTO_VOCABULARY.trading];
  topicCategories.forEach(category => {
    Object.entries(category).forEach(([canonical, variations]) => {
      let matched = false;
      
      variations.forEach(variant => {
        if (variant.includes(" ")) {
          const regex = new RegExp(`\\b${variant.replace(/\s+/g, "\\s+")}\\b`, "i");
          if (regex.test(text)) {
            matched = true;
          }
        } else {
          const regex = new RegExp(`\\b${variant}\\b`, "i");
          if (regex.test(text)) {
            matched = true;
          }
        }
      });
      
      if (matched) {
        const formatted = canonical.split(" ").map(w => 
          w.charAt(0).toUpperCase() + w.slice(1)
        ).join(" ");
        foundTopics.push(formatted);
      }
    });
  });

  if (foundChains.length > 0) query.chains = foundChains;
  if (foundProtocols.length > 0) query.protocols = foundProtocols;
  if (foundTopics.length > 0) query.topics = foundTopics;

  // Extract keywords - combine all found terms
  const allFoundTerms = [...foundChains, ...foundProtocols, ...foundTopics];
  query.keywords = Array.from(new Set(allFoundTerms));

  return query;
}

/**
 * Transcribe audio using OpenAI Whisper API
 */
async function transcribeAudio(audioBuffer, mimeType = 'audio/webm') {
  try {
    if (!config.openaiApiKey) {
      throw new Error('OPENAI_API_KEY not set in environment variables');
    }

    // Create FormData for OpenAI API
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: 'audio.webm',
      contentType: mimeType,
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openaiApiKey}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI Whisper API error:', errorData);
      throw new Error(`Failed to transcribe audio: ${response.status}`);
    }

    const data = await response.json();
    return data.text || '';
  } catch (error) {
    console.error('Transcription error:', error);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}

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
 * Calculate match score between query interests and persona
 */
function calculateQueryMatchScore(queryKeywords, persona) {
  let score = 0;
  const matchingKeywords = {
    interests: [],
    projects: [],
    themes: [],
    channels: [],
  };

  // Match against core interests (weight: 30%)
  const commonInterests = arrayIntersection(
    queryKeywords,
    persona.core_interests || []
  );
  if (commonInterests.length > 0) {
    score += (commonInterests.length / Math.max(queryKeywords.length, 1)) * 30;
    matchingKeywords.interests = commonInterests;
  }

  // Match against projects/protocols (weight: 25%)
  const commonProjects = arrayIntersection(
    queryKeywords,
    persona.projects_protocols || []
  );
  if (commonProjects.length > 0) {
    score += (commonProjects.length / Math.max(queryKeywords.length, 1)) * 25;
    matchingKeywords.projects = commonProjects;
  }

  // Match against content themes (weight: 15%)
  const commonThemes = arrayIntersection(
    queryKeywords,
    persona.content_themes || []
  );
  if (commonThemes.length > 0) {
    score += (commonThemes.length / Math.max(queryKeywords.length, 1)) * 15;
    matchingKeywords.themes = commonThemes;
  }

  // Match against top channels (weight: 5%)
  const commonChannels = arrayIntersection(
    queryKeywords,
    persona.top_channels || []
  );
  if (commonChannels.length > 0) {
    score += (commonChannels.length / Math.max(queryKeywords.length, 1)) * 5;
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
 * Search users by voice query
 * @param {Buffer} audioBuffer - Audio file buffer
 * @param {string} mimeType - MIME type of audio file
 * @param {number} userFid - FID of the user making the search (to exclude from results)
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Results per page (default: 10)
 * @returns {Promise<Object>} Matching users with pagination
 */
const searchUsersByVoice = async (audioBuffer, mimeType, userFid, page = 1, limit = 10) => {
  try {
    // Step 1: Transcribe audio
    console.log('🎤 Transcribing audio...');
    const transcript = await transcribeAudio(audioBuffer, mimeType);
    
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('No transcript generated from audio');
    }

    console.log(`✅ Transcript: "${transcript}"`);

    // Step 2: Extract interests/query from transcript
    console.log('🔍 Extracting interests from transcript...');
    const interests = extractInterests(transcript);
    const query = parseDiscoveryQuery(transcript);
    
    // Combine all keywords for matching
    const allKeywords = [
      ...(query.chains || []),
      ...(query.protocols || []),
      ...(query.topics || []),
      ...interests,
    ];
    
    const uniqueKeywords = Array.from(new Set(allKeywords));
    
    console.log(`✅ Extracted keywords: ${uniqueKeywords.join(', ')}`);

    if (uniqueKeywords.length === 0) {
      // No keywords found, return empty results
      return {
        transcript,
        query,
        interests,
        matches: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    // Step 3: Get all personas (exclude current user and swiped users)
    const swipedFids = await dbService.getSwipedUserFids(userFid);
    const swipedFidsSet = new Set([userFid, ...swipedFids]);

    const allPersonas = (await dbService.getAllPersonasExcept(userFid)).filter(
      (persona) => !swipedFidsSet.has(persona.farcaster_fid)
    );

    if (allPersonas.length === 0) {
      return {
        transcript,
        query,
        interests,
        matches: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    // Step 4: Calculate match scores based on query keywords
    const matchesWithScores = allPersonas.map((persona) => {
      const matchResult = calculateQueryMatchScore(uniqueKeywords, persona);
      return {
        persona,
        ...matchResult,
      };
    });

    // Filter to only include users with match score > 0
    const actualMatches = matchesWithScores.filter((match) => match.score > 0);

    // Sort by match score (descending)
    actualMatches.sort((a, b) => b.score - a.score);

    // Step 5: Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    let paginatedMatches = actualMatches.slice(startIndex, endIndex);

    // If we don't have enough matches, fill with random users (score = 0)
    if (paginatedMatches.length < limit) {
      const matchedFids = new Set([
        userFid,
        ...swipedFids,
        ...paginatedMatches.map((m) => m.persona.farcaster_fid),
      ]);

      const neededRandom = limit - paginatedMatches.length;

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

    // Step 6: Get user profiles for matched personas
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

    const validMatches = matchedUsers.filter((user) => user !== null);

    // Calculate total count
    const totalAvailable = actualMatches.length;
    const nonMatchingPersonas = matchesWithScores.filter((match) => match.score === 0);
    const totalRandom = nonMatchingPersonas.length;
    const totalCount = totalAvailable + totalRandom;

    return {
      transcript,
      query,
      interests,
      matches: validMatches,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  } catch (error) {
    console.error('Voice search error:', error);
    throw new Error(`Failed to search users by voice: ${error.message}`);
  }
};

module.exports = {
  searchUsersByVoice,
  transcribeAudio,
  extractInterests,
  parseDiscoveryQuery,
};

