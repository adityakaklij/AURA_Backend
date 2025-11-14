# Voice Search Endpoint Documentation

## Overview

The voice search endpoint allows users to search for matching users by speaking their interests or query. The audio is transcribed using OpenAI Whisper, interests are extracted, and users are matched based on persona similarity.

## Endpoints

### 1. POST `/api/v1/voice-search`

**Description**: Search users by voice query (audio file upload)

**Content-Type**: `multipart/form-data`

**Request Body**:
- `audio` (File, required): Audio file (webm, mp3, wav, m4a, ogg, flac)
  - Max file size: 25MB
  - Supported formats: webm, mp3, wav, m4a, ogg, flac
- `fid` (number, required): Farcaster ID of the user making the search
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Results per page (default: 10, max: 50)

**Example Request** (cURL):
```bash
curl -X POST http://localhost:3000/api/v1/voice-search \
  -F "audio=@recording.webm" \
  -F "fid=12345" \
  -F "page=1" \
  -F "limit=10"
```

**Example Request** (JavaScript/Fetch):
```javascript
const formData = new FormData();
formData.append('audio', audioFile); // File from microphone
formData.append('fid', '12345');
formData.append('page', '1');
formData.append('limit', '10');

const response = await fetch('http://localhost:3000/api/v1/voice-search', {
  method: 'POST',
  body: formData,
});

const data = await response.json();
```

**Response**:
```json
{
  "success": true,
  "data": {
    "transcript": "I'm looking for developers working on Ethereum and DeFi projects",
    "query": {
      "rawQuery": "I'm looking for developers working on Ethereum and DeFi projects",
      "chains": ["Ethereum"],
      "protocols": ["Defi"],
      "topics": ["Developer"],
      "keywords": ["Ethereum", "Defi", "Developer"]
    },
    "interests": ["Ethereum", "Defi", "Developer"],
    "matches": [
      {
        "fid": 67890,
        "username": "crypto_dev",
        "display_name": "Crypto Developer",
        "pfp_url": "https://...",
        "bio_text": "Building on Ethereum",
        "follower_count": 1000,
        "following_count": 500,
        "power_badge": true,
        "score": 85.5,
        "match_score": 75.5,
        "matching_keywords": {
          "interests": ["Ethereum", "Defi"],
          "projects": ["Uniswap"],
          "themes": [],
          "channels": []
        },
        "persona_summary": "Expert developer focused on DeFi...",
        "expertise_level": "expert",
        "engagement_style": "technical"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### 2. POST `/api/v1/voice-search-text`

**Description**: Search users by text transcript (alternative to audio upload)

**Content-Type**: `application/json`

**Request Body**:
```json
{
  "transcript": "I'm looking for developers working on Ethereum and DeFi projects",
  "fid": 12345,
  "page": 1,
  "limit": 10
}
```

**Response**: Same format as `/voice-search`

## How It Works

### 1. Audio Transcription
- Audio file is sent to OpenAI Whisper API
- Transcript is generated from the audio
- Supports multiple audio formats (webm, mp3, wav, etc.)

### 2. Interest Extraction
- Transcript is analyzed using crypto vocabulary
- Extracts:
  - **Chains**: Ethereum, Bitcoin, Solana, etc.
  - **Protocols**: DeFi, NFT, Uniswap, Aave, etc.
  - **Topics**: Developer, Trading, Smart Contracts, etc.
  - **Interests**: General interests and hobbies

### 3. User Matching
- Matches extracted keywords against user personas
- Calculates match score based on:
  - Core interests match (30% weight)
  - Projects/protocols match (25% weight)
  - Content themes match (15% weight)
  - Top channels match (5% weight)
- Excludes users already swiped on
- Sorts by match score (highest first)

### 4. Pagination
- Returns paginated results (default: 10 per page)
- If not enough matches, fills with random users
- Includes pagination metadata

## Supported Keywords

### Chains
Ethereum, Bitcoin, Solana, Base, Polygon, Arbitrum, Optimism, Avalanche, BSC, Polkadot, Cardano, Cosmos, Near, Aptos, Sui

### Protocols
DeFi, NFT, DAO, DEX, Uniswap, Aave, Compound, MakerDAO, Curve, PancakeSwap, OpenSea, Blur, Lido, EigenLayer, Aevo

### Concepts
Smart Contracts, Web3, Blockchain, Crypto, Staking, Yield Farming, Liquidity, Governance, Minting, Mining, Validator, Consensus, Layer 2, Rollup, Bridge, Wallet, Oracle, Token, Metaverse, GameFi, SocialFi

### Roles
Developer, Founder, CEO, CTO, Designer, Product Manager, Marketer, Community, Investor, Trader, Builder, Researcher

### Trading Terms
Trading, HODL, FOMO, FUD, Bull Market, Bear Market, Whale, ATH, DCA, ROI, Market Cap, Liquidity Pool, Arbitrage, Leverage, Futures, Options

## Error Responses

### Missing Audio File
```json
{
  "success": false,
  "error": "Audio file is required"
}
```

### Invalid File Type
```json
{
  "success": false,
  "error": "Invalid file type. Allowed types: audio/webm, audio/mp3, ..."
}
```

### Transcription Failed
```json
{
  "success": false,
  "error": "Failed to transcribe audio: [error message]"
}
```

### Missing FID
```json
{
  "success": false,
  "error": "FID is required"
}
```

## Environment Variables

Add to `.env`:
```env
OPENAI_API_KEY=your-openai-api-key-here
```

## Dependencies

Install required packages:
```bash
npm install multer openai form-data
```

## Example Use Cases

### 1. Search for Ethereum Developers
**Audio**: "Show me developers working on Ethereum"
**Extracted**: Chains: [Ethereum], Topics: [Developer]
**Matches**: Users with Ethereum in interests and Developer in roles

### 2. Search for DeFi Traders
**Audio**: "Find me DeFi traders"
**Extracted**: Protocols: [Defi], Topics: [Trader]
**Matches**: Users interested in DeFi with trading themes

### 3. Search for NFT Collectors
**Audio**: "I want to connect with NFT collectors"
**Extracted**: Protocols: [Nft]
**Matches**: Users with NFT in interests or projects

## Response Format

The response format matches the `/get-matches` endpoint for consistency:

- `transcript`: The transcribed text from audio
- `query`: Structured query with chains, protocols, topics, keywords
- `interests`: Array of extracted interests
- `matches`: Array of matching users (same format as `/get-matches`)
- `pagination`: Pagination metadata

## Notes

1. **Audio File Size**: Maximum 25MB (OpenAI Whisper limit)
2. **Supported Formats**: webm, mp3, wav, m4a, ogg, flac
3. **Transcription**: Uses OpenAI Whisper API (requires API key)
4. **Matching**: Uses same algorithm as `/get-matches` endpoint
5. **Pagination**: Same pagination logic as matching endpoint
6. **Exclusions**: Automatically excludes swiped users and current user

