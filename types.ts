export enum AppMode {
  CREATION = 'CREATION', // Mode A: New Creation from Image
  LOCALIZATION = 'LOCALIZATION', // Mode B: Localization/Reconstruction
  IMAGE_EDIT = 'IMAGE_EDIT', // Mode C: Image Enhancement (Background, Model Shot, etc.)
}

// ============================================
// 이미지 고도화 타입 (Image Enhancement Types)
// ============================================

/**
 * 이미지 고도화 유형
 */
export type ImageEnhancementType =
  | 'background_change'  // 배경 변경
  | 'model_shot'         // 모델컷 생성
  | 'lifestyle'          // 라이프스타일 연출
  | 'multi_angle'        // 다양한 앵글
  | 'remove_bg';         // 누끼 따기 (배경 제거)

/**
 * 배경 유형
 */
export type BackgroundType =
  | 'studio_white'       // 화이트 스튜디오
  | 'studio_gray'        // 그레이 스튜디오
  | 'nature'             // 자연 배경
  | 'city'               // 도시 배경
  | 'cafe'               // 카페 배경
  | 'home'               // 홈 인테리어
  | 'abstract'           // 추상적 배경
  | 'custom';            // 사용자 정의

/**
 * 이미지 고도화 옵션
 */
export interface ImageEnhancementOptions {
  type: ImageEnhancementType;
  backgroundType?: BackgroundType;
  modelSettings?: ModelSettings;  // 기존 타입 재사용
  customPrompt?: string;
  generateCount?: number;  // 생성할 이미지 수 (기본 1)
}

/**
 * 이미지 고도화 결과
 */
export interface ImageEnhancementResult {
  id: string;
  originalImageUrl: string;
  enhancedImageUrl: string;
  type: ImageEnhancementType;
  prompt: string;
  createdAt: number;
}

export enum Step {
  SELECT_MODE = 0,
  UPLOAD_DATA = 1,
  ANALYSIS_REVIEW = 2,
  GENERATING = 3,
  RESULT = 4,
}

// ============================================
// 템플릿 시스템 타입 (Template System Types)
// ============================================

/**
 * 섹션 타입 - 섹션의 역할/목적을 정의
 */
export type SectionType =
  | 'title'           // 타이틀/상품명
  | 'hero'            // 메인 비주얼
  | 'description'     // 상품 설명
  | 'colors'          // 색상 옵션
  | 'material_detail' // 소재 상세
  | 'styling'         // 스타일링 제안
  | 'fit'             // 핏/사이즈
  | 'spec'            // 스펙/사양
  | 'notice'          // 안내/주의사항
  | 'custom';         // 사용자 정의

/**
 * 이미지 슬롯 타입 - 이미지의 유형/목적을 정의
 */
export type ImageSlotType =
  | 'hero'            // 대표 이미지
  | 'product'         // 상품 이미지
  | 'detail'          // 디테일 클로즈업
  | 'material'        // 소재/텍스처
  | 'color_styling'   // 색상/스타일링
  | 'fit'             // 착용/핏
  | 'spec'            // 스펙 도표
  | 'notice'          // 안내 이미지
  | 'custom';         // 사용자 정의

/**
 * 레이아웃 타입
 */
export type LayoutType =
  | 'full-width'      // 전체 너비 이미지
  | 'split-left'      // 좌측 이미지 + 우측 텍스트
  | 'split-right'     // 우측 이미지 + 좌측 텍스트
  | 'grid-1'          // 1열 세로 그리드 (수직 배치)
  | 'grid-2'          // 2열 그리드
  | 'grid-3'          // 3열 그리드
  | 'text-only'       // 텍스트만
  | 'image-only'      // 이미지만
  // ★ 콜라주 레이아웃 (AI가 1장의 이미지로 생성)
  | 'collage-1-2'     // 위 1장 + 아래 2장
  | 'collage-2-1'     // 위 2장 + 아래 1장
  | 'collage-1-3'     // 위 1장 + 아래 3장
  | 'collage-2x2';    // 2×2 그리드 콜라주

/**
 * 이미지 슬롯 - 섹션 내 개별 이미지 정보
 */
export interface ImageSlot {
  id: string;
  slotType: ImageSlotType;          // 이미지 유형
  prompt: string;                    // AI 이미지 생성 프롬프트
  photographyStyle?: 'full-body' | 'close-up' | 'flat-lay' | 'lifestyle' | 'studio' | 'coordination' | 'diagram';  // 촬영 스타일
  aspectRatio?: 'square' | 'portrait' | 'landscape' | 'wide';  // 이미지 비율
  imageUrl?: string;                 // 생성된 이미지 URL (일관성 위해 추가)
  generatedImageUrl?: string;        // 생성된 이미지 URL (deprecated, use imageUrl)
  fixedImageBase64?: string;         // 고정 이미지 (Base64)
  fixedImageMimeType?: string;       // 고정 이미지 MIME 타입
  useFixedImage?: boolean;           // 고정 이미지 사용 여부
  // 이미지 크롭/줌 설정
  cropZoom?: number;                 // 저장된 확대 배율 (기본 1)
  cropPanX?: number;                 // 저장된 X축 이동 (기본 0)
  cropPanY?: number;                 // 저장된 Y축 이동 (기본 0)
}

/**
 * 섹션 데이터 - 상세페이지의 각 섹션 정보
 */
