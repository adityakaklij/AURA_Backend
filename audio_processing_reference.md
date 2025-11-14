```ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Check if the request contains FormData (audio file) or JSON (transcript)
    const contentType = request.headers.get("content-type") || "";
    
    let transcript = "";
    let mode = "discovery";
    
    if (contentType.includes("multipart/form-data")) {
      // Handle audio file upload
      const formData = await request.formData();
      const audioFile = formData.get("audio") as File;
      mode = (formData.get("mode") as string) || "discovery";
      
      if (!audioFile) {
        return NextResponse.json(
          { error: "Audio file is required" },
          { status: 400 }
        );
      }
      
      // Transcribe audio using OpenAI Whisper
      transcript = await transcribeAudio(audioFile);
      
      if (!transcript) {
        return NextResponse.json(
          { error: "Failed to transcribe audio" },
          { status: 500 }
        );
      }
    } else {
      // Handle JSON with transcript
      const body = await request.json();
      transcript = body.transcript;
      mode = body.mode || "discovery";
      
      if (!transcript || typeof transcript !== "string") {
        return NextResponse.json(
          { error: "Transcript is required" },
          { status: 400 }
        );
      }
    }

    if (mode === "interests") {
      // Extract structured tags from interests speech
      const interests = extractInterests(transcript);
      return NextResponse.json({ 
        transcript, 
        interests,
        mode: "interests" 
      });
    } else if (mode === "discovery") {
      // Parse discovery query
      const query = parseDiscoveryQuery(transcript);
      return NextResponse.json({ 
        transcript, 
        query,
        mode: "discovery" 
      });
    }

    return NextResponse.json(
      { error: "Invalid mode" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Voice processing error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process voice input" },
      { status: 500 }
    );
  }
}

// Transcribe audio using OpenAI Whisper API
async function transcribeAudio(audioFile: File): Promise<string> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error("OPENAI_API_KEY not set in environment variables");
      throw new Error("Transcription service not configured");
    }
    
    // Create FormData for OpenAI API
    const formData = new FormData();
    formData.append("file", audioFile);
    formData.append("model", "whisper-1");
    formData.append("language", "en");
    
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI Whisper API error:", errorData);
      throw new Error("Failed to transcribe audio");
    }
    
    const data = await response.json();
    return data.text || "";
  } catch (error: any) {
    console.error("Transcription error:", error);
    throw new Error("Failed to transcribe audio");
  }
}

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

// Fuzzy matching helper - finds close matches
function fuzzyMatch(word: string, variations: string[]): boolean {
  const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  return variations.some(variant => {
    const normalizedVariant = variant.toLowerCase().replace(/[^a-z0-9]/g, "");
    // Exact match
    if (normalized === normalizedVariant) return true;
    // Contains match
    if (normalized.includes(normalizedVariant) || normalizedVariant.includes(normalized)) return true;
    // Levenshtein distance for typos (simple version)
    return levenshteinDistance(normalized, normalizedVariant) <= 2;
  });
}

// Simple Levenshtein distance for typo detection
function levenshteinDistance(a: string, b: string): number {
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

// Extract interests from natural speech with enhanced crypto vocabulary
function extractInterests(transcript: string): string[] {
  const text = transcript.toLowerCase();
  const interests = new Set<string>();

  // Check all vocabulary categories and use CANONICAL forms for matched words
  Object.entries(CRYPTO_VOCABULARY).forEach(([category, terms]) => {
    Object.entries(terms).forEach(([canonical, variations]) => {
      // Only add if we find a STRONG match in the transcript
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

  // Additional hobby/personal interests (non-crypto) - use actual words for these
  const hobbies = [
    "music", "travel", "traveling", "food", "cooking", "fitness", "gym", "yoga", "running",
    "art", "photography", "gaming", "reading", "writing", "hiking", "cycling", "swimming",
    "coffee", "wine", "movies", "netflix", "anime", "sports", "basketball", "football", "soccer"
  ];
  hobbies.forEach(hobby => {
    const regex = new RegExp(`\\b${hobby}\\b`, "i");
    const match = transcript.match(regex);
    if (match) {
      // Use actual word from transcript for hobbies
      const actualWord = match[0];
      const formatted = actualWord === "traveling" || actualWord === "Traveling" 
        ? "Travel" 
        : actualWord.charAt(0).toUpperCase() + actualWord.slice(1).toLowerCase();
      interests.add(formatted);
    }
  });

  return Array.from(interests);
}

// Parse discovery query into structured format with enhanced vocabulary
function parseDiscoveryQuery(transcript: string): {
  rawQuery: string;
  chains?: string[];
  protocols?: string[];
  topics?: string[];
  keywords: string[];
} {
  const text = transcript.toLowerCase();
  const query: any = {
    rawQuery: transcript,
    keywords: []
  };

  const foundChains: string[] = [];
  const foundProtocols: string[] = [];
  const foundTopics: string[] = [];

  // Extract chains - use CANONICAL forms - STRICT matching only
  Object.entries(CRYPTO_VOCABULARY.chains).forEach(([canonical, variations]) => {
    let matched = false;
    
    // Check each variation for exact whole-word match
    variations.forEach(variant => {
      if (variant.includes(" ")) {
        // Multi-word phrase
        const regex = new RegExp(`\\b${variant.replace(/\s+/g, "\\s+")}\\b`, "i");
        if (regex.test(text)) {
          matched = true;
        }
      } else {
        // Single word - must be whole word match
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

  // Extract protocols - use CANONICAL forms - STRICT matching only
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

  // Extract roles and concepts as topics - use CANONICAL forms - STRICT matching only
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
```