import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { UPLOAD_VALIDATION } from '@/types/images';

// メモリストレージを使用（一時的にメモリに保存してからFirebase Storageにアップロード）
const storage = multer.memoryStorage();

// ファイルフィルター
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // MIMEタイプチェック
  if (!UPLOAD_VALIDATION.ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
    const error = new Error(`Invalid file type: ${file.mimetype}. Only PNG and JPEG are allowed.`);
    (error as any).code = 'INVALID_FILE_TYPE';
    return cb(error as any, false);
  }
  
  cb(null, true);
};

// Multer設定
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: UPLOAD_VALIDATION.MAX_FILE_SIZE,
    files: UPLOAD_VALIDATION.MAX_FILES,
  },
});

// エラーハンドリングミドルウェア
export const handleUploadError = (
  error: any,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        res.status(400).json({
          error: 'Bad Request',
          message: `File too large. Maximum size is ${UPLOAD_VALIDATION.MAX_FILE_SIZE / (1024 * 1024)}MB`,
        });
        return;
      case 'LIMIT_FILE_COUNT':
        res.status(400).json({
          error: 'Bad Request',
          message: `Too many files. Maximum is ${UPLOAD_VALIDATION.MAX_FILES} files`,
        });
        return;
      case 'LIMIT_UNEXPECTED_FILE':
        res.status(400).json({
          error: 'Bad Request',
          message: 'Unexpected file field',
        });
        return;
      default:
        res.status(400).json({
          error: 'Bad Request',
          message: `Upload error: ${error.message}`,
        });
        return;
    }
  }
  
  if (error.code === 'INVALID_FILE_TYPE') {
    res.status(400).json({
      error: 'Bad Request',
      message: error.message,
    });
    return;
  }
  
  next(error);
};

// ファイル検証ミドルウェア
export const validateFiles = (req: Request, res: Response, next: NextFunction): void => {
  const files = req.files as Express.Multer.File[];
  
  // ファイルが存在するかチェック
  if (!files || files.length === 0) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'No files uploaded',
    });
    return;
  }
  
  // ファイル数チェック
  if (files.length < UPLOAD_VALIDATION.MIN_FILES || files.length > UPLOAD_VALIDATION.MAX_FILES) {
    res.status(400).json({
      error: 'Bad Request',
      message: `File count must be between ${UPLOAD_VALIDATION.MIN_FILES} and ${UPLOAD_VALIDATION.MAX_FILES}`,
    });
    return;
  }
  
  // 各ファイルの詳細検証
  for (const file of files) {
    // ファイル名チェック
    if (!file.originalname) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'File must have a name',
      });
      return;
    }
    
    // バッファサイズチェック
    if (!file.buffer || file.buffer.length === 0) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'File must not be empty',
      });
      return;
    }
  }
  
  next();
}; 