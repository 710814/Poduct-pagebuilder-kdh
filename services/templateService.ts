import { Template, SectionData, SectionType, LayoutType } from "../types";
import { CATEGORY_PRESETS, CategoryPreset } from "./categoryPresets";

const TEMPLATE_STORAGE_KEY = 'gemini_commerce_templates';

/**
 * 기본 빈 섹션 생성
 */
export const createDefaultSection = (): SectionData => ({
  id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  title: '새 섹션',
  content: '섹션 내용을 입력하세요',
  imagePrompt: 'Professional product photography, clean background',
  sectionType: 'custom' as SectionType,
  layoutType: 'full-width' as LayoutType,
});

/**
 * 섹션 제목을 SectionType으로 매핑
 */
const mapTitleToSectionType = (title: string): SectionType => {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('타이틀') || titleLower.includes('상품명')) return 'title';
  if (titleLower.includes('메인') || titleLower.includes('비주얼') || titleLower.includes('hero')) return 'hero';
  if (titleLower.includes('설명') || titleLower.includes('소개')) return 'description';
  if (titleLower.includes('색상') || titleLower.includes('컬러')) return 'colors';
  if (titleLower.includes('소재') || titleLower.includes('원단') || titleLower.includes('디테일')) return 'material_detail';
  if (titleLower.includes('스타일') || titleLower.includes('코디')) return 'styling';
  if (titleLower.includes('핏') || titleLower.includes('사이즈') || titleLower.includes('착용')) return 'fit';
  if (titleLower.includes('스펙') || titleLower.includes('사양') || titleLower.includes('성분') || titleLower.includes('영양')) return 'spec';
  if (titleLower.includes('안내') || titleLower.includes('주의') || titleLower.includes('케어') || titleLower.includes('보관') || titleLower.includes('인증')) return 'notice';
  return 'custom';
};

/**
 * 카테고리 프리셋을 SectionData 배열로 변환
 */
export const getCategoryPresetSections = (categoryId: string): SectionData[] => {
  const preset = CATEGORY_PRESETS[categoryId];
  if (!preset) {
    return [createDefaultSection()];
  }

  return preset.sections.map((section, index) => ({
    id: `sec-${Date.now()}-${index}`,
    title: section.title,
    content: section.purpose,
    imagePrompt: section.imageStyle,
    sectionType: mapTitleToSectionType(section.title),
    layoutType: 'full-width' as LayoutType,
  }));
};

/**
 * 새 빈 템플릿 생성
 */
export const createNewTemplate = (name: string = '새 템플릿', categoryId?: string): Template => {
  return {
    id: `tpl-${Date.now()}`,
    name,
    description: categoryId
      ? `${CATEGORY_PRESETS[categoryId]?.name || ''} 카테고리 기반 템플릿`
      : '사용자 정의 템플릿',
    sections: categoryId
      ? getCategoryPresetSections(categoryId)
      : [createDefaultSection()],
    createdAt: Date.now(),
    category: categoryId,
  };
};

/**
 * 저장된 모든 템플릿 가져오기
 * ★ 빌트인 템플릿: 사용자 수정 버전이 있으면 그것을 사용, 없으면 코드 버전 사용
 */
export const getTemplates = (): Template[] => {
  const stored = localStorage.getItem(TEMPLATE_STORAGE_KEY);
  let userTemplates: Template[] = [];

  if (stored) {
    try {
      userTemplates = JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse templates", e);
      userTemplates = [];
    }
  }

  // ★ 빌트인 템플릿 목록
  const builtInTemplates = [
    FASHION_LOOKBOOK_TEMPLATE,
    OUTDOOR_CLOTHING_TEMPLATE,
    FASHION_MIRROR_SELFIE_TEMPLATE
  ];
  const builtInIds = new Set(builtInTemplates.map(t => t.id));

  // localStorage에 빌트인 템플릿 ID가 있는지 확인
  // userModifiedBuiltInIds: localStorage에 있으면서 updatedAt이 존재하는 (사용자가 명시적으로 수정한) 템플릿만 인정
  const userModifiedBuiltInIds = new Set(
    userTemplates.filter(t => builtInIds.has(t.id) && t.updatedAt).map(t => t.id)
  );

  // 사용자가 수정하지 않은 빌트인 템플릿만 코드 버전 추가
  const codeBuildIns = builtInTemplates.filter(t => !userModifiedBuiltInIds.has(t.id));

  // 결과: 코드 빌트인(수정 안된 것) + 사용자 커스텀 템플릿 + 사용자가 수정한 빌트인
  // (수정되지 않은 빌트인은 localStorage에 있더라도 updatedAt이 없으므로 무시)
  const validUserTemplates = userTemplates.filter(t => !builtInIds.has(t.id) || t.updatedAt);

  const result = [...codeBuildIns, ...validUserTemplates];

  return result;
};

/**
 * 템플릿 저장하기 (추가 또는 수정)
 */
export const saveTemplate = (template: Template) => {
  const templates = getTemplates();
  const existingIndex = templates.findIndex(t => t.id === template.id);

  let updatedTemplates: Template[];

  if (existingIndex >= 0) {
    updatedTemplates = [...templates];
    updatedTemplates[existingIndex] = template;
  } else {
    updatedTemplates = [...templates, template];
  }

  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(updatedTemplates));
};

