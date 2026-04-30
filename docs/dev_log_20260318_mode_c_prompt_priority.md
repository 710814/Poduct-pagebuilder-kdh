# 개발 로그: 모드 C 추가 요청사항 최우선 적용

## 날짜
2026년 3월 18일

## 수정 사항
- **대상 파일**: `services/geminiService.ts`
- **수정 내용**: 모드 C(이미지 고도화)의 프롬프트 템플릿(`ENHANCEMENT_PROMPT_TEMPLATES`)을 수정하여 사용자의 '추가 요청사항(선택)' 입력값이 가장 높은 우선순위로 적용되도록 변경했습니다.
- **수정 상세**:
  - 기존에는 `options.customPrompt` 값을 프롬프트의 맨 마지막 줄에 단순히 덧붙이는 형태였습니다.
  - 수정 후, `options.customPrompt` 값이 존재할 경우 프롬프트 시작 부분에 최고 우선순위 지시어(`## 🚨 HIGHEST PRIORITY USER DIRECTIVE (MUST FOLLOW OVER ALL OTHER STYLING):`) 형식으로 삽입하여, AI 파운데이션 모델이 해당 내용을 최우선적으로 따르도록 강화했습니다.
  - `background_change`, `model_shot`, `lifestyle`, `multi_angle`, `remove_bg` 전체 고도화 타입에 적용되었습니다.

## 목적
- 사용자가 원하는 특정 스타일이나 디테일(ex: 밝은 분위기 등)을 AI가 기본 디폴트 프롬프트에 묻히지 않고 우선적으로 생성 결과물에 적용하도록 개선.
