export const config = { runtime: 'edge' };

// Edge TTS via WebSocket - generates natural-sounding speech
async function generateSpeech(text, voice = 'zh-CN-XiaoshuangNeural') {
  const WSS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
  const TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';

  const date = new Date().toUTCString();
  const reqId = crypto.randomUUID().replace(/-/g, '');

  const wsUrl = `${WSS_URL}?TrustedClientToken=${TOKEN}&ConnectionId=${reqId}`;

  // Build SSML
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>
    <voice name='${voice}'>
      <prosody rate='+15%' pitch='+10%'>${text.replace(/[<>&'"]/g, ' ')}</prosody>
    </voice>
  </speak>`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const audioChunks = [];
    let audioStarted = false;

    ws.onopen = () => {
      // Send config
      ws.send(`X-Timestamp:${date}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`);

      // Send SSML
      ws.send(`X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${date}\r\nPath:ssml\r\n\r\n${ssml}`);
    };

    ws.onmessage = async (event) => {
      if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
        const data = event.data instanceof Blob ? await event.data.arrayBuffer() : event.data;
        const view = new Uint8Array(data);

        // Find the binary audio data after the header
        const headerEnd = findHeaderEnd(view);
        if (headerEnd >= 0) {
          audioChunks.push(view.slice(headerEnd));
          audioStarted = true;
        } else if (audioStarted) {
          audioChunks.push(view);
        }
      } else if (typeof event.data === 'string') {
        if (event.data.includes('Path:turn.end')) {
          ws.close();
        }
      }
    };

    ws.onerror = (e) => reject(new Error('WebSocket error'));
    ws.onclose = () => {
      if (audioChunks.length > 0) {
        const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of audioChunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }
        resolve(result);
      } else {
        reject(new Error('No audio data'));
      }
    };

    // Timeout
    setTimeout(() => { try { ws.close(); } catch(e) {} reject(new Error('Timeout')); }, 15000);
  });
}

function findHeaderEnd(data) {
  // Look for the end of the HTTP-like header (two CRLFs)
  for (let i = 0; i < data.length - 3; i++) {
    if (data[i] === 0x0D && data[i+1] === 0x0A && data[i+2] === 0x0D && data[i+3] === 0x0A) {
      return i + 4;
    }
  }
  // Alternative: look for "Path:audio" header
  const text = new TextDecoder().decode(data.slice(0, Math.min(200, data.length)));
  const pathIdx = text.indexOf('Path:audio');
  if (pathIdx >= 0) {
    const afterPath = text.indexOf('\r\n', pathIdx);
    if (afterPath >= 0) return afterPath + 2;
  }
  return -1;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { text } = await req.json();
    if (!text) return new Response('No text', { status: 400 });

    const audioData = await generateSpeech(text.slice(0, 300));

    return new Response(audioData, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
