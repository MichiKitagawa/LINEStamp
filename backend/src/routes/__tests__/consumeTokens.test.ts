import request from 'supertest';
import express from 'express';
import tokensRouter from '../tokens';

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

jest.mock('../../utils/stripeClient', () => ({
  stripe: {},
}));

import { verifyIdToken } from '../../middleware/verifyIdToken';
import { firestore } from '../../utils/firebaseAdmin';

const mockVerifyIdToken = verifyIdToken as jest.MockedFunction<typeof verifyIdToken>;
const mockFirestore = firestore as jest.Mocked<typeof firestore>;

// Expressアプリのセットアップ
const app = express();
app.use(express.json());
app.use('/tokens', tokensRouter);

describe('POST /tokens/consume', () => {
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

  describe('1.4.1-01: 正常系 - トークン消費成功', () => {
    it('should consume tokens successfully when user has sufficient balance', async () => {
      const amount = 40;
      const currentBalance = 100;
      const expectedRemainingBalance = currentBalance - amount;

      // Firestore モック
      const mockUserDoc = {
        exists: true,
        data: () => ({ tokenBalance: currentBalance }),
      };

      const mockGet = jest.fn().mockResolvedValue(mockUserDoc);
      const mockUpdate = jest.fn();
      const mockSet = jest.fn();

      const mockTransaction = {
        get: mockGet,
        update: mockUpdate,
        set: mockSet,
      };

      mockFirestore.runTransaction.mockImplementation(async (callback: any) => {
        return callback(mockTransaction);
      });

      (mockFirestore.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockGet,
          update: mockUpdate,
        }),
      });

      const response = await request(app)
        .post('/tokens/consume')
        .send({
          stampId: mockStampId,
          amount,
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        remainingBalance: expectedRemainingBalance,
      });

      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tokenBalance: expectedRemainingBalance,
          updatedAt: expect.any(String),
        })
      );

      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: mockUid,
          type: 'consume',
          amount: -amount,
          stampId: mockStampId,
          createdAt: expect.any(String),
        })
      );
    });
  });

  describe('1.4.1-02: 異常系 - トークン残高不足', () => {
    it('should return 400 when user has insufficient tokens', async () => {
      const amount = 40;
      const currentBalance = 20; // 不足

      // Firestore モック
      const mockUserDoc = {
        exists: true,
        data: () => ({ tokenBalance: currentBalance }),
      };

      const mockGet = jest.fn().mockResolvedValue(mockUserDoc);
      const mockUpdate = jest.fn();
      const mockSet = jest.fn();

      const mockTransaction = {
        get: mockGet,
        update: mockUpdate,
        set: mockSet,
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
        .post('/tokens/consume')
        .send({
          stampId: mockStampId,
          amount,
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Bad Request',
        message: 'Insufficient token balance',
      });

      // トークンは消費されていないことを確認
      expect(mockTransaction.update).not.toHaveBeenCalled();
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });
  });

  describe('バリデーションエラー', () => {
    it('should return 400 when stampId is missing', async () => {
      const response = await request(app)
        .post('/tokens/consume')
        .send({
          amount: 40,
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Bad Request',
        message: 'stampId and positive amount are required',
      });
    });

    it('should return 400 when amount is missing', async () => {
      const response = await request(app)
        .post('/tokens/consume')
        .send({
          stampId: mockStampId,
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Bad Request',
        message: 'stampId and positive amount are required',
      });
    });

    it('should return 400 when amount is zero or negative', async () => {
      const response = await request(app)
        .post('/tokens/consume')
        .send({
          stampId: mockStampId,
          amount: 0,
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Bad Request',
        message: 'stampId and positive amount are required',
      });
    });
  });

  describe('ユーザーが存在しない場合', () => {
    it('should return 404 when user does not exist', async () => {
      const amount = 40;

      // Firestore モック - ユーザーが存在しない
      const mockUserDoc = {
        exists: false,
      };

      const mockGet = jest.fn().mockResolvedValue(mockUserDoc);
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
        .post('/tokens/consume')
        .send({
          stampId: mockStampId,
          amount,
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Not Found',
        message: 'User not found',
      });
    });
  });
}); 