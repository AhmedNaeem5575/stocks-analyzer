"""
PSX Stock Analysis Dashboard
Interactive web interface using Streamlit

DISCLAIMER: This dashboard is for educational purposes only.
It does not constitute financial advice.
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import os
import sys
import time
from datetime import datetime, timedelta
from streamlit.column_config import TextColumn, NumberColumn, LinkColumn

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Page config
st.set_page_config(
    page_title="PSX Stock Analysis",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ==============================================================================
# AUTHENTICATION CHECK
# ==============================================================================

def check_authentication():
    """Check if user is authenticated, show login form if not"""

    # Initialize session state
    if 'authenticated' not in st.session_state:
        st.session_state.authenticated = False
    if 'user_id' not in st.session_state:
        st.session_state.user_id = None
    if 'username' not in st.session_state:
        st.session_state.username = None
    if 'show_login' not in st.session_state:
        st.session_state.show_login = False

    # Try auto-login from remember token in URL
    if not st.session_state.authenticated and 'token' in st.query_params:
        try:
            import subprocess
            import json

            token = st.query_params['token']
            script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'validate_token.js')

            result = subprocess.run(
                ['node', script_path, token],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode == 0:
                auth_result = json.loads(result.stdout.strip())
                if auth_result['success']:
                    st.session_state.authenticated = True
                    st.session_state.user_id = auth_result['user']['id']
                    st.session_state.username = auth_result['user']['username']
                    # Keep token in URL for persistence (don't clear it)
                    return
        except:
            pass

    # If not authenticated, show login form
    if not st.session_state.authenticated:
        # Show login form
        st.markdown("<br><br><br>", unsafe_allow_html=True)

        st.markdown("""
        <style>
        .login-container {
            max-width: 400px;
            margin: 0 auto;
            padding: 2rem;
            border: 1px solid #ddd;
            border-radius: 0.5rem;
            background-color: #f9f9f9;
        }
        .login-title {
            text-align: center;
            font-size: 2rem;
            margin-bottom: 1rem;
        }
        </style>
        """, unsafe_allow_html=True)

        st.markdown("<div class='login-container'>", unsafe_allow_html=True)

        st.markdown("<h2 class='login-title'>🔐 PSX Stock Analysis</h2>", unsafe_allow_html=True)
        st.markdown("<p style='text-align: center; color: #666;'>Please login to continue</p>", unsafe_allow_html=True)
        st.markdown("---")

        # Login form
        with st.form("login_form"):
            # Get saved username from session state
            default_username = st.session_state.get('saved_username', '')

            username = st.text_input("Username", placeholder="Enter your username", value=default_username)
            password = st.text_input("Password", type="password", placeholder="Enter your password")
            remember = st.checkbox("Remember me")

            submit = st.form_submit_button("Login", use_container_width=True, type="primary")

            if submit:
                if not username or not password:
                    st.error("Please enter both username and password")
                else:
                    # Call authentication
                    try:
                        import subprocess
                        import json

                        script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'verify_credentials.js')

                        result = subprocess.run(
                            ['node', script_path, username, password, 'true' if remember else 'false'],
                            capture_output=True,
                            text=True
                        )

                        if result.returncode == 0:
                            auth_result = json.loads(result.stdout.strip())

                            if auth_result['success']:
                                # Save username in session state if remember is checked
                                if remember:
                                    st.session_state.saved_username = username
                                    # If token returned, redirect to URL with token
                                    if 'token' in auth_result:
                                        st.query_params['token'] = auth_result['token']
                                        st.rerun()
                                        return
                                else:
                                    if 'saved_username' in st.session_state:
                                        del st.session_state.saved_username

                                st.session_state.authenticated = True
                                st.session_state.user_id = auth_result['user']['id']
                                st.session_state.username = auth_result['user']['username']
                                st.success("✅ Login successful!")
                                time.sleep(1)
                                st.rerun()
                            else:
                                st.error(f"❌ {auth_result.get('error', 'Login failed')}")
                        else:
                            st.error("❌ Authentication error")

                    except Exception as e:
                        st.error(f"❌ Login error: {str(e)}")

        st.markdown("</div>", unsafe_allow_html=True)

        st.markdown("<br><br>", unsafe_allow_html=True)
        st.markdown("""
        <div style='text-align: center; color: #999; font-size: 0.9rem;'>
        <strong>DISCLAIMER:</strong> This system is for educational purposes only.
        </div>
        """, unsafe_allow_html=True)

        st.stop()  # Stop execution here

# Check authentication
check_authentication()

# ==============================================================================
# MAIN DASHBOARD (Below this line only shown if authenticated)
# ==============================================================================

# Sidebar - User info at top
with st.sidebar:
    st.markdown(f"👤 **{st.session_state.username}**")
    st.markdown("---")

# Custom CSS
st.markdown("""
<style>
    .main-header {
        font-size: 3rem;
        font-weight: bold;
        color: #1f77b4;
        text-align: center;
        margin-bottom: 2rem;
    }
    .metric-card {
        background-color: #f0f2f6;
        padding: 1rem;
        border-radius: 0.5rem;
        margin: 0.5rem 0;
    }
    .disclaimer {
        background-color: #fff3cd;
        padding: 1rem;
        border-radius: 0.5rem;
        margin: 1rem 0;
        border-left: 4px solid #ffc107;
    }
