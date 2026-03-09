/**
 * 이미지에서 컬러 자동 추출 유틸리티
 * Canvas API를 사용하여 상품 이미지의 대표 색상을 추출
 */

export interface ColorExtractionResult {
  hexCode: string;
  rgb: [number, number, number];
  confidence: number; // 0-1 사이의 신뢰도
}

export interface ColorExtractionOptions {
  sampleSize?: number; // 리사이징할 크기 (기본: 100)
  excludeBackground?: boolean; // 배경색 제외 여부 (기본: true)
  centerWeight?: number; // 중앙 영역 가중치 (기본: 1.5)
}

const DEFAULT_OPTIONS: Required<ColorExtractionOptions> = {
  sampleSize: 100,
  excludeBackground: true,
  centerWeight: 1.5,
};

/**
 * RGB를 HEX 코드로 변환
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * 두 RGB 색상 간의 유사도 계산 (0-1, 1이 완전 동일)
 */
function calculateColorSimilarity(
  rgb1: [number, number, number],
  rgb2: [number, number, number]
): number {
  const [r1, g1, b1] = rgb1;
  const [r2, g2, b2] = rgb2;

  // 유클리드 거리 기반 유사도
  const distance = Math.sqrt(
    Math.pow(r1 - r2, 2) +
    Math.pow(g1 - g2, 2) +
    Math.pow(b1 - b2, 2)
  );

  // 최대 거리는 sqrt(255^2 * 3) = 441.67
  // 0-1로 정규화 (1이 완전 동일, 0이 완전 다름)
  return 1 - (distance / 441.67);
}

/**
 * 색상이 배경색인지 판단 (흰색 또는 검정색)
 */
function isBackgroundColor(r: number, g: number, b: number): boolean {
  // 매우 밝은 색상 (흰색 계열)
  if (r > 240 && g > 240 && b > 240) return true;

  // 매우 어두운 색상 (검정 계열)
  if (r < 20 && g < 20 && b < 20) return true;

  return false;
}

/**
 * 픽셀 위치가 중앙 영역인지 판단
 */
function isCenterRegion(
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const centerX = width / 2;
  const centerY = height / 2;
  const regionSize = Math.min(width, height) * 0.4; // 중앙 40%

  return (
    Math.abs(x - centerX) < regionSize / 2 &&
    Math.abs(y - centerY) < regionSize / 2
  );
}

/**
 * 이미지에서 대표 색상 추출 (히스토그램 방식)
 */
export async function extractDominantColor(
  imageFile: File,
  options: ColorExtractionOptions = {}
): Promise<ColorExtractionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        try {
          // Canvas 생성 및 이미지 리사이징
          const canvas = document.createElement('canvas');
          const size = opts.sampleSize;
          canvas.width = size;
          canvas.height = size;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context를 가져올 수 없습니다.'));
            return;
          }

          // 고품질 리샘플링
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, size, size);

          // 픽셀 데이터 추출
          const imageData = ctx.getImageData(0, 0, size, size);
          const pixels = imageData.data;

          // RGB 빈도 맵 (key: "r,g,b", value: 빈도수)
          const colorFrequency = new Map<string, number>();
          let totalPixels = 0;

          // 픽셀 순회하며 색상 빈도 계산
          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const a = pixels[i + 3];

            // 투명한 픽셀 제외
            if (a < 128) continue;

            // 배경색 제외 옵션
            if (opts.excludeBackground && isBackgroundColor(r, g, b)) {
              continue;
            }

            // 색상을 약간 양자화하여 비슷한 색상 그룹화 (8 단계)
            const quantize = (value: number) => Math.round(value / 32) * 32;
            const qR = quantize(r);
            const qG = quantize(g);
            const qB = quantize(b);

            const key = `${qR},${qG},${qB}`;

            // 중앙 영역 가중치 적용
            const pixelIndex = Math.floor(i / 4);
            const x = pixelIndex % size;
            const y = Math.floor(pixelIndex / size);
            const weight = isCenterRegion(x, y, size, size)
              ? opts.centerWeight
              : 1;

            colorFrequency.set(key, (colorFrequency.get(key) || 0) + weight);
            totalPixels += weight;
          }

          // 빈도가 가장 높은 색상 찾기
          let maxFrequency = 0;
          let dominantColor: [number, number, number] = [128, 128, 128];

          colorFrequency.forEach((frequency, key) => {
            if (frequency > maxFrequency) {
              maxFrequency = frequency;
              const [r, g, b] = key.split(',').map(Number);
              dominantColor = [r, g, b];
            }
          });

          // 신뢰도 계산 (가장 많은 색상의 비율)
          const confidence = totalPixels > 0 ? maxFrequency / totalPixels : 0;

          const hexCode = rgbToHex(...dominantColor);

          resolve({
            hexCode,
            rgb: dominantColor,
            confidence,
          });
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('이미지를 로드할 수 없습니다.'));
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('파일을 읽을 수 없습니다.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('파일 읽기 중 오류가 발생했습니다.'));
    };

    reader.readAsDataURL(imageFile);
  });
}

/**
 * 여러 이미지에서 대표 색상 추출 (평균 또는 가장 신뢰도 높은 색상)
 */
export async function extractColorFromImages(
  images: File[],
  options?: ColorExtractionOptions
): Promise<ColorExtractionResult> {
  if (images.length === 0) {
    throw new Error('이미지가 제공되지 않았습니다.');
  }

  // 모든 이미지에서 색상 추출
  const results = await Promise.all(
    images.map(img => extractDominantColor(img, options))
  );

  // 가장 신뢰도가 높은 결과 선택
  const bestResult = results.reduce((best, current) => {
    return current.confidence > best.confidence ? current : best;
  });

  // 여러 이미지의 색상이 유사한지 확인
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

  // 색상 일관성 체크 (모든 색상이 bestResult와 유사한지)
  const similarities = results.map(r =>
    calculateColorSimilarity(r.rgb, bestResult.rgb)
  );
  const avgSimilarity = similarities.reduce((sum, s) => sum + s, 0) / similarities.length;

  // 일관성이 낮으면 경고 (콘솔에만 출력, 신뢰도는 평균값 사용)
  if (avgSimilarity < 0.7) {
    console.warn(
      '[colorExtractor] 이미지들의 색상 편차가 큽니다. ' +
      `평균 유사도: ${(avgSimilarity * 100).toFixed(1)}%`
    );
  }

  return {
    ...bestResult,
    confidence: avgConfidence, // 평균 신뢰도 사용
  };
}

/**
 * 추출된 색상을 프리셋과 매칭
 */
export function matchColorPreset(
  hexCode: string,
  presets: Array<{ name: string; hex: string }>
): { name: string; similarity: number } | null {
  // HEX를 RGB로 변환
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [0, 0, 0];
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
    ];
  };

  const targetRgb = hexToRgb(hexCode);
  let bestMatch: { name: string; similarity: number } | null = null;

  // 각 프리셋과 유사도 계산
  presets.forEach(preset => {
    const presetRgb = hexToRgb(preset.hex);
    const similarity = calculateColorSimilarity(targetRgb, presetRgb);

    if (!bestMatch || similarity > bestMatch.similarity) {
      bestMatch = {
        name: preset.name,
        similarity,
      };
    }
  });

  // 유사도가 85% 이상일 때만 매칭으로 간주
  if (bestMatch && bestMatch.similarity >= 0.85) {
    return bestMatch;
  }

  return null;
}
