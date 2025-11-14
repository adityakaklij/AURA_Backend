-- Create user_swipes table to track user swipes (likes/rejects) in matchmaking platform
CREATE TABLE IF NOT EXISTS user_swipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_fid BIGINT NOT NULL,
  target_fid BIGINT NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('like', 'reject')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_user_swipes_user_fid FOREIGN KEY (user_fid) REFERENCES users(fid) ON DELETE CASCADE,
  CONSTRAINT fk_user_swipes_target_fid FOREIGN KEY (target_fid) REFERENCES users(fid) ON DELETE CASCADE,
  CONSTRAINT unique_user_target_swipe UNIQUE (user_fid, target_fid)
);

-- Create index on user_fid for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_swipes_user_fid ON user_swipes(user_fid);

-- Create index on target_fid for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_swipes_target_fid ON user_swipes(target_fid);

-- Create index on action for filtering
CREATE INDEX IF NOT EXISTS idx_user_swipes_action ON user_swipes(action);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_user_swipes_user_action ON user_swipes(user_fid, action);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_swipes_updated_at BEFORE UPDATE ON user_swipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE user_swipes IS 'Tracks user swipes (likes/rejects) in the matchmaking platform';
COMMENT ON COLUMN user_swipes.user_fid IS 'FID of the user who performed the swipe';
COMMENT ON COLUMN user_swipes.target_fid IS 'FID of the user who was swiped on';
COMMENT ON COLUMN user_swipes.action IS 'Type of swipe: like or reject';
COMMENT ON CONSTRAINT unique_user_target_swipe ON user_swipes IS 'Ensures a user can only swipe once on a target user';

-- Create a view for matches (when both users like each other)
CREATE OR REPLACE VIEW user_matches AS
SELECT 
  s1.user_fid as user1_fid,
  s2.user_fid as user2_fid,
  s1.created_at as matched_at
FROM user_swipes s1
INNER JOIN user_swipes s2 
  ON s1.user_fid = s2.target_fid 
  AND s1.target_fid = s2.user_fid
WHERE s1.action = 'like' 
  AND s2.action = 'like'
  AND s1.user_fid < s2.user_fid; -- Avoid duplicates

COMMENT ON VIEW user_matches IS 'Shows mutual matches where both users have liked each other';

