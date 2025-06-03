import { Request, Response, NextFunction } from 'express';
import { auth, admin } from '@/utils/firebaseAdmin';

// Request インターフェースを拡張して uid プロパティを追加
declare global {
  namespace Express {
    interface Request {
      uid?: string;
    }
  }
}

// JWT デコード用ヘルパー関数（検証前の解析用）
const decodeJWTUnsafe = (token: string) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // base64url をサポートしていない場合の代替処理
    const decodeBase64Url = (str: string) => {
      // base64url を base64 に変換
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      // パディングを追加
      while (str.length % 4) {
        str += '=';
      }
      return Buffer.from(str, 'base64').toString();
    };
    
    const headerPart = parts[0];
    const payloadPart = parts[1];
    
    if (!headerPart || !payloadPart) return null;
    
    const header = JSON.parse(decodeBase64Url(headerPart));
    const payload = JSON.parse(decodeBase64Url(payloadPart));
    
    return { header, payload };
  } catch (error) {
    return null;
  }
};

// Firebase Admin SDKから設定を取得
const getFirebaseConfig = () => {
  try {
    if (admin.apps.length === 0) {
      return { projectId: null, clientEmail: null };
    }
    
    const app = admin.app();
    const projectId = app.options.projectId;
    
    // サービスアカウント情報は直接取得できないため、プロジェクトIDから推測
    const clientEmail = `firebase-adminsdk-fbsvc@${projectId}.iam.gserviceaccount.com`;
    
    return { projectId, clientEmail };
  } catch (error) {
    console.error('Firebase設定取得エラー:', error);
    return { projectId: null, clientEmail: null };
  }
};

// 時刻関連の詳細検証
const validateTokenTiming = (payload: any) => {
  const now = Math.floor(Date.now() / 1000);
  const iat = payload.iat; // issued at
  const exp = payload.exp; // expires at
  const auth_time = payload.auth_time; // authentication time
  
  console.log('🕐 トークン時刻詳細検証:');
  console.log('  現在時刻 (Unix):', now);
  console.log('  発行時刻 (iat):', iat, '→', new Date(iat * 1000).toISOString());
  console.log('  有効期限 (exp):', exp, '→', new Date(exp * 1000).toISOString());
  console.log('  認証時刻 (auth_time):', auth_time, '→', new Date(auth_time * 1000).toISOString());
  
  const timeDiff = now - iat;
  const timeToExpiry = exp - now;
  
  console.log('  発行からの経過時間:', timeDiff, '秒');
  console.log('  有効期限まで:', timeToExpiry, '秒');
  
  // 時刻の妥当性チェック
  const warnings = [];
  if (timeDiff < -60) { // 発行時刻が未来すぎる
    warnings.push('⚠️ トークン発行時刻が未来すぎます（時刻同期問題の可能性）');
  }
  if (timeToExpiry < 0) { // 既に期限切れ
    warnings.push('❌ トークンが期限切れです');
  }
  if (timeDiff > 3600) { // 発行から1時間以上経過
    warnings.push('⚠️ トークンの発行から1時間以上経過しています');
  }
  
  warnings.forEach(warning => console.log('  ' + warning));
  
  return warnings.length === 0;
};

export const verifyIdToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Firebase Auth機能が無効な場合のチェック
    if (!auth) {
      console.error('🚫 Firebase Auth service is not available');
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Firebase authentication service is not configured',
      });
      return;
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.warn('⚠️ Authorization header missing');
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authorization header is required',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      console.warn('⚠️ Bearer token missing');
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Bearer token is required',
      });
      return;
    }

    // 開発環境でのデバッグ情報
    if (process.env['NODE_ENV'] === 'development') {
      console.log('🔐 Firebase ID トークン検証中...');
      console.log('  Token length:', token.length);
      console.log('  Token start:', token.substring(0, 20) + '...');
      
      // Firebase設定を取得
      const firebaseConfig = getFirebaseConfig();
      
      // JWTを事前解析（署名検証前）
      const decoded = decodeJWTUnsafe(token);
      if (decoded) {
        console.log('🔍 JWT 事前解析結果:');
        console.log('  Header:', {
          alg: decoded.header.alg,
          typ: decoded.header.typ,
          kid: decoded.header.kid
        });
        console.log('  Payload:', {
          iss: decoded.payload.iss,
          aud: decoded.payload.aud,
          sub: decoded.payload.sub,
          exp: decoded.payload.exp,
          iat: decoded.payload.iat,
          auth_time: decoded.payload.auth_time,
          firebase: decoded.payload.firebase
        });
        
        // プロジェクトID確認
        const expectedIssuer = `https://securetoken.google.com/${firebaseConfig.projectId}`;
        const expectedAudience = firebaseConfig.projectId;
        
        console.log('🎯 プロジェクトID検証:');
        console.log('  Expected issuer:', expectedIssuer);
        console.log('  Actual issuer:', decoded.payload.iss);
        console.log('  Expected audience:', expectedAudience);
        console.log('  Actual audience:', decoded.payload.aud);
        console.log('  Issuer match:', decoded.payload.iss === expectedIssuer);
        console.log('  Audience match:', decoded.payload.aud === expectedAudience);
        
        // 時刻の詳細検証
        validateTokenTiming(decoded.payload);
        
        // キーIDの確認
        console.log('🔑 署名キー情報:');
        console.log('  Token kid (key ID):', decoded.header.kid);
        console.log('  Algorithm:', decoded.header.alg);
      }
    }

    // Firebase ID トークンを検証
    const decodedToken = await auth.verifyIdToken(token);
    
    // 開発環境でのデバッグ情報
    if (process.env['NODE_ENV'] === 'development') {
      console.log('✅ トークン検証成功');
      console.log('  User ID:', decodedToken.uid);
      console.log('  Email:', decodedToken.email);
      console.log('  Issuer:', decodedToken.iss);
      console.log('  Audience:', decodedToken.aud);
    }
    
    // リクエストオブジェクトに uid をセット
    req.uid = decodedToken.uid;
    
    next();
  } catch (error) {
    console.error('❌ Token verification error:', error);
    
    // より詳細なエラー情報を開発環境で出力
    if (process.env['NODE_ENV'] === 'development' && error instanceof Error) {
      console.error('  Error name:', error.name);
      console.error('  Error message:', error.message);
      if ('errorInfo' in error) {
        console.error('  Error info:', (error as any).errorInfo);
      }
      
      // 署名検証エラーの場合の詳細情報
      if (error.message.includes('invalid signature')) {
        const firebaseConfig = getFirebaseConfig();
        
        console.error('🔍 署名検証エラー詳細診断:');
        console.error('  1. クライアントとサーバーで異なるFirebaseプロジェクトを使用している可能性');
        console.error('  2. サービスアカウントキーが正しくない、または古い可能性');
        console.error('  3. Firebase公開鍵ローテーションによる一時的な問題');
        console.error('  4. システム時刻が大幅にずれている可能性');
        
        console.error('📋 現在のプロジェクト設定:');
        console.error('    Project ID:', firebaseConfig.projectId);
        console.error('    Client Email:', firebaseConfig.clientEmail);
        
        console.error('💡 推奨解決手順:');
        console.error('    1. Firebase Consoleで新しいサービスアカウントキーを生成');
        console.error('    2. 新しいJSONファイルをプロジェクトルートに配置');
        console.error('    3. 古いJSONファイルを削除');
        console.error('    4. バックエンドサーバーを再起動');
        console.error('    5. システム時刻を同期: w32tm /resync');
      }
    }
    
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}; 