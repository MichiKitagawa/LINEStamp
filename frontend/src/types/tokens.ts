export interface TokenPackage {
  id: string;
  name: string;
  tokens: number;
  price: number;
  description: string;
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
  '40tokens': {
    id: '40tokens',
    name: '40トークンパック',
    tokens: 40,
    price: 1000,
    description: '標準的なパック。スタンプ8枚作成可能',
  },
  '80tokens': {
    id: '80tokens',
    name: '80トークンパック',
    tokens: 80,
    price: 1800,
    description: 'お得なパック。スタンプ16枚作成可能',
  },
  '120tokens': {
    id: '120tokens',
    name: '120トークンパック',
    tokens: 120,
    price: 2500,
    description: '大容量パック。スタンプ24枚作成可能',
  },
}; 