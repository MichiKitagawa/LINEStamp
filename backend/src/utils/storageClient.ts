import { storage } from './firebaseAdmin';
import { StoragePath } from '@/types/images';
import path from 'path';

/**
 * Firebase Storage用のパス生成
 */
export const generateStoragePath = (storagePath: StoragePath): string => {
  const { userId, stampId, type, filename } = storagePath;
  return `users/${userId}/stamps/${stampId}/${type}/${filename}`;
};

/**
 * ファイルをFirebase Storageにアップロード
 */
export const uploadFileToStorage = async (
  buffer: Buffer,
  storagePath: string,
  contentType: string
): Promise<string> => {
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  
  const stream = file.createWriteStream({
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000', // 1年間キャッシュ
    },
    resumable: false,
  });

  return new Promise((resolve, reject) => {
    stream.on('error', (error: Error) => {
      console.error('Storage upload error:', error);
      reject(new Error('Failed to upload file to storage'));
    });

    stream.on('finish', async () => {
      try {
        // ファイルを公開可能にする
        await file.makePublic();
        
        // 公開URLを取得
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
        resolve(publicUrl);
      } catch (error) {
        console.error('Failed to make file public:', error);
        reject(new Error('Failed to make file public'));
      }
    });

    stream.end(buffer);
  });
};

/**
 * ファイル名を安全な形式に変換
 */
export const sanitizeFilename = (filename: string): string => {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  
  // ファイル名をサニタイズ（英数字、ハイフン、アンダースコアのみ）
  const sanitizedName = name
    .replace(/[^a-zA-Z0-9\-_]/g, '_')
    .substring(0, 50); // 最大50文字
  
  return `${sanitizedName}_${Date.now()}${ext}`;
};

/**
 * MIMEタイプからファイル拡張子を取得
 */
export const getExtensionFromMimeType = (mimeType: string): string => {
  switch (mimeType) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    default:
      return '.jpg';
  }
};

/**
 * ファイルサイズを人間に読みやすい形式に変換
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}; 