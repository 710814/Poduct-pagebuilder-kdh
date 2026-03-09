import React, { useRef, useState, useEffect } from 'react';
import {
  Upload, Link as LinkIcon, Image as ImageIcon, LayoutTemplate,
  Loader2, AlertCircle, ArrowRight, X, Layers, Plus, Palette, Tag,
  DollarSign, Percent, Trash2, User, ChevronDown, Check
} from 'lucide-react';
import { AppMode, UploadedFile, Template, ColorOption, ProductInputData, ModelSettings } from '../types';
import { getTemplates, getDefaultTemplateId } from '../services/templateService';
import { optimizeImages, needsOptimization, optimizeImage } from '../utils/imageOptimizer';
import { extractColorFromImages } from '../utils/colorExtractor';
import { useToastContext } from '../contexts/ToastContext';

interface Props {
  mode: AppMode;
  onProductSubmit: (data: ProductInputData) => void;
}

// 기본 색상 프리셋 (가나다 순)
const COLOR_PRESETS = [
  { name: 'Beige', hex: '#F5F5DC', textColor: '#000000' },
  { name: 'Black', hex: '#000000', textColor: '#FFFFFF' },
  { name: 'Blue', hex: '#4169E1', textColor: '#FFFFFF' },
  { name: 'Brown', hex: '#8B4513', textColor: '#FFFFFF' },
  { name: 'Gray', hex: '#808080', textColor: '#FFFFFF' },
  { name: 'Green', hex: '#008000', textColor: '#FFFFFF' },
  { name: 'Khaki', hex: '#8B8B00', textColor: '#FFFFFF' },
  { name: 'Navy', hex: '#000080', textColor: '#FFFFFF' },
  { name: 'Pink', hex: '#FFC0CB', textColor: '#000000' },
  { name: 'Red', hex: '#FF0000', textColor: '#FFFFFF' },
  { name: 'White', hex: '#FFFFFF', textColor: '#000000', border: '#DDDDDD' },
  { name: 'Wine', hex: '#722F37', textColor: '#FFFFFF' },
].sort((a, b) => a.name.localeCompare(b.name));

