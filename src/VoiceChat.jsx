// VoiceChat.jsx — Enhanced Mew dialogue component
// Drop-in replacement for the voice page in App.jsx
// Features: text + voice input, conversation history, streaming replies, TTS playback

import { useState, useEffect, useRef, useCallback } from 'react';

const VoiceWave = ({ active, color = '#E03030' }) => {
  const [bars, setBars] = useState(Array(16).fill(3));
  useEffect(() => {
    if (!active) { setBars(Array(16).fill(3)); return; }
    const iv = setInterval(() => setBars(Array(16).fill(0).map(() => 3 + Math.random() * 20)), 100);
    return () => clearInterval(iv);
  }, [active]);
  return (
    <div className="flex items-center justify-center gap-0.5" style={{ height: 24 }}>
      {bars.map((h, i) => (
        <div key={i} style={{ width: 2.5, height: h, borderRadius: 2, background: color, opacity: active ? 0.7 : 0.2, transition: 'height 0.08s ease' }} />
      ))}
    </div>
  );
};

export default function VoiceChat({ player, stats, mewLv, mewMood, setMewMood }) {
  const [messages, setMessages] = useState([
    { from: 'mew', text: `${player?.name || ''}，你好呀！想聊什么就告诉梦幻吧！可以打字也可以按住麦克风说话哦～ ✨` }
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [mewSpeaking, setMewSpeaking] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [inputMode, setInputMode] = useState('text'); // 'text' or 'voice'

  const recognitionRef = useRef(null);
  const endRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [messages, streamingText]);

  // ═══ Send message to Claude API ═══
  const sendToMew = useCallback(async (text) => {
    if (!text.trim() || mewSpeaking) return;

    // Add user message
    const newMessages = [...messages, { from: 'user', text }];
    setMessages(newMessages);
    setMewSpeaking(true);
    setMewMood?.('thinking');
    setStreamingText('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          playerName: player?.name,
          stats,
          mewLevel: mewLv,
          // Send last 10 messages as history for context
          history: newMessages.slice(-10).map(m => ({ from: m.from, text: m.text })),
        }),
      });

      if (!res.ok) throw new Error('API error');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullReply += parsed.delta.text;
              setStreamingText(fullReply);
            }
          } catch (e) { /* skip parse errors */ }
        }
      }

      const finalReply = fullReply || '梦幻有点迷糊了...再说一次？梦～';
      setStreamingText('');
      setMessages(prev => [...prev, { from: 'mew', text: finalReply }]);
      setMewMood?.('happy');
      setTimeout(() => setMewMood?.('idle'), 3000);
    } catch (e) {
      setStreamingText('');
      setMessages(prev => [...prev, { from: 'mew', text: '梦幻暂时听不清...再试试？🥺' }]);
      setMewMood?.('idle');
    }
    setMewSpeaking(false);
  }, [messages, mewSpeaking, player, stats, mewLv, setMewMood]);

  // ═══ Text input submit ═══
  const handleTextSubmit = () => {
    if (!inputText.trim() || mewSpeaking) return;
    sendToMew(inputText.trim());
    setInputText('');
  };

  // ═══ Speech Recognition ═══
  const startRec = () => {
    setIsRecording(true);
    setRecognizedText('');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setIsRecording(false); return; }
    const r = new SR();
    r.lang = 'zh-CN'; r.interimResults = true; r.continuous = true;
    r.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setRecognizedText(t);
    };
    r.onerror = () => setIsRecording(false);
    r.start();
    recognitionRef.current = r;
  };

  const stopRec = () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    const text = recognizedText || '';
    setRecognizedText('');
    if (text.trim()) sendToMew(text.trim());
  };

  // ═══ TTS Playback ═══
  const playMewVoice = async (text) => {
    if (!text) return;
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 300) }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN'; u.rate = 1.1; u.pitch = 1.5;
        window.speechSynthesis.speak(u);
      }
    }
  };

  // ═══ Quick action buttons ═══
  const quickActions = [
    { emoji: '👋', text: '梦幻，今天好！' },
    { emoji: '⚽', text: '我刚踢完球，好累！' },
    { emoji: '📖', text: '教我一个英文单词吧' },
    { emoji: '🤸', text: '今天体操课学了新动作！' },
    { emoji: '🌟', text: '给我讲个宝可梦的故事' },
  ];

  const showQuickActions = messages.length <= 1 && !mewSpeaking;

  return (
    <div className="slide-in flex flex-col" style={{ padding: 14, height: 'calc(100vh - 76px)' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#E03030,#C42020)',
        borderRadius: 18, padding: '10px 14px', marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <img src="/mew-idle.gif" alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: '50%' }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, color: 'white', fontWeight: 700, margin: 0 }}>与梦幻对话</p>
          <p style={{ fontSize: 10, margin: 0, color: mewSpeaking ? '#FFD0D0' : '#C0FFC0' }}>
            {mewSpeaking ? '🔊 梦幻正在思考...' : '● 在线'}
          </p>
        </div>
        {/* Mode toggle */}
        <button
          onClick={() => setInputMode(inputMode === 'text' ? 'voice' : 'text')}
          style={{
            background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 12,
            padding: '5px 10px', cursor: 'pointer', color: 'white', fontSize: 11, fontWeight: 600,
          }}
        >
          {inputMode === 'text' ? '🎙 语音' : '⌨️ 打字'}
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto" style={{ marginBottom: 6 }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'} mb-2.5`}>
            {m.from === 'mew' && (
              <div style={{
                width: 30, height: 30, borderRadius: '50%', overflow: 'hidden',
                flexShrink: 0, marginRight: 6, marginTop: 12,
              }}>
                <img src="/mew-happy.gif" alt="" style={{ width: 30, height: 30, objectFit: 'cover' }} />
              </div>
            )}
            <div style={{ maxWidth: '78%' }}>
              {m.from === 'mew' && (
                <span style={{ fontSize: 9, color: '#B83280', fontWeight: 600, display: 'block', marginBottom: 2 }}>梦幻</span>
              )}
              <div style={{
                background: m.from === 'user' ? 'linear-gradient(135deg,#3B82C4,#2B6CB0)' : 'white',
                borderRadius: 16, padding: '10px 14px',
                borderBottomLeftRadius: m.from === 'mew' ? 4 : 16,
                borderBottomRightRadius: m.from === 'user' ? 4 : 16,
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                border: m.from === 'mew' ? '1.5px solid #F0F0F0' : 'none',
              }}>
                <p style={{ fontSize: 13, color: m.from === 'user' ? 'white' : '#444', lineHeight: 1.6, margin: 0 }}>
                  {m.text}
                </p>
                {m.from === 'mew' && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); playMewVoice(m.text); }}
                    onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); playMewVoice(m.text); }}
                    style={{
                      marginTop: 6, padding: '6px 14px', borderRadius: 14,
                      background: '#FFF0F5', border: '1.5px solid #FFE0EC',
                      color: '#E03030', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4,
                      WebkitUserSelect: 'none', WebkitTouchCallout: 'none', userSelect: 'none',
                    }}
                  >
                    🔊 听梦幻说
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Streaming reply */}
        {streamingText && (
          <div className="flex justify-start mb-2.5">
            <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, marginRight: 6, marginTop: 12 }}>
              <img src="/mew-excited.gif" alt="" style={{ width: 30, height: 30, objectFit: 'cover' }} />
            </div>
            <div style={{ maxWidth: '78%' }}>
              <span style={{ fontSize: 9, color: '#B83280', fontWeight: 600, display: 'block', marginBottom: 2 }}>梦幻</span>
              <div style={{ background: 'white', borderRadius: 16, padding: '10px 14px', borderBottomLeftRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', border: '1.5px solid #FFE0EC' }}>
                <p style={{ fontSize: 13, color: '#444', lineHeight: 1.6, margin: 0 }}>
                  {streamingText}
                  <span style={{ display: 'inline-block', width: 6, height: 14, background: '#E03030', marginLeft: 2, borderRadius: 1, animation: 'blink 0.8s infinite' }} />
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {mewSpeaking && !streamingText && (
          <div className="flex justify-start mb-2.5">
            <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, marginRight: 6 }}>
              <img src="/mew-idle.gif" alt="" style={{ width: 30, height: 30, objectFit: 'cover' }} />
            </div>
            <div style={{ background: 'white', borderRadius: 16, padding: '10px 14px', borderBottomLeftRadius: 4, border: '1.5px solid #F0F0F0' }}>
              <VoiceWave active={true} />
            </div>
          </div>
        )}

        {/* Quick actions — only show at start */}
        {showQuickActions && (
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <p style={{ fontSize: 10, color: '#BBB', textAlign: 'center', marginBottom: 8 }}>试试跟梦幻说...</p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {quickActions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendToMew(q.text)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    background: 'white', color: '#666',
                    border: '1.5px solid #F0F0F0', cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {q.emoji} {q.text}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input area */}
      {inputMode === 'text' ? (
        /* ═══ Text input mode ═══ */
        <div style={{
          background: 'white', borderRadius: 18, border: '2px solid #F0F0F0',
          padding: '8px 8px 8px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextSubmit(); } }}
            placeholder={mewSpeaking ? '梦幻正在回复...' : '跟梦幻说点什么...'}
            disabled={mewSpeaking}
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 14,
              background: 'transparent', color: '#333',
              padding: '6px 0',
            }}
          />
          <button
            onClick={handleTextSubmit}
            disabled={!inputText.trim() || mewSpeaking}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: inputText.trim() && !mewSpeaking ? 'linear-gradient(135deg,#E03030,#E05050)' : '#F0F0F0',
              border: 'none', cursor: inputText.trim() && !mewSpeaking ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 18, color: inputText.trim() && !mewSpeaking ? 'white' : '#CCC' }}>↑</span>
          </button>
        </div>
      ) : (
        /* ═══ Voice input mode ═══ */
        <div className="flex flex-col items-center gap-2 py-3" style={{ background: 'white', borderRadius: 18, border: '2px solid #F0F0F0' }}>
          {isRecording && <VoiceWave active={true} />}
          {isRecording && recognizedText && (
            <p style={{ fontSize: 12, color: '#444', padding: '0 16px', textAlign: 'center', maxHeight: 40, overflow: 'hidden' }}>
              {recognizedText}
            </p>
          )}
          <p style={{ fontSize: 10, color: isRecording ? '#E03030' : '#BBB', fontWeight: 500 }}>
            {isRecording ? '正在听...松开发送' : '按住跟梦幻说话'}
          </p>
          <button
            onMouseDown={startRec} onMouseUp={stopRec}
            onTouchStart={(e) => { e.preventDefault(); startRec(); }}
            onTouchEnd={stopRec}
            className={isRecording ? 'rec-pulse' : ''}
            disabled={mewSpeaking}
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: isRecording ? '#C02020' : 'linear-gradient(135deg,#E03030,#E05050)',
              border: '4px solid white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isRecording ? '0 0 24px rgba(224,48,48,0.4)' : '0 3px 14px rgba(224,48,48,0.25)',
              cursor: mewSpeaking ? 'default' : 'pointer',
              opacity: mewSpeaking ? 0.5 : 1,
            }}
          >
            <span style={{ fontSize: 24, color: 'white' }}>🎙</span>
          </button>
        </div>
      )}
    </div>
  );
}
