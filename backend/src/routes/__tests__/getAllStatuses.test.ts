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

jest.mock('../../services/imageGeneratorMock', () => ({
  imageGeneratorService: {
    generateStampImages: jest.fn(),
  },
}));

jest.mock('../../services/puppeteerMock', () => ({
  puppeteerSubmissionService: {
    submitStamp: jest.fn(),
  },
}));

import { verifyIdToken } from '../../middleware/verifyIdToken';
import { firestore } from '../../utils/firebaseAdmin';

const mockVerifyIdToken = verifyIdToken as jest.MockedFunction<typeof verifyIdToken>;
const mockFirestore = firestore as jest.Mocked<typeof firestore>;

// Expressアプリのセットアップ
const app = express();
app.use(express.json());
app.use('/stamps', stampsRouter);

describe('GET /stamps/status', () => {
  const mockUid = 'test-uid';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // verifyIdTokenミドルウェアのモック
    mockVerifyIdToken.mockImplementation(async (req: any, _res: any, next: any) => {
      req.uid = mockUid;
      next();
    });
  });

  describe('正常系 - ユーザーのすべてのスタンプステータスを取得', () => {
    it('should return all stamp statuses for the user', async () => {
      // Firestore モック - ユーザーのスタンプ一覧
      const mockStamps = [
        {
          id: 'stamp-1',
          data: () => ({
            userId: mockUid,
            status: 'generated',
            retryCount: 0,
            presetId: 'preset-1',
            createdAt: '2023-01-01T10:00:00.000Z',
            updatedAt: '2023-01-01T12:00:00.000Z',
          }),
        },
        {
          id: 'stamp-2',
          data: () => ({
            userId: mockUid,
            status: 'failed',
            retryCount: 2,
            presetId: 'preset-2',
            createdAt: '2023-01-01T08:00:00.000Z',
            updatedAt: '2023-01-01T11:00:00.000Z',
          }),
        },
        {
          id: 'stamp-3',
          data: () => ({
            userId: mockUid,
            status: 'submitted',
            retryCount: 1,
            createdAt: '2023-01-01T06:00:00.000Z',
            updatedAt: '2023-01-01T09:00:00.000Z',
          }),
        },
      ];

      const mockStampsQuery = {
        docs: mockStamps,
      };

      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockGet = jest.fn().mockResolvedValue(mockStampsQuery);

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        where: mockWhere,
        orderBy: mockOrderBy,
        get: mockGet,
      });

      const response = await request(app)
        .get('/stamps/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        userId: mockUid,
        stamps: [
          {
            stampId: 'stamp-1',
            status: 'generated',
            retryCount: 0,
            presetId: 'preset-1',
            createdAt: '2023-01-01T10:00:00.000Z',
            updatedAt: '2023-01-01T12:00:00.000Z',
          },
          {
            stampId: 'stamp-2',
            status: 'failed',
            retryCount: 2,
            presetId: 'preset-2',
            createdAt: '2023-01-01T08:00:00.000Z',
            updatedAt: '2023-01-01T11:00:00.000Z',
          },
          {
            stampId: 'stamp-3',
            status: 'submitted',
            retryCount: 1,
            presetId: undefined,
            createdAt: '2023-01-01T06:00:00.000Z',
            updatedAt: '2023-01-01T09:00:00.000Z',
          },
        ],
      });

      // Firestoreクエリが正しく呼ばれていることを確認
      expect(mockWhere).toHaveBeenCalledWith('userId', '==', mockUid);
      expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });

    it('should return empty array when user has no stamps', async () => {
      // Firestore モック - スタンプなし
      const mockStampsQuery = {
        docs: [],
      };

      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockGet = jest.fn().mockResolvedValue(mockStampsQuery);

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        where: mockWhere,
        orderBy: mockOrderBy,
        get: mockGet,
      });

      const response = await request(app)
        .get('/stamps/status');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        userId: mockUid,
        stamps: [],
      });
    });
  });

  describe('権限チェック', () => {
    it('should return 403 when trying to access other user\'s statuses', async () => {
      const response = await request(app)
        .get('/stamps/status?userId=other-user-id');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'Forbidden',
        message: 'You can only access your own stamp statuses',
      });
    });

    it('should allow access when userId matches authenticated user', async () => {
      // Firestore モック - 空のスタンプ一覧
      const mockStampsQuery = {
        docs: [],
      };

      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockGet = jest.fn().mockResolvedValue(mockStampsQuery);

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        where: mockWhere,
        orderBy: mockOrderBy,
        get: mockGet,
      });

      const response = await request(app)
        .get(`/stamps/status?userId=${mockUid}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        userId: mockUid,
        stamps: [],
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('should return 500 when Firestore query fails', async () => {
      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockGet = jest.fn().mockRejectedValue(new Error('Firestore error'));

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        where: mockWhere,
        orderBy: mockOrderBy,
        get: mockGet,
      });

      const response = await request(app)
        .get('/stamps/status');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Internal Server Error',
        message: 'Failed to fetch stamp statuses',
      });
    });
  });
}); 