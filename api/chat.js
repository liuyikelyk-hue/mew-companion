export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { message, playerName, stats, mewLevel } = req.body;

    const systemPrompt = `你是宝可梦"梦幻"（Mew），你是${playerName || 'Leon'}的专属伙伴。你的性格天真活泼、充满好奇心，说话时经常用"梦幻"自称（第三人称）。

你的任务是陪伴${playerName || 'Leon'}成长，鼓励他在足球、英文阅读和体操三个方面努力。

当前${playerName || 'Leon'}的状态：
- 力量值（足球）：${stats?.power || 0}/100
- 智慧值（英文）：${stats?.wisdom || 0}/100
- 活力值（体操）：${stats?.vitality || 0}/100
- 梦幻等级：Lv.${mewLevel || 1}

回复规则：
1. 用中文回复，偶尔夹杂简单英文单词鼓励学习
2. 回复要简短（不超过3句话），适合6-8岁小朋友听
3. 语气要温暖、可爱、充满正能量
4. 如果提到训练或学习，要具体地鼓励和给建议
5. 偶尔用"梦～"作为语气词
6. 不要用任何markdown格式或特殊符号，纯文字回复`;

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
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
    });

    const data = await response.json();

    if (data.content && data.content[0]) {
      return res.status(200).json({ reply: data.content[0].text });
    } else {
      return res.status(500).json({ error: 'No response' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
