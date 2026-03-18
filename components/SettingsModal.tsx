import React, { useState, useEffect, useRef } from 'react';
import { X, Table, LayoutTemplate, Plus, Trash2, Loader2, Save, Check, Info, Edit2, ArrowUp, ArrowDown, ChevronLeft, ChevronDown, ChevronUp, Layout, FileText, Image as ImageIcon, Upload, ToggleLeft, ToggleRight, Type, Cloud, CloudOff, RefreshCw, Layers, Star } from 'lucide-react';
import { getGasUrl, setGasUrl as saveGasUrl, getSheetId, setSheetId as saveSheetId, DEFAULT_GAS_URL } from '../services/googleSheetService';
import { getTemplates, saveTemplate, deleteTemplate, getDefaultTemplateId, setDefaultTemplateId, createNewTemplate as createNewTemplateService } from '../services/templateService';
import { CATEGORY_OPTIONS } from '../services/categoryPresets';
import { extractTemplateFromImage, fileToGenerativePart, getImageSlotCountForLayout } from '../services/geminiService';
import {
  isAutoBackupEnabled,
  setAutoBackupEnabled,
  backupSettingsToDrive,
  restoreSettingsFromDrive,
  applyRestoredSettings,
  getLastBackupDate
} from '../services/settingsBackupService';
import { useToastContext } from '../contexts/ToastContext';
import { TemplatePreview } from './TemplatePreview';
import { Template, SectionData, SectionType, ImageSlotType, ImageSlot, LayoutType } from '../types';

// 섹션 타입 옵션
const SECTION_TYPE_OPTIONS: { value: SectionType; label: string; icon: string }[] = [
  { value: 'title', label: '타이틀', icon: '📌' },
  { value: 'hero', label: '메인 비주얼', icon: '🖼️' },
  { value: 'description', label: '상품 설명', icon: '📝' },
  { value: 'colors', label: '색상 옵션', icon: '🎨' },
  { value: 'material_detail', label: '소재 상세', icon: '🧵' },
  { value: 'styling', label: '스타일링', icon: '👗' },
  { value: 'fit', label: '핏/사이즈', icon: '📐' },
  { value: 'spec', label: '스펙/사양', icon: '📋' },
  { value: 'notice', label: '안내사항', icon: '⚠️' },
  { value: 'custom', label: '사용자 정의', icon: '✏️' },
];

// 이미지 슬롯 타입 옵션
const IMAGE_SLOT_TYPE_OPTIONS: { value: ImageSlotType; label: string }[] = [
  { value: 'hero', label: '대표 이미지' },
  { value: 'product', label: '상품 이미지' },
  { value: 'detail', label: '디테일 컷' },
  { value: 'material', label: '소재/텍스처' },
  { value: 'color_styling', label: '색상/스타일링' },
  { value: 'fit', label: '착용/핏' },
  { value: 'spec', label: '스펙 도표' },
  { value: 'notice', label: '안내 이미지' },
  { value: 'custom', label: '사용자 정의' },
];

