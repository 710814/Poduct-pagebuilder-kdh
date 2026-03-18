import { AppMode, ProductAnalysis, SectionData, Template, ProductInputData } from "../types";
import { getGasUrl, DEFAULT_GAS_URL } from "./googleSheetService";
import { getCategoryPromptGuidelines } from "./categoryPresets";
import type {
  GeminiRequest,
  GeminiResponse,
  GeminiPart,
  GeminiInlineDataPart,
  GeminiTextPart,
  GeminiGenerationConfig,
  GeminiSafetySettings
} from "../types/gemini";

// 보안 강화: API 키는 GAS 프록시를 통해 서버 사이드에서만 사용
// 클라이언트에서는 직접 API 키를 사용하지 않음

const MODEL_TEXT_VISION = 'gemini-2.5-flash';
const MODEL_IMAGE_GEN = 'gemini-2.5-flash-image';

/**
 * 이미지 슬롯 타입별 기본 프롬프트 템플릿
 * [PRODUCT] 플레이스홀더는 실제 이미지 생성 시 원본 상품 이미지 참조로 대체됨
 */
export const IMAGE_SLOT_DEFAULT_PROMPTS: Record<string, string> = {
  hero: 'Full body product shot of [PRODUCT], clean white background, professional studio lighting, hero image style, centered composition',
  product: 'Professional product photography of [PRODUCT], clean background, high quality studio lighting, e-commerce style',
  detail: 'Extreme close-up macro shot of [PRODUCT] showing texture, stitching, and material details, high resolution, shallow depth of field',
  material: 'Close-up of [PRODUCT] fabric/material texture, showing weave pattern and quality, soft directional lighting, texture focus',
  color_styling: 'Full body shot of [PRODUCT] showcasing color and styling, lifestyle setting, coordinated styling, fashion editorial style',
  fit: 'Full body shot of model wearing/using [PRODUCT], natural pose, minimalist indoor setting, lifestyle photography, showing fit and movement',
  spec: '[PRODUCT] with measurement overlay or size reference, infographic style, clean background, size chart visualization',
  notice: 'Clean informational image related to [PRODUCT], notice/care instruction style, iconographic elements, clear and readable',
  custom: 'Professional product photography of [PRODUCT], suitable for e-commerce product detail page'
};

/**
 * 상품 일관성 유지 프롬프트 래퍼
 * 원본 상품 이미지를 참조하면서 다양한 컴포지션을 생성하도록 지시
 */
export const PRODUCT_CONSISTENCY_PROMPT = `
## CRITICAL: MAINTAIN EXACT PRODUCT VISUAL CONSISTENCY

### MANDATORY REQUIREMENTS:
1. The product's shape, color, design, texture, and ALL visual details must be IDENTICAL to the reference image
2. Do NOT modify, alter, or stylize the product itself in any way
3. The product must be clearly recognizable as the EXACT same item from the reference

### SPECIFIC DETAILS TO PRESERVE:
- Stitch lines, seam positions, and construction details
- Button/zipper count, placement, and style
- Pattern alignment, scale, and orientation
- Logo position, size, and design (if any)
- Material texture and surface finish
- Exact color shade (not just "black" but THE black from reference)
- Pocket placement and dimensions
- Collar/neckline shape
- Sleeve length and cuff style

### WHAT YOU CAN CHANGE:
- Background setting and environment
- Lighting style and direction
- Camera angle and composition
- Props and context elements
- Human model for wearable items

### FINAL CHECK:
If someone compared the product in your generated image with the reference, it should be indistinguishable - only the setting changes.
`;

/**
 * 콜라주 레이아웃 정의
 * AI에게 단일 이미지 내에 여러 구도를 배치하도록 지시
 */
export const COLLAGE_LAYOUT_CONFIGS: Record<string, {
  structure: string;
  sections: { position: string; size: string; description: string }[];
  recommendedAspectRatio?: string;
}> = {
  'collage-1-2': {
    structure: 'TOP: 1 large image (Full Width 100%, 60% height), BOTTOM: 2 equal images side by side (50% Width each, 40% height)',
    sections: [
      { position: 'TOP', size: '100% width x 60% height', description: 'Full body hero shot, spanning entire width, edge-to-edge' },
      { position: 'BOTTOM LEFT', size: '50% width x 40% height', description: 'Side profile or alternative angle' },
      { position: 'BOTTOM RIGHT', size: '50% width x 40% height', description: 'Detail shot or action pose' }
    ],
    recommendedAspectRatio: '1:1 (Square, balanced grid)'
  },
  'collage-2-1': {
    structure: 'TOP: 2 equal images side by side (40% height), BOTTOM: 1 large image (60% height)',
    sections: [
      { position: 'TOP LEFT', size: '20%', description: 'Front view or main angle' },
      { position: 'TOP RIGHT', size: '20%', description: 'Back view or alternative angle' },
      { position: 'BOTTOM', size: '60%', description: 'Full body lifestyle shot, dynamic pose' }
    ],
    recommendedAspectRatio: '1:1 (Square, balanced grid)'
  },
  'collage-1-3': {
    structure: 'TOP: 1 large image (60% height), BOTTOM: 3 equal images (40% height)',
    sections: [
      { position: 'TOP', size: '60%', description: 'Full body hero shot' },
      { position: 'BOTTOM LEFT', size: '13%', description: 'Front detail' },
      { position: 'BOTTOM CENTER', size: '13%', description: 'Side view' },
      { position: 'BOTTOM RIGHT', size: '13%', description: 'Back detail' }
    ],
    recommendedAspectRatio: '1:1 (Square)'
  },
  'collage-2x2': {
    structure: '2x2 grid of 4 equal images',
    sections: [
      { position: 'TOP LEFT', size: '25%', description: 'Front full body' },
      { position: 'TOP RIGHT', size: '25%', description: 'Side profile' },
      { position: 'BOTTOM LEFT', size: '25%', description: 'Back view' },
      { position: 'BOTTOM RIGHT', size: '25%', description: 'Detail close-up' }
    ],
    recommendedAspectRatio: '1:1 (Square, perfect grid)'
  }
};

/**
 * 콜라주 레이아웃용 프롬프트 생성
 * @param layoutType 콜라주 레이아웃 타입 (collage-1-2, collage-2-1 등)
 * @param productDescription 상품 설명 (AI 프롬프트용)
 * @param contextPrompt 추가 컨텍스트 (섹션 imagePrompt)
 * @returns 완성된 콜라주 프롬프트
 */