/**
 * 템플릿 삭제하기
 */
export const deleteTemplate = (id: string) => {
  const templates = getTemplates();
  const updated = templates.filter(t => t.id !== id);
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(updated));
};

const DEFAULT_TEMPLATE_KEY = 'pagegenie_default_template_id';

/**
 * 기본 템플릿 ID 가져오기
 */
export const getDefaultTemplateId = (): string => {
  if (typeof window === 'undefined') return 'tpl-fashion-faceless-preset';
  return localStorage.getItem(DEFAULT_TEMPLATE_KEY) || 'tpl-fashion-faceless-preset';
};

/**
 * 기본 템플릿 설정하기
 */
export const setDefaultTemplateId = (id: string) => {
  localStorage.setItem(DEFAULT_TEMPLATE_KEY, id);
};

// ============================================
// 빌트인 프리셋 템플릿 (Built-in Preset Templates)
// ============================================

/**
 * 모델컷 공통 스타일 프롬프트 (얼굴 완전 익명 + 실제 인간 모델 필수)
 * ★ Gemini 권장사항 적용: 시맨틱 네거티브 대신 긍정적 표현 사용
 */

const PHOTOREALISM_KEYWORDS = 'hyperrealistic, ultra photorealistic, shot on Canon EOS R5 with 85mm f/1.4 lens, natural lighting, RAW photo quality, realistic skin texture with visible pores, authentic fabric texture with natural wrinkles, real photograph NOT AI-generated NOT CGI NOT illustration';

/**
 * 네거티브 프롬프트 -> 긍정적 설명으로 변경
 * ★ "마네킹이 아니다" 대신 "이것은 실제 인간이 착용한 패션 사진이다" 형태로 강조
 */
const NEGATIVE_ELEMENTS = 'STRICTLY ONE PERSON ONLY in the image — absolutely NO two people, NO side-by-side comparison, NO split image, NO collage. This must be a photo of a REAL PERSON wearing the garment with visible human skin, natural body movement, and realistic fabric draping. The entire product must be fully visible without any cropping. Show the complete garment from neckline to hem';

/**
 * 다양한 배경 프리셋 - 단조로움 방지
 */
const LIFESTYLE_BACKGROUNDS = {
  indoor1: 'cozy living room with a brown leather sofa and warm ambient lighting, vintage interior decor',
  indoor2: 'elegant piano room with a classic upright piano, framed artwork on walls, warm window light',
  indoor3: 'minimalist cafe interior with wooden tables, espresso cups, soft morning light through windows',
  indoor4: 'bright modern apartment with bookshelves, green plants, natural sunlight streaming in',
  outdoor1: 'charming european cobblestone street with cafe awnings, golden hour warm sunlight',
  outdoor2: 'lush green garden path with blooming flowers, soft dappled sunlight filtering through trees',
};

/**
 * 다양한 포즈 프리셋
 */
const DIVERSE_POSES = {
  standing_casual: 'relaxed standing pose, one hand touching hair, weight on one leg, natural and effortless',
  walking: 'mid-stride walking pose, natural arm swing, looking slightly to the side, dynamic movement',
  sitting: 'sitting on a chair or bench, legs crossed elegantly, one hand resting on knee, relaxed confidence',
  leaning: 'leaning against a wall or doorframe, arms casually crossed, cool and effortless vibe',
  looking_away: 'turned 3/4 away from camera, looking off into the distance, artistic and candid feel',
  holding_bag: 'holding a stylish handbag or crossbody bag, casual walk pose, lifestyle fashion shot',
};

/**
 * 패션 룩북 템플릿 v2 — 7섹션 구조
 * 히어로 → 제품설명 → 색상(2열) → 코디1(컬러별 3장) → 코디설명 → 코디2(3장) → 제품정보
 */
