import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { recordLogin, UserStatus, UserRole } from '../services/firebaseService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userStatus: UserStatus | null;
  role: UserRole | null;
  isAdmin: boolean;
  isApproved: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  refreshUserContext: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  const fetchUserContext = useCallback(async (firebaseUser: User) => {
    try {
      const idToken = await firebaseUser.getIdToken();
      const ctx = await recordLogin(idToken);
      setUserStatus(ctx.userStatus);
      setRole(ctx.role);
    } catch (e) {
      console.error('[Auth] 사용자 컨텍스트 조회 실패:', e);
      setUserStatus(null);
      setRole(null);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchUserContext(firebaseUser);
      } else {
        setUserStatus(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchUserContext]);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!user) return null;
    return await user.getIdToken();
  };

  const refreshUserContext = useCallback(async () => {
    if (!user) return;
    await fetchUserContext(user);
  }, [user, fetchUserContext]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      userStatus,
      role,
      isAdmin: role === 'admin',
      isApproved: userStatus === 'approved',
      signInWithGoogle,
      signOut,
      getIdToken,
      refreshUserContext,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
