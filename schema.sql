-- PSX Stock Analysis System - Complete Database Schema
-- PostgreSQL with optional TimescaleDB extension
-- This single file contains all tables needed for the system

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Try to enable TimescaleDB extension (optional, for time-series optimization)
-- If this fails, the system will work with regular PostgreSQL tables
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS timescaledb;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'TimescaleDB extension not available, using regular tables';
END $$;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Stocks table (basic company information)
CREATE TABLE IF NOT EXISTS stocks (
    symbol VARCHAR(20) PRIMARY KEY,
    name VARCHAR(200),
    sector VARCHAR(100),
    industry VARCHAR(150),
    listed_date DATE,
    face_value DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    last_seen_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE stocks IS 'Basic company information for PSX listed stocks';
COMMENT ON COLUMN stocks.is_active IS 'Whether the stock is actively trading on PSX';
COMMENT ON COLUMN stocks.last_seen_date IS 'Last date this stock appeared in market data';

-- Daily stock data (time-series data)
CREATE TABLE IF NOT EXISTS stock_daily_data (
    time TIMESTAMP NOT NULL,
    scrape_id VARCHAR(50),
    scrape_date DATE,
    symbol VARCHAR(20) REFERENCES stocks(symbol) ON DELETE SET NULL,
    open DECIMAL(10,2),
    high DECIMAL(10,2),
    low DECIMAL(10,2),
    close DECIMAL(10,2),
    volume BIGINT,
    market_cap BIGINT,
    pe_ratio DECIMAL(10,2),
    pb_ratio DECIMAL(10,2),
    dividend_yield DECIMAL(5,2),
    free_float BIGINT,
    free_float_pct DECIMAL(5,2),
    avg_volume_30d BIGINT,
    change_1d DECIMAL(8,2),
    change_1w DECIMAL(8,2),
    change_1m DECIMAL(8,2),
    change_3m DECIMAL(8,2),
    change_6m DECIMAL(8,2),
    change_1y DECIMAL(8,2),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (time, symbol)
);

COMMENT ON TABLE stock_daily_data IS 'Daily OHLCV and fundamental data for stocks';

-- Create index on symbol for faster joins
CREATE INDEX IF NOT EXISTS idx_stock_daily_data_symbol ON stock_daily_data(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_daily_data_time ON stock_daily_data(time DESC);

-- Convert to hypertable if TimescaleDB is available
DO $$
BEGIN
    -- Check if timescaledb extension is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        SELECT create_hypertable('stock_daily_data', 'time', if_not_exists => TRUE);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not create hypertable, using regular table';
END $$;

-- Analysis scores table
CREATE TABLE IF NOT EXISTS stock_scores (
    time TIMESTAMP NOT NULL,
    symbol VARCHAR(20) REFERENCES stocks(symbol) ON DELETE CASCADE,
    financial_health_score DECIMAL(5,2),  -- 0-100
    momentum_score DECIMAL(5,2),           -- 0-100
    dividend_score DECIMAL(5,2),           -- 0-100
    sector_score DECIMAL(5,2),             -- 0-100
    composite_score DECIMAL(5,2),          -- 0-100 weighted average
    volatility DECIMAL(5,2),               -- Annualized volatility
    liquidity_score DECIMAL(5,2),          -- 0-100 based on volume
    risk_level VARCHAR(20),                -- LOW, MEDIUM, HIGH
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (time, symbol)
);

COMMENT ON TABLE stock_scores IS 'Multi-factor analysis scores for stocks';

-- Convert to hypertable if TimescaleDB is available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        SELECT create_hypertable('stock_scores', 'time', if_not_exists => TRUE);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not create hypertable, using regular table';
END $$;

-- Strategy recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
    time TIMESTAMP NOT NULL,
    symbol VARCHAR(20) REFERENCES stocks(symbol) ON DELETE CASCADE,
    timeframe VARCHAR(20) NOT NULL,         -- SHORT, MEDIUM, LONG
    strategy_type VARCHAR(50),             -- VALUE, GROWTH, MOMENTUM, DIVIDEND, BALANCED
    recommendation_rank INTEGER,
    target_price DECIMAL(10,2),
    expected_return DECIMAL(8,2),          -- Percentage
    risk_reward_ratio DECIMAL(5,2),
    entry_price DECIMAL(10,2),
    stop_loss DECIMAL(10,2),
    reasoning TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (time, symbol, timeframe)
);

COMMENT ON TABLE recommendations IS 'Investment recommendations by timeframe';

-- Convert to hypertable if TimescaleDB is available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        SELECT create_hypertable('recommendations', 'time', if_not_exists => TRUE);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not create hypertable, using regular table';
END $$;

-- Sector performance table
CREATE TABLE IF NOT EXISTS sector_performance (
    time TIMESTAMP NOT NULL,
    sector VARCHAR(100) PRIMARY KEY,
    avg_pe_ratio DECIMAL(10,2),
    avg_pb_ratio DECIMAL(10,2),
    avg_dividend_yield DECIMAL(5,2),
    market_cap_pct DECIMAL(5,2),           -- % of total market cap
    momentum_score DECIMAL(5,2),
    change_1m DECIMAL(8,2),
    change_3m DECIMAL(8,2),
    change_1y DECIMAL(8,2),
    num_stocks INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE sector_performance IS 'Sector-level performance metrics';

-- Convert to hypertable if TimescaleDB is available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        SELECT create_hypertable('sector_performance', 'time', if_not_exists => TRUE);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not create hypertable, using regular table';
END $$;

-- Scraping log table
CREATE TABLE IF NOT EXISTS scrape_log (
    id SERIAL PRIMARY KEY,
    scrape_time TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20),                     -- SUCCESS, PARTIAL, FAILED
    stocks_scraped INTEGER,
    errors INTEGER,
    error_details TEXT,
    duration_seconds INTEGER,
    data_source VARCHAR(100)
);

COMMENT ON TABLE scrape_log IS 'Log of data scraping operations';

-- ============================================================================
-- AUTHENTICATION TABLES
-- ============================================================================

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

COMMENT ON TABLE users IS 'User authentication accounts';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Remember tokens for persistent login
CREATE TABLE IF NOT EXISTS remember_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE remember_tokens IS 'Persistent login tokens for remember me functionality';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_remember_tokens_token ON remember_tokens(token);
CREATE INDEX IF NOT EXISTS idx_remember_tokens_user ON remember_tokens(user_id);

-- ============================================================================
-- PORTFOLIO TABLES
-- ============================================================================

-- Portfolio users table (for simplified user management)
CREATE TABLE IF NOT EXISTS portfolio_users (
    user_id VARCHAR(100) PRIMARY KEY,
    email VARCHAR(200) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE portfolio_users IS 'Simplified user accounts for portfolio management';

-- Create index
CREATE INDEX IF NOT EXISTS idx_portfolio_users_email ON portfolio_users(email);

-- Holdings table (alternative portfolio tracking with notes support)
CREATE TABLE IF NOT EXISTS holdings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL REFERENCES stocks(symbol) ON DELETE SET NULL,
    shares INTEGER NOT NULL,
    average_price DECIMAL(10,2) NOT NULL,
    purchased_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_holdings_user_symbol UNIQUE(user_id, symbol)
);

COMMENT ON TABLE holdings IS 'User portfolio holdings with notes support';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_holdings_user_symbol ON holdings(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON holdings(symbol);

-- Portfolio holdings table (primary portfolio tracking)
CREATE TABLE IF NOT EXISTS portfolio (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL REFERENCES stocks(symbol) ON DELETE SET NULL,
    shares INTEGER NOT NULL,
    avg_cost DECIMAL(10,2) NOT NULL,
    current_value DECIMAL(15,2),
    unrealized_gain_loss DECIMAL(15,2),
    purchase_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE portfolio IS 'User portfolio holdings';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_symbol ON portfolio(symbol);

-- Portfolio summary view
CREATE OR REPLACE VIEW v_portfolio_summary AS
SELECT
    p.user_id,
    COUNT(*) as holding_count,
    COALESCE(SUM(p.current_value), 0) as total_value,
    COALESCE(SUM(p.unrealized_gain_loss), 0) as total_gain_loss,
    CASE
        WHEN COALESCE(SUM(p.avg_cost * p.shares), 0) > 0
        THEN COALESCE(SUM(p.unrealized_gain_loss), 0) / SUM(p.avg_cost * p.shares) * 100
        ELSE 0
    END as avg_return_pct
FROM portfolio p
GROUP BY p.user_id;

-- ============================================================================
-- ALERTS TABLES
-- ============================================================================

-- Alert table for price movements and signals
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    time TIMESTAMP DEFAULT NOW(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) REFERENCES stocks(symbol) ON DELETE SET NULL,
    alert_type VARCHAR(50),                 -- PRICE_TARGET, STOP_LOSS, BREAKOUT, DOWNTREND, DIVIDEND
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE alerts IS 'Price and signal alerts for user portfolio';

-- ============================================================================
-- INDEXES FOR COMMON QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_recommendations_timeframe ON recommendations(timeframe, time DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_rank ON recommendations(time, timeframe, recommendation_rank);
CREATE INDEX IF NOT EXISTS idx_stock_scores_composite ON stock_scores(time DESC, composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(user_id, is_read, time DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user_symbol ON alerts(user_id, symbol);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Holdings view with current data
CREATE OR REPLACE VIEW v_holdings AS
SELECT
    h.id,
    h.user_id,
    h.symbol,
    h.shares,
    h.average_price,
    h.purchased_date,
    h.notes,
    h.created_at,
    h.updated_at,
    s.name,
    s.sector,
    d.close AS current_price,
    d.change_1d,
    d.change_1y,
    sc.composite_score,
    sc.risk_level,
    (h.shares * d.close) AS current_value,
    (h.shares * d.close - h.shares * h.average_price) AS profit_loss,
    CASE
        WHEN h.average_price > 0 THEN ((d.close - h.average_price) / h.average_price * 100)
        ELSE NULL
    END AS profit_loss_pct,
    CASE
        WHEN h.shares > 0 THEN (h.shares * d.close)
        ELSE 0
    END AS total_cost
FROM holdings h
JOIN stocks s ON h.symbol = s.symbol
LEFT JOIN LATERAL (
    SELECT close, change_1d, change_1y, symbol
    FROM stock_daily_data
    WHERE symbol = h.symbol
    ORDER BY time DESC
    LIMIT 1
) d ON h.symbol = d.symbol
LEFT JOIN LATERAL (
    SELECT composite_score, risk_level, symbol
    FROM stock_scores
    WHERE symbol = h.symbol
    ORDER BY time DESC
    LIMIT 1
) sc ON h.symbol = sc.symbol;

COMMENT ON VIEW v_holdings IS 'Portfolio holdings with current market data and calculations';

-- Create a view for latest stock data with scores
-- Note: Uses LEFT JOINs to show all stocks even if they don't have daily data or scores yet
CREATE OR REPLACE VIEW v_stock_analysis AS
SELECT
    s.symbol,
    s.name,
    s.sector,
    s.is_active,
    s.last_seen_date,
    d.close AS current_price,
    d.market_cap,
    d.pe_ratio,
    d.dividend_yield,
    d.change_1d,
    d.change_1m,
    d.change_1y,
    sc.financial_health_score,
    sc.momentum_score,
    sc.dividend_score,
    sc.sector_score,
    sc.composite_score,
    sc.volatility,
    sc.risk_level
FROM stocks s
LEFT JOIN LATERAL (
  SELECT close, market_cap, pe_ratio, dividend_yield, change_1d, change_1m, change_1y, time, symbol
  FROM stock_daily_data
  WHERE symbol = s.symbol
  ORDER BY time DESC
  LIMIT 1
) d ON true
LEFT JOIN LATERAL (
  SELECT financial_health_score, momentum_score, dividend_score, sector_score, composite_score, volatility, risk_level, symbol, time
  FROM stock_scores
  WHERE symbol = s.symbol
  ORDER BY time DESC
  LIMIT 1
) sc ON true;

-- Create a view for top recommendations by timeframe
CREATE OR REPLACE VIEW v_top_recommendations AS
SELECT
    r.symbol,
    s.name,
    s.sector,
    r.timeframe,
    r.strategy_type,
    r.recommendation_rank,
    r.entry_price,
    r.target_price,
    r.expected_return,
    r.risk_reward_ratio,
    r.stop_loss,
    r.reasoning,
    d.close AS current_price,
    sc.composite_score
FROM recommendations r
JOIN stocks s ON r.symbol = s.symbol
JOIN stock_daily_data d ON r.symbol = d.symbol AND d.time = (SELECT MAX(time) FROM stock_daily_data)
JOIN stock_scores sc ON r.symbol = sc.symbol AND sc.time = (SELECT MAX(time) FROM stock_scores)
WHERE r.time = (SELECT MAX(time) FROM recommendations)
ORDER BY r.timeframe, r.recommendation_rank;

-- ============================================================================
-- CLEANUP EXPIRED TOKENS
-- ============================================================================

-- Clean up expired tokens (run this periodically via cron job)
DELETE FROM remember_tokens WHERE expires_at < NOW();