export const FASHION_LOOKBOOK_TEMPLATE: Template = {
  id: 'tpl-fashion-faceless-preset',
  name: '위드기프트_패션템플릿(8섹션)',
  description: '히어로 → 색상(2열) → 코디(컬러별 3장) → 라이프스타일 코디(3장) → 제품정보 → 제품소재. 다양한 배경/앵글/포즈.',
  category: 'fashion',
  isBuiltin: true,
  createdAt: 1703836800000,
  sections: [
    // ═══════════════════════════════════════════
    // 섹션 1: 히어로 이미지
    // ═══════════════════════════════════════════
    {
      id: 'sec-lookbook-hero',
      title: '히어로 이미지',
      content: '상품의 대표 이미지입니다.',
      sectionType: 'hero' as SectionType,
      layoutType: 'full-width' as LayoutType,
      imagePrompt: `REAL HUMAN MODEL wearing the product, fashion editorial HERO shot, 3/4 BODY shot from chin down showing full neckline and product silhouette, {{MODEL_SETTINGS}}, ${LIFESTYLE_BACKGROUNDS.indoor3}, warm cinematic golden lighting, high-end fashion magazine cover quality, dreamy soft bokeh background, ${PHOTOREALISM_KEYWORDS}, ${NEGATIVE_ELEMENTS}, MUST maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`
    },

    // ═══════════════════════════════════════════
    // 섹션 2: 색상 섹션 (가로 2열 그리드, 상품 중심 컷)
    // ═══════════════════════════════════════════
    {
      id: 'sec-lookbook-colors',
      title: '색상 안내',
      content: '상품의 컬러 옵션을 한눈에 보여줍니다. 각 색상별 상품 중심 이미지입니다.',
      sectionType: 'colors' as SectionType,
      layoutType: 'grid-2' as LayoutType,
      imagePrompt: 'Product-centered upper body shots showing each color option clearly. EACH IMAGE = EXACTLY 1 PERSON wearing 1 COLOR.',
      imageSlots: [
        { id: 'slot-color-1', slotType: 'color_styling', prompt: `⚠️ SINGLE MODEL ONLY — ONE person wearing EXACTLY {{COLOR_1}} colored version of the product. UPPER BODY shot from chin down showing full neckline and product silhouette, {{MODEL_SETTINGS}}, relaxed natural standing pose with one hand gently touching collar or resting at side, soft bokeh background with warm tones (background only, garment lighting remains NEUTRAL-WHITE 5500K for true color), shallow depth of field for professional feel, product fills 70% of frame, ${PHOTOREALISM_KEYWORDS}, ${NEGATIVE_ELEMENTS}, CRITICAL: the garment color MUST be {{COLOR_1}} as registered by user — do NOT change the color, Aspect Ratio 3:4`, photographyStyle: 'close-up' },
        { id: 'slot-color-2', slotType: 'color_styling', prompt: `⚠️ SINGLE MODEL ONLY — ONE person wearing EXACTLY {{COLOR_2}} colored version of the product. WAIST-UP CLOSE-UP shot emphasizing garment texture and design, {{MODEL_SETTINGS}}, confident dynamic pose leaning slightly forward or hand on hip showing energy and movement, clean minimal light-toned background with subtle texture, NEUTRAL-WHITE even illumination (no warm/cool cast) for accurate color display, crisp focus on product details, product fills 70% of frame, ${PHOTOREALISM_KEYWORDS}, ${NEGATIVE_ELEMENTS}, CRITICAL: the garment color MUST be {{COLOR_2}} as registered by user — do NOT change the color, Aspect Ratio 3:4`, photographyStyle: 'close-up' },
        { id: 'slot-color-3', slotType: 'color_styling', prompt: `⚠️ SINGLE MODEL ONLY — ONE person wearing EXACTLY {{COLOR_3}} colored version of the product. EITHER Back View showing complete back design OR artistic 3/4 side angle, {{MODEL_SETTINGS}}, turning motion or walking pose suggesting natural movement, artistic blurred background with depth and layers, NEUTRAL-WHITE balanced studio lighting for consistent color matching, cinematic composition with visual interest, product fills 70% of frame, ${PHOTOREALISM_KEYWORDS}, ${NEGATIVE_ELEMENTS}, CRITICAL: the garment color MUST be {{COLOR_3}} as registered by user — do NOT change the color, Aspect Ratio 3:4`, photographyStyle: 'close-up' },
        { id: 'slot-color-4', slotType: 'color_styling', prompt: `⚠️ SINGLE MODEL ONLY — ONE person wearing EXACTLY {{COLOR_4}} colored version of the product. UPPER BODY PRODUCT-CENTERED shot from chin down, {{MODEL_SETTINGS}}, ${DIVERSE_POSES.standing_casual}, clean simple light-colored background, NEUTRAL-WHITE diffused studio lighting (5500K) for true color reproduction, product color and silhouette are the MAIN FOCUS, product fills 70% of frame, ${PHOTOREALISM_KEYWORDS}, ${NEGATIVE_ELEMENTS}, CRITICAL: the garment color MUST be {{COLOR_4}} as registered by user — do NOT change the color, Aspect Ratio 3:4`, photographyStyle: 'close-up' }
      ]
    },

    // ═══════════════════════════════════════════
    // 섹션 4: 코디 섹션 1 — 컬러1 (세로 3장, 다양한 앵글/배경)
    // ═══════════════════════════════════════════
    {
      id: 'sec-lookbook-styling1-c1',
      title: '{{COLOR_1}} 코디',
      content: '첫 번째 컬러의 다양한 코디네이션과 디테일입니다.',
      sectionType: 'styling' as SectionType,
      layoutType: 'grid-1' as LayoutType,
      imagePrompt: `All 3 images MUST show {{COLOR_1}} colored product with IDENTICAL design, VARIED backgrounds and camera angles`,
      imageSlots: [
        { id: 'slot-s1c1-1', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_1}} colored product, WAIST-UP PRODUCT-FOCUSED shot from chin down to hip, {{MODEL_SETTINGS}}, standing straight with one hand lightly touching the garment, COMMERCIAL E-COMMERCE optimized: product fills 70% of frame, clean softly blurred background, shallow depth of field, professional studio-quality directional lighting highlighting garment texture and fit, product details clearly visible, ${PHOTOREALISM_KEYWORDS}, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' },
        { id: 'slot-s1c1-2', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_1}} colored product, UPPER BODY CLOSE-UP shot from neckline to waist, {{MODEL_SETTINGS}}, one hand gently adjusting collar or sleeve, COMMERCIAL E-COMMERCE optimized: product fills 75% of frame, tight crop on garment, clean minimal light-toned background with soft bokeh, warm studio lighting emphasizing fabric texture and stitching details, ${PHOTOREALISM_KEYWORDS}, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' },
        { id: 'slot-s1c1-3', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_1}} colored product, EITHER Back View OR Side Profile based on reference context: IF reference shows back design -> Generate BACK VIEW showing full garment back design clearly, product fills 70% of frame. IF reference only shows front -> Generate PRODUCT-FOCUSED WAIST-UP shot, 3/4 angle view, relaxed pose, clean blurred background. {{MODEL_SETTINGS}}, COMMERCIAL E-COMMERCE optimized: tight crop, minimal background, product is the hero, ${PHOTOREALISM_KEYWORDS}, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' }
      ]
    },

    // 섹션 4-2: 코디 섹션 1 — 컬러2 (세로 3장)
    {
      id: 'sec-lookbook-styling1-c2',
      title: '{{COLOR_2}} 코디',
      content: '두 번째 컬러의 다양한 코디네이션과 디테일입니다.',
      sectionType: 'styling' as SectionType,
      layoutType: 'grid-1' as LayoutType,
      imagePrompt: `All 3 images MUST show {{COLOR_2}} colored product with IDENTICAL design, VARIED backgrounds and camera angles`,
      imageSlots: [
        { id: 'slot-s1c2-1', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_2}} colored product, WAIST-UP PRODUCT-FOCUSED shot from chin down to hip, 3/4 angle, {{MODEL_SETTINGS}}, relaxed standing pose with weight on one leg, COMMERCIAL E-COMMERCE optimized: product fills 70% of frame, clean softly blurred background, bright natural light from window, product color and silhouette are the MAIN FOCUS, ${PHOTOREALISM_KEYWORDS}, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' },
        { id: 'slot-s1c2-2', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_2}} colored product, UPPER BODY CLOSE-UP shot from neckline to waist, {{MODEL_SETTINGS}}, looking slightly to the side with natural pose, COMMERCIAL E-COMMERCE optimized: product fills 75% of frame, soft dreamy bokeh background, warm directional lighting emphasizing product color and fabric texture, ${PHOTOREALISM_KEYWORDS}, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' },
        { id: 'slot-s1c2-3', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_2}} colored product, EITHER Back View OR Side Profile based on reference context: IF reference shows back design -> Generate BACK VIEW showing full garment back design, product fills 70% of frame. IF reference only shows front -> Generate PRODUCT-FOCUSED WAIST-UP shot, side angle, natural pose, clean blurred background. {{MODEL_SETTINGS}}, COMMERCIAL E-COMMERCE optimized: tight crop, minimal background, warm lighting, ${PHOTOREALISM_KEYWORDS}, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' }
      ]
    },

    // 섹션 4-3: 코디 섹션 1 — 컬러3 (세로 3장)
    {
      id: 'sec-lookbook-styling1-c3',
      title: '{{COLOR_3}} 코디',
      content: '세 번째 컬러의 다양한 코디네이션과 디테일입니다.',
      sectionType: 'styling' as SectionType,
      layoutType: 'grid-1' as LayoutType,
      imagePrompt: `All 3 images MUST show {{COLOR_3}} colored product with IDENTICAL design, VARIED backgrounds and camera angles`,
      imageSlots: [
        { id: 'slot-s1c3-1', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_3}} colored product, WAIST-UP PRODUCT-FOCUSED shot from chin down to hip, {{MODEL_SETTINGS}}, relaxed confident standing pose, COMMERCIAL E-COMMERCE optimized: product fills 70% of frame, clean softly blurred warm-toned background, professional lighting highlighting garment texture and color, ${PHOTOREALISM_KEYWORDS}, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' },
        { id: 'slot-s1c3-2', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_3}} colored product, UPPER BODY CLOSE-UP from neckline to waist, {{MODEL_SETTINGS}}, hands gently adjusting sleeve or collar, COMMERCIAL E-COMMERCE optimized: product fills 75% of frame, tight crop on garment, clean minimal background, soft morning light, macro-level fabric texture visible, ${PHOTOREALISM_KEYWORDS}, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' },
        { id: 'slot-s1c3-3', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_3}} colored product, EITHER Back View OR Side Profile based on reference context: IF reference shows back design -> Generate BACK VIEW showing garment back clearly, product fills 70% of frame. IF reference only shows front -> Generate PRODUCT-FOCUSED WAIST-UP shot, artistic 3/4 angle, clean blurred background. {{MODEL_SETTINGS}}, COMMERCIAL E-COMMERCE optimized: tight crop, minimal background, creative composition, ${PHOTOREALISM_KEYWORDS}, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' }
      ]
    },

    // ═══════════════════════════════════════════
    // 섹션 5: 코디 섹션 2 — 라이프스타일 코디 (세로 3장)
    // ═══════════════════════════════════════════
    {
      id: 'sec-lookbook-styling2',
      title: '라이프스타일 코디',
      content: '상품과 어울리는 다양한 코디네이션을 라이프스타일 컨셉으로 보여줍니다.',
      sectionType: 'styling' as SectionType,
      layoutType: 'grid-1' as LayoutType,
      imagePrompt: 'Lifestyle coordination shots with diverse backgrounds and poses, showing versatile styling',
      imageSlots: [
        { id: 'slot-style2-1', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing the product, WAIST-UP to HIP PRODUCT-FOCUSED shot, {{MODEL_SETTINGS}}, stylishly coordinated with complementary bottom (skirt or pants) and a handbag, COMMERCIAL E-COMMERCE optimized: product fills 65% of frame, softly blurred outdoor background with warm golden hour light, product styling and coordination are the MAIN FOCUS, fashion editorial quality, ${PHOTOREALISM_KEYWORDS}, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' },
        { id: 'slot-style2-2', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing the product, UPPER BODY CLOSE-UP from neckline to waist, {{MODEL_SETTINGS}}, natural relaxed pose, coordinated with stylish accessories (necklace, watch), COMMERCIAL E-COMMERCE optimized: product fills 70% of frame, soft warm blurred interior background, product and coordination outfit clearly visible, warm ambient lighting on garment, ${PHOTOREALISM_KEYWORDS}, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' },
        { id: 'slot-style2-3', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing the product, WAIST-UP 3/4 ANGLE shot, {{MODEL_SETTINGS}}, coordinated with trendy accessories (bracelet, earrings, scarf), COMMERCIAL E-COMMERCE optimized: product fills 65% of frame, softly blurred background with natural light creating beautiful shadows, product texture and coordination styling clearly visible, artistic editorial composition, ${PHOTOREALISM_KEYWORDS}, ${NEGATIVE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'close-up' }
      ]
    },

    // ═══════════════════════════════════════════
    // 섹션 7: 제품 정보 (text + 사용자 이미지)
    // ═══════════════════════════════════════════
    {
      id: 'sec-lookbook-info',
      title: '제품 정보',
      content: '소재, 사이즈 가이드, 세탁 안내 등 상세 제품 정보입니다.\\n\\n**소재**: 폴리에스터 70%, 아크릴 20%, 울 10%\\n**두께감**: 중간 / **비침**: 없음 / **신축성**: 약간 있음\\n\\n**사이즈 (cm)**\\n| 사이즈 | 어깨 | 가슴 | 소매 | 총장 |\\n|--------|------|------|------|------|\\n| S | 38 | 94 | 58 | 52 |\\n| M | 40 | 98 | 59 | 54 |\\n| L | 42 | 102 | 60 | 56 |',
      sectionType: 'spec' as SectionType,
      layoutType: 'full-width' as LayoutType,
      imagePrompt: ''
    },

    // ═══════════════════════════════════════════
    // 섹션 8: 소재 상세 (클로즈업 이미지 + 소재 설명 텍스트)
    // ═══════════════════════════════════════════
    {
      id: 'sec-lookbook-material',
      title: '제품소재',
      content: '폴리에스터\n부드러운 촉감과 내구성이 좋은 소재로 제작되어 피부에 닿는 느낌이 좋고 활동성이 뛰어납니다.',
      sectionType: 'material_detail' as SectionType,
      layoutType: 'full-width' as LayoutType,
      imagePrompt: `EXTREME CLOSE-UP macro photography of ONLY the product fabric texture and weave pattern — NO HUMAN BODY, NO SKIN, NO PERSON visible at all. Shot with macro lens at f/2.8, shallow depth of field, showing intricate fiber details and material quality. Soft diffused natural lighting from side. The fabric fills entire frame showing realistic textile texture with visible thread patterns and natural surface details. Clean neutral background. Center-focused composition suitable for circular crop. Professional product material photography for e-commerce detail page. ABSOLUTELY NO PERSON OR MODEL. ${PHOTOREALISM_KEYWORDS}, Aspect Ratio 1:1, Square Format`
    }
  ]
};

/**
 * 아웃도어 모델 스타일 프롬프트 (얼굴 전체 표현 + 활동적 분위기)
 */
const OUTDOOR_MODEL_STYLE = 'A REAL HUMAN MODEL with FULL FACE VISIBLE, natural athletic expression, healthy outdoor sun-kissed complexion, confident and energetic posture. The model has visible natural skin texture, realistic body proportions, and an active lifestyle appearance. This is a professional outdoor brand campaign photo featuring a real person';

/**
 * 아웃도어 배경 및 활동성 강조 프롬프트
 */
const OUTDOOR_SCENE_ELEMENTS = 'This must be a photo of a REAL PERSON wearing the outdoor garment in a natural outdoor environment with visible human skin, athletic body movement, and realistic fabric performance. The entire product must be fully visible. Show the complete garment with functional details';

/**
 * 아웃도어 의류 템플릿 - 심플 버전 (액티브 스타일링 각 1장)
 */
export const OUTDOOR_CLOTHING_TEMPLATE: Template = {
  id: 'tpl-outdoor-clothing-preset',
  name: '아웃도어 의류',
  description: '아웃도어 브랜드 의류 상세페이지. 등산/캠핑/트레일 활동 배경의 모델컷 (총 6장). 모델 얼굴 전체 표현.',
  category: 'fashion',
  isBuiltin: true,
  createdAt: 1735574400000, // 2024-12-30
  sections: [
    // 섹션 1: 메인 히어로
    {
      id: 'sec-outdoor-1',
      title: '메인 비주얼',
      content: '산악/자연 배경에서 아웃도어 의류의 기능성과 스타일을 보여주는 대표 이미지입니다.',
      sectionType: 'hero' as SectionType,
      layoutType: 'full-width' as LayoutType,
      imagePrompt: `REAL HUMAN MODEL wearing the outdoor product, FULL BODY shot with FULL FACE VISIBLE, ${OUTDOOR_MODEL_STYLE}, standing on mountain summit or ridge overlooking scenic vista, dramatic golden hour lighting with sun rays, epic outdoor adventure mood, professional outdoor brand campaign quality, ${OUTDOOR_SCENE_ELEMENTS}, MUST maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`
    },
    // 섹션 2: 인트로 (text-only)
    {
      id: 'sec-outdoor-2',
      title: '인트로',
      content: '자연을 정복하는 것이 아닌, 자연과 함께하는 여정을 위해.\\\\n\\\\n극한의 환경에서도 최적의 퍼포먼스를 발휘할 수 있도록 설계된 기능성 아웃도어 의류입니다. 가벼움과 내구성의 완벽한 균형.',
      sectionType: 'description' as SectionType,
      layoutType: 'text-only' as LayoutType,
      imagePrompt: ''
    },
    // 섹션 3: 등산/트레킹 스타일링 (1장)
    {
      id: 'sec-outdoor-3',
      title: '등산/트레킹',
      content: '산악 환경에서의 활동적인 착용 모습입니다.',
      sectionType: 'styling' as SectionType,
      layoutType: 'full-width' as LayoutType,
      imagePrompt: `REAL HUMAN MODEL wearing the outdoor product, FULL BODY action shot with FULL FACE VISIBLE showing confident athletic expression, ${OUTDOOR_MODEL_STYLE}, hiking on a mountain trail or rocky terrain, wearing hiking boots and backpack, natural forest and mountain background, morning mist or clear blue sky, professional outdoor photography, ${OUTDOOR_SCENE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`
    },
    // 섹션 4: 캠핑/하이킹 스타일링 (1장)
    {
      id: 'sec-outdoor-4',
      title: '캠핑/하이킹',
      content: '캠핑장이나 숲속에서의 여유로운 착용 모습입니다.',
      sectionType: 'styling' as SectionType,
      layoutType: 'full-width' as LayoutType,
      imagePrompt: `REAL HUMAN MODEL wearing the outdoor product, FULL BODY relaxed pose with FULL FACE VISIBLE showing warm friendly smile, ${OUTDOOR_MODEL_STYLE}, at a campsite near a tent or in a forest clearing, holding a coffee mug or adjusting gear, warm campfire glow or soft morning forest light, cozy outdoor lifestyle atmosphere, professional camping brand photography, ${OUTDOOR_SCENE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`
    },
    // 섹션 5: 러닝/트레일 스타일링 (1장)
    {
      id: 'sec-outdoor-5',
      title: '러닝/트레일',
      content: '트레일이나 해안가에서의 역동적인 착용 모습입니다.',
      sectionType: 'styling' as SectionType,
      layoutType: 'full-width' as LayoutType,
      imagePrompt: `REAL HUMAN MODEL wearing the outdoor product, FULL BODY dynamic running or jogging pose with FULL FACE VISIBLE showing focused determined expression, ${OUTDOOR_MODEL_STYLE}, on a trail path or coastal beach at sunrise/sunset, athletic motion blur effect on limbs, dramatic sky colors, professional sports outdoor photography, ${OUTDOOR_SCENE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`
    },
    // 섹션 6: 기능성 디테일 클로즈업 (2장)
    {
      id: 'sec-outdoor-6',
      title: '기능성 디테일',
      content: '방수 코팅, 지퍼, 통기구 등 기능성 디테일을 확대하여 보여줍니다.',
      sectionType: 'material_detail' as SectionType,
      layoutType: 'grid-2' as LayoutType,
      imagePrompt: 'Outdoor product functional detail close-up shots, showing waterproof coating, zippers, ventilation',
      imageSlots: [
        { id: 'slot-outdoor-6-1', slotType: 'detail', prompt: 'Extreme close-up of waterproof DWR coating with water droplets beading on fabric surface, showing water-repellent technology, soft focus background, professional product macro photography, rain drops rolling off', photographyStyle: 'close-up' },
        { id: 'slot-outdoor-6-2', slotType: 'detail', prompt: 'Close-up of functional details: YKK zipper, adjustable velcro straps, mesh ventilation panels, or elastic cuffs, showing premium craftsmanship and durability, studio lighting on outdoor gear', photographyStyle: 'close-up' }
      ]
    },
    // 섹션 7: 제품 스펙 (text-only)
    {
      id: 'sec-outdoor-7',
      title: '제품 스펙',
      content: '기능성 스펙과 소재 정보를 안내합니다.\\\\n\\\\n**소재**: 나일론 100% (방수 코팅)\\\\n**안감**: 메쉬 100%\\\\n\\\\n**기능성**\\\\n- 방수지수: 10,000mm\\\\n- 투습성: 8,000g/m²/24hr\\\\n- UV 차단: UPF 50+\\\\n- 경량: 280g\\\\n\\\\n**사이즈 (cm)**\\\\n| 사이즈 | 어깨 | 가슴 | 소매 | 총장 |\\\\n|--------|------|------|------|------|\\\\n| S | 44 | 108 | 62 | 68 |\\\\n| M | 46 | 112 | 64 | 70 |\\\\n| L | 48 | 116 | 66 | 72 |\\\\n| XL | 50 | 120 | 68 | 74 |',
      sectionType: 'spec' as SectionType,
      layoutType: 'text-only' as LayoutType,
      imagePrompt: ''
    }
  ]
};

/**
 * 거울 셀카(Mirror Selfie) 스타일 프롬프트
 * - 핸드폰으로 찍는 거울 셀카 스타일
 * - 얼굴은 핸드폰에 가려 보이지 않음
 * - 어깨~발끝 핏과 실루엣에 집중
 */

/**
 * 거울 셀카 네거티브 강조 (긍정적 표현)
 */
const MIRROR_SELFIE_ELEMENTS = 'This must be a realistic mirror selfie photo of a REAL PERSON taking a self-portrait in a mirror with a smartphone. The model has visible human skin, natural body proportions, and the garment must be fully visible from neckline to hem with natural fabric draping. The phone naturally obscures the face';

/**
 * 거울 셀카 룩북 템플릿 - 컬러별 3장씩 모델컷
 */
export const FASHION_MIRROR_SELFIE_TEMPLATE: Template = {
  id: 'tpl-fashion-mirror-selfie-preset',
  name: '거울 셀카 룩북',
  description: '거울 셀카 컨셉의 의류 상세페이지. 핸드폰으로 찍는 캐주얼한 무드. 컬러옵션별 3장씩 (총 9장). 얼굴 미노출.',
  category: 'fashion',
  isBuiltin: true,
  createdAt: 1740873600000, // 2025-03-02
  sections: [
    // 섹션 1: 메인 비주얼 (거울 셀카 전신)
    {
      id: 'sec-mirror-1',
      title: '메인 비주얼',
      content: '거울 앞에서 찍은 캐주얼한 셀카 컨셉의 대표 이미지입니다.',
      sectionType: 'hero' as SectionType,
      layoutType: 'full-width' as LayoutType,
      imagePrompt: `REAL HUMAN MODEL taking a full-body mirror selfie with smartphone covering face, {{MODEL_SETTINGS}}, standing straight showing complete outfit from shoulders to shoes, warm natural lighting from a nearby window, cozy minimalist room, high quality smartphone camera look, ${MIRROR_SELFIE_ELEMENTS}, MUST maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`
    },
    // 섹션 2: 인트로 (text-only)
    {
      id: 'sec-mirror-2',
      title: '인트로',
      content: '리얼한 핏을 보여드리는 거울 셀카 룩북.\\\\n\\\\n실제 착용 시 핏감과 실루엣을 가장 잘 보여주는 거울 셀카 컨셉으로 촬영했습니다.',
      sectionType: 'description' as SectionType,
      layoutType: 'text-only' as LayoutType,
      imagePrompt: ''
    },
    // 섹션 3: 컬러1 스타일링 (세로 3장)
    {
      id: 'sec-mirror-3',
      title: '{{COLOR_1}} 스타일링',
      content: '첫 번째 컬러옵션의 다양한 착장 모습입니다.',
      sectionType: 'styling' as SectionType,
      layoutType: 'grid-1' as LayoutType,
      imagePrompt: `All 3 images MUST show {{COLOR_1}} colored product with IDENTICAL design, mirror selfie style`,
      imageSlots: [
        { id: 'slot-m3-1', slotType: 'color_styling', prompt: `REAL HUMAN MODEL taking a FRONT mirror selfie with smartphone covering face, wearing {{COLOR_1}} colored product, full body visible in mirror from shoulders to toes, {{MODEL_SETTINGS}}, natural standing pose, emphasizing garment fit and silhouette, ${MIRROR_SELFIE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'full-body' },
        { id: 'slot-m3-2', slotType: 'color_styling', prompt: `REAL HUMAN MODEL taking a SIDE ANGLE mirror selfie with smartphone, wearing {{COLOR_1}} colored product, slight turn showing side profile of the outfit, visible from shoulders to toes in full-length mirror, {{MODEL_SETTINGS}}, one hand on hip casual pose, emphasizing garment drape and body line, ${MIRROR_SELFIE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'full-body' },
        { id: 'slot-m3-3', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_1}} colored product, EITHER Back View OR Side Profile based on reference context: IF reference shows back design -> Generate BACK VIEW mirror selfie showing the back of the garment clearly. IF reference only shows front -> Generate coordination full body shot with complementary accessories, casual lifestyle setting. {{MODEL_SETTINGS}}, ${MIRROR_SELFIE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'full-body' }
      ]
    },
    // 섹션 4: 컬러2 스타일링 (세로 3장)
    {
      id: 'sec-mirror-4',
      title: '{{COLOR_2}} 스타일링',
      content: '두 번째 컬러옵션의 다양한 착장 모습입니다.',
      sectionType: 'styling' as SectionType,
      layoutType: 'grid-1' as LayoutType,
      imagePrompt: `All 3 images MUST show {{COLOR_2}} colored product with IDENTICAL design, mirror selfie style`,
      imageSlots: [
        { id: 'slot-m4-1', slotType: 'color_styling', prompt: `REAL HUMAN MODEL taking a FRONT mirror selfie with smartphone covering face, wearing {{COLOR_2}} colored product, full body visible in mirror from shoulders to toes, {{MODEL_SETTINGS}}, relaxed pose with weight on one leg, emphasizing garment fit and silhouette, ${MIRROR_SELFIE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'full-body' },
        { id: 'slot-m4-2', slotType: 'color_styling', prompt: `REAL HUMAN MODEL taking a SIDE ANGLE mirror selfie with smartphone, wearing {{COLOR_2}} colored product, turning to show side view of outfit, visible from shoulders to toes in mirror, {{MODEL_SETTINGS}}, hand touching hair casual pose, emphasizing garment silhouette from side, ${MIRROR_SELFIE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'full-body' },
        { id: 'slot-m4-3', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_2}} colored product, EITHER Back View OR Side Profile based on reference context: IF reference shows back design -> Generate BACK VIEW mirror selfie showing the back of the garment clearly. IF reference only shows front -> Generate coordination full body shot with complementary accessories, casual lifestyle setting. {{MODEL_SETTINGS}}, ${MIRROR_SELFIE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'full-body' }
      ]
    },
    // 섹션 5: 컬러3 스타일링 (세로 3장)
    {
      id: 'sec-mirror-5',
      title: '{{COLOR_3}} 스타일링',
      content: '세 번째 컬러옵션의 다양한 착장 모습입니다.',
      sectionType: 'styling' as SectionType,
      layoutType: 'grid-1' as LayoutType,
      imagePrompt: `All 3 images MUST show {{COLOR_3}} colored product with IDENTICAL design, mirror selfie style`,
      imageSlots: [
        { id: 'slot-m5-1', slotType: 'color_styling', prompt: `REAL HUMAN MODEL taking a FRONT mirror selfie with smartphone covering face, wearing {{COLOR_3}} colored product, full body visible in mirror from shoulders to toes, {{MODEL_SETTINGS}}, confident standing pose, emphasizing garment fit and silhouette, ${MIRROR_SELFIE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'full-body' },
        { id: 'slot-m5-2', slotType: 'color_styling', prompt: `REAL HUMAN MODEL taking a SIDE ANGLE mirror selfie with smartphone, wearing {{COLOR_3}} colored product, angled view showing side profile of outfit, visible from shoulders to toes in mirror, {{MODEL_SETTINGS}}, casual crossed-arms pose, emphasizing garment drape and body line, ${MIRROR_SELFIE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'full-body' },
        { id: 'slot-m5-3', slotType: 'color_styling', prompt: `REAL HUMAN MODEL wearing {{COLOR_3}} colored product, EITHER Back View OR Side Profile based on reference context: IF reference shows back design -> Generate BACK VIEW mirror selfie showing the back of the garment clearly. IF reference only shows front -> Generate coordination full body shot with complementary accessories, casual lifestyle setting. {{MODEL_SETTINGS}}, ${MIRROR_SELFIE_ELEMENTS}, CRITICAL: maintain exact product design from reference, Aspect Ratio 3:4, Vertical Portrait Mode`, photographyStyle: 'full-body' }
      ]
    },
    // 섹션 6: 디테일 클로즈업 (2장)
    {
      id: 'sec-mirror-6',
      title: '디테일 클로즈업',
      content: '원단의 질감, 단추, 마감 등 디테일을 확대하여 보여줍니다.',
      sectionType: 'material_detail' as SectionType,
      layoutType: 'grid-2' as LayoutType,
      imagePrompt: 'Product detail close-up shots, showing fabric texture, buttons, stitching',
      imageSlots: [
        { id: 'slot-m6-1', slotType: 'detail', prompt: 'Extreme close-up of fabric texture and weave pattern, showing material quality and tactile feel, soft focus background, warm natural lighting, cozy indoor setting', photographyStyle: 'close-up' },
        { id: 'slot-m6-2', slotType: 'detail', prompt: 'Close-up of finishing details: buttons, collar, neckline, cuffs or hem stitching, showing quality craftsmanship, warm indoor lighting', photographyStyle: 'close-up' }
      ]
    },
    // 섹션 7: 제품 정보 (text-only)
    {
      id: 'sec-mirror-7',
      title: '제품 정보',
      content: '사이즈 가이드와 소재 정보를 텍스트로 안내합니다.\\\\n\\\\n**소재**: 폴리에스터 70%, 아크릴 20%, 울 10%\\\\n**두께감**: 중간 / **비침**: 없음 / **신축성**: 약간 있음\\\\n\\\\n**사이즈 (cm)**\\\\n| 사이즈 | 어깨 | 가슴 | 소매 | 총장 |\\\\n|--------|------|------|------|------|\\\\n| S | 38 | 94 | 58 | 52 |\\\\n| M | 40 | 98 | 59 | 54 |\\\\n| L | 42 | 102 | 60 | 56 |',
      sectionType: 'spec' as SectionType,
      layoutType: 'text-only' as LayoutType,
      imagePrompt: ''
    }
  ]
};

/**
 * 빌트인 템플릿 ID 목록
 */
const BUILT_IN_TEMPLATE_IDS = [
  'tpl-fashion-faceless-preset',
  'tpl-outdoor-clothing-preset',
  'tpl-fashion-mirror-selfie-preset'
];

/**
 * 빌트인 템플릿 초기화 - 앱 시작 시 호출
 * (더 이상 자동으로 localStorage에 저장하지 않고 동적으로 제공함)
 */
export const initializeBuiltInTemplates = () => {
  // 빌트인 템플릿은 항상 getTemplates()를 통해 최신 코드 버전을 바로 제공하므로
  // localStorage에 별도 백업본을 만들지 않습니다.
};