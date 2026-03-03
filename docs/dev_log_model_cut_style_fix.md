# 후면 코디컷 조건부 생성 수정 (2026-03-03 11:24)

## 문제
- 상품 이미지 등록 시 후면(뒷면) 이미지로 태그한 이미지가 없는데도 컬러별 코디컷 3장 생성 시 후면 코디컷이 생성됨
- 후면 코디컷은 후면 이미지가 등록된 경우에만 생성되어야 함 (필수가 아님)

## 원인
- `templateService.ts`의 3번째 슬롯 프롬프트에 `EITHER Back View OR Side Profile based on reference context: IF reference shows back design -> Generate BACK VIEW...` 조건이 항상 포함
- `geminiService.ts`의 `hasBackImage` 체크는 후면 이미지가 **있을 때**만 '강제 BACK VIEW 교체'를 수행하고, **없을 때**는 원본 프롬프트를 유지하여 AI가 조건 분기를 해석하여 BACK VIEW를 생성

## 수정
- `geminiService.ts`의 `applyTemplateStructure()` 함수에서:
  - 후면 이미지 **있음** → 기존 동작: `BACK VIEW ONLY` 강제 적용
  - 후면 이미지 **없음** (새 로직) → `EITHER Back View OR Side Profile...` 프롬프트를 `PRODUCT-FOCUSED WAIST-UP shot, 3/4 angle view showing the front, DO NOT show back view`로 교체

---

# 모델컷 스타일 옵션 미적용 버그 수정 개발 로그

## 날짜: 2026-03-03

## 사용자 보고 문제
- **증상**: 모델 설정에서 모델컷 스타일 옵션 (기본/얼굴 노출/얼굴 비노출/거울 셀카)을 선택해도 생성되는 이미지에 반영되지 않음
- **특히**: "거울 셀카" 옵션은 전혀 적용되지 않음

## 근본 원인 분석

### 원인 1: 프롬프트 내 촬영 지시 충돌 (가장 핵심)
- `buildModelDescription()` 함수가 모델컷 스타일을 텍스트로 변환하여 `{{MODEL_SETTINGS}}` 플레이스홀더에 삽입
- 그러나 이 텍스트가 슬롯 프롬프트의 기존 촬영 지시 (예: "WAIST-UP PRODUCT-FOCUSED shot")와 직접 충돌
- AI가 더 구체적인 기존 촬영 지시를 우선시하여 모델컷 스타일 무시

### 원인 2: 이중 적용
- `applyTemplateStructure()`에서 `{{MODEL_SETTINGS}}`로 한번 삽입
- `generateSectionImage()`에서 `## MODEL APPEARANCE` 섹션으로 다시 한번 삽입
- 모델컷 스타일 지시가 프롬프트의 다른 촬영 지시와 혼합되어 효과 감소

### 원인 3: 거울셀카 프롬프트 약함
- 기존: "Casual SELFIE-STYLE photo angle" (약한 표현)
- 기존 슬롯의 "WAIST-UP PRODUCT-FOCUSED shot" (강한 표현)에 의해 덮어써짐

## 수정 내용

### 파일: `services/geminiService.ts`

#### 1. 함수 분리 (line 531-665)
- `buildModelDescription()` → 3개 함수로 분리:
  - `buildModelAppearanceDescription()`: 인종, 성별, 연령, 헤어, 분위기 (외모만)
  - `buildModelCutStyleDirective()`: 모델컷 스타일을 최상위 OVERRIDE 지시로 변환 (촬영 지시)
  - `buildModelDescription()`: 기존 호환성 유지 (두 함수 조합)

#### 2. `applyTemplateStructure()` 슬롯 프롬프트 교체 (line 798-835)
- 모델컷 스타일에 따라 슬롯 프롬프트의 기존 촬영 앵글 지시를 교체:
  - `mirror_selfie`: "WAIST-UP PRODUCT-FOCUSED shot" → "SELFIE-STYLE ANGLE shot" 등
  - `face_visible`: "Face CROPPED at NOSE level" → "FULL FACE VISIBLE"
- `{{MODEL_SETTINGS}}`에는 외모 정보만 삽입 (모델컷 스타일 제외)

#### 3. `generateSectionImage()` OVERRIDE 섹션 분리 (line 2087-2157)
- `buildModelCutStyleDirective()`를 프롬프트 최상단에 `## ⚠️ CAMERA ANGLE OVERRIDE` 섹션으로 배치
- `## MODEL APPEARANCE` 섹션에는 외모 정보만 포함 (이중 적용 방지)
- `## FINAL CHECK`에 카메라 앵글 검증 항목 추가

#### 4. `enhanceProductImage()` C모드 분리 적용 (line 2462-2480)
- `buildModelDescription()` 대신 `buildModelAppearanceDescription()` + `buildModelCutStyleDirective()` 사용
- `ENHANCEMENT_PROMPT_TEMPLATES.model_shot`에 모델컷 스타일 지시 파라미터 추가

#### 5. 거울셀카 전용 프롬프트 강화
```
## ⚠️ CAMERA ANGLE OVERRIDE (CRITICAL - OVERRIDES ALL OTHER ANGLE/FRAMING INSTRUCTIONS):
This photo MUST look like a casual SELFIE taken by the person themselves, NOT a professional studio shot.
- CAMERA POSITION: slightly elevated, at arm's length distance (approximately 60-80cm from face)
- The person appears to be holding an invisible smartphone with one hand
- SELFIE ANGLE: slightly looking up toward the camera, natural selfie perspective with mild foreshortening
- POSE: relaxed, casual, natural — as if quickly checking their outfit before going out
- Face CROPPED at nose level, NO eyes visible (maintain anonymity)
- Background: clean, simple, with soft natural bokeh — like a bedroom, hallway, or fitting room
- NO mirror reflection visible, NO phone visible, NO selfie stick
- IMPORTANT: Ignore any conflicting framing instructions like "WAIST-UP shot" or "UPPER BODY CLOSE-UP" — the selfie angle takes priority
```

## 검증 방법
1. 브라우저 콘솔에서 로그 확인:
   - `[applyTemplateStructure] ★ 거울셀카: 슬롯 N 촬영 지시 → 셀카 앵글로 교체`
   - `[generateSectionImage] 모델컷 스타일: mirror_selfie`
2. 실제 이미지 생성 후 셀카 앵글 / 얼굴 노출 / 얼굴 비노출 반영 확인
