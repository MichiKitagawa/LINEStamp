import { auth } from './firebaseClient';

const API_BASE_URL = process.env['NEXT_PUBLIC_API_BASE_URL'] || 'http://localhost:3001';

// JWTデコード用ヘルパー関数
const decodeJWT = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
};

export class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async getAuthToken(): Promise<string | null> {
    const user = auth.currentUser;
    if (!user) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🚫 認証ユーザーなし (auth.currentUser is null)');
      }
      return null;
    }
    
    try {
      const token = await user.getIdToken();
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🎫 APIクライアント: IDトークン取得成功', {
          uid: user.uid,
          email: user.email,
          tokenLength: token.length,
          tokenStart: token.substring(0, 20) + '...',
        });
        
        // JWTペイロードをデコードして詳細確認
        const payload = decodeJWT(token);
        if (payload) {
          console.log('🔍 JWT ペイロード詳細:', {
            iss: payload.iss, // issuer
            aud: payload.aud, // audience 
            sub: payload.sub, // subject (user ID)
            exp: payload.exp, // expiration
            iat: payload.iat, // issued at
            auth_time: payload.auth_time,
            firebase: payload.firebase
          });
        }
      }
      
      return token;
    } catch (error) {
      console.error('❌ APIクライアント: トークン取得エラー:', error);
      return null;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAuthToken();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🌐 API リクエスト準備:', {
        endpoint,
        method: options.method || 'GET',
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'なし',
      });
    }
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    const url = `${this.baseURL}${endpoint}`;
    
    if (process.env.NODE_ENV === 'development') {
      // ヘッダー情報を安全に表示
      const headers = config.headers as Record<string, string>;
      console.log('📡 API リクエスト送信:', {
        url,
        hasAuthHeader: !!headers['Authorization'],
        authHeaderPreview: headers['Authorization'] ? 
          'Bearer ' + headers['Authorization'].substring(7, 27) + '...' : 
          'なし'
      });
    }
    
    const response = await fetch(url, config);

    if (process.env.NODE_ENV === 'development') {
      console.log('📨 API レスポンス受信:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ API エラーレスポンス:', {
          status: response.status,
          error: errorData,
        });
      }
      
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const config: RequestInit = {
      method: 'POST',
    };
    if (data) {
      config.body = JSON.stringify(data);
    }
    return this.request<T>(endpoint, config);
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    const config: RequestInit = {
      method: 'PUT',
    };
    if (data) {
      config.body = JSON.stringify(data);
    }
    return this.request<T>(endpoint, config);
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(); 