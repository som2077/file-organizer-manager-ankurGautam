-- Supabase Tables for File Organizer Manager
-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  "openId" VARCHAR(64) NOT NULL UNIQUE,
  name TEXT,
  email VARCHAR(320),
  "loginMethod" VARCHAR(64),
  password TEXT,
  role VARCHAR(16) DEFAULT 'user' NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  "lastSignedIn" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "originalName" VARCHAR(255) NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "fileType" VARCHAR(100) NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "filePath" VARCHAR(512) NOT NULL,
  "uploadedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_openId ON users("openId");
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_files_userId ON files("userId");

-- Storage bucket for files
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: allow service role full access
CREATE POLICY "Service role full access" ON storage.objects
  FOR ALL USING (bucket_id = 'files');
