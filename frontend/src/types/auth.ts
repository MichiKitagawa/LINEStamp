export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  tokenBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionResponse {
  user: UserProfile;
  isAuthenticated: boolean;
}

export interface AuthError {
  code: string;
  message: string;
} 