import { firestore, storage } from '@/utils/firebaseAdmin';
import { ImageRecord } from '@/types/images';

/**
 * 画像生成サービスのインターフェース
 * 将来的に実際のAPIサービスと差し替える際に使用
 */
export interface ImageGeneratorService {
  generateStampImages(stampId: string, originalImageUrls: string[]): Promise<void>;
}

/**
 * ダミー画像データ（Base64エンコードされた1x1の透過PNG）
 */
const DUMMY_TRANSPARENT_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA6vprtAAAAABJRU5ErkJggg==';

/**
 * モック画像生成サービス
 * 実際の画像生成APIの代わりに、ダミー画像を生成する
 */
export class ImageGeneratorMock implements ImageGeneratorService {
  /**
   * スタンプ画像を生成（モック実装）
   * @param stampId スタンプID
   * @param originalImageUrls オリジナル画像のURLリスト
   */
  async generateStampImages(stampId: string, originalImageUrls: string[]): Promise<void> {
    console.log(`Mock image generation started for stamp ${stampId} with ${originalImageUrls.length} original images`);
    
    try {
      // 8枚のダミー画像を生成
      const STAMP_COUNT = 8;
      const processedImages: Omit<ImageRecord, 'id'>[] = [];
      
      for (let i = 0; i < STAMP_COUNT; i++) {
        const sequence = i + 1;
        const filename = `processed_${sequence}.png`;
        
        // ダミー画像をStorageにアップロード
        const storagePath = `users/${stampId}/stamps/${stampId}/processed/${filename}`;
        const file = storage.bucket().file(storagePath);
        
        // Base64データをBufferに変換
        const imageBuffer = Buffer.from(DUMMY_TRANSPARENT_PNG, 'base64');
        
        // Storageにアップロード
        await file.save(imageBuffer, {
          metadata: {
            contentType: 'image/png',
            customMetadata: {
              stampId,
              sequence: sequence.toString(),
              type: 'processed',
            },
          },
        });
        
        // 公開URLを取得
        await file.makePublic();
        const url = `https://storage.googleapis.com/${storage.bucket().name}/${storagePath}`;
        
        // Firestoreに保存するデータを準備
        processedImages.push({
          stampId,
          type: 'processed',
          url,
          sequence,
          filename,
          createdAt: new Date().toISOString(),
        });
      }
      
      // Firestoreに一括保存
      const batch = firestore.batch();
      
      processedImages.forEach((imageData) => {
        const imageRef = firestore.collection('images').doc();
        batch.set(imageRef, { ...imageData, id: imageRef.id });
      });
      
      await batch.commit();
      
      console.log(`Mock image generation completed for stamp ${stampId}. Generated ${STAMP_COUNT} processed images.`);
    } catch (error) {
      console.error(`Mock image generation failed for stamp ${stampId}:`, error);
      throw error;
    }
  }
}

/**
 * デフォルトの画像生成サービスインスタンス
 */
export const imageGeneratorService: ImageGeneratorService = new ImageGeneratorMock(); 