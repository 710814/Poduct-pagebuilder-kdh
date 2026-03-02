# 템플릿 시스템 개선 개발 로그

## 일자: 2026-03-02

## 프롬프트 내역

1. **사용자 요청**: Notion 기획안(쇼핑몰 상세페이지 기획안) 리뷰 및 현재 프로세스 개선 조언
2. **사용자 요청**: 현재 템플릿 기능으로 개선 가능 여부 확인
3. **사용자 요청**: Level 1(거울 셀카) + Level 2(mood/핏) + 후면 이미지 태그 기능 구현 요청
4. **사용자 요청**: 후면 이미지가 있을 경우 코디컷에 후면 코디컷 필수 반영
5. **사용자 요청**: 기존 Mode A UI 컨셉/톤앤매너 유지

---

## 변경 파일 목록

### 1. `types.ts`
- `UploadedFile` 인터페이스에 `role?: 'front' | 'back' | 'detail'` 필드 추가
- `ModelSettings` 인터페이스에 `mood?: 'sexy' | 'elegant' | 'innocent' | 'casual' | 'sporty'` 필드 추가

### 2. `services/templateService.ts`
- **거울 셀카 룩북 템플릿** (`FASHION_MIRROR_SELFIE_TEMPLATE`) 추가
  - 핸드폰 거울 셀카 스타일, 얼굴 미노출
  - 컬러옵션별 3장씩 (정면 거울샷 / 사이드 거울샷 / 코디 또는 후면)
  - 디테일 클로즈업 2장 + 제품 정보 텍스트
- `MIRROR_SELFIE_STYLE`, `MIRROR_SELFIE_ELEMENTS` 프롬프트 상수 추가
- `BUILT_IN_TEMPLATE_IDS`에 새 템플릿 ID 추가
- `initializeBuiltInTemplates()`에 새 템플릿 자동등록 로직 추가

### 3. `services/geminiService.ts`
- `buildModelDescription()`: mood 매핑 로직 추가 (sexy→매혹, elegant→세련, innocent→내추럴, casual→편안, sporty→활동적)
- `applyTemplateStructure()`: **후면 이미지 존재 시 3번째 슬롯 프롬프트 강제 BACK VIEW 교체**
  - `mainImages`와 `colorOptions.images`에서 `role: 'back'` 감지
  - `"EITHER Back View OR Side Profile"` → `"BACK VIEW ONLY"` 강제 변환

### 4. `components/StepAnalysis.tsx`
- `handleGeneratePreview()`: 3번째 슬롯(i===2) 이미지 생성 시 **후면 이미지를 참조 이미지로 우선 선택**
  - `matchedColorOption?.images?.find(img => img.role === 'back')` 로 후면 이미지 검색

### 5. `components/StepUpload.tsx`
- `modelMood` 상태 변수 추가
- **분위기(mood) 선택 드롭다운** UI 추가 (모델 설정 섹션 내, 기존 스타일 유지)
- **메인 이미지 역할 태그 UI** 추가: 정면/후면 토글 버튼
  - 정면: 파란색, 후면: 주황색 하이라이트
- **컬러 옵션 이미지 역할 태그 UI** 추가: 후면 토글 버튼
- `handleSubmit()`에 mood 포함 로직 추가

---

## 핵심 동작 흐름

```
사용자가 후면 이미지 업로드 → "후면" 태그 클릭
    ↓
applyTemplateStructure()에서 role: 'back' 감지
    ↓
3번째 슬롯 프롬프트를 "BACK VIEW ONLY" 로 강제 교체
    ↓
StepAnalysis에서 이미지 생성 시 후면 이미지를 참조로 사용
    ↓
AI가 후면 디자인을 정확히 반영한 코디컷 생성
```

---

## 빌드 결과

- `npx vite build` 성공 (25.79s)
- 새로운 에러 없음 (기존 lint 에러만 존재: ErrorBoundary, import.meta.env 등)

---

## 2차 작업: 패션 룩북 템플릿 7섹션 재구성 (2026-03-02)

### 프롬프트 내역

6. **사용자 요청**: 템플릿 구조를 7섹션으로 전면 개편 요청
   - 히어로(상품명 레터링) → 제품설명(박스디자인) → 색상(2열) → 코디1(컬러별3장) → 코디설명 → 코디2(3장) → 제품정보
   - 이미지 앵글/배경/포즈 다양성 필수
   - 기존 UI 톤앤매너 유지

### 변경 파일

#### `services/templateService.ts`
- `LIFESTYLE_BACKGROUNDS` 프리셋 상수 추가 (6종: indoor1~4, outdoor1~2)
- `DIVERSE_POSES` 프리셋 상수 추가 (6종: standing_casual, walking, sitting, leaning, looking_away, holding_bag)
- `FASHION_LOOKBOOK_TEMPLATE` 전면 재구성 (기존 7섹션 → 새로운 7섹션+10개 서브섹션)
  - 섹션1: 히어로 이미지 (카페 배경 + 레터링 오버레이 공간)
  - 섹션2: 제품 설명 (text-only)
  - 섹션3: 색상 안내 (`grid-2`, 4슬롯, 상품 중심 상반신 컷)
  - 섹션4: 코디1 (컬러1~3별 `grid-1` × 3장, 다양한 배경/앵글)
  - 섹션5: 스타일링 가이드 (text-only)
  - 섹션6: 라이프스타일 코디 (`grid-1`, 3장, 거리/카페/서재 배경)
  - 섹션7: 제품 정보 (text-only)

