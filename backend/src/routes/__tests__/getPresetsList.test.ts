import request from 'supertest';
import express from 'express';

// Firebase Admin SDK をモック
jest.mock('../../utils/firebaseAdmin', () => ({
  firestore: {
    collection: jest.fn(),
    batch: jest.fn(),
  },
}));

import presetsRoutes from '../presets';
import { firestore } from '../../utils/firebaseAdmin';

const mockFirestore = firestore as jest.Mocked<typeof firestore>;

// Express アプリを設定
const app = express();
app.use(express.json());
app.use('/presets', presetsRoutes);

// 認証ミドルウェアをモック
jest.mock('../../middleware/verifyIdToken', () => ({
  verifyIdToken: (req: any, _res: any, next: any) => {
    req.uid = 'test-user-id';
    next();
  },
}));

describe('プリセット一覧取得 API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1.3.2-01 presets コレクションに事前データを用意', () => {
    it('正しい id, label, thumbnailUrl が返る', async () => {
      // モック設定 - 既存のプリセットデータ
      const mockPresetData = [
        {
          id: 'simple-white',
          label: 'シンプル白背景',
          description: 'シンプルな白背景で清潔感のあるスタンプ',
          thumbnailUrl: '/presets/simple-white.png',
          config: {
            style: 'simple',
            backgroundColor: '#FFFFFF',
            borderStyle: 'none',
            effects: [],
          },
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'colorful-pop',
          label: 'カラフルポップ',
          description: 'カラフルで明るい雰囲気のスタンプ',
          thumbnailUrl: '/presets/colorful-pop.png',
          config: {
            style: 'pop',
            backgroundColor: '#FFE4E1',
            borderStyle: 'round',
            effects: ['glow', 'shadow'],
          },
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ];

      const mockDocs = mockPresetData.map(data => ({
        id: data.id,
        data: () => data,
      }));

      mockFirestore.collection.mockReturnValue({
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: mockDocs,
        }),
      } as any);

      const response = await request(app)
        .get('/presets/list')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('presets');
      expect(Array.isArray(response.body.presets)).toBe(true);
      expect(response.body.presets).toHaveLength(2);
      
      // 各プリセットが期待されるプロパティを持つことを確認
      const preset1 = response.body.presets.find((p: any) => p.id === 'simple-white');
      expect(preset1).toEqual({
        id: 'simple-white',
        label: 'シンプル白背景',
        description: 'シンプルな白背景で清潔感のあるスタンプ',
        thumbnailUrl: '/presets/simple-white.png',
      });

      const preset2 = response.body.presets.find((p: any) => p.id === 'colorful-pop');
      expect(preset2).toEqual({
        id: 'colorful-pop',
        label: 'カラフルポップ',
        description: 'カラフルで明るい雰囲気のスタンプ',
        thumbnailUrl: '/presets/colorful-pop.png',
      });
    });
  });

  describe('1.3.2-02 presets コレクションが空', () => {
    it('空配列を返す（デフォルトプリセットを作成後）', async () => {
      // モック設定 - 空のコレクション → デフォルト作成
      const mockBatch = {
        set: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };

      mockFirestore.collection.mockReturnValue({
        get: jest.fn().mockResolvedValue({
          empty: true,
          docs: [],
        }),
        doc: jest.fn().mockReturnValue({}),
      } as any);

      mockFirestore.batch.mockReturnValue(mockBatch as any);

      const response = await request(app)
        .get('/presets/list')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('presets');
      expect(Array.isArray(response.body.presets)).toBe(true);
      expect(response.body.presets.length).toBeGreaterThan(0); // デフォルトプリセットが作成される

      // デフォルトプリセットが作成されたことを確認
      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
      
      // 作成されたプリセットが期待される構造を持つことを確認
      const firstPreset = response.body.presets[0];
      expect(firstPreset).toHaveProperty('id');
      expect(firstPreset).toHaveProperty('label');
      expect(firstPreset).toHaveProperty('description');
      expect(firstPreset).toHaveProperty('thumbnailUrl');
    });
  });

  describe('エラーハンドリング', () => {
    it('Firestore エラー時に 500 を返す', async () => {
      mockFirestore.collection.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('Firestore error')),
      } as any);

      const response = await request(app)
        .get('/presets/list')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal Server Error');
      expect(response.body).toHaveProperty('message', 'Failed to fetch presets');
    });
  });
}); 