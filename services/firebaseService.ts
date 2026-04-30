/**
 * Firebase Service - googleSheetService.ts를 대체
 * 
 * Cloud Functions를 통해 Firestore/Storage와 통신합니다.
 * API 키는 서버(Cloud Functions)에서만 관리되며, 클라이언트에 노출되지 않습니다.
 */

import { ProductAnalysis, AppMode } from "../types";
import { auth } from "../firebase";

// Cloud Functions Base URL (빌드 타임 환경 변수에서 주입)
const FUNCTIONS_URL = import.meta.env.VITE_CLOUD_FUNCTIONS_URL || '';

/**
 * Cloud Functions URL 가져오기
 */
export const getFunctionsUrl = (): string => {
  return FUNCTIONS_URL;
};

/**
 * 현재 로그인 사용자의 Firebase ID 토큰 조회
 * Cloud Functions 인증 가드(requireApproved)를 통과하기 위한 Authorization 헤더 용도
 */
export const getCurrentIdToken = async (): Promise<string | null> => {
  return auth.currentUser ? await auth.currentUser.getIdToken() : null;
};

/**
 * Cloud Functions 연결 여부 확인
 */
export const isFirebaseConnected = (): boolean => {
  return !!FUNCTIONS_URL && FUNCTIONS_URL.length > 0;
};

/**
 * Firestore Console 열기
 */
export const openFirebaseConsole = () => {
  // .firebaserc에서 프로젝트 ID 추출은 런타임에 불가하므로 고정 URL 사용
  window.open('https://console.firebase.google.com/', '_blank');
};

// ============================================================
// 시트 데이터 포맷 (기존 googleSheetService와 동일 인터페이스 유지)
// ============================================================

export interface SheetRowData {
  timestamp: string;
  mode: string;
  productName: string;
  category: string;
  features: string;
  marketingCopy: string;
  sectionCount: number;
  sections_summary: string;
  image_prompts: string;
}

/**
 * 분석 데이터를 저장용 포맷으로 변환
 */
export const formatDataForFirestore = (data: ProductAnalysis, mode: AppMode): SheetRowData => {
  const sectionsSummary = data.sections.map((s, i) => {
    return `[Section ${i+1}: ${s.title}]\n${s.content}`;
  }).join('\n----------------\n');

  const prompts = data.sections.map((s, i) => {
    return `[S${i+1}] ${s.imagePrompt || 'No Prompt'}`;
  }).join('\n');

  return {
    timestamp: new Date().toLocaleString('ko-KR'),
    mode: mode === AppMode.CREATION ? '생성(Mode A)' : '현지화(Mode B)',
    productName: data.productName,
    category: data.detectedCategory || 'N/A',
    features: data.mainFeatures.join(', '),
    marketingCopy: data.marketingCopy,
    sectionCount: data.sections.length,
    sections_summary: sectionsSummary,
    image_prompts: prompts,
  };
};

/**
 * CSV 데이터 문자열 생성 (백업용 - 기존과 동일)
 */
