# 컬러 섹션 동적 조정 버그 수정 및 코디 이미지 최적화 로그

## 일시
2026-03-02

## 사용자 프롬프트
> 다음 사항이 아직 수정안된것같습니다 다시 문제를 자세히 확인하고 수정 개선 계획을 수립하세요
> 1. 상품정보에 컬러옵션을 3가지로 했으나 이에따라 템플릿에 컬러소개 섹션에 3가지 이미지가 생성되어야 하지만 2 컬러만 생성됨.
> 2. 컬러별 코디 섹션에 생성된 이미지가 너무 비공간 여백이 많습니다 가능한 상품을 좀더 포커스한 이미지로 생성되도록 상업적인 쇼핑몰 이미지로 최적화 된 이미지에 최적화 되도록 검토하세요

## 문제 1: 컬러 소개 섹션 2개만 생성되는 버그

### 원인
- `adjustTemplateSectionsForColors` 함수에서 슬롯을 3개로 올바르게 조정하지만, `layoutType`을 `grid-2`로 유지
- `generateImageSlotsForLayout`에서 `getImageSlotCountForLayout('grid-2')` = 2 반환
- `existingSlots.slice(0, 2)`로 다시 2개로 잘라버리는 충돌 발생

### 수정 내용
**`services/geminiService.ts`** — `adjustTemplateSectionsForColors` 함수 (line 656-666):
- 컬러 1개 → `full-width`
- 컬러 2개 → `grid-2`
- 컬러 3개 → `grid-3` (NEW)
- 컬러 4개 이상 → `grid-1` (유동 그리드, NEW)

## 문제 2: 코디 이미지 여백 과다

### 원인
- 프롬프트에 `FULL BODY shot`, `walking`, `sitting at cafe table` 등 넓은 화면/배경 지시어 사용
- 상품 비중이 낮고 배경이 과도하게 넓은 이미지 생성

### 수정 내용
**`services/templateService.ts`** — 코디 섹션 프롬프트 전면 교체:

| 변경 전 | 변경 후 |
|---------|---------|
| `FULL BODY shot` | `WAIST-UP PRODUCT-FOCUSED shot` |
| `european street fashion` | `clean softly blurred background` |
| `sitting at a cafe table` | `natural relaxed pose, product fills 70%` |
| `FULL BODY 3/4 angle shot` | `WAIST-UP PRODUCT-FOCUSED shot` |

추가된 상업 최적화 키워드:
```
COMMERCIAL E-COMMERCE optimized: product fills 65-80% of frame,
tight crop, shallow depth of field, clean blurred background,
professional studio-quality lighting on garment
```

### 영향 범위
- `sec-lookbook-styling1-c1` (COLOR_1 코디) — 3개 슬롯 프롬프트
- `sec-lookbook-styling1-c2` (COLOR_2 코디) — 3개 슬롯 프롬프트
- `sec-lookbook-styling1-c3` (COLOR_3 코디) — 3개 슬롯 프롬프트
- `sec-lookbook-styling2` (라이프스타일 코디) — 3개 슬롯 프롬프트

## 이전 관련 버그 수정 (같은 세션)
## 문제 3: 거울셀카 설정 시 거울이 직접 보이는 이미지 생성

### 원인
- `buildModelDescription` 함수의 `cutStyleMap`에서 `mirror_selfie` 프롬프트가 다음과 같이 정의:
  - `"Taking a MIRROR SELFIE with smartphone covering the face. Full body visible in a full-length mirror."`
  - 거울과 스마트폰을 직접적으로 지시하여 이미지에 거울 프레임이 노출됨

### 수정 내용
**`services/geminiService.ts`** — `buildModelDescription` 함수 (line 595):

| 변경 전 | 변경 후 |
|---------|---------|
| `Taking a MIRROR SELFIE with smartphone covering the face` | `Casual SELFIE-STYLE photo angle as if taken by the model` |
| `Full body visible in a full-length mirror` | `Camera at slightly elevated arm-length angle` |
| (없음) | `NO mirror visible, NO phone visible, NO reflection` |
| (없음) | `Clean simple background with soft bokeh` |
| (없음) | `Commercial e-commerce quality with focus on outfit fit` |
