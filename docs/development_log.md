# 개발 내역 및 버그 수정 로그

## 일시: 2026-03-02

### 1. 템플릿 가시성 문제 해결
- **문제**: `services/templateService.ts`에서 `getTemplates` 함수가 빌트인 템플릿 중 `FASHION_MIRROR_SELFIE_TEMPLATE` (거울 셀카 룩북)을 포함하지 않아 UI에서 보이지 않던 문제.
- **해결**: `builtInTemplates` 배열에 해당 템플릿 상수를 추가하여 가시성 확보.
- **수정 파일**: `services/templateService.ts`

### 2. 기본 템플릿 설정
- **문제**: 상품 업로드 단계에서 템플릿이 기본으로 선택되어 있지 않아 사용자가 매번 선택해야 하는 번거로움.
- **해결**: `StepUpload` 컴포넌트의 `selectedTemplateId` 상태 초기값을 "패션아이템 상세(얼굴익명)" (`tpl-fashion-lookbook-preset`)으로 설정.
- **수정 파일**: `components/StepUpload.tsx`

### 3. 기타 개선 사항
- "거울 셀카" 템플릿 프롬프트에서 거울이 직접적으로 보이지 않아도 자연스러운 연출이 가능하도록 프롬프트 문구 조정 확인 (이전 단계에서 이미 반영됨).
- "패션아이템 상세(얼굴익명)" 템플릿의 가시성 확보 및 시스템 기본값 적용.
