import { Router, Request, Response } from 'express';
import { verifyIdToken } from '@/middleware/verifyIdToken';
import { firestore } from '@/utils/firebaseAdmin';
import { 
  SetPresetRequest, 
  SetPresetResponse, 
  StampRecord,
  ImageRecord,
} from '@/types/images';
import {
  GenerateStampRequest,
  GenerateStampResponse,
} from '@/types/stamps';
import { imageGeneratorService } from '@/services/imageGeneratorMock';

const router = Router();

/**
 * POST /stamps/set-preset
 * スタンプにプリセットを設定
 */
router.post('/set-preset', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const uid = req.uid!;
    const { stampId, presetId } = req.body as SetPresetRequest;

    if (!stampId || !presetId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'stampId and presetId are required',
      });
      return;
    }

    console.log(`Setting preset ${presetId} for stamp ${stampId}`);

    await firestore.runTransaction(async (transaction) => {
      // スタンプの存在確認とユーザー権限チェック
      const stampRef = firestore.collection('stamps').doc(stampId);
      const stampDoc = await transaction.get(stampRef);
      
      if (!stampDoc.exists) {
        throw new Error('Stamp not found');
      }

      const stampData = stampDoc.data() as StampRecord;
      
      if (stampData.userId !== uid) {
        throw new Error('Unauthorized: This stamp does not belong to the user');
      }

      // プリセットの存在確認
      const presetRef = firestore.collection('presets').doc(presetId);
      const presetDoc = await transaction.get(presetRef);
      
      if (!presetDoc.exists) {
        throw new Error('Preset not found');
      }

      const presetData = presetDoc.data();
      
      // スタンプにプリセット情報を設定
      const updateData = {
        presetId,
        presetConfig: presetData?.['config'],
        status: 'generating',
        updatedAt: new Date().toISOString(),
      };

      transaction.update(stampRef, updateData);
    });

    console.log(`Successfully set preset ${presetId} for stamp ${stampId}`);

    const response: SetPresetResponse = {
      stampId,
      presetId,
      status: 'generating',
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Failed to set preset:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Stamp not found') {
        res.status(404).json({
          error: 'Not Found',
          message: 'Stamp not found',
        });
        return;
      }
      if (error.message === 'Preset not found') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid preset ID',
        });
        return;
      }
      if (error.message.includes('Unauthorized')) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to modify this stamp',
        });
        return;
      }
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to set preset',
    });
  }
});

/**
 * GET /stamps/:id/status
 * スタンプの状態を取得
 */
router.get('/:id/status', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const uid = req.uid!;
    const { id: stampId } = req.params;

    if (!stampId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Stamp ID is required',
      });
      return;
    }

    console.log(`Fetching status for stamp ${stampId}`);

    const stampDoc = await firestore.collection('stamps').doc(stampId).get();
    
    if (!stampDoc.exists) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Stamp not found',
      });
      return;
    }

    const stampData = stampDoc.data() as StampRecord;
    
    if (stampData.userId !== uid) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this stamp',
      });
      return;
    }

    const response = {
      stampId,
      status: stampData.status,
      retryCount: stampData.retryCount,
      presetId: stampData.presetId,
      createdAt: stampData.createdAt,
      updatedAt: stampData.updatedAt,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Failed to fetch stamp status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch stamp status',
    });
  }
});

/**
 * POST /stamps/generate
 * スタンプ生成を開始
 */
router.post('/generate', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const uid = req.uid!;
    const { stampId } = req.body as GenerateStampRequest;

    if (!stampId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'stampId is required',
      });
      return;
    }

    console.log(`Starting stamp generation for stamp ${stampId}`);

    await firestore.runTransaction(async (transaction) => {
      // スタンプの存在確認と権限チェック
      const stampRef = firestore.collection('stamps').doc(stampId);
      const stampDoc = await transaction.get(stampRef);
      
      if (!stampDoc.exists) {
        throw new Error('Stamp not found');
      }

      const stampData = stampDoc.data() as StampRecord;
      
      if (stampData.userId !== uid) {
        throw new Error('Unauthorized: This stamp does not belong to the user');
      }

      // ステータスの検証
      if (stampData.status !== 'pending_upload' && stampData.status !== 'pending_generate') {
        throw new Error(`Invalid status: ${stampData.status}. Can only generate from pending_upload or pending_generate status.`);
      }

      // ステータスをgeneratingに更新
      transaction.update(stampRef, {
        status: 'generating',
        updatedAt: new Date().toISOString(),
      });
    });

    // 非同期でスタンプ生成処理を開始
    setImmediate(async () => {
      try {
        // オリジナル画像のURLを取得
        const originalImagesQuery = await firestore
          .collection('images')
          .where('stampId', '==', stampId)
          .where('type', '==', 'original')
          .orderBy('sequence')
          .get();

        const originalImageUrls = originalImagesQuery.docs.map(doc => {
          const data = doc.data() as ImageRecord;
          return data.url;
        });

        // モック画像生成サービスを実行
        await imageGeneratorService.generateStampImages(stampId, originalImageUrls);

        // 生成完了後、ステータスを更新
        await firestore.collection('stamps').doc(stampId).update({
          status: 'generated',
          updatedAt: new Date().toISOString(),
        });

        console.log(`Stamp generation completed successfully for stamp ${stampId}`);
      } catch (error) {
        console.error(`Stamp generation failed for stamp ${stampId}:`, error);
        
        // 失敗時はステータスをfailedに更新
        await firestore.collection('stamps').doc(stampId).update({
          status: 'failed',
          updatedAt: new Date().toISOString(),
        });
      }
    });

    const response: GenerateStampResponse = {
      stampId,
      status: 'generating',
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Failed to start stamp generation:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Stamp not found') {
        res.status(404).json({
          error: 'Not Found',
          message: 'Stamp not found',
        });
        return;
      }
      if (error.message.includes('Unauthorized')) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to generate this stamp',
        });
        return;
      }
      if (error.message.includes('Invalid status')) {
        res.status(400).json({
          error: 'Bad Request',
          message: error.message,
        });
        return;
      }
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to start stamp generation',
    });
  }
});

export default router; 