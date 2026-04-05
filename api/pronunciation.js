export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
  const SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'eastus';

  if (!SPEECH_KEY) {
    return new Response(JSON.stringify({ error: 'Speech key not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    const referenceText = formData.get('referenceText');

    if (!audioFile || !referenceText) {
      return new Response(JSON.stringify({ error: 'Missing audio or referenceText' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const audioBuffer = await audioFile.arrayBuffer();

    // Pronunciation assessment config
    const pronConfig = {
      ReferenceText: referenceText,
      GradingSystem: "HundredMark",
      Granularity: "Word",
      Dimension: "Comprehensive",
      EnableMiscue: true
    };

    const pronConfigBase64 = btoa(JSON.stringify(pronConfig));

    // Call Azure Speech API
    const response = await fetch(
      `https://${SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': SPEECH_KEY,
          'Content-Type': 'audio/wav',
          'Pronunciation-Assessment': pronConfigBase64,
          'Accept': 'application/json',
        },
        body: audioBuffer,
      }
    );

    const result = await response.json();

    if (result.RecognitionStatus === 'Success' && result.NBest && result.NBest[0]) {
      const best = result.NBest[0];
      const assessment = best.PronunciationAssessment || {};
      const words = (best.Words || []).map(w => ({
        word: w.Word,
        accuracy: w.PronunciationAssessment?.AccuracyScore || 0,
        error: w.PronunciationAssessment?.ErrorType || 'None',
      }));

      return new Response(JSON.stringify({
        success: true,
        recognized: best.Display || best.Lexical || '',
        scores: {
          accuracy: Math.round(assessment.AccuracyScore || 0),
          fluency: Math.round(assessment.FluencyScore || 0),
          completeness: Math.round(assessment.CompletenessScore || 0),
          pronunciation: Math.round(assessment.PronScore || 0),
        },
        words,
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: result.RecognitionStatus || 'Unknown error',
        details: result,
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
