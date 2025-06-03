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

describe('GET /stamps/:id/preview', () => {
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

  describe('1.5.1-01: 正常系 - 処理済み画像が8件存在する場合', () => {
    it('should return preview images successfully', async () => {
      // Firestore モック - スタンプ存在確認
      const mockStampDoc = {
        exists: true,
        data: () => ({
          id: mockStampId,
          userId: mockUid,
          status: 'generated',
          retryCount: 0,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T12:00:00.000Z',
        }),
      };

      // 処理済み画像データ
      const mockProcessedImages = Array.from({ length: 8 }, (_, i) => ({
        data: () => ({
          id: `image-${i + 1}`,
          stampId: mockStampId,
          type: 'processed',
          url: `https://example.com/processed_${i + 1}.png`,
          sequence: i + 1,
          filename: `processed_${i + 1}.png`,
          createdAt: '2023-01-01T12:30:00.000Z',
        }),
      }));

      const mockProcessedQuery = {
        docs: mockProcessedImages,
      };

      // メイン画像データ（存在する場合）
      const mockMainImage = {
        data: () => ({
          id: 'main-image-1',
          stampId: mockStampId,
          type: 'main',
          url: 'https://example.com/main.png',
          sequence: 0,
          filename: 'main.png',
          createdAt: '2023-01-01T12:25:00.000Z',
        }),
      };

      const mockMainQuery = {
        empty: false,
        docs: [mockMainImage],
      };

      const mockGet = jest.fn().mockResolvedValue(mockStampDoc);
      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockQueryGet = jest.fn()
        .mockResolvedValueOnce(mockProcessedQuery) // 処理済み画像クエリ
        .mockResolvedValueOnce(mockMainQuery); // メイン画像クエリ

      (mockFirestore.collection as jest.Mock)
        .mockReturnValueOnce({
          doc: jest.fn().mockReturnValue({
            get: mockGet,
          }),
        })
        .mockReturnValue({
          where: mockWhere,
          orderBy: mockOrderBy,
          limit: mockLimit,
          get: mockQueryGet,
        });

      const response = await request(app)
        .get(`/stamps/${mockStampId}/preview`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        stampId: mockStampId,
        processedImages: Array.from({ length: 8 }, (_, i) => ({
          id: `image-${i + 1}`,
          url: `https://example.com/processed_${i + 1}.png`,
          sequence: i + 1,
          filename: `processed_${i + 1}.png`,
        })),
        mainImage: {
          id: 'main-image-1',
          url: 'https://example.com/main.png',
          sequence: 0,
          filename: 'main.png',
        },
      });

      // Firestoreクエリが正しく呼ばれていることを確認
      expect(mockWhere).toHaveBeenCalledWith('stampId', '==', mockStampId);
      expect(mockWhere).toHaveBeenCalledWith('type', '==', 'processed');
      expect(mockWhere).toHaveBeenCalledWith('type', '==', 'main');
      expect(mockOrderBy).toHaveBeenCalledWith('sequence');
      expect(mockLimit).toHaveBeenCalledWith(1);
    });
  });

  describe('1.5.1-02: 異常系 - 処理済み画像が不足（0件）', () => {
    it('should return empty processed images array when no images exist', async () => {
      // Firestore モック - スタンプ存在確認
      const mockStampDoc = {
        exists: true,
        data: () => ({
          id: mockStampId,
          userId: mockUid,
          status: 'generated',
          retryCount: 0,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T12:00:00.000Z',
        }),
      };

      // 処理済み画像データ（空）
      const mockProcessedQuery = {
        docs: [],
      };

      // メイン画像データ（存在しない）
      const mockMainQuery = {
        empty: true,
        docs: [],
      };

      const mockGet = jest.fn().mockResolvedValue(mockStampDoc);
      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockQueryGet = jest.fn()
        .mockResolvedValueOnce(mockProcessedQuery) // 処理済み画像クエリ
        .mockResolvedValueOnce(mockMainQuery); // メイン画像クエリ

      (mockFirestore.collection as jest.Mock)
        .mockReturnValueOnce({
          doc: jest.fn().mockReturnValue({
            get: mockGet,
          }),
        })
        .mockReturnValue({
          where: mockWhere,
          orderBy: mockOrderBy,
          limit: mockLimit,
          get: mockQueryGet,
        });

      const response = await request(app)
        .get(`/stamps/${mockStampId}/preview`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        stampId: mockStampId,
        processedImages: [],
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
          status: 'generated',
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
        .get(`/stamps/${mockStampId}/preview`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'Forbidden',
        message: 'You do not have permission to access this stamp',
      });
    });

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
        .get(`/stamps/${mockStampId}/preview`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Not Found',
        message: 'Stamp not found',
      });
    });
  });
}); 