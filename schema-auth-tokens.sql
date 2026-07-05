-- Remember tokens for persistent login
CREATE TABLE IF NOT EXISTS remember_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used TIMESTAMP DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_remember_tokens_token ON remember_tokens(token);
CREATE INDEX IF NOT EXISTS idx_remember_tokens_user ON remember_tokens(user_id);

-- Clean up expired tokens (run this periodically)
DELETE FROM remember_tokens WHERE expires_at < NOW();
