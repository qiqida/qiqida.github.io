-- 留言反馈表
CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT,
    content     TEXT NOT NULL,
    ip_hash     TEXT,
    user_agent  TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    status      TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
