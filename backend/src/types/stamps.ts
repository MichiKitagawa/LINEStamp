export interface GenerateStampRequest {
  stampId: string;
}

export interface GenerateStampResponse {
  stampId: string;
  status: string;
}

export interface ConsumeTokensRequest {
  stampId: string;
  amount: number;
}

export interface ConsumeTokensResponse {
  success: boolean;
  remainingBalance: number;
}

export interface StampStatusResponse {
  stampId: string;
  status: string;
  retryCount: number;
  presetId?: string;
  createdAt: string;
  updatedAt: string;
}

// プレビュー関連の型定義
export interface PreviewStampResponse {
  stampId: string;
  processedImages: ProcessedImage[];
  mainImage?: ProcessedImage;
}

export interface ProcessedImage {
  id: string;
  url: string;
  sequence: number;
  filename: string;
}

// 申請関連の型定義
export interface SubmitStampRequest {
  stampId: string;
}

export interface SubmitStampResponse {
  stampId: string;
  status: string;
}

export interface RetryStampRequest {
  stampId: string;
}

export interface RetryStampResponse {
  stampId: string;
  status: string;
  retryCount: number;
} 