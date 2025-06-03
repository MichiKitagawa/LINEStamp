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