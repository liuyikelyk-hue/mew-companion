// /api/pronunciation.js — Azure Speech: two-step pronunciation assessment
// Step 1: Plain speech recognition → get what was said
// Step 2: Pronunciation assessment with recognized text as reference
// This approach works because Azure REST API requires ReferenceText for assessment

export const config = {
  runtime: 'edge',
};

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': '*' },
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' });
  }

  const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
  const AZURE_REGION = process.env.AZURE_SPEECH_REGION || 'eastus';

  if (!AZURE_KEY) {
    return jsonResponse({ success: false, error: 'Azure Speech key not configured' });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    const providedRef = (formData.get('referenceText') || '').trim();

    if (!audioFile) {
      return jsonResponse({ success: false, error: 'No audio file' });
    }

    const audioBytes = await audioFile.arrayBuffer();
    const baseUrl = `https://${AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;

    // ════════════════════════════════════════
    // STEP 1: Get the recognized text
    // ════════════════════════════════════════
    let recognizedText = providedRef;

    if (!recognizedText) {
      const recUrl = `${baseUrl}?language=en-US`;
      
      const recRes = await fetch(recUrl, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_KEY,
          'Content-Type': 'audio/wav',
          'Accept': 'application/json',
        },
        body: audioBytes,
      });

      if (!recRes.ok) {
        const errBody = await recRes.text();
        console.error('Step1 recognition HTTP error:', recRes.status, errBody);
        return jsonResponse({ success: false, error: `语音识别服务错误 (${recRes.status})` });
      }

      const recData = await recRes.json();
      console.log('Step1 recognition result:', JSON.stringify(recData).slice(0, 300));

      if (recData.RecognitionStatus !== 'Success' || !recData.DisplayText) {
        const msgs = {
          'NoMatch': '没有听到英文，请对着麦克风大声读哦！',
          'InitialSilenceTimeout': '没有检测到声音，请确认麦克风正常',
          'EndSilenceTimeout': '录音太短了，请多读一些',
        };
        return jsonResponse({
          success: false,
          error: msgs[recData.RecognitionStatus] || '没有听清楚，请再试一次',
        });
      }

      recognizedText = recData.DisplayText;
    }

    // ════════════════════════════════════════
    // STEP 2: Pronunciation assessment
    // ════════════════════════════════════════
    const pronConfig = {
      ReferenceText: recognizedText,
      GradingSystem: 'HundredMark',
      Granularity: 'Word',
      Dimension: 'Comprehensive',
      EnableMiscue: true,
    };

    // Base64 encode — must handle unicode properly
    const configJson = JSON.stringify(pronConfig);
    const configBytes = new TextEncoder().encode(configJson);
    let binaryStr = '';
    for (let i = 0; i < configBytes.length; i++) {
      binaryStr += String.fromCharCode(configBytes[i]);
    }
    const configBase64 = btoa(binaryStr);

    const assessUrl = `${baseUrl}?language=en-US&format=detailed`;

    const assessRes = await fetch(assessUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        'Content-Type': 'audio/wav',
        'Accept': 'application/json',
        'Pronunciation-Assessment': configBase64,
      },
      body: audioBytes,
    });

    if (!assessRes.ok) {
      const errBody = await assessRes.text();
      console.error('Step2 assessment HTTP error:', assessRes.status, errBody);
      
      // Return recognition result even if assessment fails
      return jsonResponse({
        success: true,
        recognizedText,
        scores: { pronunciation: 0, accuracy: 0, fluency: 0, completeness: 0 },
        words: [],
        note: '梦幻听到了你的朗读！评分功能暂时有问题，但继续练习哦～',
      });
    }

    const assessData = await assessRes.json();
    console.log('Step2 assessment result:', JSON.stringify(assessData).slice(0, 500));

    // Handle assessment not successful
    if (assessData.RecognitionStatus !== 'Success') {
      return jsonResponse({
        success: true,
        recognizedText,
        scores: { pronunciation: 0, accuracy: 0, fluency: 0, completeness: 0 },
        words: [],
        note: '梦幻听到了你说的内容，但这次没能评分，再试一次吧！',
      });
    }

    // Extract scores from NBest
    const nBest = assessData.NBest?.[0];
    const pa = nBest?.PronunciationAssessment;

    if (!pa) {
      console.error('No PronunciationAssessment in NBest:', JSON.stringify(nBest || {}).slice(0, 300));
      return jsonResponse({
        success: true,
        recognizedText,
        scores: { pronunciation: 0, accuracy: 0, fluency: 0, completeness: 0 },
        words: [],
        note: '梦幻听到了你读的内容，评分数据格式异常',
      });
    }

    // Build word-level results
    const words = (nBest.Words || []).map(w => ({
      word: w.Word,
      accuracy: Math.round(w.PronunciationAssessment?.AccuracyScore ?? 0),
      error: w.PronunciationAssessment?.ErrorType || 'None',
    }));

    return jsonResponse({
      success: true,
      recognizedText,
      scores: {
        pronunciation: Math.round(pa.PronScore ?? 0),
        accuracy: Math.round(pa.AccuracyScore ?? 0),
        fluency: Math.round(pa.FluencyScore ?? 0),
        completeness: Math.round(pa.CompletenessScore ?? 100),
      },
      words,
    });

  } catch (error) {
    console.error('Pronunciation handler error:', error?.message || error);
    return jsonResponse({ success: false, error: '处理出错，请重试' });
  }
}
