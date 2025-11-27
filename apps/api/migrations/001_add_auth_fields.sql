-- Migration: Add email verification and password reset fields
-- Date: 2025-01-27
-- Description: Adds email verification, password reset, and security fields to users table

-- Add email verification fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP WITH TIME ZONE;

-- Add password reset fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;

-- Add security fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS failed_login_attempts BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Set existing users as verified (grandfather existing accounts)
UPDATE users SET email_verified = TRUE WHERE email_verified IS NULL OR email_verified = FALSE;
