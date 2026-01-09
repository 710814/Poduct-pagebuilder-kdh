import React, { useState, useCallback } from 'react';
import {
    Download,
    ArrowLeft,
    CheckCircle,
    RefreshCw,
    Wand2,
    ChevronRight,
    Image as ImageIcon
} from 'lucide-react';
import { ImageEnhancementType } from '../types';
import { useToastContext } from '../contexts/ToastContext';

interface Props {
    originalImageUrl: string;
    enhancedImageUrl: string;
    enhancementType: ImageEnhancementType;
    onRestart: () => void;
    onGenerateMore: () => void;
}

const TYPE_LABELS: Record<ImageEnhancementType, string> = {
    background_change: '배경 변경',
    model_shot: '모델 착용샷',
    lifestyle: '라이프스타일 연출',
    multi_angle: '다양한 앵글',
    remove_bg: '배경 제거'
};

export const ImageEnhancementResult: React.FC<Props> = ({
    originalImageUrl,
    enhancedImageUrl,
    enhancementType,
    onRestart,
    onGenerateMore
}) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [compareMode, setCompareMode] = useState(false);
    const toast = useToastContext();

    // 이미지 다운로드 함수
    const handleDownload = useCallback(async (imageUrl: string, filename: string) => {
        try {
            setIsDownloading(true);

            // Base64 데이터 URL인 경우
            if (imageUrl.startsWith('data:')) {
                const link = document.createElement('a');
                link.href = imageUrl;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success('이미지가 다운로드되었습니다.');
                return;
            }

            // 일반 URL인 경우
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success('이미지가 다운로드되었습니다.');
        } catch (error) {
            console.error('이미지 다운로드 실패:', error);
            toast.error('이미지 다운로드에 실패했습니다.');
        } finally {
            setIsDownloading(false);
        }
    }, [toast]);

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            {/* 헤더 */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">이미지 생성 완료!</h1>
                <p className="text-gray-600">
                    <span className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                        <Wand2 className="w-4 h-4 mr-1" />
                        {TYPE_LABELS[enhancementType]}
                    </span>
                </p>
            </div>

            {/* 이미지 결과 영역 */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-6">
                {/* 보기 모드 토글 */}
                <div className="flex items-center justify-center gap-2 p-4 bg-gray-50 border-b">
                    <button
                        onClick={() => setCompareMode(false)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!compareMode ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        결과만 보기
                    </button>
                    <button
                        onClick={() => setCompareMode(true)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${compareMode ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        비교해서 보기
                    </button>
                </div>

                {compareMode ? (
                    // 비교 모드
                    <div className="grid md:grid-cols-2 gap-0">
                        {/* 원본 이미지 */}
                        <div className="p-6 border-r border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-700 flex items-center">
                                    <ImageIcon className="w-5 h-5 mr-2 text-gray-500" />
                                    원본 이미지
                                </h3>
                            </div>
                            <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-square flex items-center justify-center">
                                <img
                                    src={originalImageUrl}
                                    alt="원본 이미지"
                                    className="max-w-full max-h-full object-contain"
                                />
                            </div>
                        </div>

                        {/* 생성된 이미지 */}
                        <div className="p-6 bg-purple-50/30">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-purple-700 flex items-center">
                                    <Wand2 className="w-5 h-5 mr-2 text-purple-600" />
                                    생성된 이미지
                                </h3>
                            </div>
                            <div className="relative bg-white rounded-lg overflow-hidden aspect-square flex items-center justify-center border-2 border-purple-200">
                                <img
                                    src={enhancedImageUrl}
                                    alt="생성된 이미지"
                                    className="max-w-full max-h-full object-contain"
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    // 결과만 보기
                    <div className="p-8">
                        <div className="max-w-2xl mx-auto">
                            <div className="relative bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center border-2 border-purple-200">
                                <img
                                    src={enhancedImageUrl}
                                    alt="생성된 이미지"
                                    className="w-full h-auto max-h-[600px] object-contain"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 액션 버튼 */}
            <div className="flex flex-wrap justify-center gap-4 mb-8">
                <button
                    onClick={() => handleDownload(enhancedImageUrl, `enhanced-image-${Date.now()}.png`)}
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                    <Download className="w-5 h-5" />
                    {isDownloading ? '다운로드 중...' : '이미지 다운로드'}
                </button>

                <button
                    onClick={onGenerateMore}
                    className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-xl font-semibold transition-colors"
                >
                    <RefreshCw className="w-5 h-5" />
                    다시 생성하기
                </button>

                <button
                    onClick={onRestart}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                    다른 이미지로
                </button>
            </div>

            {/* 다음 단계 안내 */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                <h3 className="font-semibold text-blue-900 mb-2">💡 다음 단계</h3>
                <p className="text-blue-700 mb-4">
                    생성된 이미지로 상세페이지를 만들어보세요!
                </p>
                <button
                    onClick={onRestart}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                    상세페이지 생성하기
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

ImageEnhancementResult.displayName = 'ImageEnhancementResult';
