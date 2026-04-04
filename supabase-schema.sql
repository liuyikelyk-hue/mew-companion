-- ═══════════════════════════════════════
-- MEW COMPANION — Supabase 数据库结构
-- 在 Supabase Dashboard > SQL Editor 中执行
-- ═══════════════════════════════════════

-- 用户表（用PIN码登录，不需要复杂账号体系）
CREATE TABLE IF NOT EXISTS players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Leon',
  pin TEXT NOT NULL DEFAULT '1234',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 核心数据表
CREATE TABLE IF NOT EXISTS player_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  -- 梦幻属性
  mew_level INTEGER DEFAULT 1,
  mew_xp INTEGER DEFAULT 0,
  mew_mood TEXT DEFAULT 'idle',
  -- Leon 的三大属性
  power INTEGER DEFAULT 0,
  wisdom INTEGER DEFAULT 0,
  vitality INTEGER DEFAULT 0,
  -- 打卡
  streak INTEGER DEFAULT 0,
  last_checkin DATE,
  -- 时间戳
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id)
);

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  icon TEXT NOT NULL,
  title TEXT NOT NULL,
  minutes INTEGER DEFAULT 15,
  category TEXT NOT NULL, -- 'power' | 'wisdom' | 'vitality'
  done BOOLEAN DEFAULT FALSE,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 成长记录表
CREATE TABLE IF NOT EXISTS growth_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'power' | 'wisdom' | 'vitality'
  xp_gained INTEGER DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 里程碑表
CREATE TABLE IF NOT EXISTS milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  achieved BOOLEAN DEFAULT FALSE,
  achieved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 梦幻技能表
CREATE TABLE IF NOT EXISTS mew_skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  unlocked BOOLEAN DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  UNIQUE(player_id, skill_name)
);

-- 插入默认数据的函数
CREATE OR REPLACE FUNCTION setup_new_player(p_name TEXT, p_pin TEXT)
RETURNS UUID AS $$
DECLARE
  new_player_id UUID;
BEGIN
  -- 创建玩家
  INSERT INTO players (name, pin) VALUES (p_name, p_pin) RETURNING id INTO new_player_id;
  
  -- 初始化数据
  INSERT INTO player_data (player_id) VALUES (new_player_id);
  
  -- 默认任务
  INSERT INTO tasks (player_id, icon, title, minutes, category) VALUES
    (new_player_id, '⚽', '足球时间', 15, 'power'),
    (new_player_id, '📖', '英文故事朗读', 10, 'wisdom'),
    (new_player_id, '🤸', '体操拉伸训练', 10, 'vitality');
  
  -- 默认里程碑
  INSERT INTO milestones (player_id, title) VALUES
    (new_player_id, '连续打卡 7 天'),
    (new_player_id, '梦幻达到 Lv.5'),
    (new_player_id, '完成 30 次足球训练'),
    (new_player_id, '英文朗读 50 篇'),
    (new_player_id, '体操训练 20 次'),
    (new_player_id, '梦幻学会 10 个技能');
  
  -- 默认技能（部分解锁）
  INSERT INTO mew_skills (player_id, skill_name, unlocked, unlocked_at) VALUES
    (new_player_id, '念力', true, NOW()),
    (new_player_id, '影子球', true, NOW()),
    (new_player_id, '高速移动', false, NULL),
    (new_player_id, '瞬间移动', false, NULL),
    (new_player_id, '精神冲击', false, NULL),
    (new_player_id, '屏障', false, NULL),
    (new_player_id, '冥想', false, NULL),
    (new_player_id, '治愈之愿', false, NULL),
    (new_player_id, '超能力', false, NULL),
    (new_player_id, '变身', false, NULL);
  
  RETURN new_player_id;
END;
$$ LANGUAGE plpgsql;

-- 启用 Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE mew_skills ENABLE ROW LEVEL SECURITY;

-- 公开访问策略（因为我们用PIN码而非Supabase Auth）
CREATE POLICY "Public access" ON players FOR ALL USING (true);
CREATE POLICY "Public access" ON player_data FOR ALL USING (true);
CREATE POLICY "Public access" ON tasks FOR ALL USING (true);
CREATE POLICY "Public access" ON growth_logs FOR ALL USING (true);
CREATE POLICY "Public access" ON milestones FOR ALL USING (true);
CREATE POLICY "Public access" ON mew_skills FOR ALL USING (true);