export interface SectionData {
  id: string;
  title: string;
  content: string;

  // ★ 새로운 템플릿 구조
  sectionType?: SectionType;         // 섹션 타입
  imageSlots?: ImageSlot[];          // 다중 이미지 슬롯
  layoutType?: LayoutType;           // 레이아웃 타입

  // === 기존 필드 (하위 호환성 유지) ===
  imagePrompt: string;               // 기존 단일 프롬프트
  imageUrl?: string;                 // 생성된/원본 이미지 URL
  isOriginalImage?: boolean;         // 원본 이미지 유지 여부
  isPreview?: boolean;               // 미리보기 이미지 여부

  // 템플릿 고정 요소 (기존)
  fixedText?: string;                // 고정 문구
  fixedImageBase64?: string;         // 고정 이미지 Base64
  fixedImageMimeType?: string;       // 고정 이미지 MIME
  useFixedImage?: boolean;           // 고정 이미지 사용 여부
  isUploadOnly?: boolean;            // 업로드 전용 섹션 (AI 생성 없이 사용자 직접 업로드)

  // 단일 이미지 크롭/줌 설정
  cropZoom?: number;                 // 저장된 확대 배율 (기본 1)
  cropPanX?: number;                 // 저장된 X축 이동 (기본 0)
  cropPanY?: number;                 // 저장된 Y축 이동 (기본 0)
}

export interface ProductAnalysis {
  productName: string;
  productVisualDescription?: string;  // AI가 추출한 상품 시각적 설명 (이미지 프롬프트용)
  mainFeatures: string[];
  marketingCopy: string;
  sections: SectionData[];
  detectedCategory?: string;
  showIntroSection?: boolean;         // 인트로 섹션(상품명, 마케팅카피, 특징) 표시 여부 (기본값: true)
}

/**
 * 템플릿 - 재사용 가능한 상세페이지 구조
 */
export interface Template {
  id: string;
  name: string;
  description?: string;
  sections: SectionData[];           // 섹션 구조
  createdAt: number;

  // ★ 새로운 필드
  updatedAt?: number;                // 수정 시간 (빌트인 동기화 체크용)
  category?: string;                 // 템플릿 카테고리 (fashion, beauty 등)
  sourceImageThumbnail?: string;     // 원본 참조 이미지 썸네일 (선택)
  isBuiltin?: boolean;               // 빌트인 템플릿 여부 (압축 대상 등 식별용)
}

/**
 * 섹션 프리셋 - 자주 사용하는 섹션 설정을 저장
 * 예: 배송/반품 안내, 스펙 정보, AS 안내 등
 */
export interface SectionPreset {
  id: string;
  name: string;                      // 프리셋 이름 (예: "배송/반품 안내")
  description?: string;              // 설명
  sectionType: SectionType;          // 섹션 타입
  layoutType: LayoutType;            // 레이아웃 타입
  slotCount: number;                 // 이미지 슬롯 수
  fixedText?: string;                // 고정 문구
  fixedImageBase64?: string;         // 고정 이미지 (Base64)
  fixedImageMimeType?: string;       // 고정 이미지 MIME 타입
  createdAt: number;
}

export interface UploadedFile {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
  role?: 'front' | 'back' | 'detail';  // 이미지 역할 (정면/후면/디테일)
}

/**
 * 컬러 옵션 - 색상별 상품 이미지 그룹
 */
export interface ColorOption {
  id: string;
  colorName: string;           // 색상명 (예: "와인", "베이지", "그레이")
  hexCode?: string;            // 색상 코드 (선택, 예: "#8B0000")
  images: UploadedFile[];      // 해당 색상의 상품 이미지들
  autoExtractedHex?: string;   // 자동 추출된 원본 HEX (사용자 수정 전)
  extractionConfidence?: number; // 색상 추출 신뢰도 (0-1)
}

/**
 * AI 이미지 생성 시 모델(인물) 설정
 * - 모든 필드 선택사항
 */
export interface ModelSettings {
  ethnicity?: 'asian' | 'western' | 'any';  // 동양인/서양인/무관
  ageRange?: 'teens' | '20s' | '30s' | '40s' | '50s+' | 'any';  // 연령대
  gender?: 'female' | 'male' | 'any';  // 성별
  hairStyle?: string;  // 헤어 스타일 (예: "단발", "긴 생머리", "웨이브")
  mood?: 'sexy' | 'elegant' | 'innocent' | 'casual' | 'sporty';  // 분위기/무드
  modelCutStyle?: 'face_visible' | 'face_anonymous' | 'mirror_selfie';  // 모델컷 스타일
}

/**
 * 첫 단계에서 수집하는 상품 기본 정보
 * - 모든 필드 선택사항 (기존 이미지만 업로드도 가능)
 */
export interface ProductInputData {
  productName?: string;        // 상품명 (선택)
  price?: number;              // 가격 (선택)
  discountRate?: number;       // 할인율 % (선택)
  productFeatures?: string;    // 상품 특징 (선택) - 줄바꿈으로 구분
  colorOptions: ColorOption[]; // 컬러별 이미지 (선택)
  mainImages: UploadedFile[];  // 컬러 구분 없는 메인 이미지
  selectedTemplateId?: string; // 선택된 템플릿 ID
  modelSettings?: ModelSettings; // 모델(인물) 설정 (선택)
}