export const buildCollagePrompt = (
  layoutType: string,
  productDescription: string,
  contextPrompt?: string
): string => {
  const config = COLLAGE_LAYOUT_CONFIGS[layoutType];

  if (!config) {
    // 알 수 없는 레이아웃은 기본 프롬프트 반환
    return contextPrompt || `Professional product photography of ${productDescription}`;
  }

  const sectionDescriptions = config.sections
    .map(s => `- ${s.position} (${s.size}): ${s.description}`)
    .join('\n');

  return `Create a fashion product collage image with the following EXACT layout:

## ⚠️ PRODUCT IDENTITY (CRITICAL)
ALL images in this collage must show the EXACT SAME product from the reference image.
This is ONE garment photographed from different angles - NOT variations or similar items.
Every detail (stitching, buttons, pattern, texture, color) must be identical across all frames.
The product must be recognizable as the EXACT same item in every section of the collage.

## LAYOUT STRUCTURE:
${config.structure}

## SECTION DETAILS:
${sectionDescriptions}

## PRODUCT TO FEATURE:
${productDescription}

## CRITICAL REQUIREMENTS:
- All images within this collage must show the EXACT SAME product from the reference
- Create a SINGLE cohesive collage image, NOT separate images
- The layout MUST strictly follow the structure defined above
${layoutType === 'collage-1-2' ? `    - The top image MUST span the FULL WIDTH of the collage (edge-to-edge)
    - The bottom images MUST divide the width equally (50% each) with NO gap` : ''}
${layoutType === 'collage-2x2' ? `    - Create a perfect 2x2 GRID layout with 4 EQUAL sized quadrants
    - All 4 images must be the SAME SIZE` : ''}
${layoutType === 'collage-2-1' ? `    - The top section MUST be split into 2 equal images
    - The bottom image MUST span the FULL WIDTH` : ''}
    - Ensure the layout fills the entire canvas with NO whitespace or padding around the edges
    - Create a solid rectangular block of images
- Use MINIMAL borders (1-2px maximum) between sections, nearly invisible, seamless transition
- Maintain consistent lighting and color grading across ALL sections
- Professional outdoor/lifestyle brand campaign photography style
- The model's face should be fully visible with natural athletic expression
- Aspect ratio ${config.recommendedAspectRatio || '3:4 (portrait orientation)'}, ensure the final output is a perfect filled rectangle

${contextPrompt ? `## ADDITIONAL CONTEXT:\n${contextPrompt}` : ''}

High quality, 4K resolution, professional e-commerce photography.`;
};

/**
 * URL 정규화 함수 - 비교를 위해 모든 공백, 언더스코어, 하이픈 제거
 */
function normalizeUrlForComparison(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '') // 모든 공백 제거
    .replace(/_/g, '') // 언더스코어 제거
    .replace(/-/g, '') // 하이픈 제거
    .replace(/\/+/g, '/') // 연속된 슬래시 정규화
    .replace(/\/$/, ''); // 끝의 슬래시 제거
}

/**
 * GAS 프록시를 통해 Gemini API 호출
 * @param timeoutMs 타임아웃 시간 (밀리초). 기본값: 120000 (2분), 이미지 생성 시: 300000 (5분)
 */
async function callGeminiViaProxy(requestData: {
  model: string;
  contents: GeminiRequest['contents'];
  config?: GeminiGenerationConfig;
  safetySettings?: GeminiSafetySettings[];
}, timeoutMs?: number): Promise<GeminiResponse> {
  const gasUrl = getGasUrl(true);

  if (!gasUrl) {
    throw new Error('GAS URL이 설정되지 않았습니다. 설정에서 Google Apps Script URL을 입력하세요.');
  }

  // GAS 프록시 엔드포인트로 요청
  // GAS는 URL 파라미터로 action을 받음
  const proxyUrl = `${gasUrl}?action=gemini`;

  try {
    console.log('GAS 프록시 호출:', proxyUrl);
    console.log('요청 데이터:', { model: requestData.model, hasContents: !!requestData.contents });

    // GAS는 CORS preflight를 처리하지 않으므로 simple request로 보냄
    // Content-Type: text/plain으로 변경하면 preflight 없이 요청 가능
    // GAS는 여전히 e.postData.contents로 JSON을 파싱할 수 있음

    // URL 유효성 검증
    if (!gasUrl || !gasUrl.includes('script.google.com')) {
      throw new Error('GAS URL이 올바르지 않습니다. Google Apps Script 웹 앱 URL을 확인하세요.');
    }

    // 타임아웃 설정
    // 이미지 생성 모델은 더 오래 걸리므로 5분
    // 이미지 분석(텍스트 감지)도 큰 이미지나 복잡한 이미지의 경우 시간이 걸릴 수 있으므로 3분
    // 일반 텍스트 분석은 2분
    const isImageGeneration = requestData.model.includes('image') || requestData.model === MODEL_IMAGE_GEN;

    // 이미지 분석 감지: parts 배열에서 inlineData가 있는지 확인
    let hasImageData = false;
    try {
      if (requestData.contents?.parts) {
        hasImageData = requestData.contents.parts.some((p: any) => {
          return p && (p.inlineData || (typeof p === 'object' && 'inlineData' in p));
        });
      }
    } catch (e) {
      console.warn('[callGeminiViaProxy] 이미지 데이터 감지 중 오류:', e);
    }

    const isImageAnalysis = requestData.model === MODEL_TEXT_VISION && hasImageData;

    let defaultTimeout = 120000; // 기본 2분
    if (isImageGeneration) {
      defaultTimeout = 300000; // 이미지 생성: 5분
    } else if (isImageAnalysis) {
      defaultTimeout = 180000; // 이미지 분석(텍스트 감지): 3분
    }

    const timeout = timeoutMs || defaultTimeout;

    console.log('[callGeminiViaProxy] 타임아웃 설정:', {
      model: requestData.model,
      isImageGeneration,
      isImageAnalysis,
      hasImageData,
      timeoutMs,
      defaultTimeout,
      finalTimeout: timeout,
      timeoutMinutes: Math.round(timeout / 60000)
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let response: Response;
    try {
      response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          model: requestData.model,
          contents: requestData.contents,
          config: requestData.config,
          safetySettings: requestData.safetySettings
        }),
        redirect: 'follow', // GAS 리다이렉트 따라가기
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('GAS 프록시 응답 상태:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '응답을 읽을 수 없습니다');
        console.error('GAS 프록시 오류 응답:', errorText);
        throw new Error(`GAS 프록시 오류 (${response.status}): ${errorText}`);
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        const timeoutMinutes = Math.round(timeout / 60000);
        throw new Error(
          `GAS 프록시 요청이 타임아웃되었습니다 (${timeoutMinutes}분). ` +
          `이미지 생성은 시간이 오래 걸릴 수 있습니다. ` +
          `네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.`
        );
      }
      if (fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
        throw new Error('GAS 웹 앱에 연결할 수 없습니다. 다음을 확인하세요:\n1. GAS URL이 올바른지 확인\n2. GAS 웹 앱이 배포되었는지 확인\n3. 네트워크 연결 확인\n4. 브라우저 콘솔에서 자세한 오류 확인');
      }
      throw fetchError;
    }

    const result = await response.json();
    console.log('GAS 프록시 응답:', result);

    if (result.status === 'error') {
      throw new Error(result.message || 'GAS 프록시에서 오류가 발생했습니다.');
    }

    if (!result.data) {
      throw new Error('GAS 프록시 응답에 데이터가 없습니다.');
    }

    return result.data as GeminiResponse;
  } catch (error) {
    console.error('GAS 프록시 호출 실패:', error);
    throw error;
  }
}

/**
 * Helper to convert Blob/File to Base64 string without data prefix
 */
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data:image/png;base64, prefix
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * 이미지 슬롯 타입에 따른 기본 프롬프트 가져오기
 * @param slotType 이미지 슬롯 타입
 * @returns 기본 프롬프트 문자열
 */
export const getDefaultPromptForSlotType = (slotType: string): string => {
  return IMAGE_SLOT_DEFAULT_PROMPTS[slotType] || IMAGE_SLOT_DEFAULT_PROMPTS.custom;
};

/**
 * 상품 일관성을 유지하는 최종 이미지 생성 프롬프트 빌드
 * 원본 상품 이미지를 참조 이미지로 사용하면서, 섹션/슬롯 타입에 맞는 컴포지션 생성
 * 
 * @param userPrompt 사용자가 입력한 프롬프트 또는 기본 프롬프트
 * @param productName 상품명 (선택)
 * @returns 일관성 보장 프롬프트
 */
export const buildProductConsistentPrompt = (
  userPrompt: string,
  productName?: string
): string => {
  // [PRODUCT] 플레이스홀더를 상품명으로 대체 (있으면)
  let finalPrompt = userPrompt;
  if (productName) {
    finalPrompt = userPrompt.replace(/\[PRODUCT\]/gi, productName);
  } else {
    // 상품명이 없으면 "the product"로 대체
    finalPrompt = userPrompt.replace(/\[PRODUCT\]/gi, 'the product');
  }

  // 일관성 유지 지시어 추가
  return `${PRODUCT_CONSISTENCY_PROMPT}

${finalPrompt}

High quality, 4K resolution, professional e-commerce photography.`;
};

/**
 * Schema for the product analysis output (JSON Schema format for Gemini API)
 */
/**
 * 레이아웃 타입에 따른 필요 이미지 슬롯 수 계산
 */
export const getImageSlotCountForLayout = (layoutType: string): number => {
  if (layoutType.startsWith('collage-')) return 1; // 콜라주는 1개의 이미지(합성된 결과물)를 사용

  switch (layoutType) {
    case 'grid-1': return -1; // 특수값: 기존 슬롯 개수 유지 (사용자가 직접 추가/삭제 가능)
    case 'grid-2': return 2;
    case 'grid-3': return 3;
    case 'split-left':
    case 'split-right':
    case 'full-width':
    case 'image-only':
      return 1;
    case 'text-only':
      return 0;
    default:
      return 1;
  }
};

/**
 * 레이아웃 타입에 따른 이미지 슬롯 자동 생성
 */
const generateImageSlotsForLayout = (
  sectionId: string,
  layoutType: string,
  basePrompt: string,
  existingSlots?: import('../types').ImageSlot[]
): import('../types').ImageSlot[] => {
  // ★ 템플릿에서 명시적으로 슬롯을 비운 경우 (사용자 업로드 전용) → 자동 생성 안됨
  if (existingSlots && Array.isArray(existingSlots) && existingSlots.length === 0) {
    console.log(`[generateImageSlotsForLayout] 섹션 ${sectionId}: 이미지 슬롯이 명시적으로 비어있음 → 자동 생성 건너뜀 (사용자 업로드 전용)`);
    return [];
  }

  const requiredCount = getImageSlotCountForLayout(layoutType);

  if (requiredCount === 0) return [];

  // grid-1: 기존 슬롯 그대로 유지 (개수 제한 없음)
  if (requiredCount === -1 && existingSlots && existingSlots.length > 0) {
    return existingSlots;
  }

  // 기존 슬롯이 있으면 그대로 유지 (adjustTemplateSectionsForColors에서 이미 동적 조정됨)
  // ★ slice 하지 않음 — layoutType은 열 수이지 슬롯 수가 아님
  if (existingSlots && existingSlots.length > 0) {
    if (existingSlots.length >= requiredCount) {
      return existingSlots;
    }

    // 개수가 부족한 경우, 있는 건 쓰고 나머지는 새로 생성
    const slots = [...existingSlots];
    for (let i = existingSlots.length; i < requiredCount; i++) {
      const slotNum = i + 1;
      slots.push({
        id: `${sectionId}-slot-${slotNum}`,
        slotType: i === 0 ? 'product' : 'detail',
        prompt: requiredCount > 1
          ? `[이미지 ${slotNum}/${requiredCount}] ${basePrompt}`
          : basePrompt
      });
    }
    return slots;
  }

  // 새로 생성 (existingSlots가 아예 없는 경우)
  const slots: import('../types').ImageSlot[] = [];
  for (let i = 0; i < requiredCount; i++) {
    const slotNum = i + 1;
    slots.push({
      id: `${sectionId}-slot-${slotNum}`,
      slotType: i === 0 ? 'product' : 'detail',
      prompt: requiredCount > 1
        ? `[이미지 ${slotNum}/${requiredCount}] ${basePrompt}`
        : basePrompt
    });
  }

  return slots;
};

/**
 * 프롬프트에서 컬러옵션명을 자동 추출하여 일치하는 컬러옵션 찾기
 * - 등록된 colorOptions의 colorName과 프롬프트 내용을 매칭
 * - 컬러옵션별 이미지 참조에 사용
 * @returns 매칭된 컬러옵션 또는 undefined
 */
export const findMatchingColorOption = (
  prompt: string,
  colorOptions: import('../types').ColorOption[] | undefined
): import('../types').ColorOption | undefined => {
  if (!prompt || !colorOptions?.length) return undefined;

  // 프롬프트를 소문자로 변환하여 검색
  const lowerPrompt = prompt.toLowerCase();

  for (const option of colorOptions) {
    const colorName = option.colorName.toLowerCase();

    // 다양한 패턴으로 컬러명 검색
    const patterns = [
      colorName,                           // 정확한 컬러명
      `wearing ${colorName}`,              // "wearing 와인"
      `${colorName} color`,                // "와인 color"
      `${colorName}-color`,                // "와인-color"
      `${colorName} colored`,              // "와인 colored"
      `in ${colorName}`,                   // "in 와인"
    ];

    // 하나라도 매칭되면 해당 컬러옵션 반환
    if (patterns.some(pattern => lowerPrompt.includes(pattern))) {
      console.log(`[findMatchingColorOption] 컬러 매칭 성공: "${option.colorName}" in prompt`);
      return option;
    }
  }

  console.log(`[findMatchingColorOption] 컬러 매칭 실패, 프롬프트: "${prompt.slice(0, 50)}..."`);
  return undefined;
};

/**
 * 이미지 프롬프트에서 색상 플레이스홀더를 실제 컬러 옵션으로 대체
 * - {{COLOR_1}}, {{COLOR_2}}, {{COLOR_3}} 등을 colorOptions 이름으로 대체
 * - HEX 코드가 있으면 함께 포함하여 AI의 정확도 향상
 */
const replaceColorPlaceholders = (
  prompt: string,
  colorOptions: { colorName: string; hexCode?: string }[],
  slotIndex: number
): string => {
  if (!prompt || colorOptions.length === 0) return prompt;

  let tier1_absolute = '';  // Tier 1: 절대적 요구사항 (최상단)
  let tier2_standard = '';  // Tier 2: 표준화 요소 (조명)
  let result = prompt;       // Tier 3: 창의적 요소 (기존 프롬프트)

  // ★ Step 1: 프롬프트에서 실제 사용된 {{COLOR_N}} 인덱스를 먼저 감지
  const usedColorIndices: Set<number> = new Set();
  colorOptions.forEach((_, idx) => {
    const placeholder = `{{COLOR_${idx + 1}}}`;
    if (result.includes(placeholder) || result.toLowerCase().includes(placeholder.toLowerCase())) {
      usedColorIndices.add(idx);
    }
  });

  console.log(`[replaceColorPlaceholders] 프롬프트에 사용된 색상 인덱스: [${[...usedColorIndices].map(i => i + 1).join(', ')}] (전체 ${colorOptions.length}개 중)`);

  // ★ Step 2: 플레이스홀더 치환 + 사용된 색상만 Tier 1/Tier 2 블록 생성
  colorOptions.forEach((color, idx) => {
    const placeholder = `{{COLOR_${idx + 1}}}`;

    if (!color.hexCode) {
      console.warn(
        `[geminiService] 색상 "${color.colorName}"에 HEX 코드가 없습니다. ` +
        `AI 색상 정확도가 떨어질 수 있습니다. 상품 이미지에서 자동 색상 추출을 권장합니다.`
      );
      result = result.replace(new RegExp(placeholder, 'gi'), color.colorName);
      return;
    }

    // ★ Tier 1/Tier 2 블록은 이 슬롯 프롬프트에 실제 사용된 색상만 생성
    if (usedColorIndices.has(idx)) {
      // ★ Tier 1: 절대적 색상 요구사항 (프롬프트 최상단에 배치)
      tier1_absolute += `
## 🔴 ABSOLUTE COLOR & PRODUCT REQUIREMENT - HIGHEST PRIORITY:

COLOR FIDELITY: The garment MUST be EXACTLY ${color.hexCode} (${color.colorName}).
- Reference image shows this EXACT color - replicate it pixel-perfectly
- This HEX code is MANDATORY, not a creative suggestion
- Color accuracy OVERRIDES lighting aesthetics, pose creativity, or any other consideration

PRODUCT CONSISTENCY: Match the reference image's design, texture, and details exactly.
- Same fabric appearance and material texture
- Identical stitching, buttons, zippers, seams, patterns
- Preserve ALL visual characteristics from the reference

`;

      // ★ Tier 2: 표준화 요소 (조명만 중립화하여 색상 보호)
      tier2_standard = `
## 🟡 STANDARDIZED LIGHTING - FOR TRUE COLOR REPRODUCTION:

Lighting Setup: NEUTRAL-WHITE diffused studio lighting (5500K color temperature)
- Purpose: Prevent color cast and ensure the garment appears in its true ${color.hexCode} shade
- DO NOT use warm/golden/cool lighting that would shift the garment color
- Even, soft illumination without harsh shadows on the garment surface
- Background lighting can vary for mood, but garment lighting must remain neutral

`;
    }

    // ★ Tier 3: 플레이스홀더 치환은 모든 색상에 대해 수행 (참조 텍스트용)
    const colorRef = `${color.colorName}`;
    result = result.replace(new RegExp(placeholder, 'gi'), colorRef);
  });

  // Tier 1/Tier 2가 비어있으면 (플레이스홀더가 없는 프롬프트) 원본만 반환
  if (!tier1_absolute && !tier2_standard) {
    return result;
  }

  // ★ 최종 조합: Tier 1 (절대적) → Tier 2 (표준화) → Tier 3 (창의적) 순서
  return tier1_absolute + tier2_standard + '\n## 🟢 CREATIVE ELEMENTS - MAXIMIZE VARIETY:\n\n' + result;
};

/**
 * 모델 외모 설정만 프롬프트용 텍스트로 변환 (인종, 성별, 연령, 헤어, 분위기)
 * - 모델컷 스타일(촬영 지시)은 포함하지 않음
 */
const buildModelAppearanceDescription = (
  modelSettings?: import('../types').ModelSettings
): string => {
  if (!modelSettings) return '';

  const parts: string[] = [];

  // 인종/외모 — 구체적으로 강화
  if (modelSettings.ethnicity === 'asian') {
    parts.push('East Asian / Korean model with typical Korean facial features, fair skin tone, monolid or subtle double eyelid eyes');
  } else if (modelSettings.ethnicity === 'western') {
    parts.push('Western/Caucasian model with European facial features');
  }

  // 성별
  if (modelSettings.gender === 'female') {
    parts.push('female');
  } else if (modelSettings.gender === 'male') {
    parts.push('male');
  }

  // 연령대
  if (modelSettings.ageRange && modelSettings.ageRange !== 'any') {
    const ageMap: Record<string, string> = {
      'teens': 'teenager',
      '20s': 'in their 20s',
      '30s': 'in their 30s',
      '40s': 'in their 40s',
      '50s+': 'in their 50s or older'
    };
    parts.push(ageMap[modelSettings.ageRange] || '');
  }

  // 헤어 스타일
  if (modelSettings.hairStyle) {
    parts.push(`with ${modelSettings.hairStyle}`);
  }

  // 분위기/무드
  if (modelSettings.mood) {
    const moodMap: Record<string, string> = {
      'sexy': 'confident alluring pose, subtle sensual mood',
      'elegant': 'refined graceful posture, sophisticated high-fashion mood',
      'innocent': 'fresh youthful vibe, clean natural mood',
      'casual': 'relaxed everyday style, comfortable natural mood',
      'sporty': 'energetic active pose, dynamic athletic mood'
    };
    if (moodMap[modelSettings.mood]) {
      parts.push(moodMap[modelSettings.mood]);
    }
  }

  if (parts.length === 0) return '';

  return parts.join(', ');
};

/**
 * 모델컷 스타일을 최상위 촬영 지시(카메라 앵글 오버라이드)로 변환
 * - 이 지시는 프롬프트의 다른 촬영 앵글 지시보다 우선시되어야 함
 * - 빈 설정이면 빈 문자열 반환
 */
const buildModelCutStyleDirective = (
  modelSettings?: import('../types').ModelSettings
): string => {
  // ★ undefined나 빈 문자열이면 기본값 'face_anonymous' 적용 (방어 로직)
  const effectiveStyle = modelSettings?.modelCutStyle || 'face_anonymous';
  console.log('[buildModelCutStyleDirective] effectiveStyle:', effectiveStyle, '(원본:', modelSettings?.modelCutStyle, ')');

  const cutStyleDirectiveMap: Record<string, string> = {
    'face_visible': `## ⚠️ FACE VISIBILITY OVERRIDE (CRITICAL - OVERRIDES ALL FACE CROPPING INSTRUCTIONS):
The model's FULL FACE MUST be clearly visible in the image.
- Show complete facial features: eyes, nose, mouth, jawline
- Natural, confident expression looking at or near camera
- DO NOT crop the face at nose level or any level
- DO NOT hide or obscure any part of the face
- The face should be clearly recognizable and well-lit`,

    'face_anonymous': `## ⚠️ FACE ANONYMITY OVERRIDE (CRITICAL):
The model's face MUST be cropped at NOSE level.
- Show only: chin, lips, jawline, and full neckline
- NO eyes visible in the final image
- Emphasis on garment and body silhouette
- This is a standard e-commerce anonymous model shot`,

    'mirror_selfie': `## ⚠️ CAMERA ANGLE OVERRIDE (CRITICAL - OVERRIDES ALL OTHER ANGLE/FRAMING INSTRUCTIONS):
This photo MUST look like a casual SELFIE taken by the person themselves, NOT a professional studio shot.
- CAMERA POSITION: slightly elevated, at arm's length distance (approximately 60-80cm from face)
- The person appears to be holding an invisible smartphone with one hand
- SELFIE ANGLE: slightly looking up toward the camera, natural selfie perspective with mild foreshortening
- One arm may be partially extended upward (the arm holding the phone)
- The other hand can be near hair, on hip, or adjusting the garment casually
- POSE: relaxed, casual, natural — as if quickly checking their outfit before going out
- Face CROPPED at nose level, NO eyes visible (maintain anonymity)
- Background: clean, simple, with soft natural bokeh — like a bedroom, hallway, or fitting room
- NO mirror reflection visible, NO phone visible, NO selfie stick
- The image should feel authentic and personal, like an Instagram outfit-of-the-day post
- IMPORTANT: Ignore any conflicting framing instructions like "WAIST-UP shot" or "UPPER BODY CLOSE-UP" — the selfie angle takes priority`
  };

  return cutStyleDirectiveMap[effectiveStyle] || cutStyleDirectiveMap['face_anonymous'];
};

/**
 * 모델 설정을 이미지 생성 프롬프트용 텍스트로 변환 (기존 호환성 유지)
 * - 외모 + 모델컷 스타일을 합쳐서 반환
 * - 빈 설정이면 빈 문자열 반환
 */
const buildModelDescription = (
  modelSettings?: import('../types').ModelSettings
): string => {
  if (!modelSettings) return '';

  const appearance = buildModelAppearanceDescription(modelSettings);

  // 모델컷 스타일은 간략한 인라인 형태로 포함 (기존 호환성)
  // ★ undefined나 빈 문자열이면 기본값 'face_anonymous' 적용
  const cutStyleParts: string[] = [];
  const effectiveCutStyle = modelSettings.modelCutStyle || 'face_anonymous';
  const cutStyleMap: Record<string, string> = {
    'face_visible': 'FULL FACE VISIBLE with clear facial features, natural expression',
    'face_anonymous': 'Face CROPPED at NOSE level, NO eyes visible',
    'mirror_selfie': 'Casual SELFIE ANGLE as if taken by model, slightly elevated arm-length camera angle, natural relaxed pose'
  };
  if (cutStyleMap[effectiveCutStyle]) {
    cutStyleParts.push(cutStyleMap[effectiveCutStyle]);
  }

  const allParts = [appearance, ...cutStyleParts].filter(p => p.length > 0);
  return allParts.join(', ');
};

/**
 * ★ 동적 컬러 섹션 조정 전처리 함수
 * - 사용자가 입력한 컬러 옵션 개수에 따라 템플릿의 섹션/슬롯을 동적으로 증감
 * - templateService.ts 원본은 변경하지 않고, 런타임에서만 처리
 * 
 * @param sections 원본 템플릿 섹션 배열 (deep copy하여 사용)
 * @param colorCount 사용자가 입력한 컬러 옵션 수
 * @returns 조정된 섹션 배열
 */
const adjustTemplateSectionsForColors = (
  sections: import('../types').SectionData[],
  colorCount: number
): import('../types').SectionData[] => {
  if (colorCount <= 0) {
    console.log('[adjustTemplateSectionsForColors] 컬러 옵션 없음, 원본 유지');
    return sections;
  }

  console.log(`[adjustTemplateSectionsForColors] 컬러 수: ${colorCount}, 원본 섹션 수: ${sections.length}`);

  // Deep copy를 위해 JSON parse/stringify (함수 없는 순수 데이터이므로 안전)
  let adjustedSections: import('../types').SectionData[] = JSON.parse(JSON.stringify(sections));

  // ──────────────────────────────────────────
  // 1. 색상 안내 섹션 (sec-lookbook-colors) 슬롯 수 조정
  // ──────────────────────────────────────────
  const colorSectionIdx = adjustedSections.findIndex(s => s.id === 'sec-lookbook-colors');
  if (colorSectionIdx !== -1) {
    const colorSection = adjustedSections[colorSectionIdx];
    if (colorSection.imageSlots && colorSection.imageSlots.length > 0) {
      const existingSlots = colorSection.imageSlots;

      if (colorCount <= existingSlots.length) {
        // 컬러 수가 기존 슬롯 수 이하 → 필요한 만큼만 자르기
        colorSection.imageSlots = existingSlots.slice(0, colorCount);
      } else {
        // 컬러 수가 기존 슬롯보다 많음 → 마지막 슬롯 패턴을 복제하여 추가
        const lastSlot = existingSlots[existingSlots.length - 1];
        for (let i = existingSlots.length; i < colorCount; i++) {
          const newSlot = JSON.parse(JSON.stringify(lastSlot));
          const colorIdx = i + 1;
          newSlot.id = `slot-color-${colorIdx}`;
          // 플레이스홀더 인덱스 교체: 마지막 슬롯의 COLOR_N을 새 인덱스로
          newSlot.prompt = newSlot.prompt.replace(/\{\{COLOR_\d+\}\}/g, `{{COLOR_${colorIdx}}}`);
          existingSlots.push(newSlot);
        }
        colorSection.imageSlots = existingSlots;
      }

      // ★ layoutType도 컬러 수에 따라 동적 조정
      // 1개: 전체폭, 2개/4개: 2열(2×2), 3개/5개/6개: 3열(자동 줄넘김)
      if (colorCount === 1) {
        colorSection.layoutType = 'full-width';
      } else if (colorCount === 2 || colorCount === 4) {
        colorSection.layoutType = 'grid-2';  // 2열: 2개=1×2, 4개=2×2
      } else {
        colorSection.layoutType = 'grid-3';  // 3열: 3개=1×3, 5개=3+2, 6개=3+3
      }

      console.log(`[adjustTemplateSectionsForColors] 색상 안내 슬롯 조정: ${existingSlots.length} → ${colorSection.imageSlots.length}, layout: ${colorSection.layoutType}`);
    }
  }

  // ──────────────────────────────────────────
  // 2. 코디 섹션 (sec-lookbook-styling1-c*) 개수 조정
  // ──────────────────────────────────────────
  const stylingPattern = /^sec-lookbook-styling1-c(\d+)$/;
  const stylingSections = adjustedSections
    .map((s, idx) => ({ section: s, originalIndex: idx, match: s.id.match(stylingPattern) }))
    .filter(item => item.match !== null);

  console.log(`[adjustTemplateSectionsForColors] 코디 섹션 감지: ${stylingSections.length}개`);

  if (stylingSections.length > 0) {
    const existingCount = stylingSections.length;

    if (colorCount < existingCount) {
      // 컬러 수가 적으면 → 초과 코디 섹션 제거
      const sectionsToRemove = stylingSections.slice(colorCount).map(item => item.section.id);
      adjustedSections = adjustedSections.filter(s => !sectionsToRemove.includes(s.id));
      console.log(`[adjustTemplateSectionsForColors] 코디 섹션 축소: ${existingCount} → ${colorCount}, 제거: [${sectionsToRemove.join(', ')}]`);

    } else if (colorCount > existingCount) {
      // 컬러 수가 많으면 → 마지막 코디 섹션을 복제하여 추가
      const lastStyling = stylingSections[stylingSections.length - 1];
      const insertAfterIndex = lastStyling.originalIndex;

      const newSections: import('../types').SectionData[] = [];
      for (let i = existingCount; i < colorCount; i++) {
        const colorIdx = i + 1;
        const cloned: import('../types').SectionData = JSON.parse(JSON.stringify(lastStyling.section));

        // ID, title, imagePrompt 내 컬러 인덱스 교체
        cloned.id = `sec-lookbook-styling1-c${colorIdx}`;
        cloned.title = `{{COLOR_${colorIdx}}} 코디`;
        cloned.content = `${colorIdx}번째 컬러의 다양한 코디네이션과 디테일입니다.`;

        if (cloned.imagePrompt) {
          cloned.imagePrompt = cloned.imagePrompt.replace(/\{\{COLOR_\d+\}\}/g, `{{COLOR_${colorIdx}}}`);
        }

        // imageSlots 내 프롬프트의 컬러 인덱스 및 ID 교체
        if (cloned.imageSlots) {
          cloned.imageSlots = cloned.imageSlots.map((slot, slotIdx) => ({
            ...slot,
            id: `slot-s1c${colorIdx}-${slotIdx + 1}`,
            prompt: slot.prompt.replace(/\{\{COLOR_\d+\}\}/g, `{{COLOR_${colorIdx}}}`)
          }));
        }

        newSections.push(cloned);
      }

      // 마지막 코디 섹션 바로 뒤에 새 섹션들을 삽입
      adjustedSections.splice(insertAfterIndex + 1, 0, ...newSections);
      console.log(`[adjustTemplateSectionsForColors] 코디 섹션 확장: ${existingCount} → ${colorCount}, 추가: ${newSections.length}개`);
    }
  }

  console.log(`[adjustTemplateSectionsForColors] 최종 섹션 수: ${adjustedSections.length}`);
  return adjustedSections;
};

/**
 * 템플릿 구조를 기반으로 AI 결과를 매핑
 * - 템플릿의 섹션 구조(ID, 개수, 순서, 레이아웃)를 100% 유지
 * - AI가 생성한 콘텐츠(제목, 설명)만 적용
 * - 고정 이미지, 고정 문구, 레이아웃은 절대 변경 불가
 * - ★ layoutType에 따라 imageSlots 자동 생성
 * - ★ productData.colorOptions로 색상 플레이스홀더 대체
 * - ★ colorOptions 개수에 따라 섹션/슬롯 동적 증감
 */
const applyTemplateStructure = (
  aiResult: ProductAnalysis,
  template: Template,
  productData?: ProductInputData
): ProductAnalysis => {
  console.log('[applyTemplateStructure] 템플릿 적용 시작:', template.name);
  console.log('[applyTemplateStructure] 템플릿 섹션 수:', template.sections.length);
  console.log('[applyTemplateStructure] AI 결과 섹션 수:', aiResult.sections.length);
  console.log('[applyTemplateStructure] 컬러 옵션 수:', productData?.colorOptions?.length || 0);

  const colorOptions = productData?.colorOptions || [];

  // ★ 컬러 옵션 개수에 따라 템플릿 섹션을 동적으로 조정
  const adjustedSections = adjustTemplateSectionsForColors(template.sections, colorOptions.length);
  console.log(`[applyTemplateStructure] 동적 조정 후 섹션 수: ${adjustedSections.length}`);

  // ★ AI가 추출한 상품 시각적 설명 (이미지 프롬프트에 사용)
  const productVisualDescription = (aiResult as any).productVisualDescription || aiResult.productName || 'the product';
  console.log('[applyTemplateStructure] 상품 시각적 설명:', productVisualDescription);

  // 동적 조정된 섹션을 기준으로 구조 매핑
  const mappedSections: SectionData[] = adjustedSections.map((templateSection, index) => {
    // AI 결과에서 동일 ID의 섹션 찾기 (우선), 없으면 인덱스 기반 매칭
    const aiSection = aiResult.sections.find(s => s.id === templateSection.id)
      || aiResult.sections[index]
      || null;

    console.log(`[applyTemplateStructure] 섹션 ${index + 1}: ${templateSection.id} -> AI 매칭: ${aiSection?.id || 'none'}`);

    const effectiveLayoutType = templateSection.layoutType || 'full-width';
    const effectiveSectionType = templateSection.sectionType || 'custom';

    // ★ 섹션 타입별 촬영 가이드 가져오기
    const sectionImageGuide = SECTION_TYPE_IMAGE_GUIDES[effectiveSectionType] || SECTION_TYPE_IMAGE_GUIDES.custom;

    // ★ 업로드 전용 섹션 플래그 확인
    const isUploadOnly = templateSection.isUploadOnly === true;

    // ★ 템플릿 프롬프트 우선! (AI 생성 프롬프트는 템플릿 프롬프트가 없을 때만 대체)
    // 업로드 전용 섹션이면 프롬프트 비움
    let baseImagePrompt = isUploadOnly
      ? ''  // 사용자 업로드 전용: 프롬프트 비움
      : (templateSection.imagePrompt || aiSection?.imagePrompt || '');

    if (isUploadOnly) {
      console.log(`[applyTemplateStructure] 섹션 ${index + 1}: 업로드 전용 섹션 (isUploadOnly=true, AI 프롬프트/슬롯 생성 건너뜀)`);
    }

    // ★ [PRODUCT] 플레이스홀더를 실제 상품 시각적 설명으로 대체
    if (baseImagePrompt) {
      baseImagePrompt = baseImagePrompt.replace(/\[PRODUCT\]/gi, productVisualDescription);

      // 프롬프트에 섹션 가이드가 아직 없으면 추가
      if (!baseImagePrompt.toLowerCase().includes('close-up') &&
        !baseImagePrompt.toLowerCase().includes('full body') &&
        !baseImagePrompt.toLowerCase().includes('lifestyle')) {
        baseImagePrompt = `${baseImagePrompt}. ${sectionImageGuide}`;
      }
    }

    // ★ layoutType에 따라 imageSlots 자동 생성 (업로드 전용이면 빈 배열)
    const autoGeneratedSlots = isUploadOnly
      ? []
      : generateImageSlotsForLayout(
          templateSection.id,
          effectiveLayoutType,
          baseImagePrompt || '',
          templateSection.imageSlots
        );

    // ★ 슬롯별로 [PRODUCT] 대체 및 색상 플레이스홀더 대체
    const modelCutStyle = productData?.modelSettings?.modelCutStyle;
    const enhancedSlots = autoGeneratedSlots.map((slot, slotIdx) => {
      let enhancedPrompt = slot.prompt;

      // [PRODUCT] 대체
      enhancedPrompt = enhancedPrompt.replace(/\[PRODUCT\]/gi, productVisualDescription);

      // ★ 모델컷 스타일에 따라 슬롯 프롬프트의 촬영 지시를 교체 (충돌 방지)
      if (modelCutStyle === 'mirror_selfie') {
        // 거울셀카: 기존 촬영 앵글 지시를 셀카 앵글로 교체
        const selfieAngleReplacement = 'SELFIE-STYLE ANGLE shot — camera at arm-length, slightly elevated, casual selfie perspective';
        enhancedPrompt = enhancedPrompt.replace(/WAIST-UP PRODUCT-FOCUSED shot from chin down to hip/gi, selfieAngleReplacement);
        enhancedPrompt = enhancedPrompt.replace(/UPPER BODY CLOSE-UP shot from neckline to waist/gi, selfieAngleReplacement);
        enhancedPrompt = enhancedPrompt.replace(/UPPER BODY PRODUCT-CENTERED shot from chin down/gi, selfieAngleReplacement);
        enhancedPrompt = enhancedPrompt.replace(/WAIST-UP to HIP PRODUCT-FOCUSED shot/gi, selfieAngleReplacement);
        enhancedPrompt = enhancedPrompt.replace(/WAIST-UP 3\/4 ANGLE shot/gi, selfieAngleReplacement);
        enhancedPrompt = enhancedPrompt.replace(/3\/4 BODY shot from chin down showing full neckline and product silhouette/gi, 'SELFIE-STYLE shot from slightly elevated angle, face cropped at nose level, showing upper body and product');
        enhancedPrompt = enhancedPrompt.replace(/UPPER BODY CLOSE-UP from neckline to waist/gi, selfieAngleReplacement);
        console.log(`[applyTemplateStructure] ★ 거울셀카: 슬롯 ${slotIdx + 1} 촬영 지시 → 셀카 앵글로 교체`);
      } else if (modelCutStyle === 'face_visible') {
        // 얼굴 노출: Face CROPPED 지시를 FULL FACE VISIBLE로 교체
        enhancedPrompt = enhancedPrompt.replace(/Face CROPPED at NOSE level[^.]*\./gi, 'FULL FACE VISIBLE with clear facial features, natural expression.');
        enhancedPrompt = enhancedPrompt.replace(/Face CROPPED at nose level[^.]*\./gi, 'FULL FACE VISIBLE with clear facial features, natural expression.');
        enhancedPrompt = enhancedPrompt.replace(/NO eyes visible/gi, 'eyes clearly visible, natural expression');
        console.log(`[applyTemplateStructure] ★ 얼굴 노출: 슬롯 ${slotIdx + 1} Face CROPPED → FULL FACE VISIBLE로 교체`);
      }

      // 모델 외모 설정(인종, 분위기 등)만 {{MODEL_SETTINGS}}에 대체 (모델컷 스타일 제외)
      const modelAppearanceDesc = buildModelAppearanceDescription(productData?.modelSettings);
      if (modelAppearanceDesc) {
        enhancedPrompt = enhancedPrompt.replace(/\{\{MODEL_SETTINGS\}\}/gi, modelAppearanceDesc);
      } else {
        // 모델 설정이 없으면 플레이스홀더를 제거하되, 주변의 연속된 콤마와 공백을 정리
        enhancedPrompt = enhancedPrompt.replace(/,\s*\{\{MODEL_SETTINGS\}\}/gi, '');
        enhancedPrompt = enhancedPrompt.replace(/\{\{MODEL_SETTINGS\}\}\s*,/gi, '');
        enhancedPrompt = enhancedPrompt.replace(/\{\{MODEL_SETTINGS\}\}/gi, '');
      }

      // 색상 플레이스홀더 대체
      enhancedPrompt = replaceColorPlaceholders(enhancedPrompt, colorOptions, slotIdx);

      return {
        ...slot,
        prompt: enhancedPrompt
      };
    });

    // ★ 후면 이미지 존재 여부에 따라 3번째 슬롯 프롬프트를 조건부 교체
    const hasBackImage = [
      ...(productData?.mainImages || []),
      ...(productData?.colorOptions?.flatMap(c => c.images) || [])
    ].some(img => img.role === 'back');

    const finalSlots = enhancedSlots.map((slot, slotIdx) => {
      if (slot.prompt.includes('EITHER Back View OR Side Profile')) {
        if (hasBackImage) {
          // ★ 후면 이미지가 있으면 BACK VIEW 강제 적용
          console.log(`[applyTemplateStructure] ★ 후면 이미지 감지 → 슬롯 ${slotIdx + 1} BACK VIEW 강제 적용`);
          return {
            ...slot,
            prompt: slot.prompt.replace(
              /EITHER Back View OR Side Profile[^,]*/,
              'BACK VIEW ONLY — this is MANDATORY because a back reference image was provided. Show the BACK DESIGN of the garment clearly. The model is facing AWAY from the camera, showing the complete back design of the garment from shoulders to hem'
            )
          };
        } else {
          // ★ 후면 이미지가 없으면 BACK VIEW 관련 프롬프트를 정면 촬영으로 교체
          console.log(`[applyTemplateStructure] ★ 후면 이미지 없음 → 슬롯 ${slotIdx + 1} 정면 촬영 프롬프트로 교체 (BACK VIEW 제거)`);
          return {
            ...slot,
            prompt: slot.prompt.replace(
              /EITHER Back View OR Side Profile[^,]*/,
              'PRODUCT-FOCUSED WAIST-UP shot, 3/4 angle view showing the front of the garment, relaxed pose, clean blurred background. DO NOT show back view'
            )
          };
        }
      }
      return slot;
    });

    console.log(`[applyTemplateStructure] 섹션 ${index + 1}: layout=${effectiveLayoutType}, slots=${finalSlots.length}, hasBackImage=${hasBackImage}`);

    // 기본 섹션 구조 (템플릿에서 100% 유지)
    const baseSection: SectionData = {
      // ★ 템플릿 구조 완전 유지 (절대 변경 불가)
      id: templateSection.id,
      sectionType: templateSection.sectionType,
      layoutType: effectiveLayoutType,
      imageSlots: finalSlots,  // ★ 상품 설명 + 색상 대체 + 후면 강제화 적용된 이미지 슬롯
      isUploadOnly: isUploadOnly || undefined,  // ★ 업로드 전용 플래그 전파
      fixedText: templateSection.fixedText,
      fixedImageBase64: templateSection.fixedImageBase64,
      fixedImageMimeType: templateSection.fixedImageMimeType,
      useFixedImage: templateSection.useFixedImage,

      // AI가 생성한 콘텐츠 적용 (없으면 템플릿 기본값 사용)
      title: aiSection?.title || templateSection.title,
      content: isUploadOnly
        ? ''
        : buildContentWithFixedText(
            aiSection?.content || templateSection.content,
            templateSection.fixedText
          ),

      // 기존 호환성: 단일 imagePrompt (첫 번째 슬롯 기준)
      imagePrompt: enhancedSlots[0]?.prompt || baseImagePrompt,
    };

    // 고정 이미지가 활성화되어 있으면 즉시 이미지 URL 설정
    if (templateSection.useFixedImage && templateSection.fixedImageBase64) {
      baseSection.imageUrl = `data:${templateSection.fixedImageMimeType};base64,${templateSection.fixedImageBase64}`;
      baseSection.isOriginalImage = true; // AI 생성 건너뛰기 플래그
    }

    return baseSection;
  });

  console.log('[applyTemplateStructure] 최종 매핑된 섹션 수:', mappedSections.length);

  return {
    ...aiResult,
    sections: mappedSections,
  };
};

/**
 * 고정 문구를 콘텐츠에 자연스럽게 통합
 * - 고정 문구가 이미 포함되어 있으면 중복 추가 안함
 * - 없으면 콘텐츠 앞에 추가
 */
const buildContentWithFixedText = (content: string, fixedText?: string): string => {
  if (!fixedText) return content;

  // 이미 고정 문구가 포함되어 있는지 확인
  if (content.includes(fixedText)) {
    return content;
  }

  // 고정 문구를 콘텐츠 앞에 강조하여 추가
  return `✓ ${fixedText}\n\n${content}`;
};

/**
 * 섹션 타입별 이미지 촬영 가이드
 * AI 이미지 생성 시 섹션 목적에 맞는 촬영 스타일 적용
 */
export const SECTION_TYPE_IMAGE_GUIDES: Record<string, string> = {
  hero: "Full product shot, clean studio background, centered hero-style composition, professional lighting",
  title: "Clean product hero shot, minimal background, brand-focused presentation",
  description: "Lifestyle context shot showing product in use, natural setting, inviting atmosphere",
  detail: "Extreme close-up macro shot of design details (embroidery, texture, stitching, pattern), sharp focus",
  material_detail: "Macro texture photography showing fabric quality, weave pattern, material feel, soft lighting",
  colors: "Color variant showcase, same product angle showing different available colors",
  styling: "Styled outfit coordination shot, product paired with complementary items, fashion lookbook style",
  fit: "Full body shot on appropriate model showing fit and silhouette, size reference",
  spec: "Technical flat-lay shot or diagram style, clear measurements reference",
  notice: "Informational graphic style, care instructions visual",
  custom: "Professional product photography, clean background"
};

const productAnalysisSchema = {
  type: "object",
  properties: {
    productName: { type: "string", description: "Suggested product name in Korean" },
    detectedCategory: { type: "string", description: "Product category" },
    productVisualDescription: {
      type: "string",
      description: "Detailed visual description of the product in English for image generation. Include: material/texture (e.g. fluffy fleece, smooth cotton), exact color (e.g. soft pink, baby pink), design elements (e.g. bear face embroidery, ribbed cuffs), product type (e.g. baby outfit set), target age if applicable. This will be used in image generation prompts."
    },
    mainFeatures: {
      type: "array",
      items: { type: "string" },
      description: "List of 3-5 key features in Korean"
    },
    marketingCopy: { type: "string", description: "Persuasive marketing intro copy (2-3 sentences) in Korean" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string", description: "Section header in Korean" },
          content: { type: "string", description: "Detailed section body text in Korean" },
          imagePrompt: { type: "string", description: "Prompt to generate an image for this section. MUST include the exact product visual description. Write in English." },
        },
        required: ["id", "title", "content", "imagePrompt"]
      }
    }
  },
  required: ["productName", "productVisualDescription", "mainFeatures", "marketingCopy", "sections"]
};

/**
 * Schema for template extraction (NEW - template-specific structure)
 */
const templateExtractionSchema = {
  type: "object",
  properties: {
    templateName: { type: "string", description: "템플릿 이름 (상품 카테고리 기반)" },
    templateCategory: {
      type: "string",
      enum: ["fashion", "beauty", "food", "electronics", "furniture", "living", "kids", "pet", "other"],
      description: "상품 카테고리"
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "섹션 고유 ID (예: sec-1)" },
          sectionType: {
            type: "string",
            enum: ["title", "hero", "description", "colors", "material_detail", "styling", "fit", "spec", "notice", "custom"],
            description: "섹션 역할/목적"
          },
          title: { type: "string", description: "섹션 제목 예시 (한국어)" },
          content: { type: "string", description: "본문 플레이스홀더 텍스트 (한국어)" },
          layoutType: {
            type: "string",
            enum: ["full-width", "split-left", "split-right", "grid-2", "grid-3", "text-only", "image-only"],
            description: "레이아웃 배치"
          },
          imageSlots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "이미지 슬롯 ID (예: img-1)" },
                slotType: {
                  type: "string",
                  enum: ["hero", "product", "detail", "material", "color_styling", "fit", "spec", "notice", "custom"],
                  description: "이미지 유형"
                },
                photographyStyle: {
                  type: "string",
                  enum: ["full-body", "close-up", "flat-lay", "lifestyle", "studio", "coordination", "diagram"],
                  description: "촬영 스타일 (전신샷, 클로즈업, 플랫레이, 라이프스타일, 스튜디오, 코디, 다이어그램)"
                },
                aspectRatio: {
                  type: "string",
                  enum: ["square", "portrait", "landscape", "wide"],
                  description: "이미지 비율 (정사각형, 세로형, 가로형, 와이드)"
                },
                prompt: { type: "string", description: "범용 이미지 생성 프롬프트 ([PRODUCT] 플레이스홀더 사용, 촬영 스타일 포함)" }
              },
              required: ["id", "slotType", "photographyStyle", "prompt"]
            },
            description: "이미지 슬롯 배열 (섹션 내 이미지들, 촬영 스타일 및 비율 포함)"
          }
        },
        required: ["id", "sectionType", "title", "layoutType", "imageSlots"]
      }
    }
  },
  required: ["templateName", "templateCategory", "sections"]
};

/**
 * Enhanced prompt for template extraction
 * 고도화된 템플릿 추출 프롬프트 - 시각적 분석, 레이아웃 감지, 촬영 스타일 추출
 */
const templateExtractionPrompt = `
You are an expert e-commerce product page designer with deep experience in Korean online shopping malls.
Your task is to analyze a product detail page image and extract a REUSABLE TEMPLATE STRUCTURE.

## STEP 1: VISUAL LAYOUT DETECTION (레이아웃 감지)

Carefully examine the image and identify layout patterns:

**Grid Detection (그리드 감지):**
- Count images arranged horizontally in the same row
- 2 images side-by-side → layoutType: "grid-2"
- 3 images side-by-side → layoutType: "grid-3"
- Single image spanning full width → layoutType: "full-width" or "image-only"

**Split Layout Detection (분할 레이아웃 감지):**
- Image on LEFT + text on RIGHT → layoutType: "split-left"
- Text on LEFT + image on RIGHT → layoutType: "split-right"

**Section Boundary Detection (섹션 경계 감지):**
- Look for: horizontal lines, spacing gaps, background color changes
- New section typically starts with a headline/title
- Group related images and text together as one section

## STEP 2: SECTION TYPE IDENTIFICATION (섹션 타입 식별)

For each section, identify its PURPOSE:

| sectionType | 특징 | 일반적 레이아웃 |
|-------------|------|----------------|
| hero | 메인 대표 이미지, 상품 전체 보이는 첫 이미지 | full-width, image-only |
| description | 상품 소개/설명 텍스트 | full-width, split-* |
| material_detail | 소재/원단 클로즈업, 텍스처 강조 | full-width, grid-2 |
| colors | 색상별 상품 나열, 컬러칩 | grid-2, grid-3 |
| styling | 코디/스타일링, 다른 아이템과 조합 | grid-2, full-width |
| fit | 착용샷, 사이즈 안내, 모델 피팅 | full-width, split-* |
| detail | 디테일 클로즈업 (자수, 단추, 지퍼 등) | grid-2, grid-3 |
| spec | 사이즈표, 스펙 다이어그램 | full-width, text-only |
| notice | 배송/반품/세탁 안내 | text-only, full-width |

## STEP 3: PHOTOGRAPHY STYLE ANALYSIS (촬영 스타일 분석)

For EACH image in a section, identify the photographyStyle:

| photographyStyle | 설명 | 예시 |
|-----------------|------|------|
| full-body | 전신 착용컷, 모델 전체 보임 | 모델이 옷을 입고 서있는 컷 |
| close-up | 극단적 확대, 디테일/텍스처 강조 | 자수 패턴, 원단 결 클로즈업 |
| flat-lay | 평면 배치, 위에서 촬영 | 바닥에 펼쳐놓은 상품 |
| lifestyle | 실생활 환경에서 자연스러운 장면 | 집에서 편하게 입고 있는 모습 |
| studio | 깔끔한 스튜디오 배경, 단색 배경 | 흰 배경에 상품만 촬영 |
| coordination | 코디 제안, 여러 아이템 조합 | 상하의+액세서리 함께 |
| diagram | 도표, 사이즈 안내, 설명 그래픽 | 사이즈표, 세탁 기호 |

Also identify aspectRatio:
- square: 정사각형 (1:1)
- portrait: 세로형 (2:3, 3:4)
- landscape: 가로형 (3:2, 4:3)
- wide: 와이드 배너형 (16:9, 21:9)

## STEP 4: PAGE FLOW / STORYLINE ANALYSIS (페이지 흐름 분석)

Analyze the logical flow from TOP to BOTTOM:

**Typical Korean e-commerce page flow:**
1. Hero image (대표 이미지) - first impression
2. Product description (상품 설명) - key features
3. Detail shots (디테일 컷) - close-ups of features
4. Material/quality (소재/품질) - texture and material
5. Styling/coordination (코디 제안) - how to wear/use
6. Fit/size (핏/사이즈) - size guide
7. Spec/info (스펙 정보) - detailed specifications
8. Notice (안내사항) - shipping, returns, care

**PRESERVE this natural flow in your template output!**

## STEP 5: IMAGE PROMPT CREATION (이미지 프롬프트 작성)

For each imageSlot, create a detailed, reusable prompt:

**Structure:**
[Photography Style] + [Subject with [PRODUCT] placeholder] + [Composition] + [Background/Setting] + [Lighting]

**Examples:**
- Hero: "Studio shot of [PRODUCT] displayed on clean white background, centered composition, professional product photography lighting"
- Detail: "Extreme close-up macro shot of [PRODUCT] texture and stitching detail, shallow depth of field, soft diffused lighting"
- Styling: "Flat-lay coordination shot of [PRODUCT] paired with complementary accessories, overhead angle, lifestyle props, soft natural lighting"
- Fit: "Full body shot of a model wearing [PRODUCT], natural standing pose, neutral studio background, even soft lighting"

## OUTPUT REQUIREMENTS:

1. Return valid JSON matching the schema
2. Include 4-10 sections covering the full page
3. Each section must have:
   - Correct sectionType based on content purpose
   - Correct layoutType based on visual arrangement
   - imageSlots with photographyStyle and aspectRatio
   - Detailed prompts using [PRODUCT] placeholder
4. title and content in Korean
5. prompts in English for AI image generation
6. Preserve the natural page flow/storyline
`;

/**
 * Extract template structure from a reference image
 * Enhanced version with sectionType, layoutType, and imageSlots
 */
export const extractTemplateFromImage = async (
  base64Image: string,
  mimeType: string
): Promise<Template> => {
  try {
    // GAS 프록시를 통한 호출 시도
    const gasUrl = getGasUrl(true);

    // URL 정규화 비교
    const normalizedGasUrl = gasUrl ? normalizeUrlForComparison(gasUrl) : '';
    const normalizedDefaultUrl = normalizeUrlForComparison(DEFAULT_GAS_URL);
    const isDefaultUrl = normalizedGasUrl === normalizedDefaultUrl;

    console.log('[Template Extract] Using enhanced template extraction schema');

    // GAS URL이 설정되어 있고 기본 데모 URL이 아니면 프록시 사용
    if (gasUrl && gasUrl.trim() !== '' && !isDefaultUrl) {
      // GAS 프록시 사용
      const result = await callGeminiViaProxy({
        model: MODEL_TEXT_VISION,
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Image } } as GeminiInlineDataPart,
            { text: templateExtractionPrompt } as GeminiTextPart
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: templateExtractionSchema,
          temperature: 0.3,
        }
      });

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No response from Gemini");

      const templateData = JSON.parse(text);

      // Convert to Template format with new structure
      return convertToTemplate(templateData);
    }

    // GAS 프록시가 없으면 환경 변수에서 API 키 확인 (Fallback)
    const apiKey = (window as any).__GEMINI_API_KEY__ ||
      (import.meta.env?.VITE_GEMINI_API_KEY as string);

    if (!apiKey) {
      throw new Error(
        'Gemini API 키가 설정되지 않았습니다.\n\n' +
        '방법 1: GAS 프록시 사용 (권장)\n' +
        '  - Google Apps Script에 GEMINI_API_KEY를 스크립트 속성으로 설정\n' +
        '  - GAS Web App URL을 설정에 입력\n\n' +
        '방법 2: 환경 변수 사용\n' +
        '  - .env 파일에 VITE_GEMINI_API_KEY=your_key 추가'
      );
    }

    // 직접 API 호출 (Fallback)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_TEXT_VISION}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: {
            parts: [
              { inlineData: { mimeType, data: base64Image } },
              { text: templateExtractionPrompt }
            ]
          },
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: templateExtractionSchema,
            temperature: 0.3,
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Gemini API 오류: ${response.status} - ${errorData}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("No response from Gemini");

    const templateData = JSON.parse(text);

    return convertToTemplate(templateData);
  } catch (error) {
    console.error("Template extraction failed:", error);
    throw error;
  }
};

/**
 * Convert AI response to Template format
 */
const convertToTemplate = (templateData: any): Template => {
  const sections: SectionData[] = templateData.sections.map((sec: any) => ({
    id: sec.id || `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: sec.title || '',
    content: sec.content || '',
    sectionType: sec.sectionType,
    layoutType: sec.layoutType,
    imageSlots: sec.imageSlots?.map((slot: any) => ({
      id: slot.id || `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      slotType: slot.slotType || 'hero',
      photographyStyle: slot.photographyStyle || 'studio',
      aspectRatio: slot.aspectRatio || 'portrait',
      prompt: slot.prompt || '',
    })) || [],
    // 하위 호환성: 첫 번째 이미지 슬롯의 프롬프트를 imagePrompt로 설정
    imagePrompt: sec.imageSlots?.[0]?.prompt || '',
  }));

  return {
    id: `tpl-${Date.now()}`,
    name: templateData.templateName || "새 템플릿",
    description: `${templateData.templateCategory || 'other'} 카테고리 템플릿`,
    category: templateData.templateCategory,
    sections,
    createdAt: Date.now()
  };
};

/**
 * Analyze image(s) and generate product details and section structure
 * Updated to accept multiple images
 */
export const analyzeProductImage = async (
  base64Images: string[],
  mimeTypes: string[],
  mode: AppMode,
  template?: Template | null,
  productData?: ProductInputData  // 상품 정보 (새로운 Phase 7)
): Promise<ProductAnalysis> => {
  // 디버그 로그: 템플릿 전달 확인
  console.log('[analyzeProductImage] 호출됨');
  console.log('[analyzeProductImage] 이미지 수:', base64Images.length);
  console.log('[analyzeProductImage] 템플릿:', template ? `${template.name} (${template.sections.length}개 섹션)` : '없음');
  console.log('[analyzeProductImage] 상품 정보:', productData?.productName || '없음');

  let prompt = "";

  if (template) {
    // TEMPLATE MODE - 템플릿 구조 100% 유지
    // ★ colorOptions를 추출하여 플레이스홀더 치환 준비
    const colorOptions = productData?.colorOptions || [];

    // ★ AI에게 전달하기 전에 {{COLOR_N}} 플레이스홀더를 실제 색상으로 치환
    const templateStructure = JSON.stringify(template.sections.map(s => {
      // 제목, 내용, 이미지프롬프트에서 색상 플레이스홀더 치환
      let processedTitle = s.title;
      let processedContent = s.content;
      let processedImagePrompt = s.imagePrompt || '';

      colorOptions.forEach((color, idx) => {
        const placeholder = new RegExp(`\\{\\{COLOR_${idx + 1}\\}\\}`, 'gi');
        processedTitle = processedTitle.replace(placeholder, color.colorName);
        processedContent = processedContent.replace(placeholder, color.colorName);
        processedImagePrompt = processedImagePrompt.replace(placeholder, color.colorName);
      });

      return {
        id: s.id,
        section_purpose: processedTitle,
        content_guideline: processedContent,
        visual_style: processedImagePrompt,
        fixed_text: s.fixedText || null,
        layout_type: s.layoutType || 'full-width',
        has_fixed_image: !!s.fixedImageBase64
      };
    }), null, 2);

    const sectionCount = template.sections.length;
    const sectionIds = template.sections.map(s => s.id).join(', ');

    // ★ 사용자 입력 상품 정보 추가
    const productInfoSection = productData ? `
      ## PROVIDED PRODUCT INFORMATION (MUST USE):
      ${productData.productName ? `- Product Name: "${productData.productName}" - Use this EXACT name in productName field` : ''}
      ${productData.price ? `- Price: ${productData.price.toLocaleString()}원` : ''}
      ${productData.discountRate ? `- Discount Rate: ${productData.discountRate}%` : ''}
      ${productData.productFeatures ? `- Key Features (from seller):\n${productData.productFeatures}` : ''}
      ${productData.colorOptions?.length > 0 ? `- Available Colors: ${productData.colorOptions.map(c => c.colorName).join(', ')}` : ''}
    ` : '';

    prompt = `
      You are an expert e-commerce merchandiser. You MUST follow a STRICT template structure.
      
      ## CRITICAL RULES (MUST FOLLOW):
      1. You MUST generate EXACTLY ${sectionCount} sections - no more, no less.
      2. You MUST use these EXACT section IDs in order: [${sectionIds}]
      3. You MUST NOT add, remove, or reorder any sections.
      4. You MUST preserve the template's storyline flow exactly as given.
      ${productData?.productName ? `5. You MUST use "${productData.productName}" as the productName - do NOT make up a different name.` : ''}
      
      ${productInfoSection}
      
      ## Input:
      - Product Image(s): Photos of the product to sell
      - Template Structure (MUST FOLLOW EXACTLY):
      ${templateStructure}
      
      ## STEP 1: ANALYZE PRODUCT VISUAL CHARACTERISTICS (CRITICAL)
      Before anything else, carefully analyze the uploaded product images and create a detailed 'productVisualDescription' in ENGLISH:
      - Material/Texture: (e.g., "fluffy fleece", "soft cotton knit", "smooth velvet")
      - Exact Color: (e.g., "soft baby pink", "cream beige", "dusty rose")
      - Design Elements: (e.g., "cute bear face embroidery on chest", "ribbed cuffs and hem", "pom-pom details")
      - Product Type: (e.g., "toddler two-piece outfit set with top and pants", "baby onesie")
      - Target Age/Gender: (e.g., "for infants 6-24 months", "unisex toddler")
      - Style/Vibe: (e.g., "cozy winter loungewear", "casual everyday wear")
      
      Example: "Soft baby pink fluffy fleece two-piece set for toddlers, featuring an adorable bear face embroidery on the sweatshirt front with cute ears, matching jogger pants, ribbed cuffs and hem in coordinating pink, cozy winter loungewear style"
      
      ## STEP 2: Generate Section Content
      For EACH section in the template (in exact order):
      - Use the EXACT 'id' provided - do not change it
      - Write a compelling 'title' in Korean that fits the section's purpose
      - Write detailed 'content' in Korean based on the 'content_guideline'
      ${productData?.productFeatures ? `- KEY REQUIREMENT: Incorporate these user-provided features: "${productData.productFeatures}"` : ''}
      ${productData?.colorOptions?.length ? '- Mention available colors in color-related sections' : ''}

      ## SPECIAL: material_detail Section Content Format
      For sections with sectionType "material_detail":
      - The 'content' field MUST follow this EXACT 2-line format:
        Line 1: Material/fabric name ONLY (e.g., "폴리에스터", "캐시미어", "면 혼방")
        Line 2: Brief description of the material characteristics in Korean (max 2 lines)
      ${productData?.productFeatures ? `- IMPORTANT: If the user-provided features mention any material/fabric info ("${productData.productFeatures}"), extract and use that material name for Line 1` : '- Analyze the product image to determine the most likely fabric/material name'}
      - Example content: "캐시미어\\n부드럽고 보온성이 뛰어난 프리미엄 캐시미어 소재로 제작되어 고급스러운 착용감을 선사합니다."
      - Do NOT write more than 2 lines for the description

      ## STEP 3: Create Section-Specific imagePrompts (CRITICAL)
      For each section, create an 'imagePrompt' that:
      1. ALWAYS starts with the EXACT product visual description from Step 1
      ${productData?.productFeatures ? `- VISUAL REQUIREMENT: Reflect these product features in the visual details: "${productData.productFeatures}"` : ''}
      2. Adapts the photography style based on section type:
         - hero/title: Full product shot, clean studio background, centered composition
         - description: Lifestyle context shot showing product in natural setting
         - detail/material_detail: EXTREME CLOSE-UP macro shot of specific details (texture, embroidery, stitching)
         - styling: Styled coordination shot with complementary items, fashion lookbook style
         - colors: Same angle showing color variants side by side
         - fit: Full body shot on model/mannequin showing silhouette and fit
      3. Uses the template's 'visual_style' as reference for composition and mood
      4. NEVER mentions different products or unrelated items
      
      ## Example imagePrompts for a pink fleece baby outfit:
      - hero: "Soft baby pink fluffy fleece toddler outfit set with bear face embroidery, full product shot, clean white studio background, centered hero composition, professional lighting"
      - detail: "Extreme close-up macro shot of adorable bear face embroidery detail on soft pink fleece fabric, showing texture and stitching quality, sharp focus"
      - styling: "Baby pink fluffy fleece outfit set styled with matching pink socks and cute bear-themed accessories, flat-lay styling, cozy nursery props"
      
      ## Special Instructions:
      - If 'fixed_text' exists: You MUST include it prominently in the 'content'
      - If 'has_fixed_image' is true: Keep the 'imagePrompt' similar to the 'visual_style'
      ${productData?.price ? `- Include price "${productData.price.toLocaleString()}원" in relevant marketing content` : ''}
      ${productData?.discountRate ? `- Mention ${productData.discountRate}% discount prominently` : ''}
      
      ## Output Format:
      Return JSON with:
      - 'productVisualDescription': Detailed English description of the product (from Step 1)
      - 'sections' array: EXACTLY ${sectionCount} sections with matching IDs and product-specific imagePrompts
      ${productData?.productName ? `The 'productName' field MUST be exactly: "${productData.productName}"` : ''}
    `;
  } else if (mode === AppMode.CREATION) {
    // 카테고리별 가이드라인 생성
    const categoryGuidelines = getCategoryPromptGuidelines();

    prompt = `
      You are an expert e-commerce merchandiser specializing in the Korean market.
      
      ## INPUT DATA FROM USER:
      ${productData?.productName ? `- Product Name: "${productData.productName}"` : ''}
      ${productData?.productFeatures ? `- Key Features to Emphasize: "${productData.productFeatures}"` : ''}
      ${productData?.price ? `- Price: ${productData.price}` : ''}
      
      ## STEP 1: Analyze Product & Detect Category
      Analyze the provided product image(s) and determine the product category:
      - Fashion/Apparel (패션/의류): clothing, shoes, bags, accessories
      - Beauty/Cosmetics (뷰티/화장품): skincare, makeup, cosmetics
      - Furniture/Interior (가구/인테리어): furniture, home decor
      - Living/Kitchen (생활용품/주방): kitchenware, household items
      - Food/Health (식품/건강식품): food, snacks, supplements
      - Electronics (전자제품/가전): gadgets, appliances, devices
      - Kids/Baby (유아/아동용품): baby products, toys, children's items
      - Pet Supplies (반려동물용품): pet food, pet accessories
      
      ## STEP 2: Create Product Information
      1. Create a catchy Product Name in Korean ${productData?.productName ? '(Base it on the provided Product Name)' : ''}
      2. List 4-5 key features visible or implied ${productData?.productFeatures ? '(MUST include the user-provided features)' : ''}
      3. Write a short, persuasive marketing copy in Korean (2-3 sentences)
      4. Set 'detectedCategory' to the detected category ID (fashion, beauty, furniture, living, food, electronics, kids, pet)
      
      ## STEP 3: Category-Optimized Section Structure
      Based on the detected category, create 6 sections following these category-specific guidelines:
      
      ${categoryGuidelines}
      
      ## IMPORTANT RULES:
      1. You MUST detect the category first and use the corresponding section structure
      2. Each section should have:
         - A compelling Korean title matching the category template
         - Detailed Korean content (3-5 sentences) tailored to the product
         - An image generation prompt that matches the category's visual style
      3. The section structure should feel natural and optimized for the product type
      4. All content should be in Korean except imagePrompt (Korean or English)
      
      ## CRITICAL - imagePrompt Guidelines:
      When creating 'imagePrompt' for each section, you MUST:
      ${productData?.productFeatures ? `- Reflect the user-provided features in the visual details: "${productData.productFeatures}"` : ''}
      - Always describe the SAME EXACT product from the uploaded images
      - Focus on changing ONLY: background, lighting, angle, props, scene, styling
      - NEVER describe a different or modified product
      - The product's shape, color, design, texture must remain identical
      - Example format: "The same [product name] placed on a wooden table, soft natural lighting, lifestyle setting"
      - Always start with "The same product..." or "The exact product from the reference..."
      
      ## Output Format:
      Return JSON with:
      - productName: Korean product name
      - mainFeatures: array of 4-5 features
      - marketingCopy: Korean marketing text
      - detectedCategory: category ID (fashion, beauty, furniture, living, food, electronics, kids, pet)
      - sections: array of 6 category-optimized sections
    `;
  } else {
    // Mode B: Localization
    prompt = `
      You are an expert translator and localization specialist for the Korean market.
      The provided image(s) are screenshots of an existing product detail page in a foreign language (English, Chinese, etc.).
      
      ## CRITICAL MISSION:
      Your goal is to accurately translate foreign language text in product images to natural, persuasive Korean (의역 - free translation) while maintaining 100% visual consistency with the original images. The product and all visual elements must remain ABSOLUTELY IDENTICAL - only text language changes.
      
      ## Your Tasks:
      1. **Extract Content**: Analyze all images and extract:
         - All visible text content (product names, descriptions, features, prices, etc.)
         - Section structure and layout
         - Visual elements (product images, icons, graphics)
         - Text positions, sizes, styles, and colors (for accurate replacement)
      
      2. **Translate Content**: Convert all foreign language text into natural, persuasive Korean:
         - Use 의역 (free translation) for natural, marketing-effective Korean
         - Product names and descriptions: natural Korean or transliteration as appropriate
         - Marketing copy and features: persuasive and natural in Korean
         - Section titles and content: maintain original meaning and tone
         - Consider Korean market preferences and expressions
      
      3. **Maintain Structure**: Keep the original section flow and layout exactly as shown
      
      4. **Image Prompt Strategy** (CRITICAL for 'imagePrompt' field):
         For each section, analyze the image and determine:
         
         **Case A: Text is CLEAR and TRANSLATABLE (80%+ readable)**
         - If the text in the image is clearly readable and can be accurately translated:
           → Create an imagePrompt that instructs: "Recreate this EXACT layout with Korean text replacing the original text at the SAME position, size, and style"
           → Include the Korean translation in the prompt
           → Example format: "The EXACT same product and layout from the reference image, with Korean text '[translated text]' replacing the original text at [position], maintaining the same text size, style, and color"
         
         **Case B: Text is UNCLEAR or UNTRANSLATABLE (Default)**
         - If the text is blurry, low resolution, partially obscured, or cannot be accurately translated:
         - If text readability is less than 80%:
         - If translation is uncertain due to image quality:
           → Create an imagePrompt that instructs: "Remove ALL text from the image, keep ONLY the visual elements"
           → Example: "The EXACT same product and visual elements from the reference image without any text overlay, clean design, professional photography"
           → **DEFAULT ACTION: REMOVE TEXT** (this is the default when translation is uncertain)
         
         **Decision Rule**:
         - If you can clearly read and translate 80%+ of the text → Use Case A (TRANSLATE)
         - If text is unclear, blurry, or less than 80% readable → Use Case B (REMOVE TEXT) - DEFAULT
         - When in doubt → Use Case B (REMOVE TEXT) - this is the default
         - If image resolution is low → Use Case B (REMOVE TEXT)
         - If text is stylized graphics that are hard to translate → Use Case B (REMOVE TEXT)
      
      ## CRITICAL - imagePrompt Guidelines:
      When creating 'imagePrompt' for each section, you MUST:
      - **ABSOLUTELY MAINTAIN** the product/visual elements IDENTICAL to the original
      - The product's shape, color, design, texture must be EXACTLY the same
      - Background, layout, composition, lighting, shadows must remain EXACTLY the same
      - Camera angle, perspective, scene composition must be IDENTICAL
      - NEVER describe a different or modified product
      - For text handling:
        * If text is clear and translatable: "Korean text: '[translated text]' replacing original text at [position], same size/style/color"
        * If text is unclear/unt translatable: "No text overlay, clean image without text, EXACT same visual elements"
        * Default: Remove text when uncertain (REMOVE TEXT is the default)
      
      ## Output Requirements:
      - All 'title' and 'content' fields must be in Korean (translated from original using 의역)
      - 'imagePrompt' must clearly indicate:
        * Whether to include Korean text or remove text (default: remove if uncertain)
        * How to maintain 100% visual consistency with original
        * Exact text position, size, style if translating
        * Default to text removal when translation is uncertain
    `;
  }

  try {
    // Construct parts array with multiple images
    const imageParts = base64Images.map((b64, index) => ({
      inlineData: { mimeType: mimeTypes[index], data: b64 }
    }));

    // GAS 프록시를 통한 호출 시도
    const gasUrl = getGasUrl(true); // 기본값 포함하여 가져오기

    // localStorage에 실제로 저장된 값 확인 (디버깅)
    const rawSavedUrl = localStorage.getItem('gemini_commerce_gas_url');
    console.log('[Gemini Service] localStorage 원본 값:', rawSavedUrl);
    console.log('[Gemini Service] getGasUrl() 결과:', gasUrl);
    console.log('[Gemini Service] DEFAULT_GAS_URL:', DEFAULT_GAS_URL);

    // URL 정규화 비교
    const normalizedGasUrl = gasUrl ? normalizeUrlForComparison(gasUrl) : '';
    const normalizedDefaultUrl = normalizeUrlForComparison(DEFAULT_GAS_URL);
    const isDefaultUrl = normalizedGasUrl === normalizedDefaultUrl;

    console.log('[Gemini Service] 원본 사용자 URL:', gasUrl);
    console.log('[Gemini Service] 원본 기본 URL:', DEFAULT_GAS_URL);
    console.log('[Gemini Service] 정규화된 사용자 URL:', normalizedGasUrl);
    console.log('[Gemini Service] 정규화된 기본 URL:', normalizedDefaultUrl);
    console.log('[Gemini Service] 기본 URL과 동일한지:', isDefaultUrl);
    console.log('[Gemini Service] URL 길이 비교 - 사용자:', normalizedGasUrl.length, '기본:', normalizedDefaultUrl.length);

    // URL이 실제로 다른지 문자 단위로 비교
    if (normalizedGasUrl && normalizedDefaultUrl) {
      const diffIndex = Array.from(normalizedGasUrl).findIndex((char, i) => char !== normalizedDefaultUrl[i]);
      if (diffIndex !== -1) {
        console.log('[Gemini Service] 첫 번째 차이점 위치:', diffIndex);
        console.log('[Gemini Service] 사용자 URL의 문자:', normalizedGasUrl[diffIndex], '기본 URL의 문자:', normalizedDefaultUrl[diffIndex]);
      }
    }

    // GAS URL이 설정되어 있고 기본 데모 URL이 아니면 프록시 사용
    if (gasUrl && gasUrl.trim() !== '' && !isDefaultUrl) {
      // GAS 프록시 사용
      const result = await callGeminiViaProxy({
        model: MODEL_TEXT_VISION,
        contents: {
          parts: [
            ...imageParts.map(p => ({ inlineData: p.inlineData } as GeminiInlineDataPart)),
            { text: prompt } as GeminiTextPart
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: productAnalysisSchema,
          temperature: 0.4,
        }
      });

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No response from Gemini");

      const analysis = JSON.parse(text) as ProductAnalysis;

      // 템플릿 모드: 템플릿 구조를 기반으로 강제 매핑 (100% 구조 유지)
      if (template) {
        return applyTemplateStructure(analysis, template, productData);
      }

      return analysis;
    }

    // GAS 프록시를 사용할 수 없는 경우
    console.warn('[Gemini Service] GAS 프록시를 사용할 수 없습니다. Fallback으로 환경 변수 확인');
    console.warn('[Gemini Service] 현재 GAS URL:', gasUrl);
    console.warn('[Gemini Service] 기본 URL과 동일한지:', isDefaultUrl);

    // GAS 프록시가 없으면 환경 변수에서 API 키 확인 (Fallback)
    const apiKey = (window as any).__GEMINI_API_KEY__ ||
      (import.meta.env?.VITE_GEMINI_API_KEY as string);

    if (!apiKey) {
      const errorMessage = isDefaultUrl
        ? 'GAS 프록시가 설정되지 않았습니다.\n\n' +
        '✅ Google Apps Script에 GEMINI_API_KEY를 스크립트 속성으로 설정하셨다면,\n' +
        '   애플리케이션 설정에서 GAS Web App URL을 입력해주세요.\n\n' +
        '   [설정 방법]\n' +
        '   1. 우측 상단 ⚙️ 아이콘 클릭\n' +
        '   2. "구글 시트 연동" 탭 선택\n' +
        '   3. "Google Apps Script (GAS) Web App URL" 필드에\n' +
        '      배포한 웹 앱 URL 입력\n' +
        '   4. "설정 저장하기" 클릭\n\n' +
        '   또는 환경 변수 사용:\n' +
        '   - .env 파일에 VITE_GEMINI_API_KEY=your_key 추가'
        : 'Gemini API 키가 설정되지 않았습니다.\n\n' +
        '방법 1: GAS 프록시 사용 (권장)\n' +
        '  - Google Apps Script에 GEMINI_API_KEY를 스크립트 속성으로 설정\n' +
        '  - GAS Web App URL을 설정에 입력\n\n' +
        '방법 2: 환경 변수 사용\n' +
        '  - .env 파일에 VITE_GEMINI_API_KEY=your_key 추가';

      throw new Error(errorMessage);
    }

    // 직접 API 호출 (Fallback)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_TEXT_VISION}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: {
            parts: [
              ...imageParts, // Add all images
              { text: prompt }
            ]
          },
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: productAnalysisSchema,
            temperature: 0.4,
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Gemini API 오류: ${response.status} - ${errorData}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error("No response from Gemini");

    const analysis = JSON.parse(text) as ProductAnalysis;

    // 템플릿 모드: 템플릿 구조를 기반으로 강제 매핑 (100% 구조 유지)
    if (template) {
      return applyTemplateStructure(analysis, template, productData);
    }

    return analysis;
  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};

/**
 * Edit a single image: translate or remove foreign language text
 * 단일 이미지의 외국어 텍스트를 한국어로 번역하거나 삭제
 * @param progressCallback 진행 상태 업데이트 콜백 (step, message)
 */
export const editSingleImageWithProgress = async (
  base64Image: string,
  mimeType: string,
  progressCallback?: (step: string, message: string) => void
): Promise<string> => {
  const reportProgress = (step: string, message: string) => {
    if (progressCallback) {
      progressCallback(step, message);
    }
    console.log(`[editSingleImage] ${step}: ${message}`);
  };

  try {
    // 1단계: 이미지 분석 - 텍스트 감지 및 번역 가능 여부 판단
    reportProgress('1단계', '이미지 분석 중...');

    const analysisPrompt = `
You are an expert image analyzer and translator specializing in Korean localization.

## CRITICAL MISSION:
Your goal is to accurately translate foreign language text in product images to natural, persuasive Korean while maintaining 100% visual consistency with the original image.

## Analysis Tasks:
1. **Detect ALL visible text** in the image (any language: English, Chinese, Japanese, etc.)
   - Include text in product labels, descriptions, features, prices, etc.
   - Note the exact position, size, style, and color of each text element

2. **Assess text clarity and translatability:**
   - Can you clearly read 80%+ of the text? → TRANSLATABLE (preferred)
   - Is the text blurry, low resolution, or partially obscured? → REMOVE_TEXT
   - Is the text stylized graphics that are hard to translate? → REMOVE_TEXT

3. **If translatable, provide ACCURATE Korean translations:**
   - Use natural, persuasive Korean (의역 - free translation for marketing effectiveness)
   - Maintain the original meaning and tone
   - Consider Korean market preferences and expressions
   - For product names: use natural Korean or transliteration as appropriate
   - For marketing copy: make it persuasive and natural in Korean

4. **Document text details:**
   - Original text
   - Korean translation (의역)
   - Exact position description (top-left, center, bottom-right, etc.)
   - Text style hints (bold, italic, size, color if visible)

## Output JSON format:
{
  "action": "translate" | "remove",
  "detectedText": [
    {
      "original": "original text",
      "korean": "자연스럽고 설득력 있는 한국어 번역 (의역)",
      "position": "exact position description (e.g., 'top-center, above product', 'bottom-right corner')",
      "style": "text style hints if visible (e.g., 'bold white text', 'small gray text')"
    }
  ],
  "reason": "why translate or remove"
}
    `;

    // 분석 요청
    reportProgress('1단계', '텍스트 감지 및 번역 가능 여부 판단 중...');
    console.log('[editSingleImage] 1단계: 이미지 분석 시작', {
      model: MODEL_TEXT_VISION,
      hasImage: !!base64Image,
      imageSize: base64Image?.length || 0
    });

    // 이미지 분석은 시간이 걸릴 수 있으므로 명시적으로 3분 타임아웃 적용
    let analysisResult;
    try {
      analysisResult = await callGeminiViaProxy({
        model: MODEL_TEXT_VISION,
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Image } } as GeminiInlineDataPart,
            { text: analysisPrompt } as GeminiTextPart
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["translate", "remove"] },
              detectedText: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    original: { type: "string" },
                    korean: { type: "string" },
                    position: { type: "string" },
                    style: { type: "string" }
                  }
                }
              },
              reason: { type: "string" }
            },
            required: ["action", "detectedText", "reason"]
          },
          temperature: 0.3,
        }
      }, 180000); // 이미지 분석: 3분 타임아웃

      console.log('[editSingleImage] 1단계: 이미지 분석 완료', {
        hasResult: !!analysisResult,
        hasCandidates: !!analysisResult?.candidates,
        candidatesCount: analysisResult?.candidates?.length || 0
      });
    } catch (error) {
      console.error('[editSingleImage] 1단계: 이미지 분석 실패', error);
      reportProgress('오류', `이미지 분석 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      throw error;
    }

    const analysisText = analysisResult.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!analysisText) throw new Error("이미지 분석 실패");

    reportProgress('1단계', '분석 결과 처리 중...');
    const analysis = JSON.parse(analysisText);
    const shouldTranslate = analysis.action === "translate";

    reportProgress('2단계', shouldTranslate ? '한국어로 번역하여 이미지 생성 중...' : '텍스트 제거하여 이미지 생성 중...');

    // 2단계: 이미지 생성 프롬프트 생성
    let imagePrompt = "";

    if (shouldTranslate && analysis.detectedText && analysis.detectedText.length > 0) {
      // 번역 모드: 한국어 텍스트로 교체
      const translations = analysis.detectedText
        .map((item: any) => {
          const position = item.position || 'original position';
          const style = item.style ? ` (${item.style})` : '';
          return `"${item.original}" → "${item.korean}" at ${position}${style}`;
        })
        .join("\n   ");

      imagePrompt = `
## CRITICAL INSTRUCTIONS - MUST FOLLOW EXACTLY:

### 1. MAINTAIN 100% VISUAL CONSISTENCY WITH ORIGINAL IMAGE
   - The product's shape, color, design, texture, and ALL visual details must be IDENTICAL to the reference
   - Background, layout, composition, lighting, shadows, reflections must remain EXACTLY the same
   - Camera angle, perspective, and scene composition must be IDENTICAL
   - Do NOT modify, change, or replace ANY visual element except text
   - The image should look like the original with ONLY text changed

### 2. REPLACE TEXT WITH KOREAN TRANSLATIONS
   Replace the following foreign language text with Korean translations:
   ${translations}
   
   **Text Replacement Rules:**
   - Maintain the EXACT same text position as the original
   - Keep the same text size, font weight, and style
   - Preserve the same text color and effects (shadows, outlines, etc.)
   - Use natural, professional Korean typography that fits the design
   - Keep the same visual hierarchy and text alignment
   - If text was bold/italic in original, keep it bold/italic in Korean
   - Text should look like it was originally designed in Korean

### 3. FINAL CHECK
   - Compare side-by-side: Original vs. Edited
   - The ONLY difference should be the language of the text
   - Everything else (product, background, layout, colors, lighting) must be IDENTICAL
   - The edited image should be indistinguishable from the original except for text language

Generate the edited image with Korean text replacing the original text.
High quality, professional product photography. Pixel-perfect consistency with original.
      `.trim();
    } else {
      // 제거 모드: 텍스트 제거
      imagePrompt = `
CRITICAL INSTRUCTIONS FOR IMAGE EDITING:
1. Keep the EXACT same product and visual elements from the reference image
   - Product's shape, color, design, texture must be IDENTICAL
   - Background, layout, composition must remain the same
   - Do NOT modify the product itself

2. REMOVE ALL TEXT from the image
   - Remove any text overlays, labels, or text elements
   - Keep only the visual elements (product, background, graphics)
   - Create a clean, text-free version
   - Fill any text areas naturally with background or product elements

3. Maintain the original visual style and composition
   - Same lighting, angle, and scene composition
   - Professional, high-quality photography

Generate the edited image without any text.
High quality, professional product photography without text overlay.
      `.trim();
    }

    // 3단계: 이미지 생성
    const parts: GeminiPart[] = [
      { inlineData: { data: base64Image, mimeType } } as GeminiInlineDataPart,
      { text: imagePrompt } as GeminiTextPart
    ];

    const gasUrl = getGasUrl(true);
    const normalizedGasUrl = gasUrl ? normalizeUrlForComparison(gasUrl) : '';
    const normalizedDefaultUrl = normalizeUrlForComparison(DEFAULT_GAS_URL);
    const isDefaultUrl = normalizedGasUrl === normalizedDefaultUrl;

    if (gasUrl && gasUrl.trim() !== '' && !isDefaultUrl) {
      // GAS 프록시 사용
      reportProgress('2단계', '이미지 생성 중... (시간이 다소 걸릴 수 있습니다)');
      // 이미지 생성은 시간이 오래 걸리므로 명시적으로 5분 타임아웃 적용
      const result = await callGeminiViaProxy({
        model: MODEL_IMAGE_GEN,
        contents: { parts },
      }, 300000); // 이미지 생성: 5분 타임아웃

      reportProgress('2단계', '생성된 이미지 처리 중...');
      for (const part of result.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          reportProgress('완료', '이미지 수정 완료!');
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }

      throw new Error("이미지 생성 실패");
    }

    // Fallback: 환경 변수에서 API 키 확인
    const apiKey = (window as any).__GEMINI_API_KEY__ ||
      (import.meta.env?.VITE_GEMINI_API_KEY as string);

    if (!apiKey) {
      throw new Error(
        'Gemini API 키가 설정되지 않았습니다.\n\n' +
        '방법 1: GAS 프록시 사용 (권장)\n' +
        '  - Google Apps Script에 GEMINI_API_KEY를 스크립트 속성으로 설정\n' +
        '  - GAS Web App URL을 설정에 입력\n\n' +
        '방법 2: 환경 변수 사용\n' +
        '  - .env 파일에 VITE_GEMINI_API_KEY=your_key 추가'
      );
    }

    // 직접 API 호출 (Fallback)
    reportProgress('2단계', '이미지 생성 중... (Fallback 모드)');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IMAGE_GEN}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: { parts }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Gemini API 오류: ${response.status} - ${errorData}`);
    }

    const result = await response.json();

    reportProgress('2단계', '생성된 이미지 처리 중...');
    for (const part of result.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        reportProgress('완료', '이미지 수정 완료!');
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("이미지 생성 실패");
  } catch (error) {
    console.error("Image editing failed:", error);
    if (progressCallback) {
      progressCallback('오류', `이미지 수정 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
    throw error;
  }
};

