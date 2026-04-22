// Vercel Serverless Function
// 관리자 장 잠금 상태를 GitHub locks.json 으로 커밋

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { locks, password } = req.body;

  if (password !== process.env.APOLLO_PW) {
    return res.status(401).json({ error: '비밀번호가 틀렸습니다' });
  }

  if (!locks || typeof locks !== 'object' || Array.isArray(locks)) {
    return res.status(400).json({ error: '잘못된 잠금 데이터 형식입니다' });
  }

  const owner = process.env.GH_OWNER || 'onnurinoah';
  const repo  = process.env.GH_REPO  || 'apolobook';
  const token = process.env.GH_TOKEN;
  const path  = 'locks.json';

  if (!token) {
    return res.status(500).json({ error: 'GH_TOKEN 환경변수가 설정되지 않았습니다' });
  }

  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'apolobook-lock-saver',
  };

  let sha = undefined;
  try {
    const getRes = await fetch(apiBase, { headers });
    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    }
  } catch (_) {}

  const sanitized = {};
  for (const [key, value] of Object.entries(locks)) {
    if (typeof key === 'string' && /^ch_\d+$/.test(key)) sanitized[key] = value === true;
  }

  const content = Buffer.from(
    JSON.stringify({ version: 1, locked: sanitized }, null, 2)
  ).toString('base64');

  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const body = JSON.stringify({
    message: `장 잠금 저장 ${now}`,
    content,
    ...(sha ? { sha } : {}),
  });

  const putRes = await fetch(apiBase, { method: 'PUT', headers, body });

  if (putRes.ok) {
    return res.json({ ok: true, message: '잠금이 저장됐습니다. 1~2분 후 모든 기기에 반영됩니다.' });
  } else {
    const err = await putRes.text();
    return res.status(500).json({ error: 'GitHub 잠금 저장 실패', detail: err });
  }
}
