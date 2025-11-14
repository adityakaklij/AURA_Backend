-- Create personas table to store user persona analysis
CREATE TABLE IF NOT EXISTS personas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farcaster_fid BIGINT UNIQUE NOT NULL,
  core_interests JSONB,
  projects_protocols JSONB,
  expertise_level VARCHAR(50),
  engagement_style VARCHAR(100),
  content_themes JSONB,
  posting_frequency VARCHAR(50),
  top_channels JSONB,
  sentiment VARCHAR(50),
  summary TEXT,
  confidence_score DECIMAL(3, 2),
  cast_count INTEGER DEFAULT 0,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_personas_fid FOREIGN KEY (farcaster_fid) REFERENCES users(fid) ON DELETE CASCADE
);

-- Create index on farcaster_fid for faster lookups
CREATE INDEX IF NOT EXISTS idx_personas_farcaster_fid ON personas(farcaster_fid);

-- Create index on analyzed_at for sorting
CREATE INDEX IF NOT EXISTS idx_personas_analyzed_at ON personas(analyzed_at DESC);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_personas_updated_at BEFORE UPDATE ON personas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE personas IS 'Stores AI-generated persona analysis for Farcaster users';
COMMENT ON COLUMN personas.farcaster_fid IS 'Farcaster ID - references users table';
COMMENT ON COLUMN personas.core_interests IS 'Array of core interests extracted from user behavior';
COMMENT ON COLUMN personas.projects_protocols IS 'Array of crypto projects/protocols user mentions';
COMMENT ON COLUMN personas.expertise_level IS 'User expertise level: beginner, intermediate, or expert';
COMMENT ON COLUMN personas.engagement_style IS 'How user engages: technical, casual, educational, etc.';
COMMENT ON COLUMN personas.content_themes IS 'Types of content user posts';
COMMENT ON COLUMN personas.posting_frequency IS 'User posting frequency: high, medium, or low';
COMMENT ON COLUMN personas.top_channels IS 'Channels user posts in most frequently';
COMMENT ON COLUMN personas.sentiment IS 'Overall sentiment: positive, neutral, or negative';
COMMENT ON COLUMN personas.summary IS '2-3 sentence summary of user persona';
COMMENT ON COLUMN personas.confidence_score IS 'AI confidence score (0.0-1.0)';
COMMENT ON COLUMN personas.cast_count IS 'Number of casts analyzed';
COMMENT ON COLUMN personas.analyzed_at IS 'Timestamp when analysis was performed';

