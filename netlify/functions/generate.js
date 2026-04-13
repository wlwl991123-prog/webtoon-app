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
    // 1단계: 예측 생성
    const res = await fetch('https://api.replicate.com/v1/models/stability-ai/stable-diffusion/predictions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + REPLICATE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({
        input: {
          prompt: prompt,
          negative_prompt: 'background, color fill, realistic, photo, 3d render, bad anatomy, blurry',
          width: 512,
          height: 768,
          num_inference_steps: 30,
          guidance_scale: 7.5,
          scheduler: 'DPMSolverMultistep'
        }
      })
    });

    const data = await res.json();
    if (data.error) {
      return { statusCode: 400, body: JSON.stringify({ error: data.error }) };
    }

    // 2단계: 폴링
    let output = data.output;
    let status = data.status;
    const predId = data.id;

    if (!output && status !== 'succeeded') {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const poll = await fetch('https://api.replicate.com/v1/predictions/' + predId, {
          headers: { 'Authorization': 'Bearer ' + REPLICATE_KEY }
        });
        const pd = await poll.json();
        status = pd.status;
        if (status === 'succeeded') { output = pd.output; break; }
        if (status === 'failed') {
          return { statusCode: 400, body: JSON.stringify({ error: pd.error || '생성 실패' }) };
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ output })
    };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
