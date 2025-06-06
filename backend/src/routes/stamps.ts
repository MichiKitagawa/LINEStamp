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
  PreviewStampResponse,
  ProcessedImage,
  SubmitStampRequest,
  SubmitStampResponse,
  RetryStampRequest,
  RetryStampResponse,
} from '@/types/stamps';
import { imageGenerationService } from '@/services/imageGenerationMock';
import { puppeteerSubmissionService } from '@/services/puppeteerMock';

const router = Router();

/**
 * GET /stamps/status?userId={userId}
 * ユーザーのすべてのスタンプのステータス一覧を取得
 */
router.get('/status', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
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
    const { userId } = req.query;

    console.log(`Fetching all stamp statuses for user ${uid}`);

    // クエリパラメータのuserIdが指定されている場合は、権限チェック
    if (userId && userId !== uid) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own stamp statuses',
      });
      return;
    }

    // Firestoreからユーザーのすべてのスタンプを取得
    const stampsQuery = await firestore
      .collection('stamps')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();

    const stampStatuses = stampsQuery.docs.map((doc: any) => {
      const data = doc.data() as StampRecord;
      return {
        stampId: doc.id,
        status: data.status,
        retryCount: data.retryCount || 0,
        presetId: data.presetId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });

    res.status(200).json({
      userId: uid,
      stamps: stampStatuses,
    });
  } catch (error) {
    console.error('Failed to fetch all stamp statuses:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch stamp statuses',
    });
  }
});

/**
 * POST /stamps/set-preset
 * スタンプにプリセットを設定
 */