export const StepUpload: React.FC<Props> = ({ mode, onProductSubmit }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorImageInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(getDefaultTemplateId());
  const toast = useToastContext();

  // Upload Method State
  const [activeMethod, setActiveMethod] = useState<'upload' | 'url' | 'drive'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Main Images (컬러 구분 없는 기본 이미지)
  const [mainImages, setMainImages] = useState<UploadedFile[]>([]);

  // Product Info State
  const [productName, setProductName] = useState('');
  const [price, setPrice] = useState('');
  const [discountRate, setDiscountRate] = useState('');
  const [productFeatures, setProductFeatures] = useState('');

  // Color Options State
  const [colorOptions, setColorOptions] = useState<ColorOption[]>([]);
  const [newColorName, setNewColorName] = useState('');
  const [isCustomColorMode, setIsCustomColorMode] = useState(false);  // 직접 입력 모드
  const [activeColorId, setActiveColorId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Model Settings State (선택 사항)
  const [modelEthnicity, setModelEthnicity] = useState<ModelSettings['ethnicity']>('any');
  const [modelAgeRange, setModelAgeRange] = useState<ModelSettings['ageRange']>('any');
  const [modelGender, setModelGender] = useState<ModelSettings['gender']>('any');
  const [modelHairStyle, setModelHairStyle] = useState('');
  const [modelMood, setModelMood] = useState<ModelSettings['mood']>(undefined);
  const [modelCutStyle, setModelCutStyle] = useState<ModelSettings['modelCutStyle']>('face_anonymous');

  useEffect(() => {
    setTemplates(getTemplates());
  }, []);

  // --- Helper Methods ---
  const convertBlobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        if (res) resolve(res.split(',')[1]);
        else reject(new Error("Failed to convert blob"));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const createUploadedFile = async (blob: Blob, fileName?: string): Promise<UploadedFile> => {
    const base64 = await convertBlobToBase64(blob);
    const file = new File([blob], fileName || 'image.jpg', { type: blob.type });
    return {
      file,
      previewUrl: URL.createObjectURL(blob),
      base64,
      mimeType: blob.type
    };
  };

  // --- Image Processing ---
  const processFiles = async (files: File[], targetColorId?: string) => {
    setIsLoading(true);
    setErrorMsg('');

    try {
      const needsOpt = files.some(f => needsOptimization(f));
      if (needsOpt) toast.info('이미지 최적화 중...', 2000);

      let optimizedFiles: File[];
      try {
        optimizedFiles = await optimizeImages(files);
      } catch {
        optimizedFiles = files;
      }

      const newUploadedFiles = await Promise.all(optimizedFiles.map(async (file) => {
        return new Promise<UploadedFile>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              const base64 = (e.target.result as string).split(',')[1];
              resolve({
                file,
                previewUrl: e.target.result as string,
                base64,
                mimeType: file.type
              });
            } else reject(new Error('파일 읽기 실패'));
          };
          reader.onerror = () => reject(new Error('파일 읽기 오류'));
          reader.readAsDataURL(file);
        });
      }));

      if (targetColorId) {
        // 특정 컬러 옵션에 이미지 추가 + 색상 자동 추출
        try {
          const extractedColor = await extractColorFromImages(optimizedFiles);

          setColorOptions(prev => prev.map(opt => {
            if (opt.id === targetColorId) {
              return {
                ...opt,
                // hexCode가 없으면 자동 추출된 값으로 설정
                hexCode: opt.hexCode || extractedColor.hexCode,
                images: [...opt.images, ...newUploadedFiles],
                autoExtractedHex: extractedColor.hexCode,
                extractionConfidence: extractedColor.confidence
              };
            }
            return opt;
          }));

          // 신뢰도가 낮으면 사용자에게 알림
          if (extractedColor.confidence < 0.5) {
            toast.warning(
              `이미지 색상 추출 완료 (${extractedColor.hexCode})\n신뢰도가 낮습니다. 수동으로 조정해주세요.`,
              5000
            );
          } else {
            toast.success(
              `${newUploadedFiles.length}개 이미지 추가 완료 (색상: ${extractedColor.hexCode})`,
              3000
            );
          }
        } catch (colorError) {
          // 색상 추출 실패 시에도 이미지는 추가
          console.error('[StepUpload] 색상 추출 실패:', colorError);
          setColorOptions(prev => prev.map(opt =>
            opt.id === targetColorId
              ? { ...opt, images: [...opt.images, ...newUploadedFiles] }
              : opt
          ));
          toast.success(`${newUploadedFiles.length}개 이미지가 추가되었습니다.`);
        }
      } else {
        // 메인 이미지에 추가
        setMainImages(prev => [...prev, ...newUploadedFiles]);
        toast.success(`${newUploadedFiles.length}개 파일이 추가되었습니다.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "파일 처리 중 오류";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // URL/Drive 이미지 처리
  const processUrl = async (url: string, source: 'url' | 'drive') => {
    if (!url.trim()) return;
    setIsLoading(true);
    setErrorMsg('');

    try {
      let targetUrl = url;

      if (source === 'drive') {
        const match = url.match(/\/d\/([-\w]{25,})/) || url.match(/id=([-\w]{25,})/) || url.match(/^([-\w]{25,})$/);
        if (!match) throw new Error("유효한 구글 드라이브 파일 ID를 찾을 수 없습니다.");
        targetUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
      }

      const fetchWithTimeout = async (u: string) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 15000);
        try {
          const res = await fetch(u, { signal: controller.signal });
          clearTimeout(id);
          if (!res.ok) throw new Error(`Status ${res.status}`);
          return await res.blob();
        } catch (e) {
          clearTimeout(id);
          throw e;
        }
      };

      let blob: Blob | null = null;

      // Try different proxies
      const proxies = source === 'drive'
        ? [`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`, `https://images.weserv.nl/?url=${encodeURIComponent(targetUrl)}&output=jpg`]
        : [`https://images.weserv.nl/?url=${encodeURIComponent(targetUrl)}&w=2000`, `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`, targetUrl];

      for (const proxyUrl of proxies) {
        if (blob) break;
        try {
          const b = await fetchWithTimeout(proxyUrl);
          if (b.type.startsWith('image/')) blob = b;
        } catch { }
      }

      if (!blob) throw new Error(source === 'drive' ? "구글 드라이브 이미지를 가져올 수 없습니다." : "이미지를 불러올 수 없습니다.");

      // 최적화
      let optimizedBlob = blob;
      try {
        const tempFile = new File([blob], 'temp.jpg', { type: blob.type });
        if (needsOptimization(tempFile)) {
          const optimizedFile = await optimizeImage(tempFile);
          optimizedBlob = await optimizedFile.arrayBuffer().then(buf => new Blob([buf], { type: blob!.type }));
        }
      } catch { }

      const uploadedData = await createUploadedFile(optimizedBlob);
      setMainImages(prev => [...prev, uploadedData]);
      setUrlInput('');
      toast.success('이미지가 추가되었습니다.');

    } catch (err) {
      const msg = err instanceof Error ? err.message : "이미지 로드 중 오류";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      if (mode === AppMode.IMAGE_EDIT && files.length > 1) {
        toast.warning('이미지 수정 모드는 단일 이미지만 가능합니다.');
        processFiles([files[0]]);
      } else {
        processFiles(files);
      }
    }
  };

  const handleColorImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && activeColorId) {
      processFiles(Array.from(e.target.files), activeColorId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (activeMethod === 'upload' && e.dataTransfer.files?.length) {
      const files = Array.from(e.dataTransfer.files);
      if (mode === AppMode.IMAGE_EDIT && files.length > 1) {
        processFiles([files[0]]);
      } else {
        processFiles(files);
      }
    }
  };

  const removeMainImage = (idx: number) => setMainImages(prev => prev.filter((_, i) => i !== idx));

  // Color Options Handlers
  const addColorOption = () => {
    if (!newColorName.trim()) return;
    const preset = COLOR_PRESETS.find(c => c.name === newColorName);
    const newOption: ColorOption = {
      id: `color-${Date.now()}`,
      colorName: newColorName.trim(),
      hexCode: preset?.hex,
      images: []
    };
    setColorOptions(prev => [...prev, newOption]);
    setNewColorName('');
    toast.success(`${newColorName} 색상이 추가되었습니다.`);
  };

  const removeColorOption = (id: string) => {
    setColorOptions(prev => prev.filter(opt => opt.id !== id));
  };

  const removeColorImage = (colorId: string, imgIdx: number) => {
    setColorOptions(prev => prev.map(opt =>
      opt.id === colorId
        ? { ...opt, images: opt.images.filter((_, i) => i !== imgIdx) }
        : opt
    ));
  };

  const openColorImagePicker = (colorId: string) => {
    setActiveColorId(colorId);
    colorImageInputRef.current?.click();
  };

  // Submit Handler
  const handleSubmit = () => {
    const allImages = [...mainImages];
    colorOptions.forEach(opt => allImages.push(...opt.images));

    if (allImages.length === 0) {
      toast.warning('최소 1개 이상의 이미지를 등록해주세요.');
      return;
    }

    const data: ProductInputData = {
      productName: productName.trim() || undefined,
      price: price ? parseFloat(price.replace(/,/g, '')) : undefined,
      discountRate: discountRate ? parseFloat(discountRate) : undefined,
      productFeatures: productFeatures.trim() || undefined,
      colorOptions,
      mainImages,
      selectedTemplateId: selectedTemplateId || undefined,
      // 모델 설정 (하나라도 설정되어 있으면 포함)
      modelSettings: (modelEthnicity !== 'any' || modelAgeRange !== 'any' || modelGender !== 'any' || modelHairStyle.trim() || modelMood || modelCutStyle)
        ? {
          ethnicity: modelEthnicity !== 'any' ? modelEthnicity : undefined,
          ageRange: modelAgeRange !== 'any' ? modelAgeRange : undefined,
          gender: modelGender !== 'any' ? modelGender : undefined,
          hairStyle: modelHairStyle.trim() || undefined,
          mood: modelMood || undefined,
          modelCutStyle: modelCutStyle || undefined
        }
        : undefined
    };

    onProductSubmit(data);
  };

  const totalImageCount = mainImages.length + colorOptions.reduce((acc, opt) => acc + opt.images.length, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          {mode === AppMode.CREATION ? '상품 정보 등록' : mode === AppMode.LOCALIZATION ? '상세페이지 업로드' : '이미지 수정'}
        </h2>
        <p className="text-gray-500">
          {mode === AppMode.CREATION
            ? '상품 이미지와 기본 정보를 입력해주세요. 컬러 옵션별 이미지도 등록할 수 있습니다.'
            : mode === AppMode.LOCALIZATION
              ? '번역할 상세페이지 스크린샷을 올려주세요.'
              : '수정할 이미지를 업로드하세요.'}
        </p>
      </div>

      {/* Template Selection (Mode A only) */}
      {templates.length > 0 && mode === AppMode.CREATION && (
        <div className="mb-6 bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-lg shadow-sm text-blue-600">
              <LayoutTemplate className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">템플릿 적용 (선택)</h3>
              <p className="text-xs text-gray-500">저장된 템플릿의 레이아웃에 맞춰 생성합니다.</p>
            </div>
          </div>
          <select
            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg p-2.5 outline-none min-w-[200px]"
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
          >
            <option value="">템플릿 사용 안함 (AI 자동)</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.sections.length} 섹션)</option>
            ))}
          </select>
        </div>
      )}

      {/* Main Content - 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT COLUMN: Image Upload */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-blue-600" />
              상품 이미지
            </h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">
              {mainImages.length}장
            </span>
          </div>

          {/* Method Tabs */}
          <div className="flex border-b border-gray-200">
            {(['upload', 'url', 'drive'] as const).map((method) => (
              <button
                key={method}
                onClick={() => { setActiveMethod(method); setErrorMsg(''); }}
                className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${activeMethod === method ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                {method === 'upload' && <><Upload className="w-3.5 h-3.5" /> 파일</>}
                {method === 'url' && <><LinkIcon className="w-3.5 h-3.5" /> URL</>}
                {method === 'drive' && <><ImageIcon className="w-3.5 h-3.5" /> Drive</>}
              </button>
            ))}
          </div>

          {/* Upload Area */}
          <div className="p-4">
            {activeMethod === 'upload' && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`min-h-[180px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                  }`}
              >
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple={mode !== AppMode.IMAGE_EDIT} onChange={handleFileChange} />
                <div className="p-3 bg-gray-100 rounded-full mb-3">
                  <Upload className="w-6 h-6 text-gray-500" />
                </div>
                <p className="text-gray-600 font-medium text-sm">클릭 또는 드래그</p>
                <p className="text-xs text-gray-400 mt-1">여러 장 가능 (Max 10MB)</p>
              </div>
            )}

            {activeMethod === 'url' && (
              <div className="space-y-3">
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="https://example.com/image.jpg"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && processUrl(urlInput, 'url')}
                />
                <button
                  onClick={() => processUrl(urlInput, 'url')}
                  disabled={!urlInput || isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '추가'}
                </button>
              </div>
            )}

            {activeMethod === 'drive' && (
              <div className="space-y-3">
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="https://drive.google.com/file/d/.../view"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && processUrl(urlInput, 'drive')}
                />
                <div className="bg-yellow-50 border border-yellow-100 p-2 rounded-lg text-xs text-yellow-800 flex items-start">
                  <AlertCircle className="w-4 h-4 mr-1.5 flex-shrink-0 mt-0.5" />
                  '링크 공개' 설정 필수
                </div>
                <button
                  onClick={() => processUrl(urlInput, 'drive')}
                  disabled={!urlInput || isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '추가'}
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="mt-3 p-2 bg-red-50 text-red-600 text-xs rounded-lg flex items-center">
                <AlertCircle className="w-4 h-4 mr-1.5" />
                {errorMsg}
              </div>
            )}
          </div>

          {/* Uploaded Images Preview */}
          {mainImages.length > 0 && (
            <div className="px-4 pb-4">
              <div className="grid grid-cols-4 gap-2">
                {mainImages.map((img, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden aspect-square border border-gray-200">
                    <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                    {/* 이미지 역할 태그 버튼 */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 flex gap-0.5 justify-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); const updated = [...mainImages]; updated[idx] = { ...img, role: img.role === 'front' ? undefined : 'front' }; setMainImages(updated); }}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${img.role === 'front' ? 'bg-blue-500 text-white' : 'bg-white/20 text-white/70 hover:bg-white/30'}`}
                        title="정면 이미지"
                      >
                        정면
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); const updated = [...mainImages]; updated[idx] = { ...img, role: img.role === 'back' ? undefined : 'back' }; setMainImages(updated); }}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${img.role === 'back' ? 'bg-orange-500 text-white' : 'bg-white/20 text-white/70 hover:bg-white/30'}`}
                        title="후면 이미지 (후면 이미지 태그 시 코디컷에 후면 자동 생성)"
                      >
                        후면
                      </button>
                    </div>
                    <button
                      onClick={() => removeMainImage(idx)}
                      className="absolute top-1 right-1 bg-black/50 hover:bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors aspect-square"
                >
                  <Plus className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Product Info */}
        <div className="space-y-4">

          {/* Product Basic Info */}
          {mode === AppMode.CREATION && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-green-600" />
                  상품 기본 정보 <span className="text-xs text-gray-400 font-normal">(선택)</span>
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">상품명</label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="예: 투피스 니트 세트"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> 가격 (원)
                    </label>
                    <input
                      type="text"
                      value={price}
                      onChange={(e) => setPrice(e.target.value.replace(/[^0-9,]/g, ''))}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="45,000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                      <Percent className="w-3 h-3" /> 할인율 (%)
                    </label>
                    <input
                      type="number"
                      value={discountRate}
                      onChange={(e) => setDiscountRate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="20"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
                {/* 상품 특징 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    상품 특징 <span className="text-gray-400 font-normal">(AI가 콘텐츠 생성 시 참고)</span>
                  </label>
                  <textarea
                    value={productFeatures}
                    onChange={(e) => setProductFeatures(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="예:&#10;- 부드러운 프리미엄 캐시미어 소재&#10;- 클래식한 핏, 다양한 코디 가능&#10;- 사계절 착용 가능"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Color Options (Mode A only) */}
          {mode === AppMode.CREATION && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm ">
              <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between rounded-t-2xl">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <Palette className="w-5 h-5 text-purple-600" />
                  컬러 옵션 <span className="text-xs text-gray-400 font-normal">(선택)</span>
                </h3>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-bold">
                  {colorOptions.length}개
                </span>
              </div>
              <div className="p-4 space-y-3">
                {/* Add Color Input */}
                {/* Color Selection Grid */}
                {/* Color Selection Custom Dropdown */}
                <div className="flex gap-2 relative z-10">
                  {/* Dropdown Backdrop */}
                  {isDropdownOpen && (
                    <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                  )}

                  {/* Input / Dropdown Trigger */}
                  <div className="flex-1 relative z-50">
                    {isCustomColorMode ? (
                      <div className="relative">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Enter color name..."
                          value={newColorName}
                          onChange={(e) => setNewColorName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newColorName) {
                              e.preventDefault();
                              addColorOption();
                              setIsCustomColorMode(false);
                              setNewColorName('');
                            }
                          }}
                          className="w-full border border-gray-300 rounded-lg p-2.5 pr-8 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                        <button
                          onClick={() => { setIsCustomColorMode(false); setNewColorName(''); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`w-full border rounded-lg p-2.5 flex items-center justify-between transition-all bg-white
                          ${isDropdownOpen ? 'ring-2 ring-purple-500 border-purple-500' : 'border-gray-300 hover:border-gray-400'}
                        `}
                      >
                        <div className="flex items-center gap-2">
                          {newColorName ? (
                            <>
                              <div
                                className="w-5 h-5 rounded-full border border-gray-200 shadow-sm"
                                style={{ backgroundColor: COLOR_PRESETS.find(c => c.name === newColorName)?.hex || 'transparent' }}
                              />
                              <span className="text-gray-900 font-medium">{newColorName}</span>
                            </>
                          ) : (
                            <span className="text-gray-400">Select color...</span>
                          )}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                    )}

                    {/* Dropdown Menu */}
                    {isDropdownOpen && !isCustomColorMode && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-[320px] overflow-y-auto transform origin-top animate-in fade-in slide-in-from-top-2 duration-200 p-1">
                        <div className="space-y-0.5">
                          {COLOR_PRESETS.map((preset) => {
                            const isAdded = colorOptions.some(opt => opt.colorName === preset.name);
                            const isSelected = newColorName === preset.name;

                            return (
                              <button
                                key={preset.name}
                                type="button"
                                onClick={() => {
                                  if (!isAdded) {
                                    setNewColorName(preset.name);
                                    setIsDropdownOpen(false);
                                  }
                                }}
                                disabled={isAdded}
                                className={`
                                  w-full flex items-center justify-between p-2.5 rounded-lg transition-colors group
                                  ${isAdded ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-purple-50 cursor-pointer'}
                                  ${isSelected ? 'bg-purple-50 ring-1 ring-purple-100' : ''}
                                `}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-6 h-6 rounded-full border border-gray-200 shadow-sm shrink-0 transition-transform group-hover:scale-110"
                                    style={{ backgroundColor: preset.hex }}
                                  />
                                  <span className={`text-sm ${isAdded ? 'text-gray-400 decoration-line-through' : 'text-gray-700 font-medium'}`}>
                                    {preset.name}
                                  </span>
                                </div>
                                {isAdded ? (
                                  <span className="text-xs text-gray-400 font-medium px-2 py-0.5 bg-gray-100 rounded">Added</span>
                                ) : isSelected ? (
                                  <Check className="w-4 h-4 text-purple-600" />
                                ) : null}
                              </button>
                            );
                          })}

                          <div className="border-t border-gray-100 my-1 mx-2"></div>

                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomColorMode(true);
                              setNewColorName('');
                              setIsDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-100 text-left transition-colors"
                          >
                            <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 text-gray-400 group-hover:border-gray-400 group-hover:text-gray-500">
                              <Plus className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-sm font-medium text-gray-600 group-hover:text-gray-800">Direct Input (Custom)</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Add Button */}
                  <button
                    onClick={() => {
                      addColorOption();
                      setIsCustomColorMode(false);
                      setNewColorName('');
                    }}
                    disabled={!newColorName || colorOptions.some(opt => opt.colorName === newColorName)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed shadow-sm shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                </div>

                {/* Color Options List */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {colorOptions.map((opt) => (
                    <div key={opt.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          <div
                            className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0"
                            style={{ backgroundColor: opt.hexCode || '#ccc' }}
                          />
                          <span className="font-medium text-sm text-gray-800">{opt.colorName}</span>
                          <span className="text-xs text-gray-400">({opt.images.length}장)</span>

                          {/* Color Picker */}
                          <div className="flex items-center gap-1.5 ml-2">
                            <input
                              type="color"
                              value={opt.hexCode || '#808080'}
                              onChange={(e) => {
                                setColorOptions(prev => prev.map(o =>
                                  o.id === opt.id ? { ...o, hexCode: e.target.value.toUpperCase() } : o
                                ));
                              }}
                              className="w-7 h-7 cursor-pointer rounded border border-gray-300"
                              title="색상 선택"
                            />
                            <span className="text-[10px] text-gray-500 font-mono tracking-tight">
                              {opt.hexCode || '없음'}
                            </span>
                            {opt.extractionConfidence !== undefined && (
                              <span
                                className={`text-[9px] px-1 py-0.5 rounded ${opt.extractionConfidence >= 0.7
                                    ? 'bg-green-100 text-green-700'
                                    : opt.extractionConfidence >= 0.5
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                title={`추출 신뢰도: ${(opt.extractionConfidence * 100).toFixed(0)}%`}
                              >
                                {(opt.extractionConfidence * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openColorImagePicker(opt.id)}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-200"
                          >
                            이미지 추가
                          </button>
                          <button
                            onClick={() => removeColorOption(opt.id)}
                            className="text-gray-400 hover:text-red-500 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {opt.images.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {opt.images.map((img, imgIdx) => (
                            <div key={imgIdx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200 group">
                              <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                              {/* 컬러 이미지 역할 태그 */}
                              <div className="absolute bottom-0 left-0 right-0 bg-black/60 flex gap-px justify-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updated = colorOptions.map(o => o.id === opt.id ? { ...o, images: o.images.map((im, ii) => ii === imgIdx ? { ...im, role: im.role === 'back' ? undefined : 'back' as const } : im) } : o);
                                    setColorOptions(updated);
                                  }}
                                  className={`px-1 py-px rounded text-[8px] font-bold transition-colors ${img.role === 'back' ? 'bg-orange-500 text-white' : 'bg-white/20 text-white/60 hover:bg-white/30'}`}
                                  title="후면 이미지"
                                >
                                  후면
                                </button>
                              </div>
                              <button
                                onClick={() => removeColorImage(opt.id, imgIdx)}
                                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-4 h-4 text-white" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {colorOptions.length === 0 && (
                  <div className="text-center py-4 text-gray-400 text-sm">
                    컬러 옵션을 추가하면 상세페이지에<br />색상별 이미지가 표시됩니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Model Settings (Mode A only) - 컬러 옵션 아래 배치 */}
          {mode === AppMode.CREATION && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm ">
              <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between rounded-t-2xl">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <User className="w-5 h-5 text-teal-600" />
                  모델 설정 <span className="text-xs text-gray-400 font-normal">(이미지 생성 시 적용, 선택)</span>
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  {/* 인종 */}
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">인종</label>
                    <select
                      value={modelEthnicity}
                      onChange={(e) => setModelEthnicity(e.target.value as ModelSettings['ethnicity'])}
                      className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="any">무관</option>
                      <option value="asian">동양인</option>
                      <option value="western">서양인</option>
                    </select>
                  </div>
                  {/* 모델컷 스타일 */}
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">모델컷 스타일</label>
                    <select
                      value={modelCutStyle || 'face_anonymous'}
                      onChange={(e) => setModelCutStyle(e.target.value as ModelSettings['modelCutStyle'] || 'face_anonymous')}
                      className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="face_anonymous">기본 (얼굴 비노출)</option>
                      <option value="face_visible">얼굴 노출</option>
                      <option value="mirror_selfie">거울 셀카</option>
                    </select>
                  </div>
                  {/* 연령대 */}
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">연령대</label>
                    <select
                      value={modelAgeRange}
                      onChange={(e) => setModelAgeRange(e.target.value as ModelSettings['ageRange'])}
                      className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="any">무관</option>
                      <option value="teens">10대</option>
                      <option value="20s">20대</option>
                      <option value="30s">30대</option>
                      <option value="40s">40대</option>
                      <option value="50s+">50대+</option>
                    </select>
                  </div>
                  {/* 성별 */}
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">성별</label>
                    <select
                      value={modelGender}
                      onChange={(e) => setModelGender(e.target.value as ModelSettings['gender'])}
                      className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="any">무관</option>
                      <option value="female">여성</option>
                      <option value="male">남성</option>
                    </select>
                  </div>
                  {/* 헤어 스타일 */}
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">헤어 스타일</label>
                    <select
                      value={modelHairStyle}
                      onChange={(e) => setModelHairStyle(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="">무관</option>
                      <option value="short straight hair">짧은 생머리</option>
                      <option value="long straight hair">긴 생머리</option>
                      <option value="bob cut">단발</option>
                      <option value="wavy hair">웨이브</option>
                      <option value="ponytail">포니테일</option>
                      <option value="bun hairstyle">업스타일</option>
                      <option value="short hair">숏컷(남성)</option>
                    </select>
                  </div>
                  {/* 분위기/무드 */}
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">분위기</label>
                    <select
                      value={modelMood || ''}
                      onChange={(e) => setModelMood(e.target.value as ModelSettings['mood'] || undefined)}
                      className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="">무관</option>
                      <option value="sexy">섹시/매혹</option>
                      <option value="elegant">우아함/세련</option>
                      <option value="innocent">청순/내추럴</option>
                      <option value="casual">캐주얼/편안</option>
                      <option value="sporty">스포티/활동적</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hidden input for color images */}
          <input
            type="file"
            ref={colorImageInputRef}
            className="hidden"
            accept="image/*"
            multiple
            onChange={handleColorImageChange}
          />
        </div>
      </div>

      {/* 하단 플로팅 액션 바 - 이미지 1장 이상 업로드 시 표시 */}
      {totalImageCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-2xl z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            {/* 이미지 카운트 */}
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                <span className="font-bold text-sm">{totalImageCount}장 선택됨</span>
              </div>
              {colorOptions.length > 0 && (
                <span className="text-xs text-gray-500">
                  (기본 {mainImages.length}장 + 컬러옵션 {colorOptions.reduce((acc, opt) => acc + opt.images.length, 0)}장)
                </span>
              )}
            </div>

            {/* 분석 시작 버튼 */}
            <button
              onClick={handleSubmit}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
            >
              <Layers className="w-5 h-5" />
              AI 분석 시작
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* 하단 플로팅 바 공간 확보 */}
      {totalImageCount > 0 && <div className="h-20" />}
    </div>
  );
};