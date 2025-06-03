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
import { puppeteerSubmissionService } from '../../services/puppeteerMock';

const mockVerifyIdToken = verifyIdToken as jest.MockedFunction<typeof verifyIdToken>;
const mockFirestore = firestore as jest.Mocked<typeof firestore>;
const mockPuppeteerSubmissionService = puppeteerSubmissionService as jest.Mocked<typeof puppeteerSubmissionService>;

// Expressアプリのセットアップ
const app = express();
app.use(express.json());
app.use('/stamps', stampsRouter);

describe('POST /stamps/retry', () => {
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

  describe('1.5.3-01: 正常系 - 再申請開始', () => {
    it('should start stamp retry successfully', async () => {
      // Firestore モック
      const mockStampDoc = {
        exists: true,
        data: () => ({
          id: mockStampId,
          userId: mockUid,
          status: 'failed',
          retryCount: 1,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T12:00:00.000Z',
        }),
      };

      const mockGet = jest.fn().mockResolvedValue(mockStampDoc);
      const mockUpdate = jest.fn();
      const mockCollectionUpdate = jest.fn();

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
        .mockReturnValue({
          doc: jest.fn().mockReturnValue({
            update: mockCollectionUpdate,
          }),
        });

      mockPuppeteerSubmissionService.submitStamp.mockResolvedValue();

      const response = await request(app)
        .post('/stamps/retry')
        .send({
          stampId: mockStampId,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        stampId: mockStampId,
        status: 'submitting',
        retryCount: 2, // インクリメントされている
      });

      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'submitting',
          retryCount: 2,
          updatedAt: expect.any(String),
        })
      );

      // 非同期処理のため、少し待機
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });

  describe('1.5.3-02: 異常系 - 無効なステータス', () => {
    it('should return 400 when stamp status is not failed', async () => {
      // Firestore モック
      const mockStampDoc = {
        exists: true,
        data: () => ({
          id: mockStampId,
          userId: mockUid,
          status: 'submitted', // 無効なステータス（failedではない）
          retryCount: 0,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T12:00:00.000Z',
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
        .post('/stamps/retry')
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

  describe('バリデーションエラー', () => {
    it('should return 400 when stampId is missing', async () => {
      const response = await request(app)
        .post('/stamps/retry')
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
          status: 'failed',
          retryCount: 1,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T12:00:00.000Z',
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
        .post('/stamps/retry')
        .send({
          stampId: mockStampId,
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'Forbidden',
        message: 'You do not have permission to retry this stamp',
      });
    });

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
        .post('/stamps/retry')
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
}); 