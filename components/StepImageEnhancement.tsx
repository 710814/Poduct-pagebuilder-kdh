import React, { useState, useCallback, useMemo } from 'react';
import {
    ImageEnhancementType,
    BackgroundType,
    ImageEnhancementOptions,
    UploadedFile,
    ModelSettings
} from '../types';
import {
    Upload,
    Image as ImageIcon,
    User,
    Camera,
    Home,
    Trees,
    Building2,
    Coffee,
    Sparkles,
    X,
    ChevronRight,
    Loader2,
    ArrowLeft,
    Wand2,
    Palette
} from 'lucide-react';

interface Props {
    onSubmit: (file: UploadedFile, options: ImageEnhancementOptions) => void;
    onBack: () => void;
    isLoading: boolean;
}

// 이미지 고도화 유형 정보
const ENHANCEMENT_TYPES: {
    type: ImageEnhancementType;
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
}[] = [
        {
            type: 'background_change',
            title: '배경 바꾸기',
            description: '상품에 멋진 배경을 추가해요',
            icon: <ImageIcon className="w-6 h-6" />,
            color: 'blue'
        },
        {
            type: 'model_shot',
            title: '모델 착용샷',
            description: '모델이 상품을 착용한 이미지',
            icon: <User className="w-6 h-6" />,
            color: 'purple'
        },
        {
            type: 'lifestyle',
            title: '라이프스타일 연출',
            description: '실제 사용 환경에서의 모습',
            icon: <Home className="w-6 h-6" />,
            color: 'green'
        },
        {
            type: 'multi_angle',
            title: '다양한 각도',
            description: '정면/측면/뒷면 등 다양한 앵글',
            icon: <Camera className="w-6 h-6" />,
            color: 'orange'
        }
    ];

// 배경 유형 정보
const BACKGROUND_OPTIONS: {
    type: BackgroundType;
    title: string;
    icon: React.ReactNode;
    promptSuffix: string;
}[] = [
        { type: 'studio_white', title: '화이트 스튜디오', icon: <Sparkles className="w-5 h-5" />, promptSuffix: 'clean white studio background, professional lighting' },
        { type: 'studio_gray', title: '그레이 스튜디오', icon: <Palette className="w-5 h-5" />, promptSuffix: 'elegant gray gradient studio background, soft lighting' },
        { type: 'nature', title: '자연 배경', icon: <Trees className="w-5 h-5" />, promptSuffix: 'beautiful natural outdoor background, soft sunlight, greenery' },
        { type: 'city', title: '도시 거리', icon: <Building2 className="w-5 h-5" />, promptSuffix: 'modern city street background, urban style, bokeh effect' },
        { type: 'cafe', title: '카페', icon: <Coffee className="w-5 h-5" />, promptSuffix: 'cozy cafe interior background, warm ambient lighting' },
        { type: 'home', title: '홈 인테리어', icon: <Home className="w-5 h-5" />, promptSuffix: 'modern home interior background, minimalist decor' }
    ];

