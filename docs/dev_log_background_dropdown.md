# 개발 로그: 이미지 배경 선택 드롭다운 UI 추가

## 날짜
2026-01-09

## 사용자 프롬프트
> 상세페이지 기획안 검토 페이지 섹션별 이미지 생성 후 마우스 호버시 개별이미지의 "수정"버튼 클릭시 첨부 이미지 같은 프롬프트 수정 모달이 보입니다. 이 모달 창에 이미지 배경선택 드롭다운 ui를 추가해주세요. 이 드롭다운 메뉴에는 "자연배경, 도시스트리트, 카페, 공항, 오피스" 배경을 선택하게 해주세요 그리고 이 선택한 배경정보를 프롬프트에 추가해서 이미지 수정 생성시 적용되도록 해주세요

## 구현 내용

### 1. 상태 타입 확장
`editPromptModal` 상태에 `backgroundType` 필드 추가:

```typescript
const [editPromptModal, setEditPromptModal] = useState<{
  sectionId: string;
  prompt: string;
  backgroundType: string;  // 배경 선택 옵션
} | null>(null);
```

### 2. 배경 옵션 상수 정의
6가지 배경 옵션 정의 (기본 포함):

```typescript
const backgroundOptions = [
  { value: 'original', label: '배경 유지 (기본)', promptSuffix: '' },
  { value: 'nature', label: '자연 배경', promptSuffix: ', natural outdoor background with greenery, trees, and soft natural sunlight' },
  { value: 'city_street', label: '도시 스트리트', promptSuffix: ', urban city street background with modern buildings and trendy urban atmosphere' },
  { value: 'cafe', label: '카페', promptSuffix: ', cozy cafe interior background with warm ambient lighting and coffee shop atmosphere' },
  { value: 'airport', label: '공항', promptSuffix: ', modern airport terminal background with bright natural lighting and travel atmosphere' },
  { value: 'office', label: '오피스', promptSuffix: ', professional modern office interior background with clean workspace aesthetic' },
];
```

### 3. 핸들러 함수 수정

#### `handleOpenEditPrompt`
- 모달 열 때 `backgroundType` 기본값을 `'original'`로 설정

#### `handleConfirmEditPrompt`
- 선택한 배경 옵션에 따라 프롬프트 끝에 배경 설명 자동 추가
- 콘솔 로그로 배경 선택 및 최종 프롬프트 확인 가능

### 4. 모달 UI 추가
- 프롬프트 입력 영역과 팁 사이에 배경 선택 드롭다운 추가
- `ImageIcon` 아이콘으로 라벨 시각화
- 배경 선택 시 안내 메시지 표시 ("선택한 배경 스타일이 프롬프트에 자동 적용됩니다.")

## 수정된 파일
- `components/StepAnalysis.tsx`

## 빌드 검증
- ✅ `npm run build` 성공 (23.58s)
- 에러 없음

## 테스트 방법
1. 상세페이지 기획안 검토 화면 접속
2. 이미지가 있는 섹션에서 마우스 호버
3. "수정" 버튼 클릭
4. 프롬프트 수정 모달에서 배경 선택 드롭다운 확인
5. 원하는 배경 선택 후 "이미지 재생성" 클릭
6. 콘솔에서 `[EditPrompt]` 로그로 배경 적용 확인