/**
 * Edit a single image: translate or remove foreign language text (기존 함수, 호환성 유지)
 * 단일 이미지의 외국어 텍스트를 한국어로 번역하거나 삭제
 */
export const editSingleImage = async (
  base64Image: string,
  mimeType: string
): Promise<string> => {
  return editSingleImageWithProgress(base64Image, mimeType);
};

/**
 * Generate a new image for a section using Gemini
 * 원본 이미지의 제품을 그대로 유지하면서 새로운 장면/구도로 생성
 */
export const generateSectionImage = async (
  prompt: string,
  referenceImageBase64?: string,
  referenceMimeType?: string,
  mode: AppMode = AppMode.CREATION,
  modelSettings?: import('../types').ModelSettings
): Promise<string> => {
  // ⭐ DEBUG: 참조 이미지 수신 상태 확인
  console.log('[generateSectionImage] ===== 이미지 생성 시작 =====');
  console.log('[generateSectionImage] 참조 이미지 존재:', !!referenceImageBase64);
  console.log('[generateSectionImage] 참조 이미지 크기:', referenceImageBase64 ? `${Math.round(referenceImageBase64.length / 1024)}KB` : 'N/A');
  console.log('[generateSectionImage] MIME 타입:', referenceMimeType || 'N/A');
  console.log('[generateSectionImage] 모드:', mode);
  console.log('[generateSectionImage] 프롬프트:', prompt.slice(0, 100) + '...');

  if (!referenceImageBase64) {
    console.warn('[generateSectionImage] ⚠️ 참조 이미지가 없습니다! 상품 일관성이 유지되지 않을 수 있습니다.');
  }

  try {
    let fullPrompt = "";

    if (referenceImageBase64 && referenceMimeType) {
      // 원본 이미지가 있는 경우 - 제품 동일성 유지 강조
      if (mode === AppMode.LOCALIZATION) {
        // 프롬프트에서 텍스트 처리 지시 확인
        const shouldRemoveText = prompt.toLowerCase().includes('no text') ||
          prompt.toLowerCase().includes('remove text') ||
          prompt.toLowerCase().includes('without text') ||
          prompt.toLowerCase().includes('clean image') ||
          prompt.toLowerCase().includes('text-free');

        const hasKoreanText = prompt.includes('한국어') ||
          prompt.includes('Korean text') ||
          prompt.match(/['"](.*?)['"]/); // 따옴표로 둘러싸인 텍스트

        if (shouldRemoveText) {
          // 텍스트 제거 모드
          fullPrompt = `
## CRITICAL INSTRUCTIONS FOR LOCALIZATION - MUST FOLLOW EXACTLY:

### 1. MAINTAIN 100% VISUAL CONSISTENCY WITH ORIGINAL IMAGE
   - The product's shape, color, design, texture, and ALL visual details must be IDENTICAL to the reference
   - Background, layout, composition, lighting, shadows, reflections must remain EXACTLY the same
   - Camera angle, perspective, and scene composition must be IDENTICAL
   - Do NOT modify, change, or replace ANY visual element except text
   - The image should look like the original with ONLY text removed

### 2. REMOVE ALL TEXT FROM THE IMAGE
   - Remove any text overlays, labels, or text elements
   - Keep only the visual elements (product, background, graphics)
   - Create a clean, text-free version
   - Fill any text areas naturally with background or product elements

### 3. FINAL CHECK
   - Compare side-by-side: Original vs. Edited
   - The ONLY difference should be the absence of text
   - Everything else (product, background, layout, colors, lighting) must be IDENTICAL
   - The edited image should be indistinguishable from the original except for text removal

Based on the reference image, recreate: ${prompt}
High quality, professional product photography without any text. Pixel-perfect consistency with original.
          `.trim();
        } else if (hasKoreanText) {
          // 한국어 텍스트 포함 모드
          fullPrompt = `
## CRITICAL INSTRUCTIONS FOR LOCALIZATION - MUST FOLLOW EXACTLY:

### 1. MAINTAIN 100% VISUAL CONSISTENCY WITH ORIGINAL IMAGE
   - The product's shape, color, design, texture, and ALL visual details must be IDENTICAL to the reference
   - Background, layout, composition, lighting, shadows, reflections must remain EXACTLY the same
   - Camera angle, perspective, and scene composition must be IDENTICAL
   - Do NOT modify, change, or replace ANY visual element except text
   - The image should look like the original with ONLY text language changed

### 2. REPLACE TEXT WITH KOREAN TRANSLATIONS
   - Remove original foreign language text
   - Add Korean text as specified in the prompt
   - Maintain the EXACT same text position, size, style, and color as the original
   - Use natural, professional Korean typography that fits the design
   - Keep the same visual hierarchy and text alignment
   - If text was bold/italic in original, keep it bold/italic in Korean
   - Text should look like it was originally designed in Korean

### 3. FINAL CHECK
   - Compare side-by-side: Original vs. Edited
   - The ONLY difference should be the language of the text
   - Everything else (product, background, layout, colors, lighting) must be IDENTICAL
   - The edited image should be indistinguishable from the original except for text language

Based on the reference image, recreate: ${prompt}
High quality, professional product photography with Korean text. Pixel-perfect consistency with original.
          `.trim();
        } else {
          // 기본: 텍스트 제거 (불확실한 경우)
          fullPrompt = `
## CRITICAL INSTRUCTIONS FOR LOCALIZATION - MUST FOLLOW EXACTLY:

### 1. MAINTAIN 100% VISUAL CONSISTENCY WITH ORIGINAL IMAGE
   - The product's shape, color, design, texture, and ALL visual details must be IDENTICAL to the reference
   - Background, layout, composition, lighting, shadows, reflections must remain EXACTLY the same
   - Camera angle, perspective, and scene composition must be IDENTICAL
   - Do NOT modify, change, or replace ANY visual element except text
   - The image should look like the original with ONLY text removed

### 2. DEFAULT ACTION: REMOVE ALL TEXT (When translation is uncertain)
   - Remove any text overlays, labels, or text elements
   - Keep only the visual elements (product, background, graphics)
   - Create a clean, text-free version
   - Fill any text areas naturally with background or product elements

### 3. FINAL CHECK
   - Compare side-by-side: Original vs. Edited
   - The ONLY difference should be the absence of text
   - Everything else (product, background, layout, colors, lighting) must be IDENTICAL

Based on the reference image, recreate: ${prompt}
High quality, professional product photography without any text overlay. Pixel-perfect consistency with original.
          `.trim();
        }
      } else {
        // ★ 모델 설정을 분리하여 프롬프트에 추가 (외모와 촬영 스타일 분리)
        const modelAppearance = buildModelAppearanceDescription(modelSettings);
        const modelCutStyleDirective = buildModelCutStyleDirective(modelSettings);

        console.log('[generateSectionImage] 모델 외모:', modelAppearance || '(없음)');
        console.log('[generateSectionImage] 모델컷 스타일:', modelSettings?.modelCutStyle || '(없음)');

        // ★ 후면 프롬프트 감지 시 참조 이미지가 후면임을 명시
        const isBackViewPrompt = prompt.includes('BACK VIEW') || prompt.includes('back design');
        const backViewPreamble = isBackViewPrompt ? `## ⚠️ BACK VIEW REFERENCE IMAGE PROVIDED
The reference image shows the BACK DESIGN of the garment.
You MUST replicate this exact back design: same pattern, texture, stitching, decorations, length, and ALL visual details.
DO NOT invent, modify, or guess any back design elements. Copy them EXACTLY from the reference image.
The model must be facing AWAY from camera, showing the complete back of the garment.

` : '';

        // ★ 두 가지 요구사항을 동등하게 병렬 배치
        fullPrompt = `${modelCutStyleDirective ? `${modelCutStyleDirective}\n\n` : ''}${backViewPreamble}
## ⚠️ TWO EQUALLY CRITICAL REQUIREMENTS - MUST SATISFY BOTH:

### REQUIREMENT A: REAL HUMAN MODEL (NOT MANNEQUIN)
This is a FASHION LOOKBOOK photo featuring a REAL, LIVING HUMAN MODEL.
- VISIBLE HUMAN SKIN with natural texture (not plastic, not fabric-like)
- NATURAL HUMAN POSTURE with realistic body proportions
- The model's BODY must be clearly visible (arms, torso, legs as appropriate)
- The garment must drape naturally on a real person's body
- This is NOT: a mannequin, display form, headless figure, or clothes on a hanger

### REQUIREMENT B: EXACT PRODUCT REPLICATION (CRITICAL)
The product MUST be VISUALLY IDENTICAL to the reference image.
- Copy every stitch line, seam position, and construction detail exactly
- Button/zipper count, placement, and style must match
- Pattern alignment, scale, and orientation must be preserved
- Material texture and color shade must be identical (not just "black" but THE black)
- Logo position, size, and design must match if present
- Pocket placement, collar/neckline shape, sleeve length must be exact
- The product must be recognizable as the EXACT SAME item, not a similar one
- ⚠️ COLOR ACCURACY IS CRITICAL: The garment color must be the EXACT shade specified in the prompt.
  If a specific color name is mentioned (e.g., "ivory", "wine", "beige"), the garment MUST be that exact color.
  DO NOT substitute with a similar color. DO NOT darken, lighten, or shift the hue.
  If a HEX color code is provided, match it precisely.

⚠️ BOTH requirements are equally critical. Do NOT sacrifice product accuracy for model quality or vice versa.

## FRAMING REQUIREMENT:
The ENTIRE product must be fully visible. 
- DO NOT CROP any part of the product (sleeves, hem, neckline, sides)
- Leave breathing room around the product
- For full-body shots, show from head (or chin if anonymous) to feet
- For upper-body shots, show from chin down to waist/hip with full shoulders and arms

${modelAppearance ? `## MODEL APPEARANCE:
- The model should be: ${modelAppearance}
- The product must be worn by this model naturally
` : ''}

## WHAT YOU CAN CHANGE:
- Background setting and environment
- Lighting style and direction
${!modelCutStyleDirective ? '- Camera angle and composition' : '- Camera angle MUST follow the override directive above'}
- Props and context elements
${modelAppearance ? '- Model appearance as specified above' : ''}

## PHOTO SPECIFICATIONS:
${prompt}

## FINAL CHECK:
Before generating, verify BOTH:
1. Is there a REAL HUMAN BODY visible wearing this garment?
2. Is the product VISUALLY IDENTICAL to the reference (every detail matches)?
${modelCutStyleDirective ? '3. Does the camera angle match the OVERRIDE directive at the top?' : ''}

High quality, hyperrealistic, ultra photorealistic, shot on Canon EOS R5 with 85mm f/1.4 lens, natural lighting, RAW photo quality, 8K resolution. The image must look like a REAL PHOTOGRAPH taken by a professional photographer — NOT an AI-generated or CGI image. Realistic skin texture, natural fabric draping, authentic lighting with soft shadows.
        `.trim();
      }
    } else {
      // 원본 이미지가 없는 경우 - 모델 설정 적용
      const modelDescription = buildModelDescription(modelSettings);
      fullPrompt = `Hyperrealistic professional fashion photography, shot on Canon EOS R5, natural lighting, RAW photo, ultra photorealistic: ${prompt}${modelDescription ? `\n\nModel requirements: ${modelDescription}` : ''}`;
    }

    const parts: GeminiPart[] = [{ text: fullPrompt } as GeminiTextPart];

    if (referenceImageBase64 && referenceMimeType) {
      parts.unshift({
        inlineData: {
          data: referenceImageBase64,
          mimeType: referenceMimeType
        }
      } as GeminiInlineDataPart);
    }


    // GAS 프록시를 통한 호출 시도
    const gasUrl = getGasUrl(true);

    // URL 정규화 비교
    const normalizedGasUrl = gasUrl ? normalizeUrlForComparison(gasUrl) : '';
    const normalizedDefaultUrl = normalizeUrlForComparison(DEFAULT_GAS_URL);
    const isDefaultUrl = normalizedGasUrl === normalizedDefaultUrl;

    console.log('[Image Generate] 정규화된 기본 URL:', normalizedDefaultUrl);
    console.log('[Image Generate] 기본 URL과 비교 (정규화 후):', isDefaultUrl);

    // GAS URL이 설정되어 있고 기본 데모 URL이 아니면 프록시 사용
    if (gasUrl && gasUrl.trim() !== '' && !isDefaultUrl) {
      // ⭐ 안전 설정: 패션 모델 이미지 생성 시 과도한 필터링 방지
      const imageGenSafetySettings: GeminiSafetySettings[] = [
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_ONLY_HIGH"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_ONLY_HIGH"
        },
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_ONLY_HIGH"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_ONLY_HIGH"
        }
      ];

      // GAS 프록시 사용
      const result = await callGeminiViaProxy({
        model: MODEL_IMAGE_GEN,
        contents: { parts },
        config: {
          temperature: 0.25,  // ★ 0.3→0.25: 색상 일관성과 포즈 다양성의 최적 균형점
          topK: 20            // ★ 32→20: 적절한 선택지 범위로 일관성 향상
        },
        safetySettings: imageGenSafetySettings
      });

      for (const part of result.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }

      throw new Error("No image generated");
    }

    // GAS 프록시가 없으면 환경 변수에서 API 키 확인 (Fallback)
    const apiKey = (window as any).__GEMINI_API_KEY__ ||
      (import.meta.env?.VITE_GEMINI_API_KEY as string);

    if (!apiKey) {
      throw new Error(
        'Gemini API 키가 설정되지 않았습니다.\n\n' +
        '방법 1: GAS 프록시 사용 (권장)\n' +
        '  - Google Apps Script에 GEMINI_API_KEY를 스크립트 속성으로 설정\n' +
        '  - GAS Web App URL을 설정에 입력\n\n' +
        '방법 2: 환경 변수 사용\n' +
        '  - .env 파일에 VITE_GEMINI_API_KEY=your_key 추가'
      );
    }

    // 직접 API 호출 (Fallback)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IMAGE_GEN}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: { parts }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Gemini API 오류: ${response.status} - ${errorData}`);
    }

    const result = await response.json();

    for (const part of result.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image generated");
  } catch (error) {
    console.error("Image generation failed:", error);
    return `https://picsum.photos/800/800?random=${Math.random()}`;
  }
};

