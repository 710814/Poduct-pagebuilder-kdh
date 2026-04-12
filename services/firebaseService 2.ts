/**
 * Firebase Service - googleSheetService.ts를 대체
 * 
 * Cloud Functions를 통해 Firestore/Storage와 통신합니다.
 * API 키는 서버(Cloud Functions)에서만 관리되며, 클라이언트에 노출되지 않습니다.
 */

import { ProductAnalysis, AppMode } from "../types";

// Cloud Functions Base URL (빌드 타임 환경 변수에서 주입)
const FUNCTIONS_URL = import.meta.env.VITE_CLOUD_FUNCTIONS_URL || '';

/**
 * Cloud Functions URL 가져오기
 */
export const getFunctionsUrl = (): string => {
  return FUNCTIONS_URL;
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

/**
 * HTML 페이지 생성 함수 (기존과 동일)
 */
const generateHTML = (data: ProductAnalysis): string => {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.productName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Noto Sans KR', sans-serif; margin: 0; padding: 0; color: #333; line-height: 1.6; }
        .container { max-width: 800px; margin: 0 auto; }
        .hero { text-align: center; padding: 60px 20px; background-color: #f9fafb; }
        .hero h1 { font-size: 2.5rem; margin-bottom: 20px; color: #111; }
        .hero p { font-size: 1.2rem; color: #555; max-width: 600px; margin: 0 auto; }
        .features { padding: 40px 20px; background: #fff; }
        .features ul { max-width: 600px; margin: 0 auto; padding-left: 20px; }
        .features li { margin-bottom: 10px; font-size: 1.1rem; }
        .section { padding: 60px 20px; border-bottom: 1px solid #eee; text-align: center; }
        .section img { max-width: 100%; height: auto; border-radius: 8px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .section h2 { font-size: 2rem; margin-bottom: 20px; }
        .section p { font-size: 1.1rem; color: #666; max-width: 700px; margin: 0 auto; white-space: pre-wrap; }
        .footer { padding: 40px; text-align: center; font-size: 0.9rem; color: #999; background: #f1f1f1; }
    </style>
</head>
<body>
    <div class="container">
        <header class="hero">
            <h1>${data.productName}</h1>
            <p>${data.marketingCopy}</p>
        </header>

        <section class="features">
            <ul>
                ${data.mainFeatures.map(f => `<li>${f}</li>`).join('')}
            </ul>
        </section>

        ${data.sections.map(section => `
        <section class="section">
            ${section.imageUrl ? `<img src="images/section_${section.id}.png" alt="${section.title}" />` : ''}
            <h2>${section.title}</h2>
            <p>${section.content}</p>
        </section>
        `).join('')}

        <footer class="footer">
            <p>© ${new Date().getFullYear()} ${data.productName}. All rights reserved.</p>
        </footer>
    </div>
</body>
</html>`;
};

/**
 * Firebase(Cloud Functions)에 상품 데이터 저장
 * 기존 saveToGoogleSheet과 동일한 역할
 */
export const saveToFirebase = async (data: ProductAnalysis, mode: AppMode): Promise<boolean> => {
  if (!FUNCTIONS_URL) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
  }

  // 1. 기본 텍스트 데이터 준비
  const rowData = formatDataForFirestore(data, mode);
  
  // 2. 폴더명 생성
  const dateStr = new Date().toISOString().split('T')[0];
  const safeProductName = data.productName.replace(/[\/\\]/g, '_').substring(0, 30); 
  const folderName = `[${dateStr}] ${safeProductName}`;

  // 3. 이미지 데이터 추출
  const imagesToSave = data.sections.map((section) => {
    if (section.imageUrl && section.imageUrl.startsWith('data:image')) {
      return {
        id: section.id,
        title: section.title,
        base64: section.imageUrl.split(',')[1]
      };
    }
    return null;
  }).filter(item => item !== null);

  // 4. HTML 파일 생성
  const htmlContent = generateHTML(data);
  const htmlBase64 = btoa(unescape(encodeURIComponent(htmlContent)));

  // 5. Cloud Functions에 전송
  const payload = {
    ...rowData, 
    folderName: folderName,
    saveImagesToDrive: imagesToSave.length > 0,
    images: imagesToSave,
    htmlContent: htmlBase64,
    htmlFileName: `${safeProductName}_detail_page.html`
  };

  console.log('🔵 [Firebase Service] Cloud Functions에 데이터 전송 중...');

  const response = await fetch(`${FUNCTIONS_URL}/saveProduct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
