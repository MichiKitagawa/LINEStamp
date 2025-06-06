import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Firebase Storage URLであることを確認（セキュリティ）
    if (!url.includes('storage.googleapis.com') && !url.includes('firebasestorage.googleapis.com')) {
      return res.status(403).json({ error: 'Unauthorized URL' });
    }

    console.log(`Proxying download request for: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    
    // レスポンスヘッダーを設定
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.byteLength);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1時間キャッシュ
    
    // バイナリデータをそのまま送信
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('Proxy download error:', error);
    res.status(500).json({ 
      error: 'Proxy download failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 