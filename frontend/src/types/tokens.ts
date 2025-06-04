export interface TokenPackage {
  id: string;
  name: string;
  tokens: number;
  price: number;
  description: string;
  stripePriceId?: string | undefined; // Stripe Price ID (バックエンドとの整合性のため)
}

export interface CheckoutSessionRequest {
  tokenPackage: string;
}

export interface CheckoutSessionResponse {
  sessionId: string;
}

export interface TokenBalance {
  balance: number;
}

// フロントエンド用のトークンパッケージ定義
export const TOKEN_PACKAGES: Record<string, TokenPackage> = {
  '50tokens': {
    id: '50tokens',
    name: '50トークンパック',
    tokens: 50,
    price: 500,
    description: 'お試しパック。スタンプ10枚作成可能',
  },
  '200tokens': {
    id: '200tokens',
    name: '200トークンパック',
    tokens: 200,
    price: 2000,
    description: '人気パック。スタンプ50枚作成可能',
  },
  '1000tokens': {
    id: '1000tokens',
    name: '1000トークンパック',
    tokens: 1000,
    price: 9800,
    description: '大容量パック。スタンプ200枚作成可能',
  },
}; 