-- Portfolio Holdings Table (matches existing database.js functions)
CREATE TABLE IF NOT EXISTS portfolio (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    shares INTEGER NOT NULL,
    avg_cost DECIMAL(10, 2) NOT NULL,
    current_value DECIMAL(15, 2),
    unrealized_gain_loss DECIMAL(15, 2),
    purchase_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

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
