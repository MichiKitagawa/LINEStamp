import { Router, Request, Response } from 'express';
import { verifyIdToken } from '@/middleware/verifyIdToken';
import { upload, handleUploadError, validateFiles } from '@/middleware/uploadMiddleware';
import { firestore } from '@/utils/firebaseAdmin';
import { uploadFileToStorage, generateStoragePath, sanitizeFilename } from '@/utils/storageClient';
import { 
  UploadResponse, 
  ImageRecord, 
  StampRecord,
  UPLOAD_VALIDATION 
} from '@/types/images';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

/**
 * POST /images/upload
 * 画像ファイルをアップロードし、Firebase Storageに保存
 */
router.post(
  '/upload',
  verifyIdToken,
  upload.array('images', UPLOAD_VALIDATION.MAX_FILES),
  handleUploadError,
  validateFiles,
  async (req: Request, res: Response) => {
    try {
      // Firebase機能が無効な場合のチェック
      if (!firestore) {
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'Database service is not configured',
        });
        return;
      }

      const uid = req.uid!;
      const files = req.files as Express.Multer.File[];
      const stampId = uuidv4();
      
      console.log(`Starting image upload for user ${uid}, stampId: ${stampId}, files: ${files.length}`);

      // Firebase Storageへのアップロード処理
      const uploadPromises = files.map(async (file, index) => {
        const sanitizedFilename = sanitizeFilename(file.originalname);
        const storagePath = generateStoragePath({
          userId: uid,
          stampId,
          type: 'original',
          filename: sanitizedFilename,
        });

        try {
          const url = await uploadFileToStorage(file.buffer, storagePath, file.mimetype);
          return {
            url,
            filename: sanitizedFilename,
            sequence: index + 1,
          };
        } catch (error) {
          console.error(`Failed to upload file ${file.originalname}:`, error);
          throw new Error(`Failed to upload file: ${file.originalname}`);
        }
      });

      const uploadResults = await Promise.all(uploadPromises);
      console.log(`Successfully uploaded ${uploadResults.length} files to Storage`);

      // Firestoreトランザクション
      const imageIds: string[] = [];
      
      await firestore.runTransaction(async (transaction: any) => {
        // スタンプドキュメントを作成
        const stampData: Omit<StampRecord, 'id'> = {
          userId: uid,
          status: 'generating',
          retryCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        const stampRef = firestore.collection('stamps').doc(stampId);
        transaction.set(stampRef, stampData);

        // 画像レコードを作成
        for (const result of uploadResults) {
          const imageId = uuidv4();
          imageIds.push(imageId);
          
          const imageData: Omit<ImageRecord, 'id'> = {
            stampId,
            type: 'original',
            url: result.url,
            sequence: result.sequence,
            filename: result.filename,
            createdAt: new Date().toISOString(),
          };
          
          const imageRef = firestore.collection('images').doc(imageId);
          transaction.set(imageRef, imageData);
        }
      });

      console.log(`Successfully saved ${imageIds.length} image records to Firestore`);

      const response: UploadResponse = {
        stampId,
        uploadedCount: files.length,
        imageIds,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Image upload error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to upload images',
      });
    }
  }
);

export default router; 