export const StepImageEnhancement: React.FC<Props> = ({ onSubmit, onBack, isLoading }) => {
    // States
    const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
    const [selectedType, setSelectedType] = useState<ImageEnhancementType | null>(null);
    const [selectedBackground, setSelectedBackground] = useState<BackgroundType>('studio_white');
    const [modelSettings, setModelSettings] = useState<ModelSettings>({
        ethnicity: 'asian',
        gender: 'female',
        ageRange: '20s'
    });
    const [customPrompt, setCustomPrompt] = useState('');
    const [dragActive, setDragActive] = useState(false);

    // File upload handlers
    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await processFile(file);
    }, []);

    const processFile = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('이미지 파일만 업로드 가능합니다.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            setUploadedFile({
                file,
                previewUrl: URL.createObjectURL(file),
                base64,
                mimeType: file.type
            });
        };
        reader.readAsDataURL(file);
    };

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            await processFile(file);
        }
    }, []);

    const handleRemoveFile = useCallback(() => {
        if (uploadedFile?.previewUrl) {
            URL.revokeObjectURL(uploadedFile.previewUrl);
        }
        setUploadedFile(null);
    }, [uploadedFile]);

    // Submit handler
    const handleSubmit = useCallback(() => {
        if (!uploadedFile || !selectedType) return;

        const options: ImageEnhancementOptions = {
            type: selectedType,
            backgroundType: selectedType === 'background_change' ? selectedBackground : undefined,
            modelSettings: selectedType === 'model_shot' ? modelSettings : undefined,
            customPrompt: customPrompt || undefined,
            generateCount: 1
        };

        onSubmit(uploadedFile, options);
    }, [uploadedFile, selectedType, selectedBackground, modelSettings, customPrompt, onSubmit]);

    // Check if can proceed
    const canProceed = useMemo(() => {
        return uploadedFile && selectedType;
    }, [uploadedFile, selectedType]);

    // Color utility
    const getColorClasses = (color: string, isSelected: boolean) => {
        const colorMap: Record<string, { bg: string; border: string; text: string; bgLight: string }> = {
            blue: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-600', bgLight: 'bg-blue-50' },
            purple: { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-600', bgLight: 'bg-purple-50' },
            green: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-600', bgLight: 'bg-green-50' },
            orange: { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-600', bgLight: 'bg-orange-50' }
        };
        return colorMap[color] || colorMap.blue;
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={onBack}
                    className="flex items-center text-gray-500 hover:text-gray-700 mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    모드 선택으로 돌아가기
                </button>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-100 rounded-lg">
                        <Wand2 className="w-6 h-6 text-purple-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">이미지 고도화</h1>
                </div>
                <p className="text-gray-600">
                    상품 이미지를 업로드하고 원하는 스타일을 선택하세요. AI가 멋진 이미지를 만들어드립니다.
                </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Left: Image Upload */}
                <div className="space-y-6">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">1. 상품 이미지 업로드</h2>

                        {!uploadedFile ? (
                            <div
                                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragActive
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                                    }`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                            >
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-600 mb-2">
                                    이미지를 드래그하거나 클릭하여 업로드
                                </p>
                                <p className="text-sm text-gray-400">
                                    JPG, PNG, WebP 지원 (최대 10MB)
                                </p>
                            </div>
                        ) : (
                            <div className="relative bg-gray-100 rounded-xl overflow-hidden">
                                <img
                                    src={uploadedFile.previewUrl}
                                    alt="업로드된 이미지"
                                    className="w-full h-64 object-contain"
                                />
                                <button
                                    onClick={handleRemoveFile}
                                    className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
                                >
                                    <X className="w-4 h-4 text-gray-600" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Tips */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-800">
                            <strong>💡 팁:</strong> 배경이 깔끔하고 상품이 잘 보이는 이미지일수록 더 좋은 결과물이 나와요.
                        </p>
                    </div>
                </div>

                {/* Right: Options */}
                <div className="space-y-6">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">2. 원하는 이미지 스타일</h2>

                        <div className="grid grid-cols-2 gap-3">
                            {ENHANCEMENT_TYPES.map((item) => {
                                const isSelected = selectedType === item.type;
                                const colors = getColorClasses(item.color, isSelected);

                                return (
                                    <button
                                        key={item.type}
                                        onClick={() => setSelectedType(item.type)}
                                        className={`relative flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${isSelected
                                                ? `${colors.border} ${colors.bgLight}`
                                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg mb-2 ${isSelected ? colors.bgLight : 'bg-gray-100'}`}>
                                            <span className={isSelected ? colors.text : 'text-gray-500'}>
                                                {item.icon}
                                            </span>
                                        </div>
                                        <h3 className={`font-semibold ${isSelected ? colors.text : 'text-gray-900'}`}>
                                            {item.title}
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Conditional Options based on selected type */}
                    {selectedType === 'background_change' && (
                        <div className="animate-fadeIn">
                            <h3 className="text-md font-semibold text-gray-900 mb-3">배경 선택</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {BACKGROUND_OPTIONS.map((bg) => (
                                    <button
                                        key={bg.type}
                                        onClick={() => setSelectedBackground(bg.type)}
                                        className={`flex flex-col items-center p-3 rounded-lg border transition-all ${selectedBackground === bg.type
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <span className={selectedBackground === bg.type ? 'text-blue-600' : 'text-gray-500'}>
                                            {bg.icon}
                                        </span>
                                        <span className={`text-xs mt-1 ${selectedBackground === bg.type ? 'text-blue-600 font-medium' : 'text-gray-600'
                                            }`}>
                                            {bg.title}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedType === 'model_shot' && (
                        <div className="animate-fadeIn space-y-4">
                            <h3 className="text-md font-semibold text-gray-900">모델 설정</h3>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">성별</label>
                                <div className="flex gap-2">
                                    {[
                                        { value: 'female', label: '여성' },
                                        { value: 'male', label: '남성' }
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setModelSettings(prev => ({ ...prev, gender: opt.value as 'female' | 'male' }))}
                                            className={`px-4 py-2 rounded-lg border transition-all ${modelSettings.gender === opt.value
                                                    ? 'border-purple-500 bg-purple-50 text-purple-600'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">연령대</label>
                                <div className="flex gap-2 flex-wrap">
                                    {[
                                        { value: '20s', label: '20대' },
                                        { value: '30s', label: '30대' },
                                        { value: '40s', label: '40대' }
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setModelSettings(prev => ({ ...prev, ageRange: opt.value as '20s' | '30s' | '40s' }))}
                                            className={`px-4 py-2 rounded-lg border transition-all ${modelSettings.ageRange === opt.value
                                                    ? 'border-purple-500 bg-purple-50 text-purple-600'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Custom Prompt (Optional) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            추가 요청사항 (선택)
                        </label>
                        <textarea
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            placeholder="예: 밝은 조명으로, 따뜻한 느낌으로..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                            rows={2}
                        />
                    </div>
                </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className={uploadedFile ? 'text-green-600' : 'text-gray-400'}>
                            ✓ 이미지 업로드 {uploadedFile && '완료'}
                        </span>
                        <span className={selectedType ? 'text-green-600' : 'text-gray-400'}>
                            ✓ 스타일 선택 {selectedType && '완료'}
                        </span>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={!canProceed || isLoading}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${canProceed && !isLoading
                                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                생성 중...
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-5 h-5" />
                                이미지 생성하기
                                <ChevronRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Bottom padding for fixed bar */}
            <div className="h-24" />
        </div>
    );
};

StepImageEnhancement.displayName = 'StepImageEnhancement';
