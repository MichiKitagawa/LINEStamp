import { Request, Response, NextFunction } from 'express';
import { auth } from '@/utils/firebaseAdmin';

// Request インターフェースを拡張して uid プロパティを追加
declare global {
  namespace Express {
    interface Request {
      uid?: string;
    }
  }
}

export const verifyIdToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authorization header is required',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Bearer token is required',
      });
      return;
    }

    // Firebase ID トークンを検証
    const decodedToken = await auth.verifyIdToken(token);
    
    // リクエストオブジェクトに uid をセット
    req.uid = decodedToken.uid;
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}; 