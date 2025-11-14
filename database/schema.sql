-- Create users table to store Farcaster user data
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fid BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  display_name TEXT,
  pfp_url TEXT,
  custody_address VARCHAR(255),
  bio_text TEXT,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  verifications JSONB,
  verified_addresses JSONB,
  auth_addresses JSONB,
  verified_accounts JSONB,
  power_badge BOOLEAN DEFAULT false,
  score DECIMAL(10, 2),
  pro_status VARCHAR(50),
  pro_subscribed_at TIMESTAMPTZ,
  pro_expires_at TIMESTAMPTZ,
  profile_data JSONB,
  raw_data JSONB, -- Store complete raw response from Neynar
  nft_owned BOOLEAN DEFAULT false,
  nft_verified_address VARCHAR(255), -- Address where NFT was found
  nft_last_verified_at TIMESTAMPTZ, -- Last time NFT ownership was verified
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on fid for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_fid ON users(fid);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Create index on custody_address for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_custody_address ON users(custody_address);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE users IS 'Stores Farcaster user data fetched from Neynar API';
COMMENT ON COLUMN users.fid IS 'Farcaster ID - unique identifier for each user';
COMMENT ON COLUMN users.raw_data IS 'Complete raw JSON response from Neynar API';
COMMENT ON COLUMN users.verified_addresses IS 'JSON object containing eth_addresses, sol_addresses, and primary addresses';
COMMENT ON COLUMN users.nft_owned IS 'Whether user owns the required NFT';
COMMENT ON COLUMN users.nft_verified_address IS 'The address where the NFT was found';
COMMENT ON COLUMN users.nft_last_verified_at IS 'Timestamp of last NFT ownership verification';

