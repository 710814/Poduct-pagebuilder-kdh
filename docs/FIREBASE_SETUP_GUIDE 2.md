# 🔥 Firebase 프로젝트 생성 및 설정 가이드

PageGenie의 백엔드를 Firebase로 마이그레이션하기 위한 단계별 설정 가이드입니다.

---

## 📋 목차

1. [Firebase 프로젝트 생성](#1-firebase-프로젝트-생성)
2. [Firestore Database 활성화](#2-firestore-database-활성화)
3. [Firebase Storage 활성화](#3-firebase-storage-활성화)
4. [Cloud Functions 설정](#4-cloud-functions-설정)
5. [Gemini API 키 등록](#5-gemini-api-키-등록-cloud-functions-secrets)
6. [프로젝트에 환경 변수 설정](#6-프로젝트에-환경-변수-설정)
7. [배포 및 확인](#7-배포-및-확인)

---

## 1. Firebase 프로젝트 생성

### 1-1. Firebase Console 접속
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. Google 계정으로 로그인

### 1-2. 새 프로젝트 만들기
1. **"프로젝트 추가"** 버튼 클릭
2. **프로젝트 이름** 입력: `pagegenie` (또는 원하는 이름)
3. **Google Analytics** 설정:
   - 이 프로젝트에서는 Analytics가 필요하지 않으므로 **비활성화** 권장
   - 또는 활성화해도 무방합니다
4. **"프로젝트 만들기"** 클릭 → 생성 완료까지 대기 (약 30초)

### 1-3. 요금제 확인
> ⚠️ **Cloud Functions를 사용하려면 Blaze(종량제) 요금제**가 필요합니다.
> 
> 무료 할당량이 넉넉하므로 (매월 Cloud Functions 200만 건 호출 무료) 소규모 사용 시 비용이 거의 발생하지 않습니다.

1. Firebase Console 좌측 하단 → **"Spark"** 클릭
2. **"Blaze 요금제로 업그레이드"** 선택
3. 결제 계정 연결 (Google Cloud 결제 계정)
4. 예산 알림 설정 권장: 월 $5~10 정도로 설정

---

## 2. Firestore Database 활성화

### 2-1. Firestore 생성
1. Firebase Console → 좌측 메뉴 → **"Firestore Database"**
2. **"데이터베이스 만들기"** 클릭
3. **위치 선택**: `asia-northeast3` (서울) 권장
4. **보안 규칙**: "프로덕션 모드에서 시작" 선택

### 2-2. 보안 규칙 설정
Firestore 탭 → **"규칙"** 탭에서 아래 내용으로 교체:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Cloud Functions(Admin SDK)에서만 읽기/쓰기 허용
    // 클라이언트에서 직접 접근 차단
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> 💡 모든 데이터 접근은 Cloud Functions(Admin SDK)를 통해 이루어지므로, 클라이언트 직접 접근을 완전히 차단합니다.

---

## 3. Firebase Storage 활성화

### 3-1. Storage 생성
1. Firebase Console → 좌측 메뉴 → **"Storage"**
2. **"시작하기"** 클릭
3. **보안 규칙**: "프로덕션 모드에서 시작" 선택
4. **위치**: Firestore와 동일한 `asia-northeast3` (서울)

### 3-2. 보안 규칙 설정
Storage → **"규칙"** 탭에서 아래 내용으로 교체:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Cloud Functions(Admin SDK)에서만 업로드 허용
    // 읽기는 누구나 가능 (생성된 이미지를 공유하기 위해)
    match /{allPaths=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

---

## 4. Cloud Functions 설정

### 4-1. Firebase CLI 설치

터미널에서 실행:

```bash
# Firebase CLI 설치 (이미 설치되어 있다면 생략)
npm install -g firebase-tools

# Firebase 로그인
firebase login

# 프로젝트 디렉토리 확인
firebase projects:list
```

### 4-2. 프로젝트 초기화

프로젝트 루트 디렉토리에서 실행:

```bash
# Firebase 초기화 (functions만 선택)
firebase init functions
```

**설정 선택:**
- "Use an existing project" → 위에서 만든 `pagegenie` 프로젝트 선택
- Language: **JavaScript** 선택
- ESLint: **No** (선택사항)
- Install dependencies: **Yes**

이렇게 하면 `functions/` 디렉토리가 생성됩니다.

### 4-3. 생성되는 디렉토리 구조

```
프로젝트 루트/
├── functions/
│   ├── package.json
│   ├── index.js        ← Cloud Functions 코드 (여기에 로직 작성)
│   └── .env            ← API 키 등 시크릿
├── firebase.json       ← Firebase 프로젝트 설정
├── .firebaserc         ← 프로젝트 연결 정보
└── (기존 프로젝트 파일들...)
```

---

## 5. Gemini API 키 등록 (Cloud Functions Secrets)

### 방법 A: `.env` 파일 사용 (개발/테스트용)

`functions/.env` 파일 생성:

```env
GEMINI_API_KEY=여기에_Gemini_API_키를_입력하세요
```

### 방법 B: Firebase Secrets 사용 (프로덕션 권장)

```bash
# 시크릿 설정 (프로덕션 환경)
firebase functions:secrets:set GEMINI_API_KEY
# 프롬프트가 나타나면 API 키를 붙여넣기
```

> 💡 **Gemini API 키 발급 방법:**
> 1. [Google AI Studio](https://aistudio.google.com/) 접속
> 2. 좌측 메뉴 → "Get API Key" 클릭
> 3. "Create API Key" → 프로젝트 선택 → 키 복사

---

## 6. 프로젝트에 환경 변수 설정 ✅ 완료

> ✅ **이 단계는 자동으로 완료되었습니다.** 아래는 설정된 내용에 대한 상세 설명입니다.

### 6-1. `.env` 파일이란?

Vite(프론트엔드 빌드 도구)는 프로젝트 루트의 `.env` 파일에 정의된 환경 변수를 자동으로 읽어, 빌드 시 코드에 주입합니다. `VITE_` 접두사가 붙은 변수만 클라이언트 코드에서 접근 가능합니다.

```
[프론트엔드 코드] ──fetch──→ [.env의 URL] ──→ [Cloud Functions] ──→ [Firestore/Gemini API]
                                                    │
                                            GEMINI_API_KEY (시크릿, 서버에만 존재)
```

### 6-2. 생성된 파일: `.env` (프로젝트 루트)

```env
VITE_CLOUD_FUNCTIONS_URL=https://us-central1-pagegenie-95995.cloudfunctions.net
```

- **프로젝트 ID**: `pagegenie-95995` (`.firebaserc`에서 자동 확인)
- **리전**: `us-central1` (Cloud Functions 기본 리전)
- 이 URL은 Cloud Functions 배포 후 실제로 활성화됩니다.

### 6-3. `.gitignore`에 `.env` 추가됨

`.env` 파일이 GitHub에 올라가는 것을 방지하기 위해 `.gitignore`에 추가되었습니다.

### 6-4. 코드에서 사용하는 방법

프론트엔드 코드에서 아래와 같이 접근합니다:

```typescript
const functionsUrl = import.meta.env.VITE_CLOUD_FUNCTIONS_URL;
// → "https://us-central1-pagegenie-95995.cloudfunctions.net"
```

> ⚠️ **중요**: Cloud Functions를 배포한 후 실제 URL이 변경될 경우, `.env` 파일의 URL을 업데이트하고 `npm run dev`를 재시작해야 합니다.

---

## 7. 배포 및 확인

### 7-1. Cloud Functions 배포

```bash
# Cloud Functions 배포
firebase deploy --only functions
```

배포 완료 후 콘솔에 출력되는 각 함수의 URL을 확인합니다:

```
✓ functions: Finished running predeploy script.
✓ functions[geminiProxy]: Successful deploy.
   Function URL (geminiProxy): https://us-central1-pagegenie-xxxxx.cloudfunctions.net/geminiProxy
✓ functions[saveProduct]: Successful deploy.
   Function URL (saveProduct): https://us-central1-pagegenie-xxxxx.cloudfunctions.net/saveProduct
```

### 7-2. 환경 변수 업데이트

출력된 base URL을 프로젝트 루트의 `.env` 파일에 입력:

```env
VITE_CLOUD_FUNCTIONS_URL=https://us-central1-pagegenie-xxxxx.cloudfunctions.net
```

### 7-3. 개발 서버 재시작

```bash
npm run dev
```

### 7-4. 테스트 체크리스트

- [ ] 상품 이미지 업로드 → AI 분석 정상 동작
- [ ] 섹션별 이미지 생성 정상 동작
- [ ] 결과 저장 → Firestore 콘솔에서 데이터 확인
- [ ] ZIP 다운로드 정상 동작
- [ ] 템플릿 관리 정상 동작 (localStorage 유지)

---

## 📌 무료 할당량 참고 (Blaze 요금제)

| 서비스 | 무료 할당량 (월) |
|--------|-----------------|
| Cloud Functions 호출 | 200만 건 |
| Cloud Functions 실행 시간 | 40만 GB-초 |
| Firestore 읽기 | 5만 건/일 |
| Firestore 쓰기 | 2만 건/일 |
| Firestore 저장 | 1GB |
| Storage 저장 | 5GB |
| Storage 다운로드 | 1GB/일 |

> 💡 개인 및 소규모 팀 사용 시 무료 할당량 범위 내에서 충분히 운영 가능합니다.

---

## 🔗 유용한 링크

- [Firebase Console](https://console.firebase.google.com/)
- [Google AI Studio (API 키 발급)](https://aistudio.google.com/)
- [Firebase Cloud Functions 문서](https://firebase.google.com/docs/functions)
- [Firestore 문서](https://firebase.google.com/docs/firestore)
- [Firebase Storage 문서](https://firebase.google.com/docs/storage)