// ============================================
// 이미지 고도화 기능 (C모드)
// ============================================

import type {
  ImageEnhancementType,
  BackgroundType,
  ImageEnhancementOptions,
  ModelSettings
} from "../types";

/**
 * 배경 유형별 프롬프트 매핑
 */
const BACKGROUND_PROMPTS: Record<BackgroundType, string> = {
  studio_white: 'clean white studio background, professional soft lighting, subtle shadows',
  studio_gray: 'elegant gray gradient studio background, professional lighting, modern aesthetic',
  nature: 'beautiful outdoor natural background, soft sunlight filtering through trees, greenery, fresh and inviting atmosphere',
  city: 'modern city street background, urban style, soft bokeh effect, fashionable atmosphere',
  cafe: 'cozy cafe interior background, warm ambient lighting, wooden textures, comfortable atmosphere',
  home: 'modern minimalist home interior, clean and bright, lifestyle setting',
  abstract: 'artistic abstract gradient background, smooth color transitions, modern and stylish',
  custom: ''
};

/**
 * 이미지 고도화 유형별 프롬프트 템플릿
 */
const ENHANCEMENT_PROMPT_TEMPLATES: Record<ImageEnhancementType, (product: string, options: ImageEnhancementOptions, modelDesc: string, cutStyleDirective?: string) => string> = {
  background_change: (product, options, _, __) => {
    const bgPrompt = options.backgroundType ? BACKGROUND_PROMPTS[options.backgroundType] : BACKGROUND_PROMPTS.studio_white;
    return `Professional product photography of ${product}. 
${bgPrompt}. 
The product must be clearly visible and be the main focus. 
High quality, 4K resolution, e-commerce ready photography.
${options.customPrompt || ''}`.trim();
  },

  model_shot: (product, options, modelDesc, cutStyleDirective) => {
    const modelDescription = modelDesc || 'a professional model';
    const cutStyleSection = cutStyleDirective ? `${cutStyleDirective}\n\n` : '';
    return `${cutStyleSection}Fashion photography of ${modelDescription} wearing/holding ${product}.
${!cutStyleDirective ? 'Full body shot, natural confident pose, looking at camera.' : 'The camera angle and pose MUST follow the override directive above.'}
Clean studio or lifestyle background, professional lighting.
The product (${product}) must be clearly visible and the main focus.
High quality, 4K resolution, fashion e-commerce photography.
${options.customPrompt || ''}`.trim();
  },

  lifestyle: (product, options, _) => {
    return `Lifestyle product photography of ${product} in a real-life context.
Natural setting showing the product being used in daily life.
Warm, inviting atmosphere, soft natural lighting.
The product must be clearly visible and recognizable.
High quality, 4K resolution, lifestyle photography.
${options.customPrompt || ''}`.trim();
  },

  multi_angle: (product, options, _) => {
    return `Professional product photography collage of ${product} from multiple angles.
Create a 2x2 grid showing:
- Top left: Front view
- Top right: Side profile  
- Bottom left: Back view
- Bottom right: Detail close-up
Clean white studio background for all shots.
Consistent lighting across all angles.
High quality, 4K resolution, e-commerce ready.
${options.customPrompt || ''}`.trim();
  },

  remove_bg: (product, _, __) => {
    return `Studio product photography of ${product} on a pure white background.
Clean isolated product shot, no shadows, perfect for e-commerce.
The product should be the only element visible.
High quality, 4K resolution, transparent background ready.`.trim();
  }
};