router.post('/set-preset', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    // Firebase機能が無効な場合のチェック
    if (!firestore) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database service is not configured',
      });
      return;
    }

    // firestoreを非nullな変数にキャッシュ
    const db = firestore;
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

    await db.runTransaction(async (transaction: any) => {
      // スタンプの存在確認とユーザー権限チェック
      const stampRef = db.collection('stamps').doc(stampId);
      const stampDoc = await transaction.get(stampRef);
      
      if (!stampDoc.exists) {
        throw new Error('Stamp not found');
      }

      const stampData = stampDoc.data() as StampRecord;
      
      if (stampData.userId !== uid) {
        throw new Error('Unauthorized: This stamp does not belong to the user');
      }

      // プリセットの存在確認
      const presetRef = db.collection('presets').doc(presetId);
      const presetDoc = await transaction.get(presetRef);
      
      if (!presetDoc.exists) {
        throw new Error('Preset not found');
      }

      // トークン残高チェックを追加
      const requiredTokens = 8 * 5; // 8枚 × 5トークン = 40トークン
      const userRef = db.collection('users').doc(uid);
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }
      
      const userData = userDoc.data() as { tokenBalance?: number };
      const currentBalance = userData.tokenBalance || 0;
      
      if (currentBalance < requiredTokens) {
        throw new Error(`Insufficient tokens. Required: ${requiredTokens}, Available: ${currentBalance}`);
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

    // プリセット選択後、非同期でトークン消費と生成処理を開始
    setImmediate(async () => {
      try {
        console.log(`Starting automatic generation process for stamp ${stampId}`);
        
        // 既存の処理済み画像があるかチェック（重複生成防止）
        const existingProcessedImages = await db
          .collection('images')
          .where('stampId', '==', stampId)
          .where('type', '==', 'processed')
          .get();
        
        if (!existingProcessedImages.empty) {
          console.log(`Processed images already exist for stamp ${stampId}. Skipping generation.`);
          
          // 既に処理済み画像がある場合はステータスのみ更新
          await db.collection('stamps').doc(stampId).update({
            status: 'generated',
            updatedAt: new Date().toISOString(),
          });
          return;
        }
        
        // 1. トークンを消費
        const requiredTokens = 8 * 5; // 8枚 × 5トークン
        
        const userRef = db.collection('users').doc(uid);
        await db.runTransaction(async (transaction: any) => {
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists) {
            throw new Error('User not found');
          }
          
          const userData = userDoc.data() as { tokenBalance?: number };
          const currentBalance = userData.tokenBalance || 0;
          
          if (currentBalance < requiredTokens) {
            throw new Error(`Insufficient tokens. Required: ${requiredTokens}, Available: ${currentBalance}`);
          }
          
          transaction.update(userRef, {
            tokenBalance: currentBalance - requiredTokens,
            updatedAt: new Date().toISOString(),
          });
        });
        
        console.log(`Consumed ${requiredTokens} tokens for stamp ${stampId}`);
        
        // 2. 画像生成処理を実行
        const originalImagesQuery = await db
          .collection('images')
          .where('stampId', '==', stampId)
          .where('type', '==', 'original')
          .orderBy('sequence')
          .get();

        // オリジナル画像（1枚のみ）
        const originalImageUrl = originalImagesQuery.docs[0]?.data().url;
        
        if (!originalImageUrl) {
          throw new Error('Original image not found');
        }

        // プリセット情報を取得
        const stampDoc = await db.collection('stamps').doc(stampId).get();
        const stampData = stampDoc.data() as StampRecord;
        const presetConfig = stampData.presetConfig;
        
        if (!presetConfig?.prompts || presetConfig.prompts.length !== 8) {
          throw new Error('Invalid preset configuration: 8 prompts required');
        }

        // モック画像生成サービスを実行
        await imageGenerationService.generateStampImages(
          stampId,
          originalImageUrl,
          presetConfig.prompts,
          stampData.presetId!
        );

        // 生成完了後、ステータスを更新
        await db.collection('stamps').doc(stampId).update({
          status: 'generated',
          updatedAt: new Date().toISOString(),
        });
        
        console.log(`Stamp generation completed for ${stampId}`);
        
      } catch (error) {
        console.error(`Failed to generate stamp ${stampId}:`, error);
        
        // エラー時はステータスをfailedに更新
        await db.collection('stamps').doc(stampId).update({
          status: 'failed',
          updatedAt: new Date().toISOString(),
        });
      }
    });

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
      if (error.message.includes('Insufficient tokens')) {
        res.status(400).json({
          error: 'Bad Request',
          message: error.message,
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
    // Firebase機能が無効な場合のチェック
    if (!firestore) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database service is not configured',
      });
      return;
    }

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
    // Firebase機能が無効な場合のチェック
    if (!firestore) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database service is not configured',
      });
      return;
    }

    // firestoreを非nullな変数にキャッシュ
    const db = firestore;
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

    await db.runTransaction(async (transaction: any) => {
      // スタンプの存在確認と権限チェック
      const stampRef = db.collection('stamps').doc(stampId);
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
        const originalImagesQuery = await db
          .collection('images')
          .where('stampId', '==', stampId)
          .where('type', '==', 'original')
          .orderBy('sequence')
          .get();

        const originalImageUrls = originalImagesQuery.docs.map((doc: any) => {
          const data = doc.data() as ImageRecord;
          return data.url;
        });

        // スタンプデータとプリセット情報を取得
        const stampDoc = await db.collection('stamps').doc(stampId).get();
        const stampData = stampDoc.data() as StampRecord;
        const presetConfig = stampData.presetConfig;
        
        if (!originalImageUrls[0]) {
          throw new Error('Original image not found');
        }
        
        if (!presetConfig?.prompts || presetConfig.prompts.length !== 8) {
          throw new Error('Invalid preset configuration: 8 prompts required');
        }

        // モック画像生成サービスを実行
        await imageGenerationService.generateStampImages(
          stampId,
          originalImageUrls[0],
          presetConfig.prompts,
          stampData.presetId!
        );

        // 生成完了後、ステータスを更新
        await db.collection('stamps').doc(stampId).update({
          status: 'generated',
          updatedAt: new Date().toISOString(),
        });

        console.log(`Stamp generation completed successfully for stamp ${stampId}`);
      } catch (error) {
        console.error(`Stamp generation failed for stamp ${stampId}:`, error);
        
        // 失敗時はステータスをfailedに更新
        await db.collection('stamps').doc(stampId).update({
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

/**
 * GET /stamps/:id/preview
 * スタンプのプレビュー画像を取得
 */
router.get('/:id/preview', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
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
    const { id: stampId } = req.params;

    if (!stampId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Stamp ID is required',
      });
      return;
    }

    console.log(`Fetching preview images for stamp ${stampId}`);

    // スタンプの存在確認と権限チェック
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

    // 処理済み画像を取得（スタンプ8枚）
    const processedImagesQuery = await firestore
      .collection('images')
      .where('stampId', '==', stampId)
      .where('type', '==', 'processed')
      .orderBy('sequence')
      .get();

    const processedImages: ProcessedImage[] = processedImagesQuery.docs.map((doc: any) => {
      const data = doc.data() as ImageRecord;
      return {
        id: data.id,
        url: data.url,
        sequence: data.sequence,
        filename: data.filename,
      };
    });

    // メイン画像を取得
    let mainImage: ProcessedImage | undefined = undefined;
    const mainImageQuery = await firestore
      .collection('images')
      .where('stampId', '==', stampId)
      .where('type', '==', 'main')
      .limit(1)
      .get();

    if (!mainImageQuery.empty) {
      const mainImageDoc = mainImageQuery.docs[0];
      if (mainImageDoc) {
        const mainImageData = mainImageDoc.data() as ImageRecord;
        mainImage = {
          id: mainImageData.id,
          url: mainImageData.url,
          sequence: mainImageData.sequence,
          filename: mainImageData.filename,
        };
      }
    }

    // タブ画像を取得
    let tabImage: ProcessedImage | undefined = undefined;
    const tabImageQuery = await firestore
      .collection('images')
      .where('stampId', '==', stampId)
      .where('type', '==', 'tab')
      .limit(1)
      .get();

    if (!tabImageQuery.empty) {
      const tabImageDoc = tabImageQuery.docs[0];
      if (tabImageDoc) {
        const tabImageData = tabImageDoc.data() as ImageRecord;
        tabImage = {
          id: tabImageData.id,
          url: tabImageData.url,
          sequence: tabImageData.sequence,
          filename: tabImageData.filename,
        };
      }
    }

    const response: PreviewStampResponse = {
      stampId,
      processedImages,
      ...(mainImage && { mainImage }),
      ...(tabImage && { tabImage }),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Failed to fetch preview images:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch preview images',
    });
  }
});

