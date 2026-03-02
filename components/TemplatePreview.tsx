import React from 'react';
import { Template, SectionData, LayoutType } from '../types';
import { Image as ImageIcon, Type, Layers, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';

interface TemplatePreviewProps {
    template: Template;
    size?: 'sm' | 'md' | 'lg';
    showInfo?: boolean;
    className?: string;
    onSectionClick?: (sectionIndex: number) => void;  // 섹션 클릭 시 콜백
    interactive?: boolean;  // 클릭 가능 여부
    onMoveSection?: (index: number, direction: 'up' | 'down') => void;
    onRemoveSection?: (index: number) => void;
}

/**
 * 템플릿 레이아웃 미리보기 컴포넌트
 * 각 섹션의 레이아웃 구조를 시각적으로 표시
 */
export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
    template,
    size = 'md',
    showInfo = true,
    className = '',
    onSectionClick,
    interactive = false,
    onMoveSection,
    onRemoveSection
}) => {
    // 크기별 스타일 설정
    const sizeStyles = {
        sm: { sectionHeight: 'h-6', gap: 'gap-1', padding: 'p-2', fontSize: 'text-[8px]', iconSize: 'w-3 h-3' },
        md: { sectionHeight: 'h-10', gap: 'gap-1.5', padding: 'p-3', fontSize: 'text-[10px]', iconSize: 'w-3.5 h-3.5' },
        lg: { sectionHeight: 'h-14', gap: 'gap-2', padding: 'p-4', fontSize: 'text-xs', iconSize: 'w-4 h-4' }
    };

    const styles = sizeStyles[size];

    // 총 이미지 슬롯 수 계산
    const totalImageSlots = template.sections.reduce((acc, section) => {
        return acc + (section.imageSlots?.length || (section.imagePrompt ? 1 : 0));
    }, 0);

    const handleSectionClick = (index: number, e: React.MouseEvent) => {
        // 이미 버튼 클릭 등이 처리되었으면 무시
        if (e.defaultPrevented) return;

        if (interactive && onSectionClick) {
            onSectionClick(index);
        }
    };

    return (
        <div className={`bg-slate-50 rounded-lg overflow-hidden ${className}`}>
            {/* 섹션 미리보기 영역 */}
            <div className={`${styles.padding} ${styles.gap} flex flex-col`}>
                {template.sections.map((section, idx) => (
                    <SectionPreview
                        key={section.id || idx}
                        section={section}
                        index={idx}
                        totalSections={template.sections.length}
                        sectionHeight={styles.sectionHeight}
                        fontSize={styles.fontSize}
                        iconSize={styles.iconSize}
                        onClick={(e) => handleSectionClick(idx, e)}
                        interactive={interactive}
                        onMove={(dir) => onMoveSection?.(idx, dir)}
                        onRemove={() => onRemoveSection?.(idx)}
                    />
                ))}
            </div>

            {/* 정보 표시 */}
            {showInfo && (
                <div className={`border-t border-gray-200 ${styles.padding} bg-white flex items-center justify-between`}>
                    <div className={`flex items-center gap-2 ${styles.fontSize} text-gray-500`}>
                        <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            {template.sections.length} sections
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />
                            {totalImageSlots} images
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * 개별 섹션 레이아웃 미리보기
 */
const SectionPreview: React.FC<{
    section: SectionData;
    index: number;
    totalSections: number;
    sectionHeight: string;
    fontSize: string;
    iconSize: string;
    onClick?: (e: React.MouseEvent) => void;
    interactive?: boolean;
    onMove?: (direction: 'up' | 'down') => void;
    onRemove?: () => void;
}> = ({ section, index, totalSections, sectionHeight, fontSize, iconSize, onClick, interactive, onMove, onRemove }) => {
    const layoutType = section.layoutType || 'full-width';
    const imageSlotCount = section.imageSlots?.length || (section.imagePrompt ? 1 : 0);

    // 레이아웃별 렌더링
    const renderLayout = () => {
        switch (layoutType) {
            case 'full-width':
                return (
                    <div className="flex gap-1 h-full">
                        <ImageSlotBar count={imageSlotCount} className="flex-1" />
                    </div>
                );

            case 'split-left':
                return (
                    <div className="flex gap-1 h-full">
                        <ImageSlotBar count={Math.min(imageSlotCount, 1)} className="w-1/2" />
                        <TextBar className="w-1/2" />
                    </div>
                );

            case 'split-right':
                return (
                    <div className="flex gap-1 h-full">
                        <TextBar className="w-1/2" />
                        <ImageSlotBar count={Math.min(imageSlotCount, 1)} className="w-1/2" />
                    </div>
                );

            case 'grid-1':
                return (
                    <div className="flex flex-col gap-1 h-full w-full">
                        {Array.from({ length: Math.min(3, Math.max(1, imageSlotCount)) }).map((_, i) => (
                            <ImageSlotBar key={i} count={1} className="flex-1" />
                        ))}
                    </div>
                );

            case 'grid-2':
                return (
                    <div className="flex gap-1 h-full">
                        <ImageSlotBar count={1} className="w-1/2" />
                        <ImageSlotBar count={1} className="w-1/2" />
                    </div>
                );

            case 'grid-3':
                return (
                    <div className="flex gap-1 h-full">
                        <ImageSlotBar count={1} className="w-1/3" />
                        <ImageSlotBar count={1} className="w-1/3" />
                        <ImageSlotBar count={1} className="w-1/3" />
                    </div>
                );

            case 'text-only':
                return (
                    <div className="flex gap-1 h-full">
                        <TextBar className="flex-1" />
                    </div>
                );

            case 'image-only':
                return (
                    <div className="flex gap-1 h-full">
                        <ImageSlotBar count={imageSlotCount} className="flex-1" filled />
                    </div>
                );

            default:
                if (layoutType.startsWith('collage-')) {
                    return (
                        <div className="flex gap-1 h-full">
                            <ImageSlotBar count={imageSlotCount} className="flex-1" filled icon="collage" />
                        </div>
                    );
                }
                return (
                    <div className="flex gap-1 h-full">
                        <ImageSlotBar count={imageSlotCount} className="flex-1" />
                    </div>
                );
        }
    };

    return (
        <div
            onClick={onClick}
            className={`
        ${sectionHeight} rounded bg-white border border-gray-200 p-1 relative group
        ${interactive
                    ? 'cursor-pointer hover:border-blue-400 hover:shadow-md hover:bg-blue-50/30 transition-all'
                    : ''
                }
      `}
            title={`${section.title || `Section ${index + 1}`} (${layoutType})${interactive ? ' - 클릭하여 편집' : ''}`}
        >
            {renderLayout()}

            {/* 호버 시 섹션 정보 및 컨트롤 표시 */}
            <div className={`
                absolute inset-0 bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity rounded 
                flex items-center justify-between px-3
                ${interactive ? 'backdrop-blur-[1px]' : ''}
            `}>
                <span className={`font-bold text-gray-700 ${fontSize}`}>
                    #{index + 1} {section.sectionType}
                </span>

                {interactive && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={(e) => { e.stopPropagation(); onMove?.('up'); }}
                            disabled={index === 0}
                            className="p-1 hover:bg-gray-200 rounded text-gray-600 disabled:opacity-30 transition-colors"
                            title="위로"
                        >
                            <ArrowUp className={iconSize} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onMove?.('down'); }}
                            disabled={index === totalSections - 1}
                            className="p-1 hover:bg-gray-200 rounded text-gray-600 disabled:opacity-30 transition-colors"
                            title="아래로"
                        >
                            <ArrowDown className={iconSize} />
                        </button>
                        <div className="w-px h-3 bg-gray-300 mx-1"></div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
                            className="p-1 hover:bg-red-100 hover:text-red-500 rounded text-gray-400 transition-colors"
                            title="삭제"
                        >
                            <Trash2 className={iconSize} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

/**
 * 이미지 슬롯 표시 바
 */
const ImageSlotBar: React.FC<{
    count: number;
    className?: string;
    filled?: boolean;
    icon?: 'image' | 'collage';
}> = ({ count, className = '', filled = false, icon = 'image' }) => (
    <div
        className={`
      ${className} rounded
      ${filled
                ? 'bg-blue-400/20 border border-blue-200'
                : 'bg-blue-50 border border-blue-100'
            }
      flex items-center justify-center
    `}
    >
        {icon === 'collage' ? (
            <Layers className="w-3 h-3 text-blue-500" />
        ) : count > 1 ? (
            <span className="text-[8px] text-blue-600 font-medium">×{count}</span>
        ) : (
            <ImageIcon className="w-3 h-3 text-blue-300" />
        )}
    </div>
);

/**
 * 텍스트 영역 표시 바
 */
const TextBar: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div
        className={`
      ${className} rounded bg-gray-50 border border-gray-100
      flex items-center justify-center
    `}
    >
        <div className="space-y-0.5 w-3/4 opacity-50">
            <div className="h-0.5 bg-gray-300 rounded-full w-2/3 mx-auto" />
            <div className="h-0.5 bg-gray-200 rounded-full w-full" />
        </div>
    </div>
);

export default TemplatePreview;