### 프롬프트 다양성 개선 포인트
- ❌ 이전: `clean white studio background` 고정 → 모든 이미지 동일
- ✅ 개선: 카페/피아노/거실/거리/정원 등 6가지 배경 + 6가지 포즈 조합
- ✅ 앵글: FULL BODY / 3/4 BODY / UPPER BODY CLOSE-UP / WAIST-UP 혼합

### 빌드 결과

- `npx vite build` 성공 (24.29s)
- 새로운 에러 없음

---

## 3차 작업: 5가지 이슈 수정 (2026-03-02)

### 프롬프트 내역

7. **사용자 요청**: 테스트 후 5가지 이슈 보고
   - 동양여성 선택했으나 서양여성 나옴
   - 색상 섹션: 등록한 컬러(아이보리/핑크)와 다른 색상 + 2인 이미지
   - 코디 이미지가 2×2 배열 → 1열 세로 배열로 변경 요청 (절대규칙)
   - AI 생성 티가 심함 → 극사실주의 전환
   - 모델컷 스타일 선택 기능 추가 요청 (얼굴 노출/비노출/거울 셀카)

### 변경 파일

#### `types.ts`
- `ModelSettings` 인터페이스에 `modelCutStyle?: 'face_visible' | 'face_anonymous' | 'mirror_selfie'` 추가

#### `services/geminiService.ts`
- `buildModelDescription()`: `'Asian model'` → `'East Asian / Korean model with typical Korean facial features'` 구체화
- `buildModelDescription()`: `modelCutStyle` 처리 로직 추가 (face_visible/face_anonymous/mirror_selfie)
- 이미지 생성 메인 프롬프트: `'4K resolution, editorial style'` → `'hyperrealistic, Canon EOS R5, 85mm f/1.4, RAW photo, NOT AI-generated'` 교체

#### `services/templateService.ts`
- `ANONYMOUS_MODEL_STYLE`: 얼굴 비노출 표현 더 구체화
- `PHOTOREALISM_KEYWORDS` 상수 신규 추가 — 모든 이미지 슬롯에 적용
- `NEGATIVE_ELEMENTS`: `'STRICTLY ONE PERSON ONLY — NO two people, NO side-by-side, NO collage'` 강화
- 색상 섹션 프롬프트: `'⚠️ SINGLE MODEL ONLY — ONE person wearing EXACTLY {{COLOR_N}}'` 명시
- 히어로/코디1/코디2/라이프스타일 전 섹션에 `${PHOTOREALISM_KEYWORDS}` 삽입

#### `components/StepUpload.tsx`
- `modelCutStyle` 상태변수 추가
- **모델컷 스타일 드롭다운** UI 추가 (기본/얼굴노출/얼굴비노출/거울셀카)
- `handleSubmit()`에 `modelCutStyle` 포함 로직 추가

---

## 4차 작업: 후면 이미지 태그 로직 정교화 (2026-03-02)

### 수정 내역

- **문제점**: 기존 후면 이미지 감지 정규식이 최신 프롬프트 텍스트와 일치하지 않아 작동하지 않던 문제 발견.
- **`services/geminiService.ts` 수정**: 
    - `applyTemplateStructure`에서 후면 이미지 감지 시 프롬프트를 교체하는 정규식을 `EITHER Back View OR Side Profile` 패턴에 맞게 수정.
    - 특정 슬롯(`slotIdx === 2`)에만 국한되지 않고, 해당 텍스트를 포함한 모든 슬롯에 적용되도록 범위를 넓힘 (3색상 대응).
    - 교체되는 프롬프트에 `MANDATORY` 키워드를 추가하여 AI가 후면 참조 이미지를 반드시 따르도록 강화.

### 빌드 결과

- `npx vite build` 성공 (24.32s)
- 새로운 에러 없음

---

## 5차 작업: 동적 컬러 섹션 자동 조정 기능 (2026-03-02)

### 구현 목표

사용자가 입력한 컬러 옵션 개수에 따라 색상 안내 섹션(슬롯 수)과 코디 섹션(섹션 수)을 자동으로 증감하는 기능.

### 수정 내역

