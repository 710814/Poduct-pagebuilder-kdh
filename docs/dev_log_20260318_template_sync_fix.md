# 개발 로그: 템플릿 동기화 문제 해결

- **날짜**: 2026-03-18
- **작업자**: AI Assistant

## 사용자 프롬프트

> "위드기프트_패션템플릿(8섹션)" 템플릿에 #7 spec 섹션의 유형을 변경하고 템플릿이 변경되었는데 다른 컴퓨터를 사용하는 사람의 경우 템플릿이 수정이 안되어 보인다고 하는데 이럴때 어떻게 하면될까?
> 첨부이미지 같이 섹션타입을 스팩사양 타입으로 변경하고 싶다

## 문제 원인

- 빌트인 템플릿 수정 시, 변경사항이 해당 사용자의 **브라우저 localStorage**에만 저장됨
- 다른 컴퓨터/브라우저에서는 소스코드의 원본 빌트인 템플릿이 그대로 표시
- `getTemplates()` 함수가 localStorage에 `updatedAt`이 있는 수정본을 우선 사용하는 구조

## 수정 내용

### 파일: `services/templateService.ts`

**Section 7 (제품 정보)** 의 `layoutType` 변경:

```diff
- layoutType: 'text-only' as LayoutType,
+ layoutType: 'full-width' as LayoutType,
```

- `sectionType`: `spec` (스펙/사양) — 이미 올바르게 설정되어 있었음
- `layoutType`: `text-only` → `full-width` (전체 너비) 로 변경

## 빌드 결과

- `npm run build` 성공
- 재배포 후 모든 사용자에게 변경사항이 반영됨
