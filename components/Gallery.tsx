import React, { useEffect, useState, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Loader2, Download, Trash2, Images, RefreshCw, X, CheckSquare, Square, FileCode, Image as ImageIcon, Eye } from 'lucide-react';
import { getUserProducts, deleteProduct, ProductSummary, getProductDownloadUrl } from '../services/firebaseService';

interface Props {
  user: User;
}

export const Gallery: React.FC<Props> = ({ user }) => {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // 미리보기 모달
  const [previewProduct, setPreviewProduct] = useState<ProductSummary | null>(null);

  // ─── 데이터 로드 ───────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());
    try {
      const idToken = await user.getIdToken();
      const list = await getUserProducts(idToken);
      setProducts(list);
    } catch (e) {
      console.error('갤러리 로드 실패:', e);
      setError('작업물을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // ─── 선택 토글 ─────────────────────────────────────────────
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.productId)));
    }
  };

  // ─── 단일 삭제 ─────────────────────────────────────────────
  const handleDeleteSingle = async (productId: string, productName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`"${productName}"을 삭제하시겠습니까?`)) return;
    try {
      const idToken = await user.getIdToken();
      await deleteProduct(productId, idToken);
      setProducts(prev => prev.filter(p => p.productId !== productId));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(productId); return n; });
    } catch {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  // ─── 일괄 삭제 ─────────────────────────────────────────────
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`선택한 ${selectedIds.size}개 작업물을 삭제하시겠습니까?`)) return;
    setIsDeleting(true);
    try {
      const idToken = await user.getIdToken();
      await Promise.all([...selectedIds].map(id => deleteProduct(id, idToken)));
      setProducts(prev => prev.filter(p => !selectedIds.has(p.productId)));
      setSelectedIds(new Set());
    } catch {
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── HTML 다운로드 ──────────────────────────────────────────
  const handleDownloadHtml = (product: ProductSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product.htmlContent) { alert('저장된 HTML이 없습니다.'); return; }
    const blob = new Blob([product.htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${product.productName.replace(/\s+/g, '_')}_detail_page.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── 이미지 다운로드 ────────────────────────────────────────
  const handleDownloadImage = async (product: ProductSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product.thumbnailUrl) { alert('저장된 이미지가 없습니다.'); return; }
    
    try {
      console.log('🔵 [Gallery] 다운로드 URL 생성 요청 중...');
      const idToken = await user.getIdToken();
      const signedUrl = await getProductDownloadUrl(product.productId, idToken);
      
      // 서명된 URL을 iframe이나 a tag로 열어 다운로드 트리거
      const a = document.createElement('a');
      a.href = signedUrl;
      // Signed URL 자체에 Content-Disposition이 포함되어 있어 download 속성 없이도 다운로드됨
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      console.log('✅ [Gallery] 다운로드 트리거 완료');
    } catch (err: any) {
      console.error('❌ [Gallery] 다운로드 실패:', err);
      // Fallback: 기존 방식 (새 탭에서 열기)
      window.open(product.thumbnailUrl, '_blank', 'noopener,noreferrer');
      alert(`파일 다운로드에 실패했습니다. (사유: ${err.message || 'CORS 이슈'})\n새 탭에서 열린 이미지를 우클릭하여 저장해주세요.`);
    }
  };

  // ─── 날짜 포맷 ─────────────────────────────────────────────
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    // ISO 8601 또는 숫자 타임스탬프 시도
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    // 한국어 포맷(예: "2024. 1. 15. 오후 3:30:00") — 있는 그대로 반환
    return dateStr.split(' ')[0] || dateStr;
  };

  const allSelected = products.length > 0 && selectedIds.size === products.length;
  const someSelected = selectedIds.size > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* ─── 헤더 ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Images className="w-6 h-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">내 작업물</h1>
          {!loading && (
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {products.length}개
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!loading && products.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {allSelected
                ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                : <Square className="w-4 h-4" />}
              {allSelected ? '전체 해제' : '전체 선택'}
            </button>
          )}
          <button
            onClick={fetchProducts}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {/* ─── 선택 툴바 ───────────────────────────────────── */}
      {someSelected && (
        <div className="flex items-center gap-3 mb-5 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
          <span className="text-sm font-medium text-indigo-700">{selectedIds.size}개 선택됨</span>
          <div className="flex-1" />
          <button
            onClick={handleDeleteSelected}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            {isDeleting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Trash2 className="w-4 h-4" />}
            선택 삭제
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── 로딩 ────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Loader2 className="w-10 h-10 animate-spin mb-3" />
          <p className="text-sm">작업물을 불러오는 중...</p>
        </div>
      )}

      {/* ─── 에러 ────────────────────────────────────────── */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-24 text-red-500">
          <p className="mb-4">{error}</p>
          <button onClick={fetchProducts} className="px-4 py-2 bg-red-50 hover:bg-red-100 rounded-lg text-sm transition-colors">
            다시 시도
          </button>
        </div>
      )}

      {/* ─── 빈 상태 ─────────────────────────────────────── */}
      {!loading && !error && products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Images className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-medium text-gray-500 mb-2">아직 생성한 작업물이 없습니다</p>
          <p className="text-sm text-gray-400">상세페이지를 생성하면 자동으로 여기에 저장됩니다.</p>
        </div>
      )}

      {/* ─── 카드 그리드 ─────────────────────────────────── */}
      {!loading && !error && products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {products.map((product) => {
            const isSelected = selectedIds.has(product.productId);
            return (
              <div
                key={product.productId}
                onClick={() => setPreviewProduct(product)}
                className={`group relative bg-white rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer ${
                  isSelected ? 'border-indigo-400 ring-2 ring-indigo-300' : 'border-gray-200'
                }`}
              >
                {/* 체크박스 */}
                <div
                  onClick={(e) => toggleSelect(product.productId, e)}
                  className="absolute top-2 left-2 z-10"
                >
                  {isSelected
                    ? <CheckSquare className="w-5 h-5 text-indigo-600 drop-shadow" />
                    : <Square className="w-5 h-5 text-white drop-shadow opacity-0 group-hover:opacity-100 transition-opacity" />}
                </div>

                {/* 미리보기 오버레이 */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center z-10 pointer-events-none">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2 shadow">
                    <Eye className="w-5 h-5 text-gray-700" />
                  </div>
                </div>

                {/* 썸네일 */}
                <div className="aspect-[3/4] bg-gray-50 flex items-center justify-center overflow-hidden">
                  {product.thumbnailUrl ? (
                    <img
                      src={product.thumbnailUrl}
                      alt={product.productName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Images className="w-10 h-10 text-gray-200" />
                  )}
                </div>

                {/* 정보 */}
                <div className="p-2.5">
                  <h3 className="font-semibold text-gray-900 text-xs truncate mb-1" title={product.productName}>
                    {product.productName}
                  </h3>
                  <div className="flex items-center gap-1 mb-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      product.mode === '생성(Mode A)'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {product.mode === '생성(Mode A)' ? 'Mode A' : 'Mode B'}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatDate(product.createdAt)}</span>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => handleDownloadHtml(product, e)}
                      className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 bg-gray-900 hover:bg-gray-700 text-white text-[10px] rounded-md transition-colors"
                      title="HTML 다운로드"
                    >
                      <FileCode className="w-3 h-3" />
                      HTML
                    </button>
                    <button
                      onClick={(e) => handleDownloadImage(product, e)}
                      disabled={!product.thumbnailUrl}
                      className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-30"
                      title="이미지 다운로드"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteSingle(product.productId, product.productName, e)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 미리보기 모달 ───────────────────────────────── */}
      {previewProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreviewProduct(null)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  previewProduct.mode === '생성(Mode A)' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                }`}>
                  {previewProduct.mode === '생성(Mode A)' ? 'Mode A' : 'Mode B'}
                </span>
                <h2 className="font-semibold text-gray-900">{previewProduct.productName}</h2>
                <span className="text-xs text-gray-400">{formatDate(previewProduct.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleDownloadImage(previewProduct, e)}
                  disabled={!previewProduct.thumbnailUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30"
                  title="이미지 다운로드"
                >
                  <Download className="w-4 h-4" />
                  이미지
                </button>
                <button
                  onClick={(e) => handleDownloadHtml(previewProduct, e)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <FileCode className="w-4 h-4" />
                  HTML 다운로드
                </button>
                <button
                  onClick={() => setPreviewProduct(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 모달 콘텐츠 */}
            <div className="flex-1 overflow-hidden">
              {previewProduct.htmlContent ? (
                <iframe
                  srcDoc={previewProduct.htmlContent}
                  className="w-full h-full border-0"
                  style={{ minHeight: '70vh' }}
                  sandbox="allow-same-origin"
                  title={previewProduct.productName}
                />
              ) : previewProduct.thumbnailUrl ? (
                <div className="flex items-center justify-center h-full p-8 bg-gray-50">
                  <img
                    src={previewProduct.thumbnailUrl}
                    alt={previewProduct.productName}
                    className="max-w-full max-h-[65vh] object-contain rounded-lg shadow"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-400">
                  <p>미리보기를 사용할 수 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
