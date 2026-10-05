// Replicate SDXL (stability-ai/sdxl) — 포즈 스냅샷을 img2img 입력으로 사용
const SDXL_VERSION = '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';
const DEFAULT_PROMPT = 'webtoon style sketch, simple line art, white background, single character, clean outlines, manga style, black and white';
const NEGATIVE_PROMPT = 'background, color, shading, realistic, photo, 3d render, mannequin, blurry, extra limbs';

const JSON_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
const reply = (statusCode, body) => ({ statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) });

// 결과 이미지를 data URI로 바꿔서 돌려줌 → 브라우저 캔버스가 오염(tainted)되지 않아 PNG 내보내기 가능
async function toDataUri(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return url;
    const type = r.headers.get('content-type') || 'image/png';
    const buf = Buffer.from(await r.arrayBuffer());
    return 'data:' + type + ';base64,' + buf.toString('base64');
  } catch (e) {
    return url;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'POST만 지원합니다.' });

  const REPLICATE_KEY = process.env.REPLICATE_API_KEY;
  if (!REPLICATE_KEY) return reply(500, { error: 'API 키가 설정되지 않았습니다. Netlify 환경변수 REPLICATE_API_KEY를 확인하세요.' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return reply(400, { error: '잘못된 요청 형식입니다.' });
  }
  const { prompt, image, strength, predId } = body;

  try {
    // 폴링 모드: predId가 있으면 결과 확인만 함
    if (predId) {
      if (!/^[a-z0-9]+$/i.test(predId)) return reply(400, { error: '잘못된 predId' });
      const poll = await fetch('https://api.replicate.com/v1/predictions/' + predId, {
        headers: { 'Authorization': 'Bearer ' + REPLICATE_KEY }
      });
      const pd = await poll.json();
      let output = pd.output;
      if (pd.status === 'succeeded' && output) {
        const urls = Array.isArray(output) ? output : [output];
        output = await Promise.all(urls.map(toDataUri));
      }
      return reply(200, { status: pd.status, output, error: pd.error });
    }

    // 생성 모드: 새 예측 시작
    const input = {
      prompt: prompt || DEFAULT_PROMPT,
      negative_prompt: NEGATIVE_PROMPT,
      width: 512,
      height: 768,
      num_inference_steps: 25,
      guidance_scale: 7
    };
    if (image) {
      if (typeof image !== 'string' || !image.startsWith('data:image/')) return reply(400, { error: '이미지 형식이 올바르지 않습니다.' });
      input.image = image;
      const s = Number(strength);
      input.prompt_strength = Number.isFinite(s) ? Math.min(0.95, Math.max(0.3, s)) : 0.75;
    }

    const res = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + REPLICATE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: SDXL_VERSION, input })
    });
    const data = await res.json();

    if (!data.id) return reply(400, { error: data.detail || '예측 시작 실패' });
    return reply(200, { predId: data.id, status: data.status });
  } catch (e) {
    console.log('Error: ' + e.message);
    return reply(500, { error: e.message });
  }
};
