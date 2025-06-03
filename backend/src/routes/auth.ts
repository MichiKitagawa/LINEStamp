import { Router, Request, Response } from 'express';
import { verifyIdToken } from '@/middleware/verifyIdToken';
import { firestore, auth } from '@/utils/firebaseAdmin';

const router = Router();

interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  tokenBalance: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /auth/session
 * 現在のユーザーセッション情報を取得
 */
router.get('/session', verifyIdToken, async (req: Request, res: Response) => {
  try {
    // Firebase機能が無効な場合のチェック
    if (!auth || !firestore) {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Firebase authentication service is not configured',
      });
      return;
    }

    const uid = req.uid!;
    
    // Firebase Auth からユーザー情報を取得
    const userRecord = await auth.getUser(uid);
    
    // Firestore から追加のユーザー情報を取得
    const userDocRef = firestore.collection('users').doc(uid);
    const userDoc = await userDocRef.get();
    
    let userProfile: UserProfile;
    
    if (!userDoc.exists) {
      // 初回ログイン時：ユーザー情報を初期化
      const now = new Date().toISOString();
      userProfile = {
        uid: userRecord.uid,
        displayName: userRecord.displayName || null,
        email: userRecord.email || null,
        photoURL: userRecord.photoURL || null,
        tokenBalance: 0,
        createdAt: now,
        updatedAt: now,
      };
      
      // Firestore にユーザー情報を保存
      await userDocRef.set(userProfile);
    } else {
      // 既存ユーザー：情報を更新
      const existingData = userDoc.data() as UserProfile;
      userProfile = {
        ...existingData,
        displayName: userRecord.displayName || existingData.displayName,
        email: userRecord.email || existingData.email,
        photoURL: userRecord.photoURL || existingData.photoURL,
        updatedAt: new Date().toISOString(),
      };
      
      // 更新された情報を保存
      await userDocRef.update({
        displayName: userProfile.displayName,
        email: userProfile.email,
        photoURL: userProfile.photoURL,
        updatedAt: userProfile.updatedAt,
      });
    }
    
    res.status(200).json({
      user: userProfile,
      isAuthenticated: true,
    });
  } catch (error) {
    console.error('Session retrieval error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve session information',
    });
  }
});

export default router; 