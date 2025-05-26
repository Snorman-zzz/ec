-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    company_name TEXT,
    founding_team_size INTEGER DEFAULT 0,
    is_full_questionnaire_complete BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Founders table
CREATE TABLE IF NOT EXISTS founders (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    position INTEGER NOT NULL,
    cash_invested REAL DEFAULT 0,
    time_commitment REAL DEFAULT 0,
    assets_contributed REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Reserved pools table
CREATE TABLE IF NOT EXISTS reserved_pools (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    pool_name TEXT NOT NULL,
    weight REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Ratings table (for Q7-Q9 ratings)
CREATE TABLE IF NOT EXISTS ratings (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    rating_financial_impact INTEGER DEFAULT 3,
    rating_time_importance INTEGER DEFAULT 3,
    rating_asset_importance INTEGER DEFAULT 3,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Equity distribution adjustments table
CREATE TABLE IF NOT EXISTS equity_adjustments (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    category TEXT NOT NULL,
    weight REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Factors table (for additional equity factors)
CREATE TABLE IF NOT EXISTS factors (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    factor_type TEXT NOT NULL, -- 'coreFactors', 'preFormation', 'roleResponsibility', 'experienceNetworks'
    factor_name TEXT NOT NULL,
    founder_name TEXT NOT NULL,
    allocation REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Visited questions tracking
CREATE TABLE IF NOT EXISTS visited_questions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    question_part INTEGER NOT NULL, -- 1 or 2
    question_index INTEGER NOT NULL,
    visited BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    UNIQUE(workspace_id, question_part, question_index)
);

-- Session tracking table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Visitor tracking table
CREATE TABLE IF NOT EXISTS visitors (
    id TEXT PRIMARY KEY,
    session_id TEXT UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    country TEXT,
    city TEXT,
    referrer TEXT,
    landing_page TEXT,
    first_visit DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_visit DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_visits INTEGER DEFAULT 1,
    is_bot BOOLEAN DEFAULT FALSE
);

-- Page views table
CREATE TABLE IF NOT EXISTS page_views (
    id TEXT PRIMARY KEY,
    visitor_id TEXT,
    session_id TEXT,
    page_url TEXT NOT NULL,
    page_title TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    time_on_page INTEGER, -- seconds
    FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE
);

-- User events table
CREATE TABLE IF NOT EXISTS user_events (
    id TEXT PRIMARY KEY,
    visitor_id TEXT,
    session_id TEXT,
    event_type TEXT NOT NULL, -- 'click', 'form_submit', 'download', 'error', etc.
    event_category TEXT,
    event_action TEXT,
    event_label TEXT,
    event_value REAL,
    page_url TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT, -- JSON string for additional data
    FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE
);

-- Conversion funnel table
CREATE TABLE IF NOT EXISTS conversions (
    id TEXT PRIMARY KEY,
    visitor_id TEXT,
    session_id TEXT,
    funnel_step TEXT NOT NULL, -- 'landing', 'started_calc', 'completed_calc', 'downloaded_report'
    workspace_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
);

-- Feature usage table
CREATE TABLE IF NOT EXISTS feature_usage (
    id TEXT PRIMARY KEY,
    visitor_id TEXT,
    feature_name TEXT NOT NULL,
    usage_count INTEGER DEFAULT 1,
    first_used DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_founders_workspace_id ON founders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reserved_pools_workspace_id ON reserved_pools(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ratings_workspace_id ON ratings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_equity_adjustments_workspace_id ON equity_adjustments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_factors_workspace_id ON factors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_visited_questions_workspace_id ON visited_questions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_visitors_session_id ON visitors(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor_id ON page_views(visitor_id);
CREATE INDEX IF NOT EXISTS idx_page_views_timestamp ON page_views(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_events_visitor_id ON user_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_user_events_event_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_timestamp ON user_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversions_visitor_id ON conversions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_conversions_funnel_step ON conversions(funnel_step);
CREATE INDEX IF NOT EXISTS idx_feature_usage_visitor_id ON feature_usage(visitor_id);