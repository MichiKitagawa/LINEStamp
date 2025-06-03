import request from 'supertest';
import express from 'express';
import tokensRoutes from '../tokens';
import { auth, firestore } from '../../utils/firebaseAdmin';

// Firebase Admin SDK をモック
jest.mock('../../utils/firebaseAdmin', () => ({
  auth: {
    verifyIdToken: jest.fn(),
  },
  firestore: {
    collection: jest.fn(),
  },
}));

// Stripeをモック（環境変数エラーを回避）
jest.mock('../../utils/stripeClient', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  },
}));

const mockAuth = auth as jest.Mocked<typeof auth>;
const mockFirestore = firestore as jest.Mocked<typeof firestore>;

const app = express();
app.use(express.json());
app.use('/tokens', tokensRoutes);

describe('GET /tokens/balance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1.2.2-01 Authorization ヘッダーなし → HTTP 401 を返す', async () => {
    const response = await request(app)
      .get('/tokens/balance');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Unauthorized',
      message: 'Authorization header is required',
    });
  });

  it('1.2.2-02 ログイン済みユーザー → tokenBalance が正しく返される', async () => {
    const mockUid = 'test-uid-123';
    const mockUserData = {
      uid: mockUid,
      tokenBalance: 50,
      displayName: 'Test User',
      email: 'test@example.com',
    };

    // Firebase Auth モック
    mockAuth.verifyIdToken.mockResolvedValue({ uid: mockUid } as any);

    // Firestore モック
    const mockDoc = {
      exists: true,
      data: () => mockUserData,
    };
    const mockDocRef = {
      get: jest.fn().mockResolvedValue(mockDoc),
    };
    const mockCollection = {
      doc: jest.fn().mockReturnValue(mockDocRef),
    };
    mockFirestore.collection.mockReturnValue(mockCollection as any);

    const response = await request(app)
      .get('/tokens/balance')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      balance: 50,
    });
    expect(mockFirestore.collection).toHaveBeenCalledWith('users');
    expect(mockCollection.doc).toHaveBeenCalledWith(mockUid);
  });

  it('ユーザーが見つからない場合 → HTTP 404 を返す', async () => {
    const mockUid = 'nonexistent-uid';

    // Firebase Auth モック
    mockAuth.verifyIdToken.mockResolvedValue({ uid: mockUid } as any);

    // Firestore モック（ドキュメントが存在しない）
    const mockDoc = {
      exists: false,
    };
    const mockDocRef = {
      get: jest.fn().mockResolvedValue(mockDoc),
    };
    const mockCollection = {
      doc: jest.fn().mockReturnValue(mockDocRef),
    };
    mockFirestore.collection.mockReturnValue(mockCollection as any);

    const response = await request(app)
      .get('/tokens/balance')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'Not Found',
      message: 'User not found',
    });
  });

  it('tokenBalance が未設定の場合 → 0 を返す', async () => {
    const mockUid = 'test-uid-123';
    const mockUserData = {
      uid: mockUid,
      displayName: 'Test User',
      email: 'test@example.com',
      // tokenBalance なし
    };

    // Firebase Auth モック
    mockAuth.verifyIdToken.mockResolvedValue({ uid: mockUid } as any);

    // Firestore モック
    const mockDoc = {
      exists: true,
      data: () => mockUserData,
    };
    const mockDocRef = {
      get: jest.fn().mockResolvedValue(mockDoc),
    };
    const mockCollection = {
      doc: jest.fn().mockReturnValue(mockDocRef),
    };
    mockFirestore.collection.mockReturnValue(mockCollection as any);

    const response = await request(app)
      .get('/tokens/balance')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      balance: 0,
    });
  });
}); 