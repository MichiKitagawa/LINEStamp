import request from 'supertest';
import express from 'express';
import authRoutes from '../auth';
import { auth, firestore } from '../../utils/firebaseAdmin';

// Firebase Admin SDK をモック
jest.mock('../../utils/firebaseAdmin', () => ({
  auth: {
    verifyIdToken: jest.fn(),
    getUser: jest.fn(),
  },
  firestore: {
    collection: jest.fn(),
  },
}));

const mockAuth = auth as jest.Mocked<typeof auth>;
const mockFirestore = firestore as jest.Mocked<typeof firestore>;

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('GET /auth/session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1.1.2-01 Authorization ヘッダーなし → HTTP 401 を返す', async () => {
    const response = await request(app)
      .get('/auth/session');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Unauthorized',
      message: 'Authorization header is required',
    });
  });

  it('1.1.2-02 ログイン済みユーザーかつ users/{uid} が存在する → HTTP 200 + 正しいユーザー情報を返す', async () => {
    const mockUid = 'test-uid-123';
    const mockUserRecord = {
      uid: mockUid,
      displayName: 'Test User',
      email: 'test@example.com',
      photoURL: 'https://example.com/photo.jpg',
    };
    const mockUserData = {
      uid: mockUid,
      displayName: 'Test User',
      email: 'test@example.com',
      photoURL: 'https://example.com/photo.jpg',
      tokenBalance: 10,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
    };

    // Firebase Auth モック
    mockAuth.verifyIdToken.mockResolvedValue({ uid: mockUid } as any);
    mockAuth.getUser.mockResolvedValue(mockUserRecord as any);

    // Firestore モック
    const mockDoc = {
      exists: true,
      data: () => mockUserData,
    };
    const mockDocRef = {
      get: jest.fn().mockResolvedValue(mockDoc),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const mockCollection = {
      doc: jest.fn().mockReturnValue(mockDocRef),
    };
    mockFirestore.collection.mockReturnValue(mockCollection as any);

    const response = await request(app)
      .get('/auth/session')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body.isAuthenticated).toBe(true);
    expect(response.body.user.uid).toBe(mockUid);
    expect(response.body.user.tokenBalance).toBe(10);
  });

  it('1.1.2-03 users/{uid} が存在しない → ドキュメント作成後、HTTP 200 + 初期値を返す', async () => {
    const mockUid = 'new-user-123';
    const mockUserRecord = {
      uid: mockUid,
      displayName: 'New User',
      email: 'newuser@example.com',
      photoURL: null,
    };

    // Firebase Auth モック
    mockAuth.verifyIdToken.mockResolvedValue({ uid: mockUid } as any);
    mockAuth.getUser.mockResolvedValue(mockUserRecord as any);

    // Firestore モック（ドキュメントが存在しない）
    const mockDoc = {
      exists: false,
    };
    const mockDocRef = {
      get: jest.fn().mockResolvedValue(mockDoc),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const mockCollection = {
      doc: jest.fn().mockReturnValue(mockDocRef),
    };
    mockFirestore.collection.mockReturnValue(mockCollection as any);

    const response = await request(app)
      .get('/auth/session')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body.isAuthenticated).toBe(true);
    expect(response.body.user.uid).toBe(mockUid);
    expect(response.body.user.displayName).toBe('New User');
    expect(response.body.user.email).toBe('newuser@example.com');
    expect(response.body.user.tokenBalance).toBe(0);
    expect(mockDocRef.set).toHaveBeenCalledWith({
      uid: mockUid,
      displayName: 'New User',
      email: 'newuser@example.com',
      photoURL: null,
      tokenBalance: 0,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('Firebase Auth エラー → HTTP 401 を返す', async () => {
    mockAuth.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

    const response = await request(app)
      .get('/auth/session')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  });
}); 