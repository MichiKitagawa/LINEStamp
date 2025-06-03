export interface ImageRecord {
  id: string;
  stampId: string;
  type: 'original' | 'processed' | 'main';
  url: string;
  sequence: number;
  filename: string;
  createdAt: string;
}

export interface UploadRequest {
  files: Express.Multer.File[];
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
  config: PresetConfig;
  createdAt: string;
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

export interface StampRecord {
  id: string;
  userId: string;
  status: 'pending_upload' | 'generating' | 'generated' | 'submitting' | 'submitted' | 'failed' | 'session_expired';
  presetId?: string;
  presetConfig?: PresetConfig;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

// Firebase Storage用のパス生成ユーティリティ型
export interface StoragePath {
  userId: string;
  stampId: string;
  type: 'original' | 'processed';
  filename: string;
}

// バリデーション設定
export const UPLOAD_VALIDATION = {
  MAX_FILES: 8,
  MIN_FILES: 1,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_MIME_TYPES: ['image/png', 'image/jpeg', 'image/jpg'],
  ALLOWED_EXTENSIONS: ['.png', '.jpg', '.jpeg'],
} as const;

// デフォルトプリセットデータ
export const DEFAULT_PRESETS: Record<string, Omit<Preset, 'id' | 'createdAt'>> = {
  'simple-white': {
    label: 'シンプル白背景',
    description: 'シンプルな白背景で清潔感のあるスタンプ',
    thumbnailUrl: '/presets/simple-white.png',
    config: {
      style: 'simple',
      backgroundColor: '#FFFFFF',
      borderStyle: 'none',
      effects: [],
    },
  },
  'colorful-pop': {
    label: 'カラフルポップ',
    description: 'カラフルで明るい雰囲気のスタンプ',
    thumbnailUrl: '/presets/colorful-pop.png',
    config: {
      style: 'pop',
      backgroundColor: '#FFE4E1',
      borderStyle: 'round',
      effects: ['glow', 'shadow'],
    },
  },
  'vintage-retro': {
    label: 'ヴィンテージレトロ',
    description: 'レトロな風合いでノスタルジックなスタンプ',
    thumbnailUrl: '/presets/vintage-retro.png',
    config: {
      style: 'vintage',
      backgroundColor: '#F5F5DC',
      borderStyle: 'classic',
      effects: ['sepia', 'grain'],
    },
  },
} as const; 