/**
 * 이미지 고도화 함수 (C모드 핵심 기능)
 * 상품 이미지를 입력받아 선택된 옵션에 따라 고도화된 이미지 생성
 * 
 * @param base64Image 원본 상품 이미지 (Base64)
 * @param mimeType 이미지 MIME 타입
 * @param options 고도화 옵션 (유형, 배경, 모델 설정 등)
 * @param onProgress 진행 상태 콜백
 * @returns 생성된 이미지 URL (Base64 data URL)
 */
export const enhanceProductImage = async (
  base64Image: string,
  mimeType: string,
  options: ImageEnhancementOptions,
  onProgress?: (step: string, message: string) => void
): Promise<string> => {
  try {
    onProgress?.('analyzing', '상품 이미지를 분석하고 있습니다...');

    // 1단계: 상품 분석 (간단한 설명 추출)
    const productDescription = await analyzeProductForEnhancement(base64Image, mimeType);
    onProgress?.('analyzed', `상품 분석 완료: ${productDescription.slice(0, 50)}...`);

    // 2단계: 모델 설명 생성 (모델컷인 경우) — 외모와 촬영 스타일 분리
    const modelAppearanceDesc = options.type === 'model_shot'
      ? buildModelAppearanceDescription(options.modelSettings)
      : '';
    const cutStyleDirective = options.type === 'model_shot'
      ? buildModelCutStyleDirective(options.modelSettings)
      : '';

    console.log('[enhanceProductImage] 모델 외모:', modelAppearanceDesc || '(없음)');
    console.log('[enhanceProductImage] 모델컷 스타일:', options.modelSettings?.modelCutStyle || '(없음)');

    // 3단계: 프롬프트 생성 (모델컷 스타일 지시를 별도로 전달)
    const promptBuilder = ENHANCEMENT_PROMPT_TEMPLATES[options.type];
    const prompt = promptBuilder(productDescription, options, modelAppearanceDesc, cutStyleDirective);

    console.log('[enhanceProductImage] Generated prompt:', prompt);
    onProgress?.('generating', '고도화된 이미지를 생성하고 있습니다...');

    // 4단계: 이미지 생성 (원본 이미지를 참조로 사용)
    const enhancedImageUrl = await generateEnhancedImage(
      prompt,
      base64Image,
      mimeType
    );

    onProgress?.('complete', '이미지 생성이 완료되었습니다!');

    return enhancedImageUrl;
  } catch (error) {
    console.error('[enhanceProductImage] Error:', error);
    throw error;
  }
};

