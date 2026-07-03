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
from datetime import datetime, timedelta
from streamlit.column_config import TextColumn, NumberColumn

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Page config
st.set_page_config(
    page_title="PSX Stock Analysis",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

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
        query = f"""
        SELECT * FROM v_top_recommendations
        WHERE timeframe = '{timeframe}'
        ORDER BY recommendation_rank
        """
        df = pd.read_sql_query(query, conn)
        conn.close()
        return df
    except Exception as e:
        st.error(f"Error loading recommendations: {e}")
        if conn:
            conn.close()
        return pd.DataFrame()

def load_stock_history(symbol, days=90):
    """Load historical data for a stock"""
    conn = get_db_connection()
    if not conn:
        return pd.DataFrame()

    try:
        query = f"""
        SELECT time, open, high, low, close, volume
        FROM stock_daily_data
        WHERE symbol = '{symbol}'
          AND time >= NOW() - INTERVAL '{days} days'
        ORDER BY time ASC
        """
        df = pd.read_sql_query(query, conn)
        conn.close()
        return df
    except Exception as e:
        st.error(f"Error loading history: {e}")
        if conn:
            conn.close()
        return pd.DataFrame()

def load_sector_performance():
    """Load sector performance data"""
    conn = get_db_connection()
    if not conn:
        return pd.DataFrame()

    try:
        query = "SELECT * FROM sector_performance WHERE time = (SELECT MAX(time) FROM sector_performance)"
        df = pd.read_sql_query(query, conn)
        conn.close()
        return df
    except Exception as e:
        st.error(f"Error loading sector data: {e}")
        if conn:
            conn.close()
        return pd.DataFrame()

# Initialize session state
if 'last_update' not in st.session_state:
    st.session_state.last_update = datetime.now()

# Main app
def main():
    # Header
    st.markdown('<h1 class="main-header">📈 PSX Stock Analysis Dashboard</h1>', unsafe_allow_html=True)

    # Disclaimer
    with st.expander("⚠️ Disclaimer", expanded=False):
        st.markdown("""
        <div class="disclaimer">
        <strong>LEGAL NOTICE:</strong> This dashboard is for educational purposes only and does NOT constitute financial advice.
        <br><br>
        <strong>Always do your own research and consult with a qualified financial advisor before making investment decisions.</strong>
        <br><br>
        The PSX website restricts automated data collection. For authorized data access, contact: marketdatarequest@psx.com.pk
        </div>
        """, unsafe_allow_html=True)

    # Sidebar
    with st.sidebar:
        st.header("⚙️ Settings")

        page = st.radio(
            "Navigate",
            ["Dashboard", "Stock Screener", "Recommendations", "Stock Details", "Sector Analysis"],
            label_visibility="collapsed"
        )

        st.divider()

        # Last update
        st.caption(f"Last updated: {st.session_state.last_update.strftime('%Y-%m-%d %H:%M:%S')}")

        if st.button("Refresh Data"):
            st.session_state.last_update = datetime.now()
            st.rerun()

    # Pages
    if page == "Dashboard":
        show_dashboard()
    elif page == "Stock Screener":
        show_screener()
    elif page == "Recommendations":
        show_recommendations()
    elif page == "Stock Details":
        show_stock_details()
    elif page == "Sector Analysis":
        show_sector_analysis()

def show_dashboard():
    """Main dashboard overview"""
    st.header("📊 Market Overview")

    # Load data
    df = load_latest_stocks()

    if df.empty:
        st.warning("No data available. Please run the scraper and analyzer first.")
        st.code("npm run pipeline")
        return

    # Metrics
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric("Total Stocks", len(df))

    with col2:
        avg_score = df['composite_score'].mean()
        st.metric("Avg Composite Score", f"{avg_score:.1f}")

    with col3:
        high_score = (df['composite_score'] >= 70).sum()
        st.metric("High Scoring (70+)", high_score)

    with col4:
        avg_pe = df['pe_ratio'].mean()
        st.metric("Avg P/E Ratio", f"{avg_pe:.1f}" if pd.notna(avg_pe) else "N/A")

    st.divider()

    # Top stocks
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("🏆 Top 10 by Composite Score")

        top10 = df.head(10).copy()
        top10['rank'] = range(1, 11)

        # Display with column configuration
        st.dataframe(
            top10[['rank', 'symbol', 'name', 'sector', 'composite_score', 'current_price', 'risk_level']],
            column_config={
                "symbol": TextColumn("Symbol", width="medium"),
                "composite_score": NumberColumn(
                    "Composite Score",
                    help="Overall composite analysis score",
                    format="%d"
                ),
            },
            use_container_width=True,
            hide_index=True
        )

    with col2:
        st.subheader("📈 Top Momentum")

        top_momentum = df.nlargest(10, 'momentum_score')[['symbol', 'name', 'momentum_score', 'change_1m', 'change_1y']].copy()

        st.dataframe(
            top_momentum,
            column_config={
                "symbol": TextColumn("Symbol", width="medium"),
                "momentum_score": NumberColumn(
                    "Momentum Score",
                    help="Momentum analysis score",
                    format="%d"
                ),
            },
            use_container_width=True,
            hide_index=True
        )

    # Score distribution chart
    st.subheader("Score Distribution")

    col1, col2 = st.columns(2)

    with col1:
        fig1 = px.histogram(df, x='composite_score', nbins=20, title="Composite Score Distribution",
                           labels={'composite_score': 'Composite Score'})
        fig1.update_layout(height=300)
        st.plotly_chart(fig1, use_container_width=True)

    with col2:
        fig2 = px.box(df, y=['financial_health_score', 'momentum_score', 'dividend_score'],
                     title="Score Distribution by Category")
        fig2.update_layout(height=300)
        st.plotly_chart(fig2, use_container_width=True)

def show_screener():
    """Interactive stock screener"""
    st.header("🔍 Stock Screener")

    df = load_latest_stocks()

    if df.empty:
        st.warning("No data available")
        return

    # Filters
    with st.expander("Filters", expanded=True):
        col1, col2, col3, col4 = st.columns(4)

        with col1:
            sector_filter = st.selectbox("Sector", ["All"] + sorted(df['sector'].unique().tolist()))

        with col2:
            risk_filter = st.selectbox("Risk Level", ["All", "LOW", "MEDIUM", "HIGH"])

        with col3:
            min_score = st.slider("Min Composite Score", 0, 100, 0)

        with col4:
            max_pe = st.number_input("Max P/E Ratio", value=1000, min_value=0, step=5)

    # Apply filters
    filtered_df = df.copy()

    if sector_filter != "All":
        filtered_df = filtered_df[filtered_df['sector'] == sector_filter]

    if risk_filter != "All":
        filtered_df = filtered_df[filtered_df['risk_level'] == risk_filter]

    filtered_df = filtered_df[filtered_df['composite_score'] >= min_score]

    if max_pe < 1000:
        filtered_df = filtered_df[filtered_df['pe_ratio'] <= max_pe]

    st.write(f"Showing {len(filtered_df)} stocks")

    # Display table
    display_cols = ['symbol', 'name', 'sector', 'current_price', 'pe_ratio', 'dividend_yield',
                    'composite_score', 'momentum_score', 'financial_health_score', 'risk_level']

    st.dataframe(
        filtered_df[display_cols].sort_values('composite_score', ascending=False),
        use_container_width=True,
        hide_index=True
    )

def show_recommendations():
    """Investment recommendations by timeframe"""
    st.header("💡 Investment Recommendations")

    timeframe = st.selectbox("Timeframe", ["SHORT", "MEDIUM", "LONG"], index=0)

    df = load_recommendations(timeframe)

    if df.empty:
        st.warning(f"No {timeframe}-TERM recommendations available. Run the pipeline first.")
        st.code("npm run strategies -- --timeframe " + timeframe.lower())
        return

    st.subheader(f"{timeframe}-TERM Top Recommendations")

    # Display recommendations
    for i, row in df.head(5).iterrows():
        with st.expander(
            f"#{row['recommendation_rank']} {row['symbol']} - {row['name']} ({row['strategy_type']})",
            expanded=False
        ):
            # Add clickable link to sarmaaya.pk
            url = f"https://sarmaaya.pk/stocks/{row['symbol']}"
            st.markdown(f"🔗 **View on Sarmaaya.pk:** [{row['symbol']}]({url})", unsafe_allow_html=True)
            st.markdown("---")

            col1, col2, col3 = st.columns(3)
            col1, col2, col3 = st.columns(3)

            with col1:
                st.metric("Current Price", f"PKR {row['current_price']:.2f}")
                st.metric("Target Price", f"PKR {row['target_price']:.2f}")

            with col2:
                st.metric("Expected Return", f"{row['expected_return']}%")
                st.metric("Risk/Reward", f"{row['risk_reward_ratio']}")

            with col3:
                st.metric("Stop Loss", f"PKR {row['stop_loss']:.2f}")
                st.metric("Composite Score", f"{row['composite_score']:.0f}")

            st.markdown("**Reasoning:**")
            st.text(row['reasoning'])

def show_stock_details():
    """Detailed view for individual stocks"""
    st.header("📄 Stock Details")

    symbol = st.text_input("Enter Symbol", value="KEL", max_chars=10).upper()

    if not symbol:
        return

    # Load stock data
    df = load_latest_stocks()

    if df.empty:
        st.warning("No data available")
        return

    stock = df[df['symbol'] == symbol]

    if stock.empty:
        st.error(f"Stock {symbol} not found")
        return

    stock = stock.iloc[0]

    # Overview
    col1, col2, col3 = st.columns(3)

    with col1:
        st.metric("Symbol", stock['symbol'])
        st.metric("Name", stock['name'])

    with col2:
        st.metric("Sector", stock['sector'])
        st.metric("Current Price", f"PKR {stock['current_price']:.2f}")

    with col3:
        st.metric("Risk Level", stock['risk_level'])
        if 'liquidity_score' in stock.index and pd.notna(stock['liquidity_score']):
            st.metric("Liquidity Score", f"{stock['liquidity_score']:.0f}")
        else:
            st.metric("Liquidity Score", "N/A")

    st.divider()

    # Scores
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("Analysis Scores")
        score_data = {
            'Financial Health': stock['financial_health_score'],
            'Momentum': stock['momentum_score'],
            'Dividend': stock['dividend_score'],
            'Sector': stock['sector_score'],
            'Composite': stock['composite_score']
        }

        for score_name, score_val in score_data.items():
            # Progress bar
            color = 'normal'
            if score_val >= 70: color = 'rgb(0, 128, 0)'
            elif score_val < 50: color = 'rgb(255, 0, 0)'

            st.write(f"**{score_name}**: {score_val:.0f}/100")
            st.progress(score_val / 100)

    with col2:
        st.subheader("Performance")

        perf_data = {
            '1 Day': stock['change_1d'],
            '1 Month': stock['change_1m'],
            '1 Year': stock['change_1y']
        }

        for period, change in perf_data.items():
            if pd.notna(change):
                delta = f"{change:.2f}%"
                st.metric(period, delta, delta if change > 0 else None)
            else:
                st.metric(period, "N/A")

    st.divider()

    # Historical chart
    st.subheader("Price History")

    history = load_stock_history(symbol, days=90)

    if not history.empty:
        fig = go.Figure()

        fig.add_trace(go.Candlestick(
            x=history['time'],
            open=history['open'],
            high=history['high'],
            low=history['low'],
            close=history['close'],
            name='Price'
        ))

        fig.update_layout(
            title=f"{symbol} - Last 90 Days",
            xaxis_title="Date",
            yaxis_title="Price (PKR)",
            height=400
        )

        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No historical data available")

def show_sector_analysis():
    """Sector performance analysis"""
    st.header("🏢 Sector Analysis")

    sector_df = load_sector_performance()

    if sector_df.empty:
        st.warning("No sector data available")
        return

    # Sector metrics
    col1, col2, col3 = st.columns(3)

    with col1:
        st.metric("Total Sectors", len(sector_df))

    with col2:
        avg_momentum = sector_df['momentum_score'].mean()
        st.metric("Avg Momentum Score", f"{avg_momentum:.1f}")

    with col3:
        best_sector = sector_df.loc[sector_df['momentum_score'].idxmax(), 'sector']
        st.metric("Best Performing Sector", best_sector)

    st.divider()

    # Sector table
    display_cols = ['sector', 'momentum_score', 'change_1m', 'change_3m', 'avg_pe_ratio', 'avg_dividend_yield']

    st.dataframe(
        sector_df[display_cols].sort_values('momentum_score', ascending=False),
        use_container_width=True,
        hide_index=True
    )

    # Charts
    col1, col2 = st.columns(2)

    with col1:
        fig1 = px.bar(
            sector_df.sort_values('momentum_score', ascending=False).head(10),
            x='momentum_score',
            y='sector',
            orientation='h',
            title="Sector Momentum Score"
        )
        st.plotly_chart(fig1, use_container_width=True)

    with col2:
        fig2 = px.scatter(
            sector_df,
            x='change_3m',
            y='avg_dividend_yield',
            size='num_stocks',
            hover_name='sector',
            title="Sectors: 3M Change vs Dividend Yield"
        )
        st.plotly_chart(fig2, use_container_width=True)

# Footer
st.divider()
st.markdown("""
<center>
<small>
PSX Stock Analysis System • Data from PSX Screener • Last updated: {}
</small>
</center>
""".format(st.session_state.last_update.strftime("%Y-%m-%d %H:%M:%S")), unsafe_allow_html=True)

if __name__ == "__main__":
    main()
