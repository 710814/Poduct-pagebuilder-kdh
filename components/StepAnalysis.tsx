import React, { useRef, useCallback, useMemo, useState } from 'react';
import { ProductAnalysis, SectionData, UploadedFile, AppMode, ImageSlot, SectionPreset, SectionType, LayoutType, ProductInputData } from '../types';
import { Save, Plus, Trash2, RefreshCw, ArrowUp, ArrowDown, Sparkles, Lock, Image as ImageIcon, Type, Eye, X, Loader2, Edit3, Upload, Bookmark, ChevronDown, ChevronUp, ZoomIn, ZoomOut, RotateCcw, Move, Check, LayoutGrid } from 'lucide-react';
import { generateSectionImage, findMatchingColorOption, buildCollagePrompt } from '../services/geminiService';
import { getSectionPresets, saveSectionPreset, deleteSectionPreset } from '../services/sectionPresetService';
import { useToastContext } from '../contexts/ToastContext';
import { SectionMiniMap } from './SectionMiniMap';

interface Props {
  analysis: ProductAnalysis;
  onUpdate: (updated: ProductAnalysis) => void;
  onConfirm: () => void;
  isLoading: boolean;
  uploadedFiles?: UploadedFile[];
  mode?: AppMode;
  productInputData?: ProductInputData | null;  // ★ 컴러옵션 이미지 참조용
}