/**
 * POST /stamps/submit
 * スタンプの申請を開始
 */
router.post('/submit', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    // Firebase機能が無効な場合のチェック
    if (!firestore) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database service is not configured',
      });
      return;
    }

    // firestoreを非nullな変数にキャッシュ
    const db = firestore;
    const uid = req.uid!;
    const { stampId } = req.body as SubmitStampRequest;

    if (!stampId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'stampId is required',
      });
      return;
    }

    console.log(`Starting stamp submission for stamp ${stampId}`);

    await db.runTransaction(async (transaction: any) => {
      // スタンプの存在確認と権限チェック
      const stampRef = db.collection('stamps').doc(stampId);
      const stampDoc = await transaction.get(stampRef);
      
      if (!stampDoc.exists) {
        throw new Error('Stamp not found');
      }

      const stampData = stampDoc.data() as StampRecord;
      
      if (stampData.userId !== uid) {
        throw new Error('Unauthorized: This stamp does not belong to the user');
      }

      // ステータスの検証
      if (stampData.status !== 'generated') {
        throw new Error(`Invalid status: ${stampData.status}. Can only submit from generated status.`);
      }

      // ステータスをsubmittingに更新
      transaction.update(stampRef, {
        status: 'submitting',
        updatedAt: new Date().toISOString(),
      });
    });

    // 非同期でPuppeteer申請処理を開始
    setImmediate(async () => {
      try {
        // モックPuppeteer申請処理を実行
        await puppeteerSubmissionService.submitStamp(stampId);

        // 申請完了後、ステータスを更新
        await db.collection('stamps').doc(stampId).update({
          status: 'submitted',
          updatedAt: new Date().toISOString(),
        });

        console.log(`Stamp submission completed successfully for stamp ${stampId}`);
      } catch (error) {
        console.error(`Stamp submission failed for stamp ${stampId}:`, error);
        
        // 失敗時はステータスをfailedに更新
        await db.collection('stamps').doc(stampId).update({
          status: 'failed',
          updatedAt: new Date().toISOString(),
        });
      }
    });

    const response: SubmitStampResponse = {
      stampId,
      status: 'submitting',
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Failed to start stamp submission:', error);
    
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
          message: 'You do not have permission to submit this stamp',
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
      message: 'Failed to start stamp submission',
    });
  }
});

/**
 * POST /stamps/retry
 * スタンプの再申請を開始
 */
