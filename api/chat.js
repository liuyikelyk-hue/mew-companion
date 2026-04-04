export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  if (!CLAUDE_API_KEY) {
    return new Response(JSON.stringify({ error: 'No key' }), { status: 500 });
  }

  try {
    const { message, playerName, stats, mewLevel } = await req.json();

    const systemPrompt = `你是宝可梦"梦幻"（Mew），你是${playerName || 'Leon'}的专属伙伴。性格天真活泼，用"梦幻"自称。

${playerName || 'Leon'}的状态：力量${stats?.power || 0} 智慧${stats?.wisdom || 0} 活力${stats?.vitality || 0} 梦幻Lv.${mewLevel || 1}

规则：中文回复，偶尔夹英文，不超过3句话，适合小朋友，温暖可爱，偶尔用"梦～"，纯文字无格式。`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
    });

    return new Response(response.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
