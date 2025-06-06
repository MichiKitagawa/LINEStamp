import { firestore, storage } from '@/utils/firebaseAdmin';
import { ImageRecord } from '@/types/images';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

/**
 * 画像生成サービスのインターフェース
 * 将来的に実際のAPIサービスと差し替える際に使用
 */
export interface ImageGenerationService {
  generateStampImages(
    stampId: string,
    originalImageUrl: string,
    prompts: string[],
    presetId: string
  ): Promise<void>;
}

/**
 * スタンプ用画像処理設定
 */
const STAMP_CONFIG = {
  width: 370,
  height: 320,
  format: 'png' as const,
  quality: 100,
  background: { r: 255, g: 255, b: 255, alpha: 0 }, // 透過背景
};

/**
 * モック画像生成サービス
 * 実際の画像生成APIの代わりに、あらかじめ用意した画像を返す
 */
export class ImageGenerationMock implements ImageGenerationService {
  /**
   * スタンプ画像を生成（モック実装）
   * @param stampId スタンプID
   * @param originalImageUrl オリジナル画像のURL（1枚）
   * @param prompts 8つのprompt
   * @param presetId プリセットID
   */
  async generateStampImages(
    stampId: string,
    originalImageUrl: string,
    prompts: string[],
    presetId: string
  ): Promise<void> {
    console.log(`🎨 Mock image generation started for stamp ${stampId}`);
    console.log(`📸 Original image: ${originalImageUrl}`);
    console.log(`🎭 Preset: ${presetId}`);
    console.log(`📝 Prompts (${prompts.length}):`, prompts);
    
    try {
      // 既存の処理済み画像を削除（重複防止）
      const existingProcessedImages = await firestore
        .collection('images')
        .where('stampId', '==', stampId)
        .where('type', '==', 'processed')
        .get();
      
      if (!existingProcessedImages.empty) {
        console.log(`🗑️ Cleaning up ${existingProcessedImages.docs.length} existing processed images for stamp ${stampId}`);
        const batch = firestore.batch();
        existingProcessedImages.docs.forEach((doc: any) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
      // あらかじめ用意された画像を使用
      const mockGeneratedImages = await this.getMockGeneratedImages(presetId);
      
      const processedImages: Omit<ImageRecord, 'id'>[] = [];
      
      for (let i = 0; i < 8; i++) {
        const sequence = i + 1;
        const filename = `processed_${sequence}.png`;
        
        // モック生成画像を処理（リサイズ・背景除去）
        const processedBuffer = await this.processGeneratedImage(
          mockGeneratedImages[i]!,
          prompts[i]!
        );
        
        // Google Cloud Storageにアップロード
        const storagePath = `users/${stampId}/stamps/${stampId}/processed/${filename}`;
        const file = storage.bucket().file(storagePath);
        
        await file.save(processedBuffer, {
          metadata: {
            contentType: 'image/png',
            customMetadata: {
              stampId,
              sequence: sequence.toString(),
              type: 'processed',
              presetId,
              prompt: prompts[i],
              originalImageUrl,
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
      
      console.log(`✅ Mock image generation completed for stamp ${stampId}. Generated 8 processed images.`);
    } catch (error) {
      console.error(`❌ Mock image generation failed for stamp ${stampId}:`, error);
      throw error;
    }
  }

  /**
   * あらかじめ用意されたモック画像を取得
   * @param presetId プリセットID
   * @returns 8枚の画像Buffer
   */
  private async getMockGeneratedImages(presetId: string): Promise<Buffer[]> {
    const mockImagesDir = path.join(__dirname, '../assets/mock-generated', presetId);
    const images: Buffer[] = [];
    
    for (let i = 1; i <= 8; i++) {
      try {
        const imagePath = path.join(mockImagesDir, `generated_${i}.png`);
        const imageBuffer = await fs.readFile(imagePath);
        images.push(imageBuffer);
      } catch (error) {
        console.warn(`⚠️ Mock image not found: ${presetId}/generated_${i}.png, using fallback`);
        // フォールバック: 白い画像
        const fallbackBuffer = await this.createFallbackImage(i);
        images.push(fallbackBuffer);
      }
    }
    
    return images;
  }

  /**
   * 生成された画像を処理（リサイズ・背景除去）
   * @param imageBuffer 生成された画像のBuffer
   * @param prompt 使用されたprompt（ログ用）
   * @returns 処理済み画像のBuffer
   */
  private async processGeneratedImage(imageBuffer: Buffer, prompt: string): Promise<Buffer> {
    console.log(`🔧 Processing generated image with prompt: "${prompt.substring(0, 50)}..."`);
    
    // Sharp.jsで画像処理
    const processedBuffer = await sharp(imageBuffer)
      .resize(STAMP_CONFIG.width, STAMP_CONFIG.height, {
        fit: 'contain', // アスペクト比を維持してリサイズ
        background: STAMP_CONFIG.background, // 透過背景
      })
      .png({
        quality: STAMP_CONFIG.quality,
        compressionLevel: 6,
      })
      .toBuffer();
    
    return processedBuffer;
  }

  /**
   * フォールバック用の白い画像を作成
   * @param sequence シーケンス番号
   * @returns 白い画像のBuffer
   */
  private async createFallbackImage(sequence: number): Promise<Buffer> {
    const fallbackBuffer = await sharp({
      create: {
        width: STAMP_CONFIG.width,
        height: STAMP_CONFIG.height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      }
    })
    .composite([{
      input: Buffer.from(`<svg width="370" height="320">
        <text x="185" y="160" text-anchor="middle" font-family="Arial" font-size="24" fill="gray">
          Mock ${sequence}
        </text>
      </svg>`),
      top: 0,
      left: 0
    }])
    .png()
    .toBuffer();
    
    return fallbackBuffer;
  }
}

/**
 * デフォルトの画像生成サービスインスタンス
 */
export const imageGenerationService: ImageGenerationService = new ImageGenerationMock(); 