// 레이아웃 타입 옵션 (아이콘 SVG 포함)
const LAYOUT_OPTIONS: { value: LayoutType; label: string; icon: React.FC<{ className?: string }> }[] = [
  {
    value: 'full-width',
    label: '전체 너비',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className}>
        <rect x="2" y="4" width="20" height="16" rx="1" fill="currentColor" opacity="0.4" />
      </svg>
    )
  },
  {
    value: 'split-left',
    label: '좌측 이미지',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className}>
        <rect x="2" y="4" width="9" height="16" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="13" y="6" width="8" height="2" rx="0.5" fill="currentColor" opacity="0.2" />
        <rect x="13" y="10" width="8" height="1.5" rx="0.5" fill="currentColor" opacity="0.15" />
        <rect x="13" y="13" width="6" height="1.5" rx="0.5" fill="currentColor" opacity="0.15" />
      </svg>
    )
  },
  {
    value: 'split-right',
    label: '우측 이미지',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className}>
        <rect x="13" y="4" width="9" height="16" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="2" y="6" width="8" height="2" rx="0.5" fill="currentColor" opacity="0.2" />
        <rect x="2" y="10" width="8" height="1.5" rx="0.5" fill="currentColor" opacity="0.15" />
        <rect x="2" y="13" width="6" height="1.5" rx="0.5" fill="currentColor" opacity="0.15" />
      </svg>
    )
  },
  {
    value: 'grid-1',
    label: '3행 그리드',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className}>
        <rect x="4" y="4" width="16" height="4.5" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="4" y="9.5" width="16" height="4.5" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="4" y="15" width="16" height="4.5" rx="1" fill="currentColor" opacity="0.4" />
      </svg>
    )
  },
  {
    value: 'grid-2',
    label: '2열 그리드',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className}>
        <rect x="2" y="4" width="9" height="16" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="13" y="4" width="9" height="16" rx="1" fill="currentColor" opacity="0.4" />
      </svg>
    )
  },
  {
    value: 'grid-3',
    label: '3열 그리드',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className}>
        <rect x="2" y="4" width="6" height="16" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="9" y="4" width="6" height="16" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="16" y="4" width="6" height="16" rx="1" fill="currentColor" opacity="0.4" />
      </svg>
    )
  },
  {
    value: 'text-only',
    label: '텍스트만',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className}>
        <rect x="4" y="6" width="16" height="2" rx="0.5" fill="currentColor" opacity="0.3" />
        <rect x="4" y="10" width="16" height="1.5" rx="0.5" fill="currentColor" opacity="0.2" />
        <rect x="4" y="13" width="12" height="1.5" rx="0.5" fill="currentColor" opacity="0.2" />
        <rect x="4" y="16" width="14" height="1.5" rx="0.5" fill="currentColor" opacity="0.2" />
      </svg>
    )
  },
  {
    value: 'image-only',
    label: '이미지만',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className}>
        <rect x="2" y="4" width="20" height="16" rx="1" fill="currentColor" opacity="0.4" />
        <circle cx="7" cy="9" r="2" fill="currentColor" opacity="0.3" />
        <path d="M2 16 L8 11 L12 14 L17 9 L22 14 L22 20 L2 20 Z" fill="currentColor" opacity="0.25" />
      </svg>
    )
  },
  // 콜라주 레이아웃
  {
    value: 'collage-1-2',
    label: '콜라주 1+2',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className}>
        <rect x="2" y="3" width="20" height="9" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="2" y="13" width="9.5" height="8" rx="1" fill="currentColor" opacity="0.3" />
        <rect x="12.5" y="13" width="9.5" height="8" rx="1" fill="currentColor" opacity="0.3" />
      </svg>
    )
  },
  {
    value: 'collage-2-1',
    label: '콜라주 2+1',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className}>
        <rect x="2" y="3" width="9.5" height="8" rx="1" fill="currentColor" opacity="0.3" />
        <rect x="12.5" y="3" width="9.5" height="8" rx="1" fill="currentColor" opacity="0.3" />
        <rect x="2" y="12" width="20" height="9" rx="1" fill="currentColor" opacity="0.4" />
      </svg>
    )
  },
  {
    value: 'collage-1-3',
    label: '콜라주 1+3',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className}>
        <rect x="2" y="3" width="20" height="9" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="2" y="13" width="6" height="8" rx="1" fill="currentColor" opacity="0.25" />
        <rect x="9" y="13" width="6" height="8" rx="1" fill="currentColor" opacity="0.3" />
        <rect x="16" y="13" width="6" height="8" rx="1" fill="currentColor" opacity="0.25" />
      </svg>
    )
  },
  {
    value: 'collage-2x2',
    label: '콜라주 2×2',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className}>
        <rect x="2" y="3" width="9.5" height="8.5" rx="1" fill="currentColor" opacity="0.35" />
        <rect x="12.5" y="3" width="9.5" height="8.5" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="2" y="12.5" width="9.5" height="8.5" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="12.5" y="12.5" width="9.5" height="8.5" rx="1" fill="currentColor" opacity="0.35" />
      </svg>
    )
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'templates'>('general');
  const toast = useToastContext();

  // General Settings State
  const [gasUrl, setGasUrlState] = useState('');
  const [sheetId, setSheetIdState] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  // Template State
  const [templates, setTemplates] = useState<Template[]>([]);
  const [defaultTemplateId, setDefaultTemplateIdState] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Template Editing State
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false); // 새 템플릿 생성 모드
  const [showCategoryPicker, setShowCategoryPicker] = useState(false); // 카테고리 선택 UI 표시
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sectionImageInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  // Auto Backup State
  const [autoBackupEnabled, setAutoBackupState] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);

  // Section navigation refs for scroll-to-section
  const sectionRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // 섹션으로 스크롤하는 함수
  const scrollToSection = (sectionIndex: number) => {
    const sectionEl = sectionRefs.current[sectionIndex];
    if (sectionEl) {
      sectionEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 잠시 후 하이라이트 효과
      sectionEl.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
      setTimeout(() => {
        sectionEl.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
      }, 2000);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // 기본값을 포함하지 않고 가져와서, 사용자가 실제로 입력한 값만 표시
      const savedUrl = getGasUrl(false);
      setGasUrlState(savedUrl || '');
      setSheetIdState(getSheetId());
      setTemplates(getTemplates());
      setDefaultTemplateIdState(getDefaultTemplateId());
      setSaveStatus('idle');
      setEditingTemplate(null); // Reset edit mode on open

      // 자동 백업 상태 초기화
      setAutoBackupState(isAutoBackupEnabled());
      setLastBackupDate(getLastBackupDate());

      // 디버깅: localStorage에 저장된 실제 값 확인
      console.log('[Settings] localStorage에서 GAS URL 확인:', localStorage.getItem('gemini_commerce_gas_url'));
      console.log('[Settings] getGasUrl(false) 결과:', savedUrl);
      console.log('[Settings] getGasUrl(true) 결과:', getGasUrl(true));
    }
  }, [isOpen]);

  const handleSaveGeneral = async () => {
    // 공백 제거 후 저장
    const cleanGasUrl = gasUrl.trim();
    const cleanSheetId = sheetId.trim();

    saveGasUrl(cleanGasUrl);

    // 항상 저장하도록 수정 (빈 값이라도 저장하여 사용자가 초기화할 수 있게 함)
    // 단, 서비스 로직상 빈 값이면 Default ID를 반환할 수 있음
    saveSheetId(cleanSheetId);

    setSaveStatus('saving');

    // 자동 백업이 활성화되어 있고, 유효한 GAS URL이 있으면 백업 실행
    if (autoBackupEnabled && cleanGasUrl && cleanGasUrl !== DEFAULT_GAS_URL) {
      const result = await backupSettingsToDrive();
      if (result.success) {
        setLastBackupDate(new Date().toISOString());
      }
    }

    setTimeout(() => {
      setSaveStatus('success');
      toast.success('설정이 저장되었습니다.');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    }, 500);
  };

  // 자동 백업 토글 핸들러
  const handleAutoBackupToggle = async (enabled: boolean) => {
    // GAS URL이 기본값이면 백업 불가
    if (enabled && (!gasUrl || gasUrl.trim() === '' || gasUrl === DEFAULT_GAS_URL)) {
      toast.warning('자동 백업을 사용하려면 먼저 개인 GAS URL을 설정해주세요.');
      return;
    }

    setAutoBackupState(enabled);
    setAutoBackupEnabled(enabled);

    if (enabled) {
      // 백업 활성화 시 즉시 백업 실행
      setIsBackingUp(true);
      const result = await backupSettingsToDrive();
      setIsBackingUp(false);

      if (result.success) {
        setLastBackupDate(new Date().toISOString());
        toast.success('자동 백업이 활성화되었습니다. 설정이 Google Drive에 저장되었습니다.');
      } else {
        toast.error('백업 실패: ' + result.message);
        setAutoBackupState(false);
        setAutoBackupEnabled(false);
      }
    } else {
      toast.info('자동 백업이 비활성화되었습니다.');
    }
  };

  // 수동 백업 핸들러
  const handleManualBackup = async () => {
    if (!gasUrl || gasUrl.trim() === '' || gasUrl === DEFAULT_GAS_URL) {
      toast.warning('백업을 사용하려면 먼저 개인 GAS URL을 설정해주세요.');
      return;
    }

    setIsBackingUp(true);
    const result = await backupSettingsToDrive();
    setIsBackingUp(false);

    if (result.success) {
      setLastBackupDate(new Date().toISOString());
      toast.success('설정이 Google Drive에 백업되었습니다.');
    } else {
      toast.error('백업 실패: ' + result.message);
    }
  };

  // 수동 복원 핸들러
  const handleManualRestore = async () => {
    if (!gasUrl || gasUrl.trim() === '' || gasUrl === DEFAULT_GAS_URL) {
      toast.warning('복원을 사용하려면 먼저 개인 GAS URL을 설정해주세요.');
      return;
    }

    if (!confirm('Google Drive에서 백업된 설정을 복원하시겠습니까?\n현재 설정이 백업 시점의 설정으로 교체됩니다.')) {
      return;
    }

    setIsRestoring(true);
    const result = await restoreSettingsFromDrive();
    setIsRestoring(false);

    if (result.success && result.settings) {
      applyRestoredSettings(result.settings);

      // UI 상태 업데이트
      if (result.settings.gasUrl) {
        setGasUrlState(result.settings.gasUrl);
      }
      if (result.settings.sheetId) {
        setSheetIdState(result.settings.sheetId);
      }
      setTemplates(getTemplates());

      const backupDateStr = result.settings.backupDate
        ? new Date(result.settings.backupDate).toLocaleString('ko-KR')
        : '알 수 없음';

      toast.success(`설정이 복원되었습니다! (백업 시점: ${backupDateStr})`);
    } else {
      toast.error('복원 실패: ' + result.message);
    }
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsAnalyzing(true);
      const base64 = await fileToGenerativePart(file);
      const mimeType = file.type;
      const newTemplate = await extractTemplateFromImage(base64, mimeType);

      saveTemplate(newTemplate);
      setTemplates(getTemplates());
      toast.success(`'${newTemplate.name}' 템플릿이 추가되었습니다!`);

    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : '템플릿 분석에 실패했습니다.';
      toast.error(errorMessage + ' 다시 시도해주세요.');
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteTemplate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('정말 이 템플릿을 삭제하시겠습니까?')) {
      deleteTemplate(id);
      setTemplates(getTemplates());
    }
  };

  // --- Template Editing Logic ---

  const startEditing = (template: Template) => {
    // Deep copy to avoid mutating state directly
    setEditingTemplate(JSON.parse(JSON.stringify(template)));
  };

  const saveEditing = () => {
    if (editingTemplate) {
      const updatedTemplate = {
        ...editingTemplate,
        updatedAt: Date.now()
      };
      saveTemplate(updatedTemplate);
      setTemplates(getTemplates());
      setEditingTemplate(null);
      setIsCreatingNew(false); // 초기화
    }
  };

  const cancelEditing = () => {
    if (isCreatingNew || confirm('수정 사항을 저장하지 않고 나가시겠습니까?')) {
      setEditingTemplate(null);
      setIsCreatingNew(false);
      setShowCategoryPicker(false);
    }
  };

  const updateEditField = (field: keyof Template, value: any) => {
    if (!editingTemplate) return;
    setEditingTemplate({ ...editingTemplate, [field]: value });
  };

  const updateSection = (index: number, field: keyof SectionData, value: string) => {
    if (!editingTemplate) return;
    const newSections = [...editingTemplate.sections];
    newSections[index] = { ...newSections[index], [field]: value };
    setEditingTemplate({ ...editingTemplate, sections: newSections });
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    if (!editingTemplate) return;
    const newSections = [...editingTemplate.sections];
    if (direction === 'up' && index > 0) {
      [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
    } else if (direction === 'down' && index < newSections.length - 1) {
      [newSections[index + 1], newSections[index]] = [newSections[index], newSections[index + 1]];
    }
    setEditingTemplate({ ...editingTemplate, sections: newSections });
  };

  const addSection = () => {
    if (!editingTemplate) return;
    const newSection: SectionData = {
      id: `sec-${Date.now()}`,
      title: '새 섹션',
      content: '섹션에 들어갈 내용 설명',
      imagePrompt: 'Clean product shot'
    };
    setEditingTemplate({
      ...editingTemplate,
      sections: [...editingTemplate.sections, newSection]
    });
  };

  const removeSection = (index: number) => {
    if (!editingTemplate) return;
    if (confirm('이 섹션을 삭제하시겠습니까?')) {
      const newSections = editingTemplate.sections.filter((_, i) => i !== index);
      setEditingTemplate({ ...editingTemplate, sections: newSections });
    }
  };

  // --- 고정 이미지 업로드 핸들러 ---
  const handleSectionImageUpload = async (sectionIndex: number, file: File) => {
    if (!editingTemplate) return;

    try {
      // 파일을 Base64로 변환
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1]; // data:image/...;base64, 부분 제거

        const newSections = [...editingTemplate.sections];
        newSections[sectionIndex] = {
          ...newSections[sectionIndex],
          fixedImageBase64: base64Data,
          fixedImageMimeType: file.type,
          useFixedImage: true
        };
        setEditingTemplate({ ...editingTemplate, sections: newSections });
        toast.success('고정 이미지가 추가되었습니다.');
      };
      reader.onerror = () => {
        toast.error('이미지 업로드에 실패했습니다.');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      toast.error('이미지 업로드 중 오류가 발생했습니다.');
    }
  };

  // 고정 이미지 삭제
  const removeFixedImage = (sectionIndex: number) => {
    if (!editingTemplate) return;

    const newSections = [...editingTemplate.sections];
    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      fixedImageBase64: undefined,
      fixedImageMimeType: undefined,
      useFixedImage: false
    };
    setEditingTemplate({ ...editingTemplate, sections: newSections });
    toast.info('고정 이미지가 삭제되었습니다.');
  };

  // 고정 이미지 사용 토글
  const toggleUseFixedImage = (sectionIndex: number) => {
    if (!editingTemplate) return;

    const section = editingTemplate.sections[sectionIndex];
    if (!section.fixedImageBase64) {
      toast.warning('먼저 고정 이미지를 업로드해주세요.');
      return;
    }

    const newSections = [...editingTemplate.sections];
    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      useFixedImage: !section.useFixedImage
    };
    setEditingTemplate({ ...editingTemplate, sections: newSections });
  };



  // 레이아웃 타입 변경
  const updateLayoutType = (sectionIndex: number, layoutType: LayoutType) => {
    if (!editingTemplate) return;

    const newSections = [...editingTemplate.sections];
    const currentSection = newSections[sectionIndex];

    // 레이아웃에 필요한 슬롯 수 계산
    const requiredSlots = getImageSlotCountForLayout(layoutType);
    let newImageSlots = [...(currentSection.imageSlots || [])];

    // 슬롯 수가 지정된 경우 (-1은 가변, 0은 없음)
    if (requiredSlots >= 0) {
      if (layoutType.startsWith('collage-')) {
        // 콜라주는 1개의 슬롯만 사용 (합성된 이미지) - 기존 프롬프트 보존 노력
        if (newImageSlots.length === 0) {
          newImageSlots = [{ id: Date.now().toString(), slotType: 'main', prompt: currentSection.imagePrompt || '' }];
        } else if (newImageSlots.length > 1) {
          newImageSlots = [newImageSlots[0]]; // 첫 번째 슬롯만 유지
        }
      } else if (requiredSlots === 0) {
        // 텍스트 전용 등: 슬롯 제거
        newImageSlots = [];
      } else {
        // 필요한 수만큼 맞춤
        if (newImageSlots.length < requiredSlots) {
          // 부족하면 추가
          while (newImageSlots.length < requiredSlots) {
            newImageSlots.push({
              id: Date.now().toString() + Math.random().toString().slice(2, 5),
              slotType: 'detail',
              prompt: ''
            });
          }
        } else if (newImageSlots.length > requiredSlots) {
          // 많으면 제거 (뒤에서부터)
          newImageSlots = newImageSlots.slice(0, requiredSlots);
        }
      }
    }

    newSections[sectionIndex] = {
      ...currentSection,
      layoutType,
      imageSlots: newImageSlots
    };
    setEditingTemplate({ ...editingTemplate, sections: newSections });
  };

  // 섹션 타입 변경
  const updateSectionType = (sectionIndex: number, sectionType: SectionType) => {
    if (!editingTemplate) return;

    const newSections = [...editingTemplate.sections];
    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      sectionType
    };
    setEditingTemplate({ ...editingTemplate, sections: newSections });
  };

  // --- 이미지 슬롯 관리 함수들 ---

  // 이미지 슬롯 추가
  const addImageSlot = (sectionIndex: number) => {
    if (!editingTemplate) return;

    const newSlot: ImageSlot = {
      id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      slotType: 'product',
      prompt: ''
    };

    const newSections = [...editingTemplate.sections];
    const currentSlots = newSections[sectionIndex].imageSlots || [];
    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      imageSlots: [...currentSlots, newSlot]
    };
    setEditingTemplate({ ...editingTemplate, sections: newSections });
  };

  // 이미지 슬롯 삭제
  const removeImageSlot = (sectionIndex: number, slotIndex: number) => {
    if (!editingTemplate) return;

    const newSections = [...editingTemplate.sections];
    const currentSlots = newSections[sectionIndex].imageSlots || [];
    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      imageSlots: currentSlots.filter((_, i) => i !== slotIndex)
    };

    // 하위 호환성: 첫 번째 슬롯 프롬프트를 imagePrompt에 동기화
    if (newSections[sectionIndex].imageSlots?.[0]) {
      newSections[sectionIndex].imagePrompt = newSections[sectionIndex].imageSlots[0].prompt;
    }

    setEditingTemplate({ ...editingTemplate, sections: newSections });
  };

  // 이미지 슬롯 업데이트
  const updateImageSlot = (
    sectionIndex: number,
    slotIndex: number,
    field: keyof ImageSlot,
    value: any
  ) => {
    if (!editingTemplate) return;

    const newSections = [...editingTemplate.sections];
    const currentSlots = [...(newSections[sectionIndex].imageSlots || [])];
    currentSlots[slotIndex] = {
      ...currentSlots[slotIndex],
      [field]: value
    };
    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      imageSlots: currentSlots
    };

    // 하위 호환성: 첫 번째 슬롯 프롬프트를 imagePrompt에 동기화
    if (slotIndex === 0 && field === 'prompt') {
      newSections[sectionIndex].imagePrompt = value;
    }

    setEditingTemplate({ ...editingTemplate, sections: newSections });
  };

  // 섹션 확장/축소 상태 관리
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});

  const toggleSectionExpand = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // --- Helper: Wireframe Preview ---
  const TemplateWireframe = ({ sections }: { sections: SectionData[] }) => {
    const previewSections = sections.slice(0, 4);
    return (
      <div className="w-full h-32 bg-slate-50 border-b border-gray-100 flex flex-col p-3 gap-2 overflow-hidden relative select-none">
        {/* Fake Header */}
        <div className="w-3/4 h-2 bg-slate-200 rounded-sm mx-auto mb-1"></div>

        {/* Sections */}
        {previewSections.map((_, i) => (
          <div key={i} className="flex gap-2 h-8 w-full">
            {/* Alternating Layouts for visual variety */}
            {i % 2 === 0 ? (
              <>
                <div className="w-1/3 h-full bg-blue-100/50 border border-blue-100 rounded-sm flex items-center justify-center">
                  <ImageIcon className="w-3 h-3 text-blue-300" />
                </div>
                <div className="flex-1 h-full bg-white border border-gray-100 rounded-sm p-1 space-y-1">
                  <div className="w-1/2 h-1 bg-gray-100 rounded-full"></div>
                  <div className="w-full h-1 bg-gray-50 rounded-full"></div>
                  <div className="w-3/4 h-1 bg-gray-50 rounded-full"></div>
                </div>
              </>
            ) : (
              <>
                <div className="flex-1 h-full bg-white border border-gray-100 rounded-sm p-1 space-y-1">
                  <div className="w-1/2 h-1 bg-gray-100 rounded-full mx-auto"></div>
                  <div className="w-full h-1 bg-gray-50 rounded-full"></div>
                </div>
                <div className="w-1/3 h-full bg-blue-100/50 border border-blue-100 rounded-sm flex items-center justify-center">
                  <ImageIcon className="w-3 h-3 text-blue-300" />
                </div>
              </>
            )}
          </div>
        ))}

        {/* Fade Overlay */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent pointer-events-none" />
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden transition-all">

        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            {editingTemplate ? <Edit2 className="w-5 h-5 mr-2 text-blue-600" /> : <Layout className="w-5 h-5 mr-2 text-gray-700" />}
            {editingTemplate ? '템플릿 디자인 수정' : '설정 및 템플릿'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors p-1 rounded-full hover:bg-gray-100"
            disabled={isAnalyzing}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs (Only visible when not editing) */}
        {!editingTemplate && (
          <div className="flex border-b bg-gray-50/50">
            <button
              onClick={() => !isAnalyzing && setActiveTab('general')}
              disabled={isAnalyzing}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'general' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                } ${isAnalyzing ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <Table className="w-4 h-4" /> 구글 시트 연동
            </button>
            <button
              onClick={() => !isAnalyzing && setActiveTab('templates')}
              disabled={isAnalyzing}
              className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'templates' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                } ${isAnalyzing ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <LayoutTemplate className="w-4 h-4" /> 템플릿 관리
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 relative custom-scrollbar">

          {/* TAB: General */}
          {!editingTemplate && activeTab === 'general' && (
            <div className="space-y-6 max-w-2xl mx-auto">

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800 flex items-start leading-relaxed">
                  <Info className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5 text-blue-600" />
                  <span>
                    <strong>안전한 데이터 저장:</strong> 입력하신 API 정보는 서버가 아닌 고객님의 <strong>브라우저(로컬 스토리지)</strong>에만 안전하게 저장됩니다.
                  </span>
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Google Apps Script (GAS) Web App URL
                  </label>
                  <input
                    type="text"
                    name="gasUrl"
                    autoComplete="off"
                    value={gasUrl}
                    onChange={(e) => setGasUrlState(e.target.value)}
                    placeholder="https://script.google.com/macros/s/..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-shadow"
                  />
                  <p className="text-xs text-gray-500 mt-1">배포된 Apps Script의 웹 앱 URL을 입력하세요.</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Google Sheet ID
                  </label>
                  <input
                    type="text"
                    name="sheetId"
                    autoComplete="off"
                    value={sheetId}
                    onChange={(e) => setSheetIdState(e.target.value)}
                    placeholder="구글 시트 ID를 입력하세요"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-shadow"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    구글 시트 주소 중 <code>/d/</code>와 <code>/edit</code> 사이의 문자열입니다.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSaveGeneral}
                    disabled={saveStatus === 'saving' || saveStatus === 'success'}
                    className={`w-full py-3 rounded-lg font-bold transition-all flex justify-center items-center shadow-md ${saveStatus === 'success'
                      ? 'bg-green-600 hover:bg-green-700 text-white scale-[1.02]'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                      }`}
                  >
                    {saveStatus === 'saving' && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                    {saveStatus === 'success' && <Check className="w-5 h-5 mr-2" />}
                    {saveStatus === 'idle' && <Save className="w-5 h-5 mr-2" />}

                    {saveStatus === 'saving' && '연동 정보 저장 중...'}
                    {saveStatus === 'success' && '저장되었습니다!'}
                    {saveStatus === 'idle' && '설정 저장하기'}
                  </button>
                </div>
              </div>

              {/* 자동 백업 섹션 */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center">
                  <Cloud className="w-5 h-5 mr-2 text-blue-600" />
                  설정 자동 백업
                </h3>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <p className="text-sm text-blue-800 flex items-start leading-relaxed">
                    <Info className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5 text-blue-600" />
                    <span>
                      <strong>자동 백업:</strong> 설정과 템플릿을 Google Drive에 자동으로 백업합니다.
                      다른 기기나 브라우저에서도 같은 설정을 사용할 수 있습니다.
                    </span>
                  </p>
                </div>

                {/* 자동 백업 토글 */}
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <div className="flex items-center">
                    {autoBackupEnabled ? (
                      <Cloud className="w-5 h-5 text-green-600 mr-3" />
                    ) : (
                      <CloudOff className="w-5 h-5 text-gray-400 mr-3" />
                    )}
                    <div>
                      <span className="font-semibold text-gray-800">자동 백업 활성화</span>
                      {lastBackupDate && autoBackupEnabled && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          마지막 백업: {new Date(lastBackupDate).toLocaleString('ko-KR')}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleAutoBackupToggle(!autoBackupEnabled)}
                    disabled={isBackingUp}
                    className={`flex items-center transition-colors ${autoBackupEnabled ? 'text-green-600' : 'text-gray-400'
                      } ${isBackingUp ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isBackingUp ? (
                      <Loader2 className="w-8 h-8 animate-spin" />
                    ) : autoBackupEnabled ? (
                      <ToggleRight className="w-10 h-10" />
                    ) : (
                      <ToggleLeft className="w-10 h-10" />
                    )}
                  </button>
                </div>

                {/* 수동 백업/복원 버튼 */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={handleManualBackup}
                    disabled={isBackingUp || isRestoring || !gasUrl || gasUrl === DEFAULT_GAS_URL}
                    className="py-2.5 px-4 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isBackingUp ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Cloud className="w-4 h-4 mr-2" />
                    )}
                    지금 백업
                  </button>
                  <button
                    onClick={handleManualRestore}
                    disabled={isBackingUp || isRestoring || !gasUrl || gasUrl === DEFAULT_GAS_URL}
                    className="py-2.5 px-4 border border-gray-200 bg-gray-50 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRestoring ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    백업 복원
                  </button>
                </div>

                {(!gasUrl || gasUrl === DEFAULT_GAS_URL) && (
                  <p className="text-xs text-amber-600 flex items-center mt-2">
                    <Info className="w-3 h-3 mr-1" />
                    백업 기능을 사용하려면 먼저 개인 GAS URL을 설정하세요.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB: Templates - GRID VIEW */}
          {!editingTemplate && activeTab === 'templates' && (
            <div className="relative min-h-[400px]">
              {isAnalyzing && (
                <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl animate-in fade-in duration-300">
                  <div className="bg-white p-8 rounded-2xl shadow-2xl border border-blue-100 flex flex-col items-center max-w-sm text-center">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">이미지 분석 중...</h3>
                    <p className="text-sm text-gray-600 animate-pulse">
                      AI가 이미지의 레이아웃 구조와 디자인 요소를 추출하여 템플릿을 생성하고 있습니다.
                    </p>
                  </div>
                </div>
              )}

              <div className="mb-6 flex justify-between items-end">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">나만의 템플릿</h3>
                  <p className="text-sm text-gray-500">이미지에서 추출한 레이아웃을 관리하세요.</p>
                </div>
                <div className="text-xs text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-200">
                  총 {templates.length}개
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">

                {/* 1. 새 템플릿 추가 - 두 가지 옵션 */}
                <div className={`flex flex-col min-h-[280px] border-2 border-dashed border-gray-300 rounded-xl transition-all bg-white/50 overflow-hidden ${isAnalyzing ? 'opacity-50' : ''}`}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleTemplateUpload}
                    disabled={isAnalyzing}
                  />

                  {/* 카테고리 선택 모드 */}
                  {showCategoryPicker ? (
                    <div className="flex-1 flex flex-col p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-gray-700">카테고리 선택</span>
                        <button
                          onClick={() => setShowCategoryPicker(false)}
                          className="text-gray-400 hover:text-gray-600 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 flex-1 overflow-y-auto">
                        {CATEGORY_OPTIONS.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => {
                              const newTemplate = createNewTemplateService('새 템플릿', cat.id);
                              setEditingTemplate(newTemplate);
                              setIsCreatingNew(true);
                              setShowCategoryPicker(false);
                            }}
                            className="flex items-center gap-2 p-2 text-left text-sm rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                          >
                            <span className="text-lg">{cat.emoji}</span>
                            <span className="text-gray-700 font-medium truncate">{cat.name}</span>
                          </button>
                        ))}
                        {/* 직접 구성(빈 템플릿) */}
                        <button
                          onClick={() => {
                            const newTemplate = createNewTemplateService('새 템플릿');
                            setEditingTemplate(newTemplate);
                            setIsCreatingNew(true);
                            setShowCategoryPicker(false);
                          }}
                          className="flex items-center gap-2 p-2 text-left text-sm rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                          <span className="text-lg">✏️</span>
                          <span className="text-gray-700 font-medium">직접 구성</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* 기본 모드: 두 옵션 표시 */}
                      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                        <div className="p-3 bg-gray-100 rounded-full mb-3">
                          <Plus className="w-6 h-6 text-gray-400" />
                        </div>
                        <span className="text-gray-900 font-bold mb-1">새 템플릿 추가</span>
                        <span className="text-xs text-gray-500 mb-4">원하는 방법을 선택하세요</span>
                      </div>

                      <div className="border-t border-gray-200 grid grid-cols-2 divide-x divide-gray-200">
                        {/* 옵션 1: 참조 이미지로 생성 */}
                        <button
                          onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                          disabled={isAnalyzing}
                          className="p-3 flex flex-col items-center gap-1 hover:bg-blue-50 transition-colors group disabled:cursor-not-allowed"
                        >
                          <ImageIcon className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-medium text-gray-700">이미지로 생성</span>
                          <span className="text-[10px] text-gray-400">AI 분석</span>
                        </button>

                        {/* 옵션 2: 직접 처음부터 생성 */}
                        <button
                          onClick={() => setShowCategoryPicker(true)}
                          disabled={isAnalyzing}
                          className="p-3 flex flex-col items-center gap-1 hover:bg-green-50 transition-colors group disabled:cursor-not-allowed"
                        >
                          <Layers className="w-5 h-5 text-green-500 group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-medium text-gray-700">직접 생성</span>
                          <span className="text-[10px] text-gray-400">수동 구성</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* 2. Template Cards */}
                {templates.map(tpl => (
                  <div
                    key={tpl.id}
                    onClick={() => startEditing(tpl)}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden group cursor-pointer flex flex-col"
                  >
                    {/* Preview Area */}
                    <TemplatePreview template={tpl} size="sm" showInfo={false} />

                    {/* Info Area */}
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-gray-800 line-clamp-1 group-hover:text-blue-600 transition-colors">{tpl.name}</h4>
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                          {tpl.sections.length} 섹션
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-4 flex-1">
                        {tpl.description || "설명이 없습니다."}
                      </p>

                      <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                        <span className="text-[10px] text-gray-400 flex items-center">
                          {new Date(tpl.createdAt).toLocaleDateString()}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDefaultTemplateId(tpl.id);
                              setDefaultTemplateIdState(tpl.id);
                              toast.success('기본 템플릿으로 설정되었습니다.');
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${defaultTemplateId === tpl.id ? 'text-yellow-500 bg-yellow-50' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'}`}
                            title="기본 템플릿 설정"
                          >
                            <Star className="w-4 h-4" fill={defaultTemplateId === tpl.id ? 'currentColor' : 'none'} />
                          </button>
                          <button
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteTemplate(e, tpl.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: Templates - EDIT VIEW */}
          {editingTemplate && (
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Top: Info */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">템플릿 이름</label>
                  <input
                    type="text"
                    value={editingTemplate.name}
                    onChange={(e) => updateEditField('name', e.target.value)}
                    className="w-full text-xl font-bold border-b-2 border-gray-200 focus:border-blue-600 outline-none py-2 bg-transparent transition-colors"
                    placeholder="템플릿 이름 입력"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">설명 (선택)</label>
                  <input
                    type="text"
                    value={editingTemplate.description || ''}
                    onChange={(e) => updateEditField('description', e.target.value)}
                    className="w-full text-sm text-gray-700 border-b border-gray-200 focus:border-blue-500 outline-none py-2 bg-transparent transition-colors"
                    placeholder="이 템플릿에 대한 간단한 설명"
                  />
                </div>
              </div>

              {/* 레이아웃 미리보기 패널 */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-white/60 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-gray-700 flex items-center gap-2 text-sm">
                    <Layout className="w-4 h-4 text-blue-500" />
                    레이아웃 미리보기
                  </h3>
                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full border">
                    {editingTemplate.sections.length}개 섹션 • {
                      editingTemplate.sections.reduce((acc, s) =>
                        acc + (s.imageSlots?.length || (s.imagePrompt ? 1 : 0)), 0
                      )
                    }개 이미지 슬롯
                  </span>
                </div>
                <div className="p-4">
                  <TemplatePreview
                    template={editingTemplate}
                    size="lg"
                    showInfo={false}
                    className="border border-slate-200 shadow-inner"
                    interactive={true}
                    onSectionClick={scrollToSection}
                    onMoveSection={moveSection}
                    onRemoveSection={removeSection}
                  />
                  <p className="text-xs text-gray-400 text-center mt-2">
                    💡 섹션을 클릭하면 해당 편집 영역으로 이동합니다
                  </p>
                </div>
              </div>

              {/* Middle: Sections */}
              <div className="space-y-4 pb-32">
                <div className="flex justify-between items-center px-1">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Layout className="w-4 h-4 text-gray-500" />
                    섹션 구성
                    <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">{editingTemplate.sections.length}</span>
                  </h3>

                </div>

                {editingTemplate.sections.map((section, idx) => (
                  <div
                    key={section.id}
                    ref={(el) => { sectionRefs.current[idx] = el; }}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                        SECTION {idx + 1}
                      </span>
                      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => moveSection(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 hover:bg-white rounded border border-transparent hover:border-gray-200 shadow-sm disabled:opacity-30 disabled:shadow-none"
                          title="위로 이동"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveSection(idx, 'down')}
                          disabled={idx === editingTemplate.sections.length - 1}
                          className="p-1 hover:bg-white rounded border border-transparent hover:border-gray-200 shadow-sm disabled:opacity-30 disabled:shadow-none"
                          title="아래로 이동"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <div className="w-px h-3 bg-gray-300 mx-2"></div>
                        <button
                          onClick={() => removeSection(idx)}
                          className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors"
                          title="섹션 삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      {/* 기본 정보 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1.5">섹션 제목 (예시)</label>
                          <input
                            type="text"
                            value={section.title}
                            onChange={(e) => updateSection(idx, 'title', e.target.value)}
                            className="w-full text-sm font-medium border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-1.5">내용 설명 (AI 가이드)</label>
                          <div className="relative">
                            <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={section.content}
                              onChange={(e) => updateSection(idx, 'content', e.target.value)}
                              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 pl-9 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 섹션 타입 + 레이아웃 선택 */}
                      <div className="space-y-4 bg-slate-50 rounded-lg p-4">
                        {/* 섹션 타입 */}
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-2 flex items-center">
                            <Layers className="w-3 h-3 mr-1" />
                            섹션 타입
                          </label>
                          <select
                            value={section.sectionType || 'custom'}
                            onChange={(e) => updateSectionType(idx, e.target.value as SectionType)}
                            className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                          >
                            {SECTION_TYPE_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* 레이아웃 타입 - 아이콘 버튼 */}
                        <div>
                          <label className="text-xs font-semibold text-gray-500 block mb-2 flex items-center">
                            <Layout className="w-3 h-3 mr-1" />
                            레이아웃 타입
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {LAYOUT_OPTIONS.map(opt => {
                              const Icon = opt.icon;
                              const isSelected = (section.layoutType || 'full-width') === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => updateLayoutType(idx, opt.value)}
                                  className={`
                                    w-14 h-14 p-1.5 rounded-lg border-2 flex flex-col items-center justify-center
                                    transition-all hover:scale-105
                                    ${isSelected
                                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}
                                  `}
                                  title={opt.label}
                                >
                                  <Icon className="w-6 h-6" />
                                  <span className="text-[8px] mt-0.5 font-medium truncate w-full text-center">{opt.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* 고정 문구 입력 */}
                      <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-4">
                        <label className="text-xs font-bold text-amber-700 block mb-1.5 flex items-center">
                          <Type className="w-3 h-3 mr-1" />
                          고정 문구 (선택사항)
                        </label>
                        <p className="text-xs text-amber-600 mb-2">상세페이지에 항상 포함될 문구를 입력하세요.</p>
                        <textarea
                          rows={2}
                          value={section.fixedText || ''}
                          onChange={(e) => updateSection(idx, 'fixedText', e.target.value)}
                          placeholder="예: '100% 국내산 원료 사용', 'KC 인증 완료', '무료 배송' 등"
                          className="w-full text-sm border border-amber-200 bg-white rounded-lg p-2.5 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none resize-none"
                        />
                      </div>

                      {/* 고정 이미지 업로드 */}
                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-4">
                        <label className="text-xs font-bold text-emerald-700 block mb-1.5 flex items-center">
                          <ImageIcon className="w-3 h-3 mr-1" />
                          고정 이미지 (선택사항)
                        </label>
                        <p className="text-xs text-emerald-600 mb-3">배송/반품 정보, 스펙표 등 항상 표시될 이미지를 업로드하세요.</p>

                        {/* 숨겨진 파일 입력 */}
                        <input
                          type="file"
                          ref={(el) => { sectionImageInputRefs.current[idx] = el; }}
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleSectionImageUpload(idx, file);
                            e.target.value = '';
                          }}
                        />

                        {section.fixedImageBase64 ? (
                          /* 이미지가 있을 때: 미리보기 + 토글 + 삭제 */
                          <div className="space-y-3">
                            {/* 이미지 미리보기 */}
                            <div className="relative group">
                              <img
                                src={`data:${section.fixedImageMimeType || 'image/png'};base64,${section.fixedImageBase64}`}
                                alt="고정 이미지 미리보기"
                                className="w-full max-h-48 object-contain rounded-lg border border-emerald-200 bg-white"
                              />
                              {/* 오버레이 버튼 */}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                                <button
                                  onClick={() => sectionImageInputRefs.current[idx]?.click()}
                                  className="px-3 py-1.5 bg-white text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors"
                                >
                                  변경
                                </button>
                                <button
                                  onClick={() => removeFixedImage(idx)}
                                  className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors"
                                >
                                  삭제
                                </button>
                              </div>
                            </div>

                            {/* 사용 토글 */}
                            <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-emerald-200">
                              <div className="flex items-center">
                                <Check className={`w-4 h-4 mr-2 ${section.useFixedImage ? 'text-emerald-600' : 'text-gray-300'}`} />
                                <span className="text-sm font-medium text-gray-700">고정 이미지 사용</span>
                              </div>
                              <button
                                onClick={() => toggleUseFixedImage(idx)}
                                className={`flex items-center transition-colors ${section.useFixedImage ? 'text-emerald-600' : 'text-gray-400'}`}
                              >
                                {section.useFixedImage ? (
                                  <ToggleRight className="w-8 h-8" />
                                ) : (
                                  <ToggleLeft className="w-8 h-8" />
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* 이미지가 없을 때: 업로드 영역 */
                          <div
                            onClick={() => sectionImageInputRefs.current[idx]?.click()}
                            className="border-2 border-dashed border-emerald-200 rounded-lg p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
                          >
                            <Upload className="w-8 h-8 mx-auto mb-2 text-emerald-300 group-hover:text-emerald-500 transition-colors" />
                            <p className="text-sm font-medium text-emerald-600">클릭하여 이미지 업로드</p>
                            <p className="text-xs text-emerald-400 mt-1">PNG, JPG, WEBP 지원</p>
                          </div>
                        )}
                      </div>

                      {/* 업로드 전용 섹션 토글 */}
                      <div className={`rounded-lg p-3 border ${section.isUploadOnly ? 'bg-sky-50 border-sky-300' : 'bg-gray-50 border-gray-200'} transition-colors`}>
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => {
                            const newSections = [...editingTemplate!.sections];
                            newSections[idx] = { ...newSections[idx], isUploadOnly: !section.isUploadOnly };
                            setEditingTemplate({ ...editingTemplate!, sections: newSections });
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Upload className="w-4 h-4 text-sky-600" />
                            <div>
                              <span className="text-xs font-bold text-gray-700">업로드 전용 섹션</span>
                              <p className="text-[10px] text-gray-400 mt-0.5">AI 이미지 생성 없이 사용자가 직접 이미지를 업로드</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {section.isUploadOnly ? (
                              <ToggleRight className="w-8 h-8 text-sky-500" />
                            ) : (
                              <ToggleLeft className="w-8 h-8 text-gray-300" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 업로드 전용일 때 안내 메시지, 아닐 때 이미지 슬롯 에디터 */}
                      {section.isUploadOnly ? (
                        <div className="bg-sky-50 border border-dashed border-sky-300 rounded-lg p-6 text-center">
                          <Upload className="w-10 h-10 mx-auto mb-2 text-sky-400" />
                          <p className="text-sm font-medium text-sky-700">이 섹션은 사용자 직접 업로드 전용입니다</p>
                          <p className="text-xs text-sky-500 mt-1">AI 이미지 생성/프롬프트 없이, 사용자가 이미지를 직접 등록합니다.</p>
                        </div>
                      ) : (
                        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-xs font-bold text-blue-700 flex items-center">
                              <ImageIcon className="w-3 h-3 mr-1" />
                              이미지 슬롯 ({(section.imageSlots || []).length})
                            </label>
                            <button
                              onClick={() => addImageSlot(idx)}
                              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors"
                            >
                              <Plus className="w-3 h-3" /> 슬롯 추가
                            </button>
                          </div>

                          {(section.imageSlots && section.imageSlots.length > 0) ? (
                            <div className="space-y-3">
                              {section.imageSlots.map((slot, slotIdx) => (
                                <div key={slot.id} className="bg-white rounded-lg border border-blue-200 p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-gray-500">슬롯 #{slotIdx + 1}</span>
                                    <button
                                      onClick={() => removeImageSlot(idx, slotIdx)}
                                      className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                                      title="슬롯 삭제"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>

                                  {/* 슬롯 타입 선택 */}
                                  <div className="mb-2">
                                    <select
                                      value={slot.slotType}
                                      onChange={(e) => updateImageSlot(idx, slotIdx, 'slotType', e.target.value)}
                                      className="w-full text-xs border border-gray-200 rounded p-2 bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                    >
                                      {IMAGE_SLOT_TYPE_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* 이미지 프롬프트 */}
                                  <textarea
                                    rows={2}
                                    value={slot.prompt}
                                    onChange={(e) => updateImageSlot(idx, slotIdx, 'prompt', e.target.value)}
                                    placeholder="예: Full body shot of model wearing [PRODUCT] with natural lighting..."
                                    className="w-full text-xs border border-gray-200 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-400 text-xs">
                              <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                              <p>이미지 슬롯이 없습니다</p>
                              <p className="text-[10px] mt-1">"슬롯 추가" 버튼을 클릭하여 추가하세요</p>
                            </div>
                          )}

                          {/* 하위 호환: 기존 imagePrompt가 있으면 표시 */}
                          {section.imagePrompt && (!section.imageSlots || section.imageSlots.length === 0) && (
                            <div className="mt-3 p-2 bg-amber-50 rounded border border-amber-200">
                              <p className="text-xs text-amber-600 mb-1">📝 기존 프롬프트 (슬롯으로 마이그레이션 필요)</p>
                              <p className="text-xs text-gray-600">{section.imagePrompt}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom: Action Buttons - Sticky */}
              <div className="sticky bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-4 flex justify-between items-center z-20 mt-6 shadow-lg">
                <button
                  onClick={cancelEditing}
                  className="px-5 py-2.5 text-gray-600 hover:text-gray-900 font-medium flex items-center hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> 취소
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={addSection}
                    className="px-5 py-2.5 bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg font-bold shadow-sm hover:shadow transition-all flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1" /> 섹션 추가
                  </button>
                  <button
                    onClick={saveEditing}
                    className="px-8 py-2.5 bg-gray-900 hover:bg-black text-white rounded-lg font-bold shadow-lg hover:shadow-xl transition-all flex items-center transform hover:-translate-y-0.5"
                  >
                    <Save className="w-4 h-4 mr-2" /> 변경사항 저장
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};