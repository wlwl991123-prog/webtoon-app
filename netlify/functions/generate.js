exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const REPLICATE_KEY = process.env.REPLICATE_API_KEY;
  if (!REPLICATE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API 키가 설정되지 않았습니다.' }) };
  }

  const { prompt, predId } = JSON.parse(event.body);

  try {
    // 폴링 모드: predId가 있으면 결과 확인
    if (predId) {
      const poll = await fetch('https://api.replicate.com/v1/predictions/' + predId, {
        headers: { 'Authorization': 'Bearer ' + REPLICATE_KEY }
      });
      const pd = await poll.json();
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: pd.status, output: pd.output, error: pd.error })
      };
    }

    // 생성 모드: 예측 시작만 함
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

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ predId: data.id, status: data.status })
    };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
