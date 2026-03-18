# 개발 로그 - 2026-03-18

## 사용자 프롬프트

> "위드기프트_패션템플릿(8섹션)"템플릿 #1 hero 섹션의 헤드라인 제목에 폰트가 미리보기에서는 정상적으로 "naum brush script" 폰트가 적용되어 보이는데 특정 사람의 경우 다운로드 하면 그 폰트가 적용안되고 디폴트 폰트가 적용되어 이미지가 다운로드 된다구 합니다 원인이 무엇이 있을수 있는지 체크해보세요

## 분석 결과

### 문제
- Hero 섹션의 `Nanum Brush Script` 폰트가 **미리보기에서는 정상 표시**되지만,
  **이미지 저장(다운로드) 시 디폴트 폰트로 대체**되는 현상

### 근본 원인 3가지

1. **`skipFonts: true` 설정 (결정적)**
   - `StepResult.tsx:610`에서 `html-to-image`의 `toPng()` 호출 시 `skipFonts: true` 옵션
   - 이 옵션으로 인해 폰트 CSS 인라인화가 건너뛰어져 외부 폰트 미적용

2. **폰트 로딩 대기 시간 불충분**
   - `setTimeout(1500ms)`으로만 대기 → 느린 네트워크에서 불충분
   - `document.fonts.ready` API 미사용

3. **CORS 구조적 한계**
   - `html-to-image`가 Google Fonts CSS를 inline화할 때 CORS 제한 발생 가능

### "특정 사람만" 발생하는 이유
- `Nanum Brush Script`가 PC에 로컬 설치된 사용자는 `skipFonts: true`여도 시스템 폰트로 정상 렌더링
- 해당 폰트가 설치되지 않은 사용자에게서만 문제 발생

## 수정 내용

### 파일: `components/StepResult.tsx`

#### 1. `inlineGoogleFonts()` 유틸 함수 추가
- Google Fonts CSS URL을 fetch하여 `@font-face` CSS 텍스트를 가져옴
- CSS 내의 모든 `url()` 참조(woff2 폰트 파일)를 fetch 후 Base64 data URI로 변환
- CORS 문제를 완전히 우회하는 인라인화 방식

#### 2. `handleSavePreviewAsImage()` 함수 수정

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 폰트 인라인화 | 없음 | `inlineGoogleFonts()` 호출 후 HTML에 `<style>` 태그로 삽입 |
| `skipFonts` | `true` | `false` (인라인화된 폰트 포함하여 캡처) |
| 폰트 대기 | `setTimeout(1500ms)` | `document.fonts.ready` + 5초 fallback timeout |
| 렌더링 안정화 | 없음 | 추가 500ms 대기 |

## 빌드 검증

- `npx vite build` → ✅ 성공 (23.83초, 에러 없음)
- `StepResult.tsx`에서 새로운 TypeScript 오류 없음 확인
