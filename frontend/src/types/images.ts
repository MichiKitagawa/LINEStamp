// フロントエンド用の型定義

export interface ImageFile {
  file: File;
  preview: string;
  id: string;
}

export interface UploadResponse {
  stampId: string;
  uploadedCount: number;
  imageIds: string[];
}

export interface Preset {
  id: string;
  label: string;
  description: string;
  thumbnailUrl: string;
  config?: PresetConfig;
}

export interface PresetConfig {
  style: string;
  backgroundColor: string;
  borderStyle: string;
  effects: string[];
  textStyle?: {
    font: string;
    size: number;
    color: string;
  };
}

export interface PresetListResponse {
  presets: Preset[];
}

export interface SetPresetRequest {
  stampId: string;
  presetId: string;
}

export interface SetPresetResponse {
  stampId: string;
  presetId: string;
  status: string;
}

export interface StampStatus {
  stampId: string;
  status: 'pending_upload' | 'generating' | 'generated' | 'submitting' | 'submitted' | 'failed' | 'session_expired';
  retryCount: number;
  presetId?: string;
  createdAt: string;
  updatedAt: string;
}

// バリデーション設定
export const UPLOAD_VALIDATION = {
  MAX_FILES: 1,
  MIN_FILES: 1,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_MIME_TYPES: ['image/png', 'image/jpeg', 'image/jpg'],
  ALLOWED_EXTENSIONS: ['.png', '.jpg', '.jpeg'],
} as const;

// ファイルサイズをフォーマット
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ファイル検証関数
export const validateImageFile = (file: File): { isValid: boolean; error?: string } => {
  // ファイルサイズチェック
  if (file.size > UPLOAD_VALIDATION.MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `ファイルサイズが大きすぎます。最大${UPLOAD_VALIDATION.MAX_FILE_SIZE / (1024 * 1024)}MBまでです。`,
    };
  }

  // MIMEタイプチェック
  if (!UPLOAD_VALIDATION.ALLOWED_MIME_TYPES.includes(file.type as any)) {
    return {
      isValid: false,
      error: 'PNG、JPEGファイルのみアップロード可能です。',
    };
  }

  return { isValid: true };
};

// プレビュー用URL生成
export const createImagePreview = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}; 