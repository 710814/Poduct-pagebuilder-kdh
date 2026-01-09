import React, { useCallback } from 'react';
import { AppMode } from '../types';
import { Sparkles, ArrowRight, Wand2, Image as ImageIcon, Camera, User } from 'lucide-react';

interface Props {
  onSelectMode: (mode: AppMode) => void;
}

export const StepModeSelection: React.FC<Props> = React.memo(({ onSelectMode }) => {
  const handleCreationClick = useCallback(() => {
    onSelectMode(AppMode.CREATION);
  }, [onSelectMode]);

  const handleImageEditClick = useCallback(() => {
    onSelectMode(AppMode.IMAGE_EDIT);
  }, [onSelectMode]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12" style={{ maxWidth: '1280px', margin: '0 auto', padding: '48px 16px' }}>
      <div className="text-center mb-12" style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1 className="text-4xl font-bold text-gray-900 mb-4" style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '16px' }}>
          PageGenie
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          상품 이미지만 있으면 AI가 상세페이지를 자동으로 설계하고 디자인합니다.<br />
          이미지가 부족하다면 먼저 이미지 고도화 모드로 멋진 상품 이미지를 만들어보세요.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Mode A: Creation */}
        <button
          onClick={handleCreationClick}
          className="group relative flex flex-col items-start p-8 bg-white border-2 border-transparent hover:border-blue-500 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-left"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles size={100} className="text-blue-600" />
          </div>
          <div className="p-3 bg-blue-100 rounded-lg mb-6">
            <Sparkles className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            상세페이지 생성
          </h3>
          <p className="text-sm text-blue-600 font-medium mb-3">Mode A</p>
          <p className="text-gray-600 mb-6 flex-1">
            상품 사진만 업로드하세요.<br />
            AI가 분석하여 상세페이지 전체를 자동으로 만들어드립니다.
          </p>
          <div className="mt-auto flex items-center text-blue-600 font-semibold group-hover:translate-x-2 transition-transform">
            시작하기 <ArrowRight className="ml-2 w-4 h-4" />
          </div>
        </button>

        {/* Mode C: Image Enhancement */}
        <button
          onClick={handleImageEditClick}
          className="group relative flex flex-col items-start p-8 bg-white border-2 border-transparent hover:border-purple-500 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-left"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wand2 size={100} className="text-purple-600" />
          </div>
          <div className="p-3 bg-purple-100 rounded-lg mb-6">
            <Wand2 className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            이미지 고도화
          </h3>
          <p className="text-sm text-purple-600 font-medium mb-3">Mode C</p>
          <p className="text-gray-600 mb-4 flex-1">
            상품 이미지가 부족하거나 단조로운가요?<br />
            AI가 멋진 배경과 모델컷을 만들어드립니다.
          </p>

          {/* Feature tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-full">
              <ImageIcon className="w-3 h-3 mr-1" />배경 추가
            </span>
            <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-full">
              <User className="w-3 h-3 mr-1" />모델컷
            </span>
            <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-full">
              <Camera className="w-3 h-3 mr-1" />다양한 앵글
            </span>
          </div>

          <div className="mt-auto flex items-center text-purple-600 font-semibold group-hover:translate-x-2 transition-transform">
            시작하기 <ArrowRight className="ml-2 w-4 h-4" />
          </div>
        </button>
      </div>
    </div>
  );
});

StepModeSelection.displayName = 'StepModeSelection';