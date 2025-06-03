import { Router, Request, Response } from 'express';
import { verifyIdToken } from '@/middleware/verifyIdToken';
import { firestore } from '@/utils/firebaseAdmin';
import { 
  PresetListResponse, 
  Preset, 
  DEFAULT_PRESETS 
} from '@/types/images';

const router = Router();

/**
 * GET /presets/list
 * プリセット一覧を取得
 */
router.get('/list', verifyIdToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log('Fetching presets list');

    const presetsSnapshot = await firestore.collection('presets').get();
    
    let presets: Preset[] = [];
    
    if (presetsSnapshot.empty) {
      // プリセットが存在しない場合、デフォルトプリセットを作成
      console.log('No presets found, creating default presets');
      
      const batch = firestore.batch();
      const defaultPresetsList: Preset[] = [];
      
      for (const [id, presetData] of Object.entries(DEFAULT_PRESETS)) {
        const preset: Preset = {
          id,
          ...presetData,
          createdAt: new Date().toISOString(),
        };
        
        const presetRef = firestore.collection('presets').doc(id);
        batch.set(presetRef, preset);
        defaultPresetsList.push(preset);
      }
      
      await batch.commit();
      presets = defaultPresetsList;
      console.log(`Created ${presets.length} default presets`);
    } else {
      // 既存のプリセットを取得
      presets = presetsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Preset));
      console.log(`Found ${presets.length} existing presets`);
    }

    // レスポンスデータから不要な情報を除外（configは詳細なので一覧では返さない）
    const presetsForList = presets.map(preset => ({
      id: preset.id,
      label: preset.label,
      description: preset.description,
      thumbnailUrl: preset.thumbnailUrl,
    }));

    const response: PresetListResponse = {
      presets: presetsForList as Preset[],
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Failed to fetch presets:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch presets',
    });
  }
});

/**
 * GET /presets/:id
 * 特定のプリセット詳細を取得
 */
router.get('/:id', verifyIdToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Preset ID is required',
      });
      return;
    }

    console.log(`Fetching preset: ${id}`);

    const presetDoc = await firestore.collection('presets').doc(id).get();
    
    if (!presetDoc.exists) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Preset not found',
      });
      return;
    }

    const preset: Preset = {
      id: presetDoc.id,
      ...presetDoc.data()
    } as Preset;

    res.status(200).json(preset);
  } catch (error) {
    console.error('Failed to fetch preset:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch preset',
    });
  }
});

export default router; 