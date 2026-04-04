import { createClient } from '@supabase/supabase-js';

// ⚠️ 替换为你自己的 Supabase 项目信息
// 在 Supabase Dashboard > Settings > API 中找到
const SUPABASE_URL = 'https://ulowtczgntrplocjsroe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsb3d0Y3pnbnRycGxvY2pzcm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNjAzMzgsImV4cCI6MjA5MDgzNjMzOH0.iifs-hz-B2CbS4DxtFQQI888yvmxdlHPab1jJada3RE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ═══ 数据操作函数 ═══

// 登录（用PIN码）
export async function login(name, pin) {
  const { data, error } = await supabase
    .from('players')
    .select('id, name')
    .eq('name', name)
    .eq('pin', pin)
    .single();
  if (error) return null;
  return data;
}

// 注册新玩家
export async function register(name, pin) {
  const { data, error } = await supabase.rpc('setup_new_player', {
    p_name: name,
    p_pin: pin,
  });
  if (error) { console.error('Register error:', error); return null; }
  return data; // returns player_id
}

// 读取玩家核心数据
export async function getPlayerData(playerId) {
  const { data, error } = await supabase
    .from('player_data')
    .select('*')
    .eq('player_id', playerId)
    .single();
  if (error) return null;
  return data;
}

// 更新属性值
export async function updateStats(playerId, stats) {
  const { error } = await supabase
    .from('player_data')
    .update({
      power: stats.power,
      wisdom: stats.wisdom,
      vitality: stats.vitality,
      mew_level: stats.mewLevel,
      mew_xp: stats.mewXp,
      streak: stats.streak,
      last_checkin: stats.lastCheckin,
      updated_at: new Date().toISOString(),
    })
    .eq('player_id', playerId);
  return !error;
}

// 获取今日任务
export async function getTodayTasks(playerId) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data;
}

// 完成任务
export async function completeTask(taskId) {
  const { error } = await supabase
    .from('tasks')
    .update({ done: true, done_at: new Date().toISOString() })
    .eq('id', taskId);
  return !error;
}

// 重置每日任务（每天凌晨调用）
export async function resetDailyTasks(playerId) {
  const { error } = await supabase
    .from('tasks')
    .update({ done: false, done_at: null })
    .eq('player_id', playerId);
  return !error;
}

// 记录成长日志
export async function logGrowth(playerId, category, xpGained, note) {
  const { error } = await supabase
    .from('growth_logs')
    .insert({ player_id: playerId, category, xp_gained: xpGained, note });
  return !error;
}

// 获取成长记录（最近30天）
export async function getGrowthLogs(playerId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('growth_logs')
    .select('*')
    .eq('player_id', playerId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });
  if (error) return [];
  return data;
}

// 获取里程碑
export async function getMilestones(playerId) {
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('player_id', playerId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data;
}

// 获取梦幻技能
export async function getMewSkills(playerId) {
  const { data, error } = await supabase
    .from('mew_skills')
    .select('*')
    .eq('player_id', playerId)
    .order('skill_name', { ascending: true });
  if (error) return [];
  return data;
}

// 解锁新技能
export async function unlockSkill(playerId, skillName) {
  const { error } = await supabase
    .from('mew_skills')
    .update({ unlocked: true, unlocked_at: new Date().toISOString() })
    .eq('player_id', playerId)
    .eq('skill_name', skillName);
  return !error;
}