export const StepAnalysis: React.FC<Props> = React.memo(({ analysis, onUpdate, onConfirm, isLoading, uploadedFiles = [], mode = AppMode.CREATION, productInputData }) => {
  // 섹션 리스트 컨테이너 참조 (스크롤 이동용)
  const sectionsContainerRef = useRef<HTMLDivElement>(null);
  const toast = useToastContext();

  // 이미지 미리보기 생성 상태
  const [generatingPreviewId, setGeneratingPreviewId] = useState<string | null>(null);

  // 프롬프트 수정 모달 상태
  const [editPromptModal, setEditPromptModal] = useState<{
    sectionId: string;
    prompt: string;
    backgroundType: string;  // 배경 선택 옵션
  } | null>(null);

  // 배경 선택 옵션
  const backgroundOptions = [
    { value: 'original', label: '배경 유지 (기본)', promptSuffix: '' },
    { value: 'nature', label: '자연 배경', promptSuffix: ', natural outdoor background with greenery, trees, and soft natural sunlight' },
    { value: 'city_street', label: '도시 스트리트', promptSuffix: ', urban city street background with modern buildings and trendy urban atmosphere' },
    { value: 'cafe', label: '카페', promptSuffix: ', cozy cafe interior background with warm ambient lighting and coffee shop atmosphere' },
    { value: 'airport', label: '공항', promptSuffix: ', modern airport terminal background with bright natural lighting and travel atmosphere' },
    { value: 'office', label: '오피스', promptSuffix: ', professional modern office interior background with clean workspace aesthetic' },
  ];

  // 이미지 확대 모달 상태 (Pan & Zoom 기능 포함)
  const [imageViewModal, setImageViewModal] = useState<{
    imageUrl: string;
    sectionTitle: string;
    sectionId: string;
    slotIndex?: number;      // 슬롯 인덱스 (단일 이미지는 undefined)
    zoom: number;
    panX: number;
    panY: number;
  } | null>(null);

  // 드래그 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 섹션 추가 모달 상태 (확장)
  const [addSectionModal, setAddSectionModal] = useState<{
    isOpen: boolean;
    activeTab: 'new' | 'preset';        // 새로 만들기 / 프리셋에서
    sectionType: string;
    layoutType: string;
    slotCount: number;
    fixedText: string;                   // 고정 문구
    fixedImageBase64?: string;           // 고정 이미지 Base64
    fixedImageMimeType?: string;         // 고정 이미지 MIME
    showAdvanced: boolean;               // 고급 설정 펼치기
    saveAsPreset: boolean;               // 프리셋으로 저장 모드
    presetName: string;                  // 프리셋 이름
  } | null>(null);

  // 섹션 프리셋 목록
  const [sectionPresets, setSectionPresets] = useState<SectionPreset[]>([]);

  // 현재 활성 섹션 (미니맵 하이라이트용)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // 각 섹션 요소의 ref (스크롤 이동용)
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // 모달용 파일 input ref
  const modalImageInputRef = useRef<HTMLInputElement | null>(null);

  // 파일 input refs
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // 이미지 미리보기 생성 함수 (단일 섹션 또는 개별 슬롯)
  const handleGeneratePreview = useCallback(async (sectionId: string, customPrompt?: string, slotIndex?: number) => {
    const section = analysis.sections.find(s => s.id === sectionId);
    if (!section) return;

    const hasMultipleSlots = section.imageSlots && section.imageSlots.length > 1;

    setGeneratingPreviewId(sectionId);

    try {
      const primaryFile = uploadedFiles.length > 0 ? uploadedFiles[0] : null;

      // ★ 콜라주 레이아웃인 경우: buildCollagePrompt로 단일 콜라주 이미지 생성
      const isCollageLayout = section.layoutType?.startsWith('collage-');
      if (isCollageLayout) {
        // 상품 설명 추출
        const productDescription = analysis.productVisualDescription || analysis.productName || 'the product';

        // 콜라주 프롬프트 생성
        const collagePrompt = buildCollagePrompt(
          section.layoutType!,
          productDescription,
          customPrompt || section.imagePrompt
        );

        console.log(`[StepAnalysis Preview] 콜라주 레이아웃 (${section.layoutType}): 프롬프트 생성됨`);
        toast.info('콜라주 이미지 생성 중... (약 15-30초 소요)');

        const imageUrl = await generateSectionImage(
          collagePrompt,
          primaryFile?.base64,
          primaryFile?.mimeType,
          mode
        );

        const updatedSections = analysis.sections.map(s =>
          s.id === sectionId
            ? { ...s, imageUrl, isPreview: true }
            : s
        );
        onUpdate({ ...analysis, sections: updatedSections });
        toast.success('콜라주 이미지가 생성되었습니다!');
        return;
      }

      // ★ 다중 슬롯인 경우: 각 슬롯별로 이미지 생성
      if (hasMultipleSlots && slotIndex === undefined) {
        // 전체 슬롯 생성
        const updatedSlots = [];
        for (let i = 0; i < section.imageSlots!.length; i++) {
          const slot = section.imageSlots![i];

          // 이미 이미지가 있으면 건너뛰기
          if (slot.imageUrl) {
            updatedSlots.push(slot);
            continue;
          }

          toast.info(`이미지 ${i + 1}/${section.imageSlots!.length} 생성 중...`);

          try {
            // ★ 프롬프트에서 컬러명을 추출하여 해당 컬러옵션 이미지를 참조
            const slotPrompt = slot.prompt || section.imagePrompt || '';
            const matchedColorOption = findMatchingColorOption(slotPrompt, productInputData?.colorOptions);
            const colorOptionImage = matchedColorOption?.images?.[0];

            // ★ 3번째 슬롯 + 후면 이미지가 있으면 후면 이미지를 참조로 우선 사용
            // 후면 슬롯 감지 (프롬프트 기반)
            const isBackViewSlot = slotPrompt.includes('BACK VIEW') || slotPrompt.includes('back design');

            // 후면 참조 이미지 탐색: 해당 컬러옵션 -> 모든 컬러옵션 -> 메인 이미지 (uploadedFiles) 순서로 fallback
            let backImage = matchedColorOption?.images?.find(img => img.role === 'back');
            if (!backImage) {
              // 해당 컬러에 후면이 없으면, 다른 컬러옵션에서 후면 이미지 탐색 (사용자 요구사항: 한 컬러만 있어도 모든 컬러 적용)
              backImage = productInputData?.colorOptions
                ?.flatMap(c => c.images)?.find(img => img.role === 'back');
            }
            if (!backImage) {
              // 컬러옵션 전체에도 없으면 메인 이미지에서 탐색
              backImage = uploadedFiles.find(img => img.role === 'back');
            }

            const refImage = (isBackViewSlot && backImage) ? backImage : (colorOptionImage || primaryFile);

            console.log(`[StepAnalysis Preview] 슬롯 ${i + 1}: 컬러 매칭 = ${matchedColorOption?.colorName || 'N/A'}, 후면슬롯여부 = ${isBackViewSlot}, 참조 이미지 = ${refImage?.base64 ? 'O' : 'X'}`);

            const imageUrl = await generateSectionImage(
              slotPrompt,
              refImage?.base64,
              refImage?.mimeType,
              mode
            );
            updatedSlots.push({ ...slot, imageUrl });
          } catch (slotError) {
            console.error(`슬롯 ${i + 1} 생성 실패:`, slotError);
            updatedSlots.push(slot);
          }
        }

        const firstSlotImage = updatedSlots.find(s => s.imageUrl)?.imageUrl;
        const updatedSections = analysis.sections.map(s =>
          s.id === sectionId
            ? { ...s, imageSlots: updatedSlots, imageUrl: firstSlotImage, isPreview: true }
            : s
        );
        onUpdate({ ...analysis, sections: updatedSections });
        toast.success(`${updatedSlots.filter(s => s.imageUrl).length}개 이미지 미리보기가 생성되었습니다.`);
      }
      // 개별 슬롯 생성 (slotIndex 지정된 경우)
      else if (hasMultipleSlots && slotIndex !== undefined) {
        const slot = section.imageSlots![slotIndex];
        const prompt = customPrompt || slot.prompt || section.imagePrompt || '';

        // ★ 프롬프트에서 컬러명을 추출하여 해당 컬러옵션 이미지를 참조
        const matchedColorOption = findMatchingColorOption(prompt, productInputData?.colorOptions);
        const colorOptionImage = matchedColorOption?.images?.[0];

        // ★ 개별 슬롯 생성 시에도 후면 이미지 참조 로직 적용
        const isBackViewSlot = prompt.includes('BACK VIEW') || prompt.includes('back design');
        let backImage = matchedColorOption?.images?.find(img => img.role === 'back');
        if (!backImage) {
          backImage = productInputData?.colorOptions
            ?.flatMap(c => c.images)?.find(img => img.role === 'back');
        }
        if (!backImage) {
          backImage = uploadedFiles.find(img => img.role === 'back');
        }

        const refImage = (isBackViewSlot && backImage) ? backImage : (colorOptionImage || primaryFile);

        console.log(`[StepAnalysis Preview] 개별 슬롯 ${slotIndex + 1}: 컬러 매칭 = ${matchedColorOption?.colorName || 'N/A'}, 후면슬롯여부 = ${isBackViewSlot}`);

        const imageUrl = await generateSectionImage(
          prompt,
          refImage?.base64,
          refImage?.mimeType,
          mode
        );

        const updatedSlots = section.imageSlots!.map((s, idx) =>
          idx === slotIndex ? { ...s, imageUrl, prompt } : s
        );
        const firstSlotImage = updatedSlots.find(s => s.imageUrl)?.imageUrl;

        const updatedSections = analysis.sections.map(s =>
          s.id === sectionId
            ? { ...s, imageSlots: updatedSlots, imageUrl: firstSlotImage, isPreview: true }
            : s
        );
        onUpdate({ ...analysis, sections: updatedSections });
        toast.success(`이미지 ${slotIndex + 1} 미리보기가 생성되었습니다.`);
      }
      // 단일 이미지 섹션 (기존 방식)
      else {
        const prompt = customPrompt || section.imagePrompt;
        if (!prompt) {
          toast.error('이미지 프롬프트가 없습니다.');
          return;
        }

        // ★ 프롬프트에서 컬러명을 추출하여 해당 컬러옵션 이미지를 참조
        const matchedColorOption = findMatchingColorOption(prompt, productInputData?.colorOptions);
        const colorOptionImage = matchedColorOption?.images?.[0];
        const refImage = colorOptionImage || primaryFile;

        console.log(`[StepAnalysis Preview] 단일 섹션: 컬러 매칭 = ${matchedColorOption?.colorName || 'N/A'}`);

        const imageUrl = await generateSectionImage(
          prompt,
          refImage?.base64,
          refImage?.mimeType,
          mode
        );

        const updatedSections = analysis.sections.map(s =>
          s.id === sectionId
            ? { ...s, imageUrl, imagePrompt: prompt, isPreview: true }
            : s
        );
        onUpdate({ ...analysis, sections: updatedSections });
        toast.success('이미지 미리보기가 생성되었습니다.');
      }
    } catch (error) {
      console.error('Preview generation failed:', error);
      toast.error('이미지 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setGeneratingPreviewId(null);
    }
  }, [analysis, uploadedFiles, mode, onUpdate, toast]);

  // 프롬프트 수정 모달 열기
  const handleOpenEditPrompt = useCallback((sectionId: string) => {
    const section = analysis.sections.find(s => s.id === sectionId);
    setEditPromptModal({
      sectionId,
      prompt: section?.imagePrompt || '',
      backgroundType: 'original'  // 기본값: 배경 유지
    });
  }, [analysis.sections]);

  // 프롬프트 수정 후 이미지 생성
  const handleConfirmEditPrompt = useCallback(() => {
    if (!editPromptModal) return;

    const { sectionId, prompt, backgroundType } = editPromptModal;

    // 배경 옵션에 따른 프롬프트 조합
    const selectedBackground = backgroundOptions.find(opt => opt.value === backgroundType);
    const finalPrompt = selectedBackground?.promptSuffix
      ? `${prompt.trim()}${selectedBackground.promptSuffix}`
      : prompt;

    console.log('[EditPrompt] 배경 선택:', backgroundType);
    console.log('[EditPrompt] 최종 프롬프트:', finalPrompt.slice(0, 150) + '...');

    setEditPromptModal(null);
    handleGeneratePreview(sectionId, finalPrompt);
  }, [editPromptModal, handleGeneratePreview, backgroundOptions]);

  // 이미지 미리보기 제거
  const handleRemovePreview = useCallback((sectionId: string) => {
    const updatedSections = analysis.sections.map(s =>
      s.id === sectionId
        ? { ...s, imageUrl: undefined, isPreview: false }
        : s
    );
    onUpdate({ ...analysis, sections: updatedSections });
  }, [analysis, onUpdate]);

  // ★ AI 프롬프트 추천 함수
  const generateAIPrompt = useCallback((sectionId: string) => {
    const section = analysis.sections.find(s => s.id === sectionId);
    if (!section) return;

    // 상품 정보 추출
    const productName = analysis.productName || 'the product';
    const productDesc = analysis.productVisualDescription || '';
    const sectionTitle = section.title || '';
    const sectionType = section.sectionType || 'description';
    const layoutType = section.layoutType || 'full-width';

    // 섹션 타입에 따른 촬영 스타일 힌트
    const styleHints: { [key: string]: string } = {
      'hero': 'full body hero shot, clean studio background, centered composition, professional lighting',
      'title': 'product shot, simple elegant background, centered layout, premium feel',
      'description': 'lifestyle context shot, product in natural setting, warm lighting',
      'colors': 'color variants display, same angle, side by side comparison',
      'material_detail': 'extreme close-up macro shot, texture detail, sharp focus on fabric/material',
      'styling': 'styled coordination shot, fashion lookbook style, complementary accessories',
      'fit': 'full body shot showing fit and silhouette, model wearing the product',
      'spec': 'technical detail shot, measurements visible, clean background',
      'notice': 'informational layout, clean and readable, minimalist design',
      'custom': 'professional product photography, high quality, studio lighting'
    };

    const styleHint = styleHints[sectionType] || styleHints['custom'];

    // 콜라주 레이아웃인 경우 콜라주 전용 프롬프트 생성
    let generatedPrompt = '';
    if (layoutType.startsWith('collage-')) {
      generatedPrompt = `${productName}${productDesc ? ` - ${productDesc}` : ''}, fashion collage layout, multiple angles and poses, ${styleHint}, professional outdoor/lifestyle photography`;
    } else {
      generatedPrompt = `${productName}${productDesc ? ` (${productDesc})` : ''}, ${sectionTitle ? `for "${sectionTitle}" section, ` : ''}${styleHint}`;
    }

    // 프롬프트 업데이트
    const updatedSections = analysis.sections.map(s =>
      s.id === sectionId
        ? { ...s, imagePrompt: generatedPrompt }
        : s
    );
    onUpdate({ ...analysis, sections: updatedSections });
    toast.success('AI 추천 프롬프트가 생성되었습니다!');
  }, [analysis, onUpdate, toast]);

  // 사용자 이미지 업로드 핸들러 (섹션 또는 슬롯)
  const handleUploadImage = useCallback((sectionId: string, file: File, slotIndex?: number) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;

      const updatedSections = analysis.sections.map(section => {
        if (section.id !== sectionId) return section;

        if (slotIndex !== undefined && section.imageSlots) {
          // 슬롯 이미지 업로드
          const newSlots = section.imageSlots.map((slot, idx) =>
            idx === slotIndex ? { ...slot, imageUrl: base64 } : slot
          );
          return { ...section, imageSlots: newSlots };
        } else {
          // 단일 섹션 이미지 업로드
          return { ...section, imageUrl: base64, isPreview: true };
        }
      });

      onUpdate({ ...analysis, sections: updatedSections });
      toast.success('이미지가 업로드되었습니다.');
    };
    reader.readAsDataURL(file);
  }, [analysis, onUpdate, toast]);

  // 이미지 뷰 모달 열기 (저장된 크롭 설정 불러오기)
  const openImageViewModal = useCallback((imageUrl: string, sectionTitle: string, sectionId: string, slotIndex?: number) => {
    // 해당 섹션/슬롯의 저장된 크롭 설정 찾기
    const section = analysis.sections.find(s => s.id === sectionId);
    let savedZoom = 1, savedPanX = 0, savedPanY = 0;

    if (section) {
      if (slotIndex !== undefined && section.imageSlots?.[slotIndex]) {
        // 슬롯 이미지
        const slot = section.imageSlots[slotIndex];
        savedZoom = slot.cropZoom || 1;
        savedPanX = slot.cropPanX || 0;
        savedPanY = slot.cropPanY || 0;
      } else {
        // 단일 이미지
        savedZoom = section.cropZoom || 1;
        savedPanX = section.cropPanX || 0;
        savedPanY = section.cropPanY || 0;
      }
    }

    setImageViewModal({
      imageUrl,
      sectionTitle,
      sectionId,
      slotIndex,
      zoom: savedZoom,
      panX: savedPanX,
      panY: savedPanY,
    });
  }, [analysis.sections]);

  // 크롭 설정 저장
  const handleSaveCrop = useCallback(() => {
    if (!imageViewModal) return;

    const { sectionId, slotIndex, zoom, panX, panY } = imageViewModal;

    const updatedSections = analysis.sections.map(section => {
      if (section.id !== sectionId) return section;

      if (slotIndex !== undefined && section.imageSlots) {
        // 슬롯 이미지 크롭 설정 저장
        const newSlots = section.imageSlots.map((slot, idx) =>
          idx === slotIndex
            ? { ...slot, cropZoom: zoom, cropPanX: panX, cropPanY: panY }
            : slot
        );
        return { ...section, imageSlots: newSlots };
      } else {
        // 단일 이미지 크롭 설정 저장
        return { ...section, cropZoom: zoom, cropPanX: panX, cropPanY: panY };
      }
    });

    onUpdate({ ...analysis, sections: updatedSections });
    toast.success(`크롭 설정이 저장되었습니다. (배율: ${Math.round(zoom * 100)}%)`);
  }, [imageViewModal, analysis, onUpdate, toast]);

  // 줌 핸들러
  const handleZoom = useCallback((delta: number) => {
    if (!imageViewModal) return;
    const newZoom = Math.max(0.5, Math.min(4, imageViewModal.zoom + delta));
    setImageViewModal({ ...imageViewModal, zoom: newZoom });
  }, [imageViewModal]);

  // 줌 리셋 (초기화)
  const handleResetZoom = useCallback(() => {
    if (!imageViewModal) return;
    setImageViewModal({ ...imageViewModal, zoom: 1, panX: 0, panY: 0 });
  }, [imageViewModal]);

  // 마우스 휠 줌
  const handleWheelZoom = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    handleZoom(delta);
  }, [handleZoom]);

  // 드래그 시작
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!imageViewModal || imageViewModal.zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - imageViewModal.panX, y: e.clientY - imageViewModal.panY });
  }, [imageViewModal]);

  // 드래그 중
  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !imageViewModal) return;
    const newPanX = e.clientX - dragStart.x;
    const newPanY = e.clientY - dragStart.y;
    setImageViewModal({ ...imageViewModal, panX: newPanX, panY: newPanY });
  }, [isDragging, dragStart, imageViewModal]);

  // 드래그 종료
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 레이아웃 추천 매핑
  const layoutRecommendations: { [key: string]: string } = {
    'hero': 'full-width',
    'description': 'full-width',
    'colors': 'grid-3',
    'material_detail': 'full-width',
    'styling': 'grid-2',
    'fit': 'full-width',
    'spec': 'text-only',
    'notice': 'text-only',
    'custom': 'full-width',
  };

  // 섹션 타입 한글 라벨
  const sectionTypeLabels: { [key: string]: string } = {
    'hero': '메인 비주얼',
    'description': '상품 설명',
    'colors': '컬러 옵션',
    'material_detail': '소재 상세',
    'styling': '스타일링',
    'fit': '핏/사이즈',
    'spec': '스펙/사양',
    'notice': '안내사항',
    'custom': '사용자 정의',
  };

  // 레이아웃 타입 한글 라벨
  const layoutTypeLabels: { [key: string]: string } = {
    'full-width': '전체 너비',
    'grid-2': '2열 그리드',
    'grid-3': '3열 그리드',
    'text-only': '텍스트만',
    // 콜라주 레이아웃
    'collage-1-2': '콜라주 (1+2)',
    'collage-2-1': '콜라주 (2+1)',
    'collage-1-3': '콜라주 (1+3)',
    'collage-2x2': '콜라주 (2×2)',
  };

  // 미리보기가 있는 섹션 수
  const previewCount = useMemo(() =>
    analysis.sections.filter(s => s.imageUrl && !s.isOriginalImage).length,
    [analysis.sections]);

  const handleFieldChange = useCallback((field: keyof ProductAnalysis, value: any) => {
    const newData = { ...analysis, [field]: value };
    onUpdate(newData);
  }, [analysis, onUpdate]);

  const handleSectionChange = useCallback((index: number, field: keyof SectionData, value: string) => {
    const newSections = [...analysis.sections];
    newSections[index] = { ...newSections[index], [field]: value };
    handleFieldChange('sections', newSections);
  }, [analysis.sections, handleFieldChange]);

  // 섹션 추가 모달 열기 (확장)
  const openAddSectionModal = useCallback(() => {
    // 프리셋 목록 새로고침
    setSectionPresets(getSectionPresets());

    setAddSectionModal({
      isOpen: true,
      activeTab: 'new',
      sectionType: 'custom',
      layoutType: 'full-width',
      slotCount: 1,
      fixedText: '',
      fixedImageBase64: undefined,
      fixedImageMimeType: undefined,
      showAdvanced: false,
      saveAsPreset: false,
      presetName: '',
    });
  }, []);

  // 모달 내 고정 이미지 업로드 핸들러
  const handleModalImageUpload = useCallback((file: File) => {
    if (!addSectionModal) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];

      setAddSectionModal({
        ...addSectionModal,
        fixedImageBase64: base64Data,
        fixedImageMimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  }, [addSectionModal]);

  // 모달 내 고정 이미지 제거
  const handleRemoveModalImage = useCallback(() => {
    if (!addSectionModal) return;

    setAddSectionModal({
      ...addSectionModal,
      fixedImageBase64: undefined,
      fixedImageMimeType: undefined,
    });
  }, [addSectionModal]);

  // 현재 설정을 프리셋으로 저장
  const handleSaveAsPreset = useCallback(() => {
    if (!addSectionModal || !addSectionModal.presetName.trim()) {
      toast.warning('프리셋 이름을 입력해주세요.');
      return;
    }

    const newPreset: SectionPreset = {
      id: `preset-${Date.now()}`,
      name: addSectionModal.presetName.trim(),
      sectionType: addSectionModal.sectionType as SectionType,
      layoutType: addSectionModal.layoutType as LayoutType,
      slotCount: addSectionModal.slotCount,
      fixedText: addSectionModal.fixedText || undefined,
      fixedImageBase64: addSectionModal.fixedImageBase64,
      fixedImageMimeType: addSectionModal.fixedImageMimeType,
      createdAt: Date.now(),
    };

    saveSectionPreset(newPreset);
    setSectionPresets(getSectionPresets());

    setAddSectionModal({
      ...addSectionModal,
      saveAsPreset: false,
      presetName: '',
    });

    toast.success(`'${newPreset.name}' 프리셋이 저장되었습니다.`);
  }, [addSectionModal, toast]);

  // 프리셋 삭제
  const handleDeletePreset = useCallback((presetId: string) => {
    if (confirm('이 프리셋을 삭제하시겠습니까?')) {
      deleteSectionPreset(presetId);
      setSectionPresets(getSectionPresets());
      toast.info('프리셋이 삭제되었습니다.');
    }
  }, [toast]);

  // 프리셋으로 섹션 추가
  const handleApplyPreset = useCallback((preset: SectionPreset) => {
    const isGrid = preset.layoutType === 'grid-1' || preset.layoutType === 'grid-2' || preset.layoutType === 'grid-3';
    const slotCount = preset.slotCount || (isGrid ? (preset.layoutType === 'grid-3' ? 3 : 2) : 1);

    const imageSlots: ImageSlot[] = isGrid
      ? Array.from({ length: slotCount }, (_, i) => ({
        id: `slot-${Date.now()}-${i}`,
        slotType: 'product' as const,
        prompt: '',
      }))
      : [{
        id: `slot-${Date.now()}-0`,
        slotType: 'product' as const,
        prompt: '',
      }];

    const newSection: SectionData = {
      id: `new-${Date.now()}`,
      title: preset.name,
      content: preset.description || '내용을 입력하세요.',
      imagePrompt: 'Product photo, professional quality',
      sectionType: preset.sectionType,
      layoutType: preset.layoutType,
      imageSlots,
      fixedText: preset.fixedText,
      fixedImageBase64: preset.fixedImageBase64,
      fixedImageMimeType: preset.fixedImageMimeType,
      useFixedImage: !!preset.fixedImageBase64,
    };

    handleFieldChange('sections', [...analysis.sections, newSection]);
    setAddSectionModal(null);

    setTimeout(() => {
      if (sectionsContainerRef.current) {
        const lastChild = sectionsContainerRef.current.lastElementChild;
        lastChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    toast.success(`'${preset.name}' 프리셋이 적용되었습니다.`);
  }, [analysis.sections, handleFieldChange, toast]);

  // 섹션 추가 확인 (확장)
  const confirmAddSection = useCallback(() => {
    if (!addSectionModal) return;

    const { sectionType, layoutType, slotCount, fixedText, fixedImageBase64, fixedImageMimeType } = addSectionModal;
    const isGrid = layoutType === 'grid-1' || layoutType === 'grid-2' || layoutType === 'grid-3';

    // 슬롯 생성
    const imageSlots: ImageSlot[] = isGrid
      ? Array.from({ length: slotCount }, (_, i) => ({
        id: `slot-${Date.now()}-${i}`,
        slotType: 'product' as const,
        prompt: '',
      }))
      : [{
        id: `slot-${Date.now()}-0`,
        slotType: 'product' as const,
        prompt: '',
      }];

    const newSection: SectionData = {
      id: `new-${Date.now()}`,
      title: sectionTypeLabels[sectionType] || '새 섹션',
      content: '내용을 입력하세요.',
      imagePrompt: 'Product photo, professional quality',
      sectionType: sectionType as any,
      layoutType: layoutType as any,
      imageSlots,
      // 고정 요소 추가
      fixedText: fixedText || undefined,
      fixedImageBase64: fixedImageBase64,
      fixedImageMimeType: fixedImageMimeType,
      useFixedImage: !!fixedImageBase64,
    };

    handleFieldChange('sections', [...analysis.sections, newSection]);
    setAddSectionModal(null);

    // UX: 추가된 섹션이 보이도록 스크롤 이동
    setTimeout(() => {
      if (sectionsContainerRef.current) {
        const lastChild = sectionsContainerRef.current.lastElementChild;
        lastChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    toast.success('새 섹션이 추가되었습니다.');
  }, [addSectionModal, analysis.sections, handleFieldChange, sectionTypeLabels, toast]);

  const removeSection = useCallback((index: number) => {
    if (confirm('이 섹션을 삭제하시겠습니까?')) {
      const newSections = analysis.sections.filter((_, i) => i !== index);
      handleFieldChange('sections', newSections);
    }
  }, [analysis.sections, handleFieldChange]);

  // 섹션 순서 변경 함수
  const moveSection = useCallback((index: number, direction: 'up' | 'down') => {
    const newSections = [...analysis.sections];
    if (direction === 'up' && index > 0) {
      // 위로 이동 (Swap with index-1)
      [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
    } else if (direction === 'down' && index < newSections.length - 1) {
      // 아래로 이동 (Swap with index+1)
      [newSections[index + 1], newSections[index]] = [newSections[index], newSections[index + 1]];
    }
    handleFieldChange('sections', newSections);
  }, [analysis.sections, handleFieldChange]);

  // 섹션으로 스크롤 이동 (미니맵에서 클릭 시)
  const scrollToSection = useCallback((sectionId: string) => {
    setActiveSectionId(sectionId);
    const sectionEl = sectionRefs.current[sectionId];
    if (sectionEl) {
      sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // 메모이제이션된 섹션 개수
  const sectionCount = useMemo(() => analysis.sections.length, [analysis.sections.length]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">상세페이지 기획안 검토</h2>
          <p className="text-gray-500">AI가 제안한 기획안을 검토하고 수정하세요. 이미지 미리보기를 생성하여 최종 시안을 확인할 수 있습니다.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Col: Section MiniMap (sticky) */}
        <div className="lg:col-span-1 hidden lg:block">
          <div className="sticky top-6 space-y-4">

            {/* 섹션 미니맵만 유지 */}
            <SectionMiniMap
              sections={analysis.sections}
              activeSectionId={activeSectionId || undefined}
              onSectionClick={scrollToSection}
              onMoveSection={moveSection}
              onDeleteSection={removeSection}
            />
          </div>
        </div>

        {/* Right Col: Sections */}
        <div className="lg:col-span-2 space-y-6">

          {/* ★ 인트로 섹션 (상품 기본정보) - 최상단 배치 */}
          <details className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group" open>
            <summary className="px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 cursor-pointer text-sm font-bold text-gray-800 flex items-center justify-between hover:from-blue-100 hover:to-indigo-100 transition-colors list-none">
              <div className="flex items-center">
                <ChevronDown className="w-4 h-4 mr-2 text-indigo-500 group-open:rotate-180 transition-transform" />
                📦 상품 기본정보
                <span className="ml-2 text-xs font-normal text-gray-500">(클릭하여 펼치기/접기)</span>
              </div>
              {/* 표시/숨김 토글 스위치 */}
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs text-gray-500">상세페이지 표시</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleFieldChange('showIntroSection', analysis.showIntroSection === false ? true : false);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${analysis.showIntroSection !== false
                    ? 'bg-blue-600'
                    : 'bg-gray-300'
                    }`}
                  title={analysis.showIntroSection !== false ? '클릭하여 인트로 섹션 숨기기' : '클릭하여 인트로 섹션 표시'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${analysis.showIntroSection !== false ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
            </summary>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm border-t border-gray-100">
              {/* 왼쪽 컬럼 */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase">상품명</label>
                  <input
                    type="text"
                    value={analysis.productName}
                    onChange={(e) => handleFieldChange('productName', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-2.5 mt-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase">카테고리</label>
                  <input
                    type="text"
                    value={analysis.detectedCategory || ''}
                    onChange={(e) => handleFieldChange('detectedCategory', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-2.5 mt-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase">마케팅 문구</label>
                  <textarea
                    value={analysis.marketingCopy}
                    onChange={(e) => handleFieldChange('marketingCopy', e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg p-2.5 mt-1 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                  />
                </div>
              </div>
              {/* 오른쪽 컬럼 */}
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase">주요 특징</label>
                <div className="space-y-2 mt-1">
                  {analysis.mainFeatures.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => {
                          const newFeatures = [...analysis.mainFeatures];
                          newFeatures[i] = e.target.value;
                          handleFieldChange('mainFeatures', newFeatures);
                        }}
                        className="flex-1 border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </details>

          <div className="flex items-center mb-4">
            <h3 className="font-bold text-gray-800">섹션 구성 ({sectionCount})</h3>
          </div>

          <div className="space-y-4" ref={sectionsContainerRef}>
            {analysis.sections.map((section, index) => (
              <div
                key={section.id}
                ref={(el) => { sectionRefs.current[section.id] = el; }}
                className={`bg-white p-6 rounded-xl shadow-sm border-2 group transition-all duration-200 ${activeSectionId === section.id
                  ? 'border-indigo-400 ring-2 ring-indigo-100'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
                onClick={() => setActiveSectionId(section.id)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center text-gray-400 flex-wrap gap-1">
                    <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded mr-1">
                      SECTION {index + 1}
                    </span>
                    {/* 단일 배지: 레이아웃 또는 이미지 상태 */}
                    {section.layoutType && section.layoutType !== 'full-width' ? (
                      // 그리드 레이아웃인 경우 레이아웃 타입 표시
                      <span className="bg-purple-100 text-purple-700 text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center" title={`레이아웃: ${section.layoutType}`}>
                        <ImageIcon className="w-3 h-3 mr-0.5" />
                        {section.layoutType}
                      </span>
                    ) : section.imageUrl && !section.isOriginalImage ? (
                      // 이미지가 생성된 경우
                      <span className="bg-green-100 text-green-700 text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center" title="이미지 미리보기 생성됨">
                        <ImageIcon className="w-3 h-3 mr-0.5" />
                        미리보기
                      </span>
                    ) : section.useFixedImage && section.fixedImageBase64 ? (
                      // 고정 이미지 사용
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center" title="고정 이미지 사용">
                        <ImageIcon className="w-3 h-3 mr-0.5" />
                        고정이미지
                      </span>
                    ) : (
                      // 기본: 이미지 대기 중
                      <span className="bg-blue-100 text-blue-700 text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center" title="이미지 대기 중">
                        <ImageIcon className="w-3 h-3 mr-0.5" />
                        전체
                      </span>
                    )}
                    {/* 고정 문구 배지 (추가 정보) */}
                    {section.fixedText && (
                      <span className="bg-amber-100 text-amber-700 text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center" title="고정 문구 포함">
                        <Type className="w-3 h-3 mr-0.5" />
                        고정문구
                      </span>
                    )}
                  </div>
                  {/* Action Buttons - Grouped on Right */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); moveSection(index, 'up'); }}
                      disabled={index === 0}
                      className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30 disabled:hover:bg-transparent text-gray-400 hover:text-gray-600 transition-colors"
                      title="위로 이동"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveSection(index, 'down'); }}
                      disabled={index === analysis.sections.length - 1}
                      className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30 disabled:hover:bg-transparent text-gray-400 hover:text-gray-600 transition-colors"
                      title="아래로 이동"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSection(index); }}
                      className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors"
                      title="섹션 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 다중 이미지 슬롯 섹션 (grid-1, grid-2, grid-3): 1컬럼 레이아웃 */}
                {section.imageSlots && section.imageSlots.length > 1 ? (
                  <div className="space-y-4">
                    {/* 섹션 제목 */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">섹션 제목</label>
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => {
                          const newSections = [...analysis.sections];
                          newSections[index] = { ...newSections[index], title: e.target.value };
                          handleFieldChange('sections', newSections);
                        }}
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    {/* 섹션 설명 */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">상세 설명</label>
                      <textarea
                        rows={4}
                        value={section.content}
                        onChange={(e) => {
                          const newSections = [...analysis.sections];
                          newSections[index] = { ...newSections[index], content: e.target.value };
                          handleFieldChange('sections', newSections);
                        }}
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    {/* 고정 문구 표시 */}
                    {section.fixedText && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <label className="text-xs font-semibold text-amber-700 uppercase mb-1 block flex items-center">
                          <Lock className="w-3 h-3 mr-1" />
                          고정 문구 (자동 포함)
                        </label>
                        <p className="text-sm text-amber-900 whitespace-pre-wrap">{section.fixedText}</p>
                      </div>
                    )}

                    {/* 고정 이미지 표시 */}
                    {section.useFixedImage && section.fixedImageBase64 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <label className="text-xs font-semibold text-emerald-700 uppercase mb-2 block flex items-center">
                          <Lock className="w-3 h-3 mr-1" />
                          고정 이미지 (AI 생성 대신 사용)
                        </label>
                        <div
                          className="w-full h-32 bg-gray-100 rounded border border-emerald-200 cursor-pointer hover:border-emerald-400 transition-colors overflow-hidden flex items-center justify-center p-2"
                          onClick={() => openImageViewModal(
                            `data:${section.fixedImageMimeType};base64,${section.fixedImageBase64}`,
                            `${section.title} (고정 이미지)`,
                            section.id
                          )}
                          title="클릭하여 크게 보기"
                        >
                          <div
                            style={{
                              transform: section.cropZoom && section.cropZoom !== 1
                                ? `scale(${section.cropZoom}) translate(${(section.cropPanX || 0) / section.cropZoom}px, ${(section.cropPanY || 0) / section.cropZoom}px)`
                                : undefined,
                            }}
                          >
                            <img
                              src={`data:${section.fixedImageMimeType};base64,${section.fixedImageBase64}`}
                              alt="고정 이미지"
                              className="max-w-full max-h-32 object-contain"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 이미지 슬롯들 (text-only 레이아웃에서는 숨김) */}
                    <div className={`bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 ${section.useFixedImage ? 'opacity-50' : ''} ${section.layoutType === 'text-only' ? 'hidden' : ''}`}>
                      <label className="text-xs font-semibold text-indigo-600 uppercase mb-2 block flex items-center">
                        <Sparkles className="w-3 h-3 mr-1" />
                        이미지 생성 프롬프트 (한국어/영어 가능)
                        <span className="ml-2 bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full">
                          {section.imageSlots.length}개 이미지
                        </span>
                      </label>
                      <p className="text-xs text-gray-500 mb-3">
                        {section.useFixedImage
                          ? '⚠️ 고정 이미지를 사용하므로 이 프롬프트는 무시됩니다.'
                          : `이 섹션은 ${section.layoutType} 레이아웃으로 ${section.imageSlots.length}개의 이미지가 필요합니다.`
                        }
                      </p>

                      <div className="space-y-3">
                        {section.imageSlots.map((slot, slotIdx) => (
                          <div key={slot.id} className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                              <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center">
                                <ImageIcon className="w-3 h-3 mr-1" />
                                이미지 {slotIdx + 1}/{section.imageSlots!.length} ({slot.slotType})
                              </label>
                              <div className="flex gap-1">
                                {/* 직접 업로드 버튼 */}
                                <label className="text-[10px] px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded flex items-center gap-1 cursor-pointer transition-colors">
                                  <Upload className="w-3 h-3" />
                                  업로드
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadImage(section.id, file, slotIdx);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                                {/* AI 생성 버튼 */}
                                <button
                                  onClick={() => handleGeneratePreview(section.id, undefined, slotIdx)}
                                  disabled={generatingPreviewId === section.id || !slot.prompt}
                                  className="text-[10px] px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded flex items-center gap-1 disabled:opacity-50 transition-colors"
                                >
                                  {generatingPreviewId === section.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="w-3 h-3" />
                                  )}
                                  생성
                                </button>
                              </div>
                            </div>

                            {slot.imageUrl && (
                              <div className="mb-2 relative group/slot">
                                {/* 크롭 설정 저장됨 배지 */}
                                {(slot.cropZoom && slot.cropZoom !== 1) && (
                                  <div className="absolute top-1 left-1 z-10 bg-green-600 text-white text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                                    <ZoomIn className="w-2.5 h-2.5" />
                                    {Math.round(slot.cropZoom * 100)}%
                                  </div>
                                )}
                                <div
                                  className="w-full h-32 bg-gray-100 rounded-lg border border-indigo-200 cursor-pointer hover:border-indigo-400 transition-colors overflow-hidden flex items-center justify-center p-2"
                                  onClick={() => openImageViewModal(
                                    slot.imageUrl!,
                                    `${section.title} - 이미지 ${slotIdx + 1}`,
                                    section.id,
                                    slotIdx
                                  )}
                                  title="클릭하여 크게 보기"
                                >
                                  <div
                                    style={{
                                      transform: (slot.cropZoom && slot.cropZoom !== 1) || slot.cropPanX || slot.cropPanY
                                        ? `scale(${slot.cropZoom || 1}) translate(${(slot.cropPanX || 0) / (slot.cropZoom || 1)}px, ${(slot.cropPanY || 0) / (slot.cropZoom || 1)}px)`
                                        : undefined,
                                    }}
                                  >
                                    <img
                                      src={slot.imageUrl}
                                      alt={`이미지 ${slotIdx + 1}`}
                                      className="max-w-full max-h-32 object-contain"
                                    />
                                  </div>
                                </div>
                                {/* Hover 액션 버튼들 */}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/slot:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2 pointer-events-none group-hover/slot:pointer-events-auto">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openImageViewModal(
                                        slot.imageUrl!,
                                        `${section.title} - 이미지 ${slotIdx + 1}`,
                                        section.id,
                                        slotIdx
                                      );
                                    }}
                                    className="bg-white text-gray-800 px-2 py-1 rounded text-[10px] font-medium flex items-center hover:bg-gray-100 transition-colors"
                                    title="이미지 크게 보기"
                                  >
                                    <Eye className="w-3 h-3 mr-0.5" />
                                    크게보기
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const textarea = document.getElementById(`slot-prompt-${section.id}-${slotIdx}`);
                                      if (textarea) {
                                        textarea.focus();
                                        // 부드럽게 스크롤
                                        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      }
                                    }}
                                    className="bg-white text-gray-800 px-2 py-1 rounded text-[10px] font-medium flex items-center hover:bg-gray-100 transition-colors"
                                    title="프롬프트 수정"
                                  >
                                    <Edit3 className="w-3 h-3 mr-0.5" />
                                    수정
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleGeneratePreview(section.id, undefined, slotIdx);
                                    }}
                                    disabled={generatingPreviewId === section.id}
                                    className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-medium flex items-center hover:bg-blue-700 transition-colors disabled:opacity-50"
                                    title="동일 프롬프트로 재생성"
                                  >
                                    <RefreshCw className={`w-3 h-3 mr-0.5 ${generatingPreviewId === section.id ? 'animate-spin' : ''}`} />
                                    재생성
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // 슬롯 이미지 제거
                                      const newSlots = [...(section.imageSlots || [])];
                                      newSlots[slotIdx] = { ...newSlots[slotIdx], imageUrl: undefined };
                                      const newSections = [...analysis.sections];
                                      newSections[index] = { ...newSections[index], imageSlots: newSlots };
                                      handleFieldChange('sections', newSections);
                                    }}
                                    className="bg-red-500 text-white p-1 rounded hover:bg-red-600 transition-colors"
                                    title="이미지 삭제"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                  {/* 업로드 버튼 */}
                                  <label className="bg-green-600 text-white p-1 rounded hover:bg-green-700 transition-colors cursor-pointer" title="직접 업로드">
                                    <Upload className="w-3 h-3" />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        const file = e.target.files?.[0];
                                        if (file) handleUploadImage(section.id, file, slotIdx);
                                        e.target.value = '';
                                      }}
                                    />
                                  </label>
                                </div>
                                <p className="text-xs text-green-600 flex items-center mt-1">
                                  <Eye className="w-3 h-3 mr-1" />
                                  미리보기 생성 완료 - 마우스를 올려 수정/재생성
                                </p>
                              </div>
                            )}

                            <textarea
                              id={`slot-prompt-${section.id}-${slotIdx}`}
                              rows={2}
                              value={slot.prompt}
                              onChange={(e) => {
                                const newSlots = [...(section.imageSlots || [])];
                                newSlots[slotIdx] = { ...newSlots[slotIdx], prompt: e.target.value };
                                const newSections = [...analysis.sections];
                                newSections[index] = { ...newSections[index], imageSlots: newSlots };
                                handleFieldChange('sections', newSections);
                              }}
                              disabled={section.useFixedImage}
                              className={`w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm text-gray-600 focus:ring-1 focus:ring-indigo-500 focus:outline-none ${section.useFixedImage ? 'cursor-not-allowed' : ''}`}
                              placeholder={`이미지 ${slotIdx + 1}의 스타일을 설명하세요`}
                            />
                          </div>
                        ))}

                        <button
                          onClick={() => handleGeneratePreview(section.id)}
                          disabled={generatingPreviewId === section.id}
                          className="w-full py-2.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                          {generatingPreviewId === section.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              이미지 생성 중...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              전체 {section.imageSlots.length}개 이미지 미리보기 생성
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleGeneratePreview(section.id, undefined, undefined, true)}
                          disabled={generatingPreviewId === section.id}
                          className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                          <Sparkles className="w-3 h-3" />
                          이미지 미리보기 생성
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 단일 이미지 섹션: text-only는 1컬럼, 나머지는 45:55 레이아웃 */
                  <div className={section.layoutType === 'text-only' ? 'space-y-4' : 'grid md:grid-cols-[45%_1fr] gap-6'}>
                    {/* 좌측: 텍스트 입력 영역 */}
                    <div className="space-y-4">
                      {/* 섹션 제목 */}
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase">섹션 제목</label>
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => handleSectionChange(index, 'title', e.target.value)}
                          className="w-full border-b border-gray-300 py-2 focus:border-blue-500 focus:outline-none font-medium text-gray-900"
                          placeholder="제목을 입력하세요"
                        />
                      </div>

                      {/* ★ 업로드 전용 섹션: 상세설명/고정문구/프롬프트 숨기고 업로드 UI만 표시 */}
                      {section.isUploadOnly ? (
                        <div className="bg-sky-50 p-6 rounded-lg border border-dashed border-sky-300 flex flex-col items-center justify-center text-center">
                          <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center mb-3 text-sky-500">
                            <Upload className="w-6 h-6" />
                          </div>
                          <h4 className="text-sm font-bold text-sky-800 mb-1">사용자 직접 업로드 전용 섹션</h4>
                          <p className="text-xs text-sky-600 mb-4">
                            AI 이미지 생성 없이<br />사용자가 직접 이미지를 등록하는 영역입니다.
                          </p>
                          <label className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 cursor-pointer transition-colors shadow-sm">
                            <Upload className="w-4 h-4" />
                            이미지 파일 선택
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadImage(section.id, file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                      ) : (
                        <>
                          {/* 상세 설명 */}
                          <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase">상세 설명</label>
                            <textarea
                              rows={4}
                              value={section.content}
                              onChange={(e) => handleSectionChange(index, 'content', e.target.value)}
                              className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-700 focus:ring-1 focus:ring-blue-500 focus:outline-none mt-1"
                              placeholder="섹션 내용을 입력하세요"
                            />
                          </div>

                          {/* 고정 문구 표시 */}
                          {section.fixedText && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                              <label className="text-xs font-semibold text-amber-700 uppercase flex items-center mb-1">
                                <Lock className="w-3 h-3 mr-1" />
                                고정 문구
                              </label>
                              <p className="text-sm text-amber-800">{section.fixedText}</p>
                            </div>
                          )}

                          {/* 이미지 생성 프롬프트 (좌측 하단) */}
                          {section.layoutType !== 'text-only' && (
                            <div className={`bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 ${section.useFixedImage ? 'opacity-50' : ''}`}>
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-semibold text-indigo-600 uppercase flex items-center">
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  이미지 생성 프롬프트
                                </label>
                                {/* AI 추천 버튼 */}
                                <button
                                  onClick={() => generateAIPrompt(section.id)}
                                  disabled={section.useFixedImage}
                                  className="px-2 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded text-xs font-medium flex items-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                  title="상품 정보를 기반으로 프롬프트 자동 생성"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  AI 추천
                                </button>
                              </div>
                              <p className="text-xs text-gray-500 mb-2">
                                {section.useFixedImage
                                  ? '⚠️ 고정 이미지를 사용하므로 이 프롬프트는 무시됩니다.'
                                  : '한국어 또는 영어로 이미지 스타일을 설명하세요.'
                                }
                              </p>
                              <textarea
                                rows={3}
                                value={section.imagePrompt}
                                onChange={(e) => handleSectionChange(index, 'imagePrompt', e.target.value)}
                                disabled={section.useFixedImage}
                                className={`w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm text-gray-600 focus:ring-1 focus:ring-indigo-500 focus:outline-none ${section.useFixedImage ? 'cursor-not-allowed' : ''}`}
                                placeholder="예: 나무 테이블 위의 상품, 미니멀한 배경, 고품질 사진"
                              />
                              {/* 버튼 영역 */}
                              <div className="flex gap-2 mt-3">
                                <button
                                  onClick={() => handleGeneratePreview(section.id)}
                                  disabled={generatingPreviewId === section.id || !section.imagePrompt || section.useFixedImage}
                                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {generatingPreviewId === section.id ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      생성 중...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="w-4 h-4" />
                                      이미지 생성
                                    </>
                                  )}
                                </button>
                                <label className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium flex items-center gap-2 cursor-pointer transition-colors">
                                  <Upload className="w-4 h-4" />
                                  업로드
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadImage(section.id, file, 0);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* 우측: 이미지 미리보기 영역 (h-64) - text-only에서는 숨김 */}
                    {section.layoutType !== 'text-only' && (
                      <div className="flex flex-col">
                        {/* 고정 이미지 미리보기 */}
                        {section.useFixedImage && section.fixedImageBase64 ? (
                          <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                            <label className="text-xs font-semibold text-emerald-700 uppercase flex items-center mb-3">
                              <Lock className="w-3 h-3 mr-1" />
                              고정 이미지 (AI 생성 대신 사용)
                            </label>
                            <div
                              className="w-full h-64 bg-white rounded-lg border border-emerald-200 cursor-pointer hover:border-emerald-400 transition-colors overflow-hidden"
                              onClick={() => openImageViewModal(
                                `data:${section.fixedImageMimeType};base64,${section.fixedImageBase64}`,
                                `${section.title} (고정 이미지)`,
                                section.id
                              )}
                              title="클릭하여 크게 보기"
                            >
                              <img
                                src={`data:${section.fixedImageMimeType};base64,${section.fixedImageBase64}`}
                                alt="고정 이미지"
                                className="w-full h-full object-cover"
                                style={{
                                  transform: (section.cropZoom && section.cropZoom !== 1) || section.cropPanX || section.cropPanY
                                    ? `scale(${section.cropZoom || 1}) translate(${-(section.cropPanX || 0) / (section.cropZoom || 1)}px, ${-(section.cropPanY || 0) / (section.cropZoom || 1)}px)`
                                    : undefined,
                                  transformOrigin: 'center center'
                                }}
                              />
                            </div>
                          </div>
                        ) : section.imageSlots && section.imageSlots.length > 0 && !section.layoutType?.startsWith('collage-') && section.imageSlots.some(slot => slot.imageUrl) ? (
                          /* 슬롯 이미지 미리보기 (그리드 레이아웃 - 콜라주 제외, 실제 이미지 있는 경우만) */
                          <div className="flex-1 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                            <label className="text-xs font-semibold text-indigo-600 uppercase flex items-center mb-3">
                              <ImageIcon className="w-3 h-3 mr-1" />
                              이미지 미리보기 (슬롯 {section.imageSlots.length}개)
                            </label>
                            <div className="w-full h-64 bg-gray-100 rounded-lg border border-indigo-200 overflow-hidden">
                              <div className={`w-full h-full grid gap-1 ${section.imageSlots.length === 1 ? 'grid-cols-1' :
                                section.imageSlots.length === 2 ? 'grid-cols-2' :
                                  'grid-cols-2'
                                }`}>
                                {section.imageSlots.map((slot, idx) => (
                                  <div
                                    key={slot.id}
                                    className="relative group w-full h-full bg-white overflow-hidden cursor-pointer"
                                    onClick={() => slot.imageUrl && openImageViewModal(slot.imageUrl, `${section.title} - 슬롯 ${idx + 1}`, section.id, idx)}
                                  >
                                    {slot.imageUrl ? (
                                      <>
                                        <div
                                          className="w-full h-full"
                                          style={{
                                            transform: (slot.cropZoom && slot.cropZoom !== 1) || slot.cropPanX || slot.cropPanY
                                              ? `scale(${slot.cropZoom || 1}) translate(${(slot.cropPanX || 0) / (slot.cropZoom || 1)}px, ${(slot.cropPanY || 0) / (slot.cropZoom || 1)}px)`
                                              : undefined,
                                            transformOrigin: 'center center'
                                          }}
                                        >
                                          <img
                                            src={slot.imageUrl}
                                            alt={`슬롯 ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                        {/* 슬롯별 라벨 및 액션 */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              // 해당 슬롯에 이미지 업로드 트리거
                                              const input = document.getElementById(`upload-slot-${section.id}-${idx}`) as HTMLInputElement;
                                              if (input) input.click();
                                            }}
                                            className="p-1.5 bg-white text-indigo-600 rounded hover:bg-indigo-50"
                                            title="이 슬롯 이미지 교체"
                                          >
                                            <Upload className="w-3 h-3" />
                                          </button>
                                          <input
                                            id={`upload-slot-${section.id}-${idx}`}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) handleUploadImage(section.id, file, idx);
                                              e.target.value = '';
                                            }}
                                          />
                                          {slot.imageUrl && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openImageViewModal(slot.imageUrl!, `${section.title} - 슬롯 ${idx + 1}`, section.id, idx);
                                              }}
                                              className="p-1.5 bg-white text-gray-700 rounded hover:bg-gray-100"
                                              title="크게 보기 / 크롭"
                                            >
                                              <Eye className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                        <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                                          #{idx + 1}
                                        </div>
                                      </>
                                    ) : (
                                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                        <ImageIcon className="w-6 h-6 mb-1 opacity-50" />
                                        <span className="text-[10px]">빈 슬롯</span>
                                        {/* 빈 슬롯 클릭 시 업로드 */}
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="absolute inset-0 opacity-0 cursor-pointer"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleUploadImage(section.id, file, idx);
                                            e.target.value = '';
                                          }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <p className="text-xs text-green-600 flex items-center mt-2">
                              <Eye className="w-3 h-3 mr-1" />
                              슬롯 이미지를 클릭하여 관리하세요
                            </p>
                          </div>
                        ) : section.imageUrl && !section.isOriginalImage ? (
                          /* 생성된 이미지 미리보기 */
                          <div className="flex-1 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                            <label className="text-xs font-semibold text-indigo-600 uppercase flex items-center mb-3">
                              <ImageIcon className="w-3 h-3 mr-1" />
                              이미지 미리보기
                            </label>
                            <div className="relative group">
                              {/* 크롭 설정 저장됨 배지 */}
                              {(section.cropZoom && section.cropZoom !== 1) && (
                                <div className="absolute top-2 left-2 z-10 bg-green-600 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                                  <ZoomIn className="w-3 h-3" />
                                  {Math.round(section.cropZoom * 100)}%
                                </div>
                              )}
                              <div
                                className="w-full h-64 bg-gray-100 rounded-lg border border-indigo-200 cursor-pointer hover:border-indigo-400 transition-colors overflow-hidden flex items-center justify-center p-4"
                                onClick={() => openImageViewModal(
                                  section.imageUrl!,
                                  section.title,
                                  section.id
                                )}
                                title="클릭하여 크게 보기"
                              >
                                <div
                                  style={{
                                    transform: (section.cropZoom && section.cropZoom !== 1) || section.cropPanX || section.cropPanY
                                      ? `scale(${section.cropZoom || 1}) translate(${(section.cropPanX || 0) / (section.cropZoom || 1)}px, ${(section.cropPanY || 0) / (section.cropZoom || 1)}px)`
                                      : undefined,
                                  }}
                                >
                                  <img
                                    src={section.imageUrl}
                                    alt="미리보기"
                                    className="max-w-full max-h-64 object-contain"
                                  />
                                </div>
                              </div>
                              {/* 호버 액션 버튼들 */}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openImageViewModal(
                                      section.imageUrl!,
                                      section.title,
                                      section.id
                                    );
                                  }}
                                  className="bg-white text-gray-800 px-3 py-2 rounded-lg text-xs font-medium flex items-center hover:bg-gray-100 transition-colors"
                                  title="이미지 크게 보기"
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  크게보기
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditPrompt(section.id);
                                  }}
                                  className="bg-white text-gray-800 px-3 py-2 rounded-lg text-xs font-medium flex items-center hover:bg-gray-100 transition-colors"
                                  title="프롬프트 수정 후 재생성"
                                >
                                  <Edit3 className="w-4 h-4 mr-1" />
                                  수정
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGeneratePreview(section.id);
                                  }}
                                  disabled={generatingPreviewId === section.id}
                                  className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-medium flex items-center hover:bg-blue-700 transition-colors disabled:opacity-50"
                                  title="동일 프롬프트로 재생성"
                                >
                                  <RefreshCw className={`w-4 h-4 mr-1 ${generatingPreviewId === section.id ? 'animate-spin' : ''}`} />
                                  재생성
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemovePreview(section.id);
                                  }}
                                  className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-colors"
                                  title="미리보기 제거"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-green-600 flex items-center mt-2">
                              <Eye className="w-3 h-3 mr-1" />
                              미리보기 생성 완료 - 마우스를 올려 수정/재생성
                            </p>
                          </div>
                        ) : section.imageUrl ? (
                          /* 업로드 전용 모드이거나 프롬프트 없이 직접 업로드한 이미지 미리보기 */
                          <div className="flex-1 bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <label className="text-xs font-semibold text-blue-600 uppercase flex items-center mb-3">
                              <ImageIcon className="w-3 h-3 mr-1" />
                              사용자 등록 이미지
                            </label>
                            <div className="relative group">
                              <div
                                className="w-full h-64 bg-white rounded-lg border border-blue-200 cursor-pointer hover:border-blue-400 transition-colors overflow-hidden flex items-center justify-center p-4"
                                onClick={() => openImageViewModal(
                                  section.imageUrl!,
                                  section.title,
                                  section.id
                                )}
                                title="클릭하여 크게 보기"
                              >
                                <img
                                  src={section.imageUrl}
                                  alt="사용자 등록 이미지"
                                  className="max-w-full max-h-64 object-contain"
                                />
                              </div>
                              {/* 호버 액션 버튼들 (직접 등록 이미지이므로 생성 관련 버튼 제외) */}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openImageViewModal(
                                      section.imageUrl!,
                                      section.title,
                                      section.id
                                    );
                                  }}
                                  className="bg-white text-gray-800 px-3 py-2 rounded-lg text-xs font-medium flex items-center hover:bg-gray-100 transition-colors"
                                  title="이미지 크게 보기"
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  크게보기
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // 파일 객체를 직접 제거하도록 처리해야 하지만, 
                                    // StepAnalysis에서는 handleRemovePreview가 동일하게 초기화 해줍니다.
                                    handleRemovePreview(section.id);
                                  }}
                                  className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-colors"
                                  title="최종 생성시 반영 안됨"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-blue-600 flex items-center mt-2">
                              <Upload className="w-3 h-3 mr-1" />
                              업로드 완료 - 최종 페이지에 그대로 반영됩니다.
                            </p>
                          </div>
                        ) : (
                          /* 이미지 없는 경우: 플레이스홀더 (프롬프트/업로드 전용 가리지 않음) */
                          <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4">
                            <div className="w-full h-full bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center min-h-[260px] relative">
                               {/* 업로드 전용 섹션일 경우 빈 슬롯 클릭 시 파일 업로드 창 띄우기 */}
                               {section.isUploadOnly && (
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadImage(section.id, file);
                                      e.target.value = '';
                                    }}
                                  />
                               )}
                              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                                <ImageIcon className="w-8 h-8 text-gray-400" />
                              </div>
                              <p className="text-sm text-gray-500 text-center mb-1">이미지 미리보기 영역</p>
                              {section.isUploadOnly ? (
                                <p className="text-xs text-gray-400 text-center">
                                  좌측에서 직접 업로드 버튼을 누르거나<br />이곳을 클릭하여 이미지를 등록하세요
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400 text-center">
                                  좌측에서 프롬프트를 입력하고<br />
                                  "이미지 생성" 버튼을 클릭하세요
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 프롬프트 수정 모달 */}
      {
        editPromptModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center">
                  <Edit3 className="w-5 h-5 mr-2" />
                  이미지 프롬프트 수정
                </h3>
                <p className="text-indigo-100 text-sm mt-1">프롬프트를 수정하고 새로운 이미지를 생성합니다.</p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이미지 생성 프롬프트 (한국어/영어 가능)
                  </label>
                  <textarea
                    rows={5}
                    value={editPromptModal.prompt}
                    onChange={(e) => setEditPromptModal({ ...editPromptModal, prompt: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="예: 나무 테이블 위의 상품, 미니멀한 배경, 고품질 사진"
                  />
                </div>

                {/* 배경 선택 드롭다운 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <ImageIcon className="w-4 h-4 mr-1.5 text-indigo-500" />
                    이미지 배경 선택
                  </label>
                  <select
                    value={editPromptModal.backgroundType}
                    onChange={(e) => setEditPromptModal({
                      ...editPromptModal,
                      backgroundType: e.target.value
                    })}
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white cursor-pointer"
                  >
                    {backgroundOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {editPromptModal.backgroundType !== 'original' && (
                    <p className="text-xs text-indigo-600 mt-1.5 flex items-center">
                      <Sparkles className="w-3 h-3 mr-1" />
                      선택한 배경 스타일이 프롬프트에 자동 적용됩니다.
                    </p>
                  )}
                </div>

                <p className="text-xs text-gray-500">
                  💡 팁: 구체적인 설명을 추가할수록 원하는 이미지를 얻을 수 있습니다.
                </p>
              </div>


              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                <button
                  onClick={() => setEditPromptModal(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmEditPrompt}
                  disabled={!editPromptModal.prompt.trim()}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  이미지 재생성
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* 이미지 확대 보기 모달 (Pan & Zoom) */}
      {
        imageViewModal && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setImageViewModal(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 헤더 */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center">
                    <ImageIcon className="w-5 h-5 mr-2" />
                    이미지 미리보기
                  </h3>
                  <p className="text-blue-100 text-sm mt-0.5">{imageViewModal.sectionTitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* 줌 컨트롤 */}
                  <div className="flex items-center bg-white/10 rounded-lg px-2 py-1 gap-1">
                    <button
                      onClick={() => handleZoom(-0.25)}
                      className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
                      title="축소"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-white text-sm font-medium min-w-[50px] text-center">
                      {Math.round(imageViewModal.zoom * 100)}%
                    </span>
                    <button
                      onClick={() => handleZoom(0.25)}
                      className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
                      title="확대"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleResetZoom}
                      className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors ml-1"
                      title="초기화"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setImageViewModal(null)}
                    className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* 이미지 영역 (Pan & Zoom) */}
              <div
                className={`flex-1 overflow-hidden p-6 bg-gray-100 flex items-center justify-center ${imageViewModal.zoom > 1 ? 'cursor-grab' : 'cursor-default'
                  } ${isDragging ? 'cursor-grabbing' : ''}`}
                onWheel={handleWheelZoom}
                onMouseDown={handleDragStart}
                onMouseMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
              >
                <div
                  style={{
                    transform: `scale(${imageViewModal.zoom}) translate(${imageViewModal.panX / imageViewModal.zoom}px, ${imageViewModal.panY / imageViewModal.zoom}px)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                  }}
                >
                  <img
                    src={imageViewModal.imageUrl}
                    alt={imageViewModal.sectionTitle}
                    className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-lg select-none"
                    draggable={false}
                  />
                </div>
              </div>

              {/* 도움말 & 액션 버튼 */}
              <div className="bg-white border-t px-6 py-4 flex justify-between items-center">
                <div className="text-sm text-gray-500 flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <ZoomIn className="w-4 h-4" />
                    마우스 휠: 확대/축소
                  </span>
                  {imageViewModal.zoom > 1 && (
                    <span className="flex items-center gap-1">
                      <Move className="w-4 h-4" />
                      드래그: 이동
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  {/* 크롭 설정 저장 버튼 */}
                  <button
                    onClick={handleSaveCrop}
                    disabled={imageViewModal.zoom === 1 && imageViewModal.panX === 0 && imageViewModal.panY === 0}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="현재 확대/위치 설정을 저장하여 최종 출력물에 반영합니다"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    크롭 저장
                  </button>
                  <button
                    onClick={() => {
                      setImageViewModal(null);
                      handleOpenEditPrompt(imageViewModal.sectionId);
                    }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium flex items-center transition-colors"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    프롬프트 수정
                  </button>
                  <button
                    onClick={() => {
                      setImageViewModal(null);
                      handleGeneratePreview(imageViewModal.sectionId);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    재생성
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* 섹션 추가 모달 (확장) */}
      {
        addSectionModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
              {/* 헤더 */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center flex-shrink-0">
                <h3 className="text-lg font-bold text-white">새 섹션 추가</h3>
                <button onClick={() => setAddSectionModal(null)} className="text-white/80 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 탭 */}
              <div className="flex border-b flex-shrink-0">
                <button
                  onClick={() => setAddSectionModal({ ...addSectionModal, activeTab: 'new' })}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${addSectionModal.activeTab === 'new'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  새로 만들기
                </button>
                <button
                  onClick={() => setAddSectionModal({ ...addSectionModal, activeTab: 'preset' })}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${addSectionModal.activeTab === 'preset'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <Bookmark className="w-4 h-4 inline mr-1" />
                  프리셋에서 ({sectionPresets.length})
                </button>
              </div>

              {/* 콘텐츠 */}
              <div className="flex-1 overflow-y-auto">
                {/* 새로 만들기 탭 */}
                {addSectionModal.activeTab === 'new' && (
                  <div className="p-6 space-y-5">
                    {/* 섹션 타입 선택 */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">섹션 타입</label>
                      <select
                        value={addSectionModal.sectionType}
                        onChange={(e) => {
                          const newType = e.target.value;
                          const recommendedLayout = layoutRecommendations[newType] || 'full-width';
                          setAddSectionModal({
                            ...addSectionModal,
                            sectionType: newType,
                            layoutType: recommendedLayout,
                            slotCount: recommendedLayout === 'grid-3' ? 3 : recommendedLayout === 'grid-2' ? 2 : 1
                          });
                        }}
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        {Object.entries(sectionTypeLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>

                    {/* 레이아웃 선택 */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        레이아웃 <span className="text-xs font-normal text-gray-400">(타입에 따라 자동 추천)</span>
                      </label>
                      <select
                        value={addSectionModal.layoutType}
                        onChange={(e) => {
                          const newLayout = e.target.value;
                          setAddSectionModal({
                            ...addSectionModal,
                            layoutType: newLayout,
                            slotCount: newLayout === 'grid-3' ? 3 : newLayout === 'grid-2' ? 2 : 1
                          });
                        }}
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        {Object.entries(layoutTypeLabels).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>

                    {/* 이미지 슬롯 수 (Grid 레이아웃일 때만) */}
                    {(addSectionModal.layoutType === 'grid-1' || addSectionModal.layoutType === 'grid-2' || addSectionModal.layoutType === 'grid-3') && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">이미지 슬롯 수</label>
                        <div className="flex gap-2">
                          {[2, 3, 4].map((num) => (
                            <button
                              key={num}
                              onClick={() => setAddSectionModal({ ...addSectionModal, slotCount: num })}
                              className={`flex-1 py-2 rounded-lg border font-medium transition-colors ${addSectionModal.slotCount === num
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                              {num}개
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 고급 설정 토글 */}
                    <button
                      onClick={() => setAddSectionModal({ ...addSectionModal, showAdvanced: !addSectionModal.showAdvanced })}
                      className="w-full flex items-center justify-between py-2 px-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-600 transition-colors"
                    >
                      <span className="flex items-center">
                        <Lock className="w-4 h-4 mr-2" />
                        고급 설정 (고정 문구/이미지)
                      </span>
                      {addSectionModal.showAdvanced ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {/* 고급 설정 영역 */}
                    {addSectionModal.showAdvanced && (
                      <div className="space-y-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                        {/* 고정 문구 */}
                        <div>
                          <label className="text-xs font-bold text-amber-700 block mb-1.5 flex items-center">
                            <Type className="w-3 h-3 mr-1" />
                            고정 문구
                          </label>
                          <textarea
                            rows={2}
                            value={addSectionModal.fixedText}
                            onChange={(e) => setAddSectionModal({ ...addSectionModal, fixedText: e.target.value })}
                            placeholder="예: '무료 배송', 'KC 인증 완료' 등"
                            className="w-full text-sm border border-amber-200 bg-white rounded-lg p-2.5 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none resize-none"
                          />
                        </div>

                        {/* 고정 이미지 */}
                        <div>
                          <label className="text-xs font-bold text-emerald-700 block mb-1.5 flex items-center">
                            <ImageIcon className="w-3 h-3 mr-1" />
                            고정 이미지
                          </label>

                          <input
                            type="file"
                            ref={modalImageInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleModalImageUpload(file);
                              e.target.value = '';
                            }}
                          />

                          {addSectionModal.fixedImageBase64 ? (
                            <div className="relative group">
                              <img
                                src={`data:${addSectionModal.fixedImageMimeType || 'image/png'};base64,${addSectionModal.fixedImageBase64}`}
                                alt="고정 이미지"
                                className="w-full h-32 object-contain bg-white rounded-lg border border-emerald-200"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                                <button
                                  onClick={() => modalImageInputRef.current?.click()}
                                  className="px-3 py-1.5 bg-white text-gray-700 rounded-lg text-xs font-medium"
                                >
                                  변경
                                </button>
                                <button
                                  onClick={handleRemoveModalImage}
                                  className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium"
                                >
                                  삭제
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => modalImageInputRef.current?.click()}
                              className="border-2 border-dashed border-emerald-200 rounded-lg p-4 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all"
                            >
                              <Upload className="w-6 h-6 mx-auto mb-1 text-emerald-300" />
                              <p className="text-xs font-medium text-emerald-600">클릭하여 업로드</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 프리셋으로 저장 옵션 */}
                    {addSectionModal.saveAsPreset ? (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
                        <label className="text-xs font-bold text-indigo-700 block flex items-center">
                          <Bookmark className="w-3 h-3 mr-1" />
                          프리셋 이름
                        </label>
                        <input
                          type="text"
                          value={addSectionModal.presetName}
                          onChange={(e) => setAddSectionModal({ ...addSectionModal, presetName: e.target.value })}
                          placeholder="예: 배송/반품 안내"
                          className="w-full text-sm border border-indigo-200 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-400 outline-none"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setAddSectionModal({ ...addSectionModal, saveAsPreset: false, presetName: '' })}
                            className="flex-1 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
                          >
                            취소
                          </button>
                          <button
                            onClick={handleSaveAsPreset}
                            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddSectionModal({ ...addSectionModal, saveAsPreset: true })}
                        className="w-full py-2 text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg font-medium transition-colors flex items-center justify-center"
                      >
                        <Bookmark className="w-4 h-4 mr-1" />
                        이 설정을 프리셋으로 저장
                      </button>
                    )}
                  </div>
                )}

                {/* 프리셋에서 탭 */}
                {addSectionModal.activeTab === 'preset' && (
                  <div className="p-6">
                    {sectionPresets.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">저장된 프리셋이 없습니다</p>
                        <p className="text-sm mt-1">"새로 만들기" 탭에서 프리셋을 저장하세요</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sectionPresets.map((preset) => (
                          <div
                            key={preset.id}
                            className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all group cursor-pointer"
                            onClick={() => handleApplyPreset(preset)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                                  {preset.name}
                                </h4>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                    {sectionTypeLabels[preset.sectionType] || preset.sectionType}
                                  </span>
                                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                    {layoutTypeLabels[preset.layoutType] || preset.layoutType}
                                  </span>
                                  {preset.fixedText && (
                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded flex items-center">
                                      <Type className="w-2 h-2 mr-0.5" />
                                      고정문구
                                    </span>
                                  )}
                                  {preset.fixedImageBase64 && (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded flex items-center">
                                      <ImageIcon className="w-2 h-2 mr-0.5" />
                                      고정이미지
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePreset(preset.id);
                                }}
                                className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="프리셋 삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            {preset.fixedImageBase64 && (
                              <div className="mt-3">
                                <img
                                  src={`data:${preset.fixedImageMimeType || 'image/png'};base64,${preset.fixedImageBase64}`}
                                  alt="프리셋 고정 이미지"
                                  className="w-full h-20 object-contain bg-gray-50 rounded border border-gray-100"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 푸터 (새로 만들기 탭에서만 표시) */}
              {addSectionModal.activeTab === 'new' && !addSectionModal.saveAsPreset && (
                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 flex-shrink-0 border-t">
                  <button
                    onClick={() => setAddSectionModal(null)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={confirmAddSection}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    섹션 추가
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      }
      {/* 하단 플로팅 액션 바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-2xl z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* 섹션/이미지 상태 정보 */}
          <div className="flex items-center gap-4">


            <div className="flex items-center gap-2">
              <div className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                <span className="font-bold text-sm">{analysis.sections.length}개 섹션</span>
              </div>
            </div>
            <div className="text-xs text-gray-500 hidden sm:block">
              이미지: {analysis.sections.filter(s => s.imageUrl || s.imageSlots?.some(slot => slot.imageUrl) || s.layoutType === 'text-only').length}/{analysis.sections.length} 완료
            </div>
          </div>

          {/* 상세페이지 생성 버튼 */}
          {/* 버튼 그룹 */}
          <div className="flex items-center gap-3">
            <button
              onClick={openAddSectionModal}
              className="px-5 py-3 bg-white border-2 border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl font-bold text-sm shadow-sm hover:shadow transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              섹션 추가
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  상세페이지 생성 시작
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 하단 플로팅 바 공간 확보 */}
      <div className="h-32" />
    </div >
  );
});

StepAnalysis.displayName = 'StepAnalysis';