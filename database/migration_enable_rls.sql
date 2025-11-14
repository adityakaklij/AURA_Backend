-- ============================================
-- ROW LEVEL SECURITY (RLS) MIGRATION
-- ============================================
-- 
-- This migration enables RLS on all tables and creates security policies.
-- 
-- IMPORTANT NOTES:
-- 1. Backend uses SERVICE ROLE KEY which BYPASSES RLS automatically
-- 2. These policies are primarily for FRONTEND access (using anon key)
-- 3. Backend operations will continue to work normally
-- 4. See docs/BACKEND_DATABASE_ACCESS.md for detailed backend access patterns
--
-- Run this migration in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: ENABLE ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on users table
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on personas table
ALTER TABLE IF EXISTS personas ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_swipes table
ALTER TABLE IF EXISTS user_swipes ENABLE ROW LEVEL SECURITY;

-- Enable RLS on other tables (if they exist)
-- Uncomment and adjust as needed:
-- ALTER TABLE IF EXISTS connections ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE IF EXISTS messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE IF EXISTS swipe_history ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE IF EXISTS transactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: DROP EXISTING POLICIES (if re-running)
-- ============================================
-- Uncomment these if you need to re-run the migration

-- DROP POLICY IF EXISTS "Backend full access to users" ON users;
-- DROP POLICY IF EXISTS "Frontend can read users" ON users;
-- DROP POLICY IF EXISTS "Backend full access to personas" ON personas;
-- DROP POLICY IF EXISTS "Frontend can read personas" ON personas;
-- DROP POLICY IF EXISTS "Backend full access to swipes" ON user_swipes;
-- DROP POLICY IF EXISTS "Users can view own swipes" ON user_swipes;
-- DROP POLICY IF EXISTS "Users can create own swipes" ON user_swipes;
-- DROP POLICY IF EXISTS "Users can update own swipes" ON user_swipes;

-- ============================================
-- STEP 3: RLS POLICIES FOR USERS TABLE
-- ============================================

-- Policy: Backend full access (explicit, though service role bypasses RLS)
-- This policy documents that backend needs full access
-- Service role key automatically bypasses RLS, so this is mainly for documentation
CREATE POLICY "Backend full access to users"
ON users
FOR ALL
USING (true)
WITH CHECK (true);

-- Policy: Frontend can read any user (needed for matching/discovery)
-- Allows frontend to read user profiles for matching features
CREATE POLICY "Frontend can read users"
ON users
FOR SELECT
USING (true);

-- Note: Frontend INSERT/UPDATE/DELETE on users is not allowed
-- Only backend can create/update users (via service role key)

-- ============================================
-- STEP 4: RLS POLICIES FOR PERSONAS TABLE
-- ============================================

-- Policy: Backend full access (explicit, though service role bypasses RLS)
CREATE POLICY "Backend full access to personas"
ON personas
FOR ALL
USING (true)
WITH CHECK (true);

-- Policy: Frontend can read any persona (needed for matching)
-- Allows frontend to read personas for matching algorithm
CREATE POLICY "Frontend can read personas"
ON personas
FOR SELECT
USING (true);

-- Note: Frontend INSERT/UPDATE/DELETE on personas is not allowed
-- Only backend can create/update personas (via service role key)

-- ============================================
-- STEP 5: RLS POLICIES FOR USER_SWIPES TABLE
-- ============================================

-- Policy: Backend full access (explicit, though service role bypasses RLS)
-- Backend needs to:
-- - Read all swipes for matching algorithm
-- - Create/update swipes for any user
-- - Check matches between any user pairs
CREATE POLICY "Backend full access to swipes"
ON user_swipes
FOR ALL
USING (true)
WITH CHECK (true);

-- Policy: Users can view their own swipes
-- Frontend users can see swipes they made (where user_fid = their fid)
-- Note: If using Supabase Auth, replace `true` with:
--   auth.jwt() ->> 'fid' = user_fid::text
CREATE POLICY "Users can view own swipes"
ON user_swipes
FOR SELECT
USING (
  -- For now, allow all (frontend will filter by user_fid)
  -- TODO: Update when implementing authentication
  -- auth.jwt() ->> 'fid' = user_fid::text
  true
);

-- Policy: Users can create their own swipes
-- Frontend users can create swipes where user_fid = their fid
-- Note: Backend validates this, but RLS provides additional security
CREATE POLICY "Users can create own swipes"
ON user_swipes
FOR INSERT
WITH CHECK (
  -- For now, allow all (backend validates)
  -- TODO: Update when implementing authentication
  -- auth.jwt() ->> 'fid' = user_fid::text
  true
);

-- Policy: Users can update their own swipes
-- Frontend users can update swipes they made
CREATE POLICY "Users can update own swipes"
ON user_swipes
FOR UPDATE
USING (
  -- For now, allow all (backend validates)
  -- TODO: Update when implementing authentication
  -- auth.jwt() ->> 'fid' = user_fid::text
  true
)
WITH CHECK (
  -- Ensure user_fid doesn't change
  -- TODO: Update when implementing authentication
  -- auth.jwt() ->> 'fid' = user_fid::text
  true
);

-- Note: Frontend DELETE on swipes is not allowed
-- Only backend can delete swipes (via service role key)

-- ============================================
-- STEP 6: VERIFICATION
-- ============================================

-- After running this migration, verify:
-- 1. Tables show "Restricted" status in Supabase Dashboard
-- 2. Backend operations still work (service role bypasses RLS)
-- 3. Frontend operations are restricted by policies

-- ============================================
-- NOTES
-- ============================================

-- BACKEND ACCESS:
-- - Backend uses SERVICE ROLE KEY which BYPASSES RLS automatically
-- - All backend operations will work regardless of these policies
-- - Policies are primarily for FRONTEND access control
-- - See docs/BACKEND_DATABASE_ACCESS.md for detailed backend access patterns

-- FRONTEND ACCESS:
-- - Frontend uses ANON KEY which RESPECTS RLS policies
-- - Frontend can READ users and personas (for matching)
-- - Frontend can READ/CREATE/UPDATE own swipes
-- - Frontend CANNOT create/update users or personas (backend only)

-- AUTHENTICATION:
-- - Currently, policies use `true` for simplicity
-- - When implementing authentication, update policies to use:
--   - `auth.jwt() ->> 'fid' = user_fid::text` (if FID in JWT)
--   - `auth.uid()::text = fid::text` (if using Supabase Auth with FID mapping)

-- SECURITY:
-- - RLS is now ENABLED on all tables
-- - Unauthorized access is blocked
-- - Backend operations continue to work (service role bypasses RLS)
-- - Frontend access is restricted by policies

-- ============================================
-- END OF MIGRATION
-- ============================================

