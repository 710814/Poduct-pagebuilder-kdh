import React from 'react';
import { Clock, Ban, RefreshCw, LogOut } from 'lucide-react';
import { UserStatus } from '../services/firebaseService';

interface Props {
  userStatus: UserStatus;
  userEmail: string;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export const PendingApproval: React.FC<Props> = ({ userStatus, userEmail, onRefresh, onSignOut }) => {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const isRevoked = userStatus === 'revoked';

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <div className={`w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center ${
          isRevoked ? 'bg-red-50' : 'bg-amber-50'
        }`}>
          {isRevoked ? (
            <Ban className="w-8 h-8 text-red-500" />
          ) : (
            <Clock className="w-8 h-8 text-amber-500" />
          )}
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {isRevoked ? '접속 권한이 회수되었습니다' : '관리자 승인 대기 중'}
        </h2>

        <p className="text-sm text-gray-600 mb-1">
          {isRevoked
            ? '관리자가 이 계정의 접속 권한을 회수했습니다.'
            : '관리자가 가입을 승인하면 서비스를 이용할 수 있습니다.'}
        </p>
        <p className="text-sm text-gray-500 mb-6 break-all">{userEmail}</p>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            상태 새로고침
          </button>
          <button
            onClick={onSignOut}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
};