/**
 * 이미지 고도화를 위한 상품 분석 (간소화 버전)
 * 상품의 시각적 특징만 빠르게 추출
 */
const analyzeProductForEnhancement = async (
  base64Image: string,
  mimeType: string
): Promise<string> => {
  try {
    const analysisPrompt = `Analyze this product image and provide a brief, detailed visual description in English.
Focus on:
- Product type (e.g., dress, jacket, bag, shoes)
- Material/texture (e.g., cotton, leather, knit)
- Color(s) (be specific, e.g., "soft pink" not just "pink")
- Key design elements (e.g., embroidery, buttons, patterns)

Return ONLY the description in 1-2 sentences, no explanation.
Example: "A soft pink fluffy fleece baby outfit set with bear face embroidery, ribbed cuffs and waistband"`;

    const gasUrl = getGasUrl(true);

    if (gasUrl && gasUrl.trim() !== '') {
      const result = await callGeminiViaProxy({
        model: MODEL_TEXT_VISION,
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Image } } as GeminiInlineDataPart,
            { text: analysisPrompt } as GeminiTextPart
          ]
        },
        config: {
          temperature: 0.2,
        }
      });

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      return text?.trim() || 'the product';
    }

    // Fallback
    return 'the product in the reference image';
  } catch (error) {
    console.warn('[analyzeProductForEnhancement] Analysis failed, using fallback:', error);
    return 'the product in the reference image';
  }
};

/**
 * 고도화된 이미지 생성 (원본 참조 포함)
 */
const generateEnhancedImage = async (
  prompt: string,
  referenceBase64: string,
  referenceMimeType: string
): Promise<string> => {
  const fullPrompt = `${PRODUCT_CONSISTENCY_PROMPT}

${prompt}

CRITICAL: The product in the generated image must be IDENTICAL to the reference image.
Maintain all visual details: shape, color, texture, design elements, logos, stitching.`;

  const parts: GeminiPart[] = [
    { text: fullPrompt } as GeminiTextPart,
    { inlineData: { mimeType: referenceMimeType, data: referenceBase64 } } as GeminiInlineDataPart
  ];

  const gasUrl = getGasUrl(true);

  if (gasUrl && gasUrl.trim() !== '') {
    const imageGenSafetySettings: GeminiSafetySettings[] = [
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" }
    ];

    const result = await callGeminiViaProxy({
      model: MODEL_IMAGE_GEN,
      contents: { parts },
      config: {
        temperature: 0.4,
        topK: 32
      },
      safetySettings: imageGenSafetySettings
    });

    for (const part of result.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image generated from enhancement");
  }

  throw new Error("GAS 프록시가 설정되지 않았습니다.");
};