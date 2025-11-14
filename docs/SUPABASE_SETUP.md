# Supabase Setup Guide

## Understanding Supabase Keys

### Key Types

1. **Anon Key (Public Key / Publishable Key)**
   - This is the **same** as the "publishable key"
   - Safe to use in client-side code
   - Respects Row Level Security (RLS) policies
   - **Recommended for most server-side operations**

2. **Service Role Key (Secret Key)**
   - **NEVER expose this in client-side code**
   - Bypasses Row Level Security (RLS) policies
   - Use only in secure server-side environments
   - **Use this if you need to bypass RLS for admin operations**

## How to Get Your Supabase Keys

### Step 1: Go to Your Supabase Project
1. Log in to [Supabase Dashboard](https://app.supabase.com)
2. Select your project

### Step 2: Navigate to API Settings
1. Click on the **Settings** icon (gear icon) in the left sidebar
2. Click on **API** in the settings menu

### Step 3: Find Your Keys
You'll see several keys:

- **Project URL** → This is your `SUPABASE_URL`
- **anon public** key → This is your `SUPABASE_ANON_KEY` (also called publishable key)
- **service_role** key → This is your `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

## Which Key Should You Use?

### For This Backend Project:

**Option 1: Use Anon Key (Recommended)**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Option 2: Use Service Role Key (If you need to bypass RLS)**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Note:** The code supports both. It will use `SUPABASE_SERVICE_ROLE_KEY` if provided, otherwise falls back to `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`.

## Environment Variables

Add to your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key-here

# OR use service role key (if needed)
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Security Best Practices

1. ✅ **Anon Key**: Safe for server-side use, respects RLS
2. ✅ **Service Role Key**: Only use in secure server environments, never expose
3. ❌ **Never commit keys to version control** - always use `.env` file
4. ✅ **Use Anon Key by default** - only use Service Role if you specifically need to bypass RLS

## Quick Reference

| Key Type | Where to Find | Use Case |
|----------|--------------|----------|
| **Anon Key** | Settings → API → anon public | Most operations, respects RLS |
| **Service Role** | Settings → API → service_role | Admin operations, bypasses RLS |
| **Project URL** | Settings → API → Project URL | Required for all operations |

