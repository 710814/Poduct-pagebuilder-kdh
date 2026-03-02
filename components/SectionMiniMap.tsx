import React from 'react';
import { Image, LayoutGrid, Type, Columns, Rows3, MoveUp, MoveDown, Trash2 } from 'lucide-react';
import { SectionData } from '../types';

interface SectionMiniMapProps {
    sections: SectionData[];
    activeSectionId?: string;
    onSectionClick: (sectionId: string) => void;
    onMoveSection: (index: number, direction: 'up' | 'down') => void;
    onDeleteSection?: (index: number) => void;
}

// 레이아웃 배지 정보
const getBadgeInfo = (section: SectionData) => {
    const layoutType = section.layoutType || 'full-width';
    // 이미지 슬롯 개수에 따라 배지 표시 (사용자 요청: 3개면 "3열"로 표기)
    const slotCount = section.imageSlots?.length || 0;

    // 콜라주 레이아웃을 먼저 체크 (슬롯 개수보다 우선)
    if (layoutType.startsWith('collage-')) {
        const collageLabels: { [key: string]: string } = {
            'collage-1-2': '콜라주 1+2',
            'collage-2-1': '콜라주 2+1',
            'collage-1-3': '콜라주 1+3',
            'collage-2x2': '콜라주 2×2',
        };
        return {
            icon: LayoutGrid,
            label: collageLabels[layoutType] || '콜라주',
            color: 'bg-violet-50 border-violet-200 text-violet-600'
        };
    }

    if (layoutType === 'grid-1') {
        return { icon: Rows3, label: '3행 그리드', color: 'bg-teal-50 border-teal-200 text-teal-600' };
    }

    if (slotCount >= 3 && layoutType !== 'grid-1') {
        return { icon: LayoutGrid, label: '3열', color: 'bg-emerald-50 border-emerald-200 text-emerald-600' };
    }
    if (slotCount === 2 && layoutType !== 'grid-1') {
        return { icon: LayoutGrid, label: '2열', color: 'bg-green-50 border-green-200 text-green-600' };
    }

    switch (layoutType) {
        case 'text-only':
            return { icon: Type, label: '텍스트', color: 'bg-gray-100 border-gray-200 text-gray-600' };
        case 'full-width':
            return { icon: Image, label: '전체 너비', color: 'bg-blue-50 border-blue-200 text-blue-600' };
        case 'image-only':
            return { icon: Image, label: '이미지만', color: 'bg-sky-50 border-sky-200 text-sky-600' };
        case 'split-left':
            return { icon: Columns, label: '좌측 이미지', color: 'bg-purple-50 border-purple-200 text-purple-600' };
        case 'split-right':
            return { icon: Columns, label: '우측 이미지', color: 'bg-purple-50 border-purple-200 text-purple-600' };
        case 'grid-2':
            return { icon: LayoutGrid, label: '2열 그리드', color: 'bg-green-50 border-green-200 text-green-600' };
        case 'grid-3':
            return { icon: LayoutGrid, label: '3열 그리드', color: 'bg-emerald-50 border-emerald-200 text-emerald-600' };
        default:
            return { icon: Image, label: '전체 너비', color: 'bg-blue-50 border-blue-200 text-blue-600' };
    }
};

// 이미지 완료 여부
const hasImage = (section: SectionData): boolean => {
    if (section.layoutType === 'text-only') return true;
    return !!(section.imageUrl || section.imageSlots?.some(s => s.imageUrl));
};

export const SectionMiniMap: React.FC<SectionMiniMapProps> = ({
    sections,
    activeSectionId,
    onSectionClick,
    onMoveSection,
    onDeleteSection
}) => {
    const done = sections.filter(hasImage).length;

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            {/* 헤더 */}
            <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4 text-gray-500" />
                        섹션 구조
                    </h3>
                    <span className="text-xs text-gray-400">{done}/{sections.length}</span>
                </div>
                {/* 진행률 바 */}
                <div className="mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${sections.length ? (done / sections.length) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* 섹션 목록 */}
            <div className="p-3 space-y-2">
                {sections.map((section, i) => {
                    const active = section.id === activeSectionId;
                    const badge = getBadgeInfo(section);
                    const Icon = badge.icon;

                    return (
                        <div
                            key={section.id}
                            onClick={() => onSectionClick(section.id)}
                            className={`
                                group relative flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all
                                ${active
                                    ? 'bg-white border-2 border-blue-500 shadow-sm'
                                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                                }
                            `}
                        >
                            {/* 번호 */}
                            <span className={`
                                w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold shrink-0
                                ${active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}
                            `}>
                                {i + 1}
                            </span>

                            {/* 배지 */}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${badge.color} text-[11px] font-semibold shrink-0`}>
                                <Icon className="w-3 h-3" />
                                {badge.label}
                            </span>

                            {/* 제목 */}
                            <span className={`text-sm truncate flex-1 ${active ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                                {section.title || '(제목 없음)'}
                            </span>

                            {/* 호버 액션 버튼 (복원) */}
                            <div className="absolute right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-[2px] rounded-lg p-1 shadow-sm border border-gray-100">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onMoveSection(i, 'up'); }}
                                    disabled={i === 0}
                                    className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                    title="위로"
                                >
                                    <MoveUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onMoveSection(i, 'down'); }}
                                    disabled={i === sections.length - 1}
                                    className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                    title="아래로"
                                >
                                    <MoveDown className="w-3.5 h-3.5" />
                                </button>
                                {onDeleteSection && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteSection(i); }}
                                        className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                                        title="삭제"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
