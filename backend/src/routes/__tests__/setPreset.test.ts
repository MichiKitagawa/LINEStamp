import request from 'supertest';
import express from 'express';

// Firebase Admin SDK をモック
jest.mock('../../utils/firebaseAdmin', () => ({
  firestore: {
    collection: jest.fn(),
    runTransaction: jest.fn(),
  },
}));

import stampsRoutes from '../stamps';
import { firestore } from '../../utils/firebaseAdmin';

const mockFirestore = firestore as jest.Mocked<typeof firestore>;

// Express アプリを設定
const app = express();
app.use(express.json());
app.use('/stamps', stampsRoutes);

// 認証ミドルウェアをモック
jest.mock('../../middleware/verifyIdToken', () => ({
  verifyIdToken: (req: any, _res: any, next: any) => {
    req.uid = 'test-user-id';
    next();
  },
}));

describe('プリセット設定 API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1.3.3-01 存在する presetId, stampId を送信', () => {
    it('Firestore 上で presetId, presetConfig が更新され、status="generating" がセットされる', async () => {
      const mockStampData = {
        id: 'test-stamp-id',
        userId: 'test-user-id',
        status: 'pending_upload',
        retryCount: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const mockPresetData = {
        id: 'simple-white',
        label: 'シンプル白背景',
        config: {
          style: 'simple',
          backgroundColor: '#FFFFFF',
          borderStyle: 'none',
          effects: [],
        },
      };

      const mockTransactionGet = jest.fn();
      const mockTransactionUpdate = jest.fn();

      // スタンプドキュメントの取得をモック
      mockTransactionGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => mockStampData,
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => mockPresetData,
        });

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({}),
      } as any);

      mockFirestore.runTransaction.mockImplementation(async (callback: any) => {
        await callback({
          get: mockTransactionGet,
          update: mockTransactionUpdate,
          set: jest.fn(),
          create: jest.fn(),
          delete: jest.fn(),
          getAll: jest.fn(),
        } as any);
      });

      const response = await request(app)
        .post('/stamps/set-preset')
        .set('Authorization', 'Bearer test-token')
        .send({
          stampId: 'test-stamp-id',
          presetId: 'simple-white',
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        stampId: 'test-stamp-id',
        presetId: 'simple-white',
        status: 'generating',
      });

      // トランザクション内で適切な更新が行われたことを確認
      expect(mockTransactionUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          presetId: 'simple-white',
          presetConfig: mockPresetData.config,
          status: 'generating',
        })
      );
    });

    it('別のユーザーのスタンプにアクセスしようとすると403エラーを返す', async () => {
      const mockStampData = {
        id: 'test-stamp-id',
        userId: 'other-user-id', // 異なるユーザー
        status: 'pending_upload',
        retryCount: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const mockTransactionGet = jest.fn().mockResolvedValue({
        exists: true,
        data: () => mockStampData,
      });

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({}),
      } as any);

      mockFirestore.runTransaction.mockImplementation(async (callback: any) => {
        try {
          await callback({
            get: mockTransactionGet,
            update: jest.fn(),
            set: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
            getAll: jest.fn(),
          } as any);
        } catch (error) {
          throw error;
        }
      });

      const response = await request(app)
        .post('/stamps/set-preset')
        .set('Authorization', 'Bearer test-token')
        .send({
          stampId: 'test-stamp-id',
          presetId: 'simple-white',
        });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Forbidden');
    });
  });

  describe('1.3.3-02 存在しない presetId → HTTP 400 を返す', () => {
    it('存在しないプリセットIDを指定すると400エラーを返す', async () => {
      const mockStampData = {
        id: 'test-stamp-id',
        userId: 'test-user-id',
        status: 'pending_upload',
        retryCount: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const mockTransactionGet = jest.fn()
        .mockResolvedValueOnce({
          exists: true,
          data: () => mockStampData,
        })
        .mockResolvedValueOnce({
          exists: false, // プリセットが存在しない
        });

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({}),
      } as any);

      mockFirestore.runTransaction.mockImplementation(async (callback: any) => {
        try {
          await callback({
            get: mockTransactionGet,
            update: jest.fn(),
            set: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
            getAll: jest.fn(),
          } as any);
        } catch (error) {
          throw error;
        }
      });

      const response = await request(app)
        .post('/stamps/set-preset')
        .set('Authorization', 'Bearer test-token')
        .send({
          stampId: 'test-stamp-id',
          presetId: 'non-existent-preset',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body).toHaveProperty('message', 'Invalid preset ID');
    });

    it('存在しないスタンプIDを指定すると404エラーを返す', async () => {
      const mockTransactionGet = jest.fn().mockResolvedValue({
        exists: false, // スタンプが存在しない
      });

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({}),
      } as any);

      mockFirestore.runTransaction.mockImplementation(async (callback: any) => {
        try {
          await callback({
            get: mockTransactionGet,
            update: jest.fn(),
            set: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
            getAll: jest.fn(),
          } as any);
        } catch (error) {
          throw error;
        }
      });

      const response = await request(app)
        .post('/stamps/set-preset')
        .set('Authorization', 'Bearer test-token')
        .send({
          stampId: 'non-existent-stamp',
          presetId: 'simple-white',
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body).toHaveProperty('message', 'Stamp not found');
    });
  });

  describe('バリデーション', () => {
    it('stampId が未指定の場合400エラーを返す', async () => {
      const response = await request(app)
        .post('/stamps/set-preset')
        .set('Authorization', 'Bearer test-token')
        .send({
          presetId: 'simple-white',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body).toHaveProperty('message', 'stampId and presetId are required');
    });

    it('presetId が未指定の場合400エラーを返す', async () => {
      const response = await request(app)
        .post('/stamps/set-preset')
        .set('Authorization', 'Bearer test-token')
        .send({
          stampId: 'test-stamp-id',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body).toHaveProperty('message', 'stampId and presetId are required');
    });
  });
}); 