- **`services/geminiService.ts` 수정**:
    - `adjustTemplateSectionsForColors()` 전처리 함수 신규 추가 (약 120줄)
    - **색상 안내 섹션** (`sec-lookbook-colors`): `imageSlots` 배열을 `colorOptions.length`에 맞춰 동적 slice/복제
    - **코디 섹션** (`sec-lookbook-styling1-c*`): 컬러 수에 맞게 섹션 제거/복제, ID·title·prompt 내 `{{COLOR_N}}` 인덱스 자동 치환
    - 1색상 시 `layoutType`을 `full-width`로, 2색상 이상 시 `grid-2`로 자동 전환
    - `applyTemplateStructure()` 내에서 `adjustTemplateSectionsForColors(template.sections, colorOptions.length)` 호출하여 전처리된 섹션 사용
    - 기존 `generateImageSlotsForLayout()` 로직도 개선: 기존 슬롯이 필요 수보다 많아도 slice하여 재사용

- **`services/templateService.ts` 변경 없음** (원본 유지, 런타임에서만 처리)

### 동작 예시

| 사용자 입력 컬러 | 색상 안내 이미지 | 코디 섹션 수 |
|:---:|:---:|:---:|
| 1개 | 1장 (full-width) | 1개 |
| 2개 | 2장 (grid-2) | 2개 |
| 3개 | 3장 (grid-2) | 3개 |
| 4개 | 4장 (grid-2, 2×2) | 4개 |
| 5개+ | N장 | N개 |

### 빌드 결과

- `npx vite build` 성공 (23.46s)
- 새로운 에러 없음

---

## 6차 작업: 레이아웃 표기 및 렌더링 수정 (2026-03-02)

### 구현 목표

UI 상에서 `grid-1` 레이아웃이 '3열'로 노출되던 문제를 '3행 그리드' 표기로 변경하고 (1열 세로에서 3행 그리드로 재수정) 렌더링 버그 수정.

### 수정 내역

- **`types.ts` 수정**: `LayoutType` 타입 유니언에 그동안 누락되어 있었던 `grid-1` 타입값 복구.
- **`components/SectionMiniMap.tsx` 수정**: 
    - `getBadgeInfo()` 내부에서 `layoutType === 'grid-1'` 인 경우, 하드코딩으로 분기하여 라벨을 '3행 그리드', 아이콘은 수평 3단 배치를 뜻하는 아이콘(`Rows3`)으로 교체하여 반환하도록 예외처리 추가.
- **`components/SettingsModal.tsx` 수정**:
    - `LAYOUT_OPTIONS` 상수 배열에 `grid-1` 1열 세로 옵션이 누락되어 있던 것을 추가하고 기존의 '1열 세로' 명칭을 '3행 그리드'로 교체.
- **`components/TemplatePreview.tsx` 수정**:
    - `renderLayout()` 내에 `case 'grid-1':` 조건문에 대한 렌더링 구현을 3단 세로 블록으로 직관적으로 표시하도록 추가 구현.

### 동작 예시

이제 섹션 미니맵, 템플릿 개별 설정 모달 등 UI 곳곳에서 '3행 그리드' 라는 레이아웃 명칭 및 아이콘이 의도한 대로 노출되며, 템플릿 미리보기 시에도 세로로 배치된 썸네일 블록을 확인할 수 있음.

### 빌드 결과

- `npx vite build` 성공
- 새로운 타입 에러 없음


## 7차 작업: 모델 설정(인종, 분위기 등) 코디 섹션 미반영 문제 수정 (2026-03-02)

### 구현 목표

사용자가 초기 설정 단계에서 선택한 모델의 인종, 무드, 모델컷 스타일(거울 셀카 등)이 코디 섹션을 포함한 이미지 생성 프롬프트에 정상적으로 반영되지 않던 문제 해결.

### 수정 내역

- **`services/templateService.ts` 수정**: 
    - 템플릿 상단에 하드코딩되어 있던 `ANONYMOUS_MODEL_STYLE` (빈 문자열) 및 `MIRROR_SELFIE_STYLE` (고정 문자열) 상수 제거.
    - 해당 상수가 쓰이던 템플릿 프롬프트 영역을 모두 `{{MODEL_SETTINGS}}` 템플릿 변수로 일괄 치환.
- **`services/geminiService.ts` 수정**:
    - `applyTemplateStructure()` 함수 내 슬롯 프롬프트 전처리 반복문에서 `buildModelDescription()` 함수를 호출하여 사용자가 선택한 모델 설정을 문자열로 획득.
    - 프롬프트 텍스트 내의 `{{MODEL_SETTINGS}}` 변수를 실제 획득한 모델 설정 문자열로 동적 치환.
    - 사용자가 모델 설정을 선택하지 않아 빈 문자열이 반환될 경우, UI상 프롬프트에 불필요한 연속 콤마(`, ,`)나 공백이 남지 않도록 정규표현식을 이용해 깔끔하게 플레이스홀더를 정리하는 예외 처리 로직 추가.

### 동작 예시

- `{{MODEL_SETTINGS}}` 변수에 의해 실제 요청 프롬프트 생성 직전에 사용자의 모델컷 설정이 메인 문장 한가운데 강력하게 결합됨.
- 예: "REAL HUMAN MODEL wearing the product, ... , East Asian / Korean model with typical Korean facial features, ..." 등 지시어 누락 현상 수정 완료.

### 빌드 결과

- `npm run build` 성공 (0 에러)
