import { useState, useEffect, useRef, useCallback } from 'react';
import * as db from './lib/supabase';

const MEW_MAP = {
  idle: '/mew-idle.gif',
  happy: '/mew-happy.gif',
  excited: '/mew-excited.gif',
  thinking: '/mew-idle.gif',
  skill: '/mew-excited.gif',
  surprised: '/mew-happy.gif',
};

const Pokeball = ({ size = 20, color = '#E03030' }) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="18" fill="none" stroke={color} strokeWidth="2.5" />
    <line x1="2" y1="20" x2="38" y2="20" stroke={color} strokeWidth="2.5" />
    <circle cx="20" cy="20" r="6" fill="none" stroke={color} strokeWidth="2.5" />
    <circle cx="20" cy="20" r="3" fill={color} />
  </svg>
);

const AttrBar = ({ label, icon, value, max, color, bg }) => (
  <div style={{ background: bg, borderRadius: 14, padding: '10px 12px', flex: 1, border: `2px solid ${color}25` }}>
    <div className="flex items-center gap-1.5" style={{ marginBottom: 6 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{label}</span>
      <span style={{ fontSize: 10, color: `${color}99`, marginLeft: 'auto', fontWeight: 600 }}>{value}</span>
    </div>
    <div style={{ height: 7, background: 'rgba(0,0,0,0.08)', borderRadius: 7 }}>
      <div style={{ width: `${Math.min(value / max, 1) * 100}%`, height: '100%', borderRadius: 7, background: color, transition: 'width 0.8s ease', boxShadow: `0 0 6px ${color}40` }} />
    </div>
  </div>
);

const Timer = ({ initMin = 15, label, onComplete }) => {
  const [sec, setSec] = useState(initMin * 60);
  const [on, setOn] = useState(false);
  const [m, setM] = useState(initMin);
  const iv = useRef(null);
  useEffect(() => {
    if (on && sec > 0) iv.current = setInterval(() => setSec(s => { if (s <= 1) { clearInterval(iv.current); setOn(false); onComplete?.(); return 0; } return s - 1; }), 1000);
    return () => clearInterval(iv.current);
  }, [on]);
  const r = 50, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: 120, height: 120 }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#F0E0E8" strokeWidth="7" />
          <circle cx="60" cy="60" r={r} fill="none" stroke="#E03030" strokeWidth="7" strokeDasharray={c} strokeDashoffset={c * (1 - sec / (m * 60))} strokeLinecap="round" transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span style={{ fontFamily: "'Chakra Petch'", fontSize: 26, color: '#2D3748', fontWeight: 700 }}>{String(Math.floor(sec / 60)).padStart(2, '0')}:{String(sec % 60).padStart(2, '0')}</span>
          <span style={{ fontSize: 9, color: '#AAA' }}>{label}</span>
        </div>
      </div>
      <div className="flex gap-2">
        {!on ? <>
          <button onClick={() => { setSec(m * 60); setOn(true); }} style={{ background: '#E03030', color: 'white', padding: '8px 20px', borderRadius: 24, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>▶ 开始</button>
          <button onClick={() => setSec(m * 60)} style={{ background: '#F7FAFC', color: '#888', padding: '8px 20px', borderRadius: 24, fontSize: 13, fontWeight: 600, border: '2px solid #E8E8E8', cursor: 'pointer' }}>↻ 重置</button>
        </> : <button onClick={() => { setOn(false); clearInterval(iv.current); }} style={{ background: '#ED8936', color: 'white', padding: '8px 20px', borderRadius: 24, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>⏸ 暂停</button>}
      </div>
      {!on && <div className="flex gap-1.5">{[5, 10, 15, 20, 30].map(v => <button key={v} onClick={() => { setM(v); setSec(v * 60); }} style={{ padding: '4px 10px', borderRadius: 14, fontSize: 11, fontWeight: 600, background: m === v ? '#FFF0F0' : '#FAFAFA', color: m === v ? '#E03030' : '#AAA', border: m === v ? '1.5px solid #E0303040' : '1.5px solid #EEE', cursor: 'pointer' }}>{v}分</button>)}</div>}
    </div>
  );
};

const VoiceWave = ({ active, color = '#E03030' }) => {
  const [bars, setBars] = useState(Array(16).fill(3));
  useEffect(() => { if (!active) { setBars(Array(16).fill(3)); return; } const iv = setInterval(() => setBars(Array(16).fill(0).map(() => 3 + Math.random() * 20)), 100); return () => clearInterval(iv); }, [active]);
  return <div className="flex items-center justify-center gap-0.5" style={{ height: 24 }}>{bars.map((h, i) => <div key={i} style={{ width: 2.5, height: h, borderRadius: 2, background: color, opacity: active ? 0.7 : 0.2, transition: 'height 0.08s ease' }} />)}</div>;
};

// ═══ LOGIN SCREEN ═══
const LoginScreen = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || pin.length < 4) { setError('请输入名字和4位PIN码'); return; }
    setLoading(true); setError('');
    if (isNew) {
      const playerId = await db.register(name.trim(), pin);
      if (playerId) onLogin({ id: playerId, name: name.trim() });
      else setError('注册失败，请重试');
    } else {
      const player = await db.login(name.trim(), pin);
      if (player) onLogin(player);
      else setError('名字或PIN码不对');
    }
    setLoading(false);
  };

  return (
    <div style={{ width: '100%', maxWidth: 420, minHeight: '100vh', margin: '0 auto', background: 'linear-gradient(180deg,#E8F4FD,#FFF5F5,#FFFAF0)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="mew-float" style={{ marginBottom: 20 }}>
        <img src="/mew-idle.gif" alt="Mew" style={{ width: 180, borderRadius: 20 }} />
      </div>
      <h1 style={{ fontFamily: "'Chakra Petch'", fontSize: 22, fontWeight: 700, color: '#E03030', marginBottom: 4 }}>MEW COMPANION</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>{isNew ? '创建你的训练师档案' : '欢迎回来，训练师！'}</p>

      <div style={{ width: '100%', maxWidth: 300 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="你的名字" style={{ width: '100%', padding: '12px 16px', borderRadius: 14, border: '2px solid #F0F0F0', fontSize: 15, marginBottom: 10, background: 'white' }} />
        <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="4位PIN码" type="password" inputMode="numeric" maxLength={4} style={{ width: '100%', padding: '12px 16px', borderRadius: 14, border: '2px solid #F0F0F0', fontSize: 15, marginBottom: 10, background: 'white', letterSpacing: 8 }} />
        {error && <p style={{ color: '#E03030', fontSize: 12, marginBottom: 8 }}>{error}</p>}
        <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', padding: '12px', borderRadius: 14, background: '#E03030', color: 'white', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? '请稍候...' : isNew ? '🎮 开始冒险！' : '🔮 进入'}
        </button>
        <button onClick={() => { setIsNew(!isNew); setError(''); }} style={{ width: '100%', padding: '10px', borderRadius: 14, background: 'transparent', color: '#888', fontSize: 13, border: 'none', cursor: 'pointer', marginTop: 8 }}>
          {isNew ? '已有档案？去登录' : '第一次来？创建档案'}
        </button>
      </div>
    </div>
  );
};

// ═══ MAIN APP ═══
export default function App() {
  const [player, setPlayer] = useState(null);
  const [page, setPage] = useState('home');
  const [stats, setStats] = useState({ power: 0, wisdom: 0, vitality: 0 });
  const [mewMood, setMewMood] = useState('idle');
  const [mewMsg, setMewMsg] = useState('今天也要一起加油哦！');
  const [tasks, setTasks] = useState([]);
  const [activeTimer, setActiveTimer] = useState(null);
  const [streak, setStreak] = useState(0);
  const [mewLv, setMewLv] = useState(1);
  const [mewXp, setMewXp] = useState(0);
  const [milestones, setMilestones] = useState([]);
  const [skills, setSkills] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceMessages, setVoiceMessages] = useState([{ from: 'mew', dur: 4, text: '按住按钮跟梦幻说话吧！' }]);
  const [mewSpeaking, setMewSpeaking] = useState(false);
  const endRef = useRef(null);

  // Load data after login
  useEffect(() => {
    if (!player) return;
    (async () => {
      const data = await db.getPlayerData(player.id);
      if (data) {
        setStats({ power: data.power, wisdom: data.wisdom, vitality: data.vitality });
        setStreak(data.streak);
        setMewLv(data.mew_level);
        setMewXp(data.mew_xp);
      }
      setTasks(await db.getTodayTasks(player.id));
      setMilestones(await db.getMilestones(player.id));
      setSkills(await db.getMewSkills(player.id));
      setMewMsg(`${player.name}，今天也要一起加油哦！`);
    })();
  }, [player]);

  // Save stats changes to DB
  useEffect(() => {
    if (!player) return;
    const timer = setTimeout(() => {
      db.updateStats(player.id, { ...stats, mewLevel: mewLv, mewXp: mewXp, streak, lastCheckin: new Date().toISOString().split('T')[0] });
    }, 1000);
    return () => clearTimeout(timer);
  }, [stats, mewLv, mewXp, streak]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [voiceMessages]);

  // Auto mood cycle
  useEffect(() => {
    if (page !== 'home') return;
    const cycle = ['idle', 'idle', 'happy', 'idle', 'idle', 'excited', 'idle'];
    let i = 0;
    const iv = setInterval(() => { i = (i + 1) % cycle.length; setMewMood(cycle[i]); }, 5000);
    return () => clearInterval(iv);
  }, [page]);

  const triggerMew = useCallback((type) => {
    const reactions = {
      upload_power: { moods: ['surprised', 'excited', 'happy', 'idle'], msgs: [`哇！${player?.name} 的射门好有力！⚽`, '太厉害了！梦幻感受到了力量！'] },
      upload_wisdom: { moods: ['thinking', 'happy', 'excited', 'idle'], msgs: [`梦幻在认真听 ${player?.name} 读英文呢！📖`, 'Wonderful！梦幻也学了新单词！'] },
      upload_vitality: { moods: ['surprised', 'excited', 'happy', 'idle'], msgs: [`${player?.name} 太灵活了！梦幻也翻跟斗！🤸`, '好厉害！梦幻活力在提升！'] },
      task_done: { moods: ['excited', 'happy', 'idle'], msgs: ['任务完成！梦幻超开心！✨', '太棒了！能量增加了！'] },
    };
    const s = reactions[type]; if (!s) return;
    setMewMsg(s.msgs[Math.floor(Math.random() * s.msgs.length)]);
    let step = 0;
    const run = () => { if (step >= s.moods.length) { setMewMsg(`${player?.name}，今天也要一起加油哦！`); return; } setMewMood(s.moods[step]); step++; setTimeout(run, 1500); };
    run();
  }, [player]);

  const handleUpload = async (cat, act) => {
    const newStats = { ...stats, [cat]: Math.min(stats[cat] + 5, 100) };
    setStats(newStats);
    setMewXp(x => { const nx = x + 5; if (nx >= mewLv * 100) { setMewLv(l => l + 1); return 0; } return nx; });
    triggerMew(act);
    if (player) await db.logGrowth(player.id, cat, 5, `${act} upload`);
  };

  const completeTask = async (id) => {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, done: true } : t));
    const t = tasks.find(t => t.id === id);
    if (t) {
      const newStats = { ...stats, [t.category]: Math.min(stats[t.category] + 10, 100) };
      setStats(newStats);
      setMewXp(x => { const nx = x + 10; if (nx >= mewLv * 100) { setMewLv(l => l + 1); return 0; } return nx; });
      if (player) {
        await db.completeTask(id);
        await db.logGrowth(player.id, t.category, 10, `Task: ${t.title}`);
      }
    }
    triggerMew('task_done');
  };

  const startRec = () => setIsRecording(true);
  const stopRec = () => {
    setIsRecording(false);
    const dur = [2, 3, 4, 5][Math.floor(Math.random() * 4)];
    setVoiceMessages(m => [...m, { from: 'user', dur }]);
    setMewSpeaking(true); setMewMood('thinking');
    setTimeout(() => {
      const d = [3, 4, 5][Math.floor(Math.random() * 3)];
      const rp = ['梦幻觉得说得对呢！✨', '嗯嗯！梦幻也这么想！', '好棒！梦幻为你加油！💪', '梦幻今天特别开心！', '哇，梦幻学到了新东西！', '梦幻最喜欢聊天了～'];
      setVoiceMessages(m => [...m, { from: 'mew', dur: d, text: rp[Math.floor(Math.random() * rp.length)] }]);
      setMewSpeaking(false); setMewMood('happy');
      setTimeout(() => setMewMood('idle'), 3000);
    }, 2000);
  };

  // ═══ LOGIN GATE ═══
  if (!player) return <LoginScreen onLogin={setPlayer} />;

  const nav = [{ id: 'home', icon: '🔮', label: '梦幻' }, { id: 'tasks', icon: '⏱', label: '任务' }, { id: 'oak', icon: '🧪', label: '博士' }, { id: 'voice', icon: '🎙', label: '对话' }, { id: 'growth', icon: '📊', label: '成长' }];
  const mewGif = MEW_MAP[mewMood] || '/mew-idle.gif';
  const xpPct = mewXp / (mewLv * 100);

  return (
    <div style={{ width: '100%', maxWidth: 420, minHeight: '100vh', margin: '0 auto', position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg,#E8F4FD 0%,#FFF5F5 35%,#FFFAF0 65%,#F0FFF4 100%)' }}>
      <div style={{ position: 'absolute', top: -30, right: -30, opacity: 0.04, transform: 'rotate(15deg)' }}><Pokeball size={120} /></div>
      <div style={{ paddingBottom: 76, minHeight: '100vh' }}>

        {/* HOME */}
        {page === 'home' && <div className="slide-in" style={{ padding: '14px 14px 0' }}>
          <div style={{ background: 'linear-gradient(135deg,#E03030,#C42020)', borderRadius: 18, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 16px rgba(224,48,48,0.2)' }}>
            <div className="flex items-center gap-2"><Pokeball size={20} color="white" /><div><p style={{ fontFamily: "'Chakra Petch'", fontSize: 15, fontWeight: 700, color: 'white' }}>MEW COMPANION</p><p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{player.name} 的专属伙伴</p></div></div>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 12px' }}><span style={{ fontSize: 12, color: 'white', fontWeight: 700 }}>🔥 {streak}天</span></div>
          </div>

          <div style={{ background: 'white', borderRadius: 22, padding: 12, marginBottom: 10, boxShadow: '0 2px 16px rgba(0,0,0,0.05)', border: '2px solid #FFE8F0' }}>
            <div className="mew-float flex justify-center" style={{ marginBottom: 6 }}>
              <div style={{ width: 200, height: 150, borderRadius: 20, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={mewGif} alt="Mew" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16 }} />
              </div>
            </div>
            <div style={{ background: '#FFF5F8', borderRadius: 14, padding: '8px 14px', border: '1.5px solid #FFE8F0', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -7, left: '50%', marginLeft: -7, width: 14, height: 14, background: '#FFF5F8', border: '1.5px solid #FFE8F0', borderRight: 'none', borderBottom: 'none', transform: 'rotate(45deg)' }} />
              <p style={{ fontSize: 12, color: '#6B4C5A', lineHeight: 1.5, textAlign: 'center' }}>{mewMsg}</p>
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 3 }}><span style={{ fontSize: 10, color: '#BBB', fontWeight: 600 }}>✨ 梦幻 Lv.{mewLv}</span><span style={{ fontSize: 9, color: '#DDD' }}>{mewXp}/{mewLv * 100} XP</span></div>
              <div style={{ height: 5, background: '#F5E8EE', borderRadius: 5 }}><div style={{ width: `${xpPct * 100}%`, height: '100%', borderRadius: 5, background: 'linear-gradient(90deg,#F4A0D0,#E080C0)', transition: 'width 0.5s' }} /></div>
            </div>
          </div>

          <div className="flex gap-2" style={{ marginBottom: 10 }}>
            <AttrBar label="力量" icon="⚽" value={stats.power} max={100} color="#E03030" bg="#FFF5F5" />
            <AttrBar label="智慧" icon="📖" value={stats.wisdom} max={100} color="#3B82C4" bg="#EFF6FF" />
            <AttrBar label="活力" icon="🤸" value={stats.vitality} max={100} color="#48BB78" bg="#F0FFF4" />
          </div>

          <div className="flex gap-2">
            {[{ icon: '⚽', label: '上传训练', act: 'upload_power', color: '#E03030', bg: '#FFF5F5', cat: 'power' }, { icon: '🎤', label: '录制朗读', act: 'upload_wisdom', color: '#3B82C4', bg: '#EFF6FF', cat: 'wisdom' }, { icon: '📷', label: '上传体操', act: 'upload_vitality', color: '#48BB78', bg: '#F0FFF4', cat: 'vitality' }].map((b, i) => (
              <button key={i} onClick={() => handleUpload(b.cat, b.act)} className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl" style={{ background: b.bg, border: `2px solid ${b.color}20`, cursor: 'pointer' }}>
                <span style={{ fontSize: 22 }}>{b.icon}</span><span style={{ fontSize: 11, color: b.color, fontWeight: 600 }}>{b.label}</span>
              </button>
            ))}
          </div>
        </div>}

        {/* TASKS */}
        {page === 'tasks' && <div className="slide-in" style={{ padding: 14 }}>
          <div style={{ background: 'linear-gradient(135deg,#F59E0B,#D69E2E)', borderRadius: 18, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>📋</span><div><p style={{ fontFamily: "'Chakra Petch'", fontSize: 15, fontWeight: 700, color: 'white' }}>今日任务</p><p style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>完成任务让梦幻变得更强！</p></div>
          </div>
          {tasks.map(t => (
            <div key={t.id} style={{ background: 'white', borderRadius: 14, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, border: t.done ? '2px solid #48BB7830' : '2px solid #F0F0F0', opacity: t.done ? 0.6 : 1 }}>
              <span style={{ fontSize: 24 }}>{t.icon}</span>
              <div style={{ flex: 1 }}><p style={{ fontSize: 13, color: '#2D3748', fontWeight: 600, textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</p><p style={{ fontSize: 10, color: '#A0AEC0', marginTop: 2 }}>{t.minutes}分钟 · +10XP</p></div>
              {!t.done ? <button onClick={() => setActiveTimer(activeTimer === t.id ? null : t.id)} style={{ padding: '5px 12px', borderRadius: 16, fontSize: 11, fontWeight: 600, background: activeTimer === t.id ? '#FFF0F0' : '#FAFAFA', color: activeTimer === t.id ? '#E03030' : '#999', border: activeTimer === t.id ? '1.5px solid #E0303030' : '1.5px solid #EEE', cursor: 'pointer' }}>{activeTimer === t.id ? '收起' : '⏱ 计时'}</button> : <span style={{ fontSize: 16 }}>✅</span>}
            </div>
          ))}
          {activeTimer && <div className="slide-in" style={{ background: 'white', borderRadius: 18, padding: 20, marginTop: 4, marginBottom: 8, border: '2px solid #F0F0F0' }}>
            <Timer initMin={tasks.find(t => t.id === activeTimer)?.minutes || 15} label={tasks.find(t => t.id === activeTimer)?.title || ''} onComplete={() => { completeTask(activeTimer); setActiveTimer(null); }} />
          </div>}
          <div style={{ background: 'white', borderRadius: 14, padding: '12px 14px', border: '2px solid #F0F0F0' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}><span style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>今日进度</span><span style={{ fontSize: 13, color: '#2D3748', fontWeight: 700 }}>{tasks.filter(t => t.done).length}/{tasks.length}</span></div>
            <div style={{ height: 7, background: '#F0F0F0', borderRadius: 7 }}><div style={{ width: `${tasks.length ? (tasks.filter(t => t.done).length / tasks.length) * 100 : 0}%`, height: '100%', borderRadius: 7, transition: 'width 0.5s', background: 'linear-gradient(90deg,#E03030,#F56565)' }} /></div>
          </div>
        </div>}

        {/* OAK */}
        {page === 'oak' && <div className="slide-in" style={{ padding: 14 }}>
          <div style={{ background: 'linear-gradient(135deg,#48BB78,#38A169)', borderRadius: 18, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🔬</span><div><p style={{ fontFamily: "'Chakra Petch'", fontSize: 15, fontWeight: 700, color: 'white' }}>大木博士实验室</p></div>
          </div>
          <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 10, textAlign: 'center', border: '2px solid #E8F5E8' }}>
            <div className="oak-breathe" style={{ display: 'inline-block' }}><img src="/oak.png" alt="Oak" style={{ width: 100, height: 'auto', filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.08))' }} /></div>
            <p style={{ fontFamily: "'Chakra Petch'", fontSize: 14, color: '#2D6A4F', fontWeight: 700, marginTop: 6 }}>大木博士</p>
          </div>
          {[{ icon: '💡', tag: '今日建议', text: `${player.name}，你的智慧值增长很快！建议今天多练练足球。`, bg: '#F0FFF4', bd: '#C6F6D5' }, { icon: '📈', tag: '成长报告', text: `梦幻 Lv.${mewLv}，已解锁 ${skills.filter(s => s.unlocked).length} 个技能！`, bg: '#FFFFF0', bd: '#FEFCBF' }].map((m, i) => (
            <div key={i} style={{ background: m.bg, borderRadius: 14, padding: '12px 14px', marginBottom: 8, border: `2px solid ${m.bd}` }}>
              <div className="flex items-center gap-1.5" style={{ marginBottom: 4 }}><span style={{ fontSize: 13 }}>{m.icon}</span><span style={{ fontSize: 10, color: '#888', fontWeight: 700 }}>{m.tag}</span></div>
              <p style={{ fontSize: 12, color: '#4A5568', lineHeight: 1.6 }}>{m.text}</p>
            </div>
          ))}
          <div style={{ background: 'white', borderRadius: 14, padding: '12px 14px', border: '2px solid #FFE0EC' }}>
            <p style={{ fontSize: 11, color: '#AAA', fontWeight: 700, marginBottom: 6 }}>🎯 梦幻技能</p>
            <div className="flex flex-wrap gap-1.5">{skills.map((s, i) => (<span key={i} style={{ padding: '3px 10px', borderRadius: 16, fontSize: 10, fontWeight: 600, background: s.unlocked ? '#FFF0F5' : '#F5F5F5', color: s.unlocked ? '#B83280' : '#CCC', border: s.unlocked ? '1.5px solid #FED7E2' : '1.5px solid #EEE' }}>{s.unlocked ? '' : '🔒'}{s.skill_name}</span>))}</div>
          </div>
        </div>}

        {/* VOICE */}
        {page === 'voice' && <div className="slide-in flex flex-col" style={{ padding: 14, height: 'calc(100vh - 76px)' }}>
          <div style={{ background: 'linear-gradient(135deg,#E03030,#C42020)', borderRadius: 18, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <img src="/mew-idle.gif" alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: '50%' }} />
            </div>
            <div><p style={{ fontSize: 13, color: 'white', fontWeight: 700 }}>与梦幻语音对话</p><p style={{ fontSize: 10, color: mewSpeaking ? '#FFD0D0' : '#C0FFC0' }}>{mewSpeaking ? '🔊 梦幻正在说话...' : '● 在线'}</p></div>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ marginBottom: 6 }}>
            {voiceMessages.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'} mb-2.5`}>
                {m.from === 'mew' && <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, marginRight: 5, marginTop: 12 }}><img src="/mew-happy.gif" alt="" style={{ width: 28, height: 28, objectFit: 'cover' }} /></div>}
                <div style={{ maxWidth: '75%' }}>
                  {m.from === 'mew' && <span style={{ fontSize: 9, color: '#B83280', fontWeight: 600, display: 'block', marginBottom: 2 }}>梦幻</span>}
                  <div style={{ background: m.from === 'user' ? 'linear-gradient(135deg,#3B82C4,#2B6CB0)' : 'white', borderRadius: 16, padding: '8px 12px', borderBottomLeftRadius: m.from === 'mew' ? 4 : 16, borderBottomRightRadius: m.from === 'user' ? 4 : 16, border: m.from === 'mew' ? '1.5px solid #F0F0F0' : 'none' }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 12, color: m.from === 'user' ? 'white' : '#E03030', cursor: 'pointer' }}>▶</span>
                      <div className="flex items-end gap-0.5" style={{ height: 16 }}>{[...Array(12)].map((_, j) => <div key={j} style={{ width: 2, height: 2 + Math.random() * 12, background: m.from === 'user' ? 'rgba(255,255,255,0.5)' : '#E0303070', borderRadius: 2 }} />)}</div>
                      <span style={{ fontSize: 10, color: m.from === 'user' ? 'rgba(255,255,255,0.7)' : '#BBB' }}>{m.dur}″</span>
                    </div>
                    {m.from === 'mew' && m.text && <p style={{ fontSize: 10, color: '#999', marginTop: 3, fontStyle: 'italic' }}>{m.text}</p>}
                  </div>
                </div>
              </div>
            ))}
            {mewSpeaking && <div className="flex justify-start mb-2.5"><div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, marginRight: 5 }}><img src="/mew-idle.gif" alt="" style={{ width: 28, height: 28, objectFit: 'cover' }} /></div><div style={{ background: 'white', borderRadius: 16, padding: '8px 12px', borderBottomLeftRadius: 4, border: '1.5px solid #F0F0F0' }}><VoiceWave active={true} /></div></div>}
            <div ref={endRef} />
          </div>
          <div className="flex flex-col items-center gap-2 py-3" style={{ background: 'white', borderRadius: 18, border: '2px solid #F0F0F0' }}>
            {isRecording && <VoiceWave active={true} />}
            <p style={{ fontSize: 10, color: isRecording ? '#E03030' : '#BBB' }}>{isRecording ? '正在录音...松开发送' : '按住说话'}</p>
            <button onMouseDown={startRec} onMouseUp={stopRec} onTouchStart={e => { e.preventDefault(); startRec(); }} onTouchEnd={stopRec} className={isRecording ? 'rec-pulse' : ''} style={{ width: 60, height: 60, borderRadius: '50%', background: isRecording ? '#C02020' : 'linear-gradient(135deg,#E03030,#E05050)', border: '4px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 14px rgba(224,48,48,0.25)', cursor: 'pointer' }}>
              <span style={{ fontSize: 22, color: 'white' }}>🎙</span>
            </button>
          </div>
        </div>}

        {/* GROWTH */}
        {page === 'growth' && <div className="slide-in" style={{ padding: 14 }}>
          <div style={{ background: 'linear-gradient(135deg,#3B82C4,#2B6CB0)', borderRadius: 18, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>📊</span><div><p style={{ fontFamily: "'Chakra Petch'", fontSize: 15, fontWeight: 700, color: 'white' }}>成长记录</p></div>
          </div>
          <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 10, textAlign: 'center', border: '2px solid #FEFCBF' }}>
            <span style={{ fontSize: 32 }}>🔥</span>
            <p style={{ fontSize: 30, color: '#D69E2E', fontWeight: 900, fontFamily: "'Chakra Petch'" }}>{streak}</p>
            <p style={{ fontSize: 11, color: '#AAA' }}>天连续打卡</p>
          </div>
          <div style={{ background: 'white', borderRadius: 14, padding: '12px 14px', marginBottom: 10, border: '2px solid #F0F0F0' }}>
            <p style={{ fontSize: 11, color: '#888', fontWeight: 700, marginBottom: 8 }}>本周打卡</p>
            <div className="flex justify-between">{['一', '二', '三', '四', '五', '六', '日'].map((d, i) => (<div key={i} className="flex flex-col items-center gap-1.5"><span style={{ fontSize: 10, color: '#BBB' }}>{d}</span><div style={{ width: 32, height: 32, borderRadius: '50%', background: i < 2 ? 'linear-gradient(135deg,#E03030,#F56565)' : i === 2 ? '#FFF5F5' : '#FAFAFA', border: i === 2 ? '2px solid #E03030' : '2px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i < 2 ? <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✓</span> : i === 2 ? <span style={{ color: '#E03030', fontSize: 8 }}>●</span> : null}</div></div>))}</div>
          </div>
          <div style={{ background: 'white', borderRadius: 14, padding: '12px 14px', marginBottom: 10, border: '2px solid #F0F0F0' }}>
            <p style={{ fontSize: 11, color: '#888', fontWeight: 700, marginBottom: 8 }}>属性成长</p>
            {[{ l: '⚽ 力量', v: stats.power, c: '#E03030' }, { l: '📖 智慧', v: stats.wisdom, c: '#3B82C4' }, { l: '🤸 活力', v: stats.vitality, c: '#48BB78' }].map((s, i) => (<div key={i} style={{ marginBottom: 10 }}><div className="flex justify-between" style={{ marginBottom: 3 }}><span style={{ fontSize: 11, color: '#666' }}>{s.l}</span><span style={{ fontSize: 11, color: s.c, fontWeight: 700 }}>{s.v}/100</span></div><div style={{ height: 7, background: '#F0F0F0', borderRadius: 7 }}><div style={{ width: `${s.v}%`, height: '100%', borderRadius: 7, transition: 'width 0.8s', background: s.c }} /></div></div>))}
          </div>
          <div style={{ background: 'white', borderRadius: 14, padding: '12px 14px', border: '2px solid #F0F0F0' }}>
            <p style={{ fontSize: 11, color: '#888', fontWeight: 700, marginBottom: 6 }}>🏆 里程碑</p>
            {milestones.map((m, i) => (<div key={i} className="flex items-center gap-2" style={{ padding: '6px 0', borderBottom: i < milestones.length - 1 ? '1px solid #F5F5F5' : 'none' }}><span style={{ fontSize: 13 }}>{m.achieved ? '🌟' : '⭕'}</span><span style={{ fontSize: 12, color: m.achieved ? '#2D3748' : '#CCC' }}>{m.title}</span></div>))}
          </div>
        </div>}
      </div>

      {/* NAV */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 420, background: 'white', borderTop: '2px solid #F0F0F0', padding: '5px 8px 6px', boxShadow: '0 -3px 16px rgba(0,0,0,0.04)' }}>
        <div className="flex justify-around">{nav.map(n => (<button key={n.id} onClick={() => setPage(n.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '3px 10px', borderRadius: 12, background: page === n.id ? '#FFF5F5' : 'transparent', border: page === n.id ? '1.5px solid #E0303020' : '1.5px solid transparent', cursor: 'pointer' }}><span style={{ fontSize: 18, filter: page === n.id ? 'none' : 'grayscale(0.5) opacity(0.5)' }}>{n.icon}</span><span style={{ fontSize: 9, color: page === n.id ? '#E03030' : '#BBB', fontWeight: page === n.id ? 700 : 400 }}>{n.label}</span></button>))}</div>
      </div>
    </div>
  );
}
