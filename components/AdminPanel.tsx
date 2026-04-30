import React, { useEffect, useState, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Loader2, RefreshCw, Shield, ShieldCheck, Check, X, UserCog } from 'lucide-react';
import {
  adminListUsers,
  adminUpdateUserStatus,
  adminUpdateUserRole,
  AdminUserSummary,
} from '../services/adminService';
import { UserStatus, UserRole } from '../services/firebaseService';

interface Props {
  user: User;
}

type StatusFilter = 'all' | UserStatus;

const STATUS_LABEL: Record<UserStatus, string> = {
  pending: '승인 대기',
  approved: '승인됨',
  revoked: '회수됨',
};

const STATUS_BADGE: Record<UserStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  revoked: 'bg-red-100 text-red-700',
};

export const AdminPanel: React.FC<Props> = ({ user }) => {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const list = await adminListUsers(idToken);
      setUsers(list);
    } catch (e: any) {
      console.error('[Admin] 사용자 목록 조회 실패:', e);
      setError(e.message || '사용자 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const markPending = (uid: string, on: boolean) => {
    setPendingActions(prev => {
      const next = new Set(prev);
      if (on) next.add(uid); else next.delete(uid);
      return next;
    });
  };

  const handleChangeStatus = async (target: AdminUserSummary, newStatus: UserStatus) => {
    if (target.uid === user.uid) {
      alert('본인의 상태는 변경할 수 없습니다.');
      return;
    }
    markPending(target.uid, true);
    try {
      const idToken = await user.getIdToken();
      await adminUpdateUserStatus(idToken, target.uid, newStatus);
      setUsers(prev => prev.map(u => u.uid === target.uid ? { ...u, status: newStatus } : u));
    } catch (e: any) {
      alert(e.message || '상태 변경 실패');
    } finally {
      markPending(target.uid, false);
    }
  };

  const handleChangeRole = async (target: AdminUserSummary, newRole: UserRole) => {
    if (target.uid === user.uid) {
      alert('본인의 역할은 변경할 수 없습니다.');
      return;
    }
    if (!window.confirm(
      newRole === 'admin'
        ? `${target.email}을 관리자로 지정하시겠습니까?`
        : `${target.email}의 관리자 권한을 해제하시겠습니까?`
    )) return;
    markPending(target.uid, true);
    try {
      const idToken = await user.getIdToken();
      await adminUpdateUserRole(idToken, target.uid, newRole);
      setUsers(prev => prev.map(u => u.uid === target.uid ? { ...u, role: newRole } : u));
    } catch (e: any) {
      alert(e.message || '역할 변경 실패');
    } finally {
      markPending(target.uid, false);
    }
  };

  const filtered = filter === 'all' ? users : users.filter(u => u.status === filter);

  const counts = {
    all: users.length,
    pending: users.filter(u => u.status === 'pending').length,
    approved: users.filter(u => u.status === 'approved').length,
    revoked: users.filter(u => u.status === 'revoked').length,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" />
            관리자 패널
          </h1>
          <p className="text-sm text-gray-500 mt-1">사용자 접속 권한과 역할을 관리합니다.</p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {(['all', 'pending', 'approved', 'revoked'] as StatusFilter[]).map(key => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filter === key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {key === 'all' ? '전체' : STATUS_LABEL[key]}
            <span className="ml-1.5 text-xs text-gray-400">({counts[key]})</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">
          해당 조건의 사용자가 없습니다.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">사용자</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">역할</th>
                <th className="px-4 py-3">마지막 접속</th>
                <th className="px-4 py-3 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(u => {
                const isSelf = u.uid === user.uid;
                const isBusy = pendingActions.has(u.uid);
                return (
                  <tr key={u.uid} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                            {(u.displayName || u.email || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {u.displayName || '(이름 없음)'}
                            {isSelf && <span className="ml-2 text-xs text-indigo-600">(나)</span>}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[u.status]}`}>
                        {STATUS_LABEL[u.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                        u.role === 'admin' ? 'text-indigo-600' : 'text-gray-600'
                      }`}>
                        {u.role === 'admin' && <ShieldCheck className="w-3.5 h-3.5" />}
                        {u.role === 'admin' ? '관리자' : '일반'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isBusy && <Loader2 className="w-4 h-4 text-gray-400 animate-spin mr-1" />}
                        {!isSelf && u.status !== 'approved' && (
                          <button
                            onClick={() => handleChangeStatus(u, 'approved')}
                            disabled={isBusy}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded hover:bg-green-100 disabled:opacity-50"
                            title="승인"
                          >
                            <Check className="w-3.5 h-3.5" />
                            승인
                          </button>
                        )}
                        {!isSelf && u.status === 'approved' && (
                          <button
                            onClick={() => handleChangeStatus(u, 'revoked')}
                            disabled={isBusy}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50"
                            title="권한 회수"
                          >
                            <X className="w-3.5 h-3.5" />
                            회수
                          </button>
                        )}
                        {!isSelf && (
                          <button
                            onClick={() => handleChangeRole(u, u.role === 'admin' ? 'user' : 'admin')}
                            disabled={isBusy}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100 disabled:opacity-50"
                            title={u.role === 'admin' ? '관리자 해제' : '관리자 지정'}
                          >
                            <UserCog className="w-3.5 h-3.5" />
                            {u.role === 'admin' ? '해제' : '관리자'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
