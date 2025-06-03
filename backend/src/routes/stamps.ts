import { Router, Request, Response } from 'express';
import { verifyIdToken } from '@/middleware/verifyIdToken';
import { firestore } from '@/utils/firebaseAdmin';
import { 
  SetPresetRequest, 
  SetPresetResponse, 
  StampRecord 
} from '@/types/images';

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

export default router; 