export const generateCSV = (data: ProductAnalysis, mode: AppMode): string => {
  const row = formatDataForFirestore(data, mode);
  
  const cleanDataForCsv = {
    ...data,
    sections: data.sections.map(s => ({
      ...s,
      imageUrl: s.imageUrl ? '(Image Data Omitted for CSV)' : undefined
    }))
  };

  const headers = [
    '타임스탬프', '모드', '상품명', '카테고리', 
    '주요특징', '마케팅문구', '섹션수', 
    '섹션상세내용', '이미지프롬프트', '전체데이터_JSON(이미지제외)'
  ];
  
  const escapeCsv = (str: string | number) => {
    if (str === null || str === undefined) return '';
    const stringValue = String(str);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const values = [
    escapeCsv(row.timestamp),
    escapeCsv(row.mode),
    escapeCsv(row.productName),
    escapeCsv(row.category),
    escapeCsv(row.features),
    escapeCsv(row.marketingCopy),
    escapeCsv(row.sectionCount),
    escapeCsv(row.sections_summary),
    escapeCsv(row.image_prompts),
    escapeCsv(JSON.stringify(cleanDataForCsv))
  ];

  return headers.join(',') + '\n' + values.join(',');
};

// ============================================================
// 갤러리용 타입
// ============================================================

export interface ProductSummary {
  productId: string;
  productName: string;
  createdAt: string;
  mode: string;
  thumbnailUrl: string;
  sectionCount: number;
  htmlContent?: string;
}

// ============================================================
// 사용자 컨텍스트 (승인 상태 / 역할)
// ============================================================

export type UserStatus = 'pending' | 'approved' | 'revoked';
export type UserRole = 'user' | 'admin';

export interface UserContext {
  userStatus: UserStatus;
  role: UserRole;
  isNew: boolean;
}

/**
 * 로그인 직후 호출 — 사용자 doc upsert 후 상태/역할 반환
 */
export const recordLogin = async (idToken: string): Promise<UserContext> => {
  if (!FUNCTIONS_URL) throw new Error("FIREBASE_NOT_CONFIGURED");

  const response = await fetch(`${FUNCTIONS_URL}/recordLogin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`로그인 기록 실패 (${response.status})`);
  }

  const result = await response.json();
  return {
    userStatus: result.userStatus,
    role: result.role,
    isNew: !!result.isNew,
  };
};

// ============================================================
// 갤러리 API
// ============================================================

/**
 * 내 작업물 목록 조회
 */
export const getUserProducts = async (idToken: string): Promise<ProductSummary[]> => {
  if (!FUNCTIONS_URL) throw new Error("FIREBASE_NOT_CONFIGURED");

  const response = await fetch(`${FUNCTIONS_URL}/getProducts`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`목록 조회 실패 (${response.status})`);
  }

  const result = await response.json();
  return result.products ?? [];
};

/**
 * 작업물 삭제
 */
export const deleteProduct = async (productId: string, idToken: string): Promise<void> => {
  if (!FUNCTIONS_URL) throw new Error("FIREBASE_NOT_CONFIGURED");

  const response = await fetch(`${FUNCTIONS_URL}/deleteProduct`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ productId }),
  });

  if (!response.ok) {
    throw new Error(`삭제 실패 (${response.status})`);
  }
};

/**
 * 작업물 다운로드 URL 요청 (Signed URL)
 */
export const getProductDownloadUrl = async (productId: string, idToken: string): Promise<string> => {
  if (!FUNCTIONS_URL) throw new Error("FIREBASE_NOT_CONFIGURED");

  const response = await fetch(`${FUNCTIONS_URL}/getDownloadUrl`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ productId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `다운로드 URL 생성 실패 (${response.status})`);
  }

  const result = await response.json();
  return result.downloadUrl;
};

// ============================================================
// 저장 API
// ============================================================

/**
 * Firebase(Cloud Functions)에 상품 데이터 저장
 * 기존 saveToGoogleSheet과 동일한 역할
 */
export const saveToFirebase = async (data: ProductAnalysis, mode: AppMode, idToken?: string, fullPageImage?: string | null): Promise<boolean> => {
  if (!FUNCTIONS_URL) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
  }

  // 1. 기본 텍스트 데이터 준비
  const rowData = formatDataForFirestore(data, mode);

  // 2. 폴더명 생성
  const dateStr = new Date().toISOString().split('T')[0];
  const safeProductName = data.productName.replace(/[\/\\]/g, '_').substring(0, 30);
  const folderName = `[${dateStr}] ${safeProductName}`;

  // 3. fullPageImage base64 추출 (자동저장은 통이미지만 보내므로 페이로드 ~수MB 수준)
  let fullPageBase64: string | null = null;
  if (fullPageImage && fullPageImage.includes(',')) {
    fullPageBase64 = fullPageImage.split(',')[1];
  }

  console.log(
    `📏 [Firebase Service] 페이로드 — FullPage ${((fullPageBase64?.length || 0) / 1024 / 1024).toFixed(2)}MB`
  );

  // 4. Cloud Functions에 전송
  const payload = {
    ...rowData,
    folderName: folderName,
    fullPageImage: fullPageBase64
  };

  console.log('🔵 [Firebase Service] Cloud Functions에 데이터 전송 중...');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const response = await fetch(`${FUNCTIONS_URL}/saveProduct`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`저장 실패 (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  
  if (result.status === 'success') {
    console.log('✅ [Firebase Service] 저장 성공:', result.productId);
    return true;
  } else {
    throw new Error(result.message || '저장 실패');
  }
};
