-- Portfolio Holdings Table
CREATE TABLE IF NOT EXISTS holdings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    symbol VARCHAR(20) NOT NULL,
    shares INTEGER NOT NULL,
    average_price DECIMAL(10, 2) NOT NULL,
    purchased_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_user_symbol UNIQUE(user_id, symbol)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_holdings_user_symbol ON holdings(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON holdings(symbol);

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
    d.close as current_price,
    d.change_1d,
    d.change_1y,
    sc.composite_score,
    sc.risk_level,
    (h.shares * d.close) as current_value,
    (h.shares * d.close - h.shares * h.average_price) as profit_loss,
    CASE
        WHEN h.average_price > 0 THEN ((d.close - h.average_price) / h.average_price * 100)
        ELSE NULL
    END as profit_loss_pct,
    CASE
        WHEN h.shares > 0 THEN (h.shares * d.close)
        ELSE 0
    END as total_cost
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
