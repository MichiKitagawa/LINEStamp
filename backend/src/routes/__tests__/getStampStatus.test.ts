import request from 'supertest';
import express from 'express';
import stampsRouter from '../stamps';

// モック設定を最初に行う
jest.mock('../../utils/firebaseAdmin', () => ({
  firestore: {
    collection: jest.fn(),
    runTransaction: jest.fn(),
  },
  auth: {},
  storage: {},
  admin: {},
}));

jest.mock('../../middleware/verifyIdToken', () => ({
  verifyIdToken: jest.fn(),
}));

import { verifyIdToken } from '../../middleware/verifyIdToken';
import { firestore } from '../../utils/firebaseAdmin';

const mockVerifyIdToken = verifyIdToken as jest.MockedFunction<typeof verifyIdToken>;
const mockFirestore = firestore as jest.Mocked<typeof firestore>;

// Expressアプリのセットアップ
const app = express();
app.use(express.json());
app.use('/stamps', stampsRouter);

describe('GET /stamps/:id/status', () => {
  const mockUid = 'test-uid';
  const mockStampId = 'test-stamp-id';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // verifyIdTokenミドルウェアのモック
    mockVerifyIdToken.mockImplementation(async (req: any, _res: any, next: any) => {
      req.uid = mockUid;
      next();
    });
  });

  describe('1.4.3-01: 正常系 - 各ステータスの取得', () => {
    it('should return generating status correctly', async () => {
      const mockStampDoc = {
        exists: true,
        data: () => ({
          id: mockStampId,
          userId: mockUid,
          status: 'generating',
          retryCount: 0,
          presetId: 'simple-white',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T12:00:00.000Z',
        }),
      };

      const mockGet = jest.fn().mockResolvedValue(mockStampDoc);

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet,
        }),
      });

      const response = await request(app)
        .get(`/stamps/${mockStampId}/status`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        stampId: mockStampId,
        status: 'generating',
        retryCount: 0,
        presetId: 'simple-white',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T12:00:00.000Z',
      });
    });

    it('should return generated status correctly', async () => {
      const mockStampDoc = {
        exists: true,
        data: () => ({
          id: mockStampId,
          userId: mockUid,
          status: 'generated',
          retryCount: 0,
          presetId: 'colorful-pop',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T12:30:00.000Z',
        }),
      };

      const mockGet = jest.fn().mockResolvedValue(mockStampDoc);

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet,
        }),
      });

      const response = await request(app)
        .get(`/stamps/${mockStampId}/status`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        stampId: mockStampId,
        status: 'generated',
        retryCount: 0,
        presetId: 'colorful-pop',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T12:30:00.000Z',
      });
    });

    it('should return failed status with retry count', async () => {
      const mockStampDoc = {
        exists: true,
        data: () => ({
          id: mockStampId,
          userId: mockUid,
          status: 'failed',
          retryCount: 2,
          presetId: 'vintage-retro',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T13:00:00.000Z',
        }),
      };

      const mockGet = jest.fn().mockResolvedValue(mockStampDoc);

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet,
        }),
      });

      const response = await request(app)
        .get(`/stamps/${mockStampId}/status`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        stampId: mockStampId,
        status: 'failed',
        retryCount: 2,
        presetId: 'vintage-retro',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T13:00:00.000Z',
      });
    });
  });

  describe('1.4.3-02: 異常系 - スタンプが存在しない', () => {
    it('should return 404 when stamp does not exist', async () => {
      const mockStampDoc = {
        exists: false,
      };

      const mockGet = jest.fn().mockResolvedValue(mockStampDoc);

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet,
        }),
      });

      const response = await request(app)
        .get(`/stamps/${mockStampId}/status`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Not Found',
        message: 'Stamp not found',
      });
    });
  });

  describe('権限エラー', () => {
    it('should return 403 when user does not own the stamp', async () => {
      const mockStampDoc = {
        exists: true,
        data: () => ({
          id: mockStampId,
          userId: 'other-user-id', // 異なるユーザーID
          status: 'generating',
          retryCount: 0,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T12:00:00.000Z',
        }),
      };

      const mockGet = jest.fn().mockResolvedValue(mockStampDoc);

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet,
        }),
      });

      const response = await request(app)
        .get(`/stamps/${mockStampId}/status`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'Forbidden',
        message: 'You do not have permission to access this stamp',
      });
    });
  });

  describe('バリデーションエラー', () => {
    it('should return 500 when accessing empty stamp ID', async () => {
      const response = await request(app)
        .get('/stamps//status'); // 空のID

      expect(response.status).toBe(500); // Express.jsでは新しいルートが先にマッチするため500になる
    });
  });
}); 