router.post('/retry', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    // Firebase機能が無効な場合のチェック
    if (!firestore) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database service is not configured',
      });
      return;
    }

    // firestoreを非nullな変数にキャッシュ
    const db = firestore;
    const uid = req.uid!;
    const { stampId } = req.body as RetryStampRequest;

    if (!stampId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'stampId is required',
      });
      return;
    }

    console.log(`Starting stamp retry for stamp ${stampId}`);

    let currentRetryCount = 0;

    await db.runTransaction(async (transaction: any) => {
      // スタンプの存在確認と権限チェック
      const stampRef = db.collection('stamps').doc(stampId);
      const stampDoc = await transaction.get(stampRef);
      
      if (!stampDoc.exists) {
        throw new Error('Stamp not found');
      }

      const stampData = stampDoc.data() as StampRecord;
      
      if (stampData.userId !== uid) {
        throw new Error('Unauthorized: This stamp does not belong to the user');
      }

      // ステータスの検証
      if (stampData.status !== 'failed') {
        throw new Error(`Invalid status: ${stampData.status}. Can only retry from failed status.`);
      }

      // リトライ回数をインクリメント
      currentRetryCount = (stampData.retryCount || 0) + 1;

      // ステータスをsubmittingに更新し、リトライ回数をインクリメント
      transaction.update(stampRef, {
        status: 'submitting',
        retryCount: currentRetryCount,
        updatedAt: new Date().toISOString(),
      });
    });

    // 非同期でPuppeteer再申請処理を開始
    setImmediate(async () => {
      try {
        // モックPuppeteer申請処理を実行
        await puppeteerSubmissionService.submitStamp(stampId);

        // 申請完了後、ステータスを更新
        await db.collection('stamps').doc(stampId).update({
          status: 'submitted',
          updatedAt: new Date().toISOString(),
        });

        console.log(`Stamp retry completed successfully for stamp ${stampId}, retry count: ${currentRetryCount}`);
      } catch (error) {
        console.error(`Stamp retry failed for stamp ${stampId}:`, error);
        
        // 失敗時はステータスをfailedまたはsession_expiredに更新
        // ここではランダムでsession_expiredになる可能性をシミュレート
        const failureStatus = Math.random() < 0.3 ? 'session_expired' : 'failed';
        
        await db.collection('stamps').doc(stampId).update({
          status: failureStatus,
          updatedAt: new Date().toISOString(),
        });

        console.log(`Stamp retry failed with status: ${failureStatus}`);
      }
    });

    const response: RetryStampResponse = {
      stampId,
      status: 'submitting',
      retryCount: currentRetryCount,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Failed to start stamp retry:', error);
    
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
          message: 'You do not have permission to retry this stamp',
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
      message: 'Failed to start stamp retry',
    });
  }
});


/**
 * POST /stamps/clear-submitted
 * submitted状態のスタンプを初期化（新規作成前の準備）
 */
router.post('/clear-submitted', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!firestore) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database service is not configured',
      });
      return;
    }

    const uid = req.uid!;
    console.log(`Clearing submitted stamps for user ${uid}`);

    // ユーザーのsubmitted状態のスタンプを取得
    const submittedStampsQuery = await firestore
      .collection('stamps')
      .where('userId', '==', uid)
      .where('status', '==', 'submitted')
      .get();

    if (submittedStampsQuery.empty) {
      res.status(200).json({
        message: 'No submitted stamps found to clear',
        clearedCount: 0,
      });
      return;
    }

    // バッチ削除でsubmittedスタンプを削除
    const batch = firestore.batch();
    let clearedCount = 0;

    submittedStampsQuery.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
      clearedCount++;
    });

    // 関連する画像データも削除
    for (const stampDoc of submittedStampsQuery.docs) {
      const stampId = stampDoc.id;
      const imagesQuery = await firestore
        .collection('images')
        .where('stampId', '==', stampId)
        .get();
      
      imagesQuery.docs.forEach((imageDoc: any) => {
        batch.delete(imageDoc.ref);
      });
    }

    await batch.commit();

    console.log(`Cleared ${clearedCount} submitted stamps for user ${uid}`);

    res.status(200).json({
      message: `Successfully cleared ${clearedCount} submitted stamps`,
      clearedCount,
    });
  } catch (error) {
    console.error('Failed to clear submitted stamps:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to clear submitted stamps',
    });
  }
});

/**
 * GET /stamps/:id/download
 * スタンプ画像をZIPファイルでダウンロード
 */
router.get('/:id/download', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const uid = req.uid!;
    const { id: stampId } = req.params;

    // スタンプの存在確認と権限チェック
    const stampDoc = await firestore.collection('stamps').doc(stampId).get();
    if (!stampDoc.exists) {
      res.status(404).json({ error: 'Stamp not found' });
      return;
    }

    const stampData = stampDoc.data() as StampRecord;
    if (stampData.userId !== uid) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    // 処理済み画像を取得（将来的にZIP生成に使用）
    // const processedImagesQuery = await firestore
    //   .collection('images')
    //   .where('stampId', '==', stampId)
    //   .where('type', '==', 'processed')
    //   .orderBy('sequence')
    //   .get();

    // 処理済み画像データを取得（将来的にZIP生成に使用）
    // const images = processedImagesQuery.docs.map((doc: any) => doc.data() as ImageRecord);

    // ZIPファイル生成とダウンロード
    // (archiver ライブラリを使用)
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="stamp-${stampId}.zip"`);
    
    // TODO: 実装はarchiverライブラリが必要
    res.status(501).json({ error: 'ZIP download not implemented yet' });
    
  } catch (error) {
    console.error('Download failed:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

export default router; 