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

import { verifyIdToken } from '../../middleware/verifyIdToken';
import { firestore } from '../../utils/firebaseAdmin';
import { imageGeneratorService } from '../../services/imageGeneratorMock';

const mockVerifyIdToken = verifyIdToken as jest.MockedFunction<typeof verifyIdToken>;
const mockFirestore = firestore as jest.Mocked<typeof firestore>;
const mockImageGeneratorService = imageGeneratorService as jest.Mocked<typeof imageGeneratorService>;

// Expressアプリのセットアップ
const app = express();
app.use(express.json());
app.use('/stamps', stampsRouter);

describe('POST /stamps/generate', () => {
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

  describe('1.4.2-01: 正常系 - スタンプ生成開始', () => {
    it('should start stamp generation successfully', async () => {
      // Firestore モック
      const mockStampDoc = {
        exists: true,
        data: () => ({
          id: mockStampId,
          userId: mockUid,
          status: 'pending_upload',
          retryCount: 0,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        }),
      };

      const mockImagesQuery = {
        docs: [
          {
            data: () => ({
              id: 'image-1',
              stampId: mockStampId,
              type: 'original',
              url: 'https://example.com/image1.png',
              sequence: 1,
              filename: 'image1.png',
              createdAt: '2023-01-01T00:00:00.000Z',
            }),
          },
        ],
      };

      const mockGet = jest.fn().mockResolvedValue(mockStampDoc);
      const mockUpdate = jest.fn();
      const mockWhere = jest.fn().mockReturnThis();
      const mockOrderBy = jest.fn().mockReturnThis();
      const mockQueryGet = jest.fn().mockResolvedValue(mockImagesQuery);

      const mockTransaction = {
        get: mockGet,
        update: mockUpdate,
      };

      mockFirestore.runTransaction.mockImplementation(async (callback: any) => {
        return callback(mockTransaction);
      });

      (mockFirestore.collection as jest.Mock)
        .mockReturnValueOnce({
          doc: jest.fn().mockReturnValue({
            get: mockGet,
            update: mockUpdate,
          }),
        })
        .mockReturnValueOnce({
          where: mockWhere,
          orderBy: mockOrderBy,
          get: mockQueryGet,
        })
        .mockReturnValue({
          doc: jest.fn().mockReturnValue({
            update: jest.fn(),
          }),
        });

      mockImageGeneratorService.generateStampImages.mockResolvedValue();

      const response = await request(app)
        .post('/stamps/generate')
        .send({
          stampId: mockStampId,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        stampId: mockStampId,
        status: 'generating',
      });

      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'generating',
          updatedAt: expect.any(String),
        })
      );

      // 非同期処理のため、少し待機
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });

  describe('1.4.2-02: 異常系 - 無効なステータス', () => {
    it('should return 400 when stamp status is not pending_upload or pending_generate', async () => {
      // Firestore モック
      const mockStampDoc = {
        exists: true,
        data: () => ({
          id: mockStampId,
          userId: mockUid,
          status: 'generated', // 無効なステータス
          retryCount: 0,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        }),
      };

      const mockGet = jest.fn().mockResolvedValue(mockStampDoc);
      const mockUpdate = jest.fn();

      const mockTransaction = {
        get: mockGet,
        update: mockUpdate,
      };

      mockFirestore.runTransaction.mockImplementation(async (callback: any) => {
        return callback(mockTransaction);
      });

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet,
        }),
      });

      const response = await request(app)
        .post('/stamps/generate')
        .send({
          stampId: mockStampId,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('Invalid status');

      // ステータスは更新されていないことを確認
      expect(mockTransaction.update).not.toHaveBeenCalled();
    });
  });

  describe('1.4.2-03: 異常系 - スタンプが存在しない', () => {
    it('should return 404 when stamp does not exist', async () => {
      // Firestore モック - スタンプが存在しない
      const mockStampDoc = {
        exists: false,
      };

      const mockGet = jest.fn().mockResolvedValue(mockStampDoc);
      const mockTransaction = {
        get: mockGet,
      };

      mockFirestore.runTransaction.mockImplementation(async (callback: any) => {
        return callback(mockTransaction);
      });

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet,
        }),
      });

      const response = await request(app)
        .post('/stamps/generate')
        .send({
          stampId: mockStampId,
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Not Found',
        message: 'Stamp not found',
      });
    });
  });

  describe('バリデーションエラー', () => {
    it('should return 400 when stampId is missing', async () => {
      const response = await request(app)
        .post('/stamps/generate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Bad Request',
        message: 'stampId is required',
      });
    });
  });

  describe('権限エラー', () => {
    it('should return 403 when user does not own the stamp', async () => {
      // Firestore モック - 他のユーザーのスタンプ
      const mockStampDoc = {
        exists: true,
        data: () => ({
          id: mockStampId,
          userId: 'other-user-id', // 異なるユーザーID
          status: 'pending_upload',
          retryCount: 0,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        }),
      };

      const mockGet = jest.fn().mockResolvedValue(mockStampDoc);
      const mockTransaction = {
        get: mockGet,
      };

      mockFirestore.runTransaction.mockImplementation(async (callback: any) => {
        return callback(mockTransaction);
      });

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet,
        }),
      });

      const response = await request(app)
        .post('/stamps/generate')
        .send({
          stampId: mockStampId,
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'Forbidden',
        message: 'You do not have permission to generate this stamp',
      });
    });
  });
}); 