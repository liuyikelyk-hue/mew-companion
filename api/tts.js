export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { text, lang } = await req.json();
    if (!text) return new Response('No text', { status: 400 });

    const cleanText = text.slice(0, 300).replace(/[<>&'"]/g, ' ');

    // Try Azure Speech if key is configured
    const azureKey = process.env.AZURE_SPEECH_KEY;
    const azureRegion = process.env.AZURE_SPEECH_REGION || 'eastasia';

    if (azureKey) {
      try {
        const voice = lang === 'en' ? 'en-US-AnaNeural' : 'zh-CN-XiaoxiaoNeural';
        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang === 'en' ? 'en-US' : 'zh-CN'}'>
          <voice name='${voice}'>
            <prosody rate='${lang === 'en' ? '-10%' : '+10%'}' pitch='+5%'>${cleanText}</prosody>
          </voice>
        </speak>`;

        const res = await fetch(
          `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
          {
            method: 'POST',
            headers: {
              'Ocp-Apim-Subscription-Key': azureKey,
              'Content-Type': 'application/ssml+xml',
              'X-Microsoft-OutputFormat': 'audio-16khz-64kbitrate-mono-mp3',
            },
            body: ssml,
          }
        );

        if (res.ok) {
          return new Response(res.body, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'public, max-age=86400',
            },
          });
        }
      } catch (e) {
        console.error('Azure TTS error:', e);
      }
    }

    // Fallback: use free Google Translate TTS (short texts only)
    const ttsLang = lang === 'en' ? 'en' : 'zh-CN';
    const encoded = encodeURIComponent(cleanText.slice(0, 200));
    const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${ttsLang}&client=tw-ob`;

    const res = await fetch(googleUrl);
    if (res.ok) {
      return new Response(res.body, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return new Response(JSON.stringify({ error: 'TTS failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
