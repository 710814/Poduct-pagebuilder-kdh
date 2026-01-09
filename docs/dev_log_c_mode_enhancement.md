# C모드(이미지 고도화) 기능 개발 로그

## 📅 2026-01-09

### 🆕 C모드 재정의: 이미지 고도화 모드

**목적**: 기존 C모드(외국어 텍스트 번역/제거)를 **상품 이미지 고도화 모드**로 재정의

#### 사용자 문제점
- 초보/비전문가 사용자가 제공하는 상품 이미지의 품질 부실
- 배경 처리, 모델컷 생성 등 전문적인 이미지 작업 필요
- 상세페이지 생성 전에 원본 이미지를 보완할 도구 필요

#### 구현된 기능
1. **배경 바꾸기** - 상품에 멋진 배경 추가 (화이트 스튜디오, 자연, 도시, 카페 등)
2. **모델 착용샷** - 모델이 상품을 착용한 이미지 생성 (성별/연령대 선택 가능)
3. **라이프스타일 연출** - 실제 사용 환경에서의 모습
4. **다양한 앵글** - 정면/측면/뒷면 등 다양한 각도 이미지

---

### 📁 변경된 파일

#### 신규 파일
| 파일 | 설명 |
|------|------|
| `components/StepImageEnhancement.tsx` | C모드 메인 UI - 이미지 업로드, 고도화 옵션 선택 |
| `components/ImageEnhancementResult.tsx` | C모드 결과 화면 - 원본/결과 비교, 다운로드 |

#### 수정된 파일
| 파일 | 변경 내용 |
|------|----------|
| `types.ts` | `ImageEnhancementType`, `BackgroundType`, `ImageEnhancementOptions`, `ImageEnhancementResult` 타입 추가 |
| `components/StepModeSelection.tsx` | 2컬럼 레이아웃으로 변경, C모드 버튼 추가 |
| `services/geminiService.ts` | `enhanceProductImage` 함수 추가 |
| `App.tsx` | C모드 워크플로우 연결 및 컴포넌트 렌더링 |

---

### 💡 기술적 구현 세부사항

#### 1. 타입 정의 (types.ts)
```typescript
export type ImageEnhancementType =
  | 'background_change'  // 배경 변경
  | 'model_shot'         // 모델컷 생성
  | 'lifestyle'          // 라이프스타일 연출
  | 'multi_angle'        // 다양한 앵글
  | 'remove_bg';         // 누끼 따기

export type BackgroundType =
  | 'studio_white' | 'studio_gray' | 'nature' 
  | 'city' | 'cafe' | 'home' | 'abstract' | 'custom';
```

#### 2. 이미지 고도화 흐름
1. 사용자가 상품 이미지 업로드
2. 고도화 유형 선택 (배경 변경, 모델컷 등)
3. 세부 옵션 설정 (배경 종류, 모델 설정 등)
4. AI가 상품 분석 → 프롬프트 생성 → 이미지 생성
5. 결과 표시 및 다운로드

#### 3. 핵심 함수 (geminiService.ts)
```typescript
export const enhanceProductImage = async (
  base64Image: string,
  mimeType: string,
  options: ImageEnhancementOptions,
  onProgress?: (step: string, message: string) => void
): Promise<string>
```

---

### 🎨 UI/UX 특징

- **비전문가 친화적**: 전문 용어 대신 쉬운 한글 설명
- **원클릭 생성**: 복잡한 설정 없이 바로 결과물 제공
- **배경 프리셋**: 자주 사용하는 배경 옵션 제공
- **실시간 진행 표시**: 로딩 중 단계별 진행 상태 표시
- **결과 비교**: 원본/결과 이미지 나란히 비교 가능

---

### 📌 사용자 프롬프트 기록

```
이 프로젝트는 상품정보 (이미지, 텍스트 등)을 제공하여 상세페이지를 기획 생성하는 
프로젝트입니다. 그런데 사용자 측면에서 최초 제공되는 상품정보 특히 상품이미지의 
부실과 부족함이 있습니다. 그래서 이 프로젝트 워크플로워에 상세페이지 생성을 하는 
a모드와 별개로 이미지수정하는 c모드를 이미지생성 모드로 성격을 규정하고 최초 
상품이미지의 고도화 즉 상품배경 추가, 모델컷 생성 등의 상품 기본 이미지 생성하는 
모드로 사용하고 싶습니다 이를 위해 당신의 생각과 제안을 듣고 싶습니다 특히 
사용자가 비전문가이고 초보다라는 점을 감안해 ui ux는 잘 고려를 해보세요 
먼저 계획을 수립하세요
```
