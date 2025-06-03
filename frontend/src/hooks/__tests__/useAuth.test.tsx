import { renderHook, act } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { auth, googleProvider } from '@/utils/firebaseClient';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';

// Firebase Auth をモック
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('@/utils/firebaseClient', () => ({
  auth: {},
  googleProvider: {},
}));

const mockOnAuthStateChanged = onAuthStateChanged as jest.MockedFunction<typeof onAuthStateChanged>;
const mockSignInWithPopup = signInWithPopup as jest.MockedFunction<typeof signInWithPopup>;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;

describe('useAuth フック', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('初期状態でローディング中である', () => {
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      // コールバックを呼ばずにunsubscribe関数を返す
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('ユーザーがログインしている場合、user が設定される', () => {
    const mockUser = { uid: 'test-uid', email: 'test@example.com' } as User;

    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      // すぐにコールバックを呼ぶ
      if (typeof callback === 'function') {
        callback(mockUser);
      }
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(false);
    expect(result.current.user).toBe(mockUser);
    expect(result.current.error).toBe(null);
  });

  it('ユーザーがログアウトしている場合、user が null になる', () => {
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      if (typeof callback === 'function') {
        callback(null);
      }
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(false);
    expect(result.current.user).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('signInWithGoogle が成功する', async () => {
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      if (typeof callback === 'function') {
        callback(null);
      }
      return jest.fn();
    });
    mockSignInWithPopup.mockResolvedValue({} as any);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(mockSignInWithPopup).toHaveBeenCalledWith(auth, googleProvider);
    expect(result.current.error).toBe(null);
  });

  it('signInWithGoogle が失敗した場合、エラーが設定される', async () => {
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      if (typeof callback === 'function') {
        callback(null);
      }
      return jest.fn();
    });
    mockSignInWithPopup.mockRejectedValue(new Error('Login failed'));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(result.current.error).toBe('ログインに失敗しました。もう一度お試しください。');
  });

  it('logout が成功する', async () => {
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      if (typeof callback === 'function') {
        callback(null);
      }
      return jest.fn();
    });
    mockSignOut.mockResolvedValue();

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(mockSignOut).toHaveBeenCalledWith(auth);
    expect(result.current.error).toBe(null);
  });

  it('clearError でエラーがクリアされる', () => {
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      if (typeof callback === 'function') {
        callback(null);
      }
      return jest.fn();
    });

    const { result } = renderHook(() => useAuth());

    // エラーを設定
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBe(null);
  });
}); 