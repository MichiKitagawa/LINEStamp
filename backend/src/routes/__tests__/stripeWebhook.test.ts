import request from 'supertest';
import express from 'express';

// Firebase Admin SDK をモック
jest.mock('../../utils/firebaseAdmin', () => ({
  firestore: {
    collection: jest.fn(),
    runTransaction: jest.fn(),
  },
}));

// Stripeをモック
const mockStripe = {
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

jest.mock('../../utils/stripeClient', () => ({
  stripe: mockStripe,
}));

import tokensRoutes from '../tokens';
import { firestore } from '../../utils/firebaseAdmin';

const mockFirestore = firestore as jest.Mocked<typeof firestore>;
const mockConstructEvent = mockStripe.webhooks.constructEvent as jest.MockedFunction<any>;

const app = express();
// Webhook用にraw bodyを処理
app.use('/tokens/webhook/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use('/tokens', tokensRoutes);

describe('POST /tokens/webhook/stripe', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('1.2.3-01 checkout.session.completed イベントをモックで送信 → users/{uid}.tokenBalance がインクリメントされる', async () => {
    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_session_123',
          metadata: {
            userId: 'test-uid-123',
            tokenPackage: '40tokens',
          },
        },
      },
    };

    const mockUserData = {
      uid: 'test-uid-123',
      tokenBalance: 10,
      displayName: 'Test User',
    };

    // Stripe Webhook モック
    mockConstructEvent.mockReturnValue(mockEvent as any);

    // Firestore トランザクションモック
    mockFirestore.runTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => mockUserData,
        }),
        update: jest.fn(),
        set: jest.fn(),
        getAll: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      };

      const mockUserRef = {};
      const mockTransactionRef = {};

      const mockCollection = {
        doc: jest.fn().mockImplementation((docId) => {
          if (docId === 'test-uid-123') return mockUserRef;
          return mockTransactionRef;
        }),
      };

      mockFirestore.collection.mockReturnValue(mockCollection as any);

      await callback(mockTransaction as any);

      expect(mockTransaction.update).toHaveBeenCalledWith(mockUserRef, {
        tokenBalance: 50, // 10 + 40
        updatedAt: expect.any(String),
      });

      expect(mockTransaction.set).toHaveBeenCalledWith(mockTransactionRef, {
        userId: 'test-uid-123',
        type: 'purchase',
        amount: 40,
        packageId: '40tokens',
        stripeSessionId: 'cs_test_session_123',
        createdAt: expect.any(String),
      });

      return Promise.resolve();
    });

    const response = await request(app)
      .post('/tokens/webhook/stripe')
      .set('stripe-signature', 'valid_signature')
      .send(Buffer.from(JSON.stringify(mockEvent)));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
    expect(mockConstructEvent).toHaveBeenCalled();
    expect(mockFirestore.runTransaction).toHaveBeenCalled();
  });

  it('1.2.3-02 レスポンスは HTTP 200', async () => {
    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_session_123',
          metadata: {
            userId: 'test-uid-123',
            tokenPackage: '40tokens',
          },
        },
      },
    };

    mockConstructEvent.mockReturnValue(mockEvent as any);
    mockFirestore.runTransaction.mockResolvedValue(undefined);

    const response = await request(app)
      .post('/tokens/webhook/stripe')
      .set('stripe-signature', 'valid_signature')
      .send(Buffer.from(JSON.stringify(mockEvent)));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
  });

  it('1.2.3-03 署名検証失敗シナリオ → HTTP 400 を返す', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const response = await request(app)
      .post('/tokens/webhook/stripe')
      .set('stripe-signature', 'invalid_signature')
      .send(Buffer.from(JSON.stringify({ test: 'data' })));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Bad Request',
      message: 'Invalid webhook signature',
    });
    expect(mockFirestore.runTransaction).not.toHaveBeenCalled();
  });

  it('STRIPE_WEBHOOK_SECRET が未設定 → HTTP 500 を返す', async () => {
    // 環境変数を一時的に削除
    const originalSecret = process.env['STRIPE_WEBHOOK_SECRET'];
    process.env['STRIPE_WEBHOOK_SECRET'] = '';

    const response = await request(app)
      .post('/tokens/webhook/stripe')
      .set('stripe-signature', 'valid_signature')
      .send(Buffer.from(JSON.stringify({ test: 'data' })));

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Internal Server Error',
      message: 'Webhook secret not configured',
    });

    // 環境変数を復元
    if (originalSecret) {
      process.env['STRIPE_WEBHOOK_SECRET'] = originalSecret;
    }
  });

  it('無効なtokenPackage → HTTP 400 を返す', async () => {
    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_session_123',
          metadata: {
            userId: 'test-uid-123',
            tokenPackage: 'invalid-package',
          },
        },
      },
    };

    mockConstructEvent.mockReturnValue(mockEvent as any);

    const response = await request(app)
      .post('/tokens/webhook/stripe')
      .set('stripe-signature', 'valid_signature')
      .send(Buffer.from(JSON.stringify(mockEvent)));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Bad Request',
      message: 'Invalid token package',
    });
    expect(mockFirestore.runTransaction).not.toHaveBeenCalled();
  });

  it('メタデータ不足 → HTTP 400 を返す', async () => {
    const mockEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_session_123',
          metadata: {
            // userId または tokenPackage が不足
            userId: 'test-uid-123',
          },
        },
      },
    };

    mockConstructEvent.mockReturnValue(mockEvent as any);

    const response = await request(app)
      .post('/tokens/webhook/stripe')
      .set('stripe-signature', 'valid_signature')
      .send(Buffer.from(JSON.stringify(mockEvent)));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Bad Request',
      message: 'Invalid metadata',
    });
    expect(mockFirestore.runTransaction).not.toHaveBeenCalled();
  });
}); 