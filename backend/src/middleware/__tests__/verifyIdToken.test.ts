import { Request, Response, NextFunction } from 'express';
import { verifyIdToken } from '../verifyIdToken';
import { auth } from '../../utils/firebaseAdmin';

// Firebase Admin SDK をモック
jest.mock('../../utils/firebaseAdmin', () => ({
  auth: {
    verifyIdToken: jest.fn(),
  },
}));

const mockAuth = auth as jest.Mocked<typeof auth>;

describe('verifyIdToken ミドルウェア', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('1.1.1-01 トークン未提供 → HTTP 401 を返す', async () => {
    await verifyIdToken(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Authorization header is required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('1.1.1-02 無効トークン → HTTP 401 を返す', async () => {
    req.headers = { authorization: 'Bearer invalid-token' };
    mockAuth.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

    await verifyIdToken(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('1.1.1-03 有効トークン → req.uid がセットされ、next() が呼ばれる', async () => {
    const mockUid = 'test-uid-123';
    req.headers = { authorization: 'Bearer valid-token' };
    mockAuth.verifyIdToken.mockResolvedValue({ uid: mockUid } as any);

    await verifyIdToken(req as Request, res as Response, next);

    expect(req.uid).toBe(mockUid);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('Bearer トークンが空の場合 → HTTP 401 を返す', async () => {
    req.headers = { authorization: 'Bearer ' };

    await verifyIdToken(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Bearer token is required',
    });
    expect(next).not.toHaveBeenCalled();
  });
}); 