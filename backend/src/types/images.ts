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
  prompts: string[];
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
  status: 'pending_upload' | 'pending_generate' | 'generating' | 'generated' | 'submitting' | 'submitted' | 'failed' | 'session_expired';
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
  MAX_FILES: 1,
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
    thumbnailUrl: '',
    config: {
      style: 'simple',
      backgroundColor: '#FFFFFF',
      borderStyle: 'none',
      effects: [],
      prompts: [
        "Create a happy and cheerful expression with simple white background, kawaii style",
        "Create a surprised and amazed expression with simple white background, kawaii style", 
        "Create a sad and crying expression with simple white background, kawaii style",
        "Create an angry and frustrated expression with simple white background, kawaii style",
        "Create a sleepy and tired expression with simple white background, kawaii style",
        "Create an excited and energetic expression with simple white background, kawaii style",
        "Create a confused and puzzled expression with simple white background, kawaii style",
        "Create a loving and affectionate expression with simple white background, kawaii style"
      ]
    },
  },
  'colorful-pop': {
    label: 'カラフルポップ',
    description: 'カラフルで明るい雰囲気のスタンプ',
    thumbnailUrl: '',
    config: {
      style: 'pop',
      backgroundColor: '#FFE4E1',
      borderStyle: 'round',
      effects: ['glow', 'shadow'],
      prompts: [
        "Create a vibrant happy expression with colorful pop art background, bright colors",
        "Create a dynamic surprised expression with colorful pop art background, bright colors",
        "Create an emotional sad expression with colorful pop art background, bright colors",
        "Create a bold angry expression with colorful pop art background, bright colors",
        "Create a dreamy sleepy expression with colorful pop art background, bright colors",
        "Create an explosive excited expression with colorful pop art background, bright colors",
        "Create a quirky confused expression with colorful pop art background, bright colors",
        "Create a warm loving expression with colorful pop art background, bright colors"
      ]
    },
  },
  'vintage-retro': {
    label: 'ヴィンテージレトロ',
    description: 'レトロな風合いでノスタルジックなスタンプ',
    thumbnailUrl: '',
    config: {
      style: 'vintage',
      backgroundColor: '#F5F5DC',
      borderStyle: 'classic',
      effects: ['sepia', 'grain'],
      prompts: [
        "Create a nostalgic happy expression with vintage retro style, sepia tones and film grain",
        "Create a classic surprised expression with vintage retro style, sepia tones and film grain",
        "Create a melancholic sad expression with vintage retro style, sepia tones and film grain",
        "Create a stern angry expression with vintage retro style, sepia tones and film grain",
        "Create a peaceful sleepy expression with vintage retro style, sepia tones and film grain",
        "Create a lively excited expression with vintage retro style, sepia tones and film grain",
        "Create a thoughtful confused expression with vintage retro style, sepia tones and film grain",
        "Create a tender loving expression with vintage retro style, sepia tones and film grain"
      ]
    },
  },
} as const; 