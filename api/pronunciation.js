// /api/pronunciation.js — Azure Speech: single-pass pronunciation assessment
// Uses "Topic" mode for free-form reading (no reference text needed)
// One request = recognition + pronunciation scores + word-level detail

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': '*' },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
  const AZURE_REGION = process.env.AZURE_SPEECH_REGION || 'eastus';

  if (!AZURE_KEY) {
    return new Response(JSON.stringify({ success: false, error: 'Azure Speech key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    const referenceText = (formData.get('referenceText') || '').trim();

    if (!audioFile) {
      return new Response(JSON.stringify({ success: false, error: 'No audio file' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const audioBuffer = await audioFile.arrayBuffer();

    // Build pronunciation assessment config
    // If referenceText is provided, use "ReadingAloud" mode
    // If not, use "Topic" mode for free-form speech
    let pronConfig;
    if (referenceText) {
      pronConfig = {
        ReferenceText: referenceText,
        GradingSystem: 'HundredMark',
        Granularity: 'Word',
        Dimension: 'Comprehensive',
        EnableMiscue: true,
      };
    } else {
      pronConfig = {
        ReferenceText: '',
        GradingSystem: 'HundredMark',
        Granularity: 'Word',
        Dimension: 'Comprehensive',
        EnableMiscue: false,
        ScenarioId: '',
      };
    }

    // Base64 encode the config
    const pronConfigJson = JSON.stringify(pronConfig);
    const pronConfigBase64 = btoa(unescape(encodeURIComponent(pronConfigJson)));

    // Single request: recognition + pronunciation assessment
    const url = `https://${AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        'Content-Type': 'audio/wav',
        'Accept': 'application/json',
        'Pronunciation-Assessment': pronConfigBase64,
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Azure API error:', response.status, errText);
      return jsonResponse({ success: false, error: `Azure 服务错误 (${response.status})，请重试` });
    }

    const result = await response.json();
    console.log('Azure response:', JSON.stringify(result).slice(0, 500));

    // Check recognition status
    if (result.RecognitionStatus !== 'Success') {
      const statusMsg = {
        'NoMatch': '没有听到英文，请对着麦克风大声读哦！',
        'InitialSilenceTimeout': '没有检测到声音，请确认麦克风正常工作',
        'EndSilenceTimeout': '录音太短了，请多读一些内容',
      };
      return jsonResponse({
        success: false,
        error: statusMsg[result.RecognitionStatus] || '没有听清楚，请再试一次',
      });
    }

    // Extract data - try NBest first, then fall back to top-level fields
    const nBest = result.NBest?.[0];

    // Get recognized text
    const recognizedText = nBest?.Display || nBest?.Lexical || result.DisplayText || result.RecognizedText || '';

    if (!recognizedText) {
      return jsonResponse({ success: false, error: '没有识别到内容，请再试一次' });
    }

    // Get pronunciation scores
    const pa = nBest?.PronunciationAssessment;

    if (pa) {
      // Full pronunciation assessment available
      const words = (nBest.Words || []).map(w => ({
        word: w.Word,
        accuracy: Math.round(w.PronunciationAssessment?.AccuracyScore ?? 0),
        error: w.PronunciationAssessment?.ErrorType || 'None',
      }));

      return jsonResponse({
        success: true,
        recognizedText,
        scores: {
          pronunciation: Math.round(pa.PronScore ?? pa.PronunciationScore ?? 0),
          accuracy: Math.round(pa.AccuracyScore ?? 0),
          fluency: Math.round(pa.FluencyScore ?? 0),
          completeness: Math.round(pa.CompletenessScore ?? 100),
        },
        words,
      });
    }

    // Fallback: if pronunciation assessment header didn't work,
    // do a second request WITH the recognized text as reference
    console.log('No PronunciationAssessment in response, retrying with reference text...');

    const retryConfig = {
      ReferenceText: recognizedText,
      GradingSystem: 'HundredMark',
      Granularity: 'Word',
      Dimension: 'Comprehensive',
      EnableMiscue: true,
    };
    const retryConfigBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(retryConfig))));

    const retryUrl = `https://${AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;

    const retryResponse = await fetch(retryUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        'Content-Type': 'audio/wav',
        'Accept': 'application/json',
        'Pronunciation-Assessment': retryConfigBase64,
      },
      body: audioBuffer,
    });

    if (!retryResponse.ok) {
      // Even retry failed — return recognition result without scores
      return jsonResponse({
        success: true,
        recognizedText,
        scores: { pronunciation: 0, accuracy: 0, fluency: 0, completeness: 0 },
        words: [],
        note: '发音评估暂时不可用，但梦幻听到了你读的内容',
      });
    }

    const retryResult = await retryResponse.json();
    console.log('Retry response:', JSON.stringify(retryResult).slice(0, 500));

    const retryNBest = retryResult.NBest?.[0];
    const retryPa = retryNBest?.PronunciationAssessment;

    if (retryPa) {
      const words = (retryNBest.Words || []).map(w => ({
        word: w.Word,
        accuracy: Math.round(w.PronunciationAssessment?.AccuracyScore ?? 0),
        error: w.PronunciationAssessment?.ErrorType || 'None',
      }));

      return jsonResponse({
        success: true,
        recognizedText,
        scores: {
          pronunciation: Math.round(retryPa.PronScore ?? retryPa.PronunciationScore ?? 0),
          accuracy: Math.round(retryPa.AccuracyScore ?? 0),
          fluency: Math.round(retryPa.FluencyScore ?? 0),
          completeness: Math.round(retryPa.CompletenessScore ?? 100),
        },
        words,
      });
    }

    // Last resort: return what we have
    return jsonResponse({
      success: true,
      recognizedText,
      scores: { pronunciation: 0, accuracy: 0, fluency: 0, completeness: 0 },
      words: [],
      note: '梦幻听到了你的朗读，但评分功能暂时有问题',
    });
  } catch (error) {
    console.error('Pronunciation API error:', error);
    return jsonResponse({ success: false, error: '处理失败，请重试' });
  }
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
