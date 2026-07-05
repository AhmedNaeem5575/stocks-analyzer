-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Seed default user (password: 9026040An!)
-- Hash generated using bcrypt with 10 rounds
INSERT INTO users (username, password_hash) VALUES
('ahmednaeem5575', '$2b$10$rKZz3QqLxHxJCqLXyVPQdOqJqHG5Q8jYxFnKqL5aQqJqHG5Q8jYQ2')
ON CONFLICT (username) DO NOTHING;
