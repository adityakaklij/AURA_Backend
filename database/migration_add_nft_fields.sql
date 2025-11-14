-- Migration: Add NFT ownership fields to users table
-- Run this if you already have the users table and need to add NFT fields

-- Add NFT ownership columns
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS nft_owned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS nft_verified_address VARCHAR(255),
ADD COLUMN IF NOT EXISTS nft_last_verified_at TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN users.nft_owned IS 'Whether user owns the required NFT';
COMMENT ON COLUMN users.nft_verified_address IS 'The address where the NFT was found';
COMMENT ON COLUMN users.nft_last_verified_at IS 'Timestamp of last NFT ownership verification';

