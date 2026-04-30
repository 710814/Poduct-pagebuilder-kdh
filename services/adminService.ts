/**
 * Admin Service - 관리자 전용 API 래퍼
 */

import { UserStatus, UserRole } from './firebaseService';

const FUNCTIONS_URL = import.meta.env.VITE_CLOUD_FUNCTIONS_URL || '';

export interface AdminUserSummary {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  status: UserStatus;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string;
}

export const adminListUsers = async (idToken: string): Promise<AdminUserSummary[]> => {
  if (!FUNCTIONS_URL) throw new Error("FIREBASE_NOT_CONFIGURED");

  const response = await fetch(`${FUNCTIONS_URL}/adminListUsers`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${idToken}` },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `사용자 목록 조회 실패 (${response.status})`);
  }

  const result = await response.json();
  return result.users ?? [];
};

export const adminUpdateUserStatus = async (
  idToken: string,
  targetUid: string,
  status: UserStatus
): Promise<void> => {
  if (!FUNCTIONS_URL) throw new Error("FIREBASE_NOT_CONFIGURED");

  const response = await fetch(`${FUNCTIONS_URL}/adminUpdateUserStatus`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ targetUid, status }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `상태 변경 실패 (${response.status})`);
  }
};

export const adminUpdateUserRole = async (
  idToken: string,
  targetUid: string,
  role: UserRole
): Promise<void> => {
  if (!FUNCTIONS_URL) throw new Error("FIREBASE_NOT_CONFIGURED");

  const response = await fetch(`${FUNCTIONS_URL}/adminUpdateUserRole`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ targetUid, role }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `역할 변경 실패 (${response.status})`);
  }
};
