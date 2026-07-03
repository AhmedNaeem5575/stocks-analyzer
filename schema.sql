-- PSX Stock Analysis System - Database Schema
-- PostgreSQL with optional TimescaleDB extension

-- Try to enable TimescaleDB extension (optional, for time-series optimization)
-- If this fails, the system will work with regular PostgreSQL tables
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS timescaledb;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'TimescaleDB extension not available, using regular tables';
END $$;

-- Stocks table (basic company information)
CREATE TABLE IF NOT EXISTS stocks (
    symbol VARCHAR(20) PRIMARY KEY,
    name VARCHAR(200),
    sector VARCHAR(100),
    industry VARCHAR(150),
    listed_date DATE,
    face_value DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Daily stock data (time-series data)
CREATE TABLE IF NOT EXISTS stock_daily_data (
    time TIMESTAMP NOT NULL,
    symbol VARCHAR(20) REFERENCES stocks(symbol) ON DELETE CASCADE,
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

-- Create index on symbol for faster joins
CREATE INDEX IF NOT EXISTS idx_stock_daily_data_symbol ON stock_daily_data(symbol);

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

-- User portfolio tracking (optional feature)
CREATE TABLE IF NOT EXISTS portfolio (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100),
    symbol VARCHAR(20) REFERENCES stocks(symbol),
    shares INTEGER,
    avg_cost DECIMAL(10,2),
    current_value DECIMAL(10,2),
    unrealized_gain_loss DECIMAL(10,2),
    purchase_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Alert table for price movements and signals
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    time TIMESTAMP DEFAULT NOW(),
    symbol VARCHAR(20) REFERENCES stocks(symbol),
    alert_type VARCHAR(50),                 -- PRICE_TARGET, STOP_LOSS, BREAKOUT, DOWNTREND, DIVIDEND
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_recommendations_timeframe ON recommendations(timeframe, time DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_rank ON recommendations(time, timeframe, recommendation_rank);
CREATE INDEX IF NOT EXISTS idx_stock_scores_composite ON stock_scores(time DESC, composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_stock_daily_data_time ON stock_daily_data(time DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(is_read, time DESC);

-- Create a view for latest stock data with scores
-- Note: Uses separate MAX(time) filters since daily data and scores have different timestamps
CREATE OR REPLACE VIEW v_stock_analysis AS
SELECT
    s.symbol,
    s.name,
    s.sector,
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
JOIN stock_daily_data d ON s.symbol = d.symbol
  AND d.time = (SELECT MAX(time) FROM stock_daily_data)
JOIN stock_scores sc ON s.symbol = sc.symbol
  AND sc.time = (SELECT MAX(time) FROM stock_scores);

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

-- Comments
COMMENT ON TABLE stocks IS 'Basic company information for PSX listed stocks';
COMMENT ON TABLE stock_daily_data IS 'Daily OHLCV and fundamental data for stocks';
COMMENT ON TABLE stock_scores IS 'Multi-factor analysis scores for stocks';
COMMENT ON TABLE recommendations IS 'Investment recommendations by timeframe';
COMMENT ON TABLE sector_performance IS 'Sector-level performance metrics';
COMMENT ON TABLE scrape_log IS 'Log of data scraping operations';
COMMENT ON TABLE portfolio IS 'User portfolio tracking';
COMMENT ON TABLE alerts IS 'Price and signal alerts';
