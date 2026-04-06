// /api/pronunciation.js — Azure Speech: recognize + pronunciation assessment
// Supports free-form reading: no reference text needed
// Flow: audio → Azure recognizes what was said → scores pronunciation

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
    // Parse multipart form data
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    const referenceText = formData.get('referenceText') || '';

    if (!audioFile) {
      return new Response(JSON.stringify({ success: false, error: 'No audio file' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const audioBuffer = await audioFile.arrayBuffer();

    // If no reference text, first do a recognition pass to get what was said
    let finalReferenceText = referenceText.trim();

    if (!finalReferenceText) {
      // Step 1: Simple speech recognition to get the text
      const recognizeUrl = `https://${AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`;

      const recResponse = await fetch(recognizeUrl, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_KEY,
          'Content-Type': 'audio/wav',
          'Accept': 'application/json',
        },
        body: audioBuffer,
      });

      if (!recResponse.ok) {
        const errText = await recResponse.text();
        console.error('Recognition error:', errText);
        return new Response(JSON.stringify({ success: false, error: '语音识别失败，请重试' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const recResult = await recResponse.json();

      if (recResult.RecognitionStatus !== 'Success' || !recResult.DisplayText) {
        return new Response(JSON.stringify({ success: false, error: '没有听清楚，请大声一点再试试！' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      finalReferenceText = recResult.DisplayText;
    }

    // Step 2: Pronunciation assessment with the reference text
    const pronConfig = {
      ReferenceText: finalReferenceText,
      GradingSystem: 'HundredMark',
      Granularity: 'Word',
      Dimension: 'Comprehensive',
      EnableMiscue: true,
    };

    const pronConfigBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(pronConfig))));

    const assessUrl = `https://${AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`;

    const assessResponse = await fetch(assessUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        'Content-Type': 'audio/wav',
        'Accept': 'application/json',
        'Pronunciation-Assessment': pronConfigBase64,
      },
      body: audioBuffer,
    });

    if (!assessResponse.ok) {
      const errText = await assessResponse.text();
      console.error('Assessment error:', errText);
      return new Response(JSON.stringify({ success: false, error: '发音评估失败，请重试' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const assessResult = await assessResponse.json();

    if (assessResult.RecognitionStatus !== 'Success') {
      return new Response(JSON.stringify({ success: false, error: '没有听清楚，请再试一次' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract pronunciation assessment scores
    const nBest = assessResult.NBest?.[0];
    if (!nBest || !nBest.PronunciationAssessment) {
      return new Response(JSON.stringify({ success: false, error: '评估数据异常，请重试' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const pa = nBest.PronunciationAssessment;
    const words = (nBest.Words || []).map(w => ({
      word: w.Word,
      accuracy: Math.round(w.PronunciationAssessment?.AccuracyScore ?? 0),
      error: w.PronunciationAssessment?.ErrorType || 'None',
    }));

    const result = {
      success: true,
      recognizedText: finalReferenceText,
      scores: {
        pronunciation: Math.round(pa.PronScore ?? 0),
        accuracy: Math.round(pa.AccuracyScore ?? 0),
        fluency: Math.round(pa.FluencyScore ?? 0),
        completeness: Math.round(pa.CompletenessScore ?? 0),
      },
      words,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Pronunciation API error:', error);
    return new Response(JSON.stringify({ success: false, error: '处理失败，请重试' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
