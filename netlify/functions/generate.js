exports.handler = async (event) => {
  const REPLICATE_KEY = process.env.REPLICATE_API_KEY;

  if (!REPLICATE_KEY) {
    console.log('API 키가 설정되지 않았습니다.');
    return { statusCode: 500, body: JSON.stringify({ error: 'API 키가 설정되지 않았습니다.' }) };
  }

  console.log('API KEY exists: true');
  console.log('API KEY prefix: ' + REPLICATE_KEY.substring(0, 5));

  const { prompt, predId } = JSON.parse(event.body);
  console.log('predId: ' + predId + ' prompt: ' + !!prompt);

  try {
    // 폴링 모드: predId가 있으면 결과 확인만 함
    if (predId) {
      const poll = await fetch('https://api.replicate.com/v1/predictions/' + predId, {
        headers: { 'Authorization': 'Bearer ' + REPLICATE_KEY }
      });
      const pd = await poll.json();
      console.log('Poll status: ' + pd.status);
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: pd.status, output: pd.output, error: pd.error })
      };
    }

    // 생성 모드: 새 예측 시작
    console.log('Starting prediction...');

    // SDXL 모델 사용 (버전 해시 포함)
    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + REPLICATE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
        input: {
          prompt: prompt || 'webtoon style sketch, simple line art, no background, single character standing pose, clean outlines, manga style, black and white',
          negative_prompt: 'background, color, shading, realistic, photo, detailed, complex',
          width: 512,
          height: 768,
          num_inference_steps: 20,
          guidance_scale: 7
        }
      })
    });

    const data = await res.json();
    console.log('Prediction response: ' + JSON.stringify(data).substring(0, 100));

    if (!data.id) {
      return { statusCode: 400, body: JSON.stringify({ error: data.detail || '예측 시작 실패' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ predId: data.id, status: data.status })
    };

  } catch (e) {
    console.log('Error: ' + e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
