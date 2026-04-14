exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const REPLICATE_KEY = process.env.REPLICATE_API_KEY;
  if (!REPLICATE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API 키가 설정되지 않았습니다.' }) };
  }

  const { prompt } = JSON.parse(event.body);

  try {
    // 1단계: 예측 생성 (Prefer: wait 제거 - 타임아웃 방지)
    const res = await fetch('https://api.replicate.com/v1/models/stability-ai/stable-diffusion/predictions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + REPLICATE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: {
          prompt: prompt,
          negative_prompt: 'background, color fill, realistic, photo, 3d render, bad anatomy, blurry',
          width: 512,
          height: 512,
          num_inference_steps: 20,
          guidance_scale: 7.5
        }
      })
    });

    const data = await res.json();
    if (data.error) {
      return { statusCode: 400, body: JSON.stringify({ error: data.error }) };
    }

    const predId = data.id;

    // 2단계: 폴링 (최대 25초)
    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const poll = await fetch('https://api.replicate.com/v1/predictions/' + predId, {
        headers: { 'Authorization': 'Bearer ' + REPLICATE_KEY }
      });
      const pd = await poll.json();
      if (pd.status === 'succeeded') {
        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify({ output: pd.output })
        };
      }
      if (pd.status === 'failed') {
        return { statusCode: 400, body: JSON.stringify({ error: pd.error || '생성 실패' }) };
      }
    }

    return { statusCode: 400, body: JSON.stringify({ error: '타임아웃: 다시 시도해주세요.' }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
