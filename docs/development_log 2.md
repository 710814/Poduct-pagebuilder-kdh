# 개발 로그 및 버그 수정 내역

## 2026-03-26 17:49:56
- **작업 내용:** 개발 서버 구동 요청 수행
- **상세 내역:**
    - `package.json` 분석을 통해 `vite`를 기반으로 하는 프로젝트임을 확인.
    - `docs/` 디렉토리를 생성하고 사용자 프롬프트 및 개발 로그 문서화 구조 마련.
    - `npm run dev` 명령어를 통해 개발 서버 구동 성공 (URL: http://localhost:3000/).

## 2026-04-11 20:17:10
- **작업 내용:** 프로젝트 소개 및 기술 스택 정리
- **상세 내역:**
    - `PROJECT_README.md` 및 `package.json` 분석을 통해 프로젝트 개요와 핵심 기능 파악.
    - 프로젝트 명칭(PageGenie), 목적(AI 기반 상세페이지 생동 생성 및 현지화), 기술 스택(React, TypeScript, Gemini API 등) 정리하여 제공.

## 2026-04-11 20:52:00
- **작업 내용:** Firebase 백엔드 마이그레이션 계획 수립
- **상세 내역:**
    - 기존 GAS(Google Apps Script) 기반 백엔드 로직 분석.
    - Firestore(DB), Firebase Storage(파일), Cloud Functions(API 프록시)를 활용한 대체 설계안 도출.
    - UI 및 기능 유지를 위한 `implementation_plan.md` 작성.

## 2026-04-11 21:01:00
- **작업 내용:** 프롬프트 및 파이프라인 보존 중심의 마이크레이션 계획 고도화
- **상세 내역:**
    - `geminiService.ts`와 `categoryPresets.ts` 내의 모든 AI 프롬프트 문자열을 Read-Only 데이터로 규정.
    - 비즈니스 로직(파이프라인)과 UI 컴포넌트 구조의 변경 없는 인프라 교체 방식 확립.
    - 데이터 마이그레이션 제외 방침 반영하여 `implementation_plan.md` 업데이트.

## 2026-04-12 07:11:00
- **작업 내용:** Firebase 마이그레이션 최종 계획 확정
- **상세 내역:**
    - 사용자 요구사항 최종 반영: API 키는 Cloud Functions 환경 변수로 관리, 클라이언트 설정 UI 불필요.
    - 프론트엔드 파일 전수 분석 완료 (services 5개, components 9개, 의존 관계 매핑).
    - 절대 변경 금지 파일 13개 명시 (App.tsx, 모든 Step 컴포넌트, categoryPresets.ts, types.ts 등).
    - 변경 대상 파일 5개로 한정 (geminiService.ts URL만, firebaseService.ts 신규, StepResult.tsx import교체, SettingsModal.tsx 설정필드 간소화, vite.config.ts 청크명).
    - Cloud Functions 엔드포인트 4개 설계 (gemini-proxy, save-product, backup/restore).

## 2026-04-12 07:16:00
- **작업 내용:** Firebase 프로젝트 생성 가이드 작성 및 템플릿 이전 방안 확인
- **상세 내역:**
    - `docs/FIREBASE_SETUP_GUIDE.md` 생성: 프로젝트 생성, Firestore/Storage 활성화, Cloud Functions 설정, API 키 관리, 배포까지 7단계 가이드.
    - 기존 템플릿 이전 확인: `templateService.ts`는 변경 금지 파일로 localStorage 유지, Firebase 전환 시에도 브라우저에 저장된 템플릿은 자동 보존됨.
    - Firestore 백업/복원을 통해 다른 기기에서도 템플릿 복원 가능한 구조 설계.

## 2026-04-12 07:38:00
- **작업 내용:** Firebase 환경 변수 설정 완료 (6단계)
- **상세 내역:**
    - 프로젝트 루트에 `.env` 파일 생성 (`VITE_CLOUD_FUNCTIONS_URL=https://us-central1-pagegenie-95995.cloudfunctions.net`).
    - `.gitignore`에 `.env`, `.env.local`, `.env.production` 추가 (보안).
    - 사용자가 `firebase functions:secrets:set GEMINI_API_KEY` 명령으로 Gemini API 키 시크릿 등록 완료 확인.
    - `FIREBASE_SETUP_GUIDE.md` 6번 섹션을 실제 프로젝트 정보로 업데이트.

## 2026-04-12 07:45:00
- **작업 내용:** Firebase 마이그레이션 Phase 1 - Cloud Functions 및 서비스 레이어 구현 완료
- **상세 내역:**
    - **Cloud Functions (`functions/index.js`) 신규 작성:**
        - `geminiProxy`: Gemini API 프록시 (GEMINI_API_KEY Secrets 사용, 클라이언트 노출 방지)
        - `saveProduct`: Firestore에 상품 데이터 저장 + Firebase Storage에 이미지/HTML 업로드
        - `getTemplates` / `saveTemplate` / `deleteTemplate`: Firestore 기반 템플릿 CRUD
        - `backupSettings` / `restoreSettings`: 설정 백업/복원
        - CORS 미들웨어 적용, 타임아웃 9분 설정
    - **프론트엔드 서비스 레이어 교체:**
        - `services/firebaseService.ts` 신규 작성 (googleSheetService.ts 대체)
        - `services/templateService.ts` 재작성 (localStorage → Firestore, async 변환)
        - `services/settingsBackupService.ts` 재작성 (GAS → Cloud Functions)
        - `services/geminiService.ts` GAS 참조 전면 제거 (callGeminiViaProxy URL 변경, GAS URL 분기 로직 4곳 삭제)
    - **프론트엔드 컴포넌트 수정:**
        - `StepResult.tsx`: import 교체 (saveToFirebase), 저장 로직 Firebase 기반
        - `SettingsModal.tsx`: GAS URL/시트 ID 입력 필드 제거 → Firebase 연결 상태 표시로 대체
        - `StepUpload.tsx`: getTemplates() async 래핑 (useEffect 수정)
        - `App.tsx`: import 수정, getTemplates() await 추가, 자동 복원 로직 단순화
    - **타입 및 환경 설정:**
        - `vite-env.d.ts` 신규 생성 (VITE_CLOUD_FUNCTIONS_URL 타입 정의)
    - **빌드 검증:** TypeScript 컴파일 에러 0개 (Firebase 관련), 기존 에러만 잔존 (ErrorBoundary, StepUpload)
    - **다음 단계:** Cloud Functions 배포 (`firebase deploy --only functions`) 후 전체 파이프라인 테스트