</style>
""", unsafe_allow_html=True)

# Database helper functions
def get_db_connection():
    """Get database connection"""
    try:
        import psycopg2
        from dotenv import load_dotenv
        load_dotenv()

        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=int(os.getenv('DB_PORT', 5432)),
            database=os.getenv('DB_NAME', 'psx_stocks'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', '')
        )
        return conn
    except Exception as e:
        st.error(f"Database connection failed: {e}")
        return None

def load_latest_stocks():
    """Load latest stock data with scores"""
    conn = get_db_connection()
    if not conn:
        return pd.DataFrame()

    try:
        query = """
        SELECT * FROM v_stock_analysis
        ORDER BY composite_score DESC
        """
        df = pd.read_sql_query(query, conn)
        conn.close()
        return df
    except Exception as e:
        st.error(f"Error loading stocks: {e}")
        if conn:
            conn.close()
        return pd.DataFrame()

def load_recommendations(timeframe='SHORT'):
    """Load recommendations by timeframe"""
    conn = get_db_connection()
    if not conn:
        return pd.DataFrame()

    try:
        # Query to get top recommendations by rank from the latest run
        # Round timestamp to minute to handle milliseconds during insertion
        query = """
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
                d.close as current_price,
                sc.composite_score,
                sc.risk_level
            FROM (
                SELECT *
                FROM recommendations
                WHERE timeframe = %s
                  AND time >= date_trunc('minute', (
                    SELECT MAX(time)
                    FROM recommendations
                    WHERE timeframe = %s
                  ))
                  AND time < date_trunc('minute', (
                    SELECT MAX(time)
                    FROM recommendations
                    WHERE timeframe = %s
                  )) + interval '1 minute'
            ) r
            JOIN stocks s ON r.symbol = s.symbol
            LEFT JOIN LATERAL (
                SELECT close, symbol
                FROM stock_daily_data
                WHERE symbol = r.symbol
                ORDER BY time DESC
                LIMIT 1
            ) d ON true
            LEFT JOIN LATERAL (
                SELECT composite_score, risk_level, symbol
                FROM stock_scores
                WHERE symbol = r.symbol
                ORDER BY time DESC
                LIMIT 1
            ) sc ON true
            ORDER BY r.recommendation_rank ASC
            LIMIT 10
        """
        df = pd.read_sql_query(query, conn, params=(timeframe, timeframe, timeframe))
        conn.close()
        return df
    except Exception as e:
        st.error(f"Error loading recommendations: {e}")
        if conn:
            conn.close()
        return pd.DataFrame()

def load_stock_history(symbol, months=12):
    """Load historical data for a stock"""
    conn = get_db_connection()
    if not conn:
        return pd.DataFrame()

    try:
        query = f"""
        SELECT time, close, volume
        FROM stock_daily_data
        WHERE symbol = %s
          AND time >= NOW() - INTERVAL '{months} months'
        ORDER BY time ASC
        """

        df = pd.read_sql_query(query, conn, params=(symbol,))
        conn.close()
        return df
    except Exception as e:
        st.error(f"Error loading history: {e}")
        if conn:
            conn.close()
        return pd.DataFrame()

# Header
st.markdown("<h1 class='main-header'>📈 PSX Stock Analysis Dashboard</h1>", unsafe_allow_html=True)

# Disclaimer
st.markdown("""
<div class='disclaimer'>
<strong>DISCLAIMER:</strong> This dashboard is for educational purposes only.
It does not constitute financial advice. Always do your own research and consult with a qualified financial advisor before making investment decisions.
</div>
""", unsafe_allow_html=True)

st.markdown("---")

# Load stocks (cached independently)
@st.cache_data(ttl=300)
def load_stocks_cached():
    return load_latest_stocks()

stocks = load_stocks_cached()

# Tabs
tab1, tab2, tab3, tab4 = st.tabs(["📋 Recommendations", "🔍 Stock Screener", "📈 Analysis", "💼 My Portfolio"])

# Tab 1: Recommendations
with tab1:
    st.header("Top 10 Investment Recommendations")

    # Filters row
    col_tf1, col_tf2 = st.columns(2)
    with col_tf1:
        timeframe = st.selectbox(
            "Select Investment Timeframe",
            ["SHORT", "MEDIUM", "LONG"],
            index=0,
            help="SHORT: 1-6 months, MEDIUM: 6-18 months, LONG: 18+ months",
            key="rec_timeframe"
        )

    with col_tf2:
        risk_filter = st.selectbox(
            "Filter by Risk Level",
            ["All", "LOW", "MEDIUM", "HIGH"],
            index=0,
            help="Show only recommendations with specific risk level",
            key="rec_risk_filter"
        )

    # Load recommendations for selected timeframe
    recommendations = load_recommendations(timeframe)

    # Apply risk filter if selected
    if risk_filter != "All" and not recommendations.empty:
        # Handle NULL values - convert to empty string for comparison
        recommendations['risk_level'] = recommendations['risk_level'].fillna('')
        recommendations = recommendations[recommendations['risk_level'] == risk_filter]
        st.info(f"🔍 Showing {len(recommendations)} {risk_filter} risk recommendations")
    elif risk_filter == "All" and not recommendations.empty:
        st.info(f"📊 Showing all {len(recommendations)} recommendations")

    if recommendations.empty:
        if risk_filter == "All":
            st.warning(f"No recommendations available for {timeframe} timeframe")
        else:
            st.warning(f"No recommendations available for {timeframe} timeframe with {risk_filter} risk")
        st.info("Run `npm run strategies` to generate recommendations")
    else:
        # Display recommendations
        for idx, row in recommendations.iterrows():
            with st.container():
                col1, col2, col3, col4 = st.columns(4)

                with col1:
                    # Create clickable link with rank and symbol
                    symbol_html = f'<a href="https://sarmaaya.pk/stocks/{row["symbol"]}" target="_blank" style="text-decoration: none; color: inherit;">{row["symbol"]}</a>'
                    st.markdown(f"### #{int(row['recommendation_rank'])} ", unsafe_allow_html=False)
                    st.markdown(symbol_html, unsafe_allow_html=True)
                    if pd.notna(row['current_price']):
                        st.metric("Current Price", f"Rs. {row['current_price']:.2f}")

                with col2:
                    if pd.notna(row['target_price']):
                        st.metric("Target Price", f"Rs. {row['target_price']:.2f}")
                    if pd.notna(row['expected_return']):
                        st.metric("Expected Return", f"{row['expected_return']:.1f}%")

                with col3:
                    if pd.notna(row['risk_reward_ratio']):
                        st.metric("Risk/Reward", f"{row['risk_reward_ratio']:.2f}")
                    if pd.notna(row['risk_level']):
                        risk_color = "🟢" if row['risk_level'] == 'LOW' else "🟡" if row['risk_level'] == 'MEDIUM' else "🔴"
                        st.write(f"{risk_color} {row['risk_level']} Risk")

                with col4:
                    if pd.notna(row['strategy_type']):
                        st.write(f"**Strategy:** {row['strategy_type']}")
                    if pd.notna(row['stop_loss']):
                        st.write(f"**Stop Loss:** Rs. {row['stop_loss']:.2f}")

                if pd.notna(row['reasoning']):
                    st.info(f"💡 {row['reasoning']}")

                st.markdown("---")

# Tab 2: Stock Screener
with tab2:
    st.header("Stock Screener")

    if stocks.empty:
        st.warning("No stock data available")
        st.info("Run `npm run scrape` to collect latest data")
    else:
        # Checkbox to show inactive stocks
        show_inactive = st.checkbox("Show Inactive Stocks", value=False, help="Include stocks that are not actively trading (suspended, delisted, or not seen in 30+ days)")

        # Search/filter
        search = st.text_input("Search stocks", placeholder="Enter symbol or name...")

        # Filter stocks - first by active status, then by search
        if show_inactive:
            # Show all stocks
            base_stocks = stocks
        else:
            # Only show active stocks
            base_stocks = stocks[stocks['is_active'] == True]

        # Then apply search filter
        if search:
            filtered = base_stocks[
                base_stocks['symbol'].str.contains(search, case=False, na=False) |
                base_stocks['name'].str.contains(search, case=False, na=False)
            ]
        else:
            filtered = base_stocks

        st.write(f"Showing {len(filtered)} stocks")

        # Show inactive warning if applicable
        if not show_inactive:
            inactive_count = len(stocks[stocks['is_active'] == False])
            if inactive_count > 0:
                st.info(f"ℹ️ {inactive_count} inactive stocks are hidden. Check 'Show Inactive Stocks' to see them.")

        # Add active/inactive status column
        def format_active_status(row):
            if pd.isna(row['is_active']) or row['is_active'] == False:
                return "🔴 Inactive"
            return "🟢 Active"

        # Create a copy to avoid modifying the original
        display_df = filtered.copy()
        display_df['status'] = display_df.apply(format_active_status, axis=1)

        # Display table
        st.dataframe(
            display_df[['symbol', 'name', 'sector', 'status', 'current_price', 'change_1d', 'pe_ratio', 'composite_score', 'risk_level']],
            column_config={
                "symbol": TextColumn("Symbol", width="medium"),
                "name": TextColumn("Name", width="large"),
                "sector": TextColumn("Sector", width="medium"),
                "status": TextColumn("Status", width="small"),
                "current_price": NumberColumn("Price", format="Rs. %.2f"),
                "change_1d": NumberColumn("1D Change %", format="%.2f%%"),
                "pe_ratio": NumberColumn("PE Ratio", format="%.2f"),
                "composite_score": NumberColumn("Score", format="%.0f"),
                "risk_level": TextColumn("Risk", width="small")
            },
            hide_index=True,
            use_container_width=True
        )

# Tab 3: Analysis
with tab3:
    st.header("Market Analysis")

    # Stock selector
    stock_symbols = stocks['symbol'].unique() if not stocks.empty else []
    selected_stock = st.selectbox("Select Stock", stock_symbols)

    if selected_stock:
        col1, col2 = st.columns(2)

        with col1:
            st.subheader(f"📊 {selected_stock} Performance")

            # Load historical data
            months = 12
            history = load_stock_history(selected_stock, months=months)

            if not history.empty:
                # Create price chart
                fig = go.Figure()
                fig.add_trace(go.Scatter(
                    x=history['time'],
                    y=history['close'],
                    mode='lines',
                    name='Close Price',
                    line=dict(color='#1f77b4', width=2)
                ))

                fig.update_layout(
                    title=f"{selected_stock} - Last {months} Months",
                    xaxis_title="Date",
                    yaxis_title="Price (Rs.)",
                    hovermode='x unified',
                    height=400
                )

                st.plotly_chart(fig, use_container_width=True)
            else:
                st.warning(f"No historical data available for {selected_stock}")

        with col2:
            st.subheader("📈 Key Metrics")

            stock_data = stocks[stocks['symbol'] == selected_stock]

            if not stock_data.empty:
                s = stock_data.iloc[0]

                # Display metrics
                if pd.notna(s['composite_score']):
                    st.metric("Composite Score", f"{s['composite_score']:.0f}/100")
                if pd.notna(s['financial_health_score']):
                    st.metric("Financial Health", f"{s['financial_health_score']:.0f}/100")
                if pd.notna(s['momentum_score']):
                    st.metric("Momentum", f"{s['momentum_score']:.0f}/100")
                if pd.notna(s['dividend_score']):
                    st.metric("Dividend Score", f"{s['dividend_score']:.0f}/100")
                if pd.notna(s['pe_ratio']):
                    st.metric("PE Ratio", f"{s['pe_ratio']:.2f}")
                if pd.notna(s['market_cap']):
                    mcap = s['market_cap'] / 1000000000
                    st.metric("Market Cap", f"Rs. {mcap:.1f}B")

                st.markdown("---")

                if pd.notna(s['risk_level']):
                    risk_color = "🟢" if s['risk_level'] == 'LOW' else "🟡" if s['risk_level'] == 'MEDIUM' else "🔴"
                    st.write(f"{risk_color} **{s['risk_level']} RISK**")

                    if pd.notna(s['volatility']):
                        st.write(f"Volatility: {s['volatility']:.2f}")
            else:
                st.warning(f"No data available for {selected_stock}")

# Tab 4: Portfolio/Holdings
with tab4:
    st.header("💼 My Portfolio")

    # Portfolio summary
    try:
        import subprocess
        import json

        # Get portfolio summary
        script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'portfolio-ops.js')

        summary_result = subprocess.run(
            ['node', script_path, 'summary', str(st.session_state.user_id)],
            capture_output=True,
            text=True
        )

        if summary_result.returncode == 0:
            summary_response = json.loads(summary_result.stdout.strip())

            if summary_response.get('success') and summary_response.get('data'):
                summary = summary_response['data']
                col1, col2, col3, col4 = st.columns(4)

                with col1:
                    st.metric("Holdings", f"{summary.get('holding_count', 0)}")

                with col2:
                    total_val = summary.get('total_value', 0)
                    st.metric("Total Value", f"Rs. {total_val:,.0f}")

                with col3:
                    total_gl = summary.get('total_gain_loss', 0)
                    gl_color = "🟢" if total_gl >= 0 else "🔴"
                    st.metric(f"{gl_color} P/L", f"Rs. {total_gl:,.0f}")

                with col4:
                    avg_ret = summary.get('avg_return_pct', 0)
                    ret_color = "🟢" if avg_ret >= 0 else "🔴"
                    st.metric(f"{ret_color} Return", f"{avg_ret:.2f}%")

        # Add holdings
        st.markdown("---")

        # Buttons row
        col_btn1, col_btn2, col_btn3 = st.columns([3, 1, 1])

        with col_btn1:
            if st.button("➕ Add Holding", use_container_width=True, type="primary"):
                st.session_state.show_add_holding = True

        with col_btn2:
            if st.button("🔄 Refresh Values", use_container_width=True):
                refresh_result = subprocess.run(
                    ['node', script_path, 'refresh', str(st.session_state.user_id)],
                    capture_output=True,
                    text=True
                )
                if refresh_result.returncode == 0:
                    st.success("✅ Portfolio values refreshed!")
                    st.rerun()

        with col_btn3:
            if st.button("🗑️ Clear All", use_container_width=True):
                # if st.confirm("Are you sure you want to delete ALL holdings?"):
                # Add delete functionality here later
                pass

        # Add holding form
        if st.session_state.get('show_add_holding', False):
            st.markdown("### ➕ Add New Holding")

            with st.form("add_holding_form"):
                new_symbol = st.text_input("Symbol", placeholder="e.g., FFC").upper()
                new_shares = st.number_input("Shares", min_value=1, value=100, step=1)
                new_avg_cost = st.number_input("Average Price (Rs.)", min_value=0.0, value=100.0, step=0.01)
                new_purchase_date = st.date_input("Purchase Date", value=datetime.now().date())

                col_add1, col_add2 = st.columns(2)

                with col_add1:
                    submitted = st.form_submit_button("Add", use_container_width=True)
                with col_add2:
                    if st.form_submit_button("Cancel"):
                        st.session_state.show_add_holding = False
                        st.rerun()

                if submitted:
                    add_result = subprocess.run(
                        ['node', script_path, 'add', str(st.session_state.user_id), new_symbol, str(new_shares), str(new_avg_cost), str(new_purchase_date)],
                        capture_output=True,
                        text=True
                    )

                    if add_result.returncode == 0:
                        add_data = json.loads(add_result.stdout.strip())
                        if add_data['success']:
                            data = add_data.get('data', {})
                            if data.get('consolidated'):
                                st.success(f"✅ Consolidated {new_symbol} position! Now holding {data.get('newShares', 0)} shares @ PKR {data.get('newAvgCost', 0)}")
                            else:
                                st.success(f"✅ Added {new_symbol} to portfolio!")
                            st.session_state.show_add_holding = False
                            time.sleep(1)
                            st.rerun()
                        else:
                            st.error(f"❌ {add_data.get('error', 'Failed to add holding')}")
                    else:
                        st.error("❌ Failed to add holding")

        # Display holdings
        holdings_result = subprocess.run(
            ['node', script_path, 'get', str(st.session_state.user_id)],
            capture_output=True,
            text=True
        )

        if holdings_result.returncode == 0:
            holdings_response = json.loads(holdings_result.stdout.strip())

            if holdings_response.get('success') and holdings_response.get('data'):
                holdings_data = holdings_response['data']

                if len(holdings_data) > 0:
                    st.markdown("### Your Holdings")

                    # Display as table (same style as screener)
                    holdings_df = pd.DataFrame(holdings_data)

                    # Store original symbols for expanders
                    holdings_df['symbol_original'] = holdings_df['symbol'].copy()

                    # Create clickable link column
                    holdings_df['symbol_link'] = holdings_df['symbol'].apply(
                        lambda x: f'https://sarmaaya.pk/stocks/{x}'
                    )

                    # Table header
                    header_cols = st.columns([2, 3, 1, 1.5, 1.5, 1.5, 1.5, 1.5, 1])
                    with header_cols[0]:
                        st.markdown("**Symbol**")
                    with header_cols[1]:
                        st.markdown("**Name**")
                    with header_cols[2]:
                        st.markdown("**Shares**")
                    with header_cols[3]:
                        st.markdown("**Avg Cost**")
                    with header_cols[4]:
                        st.markdown("**Current Price**")
                    with header_cols[5]:
                        st.markdown("**Current Value**")
                    with header_cols[6]:
                        st.markdown("**Gain/Loss**")
                    with header_cols[7]:
                        st.markdown("**Purchase Date**")
                    with header_cols[8]:
                        st.markdown("**Action**")

                    st.markdown("---")

                    # Display dataframe with clickable symbols and delete button
                    for idx, row in holdings_df.iterrows():
                        cols = st.columns([2, 3, 1, 1.5, 1.5, 1.5, 1.5, 1.5, 1])

                        # Symbol (clickable)
                        with cols[0]:
                            st.markdown(f'<a href="{row["symbol_link"]}" target="_blank" style="text-decoration: none; color: #1f77b4;">{row["symbol_original"]}</a>', unsafe_allow_html=True)

                        # Name
                        with cols[1]:
                            st.write(row['name'])

                        # Shares
                        with cols[2]:
                            st.write(f"{int(row['shares'])}")

                        # Avg Cost
                        with cols[3]:
                            st.write(f"Rs. {row['avg_cost']:.2f}")

                        # Current Price
                        with cols[4]:
                            st.write(f"Rs. {row['current_price']:.2f}")

                        # Current Value
                        with cols[5]:
                            st.write(f"Rs. {row['current_value']:.2f}")

                        # Gain/Loss
                        with cols[6]:
                            gl = row['unrealized_gain_loss']
                            color = "🔴" if gl < 0 else "🟢"
                            st.write(f"{color} Rs. {gl:.2f}")

                        # Purchase Date
                        with cols[7]:
                            st.write(str(row['purchase_date']))

                        # Delete button (or confirmation buttons)
                        with cols[8]:
                            delete_key = f'delete_confirm_{row["id"]}'

                            if not st.session_state.get(delete_key, False):
                                # Show delete button
                                if st.button("🗑️", key=f"delete_{row['id']}", help="Delete this holding"):
                                    st.session_state[delete_key] = True
                                    st.rerun()
                            else:
                                # Show confirmation buttons
                                col_check, col_close = st.columns(2)

                                with col_check:
                                    if st.button("✅", key=f"confirm_delete_{row['id']}", help="Confirm delete"):
                                        # Call delete operation
                                        delete_result = subprocess.run(
                                            ['node', script_path, 'delete', str(st.session_state.user_id), str(row['id'])],
                                            capture_output=True,
                                            text=True
                                        )

                                        if delete_result.returncode == 0:
                                            st.session_state[delete_key] = False
                                            st.success(f"✅ Deleted {row['symbol_original']} from portfolio!")
                                            time.sleep(1)
                                            st.rerun()
                                        else:
                                            st.error("❌ Failed to delete holding")

                                with col_close:
                                    if st.button("❌", key=f"cancel_delete_{row['id']}", help="Cancel"):
                                        st.session_state[delete_key] = False
                                        st.rerun()

                        st.markdown("""<style>div[data-testid="stHorizontalBlock"] > div { padding: 2px 0; }</style>""", unsafe_allow_html=True)

                    # Summary metrics
                    total_invested = (holdings_df['avg_cost'] * holdings_df['shares']).sum()
                    total_current = holdings_df['current_value'].sum()
                    total_gl = holdings_df['unrealized_gain_loss'].sum()

                    st.markdown("---")
                    st.markdown("### Portfolio Summary")
                    col_sum1, col_sum2, col_sum3 = st.columns(3)
                    col_sum1.metric("Total Invested", f"Rs. {total_invested:,.0f}")
                    col_sum2.metric("Current Value", f"Rs. {total_current:,.0f}")
                    col_sum3.metric("Total Gain/Loss", f"Rs. {total_gl:,.0f}")

    except Exception as e:
        st.error(f"Error loading portfolio: {e}")

# Footer - Logout at bottom
st.sidebar.markdown("---")
st.sidebar.markdown("---")

if st.sidebar.button("🚪 Logout", use_container_width=True, key="sidebar_logout"):
    # Clear remember token from database if exists
    if 'token' in st.query_params:
        try:
            import subprocess
            script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../delete_token.js')

            subprocess.run(
                ['node', script_path, st.query_params['token']],
                capture_output=True,
                text=True,
                timeout=5
            )
        except:
            pass

        # Clear token from URL
        st.query_params.clear()

    # Clear session
    for key in list(st.session_state.keys()):
        del st.session_state[key]

    st.rerun()
