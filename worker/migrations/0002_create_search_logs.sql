-- 搜索词记录表
--
-- 用途：知道学生实际在搜什么。
--   · 发现「想搜但搜不到」的功能缺口
--   · 发现学生用的说法（叫「校园卡」而不是「一卡通」）
--   · 后续可用来自动生成「常见搜索词」
--
-- 隐私：只存关键词本身，不存任何能定位到个人的信息。
--   IP 只存哈希（且哈希后截断），用于粗略去重，不做个人追踪。
CREATE TABLE IF NOT EXISTS search_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword     TEXT NOT NULL,
    ip_hash     TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 按关键词查（看某个词被搜了多少次）
CREATE INDEX IF NOT EXISTS idx_search_logs_keyword ON search_logs(keyword);

-- 按时间查（看最近的搜索）
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at DESC);
