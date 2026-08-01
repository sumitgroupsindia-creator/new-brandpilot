import { DynamicFieldDefinition, DynamicFrameFieldValues, FrameTemplateLayer } from '../types/frameFields';

interface ExportFrameInputsAsImageParams {
  filename: string;
  frameTitle: string;
  backgroundUrl?: string | null;
  thumbnailUrl?: string | null;
  templateLayers?: FrameTemplateLayer[];
  renderSize?: { width: number; height: number };
  fields: DynamicFieldDefinition[];
  values: DynamicFrameFieldValues;
}

interface LayerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RenderLayerOptions {
  useBackgroundBase: boolean;
  skipTemplateBackgroundImage?: boolean;
  skipFullCanvasStaticImageLayers?: boolean;
  removeOpaqueFullCanvasLayers?: boolean;
  forceSkipBackgroundTokenLayers?: boolean;
  canvasWidth?: number;
  canvasHeight?: number;
  cleanNeutralOverlayFrame?: boolean;
  templateBackgroundReference?: HTMLImageElement | null;
  replaceBackgroundWithImage?: boolean;
  frameTitle?: string;
}

interface FieldStyleOverride {
  color?: string;
  fontSize?: number;
  padding?: number;
  lineHeight?: number;
  fontWeight?: string;
}

interface RenderMetrics {
  staticImageLayersDrawn: number;
  dynamicImageLayersDrawn: number;
  textLayersDrawn: number;
  rectLayersDrawn: number;
  skippedBecauseUseBackgroundBase: number;
  skippedTemplateBackground: number;
  skippedFullCanvasStatic: number;
  skippedOpaqueFullCanvas: number;
  skippedMissingSource: number;
  skippedDuplicateDynamicImage: number;
  imageLoadFailures: number;
}

interface CropWindow {
  x: number;
  y: number;
  width: number;
  height: number;
}

type RenderMode = 'full-template' | 'thumbnail-fallback' | 'dynamic-only' | 'blank';

type ImageLayerSkipReason =
  | 'use-background-base'
  | 'template-background-skip'
  | 'full-canvas-static-skip'
  | 'opaque-full-canvas-skip'
  | 'missing-source'
  | 'duplicate-dynamic-image'
  | 'load-failed';

interface RenderDebugInfo {
  strictFrame2Mode: boolean;
  hasTemplateLayers: boolean;
  backgroundDrawn: boolean;
  usedThumbnailFallback: boolean;
  renderMode: RenderMode;
  metrics: RenderMetrics | null;
  backgroundSizing: {
    sourceWidth: number;
    sourceHeight: number;
    canvasWidth: number;
    canvasHeight: number;
    drawX: number;
    drawY: number;
    drawWidth: number;
    drawHeight: number;
    mode: 'cover' | 'fill';
  } | null;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const loadFromObjectUrl = async () => {
      try {
        const response = await fetch(src, { method: 'GET' });
        if (!response.ok) {
          throw new Error('Image fetch failed');
        }
        const blob = await response.blob();
        if (!blob || blob.size === 0) {
          throw new Error('Empty image blob');
        }

        const objectUrl = URL.createObjectURL(blob);
        const blobImage = new Image();
        blobImage.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(blobImage);
        };
        blobImage.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Image load failed'));
        };
        blobImage.src = objectUrl;
      } catch (error) {
        if (isRemoteHttp) {
          reject(new Error('Remote image blocked by CORS. Please use an upload or CORS-enabled image URL.'));
          return;
        }
        reject(error instanceof Error ? error : new Error('Image load failed'));
      }
    };

    const img = new Image();
    const isRemoteHttp = /^https?:\/\//i.test(src);

    // Remote images must be fetched in CORS mode to keep canvas exportable.
    if (isRemoteHttp) {
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
    }

    img.onload = () => resolve(img);
    img.onerror = () => {
      void loadFromObjectUrl();
    };
    img.src = src;
  });
}

function toTextAlign(justification?: string): 'left' | 'center' | 'right' {
  const value = (justification ?? '').toLowerCase();
  if (value.includes('center')) return 'center';
  if (value.includes('right')) return 'right';
  return 'left';
}

function toFontWeight(font?: string) {
  const value = (font ?? '').toLowerCase();
  if (value.includes('thin')) return '200';
  if (value.includes('light')) return '300';
  if (value.includes('medium')) return '500';
  if (value.includes('semi') || value.includes('demi')) return '600';
  if (value.includes('bold')) return '700';
  if (value.includes('black') || value.includes('heavy')) return '800';
  return '600';
}

function toFontFamily(font?: string) {
  const raw = (font ?? '').trim();
  if (!raw) {
    return '"Space Grotesk", sans-serif';
  }

  const cleaned = raw
    .replace(/[-_]+/g, ' ')
    .replace(/\b(thin|light|regular|medium|semibold|semi bold|demi|bold|black|heavy|italic)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned ? `"${cleaned}", "Space Grotesk", sans-serif` : '"Space Grotesk", sans-serif';
}

function normalizeCssColor(color?: string) {
  if (!color) {
    return color;
  }

  const trimmed = color.trim();
  const hexMatch = trimmed.match(/^0x([0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hexMatch) {
    const raw = hexMatch[1] ?? '';
    if (raw.length === 8) {
      return `#${raw.slice(2)}`;
    }
    return `#${raw}`;
  }

  return trimmed;
}

function applyTextFont(
  ctx: CanvasRenderingContext2D,
  fontSize: number,
  fontFamily: string,
  fontWeight: string,
) {
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: 'left' | 'center' | 'right',
) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return lineHeight;
  }

  let line = '';
  let cursorY = y;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';

  const drawX = align === 'center' ? x + maxWidth / 2 : align === 'right' ? x + maxWidth : x;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const width = ctx.measureText(testLine).width;

    if (width > maxWidth && line) {
      ctx.fillText(line, drawX, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) {
    ctx.fillText(line, drawX, cursorY);
  }

  return cursorY - y + lineHeight;
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  baseFontSize: number,
  fontFamily: string,
  fontWeight: string,
) {
  const minFontSize = 10;
  let nextFontSize = Math.max(minFontSize, baseFontSize);

  while (nextFontSize > minFontSize) {
    applyTextFont(ctx, nextFontSize, fontFamily, fontWeight);
    const lines = text.split('\n').flatMap((part) => {
      const words = part.split(/\s+/).filter(Boolean);
      if (words.length === 0) return [''];

      const wrapped: string[] = [];
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          wrapped.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) wrapped.push(line);
      return wrapped;
    });

    const lineHeight = Math.round(nextFontSize * 1.15);
    const height = lines.length * lineHeight;
    const overWide = lines.some(line => ctx.measureText(line).width > maxWidth);
    if (!overWide && height <= maxHeight) {
      return { fontSize: nextFontSize, lineHeight };
    }

    nextFontSize -= 1;
  }

  return { fontSize: minFontSize, lineHeight: Math.round(minFontSize * 1.15) };
}

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const ratio = Math.min(width / img.width, height / img.height);
  const drawW = img.width * ratio;
  const drawH = img.height * ratio;
  const drawX = x + (width - drawW) / 2;
  const drawY = y + (height - drawH) / 2;
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const drawX = x;
  const drawY = y;
  const drawW = width;
  const drawH = height;
  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  return {
    sourceWidth: img.width,
    sourceHeight: img.height,
    canvasWidth: width,
    canvasHeight: height,
    drawX,
    drawY,
    drawWidth: drawW,
    drawHeight: drawH,
    mode: 'fill' as const,
  };
}

function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function sampleTextColorFromSlot(ctx: CanvasRenderingContext2D, field: DynamicFieldDefinition) {
  const x = Math.max(0, Math.floor(field.x ?? 0));
  const y = Math.max(0, Math.floor(field.y ?? 0));
  const width = Math.max(1, Math.floor(field.width ?? 240));
  const height = Math.max(1, Math.floor(field.height ?? 80));

  try {
    const area = ctx.getImageData(x, y, width, height);
    const data = area.data;

    let br = 0;
    let bg = 0;
    let bb = 0;
    let borderCount = 0;

    for (let py = 0; py < height; py += 1) {
      for (let px = 0; px < width; px += 1) {
        const border = py <= 1 || px <= 1 || py >= height - 2 || px >= width - 2;
        if (!border) {
          continue;
        }
        const idx = (py * width + px) * 4;
        br += data[idx] ?? 0;
        bg += data[idx + 1] ?? 0;
        bb += data[idx + 2] ?? 0;
        borderCount += 1;
      }
    }

    if (borderCount === 0) {
      return field.color || '#ffffff';
    }

    const baseR = br / borderCount;
    const baseG = bg / borderCount;
    const baseB = bb / borderCount;

    let tr = 0;
    let tg = 0;
    let tb = 0;
    let textCount = 0;

    for (let py = 2; py < height - 2; py += 1) {
      for (let px = 2; px < width - 2; px += 1) {
        const idx = (py * width + px) * 4;
        const pr = data[idx] ?? 0;
        const pg = data[idx + 1] ?? 0;
        const pb = data[idx + 2] ?? 0;
        const dist = colorDistance(pr, pg, pb, baseR, baseG, baseB);
        if (dist < 32) {
          continue;
        }

        tr += pr;
        tg += pg;
        tb += pb;
        textCount += 1;
      }
    }

    if (textCount < 12) {
      return field.color || '#ffffff';
    }

    const rr = Math.round(tr / textCount);
    const rg = Math.round(tg / textCount);
    const rb = Math.round(tb / textCount);
    return `rgb(${rr}, ${rg}, ${rb})`;
  } catch {
    return field.color || '#ffffff';
  }
}

function normalizeKeyLike(value: string | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getFrameSpecificFieldOverride(
  frameTitle: string,
  field: DynamicFieldDefinition,
): FieldStyleOverride | null {
  const title = frameTitle.toLowerCase();
  if (!title.includes('ls 1 landscape frame')) {
    return null;
  }

  const key = normalizeKeyLike(field.key);
  const label = normalizeKeyLike(field.label);
  const token = `${key} ${label}`;

  if (token.includes('name') || token.includes('brand')) {
    return { color: '#ffffff', fontSize: 54, padding: 10, lineHeight: 60, fontWeight: '700' };
  }

  if (token.includes('mobile') || token.includes('phone') || token.includes('contact') || token.includes('tel')) {
    return { color: '#ffffff', fontSize: 36, padding: 10, lineHeight: 42, fontWeight: '600' };
  }

  if (token.includes('website') || token.includes('web') || token.includes('url') || token.includes('site')) {
    return { color: '#ffffff', fontSize: 34, padding: 10, lineHeight: 40, fontWeight: '600' };
  }

  if (token.includes('email') || token.includes('mail')) {
    return { color: '#ffffff', fontSize: 34, padding: 10, lineHeight: 40, fontWeight: '600' };
  }

  if (token.includes('address') || token.includes('location')) {
    return { color: '#2f3642', fontSize: 34, padding: 10, lineHeight: 40, fontWeight: '600' };
  }

  return null;
}

function eraseTemplateTextWithFieldStyle(
  ctx: CanvasRenderingContext2D,
  field: DynamicFieldDefinition,
) {
  const defaultText = (field.defaultValue ?? '').trim();
  if (!defaultText) {
    return;
  }

  const x = field.x ?? 0;
  const y = field.y ?? 0;
  const width = field.width ?? 240;
  const height = field.height ?? 80;
  const padding = 2;
  const textWidth = Math.max(20, width - padding * 2);
  const textHeight = Math.max(20, height - padding * 2);

  const align = toTextAlign(field.justification);
  const requestedSize = Math.max(10, field.fontSize ?? 28);
  const fontFamily = toFontFamily(field.font);
  const fontWeight = toFontWeight(field.font);
  const lineHeight = field.lineHeight ?? Math.round(requestedSize * 1.15);
  const expand = Math.max(0.75, requestedSize * 0.05);

  ctx.save();
  applyTextFont(ctx, requestedSize, fontFamily, fontWeight);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.beginPath();
  ctx.rect(x + padding, y + padding, textWidth, textHeight);
  ctx.clip();
  drawWrappedText(ctx, defaultText, x + padding, y + padding, textWidth, lineHeight, align);
  drawWrappedText(ctx, defaultText, x + padding - expand, y + padding, textWidth, lineHeight, align);
  drawWrappedText(ctx, defaultText, x + padding + expand, y + padding, textWidth, lineHeight, align);
  drawWrappedText(ctx, defaultText, x + padding, y + padding - expand, textWidth, lineHeight, align);
  drawWrappedText(ctx, defaultText, x + padding, y + padding + expand, textWidth, lineHeight, align);
  ctx.restore();
}

function overlapBySmallerArea(a: DynamicFieldDefinition, b: DynamicFieldDefinition) {
  const ab = getFieldBounds(a);
  const bb = getFieldBounds(b);
  const left = Math.max(ab.x, bb.x);
  const top = Math.max(ab.y, bb.y);
  const right = Math.min(ab.x + ab.width, bb.x + bb.width);
  const bottom = Math.min(ab.y + ab.height, bb.y + bb.height);
  if (right <= left || bottom <= top) {
    return 0;
  }
  const intersection = (right - left) * (bottom - top);
  const minArea = Math.min(ab.width * ab.height, bb.width * bb.height);
  return minArea > 0 ? intersection / minArea : 0;
}

function dedupeTextFields(fields: DynamicFieldDefinition[]) {
  const textFields = fields.filter(field => field.type !== 'image');
  const semanticGroups = new Map<string, DynamicFieldDefinition[]>();
  const remaining: DynamicFieldDefinition[] = [];

  const classifyField = (field: DynamicFieldDefinition) => {
    const token = normalizeKeyLike(`${field.key} ${field.label}`);
    if (/email|mail/.test(token)) return 'email';
    if (/mobile|phone|contact|tel/.test(token)) return 'mobile';
    if (/website|web|site|url|link/.test(token)) return 'website';
    if (/address|location|city/.test(token)) return 'address';
    if (/name|brand|company/.test(token)) return 'name';
    return null;
  };

  for (const field of textFields) {
    const semantic = classifyField(field);
    if (!semantic) {
      remaining.push(field);
      continue;
    }

    const list = semanticGroups.get(semantic) ?? [];
    list.push(field);
    semanticGroups.set(semantic, list);
  }

  const groups: DynamicFieldDefinition[][] = [];

  for (const field of remaining) {
    let merged = false;
    for (const group of groups) {
      const overlaps = group.some(item => overlapBySmallerArea(item, field) >= 0.84);
      if (overlaps) {
        group.push(field);
        merged = true;
        break;
      }
    }
    if (!merged) {
      groups.push([field]);
    }
  }

  for (const semanticFields of semanticGroups.values()) {
    groups.push(semanticFields);
  }

  return groups.map(group => {
    const primary = [...group].sort((a, b) => {
      const areaA = (a.width ?? 240) * (a.height ?? 80);
      const areaB = (b.width ?? 240) * (b.height ?? 80);
      return areaB - areaA;
    })[0] ?? group[0];

    return {
      fields: group,
      primary,
    };
  });
}

function renderDynamicFieldsOnBackground(
  ctx: CanvasRenderingContext2D,
  params: ExportFrameInputsAsImageParams,
) {
  const groups = dedupeTextFields(params.fields);

  for (const group of groups) {
    const value = group.fields
      .map(field => (params.values.text[field.key] ?? '').trim())
      .find(text => text.length > 0);

    if (!value) {
      continue;
    }

    for (const field of group.fields) {
      eraseTemplateTextWithFieldStyle(ctx, field);
    }

    const field = group.primary;
    const override = getFrameSpecificFieldOverride(params.frameTitle, field);
    const x = field.x ?? 0;
    const y = field.y ?? 0;
    const width = field.width ?? 240;
    const height = field.height ?? 80;
    const padding = Math.max(1, override?.padding ?? 2);
    const maxWidth = Math.max(20, width - padding * 2);
    const maxHeight = Math.max(20, height - padding * 2);

    const requestedSize = Math.max(10, override?.fontSize ?? field.fontSize ?? 28);
    const fontFamily = toFontFamily(field.font);
    const fontWeight = override?.fontWeight ?? toFontWeight(field.font);
    const align = toTextAlign(field.justification);

    const fitted = fitFontSize(
      ctx,
      value,
      maxWidth,
      maxHeight,
      requestedSize,
      fontFamily,
      fontWeight,
    );

    applyTextFont(ctx, fitted.fontSize, fontFamily, fontWeight);
    const sampledColor = sampleTextColorFromSlot(ctx, field);
    ctx.fillStyle = override?.color ?? sampledColor;

    const baseLineHeight = override?.lineHeight ?? field.lineHeight;
    const lineHeight = baseLineHeight
      ? Math.max(10, Math.round(baseLineHeight * (fitted.fontSize / requestedSize)))
      : fitted.lineHeight;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x + padding, y + padding, maxWidth, maxHeight);
    ctx.clip();
    drawWrappedText(ctx, value, x + padding, y + padding, maxWidth, lineHeight, align);
    ctx.restore();
  }
}

async function renderDynamicImagesOnBackground(
  ctx: CanvasRenderingContext2D,
  params: ExportFrameInputsAsImageParams,
) {
  for (const field of params.fields) {
    if (field.type !== 'image') {
      continue;
    }

    const src = params.values.imageDataUrl[field.key] ?? params.values.imagePreviewUrl[field.key];
    if (!src) {
      continue;
    }

    const x = field.x ?? 0;
    const y = field.y ?? 0;
    const width = field.width ?? 240;
    const height = field.height ?? 80;
    if (width <= 0 || height <= 0) {
      continue;
    }

    try {
      const image = await loadImage(src);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.clip();
      drawImageContain(ctx, image, x, y, width, height);
      ctx.restore();
    } catch {
      // Ignore failed user images.
    }
  }
}

function normalizeToken(value: string | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeFrameTitle(value: string | undefined) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getFrameCropWindowOverride(
  frameTitle: string | undefined,
  canvasWidth: number,
  canvasHeight: number,
): CropWindow | null {
  const title = normalizeFrameTitle(frameTitle);

  // Frame2/Fream2 templates contain a full-canvas matte layer; open this exact window for user image.
  if (title === 'frame2' || title === 'fream2') {
    return {
      x: Math.floor(canvasWidth * 0.03),
      y: Math.floor(canvasHeight * 0.13),
      width: Math.floor(canvasWidth * 0.81),
      height: Math.floor(canvasHeight * 0.72),
    };
  }

  return null;
}

function isStrictFrame2Like(frameTitle: string | undefined) {
  const title = normalizeFrameTitle(frameTitle);
  return title === 'frame2' || title === 'fream2';
}

function getFieldBounds(field: DynamicFieldDefinition): LayerBounds {
  return {
    x: field.x ?? 0,
    y: field.y ?? 0,
    width: field.width ?? 240,
    height: field.height ?? 80,
  };
}

function getLayerBounds(layer: FrameTemplateLayer): LayerBounds {
  return {
    x: layer.x ?? 0,
    y: layer.y ?? 0,
    width: layer.width ?? 0,
    height: layer.height ?? 0,
  };
}

function overlapRatio(a: LayerBounds, b: LayerBounds) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  if (right <= left || bottom <= top) {
    return 0;
  }

  const intersection = (right - left) * (bottom - top);
  const minArea = Math.min(a.width * a.height, b.width * b.height);
  return minArea > 0 ? intersection / minArea : 0;
}

function iouRatio(a: LayerBounds, b: LayerBounds) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  if (right <= left || bottom <= top) {
    return 0;
  }

  const intersection = (right - left) * (bottom - top);
  const areaA = Math.max(1, a.width * a.height);
  const areaB = Math.max(1, b.width * b.height);
  const union = areaA + areaB - intersection;
  return union > 0 ? intersection / union : 0;
}

function sizeSimilarity(a: LayerBounds, b: LayerBounds) {
  const widthRatio = Math.min(a.width, b.width) / Math.max(1, Math.max(a.width, b.width));
  const heightRatio = Math.min(a.height, b.height) / Math.max(1, Math.max(a.height, b.height));
  return widthRatio * heightRatio;
}

function centerDistanceScore(a: LayerBounds, b: LayerBounds) {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  const dx = ax - bx;
  const dy = ay - by;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const diag = Math.sqrt(Math.max(1, a.width * a.width + a.height * a.height));
  return Math.max(0, 1 - distance / Math.max(1, diag));
}

function findBestFieldForLayer(
  layer: FrameTemplateLayer,
  fields: DynamicFieldDefinition[],
  type: 'image' | 'text',
): DynamicFieldDefinition | null {
  const candidates = fields.filter(field => {
    const isTextField = field.type !== 'image';
    return type === 'image' ? !isTextField : isTextField;
  });

  if (candidates.length === 0) {
    return null;
  }

  const layerName = normalizeToken(layer.name);
  const layerBounds = getLayerBounds(layer);

  let bestField: DynamicFieldDefinition | null = null;
  let bestScore = -1;

  for (const field of candidates) {
    const fieldName = normalizeToken(`${field.key} ${field.label}`);
    const keyHit = fieldName.length > 0 && layerName.length > 0 && (
      layerName.includes(fieldName) || fieldName.includes(layerName)
    );

    const fieldBounds = getFieldBounds(field);
    const overlap = overlapRatio(layerBounds, fieldBounds);
    const iou = iouRatio(layerBounds, fieldBounds);
    const sizeMatch = sizeSimilarity(layerBounds, fieldBounds);
    const centerScore = centerDistanceScore(layerBounds, fieldBounds);

    const score = type === 'image'
      ? (keyHit ? 3 : 0) + overlap * 0.4 + iou * 1.8 + sizeMatch * 1.6 + centerScore * 0.8
      : (keyHit ? 2 : 0) + overlap;

    if (type === 'image') {
      // Prevent mapping tiny logo slots onto full-page background layers.
      const validImageMatch = keyHit || (iou >= 0.5 && sizeMatch >= 0.45 && centerScore >= 0.55);
      if (!validImageMatch) {
        continue;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestField = field;
    }
  }

  if (type === 'image') {
    return bestScore >= 1.25 ? bestField : null;
  }

  return bestScore >= 0.72 ? bestField : null;
}

function applyLayerOpacity(ctx: CanvasRenderingContext2D, opacity?: number) {
  if (typeof opacity === 'number' && Number.isFinite(opacity)) {
    const normalized = opacity > 1 ? opacity / 100 : opacity;
    ctx.globalAlpha = Math.max(0, Math.min(1, normalized));
  } else {
    ctx.globalAlpha = 1;
  }
}

function isLikelyBackgroundLayer(
  layer: FrameTemplateLayer,
  canvasWidth?: number,
  canvasHeight?: number,
) {
  const name = (layer.name ?? '').toLowerCase();
  const src = (layer.src ?? '').toLowerCase();
  const hasBgToken = /(^|[_\-\s])(bg|background)([_\-\s]|$)/.test(name) || /\bbg\b|background/.test(src);

  const layerW = layer.width ?? 0;
  const layerH = layer.height ?? 0;
  const x = Math.abs(layer.x ?? 0);
  const y = Math.abs(layer.y ?? 0);

  if (!canvasWidth || !canvasHeight) {
    return hasBgToken;
  }

  const coversCanvas =
    layerW >= canvasWidth * 0.88
    && layerH >= canvasHeight * 0.88
    && x <= canvasWidth * 0.12
    && y <= canvasHeight * 0.12;

  return hasBgToken && coversCanvas;
}

function hasBackgroundToken(layer: FrameTemplateLayer) {
  const name = (layer.name ?? '').toLowerCase();
  const src = (layer.src ?? '').toLowerCase();
  return /(^|[_\-\s])(bg|background)([_\-\s]|$)/.test(name) || /\bbg\b|background/.test(src);
}

function isLikelyFullCanvasFrameOverlay(
  layer: FrameTemplateLayer,
  canvasWidth?: number,
  canvasHeight?: number,
) {
  if (!canvasWidth || !canvasHeight) {
    return false;
  }

  const name = (layer.name ?? '').toLowerCase();
  const src = (layer.src ?? '').toLowerCase();
  const layerW = layer.width ?? 0;
  const layerH = layer.height ?? 0;
  const x = Math.abs(layer.x ?? 0);
  const y = Math.abs(layer.y ?? 0);
  const coversCanvas =
    layerW >= canvasWidth * 0.88
    && layerH >= canvasHeight * 0.88
    && x <= canvasWidth * 0.12
    && y <= canvasHeight * 0.12;

  const overlayToken = /frame|overlay|layer/.test(name) || /frame|overlay|layer/.test(src);
  return coversCanvas && overlayToken;
}

function isNearFullCanvasLayer(
  layer: FrameTemplateLayer,
  canvasWidth?: number,
  canvasHeight?: number,
) {
  if (!canvasWidth || !canvasHeight) {
    return false;
  }

  const layerW = layer.width ?? 0;
  const layerH = layer.height ?? 0;
  const x = Math.abs(layer.x ?? 0);
  const y = Math.abs(layer.y ?? 0);

  return (
    layerW >= canvasWidth * 0.88
    && layerH >= canvasHeight * 0.88
    && x <= canvasWidth * 0.12
    && y <= canvasHeight * 0.12
  );
}

function isLikelyFullCanvasBackgroundLayer(
  layer: FrameTemplateLayer,
  canvasWidth?: number,
  canvasHeight?: number,
) {
  if (!canvasWidth || !canvasHeight) {
    return false;
  }

  const name = (layer.name ?? '').toLowerCase();
  const src = (layer.src ?? '').toLowerCase();
  const layerW = layer.width ?? 0;
  const layerH = layer.height ?? 0;
  const x = Math.abs(layer.x ?? 0);
  const y = Math.abs(layer.y ?? 0);
  const coversCanvas =
    layerW >= canvasWidth * 0.88
    && layerH >= canvasHeight * 0.88
    && x <= canvasWidth * 0.12
    && y <= canvasHeight * 0.12;

  const bgToken = /(^|[_\-\s])(bg|background)([_\-\s]|$)/.test(name) || /\bbg\b|background/.test(src);
  return coversCanvas && bgToken;
}

function keepPerimeterFrameOnly(data: Uint8ClampedArray, width: number, height: number) {
  const topBand = Math.floor(height * 0.15);
  const bottomBand = Math.floor(height * 0.24);
  const rightBand = Math.floor(width * 0.2);
  const leftLogoBand = Math.floor(width * 0.2);
  const leftLogoHeight = Math.floor(height * 0.24);

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    const keepTop = y < topBand;
    const keepBottom = y >= height - bottomBand;
    const keepRight = x >= width - rightBand;
    const keepLogoCorner = x < leftLogoBand && y < leftLogoHeight;
    const keep = keepTop || keepBottom || keepRight || keepLogoCorner;

    if (!keep) {
      data[i + 3] = 0;
    }
  }
}

function drawOverlayByDiffAgainstReference(
  ctx: CanvasRenderingContext2D,
  overlay: HTMLImageElement,
  reference: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  replaceBackgroundWithImage = false,
) {
  const ow = Math.max(1, Math.floor(width));
  const oh = Math.max(1, Math.floor(height));

  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = ow;
  overlayCanvas.height = oh;
  const overlayCtx = overlayCanvas.getContext('2d');

  const referenceCanvas = document.createElement('canvas');
  referenceCanvas.width = ow;
  referenceCanvas.height = oh;
  const referenceCtx = referenceCanvas.getContext('2d');

  if (!overlayCtx || !referenceCtx) {
    ctx.drawImage(overlay, x, y, width, height);
    return;
  }

  overlayCtx.clearRect(0, 0, ow, oh);
  referenceCtx.clearRect(0, 0, ow, oh);
  overlayCtx.drawImage(overlay, 0, 0, ow, oh);
  referenceCtx.drawImage(reference, 0, 0, ow, oh);

  try {
    const overlayData = overlayCtx.getImageData(0, 0, ow, oh);
    const referenceData = referenceCtx.getImageData(0, 0, ow, oh);
    const o = overlayData.data;
    const r = referenceData.data;
    const lowerBandStart = Math.floor(oh * 0.82);

    for (let i = 0; i < o.length; i += 4) {
      const oa = o[i + 3] ?? 255;
      if (oa === 0) {
        continue;
      }

      const or = o[i] ?? 0;
      const og = o[i + 1] ?? 0;
      const ob = o[i + 2] ?? 0;

      const rr = r[i] ?? 0;
      const rg = r[i + 1] ?? 0;
      const rb = r[i + 2] ?? 0;
      const ra = r[i + 3] ?? 255;

      const pixelIndex = i / 4;
      const py = Math.floor(pixelIndex / ow);

      const dr = or - rr;
      const dg = og - rg;
      const db = ob - rb;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      const alphaDiff = Math.abs(oa - ra);
      const max = Math.max(or, og, ob);
      const min = Math.min(or, og, ob);
      const chroma = max - min;
      const luma = 0.2126 * or + 0.7152 * og + 0.0722 * ob;
      const isNeutralMatte = chroma < 24 && luma >= 145 && luma <= 245;

      // Keep bottom strip elements intact even if similar to bg.
      if (py >= lowerBandStart) {
        continue;
      }

      // If overlay pixel is effectively same as bg pixel, it is matte/watermark area.
      if ((dist <= 52 && alphaDiff <= 120) || isNeutralMatte) {
        o[i + 3] = 0;
      }
    }

    if (replaceBackgroundWithImage) {
      keepPerimeterFrameOnly(overlayData.data, ow, oh);
    }

    overlayCtx.putImageData(overlayData, 0, 0);
    ctx.drawImage(overlayCanvas, x, y, width, height);
  } catch {
    ctx.drawImage(overlay, x, y, width, height);
  }
}

function drawOverlayWithNeutralCutout(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  replaceBackgroundWithImage = false,
) {
  const scratch = document.createElement('canvas');
  scratch.width = Math.max(1, Math.floor(width));
  scratch.height = Math.max(1, Math.floor(height));
  const scratchCtx = scratch.getContext('2d');
  if (!scratchCtx) {
    ctx.drawImage(image, x, y, width, height);
    return;
  }

  scratchCtx.clearRect(0, 0, scratch.width, scratch.height);
  scratchCtx.drawImage(image, 0, 0, scratch.width, scratch.height);

  try {
    const imageData = scratchCtx.getImageData(0, 0, scratch.width, scratch.height);
    const data = imageData.data;
    const lowerBandStart = Math.floor(scratch.height * 0.82);

    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4;
      const py = Math.floor(pixelIndex / scratch.width);

      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 255;
      if (a === 0) {
        continue;
      }

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const chroma = max - min;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const isNeutral = chroma < 18;

      // Preserve bottom band where frame footer bars/text usually live.
      if (py >= lowerBandStart) {
        continue;
      }

      // Remove neutral matte/watermark pixels to reveal selected photo under overlay.
      if (isNeutral && luma >= 140 && luma <= 245) {
        data[i + 3] = 0;
      }
    }

    if (replaceBackgroundWithImage) {
      keepPerimeterFrameOnly(imageData.data, scratch.width, scratch.height);
    }

    scratchCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(scratch, x, y, width, height);
  } catch {
    ctx.drawImage(image, x, y, width, height);
  }
}

function drawPerimeterOnlyOverlay(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scratch = document.createElement('canvas');
  scratch.width = Math.max(1, Math.floor(width));
  scratch.height = Math.max(1, Math.floor(height));
  const scratchCtx = scratch.getContext('2d');
  if (!scratchCtx) {
    ctx.drawImage(image, x, y, width, height);
    return;
  }

  scratchCtx.clearRect(0, 0, scratch.width, scratch.height);
  scratchCtx.drawImage(image, 0, 0, scratch.width, scratch.height);

  try {
    const imageData = scratchCtx.getImageData(0, 0, scratch.width, scratch.height);
    keepPerimeterFrameOnly(imageData.data, scratch.width, scratch.height);
    scratchCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(scratch, x, y, width, height);
  } catch {
    ctx.drawImage(image, x, y, width, height);
  }
}

function isMostlyOpaqueImage(image: HTMLImageElement) {
  const sampleWidth = 96;
  const sampleHeight = 96;
  const scratch = document.createElement('canvas');
  scratch.width = sampleWidth;
  scratch.height = sampleHeight;
  const sctx = scratch.getContext('2d');
  if (!sctx) {
    return false;
  }

  sctx.clearRect(0, 0, sampleWidth, sampleHeight);
  sctx.drawImage(image, 0, 0, sampleWidth, sampleHeight);

  try {
    const data = sctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
    let opaqueCount = 0;
    let transparentCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] ?? 255;
      if (a >= 245) {
        opaqueCount += 1;
      } else if (a <= 10) {
        transparentCount += 1;
      }
    }

    const total = Math.max(1, sampleWidth * sampleHeight);
    const opaqueRatio = opaqueCount / total;
    const transparentRatio = transparentCount / total;
    return opaqueRatio >= 0.97 && transparentRatio <= 0.005;
  } catch {
    return false;
  }
}

function drawOverlayWithCropWindow(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  cropWindow: CropWindow,
) {
  const scratch = document.createElement('canvas');
  scratch.width = Math.max(1, Math.floor(width));
  scratch.height = Math.max(1, Math.floor(height));
  const scratchCtx = scratch.getContext('2d');
  if (!scratchCtx) {
    ctx.drawImage(image, x, y, width, height);
    return;
  }

  scratchCtx.clearRect(0, 0, scratch.width, scratch.height);
  scratchCtx.drawImage(image, 0, 0, scratch.width, scratch.height);

  try {
    const imageData = scratchCtx.getImageData(0, 0, scratch.width, scratch.height);
    const data = imageData.data;

    const left = Math.max(0, Math.floor(cropWindow.x - x));
    const top = Math.max(0, Math.floor(cropWindow.y - y));
    const right = Math.min(scratch.width, Math.floor(left + cropWindow.width));
    const bottom = Math.min(scratch.height, Math.floor(top + cropWindow.height));

    for (let py = top; py < bottom; py += 1) {
      for (let px = left; px < right; px += 1) {
        const idx = (py * scratch.width + px) * 4;
        data[idx + 3] = 0;
      }
    }

    scratchCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(scratch, x, y, width, height);
  } catch {
    ctx.drawImage(image, x, y, width, height);
  }
}

function repaintSlotFromBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  try {
    const safeX = Math.max(0, Math.floor(x));
    const safeY = Math.max(0, Math.floor(y));
    const safeW = Math.max(1, Math.floor(width));
    const safeH = Math.max(1, Math.floor(height));
    const area = ctx.getImageData(safeX, safeY, safeW, safeH);
    const pixels = area.data;

    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    let count = 0;

    for (let py = 0; py < safeH; py += 1) {
      for (let px = 0; px < safeW; px += 1) {
        const isBorder = py <= 1 || px <= 1 || py >= safeH - 2 || px >= safeW - 2;
        if (!isBorder) {
          continue;
        }
        const idx = (py * safeW + px) * 4;
        r += pixels[idx] ?? 0;
        g += pixels[idx + 1] ?? 0;
        b += pixels[idx + 2] ?? 0;
        a += pixels[idx + 3] ?? 255;
        count += 1;
      }
    }

    if (count === 0) {
      return;
    }

    const avgR = Math.round(r / count);
    const avgG = Math.round(g / count);
    const avgB = Math.round(b / count);
    const avgA = Math.max(0.7, Math.min(1, a / count / 255));

    ctx.save();
    ctx.fillStyle = `rgba(${avgR}, ${avgG}, ${avgB}, ${avgA})`;
    ctx.fillRect(safeX, safeY, safeW, safeH);
    ctx.restore();
  } catch {
    // Ignore if canvas pixel reads are blocked.
  }
}

function renderRectLayer(ctx: CanvasRenderingContext2D, layer: FrameTemplateLayer) {
  const x = layer.x ?? 0;
  const y = layer.y ?? 0;
  const width = layer.width ?? 0;
  const height = layer.height ?? 0;
  if (width <= 0 || height <= 0) {
    return;
  }

  const fill = normalizeCssColor(layer.fill) || normalizeCssColor(layer.color);
  if (!fill) {
    return;
  }

  const radius = Math.max(0, layer.radius ?? 0);
  ctx.fillStyle = fill;

  if (radius <= 0) {
    ctx.fillRect(x, y, width, height);
    return;
  }

  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

async function renderImageLayer(
  ctx: CanvasRenderingContext2D,
  layer: FrameTemplateLayer,
  dynamicField: DynamicFieldDefinition | null,
  values: DynamicFrameFieldValues,
  renderedDynamicImages: Set<string>,
  options: RenderLayerOptions,
): Promise<{ drew: boolean; usedDynamicValue: boolean; skipReason?: ImageLayerSkipReason }> {
  const x = layer.x ?? 0;
  const y = layer.y ?? 0;
  const width = layer.width ?? 0;
  const height = layer.height ?? 0;
  if (width <= 0 || height <= 0) {
    return { drew: false, usedDynamicValue: false, skipReason: 'missing-source' };
  }

  let src = layer.src;
  let dynamicKey: string | null = null;

  if (dynamicField) {
    dynamicKey = dynamicField.key;
    const userImage = values.imageDataUrl[dynamicField.key] ?? values.imagePreviewUrl[dynamicField.key];
    if (userImage) {
      src = userImage;
      if (options.useBackgroundBase) {
        repaintSlotFromBorder(ctx, x, y, width, height);
      }
    } else if (options.useBackgroundBase) {
      // Base thumbnail already contains static layer.
      return { drew: false, usedDynamicValue: false, skipReason: 'use-background-base' };
    }
  } else if (options.useBackgroundBase) {
    // Base thumbnail already contains static layer.
    return { drew: false, usedDynamicValue: false, skipReason: 'use-background-base' };
  }

  if (!dynamicField && options.skipTemplateBackgroundImage && isLikelyBackgroundLayer(layer, options.canvasWidth, options.canvasHeight)) {
    return { drew: false, usedDynamicValue: false, skipReason: 'template-background-skip' };
  }

  if (!dynamicField && options.forceSkipBackgroundTokenLayers && hasBackgroundToken(layer)) {
    return { drew: false, usedDynamicValue: false, skipReason: 'template-background-skip' };
  }

  if (!dynamicField && options.skipFullCanvasStaticImageLayers && isNearFullCanvasLayer(layer, options.canvasWidth, options.canvasHeight)) {
    return { drew: false, usedDynamicValue: false, skipReason: 'full-canvas-static-skip' };
  }

  if (!src) {
    return { drew: false, usedDynamicValue: false, skipReason: 'missing-source' };
  }

  if (dynamicKey && renderedDynamicImages.has(dynamicKey)) {
    return { drew: false, usedDynamicValue: false, skipReason: 'duplicate-dynamic-image' };
  }

  try {
    const image = await loadImage(src);
    if (dynamicKey) {
      const usedDynamicValue = Boolean(values.imageDataUrl[dynamicKey] || values.imagePreviewUrl[dynamicKey]);
      drawImageContain(ctx, image, x, y, width, height);
      renderedDynamicImages.add(dynamicKey);
      return { drew: true, usedDynamicValue };
    } else {
      const isFullCanvasLayer = isNearFullCanvasLayer(layer, options.canvasWidth, options.canvasHeight);
      const isFullCanvasBackground = isLikelyFullCanvasBackgroundLayer(layer, options.canvasWidth, options.canvasHeight);

      if (
        options.removeOpaqueFullCanvasLayers
        && isFullCanvasLayer
        && isMostlyOpaqueImage(image)
      ) {
        return { drew: false, usedDynamicValue: false, skipReason: 'opaque-full-canvas-skip' };
      }

      const cropWindow = isFullCanvasLayer && options.canvasWidth && options.canvasHeight
        ? getFrameCropWindowOverride(options.frameTitle, options.canvasWidth, options.canvasHeight)
        : null;

      if (cropWindow && options.replaceBackgroundWithImage && !isFullCanvasBackground) {
        drawOverlayWithCropWindow(ctx, image, x, y, width, height, cropWindow);
        return { drew: true, usedDynamicValue: false };
      }

      if (options.replaceBackgroundWithImage && isFullCanvasLayer && !isFullCanvasBackground) {
        drawPerimeterOnlyOverlay(ctx, image, x, y, width, height);
        return { drew: true, usedDynamicValue: false };
      }

      if (
        options.cleanNeutralOverlayFrame
        && isLikelyFullCanvasFrameOverlay(layer, options.canvasWidth, options.canvasHeight)
      ) {
        if (options.templateBackgroundReference) {
          drawOverlayByDiffAgainstReference(
            ctx,
            image,
            options.templateBackgroundReference,
            x,
            y,
            width,
            height,
            options.replaceBackgroundWithImage,
          );
        } else {
          drawOverlayWithNeutralCutout(ctx, image, x, y, width, height, options.replaceBackgroundWithImage);
        }
      } else {
        ctx.drawImage(image, x, y, width, height);
      }
      return { drew: true, usedDynamicValue: false };
    }
  } catch {
    // Ignore missing assets so export can continue.
    return { drew: false, usedDynamicValue: false, skipReason: 'load-failed' };
  }
}

function renderTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: FrameTemplateLayer,
  dynamicField: DynamicFieldDefinition | null,
  values: DynamicFrameFieldValues,
  renderedDynamicText: Set<string>,
  options: RenderLayerOptions,
) {
  const x = layer.x ?? 0;
  const y = layer.y ?? 0;
  const width = Math.max(0, layer.width ?? 0);
  const height = Math.max(0, layer.height ?? 0);

  const textFromLayer = typeof layer.text === 'string' ? layer.text : '';
  const dynamicValue = dynamicField ? (values.text[dynamicField.key] ?? '').trim() : '';

  let textToRender = textFromLayer;
  if (dynamicField && dynamicValue) {
    if (renderedDynamicText.has(dynamicField.key)) {
      return;
    }
    textToRender = dynamicValue;
    renderedDynamicText.add(dynamicField.key);
    if (options.useBackgroundBase) {
      repaintSlotFromBorder(ctx, x, y, width, height);
    }
  } else if (options.useBackgroundBase) {
    // Base thumbnail already contains static text.
    return;
  }

  if (!textToRender.trim()) {
    return;
  }

  const align = toTextAlign(layer.justification ?? dynamicField?.justification);
  const requestedSize = layer.size ?? dynamicField?.fontSize ?? 28;
  const fontFamily = toFontFamily(layer.font ?? dynamicField?.font);
  const fontWeight = toFontWeight(layer.font ?? dynamicField?.font);
  const color = normalizeCssColor(layer.color) ?? normalizeCssColor(dynamicField?.color) ?? '#111827';

  const padding = 2;
  const maxWidth = Math.max(20, width - padding * 2);
  const maxHeight = Math.max(20, height - padding * 2);

  const fitted = fitFontSize(
    ctx,
    textToRender,
    maxWidth,
    maxHeight,
    Math.max(10, requestedSize),
    fontFamily,
    fontWeight,
  );

  applyTextFont(ctx, fitted.fontSize, fontFamily, fontWeight);
  ctx.fillStyle = color;

  const lineHeight = layer.lineHeight
    ? Math.max(10, Math.round(layer.lineHeight * (fitted.fontSize / Math.max(10, requestedSize))))
    : fitted.lineHeight;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x + padding, y + padding, maxWidth, maxHeight);
  ctx.clip();
  drawWrappedText(ctx, textToRender, x + padding, y + padding, maxWidth, lineHeight, align);
  ctx.restore();
}

function resolveCanvasSize(
  renderSize: { width: number; height: number } | undefined,
  templateLayers: FrameTemplateLayer[] | undefined,
) {
  if (renderSize?.width && renderSize?.height) {
    return {
      width: Math.max(320, renderSize.width),
      height: Math.max(180, renderSize.height),
    };
  }

  const layers = templateLayers ?? [];
  let width = 0;
  let height = 0;
  for (const layer of layers) {
    const x = layer.x ?? 0;
    const y = layer.y ?? 0;
    const w = layer.width ?? 0;
    const h = layer.height ?? 0;
    width = Math.max(width, Math.ceil(x + w));
    height = Math.max(height, Math.ceil(y + h));
  }

  if (width === 0 || height === 0) {
    width = 1280;
    height = 720;
  }

  return {
    width: Math.max(320, width),
    height: Math.max(180, height),
  };
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Unable to create image blob'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

async function saveBlob(filename: string, blob: Blob) {
  if (typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator) {
    try {
      const file = new File([blob], filename, { type: 'image/png' });
      const canShareFiles = (navigator as Navigator & {
        canShare?: (payload: { files?: File[] }) => boolean;
      }).canShare?.({ files: [file] });

      if (canShareFiles) {
        await navigator.share({
          files: [file],
          title: filename,
          text: 'Frame input image export',
        });
        return;
      }
    } catch {
      // Fall back to direct download.
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function renderFromTemplateLayers(
  ctx: CanvasRenderingContext2D,
  params: ExportFrameInputsAsImageParams,
  options: RenderLayerOptions,
) {
  const metrics: RenderMetrics = {
    staticImageLayersDrawn: 0,
    dynamicImageLayersDrawn: 0,
    textLayersDrawn: 0,
    rectLayersDrawn: 0,
    skippedBecauseUseBackgroundBase: 0,
    skippedTemplateBackground: 0,
    skippedFullCanvasStatic: 0,
    skippedOpaqueFullCanvas: 0,
    skippedMissingSource: 0,
    skippedDuplicateDynamicImage: 0,
    imageLoadFailures: 0,
  };

  const layers = params.templateLayers ?? [];
  const renderedDynamicText = new Set<string>();
  const renderedDynamicImages = new Set<string>();

  for (const layer of layers) {
    const type = (layer.type ?? '').toLowerCase();

    ctx.save();
    applyLayerOpacity(ctx, layer.opacity);

    if (type === 'rect' || type === 'rectangle') {
      renderRectLayer(ctx, layer);
      metrics.rectLayersDrawn += 1;
      ctx.restore();
      continue;
    }

    if (type === 'image') {
      const matched = findBestFieldForLayer(layer, params.fields, 'image');
      const renderResult = await renderImageLayer(ctx, layer, matched, params.values, renderedDynamicImages, options);
      if (renderResult.drew) {
        if (renderResult.usedDynamicValue) {
          metrics.dynamicImageLayersDrawn += 1;
        } else {
          metrics.staticImageLayersDrawn += 1;
        }
      } else {
        if (renderResult.skipReason === 'use-background-base') {
          metrics.skippedBecauseUseBackgroundBase += 1;
        } else if (renderResult.skipReason === 'template-background-skip') {
          metrics.skippedTemplateBackground += 1;
        } else if (renderResult.skipReason === 'full-canvas-static-skip') {
          metrics.skippedFullCanvasStatic += 1;
        } else if (renderResult.skipReason === 'opaque-full-canvas-skip') {
          metrics.skippedOpaqueFullCanvas += 1;
        } else if (renderResult.skipReason === 'missing-source') {
          metrics.skippedMissingSource += 1;
        } else if (renderResult.skipReason === 'duplicate-dynamic-image') {
          metrics.skippedDuplicateDynamicImage += 1;
        } else if (renderResult.skipReason === 'load-failed') {
          metrics.imageLoadFailures += 1;
        }
      }
      ctx.restore();
      continue;
    }

    if (type === 'text') {
      const matched = findBestFieldForLayer(layer, params.fields, 'text');
      renderTextLayer(ctx, layer, matched, params.values, renderedDynamicText, options);
      metrics.textLayersDrawn += 1;
      ctx.restore();
      continue;
    }

    ctx.restore();
  }

  return metrics;
}

async function renderFrameFromThumbnailOverlay(
  ctx: CanvasRenderingContext2D,
  thumbnailUrl: string,
  width: number,
  height: number,
) {
  const overlay = await loadImage(thumbnailUrl);
  const scratch = document.createElement('canvas');
  scratch.width = width;
  scratch.height = height;
  const scratchCtx = scratch.getContext('2d');
  if (!scratchCtx) {
    return;
  }

  scratchCtx.clearRect(0, 0, width, height);
  scratchCtx.drawImage(overlay, 0, 0, width, height);

  try {
    const imageData = scratchCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const lowerBandStart = Math.floor(height * 0.82);
    const centerLeft = Math.floor(width * 0.2);
    const centerRight = Math.floor(width * 0.8);
    const centerTop = Math.floor(height * 0.15);
    const centerBottom = Math.floor(height * 0.8);

    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const a = data[i + 3] ?? 255;
      if (a === 0) {
        continue;
      }

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const chroma = max - min;
      const isNeutral = chroma < 16;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const inCenter = x >= centerLeft && x <= centerRight && y >= centerTop && y <= centerBottom;

      // Keep header/logo region untouched so brand icon remains visible.
      const inProtectedTopLeft = x < 220 && y < 150;
      if (inProtectedTopLeft) {
        continue;
      }

      // Remove flat placeholder gray from non-frame area (main canvas body).
      const isMidGray = isNeutral && luma >= 165 && luma <= 236;
      const shouldRemoveGrayBackground = isMidGray && y < lowerBandStart;

      // Remove large neutral watermark area in center (covers old placeholder logo block).
      const isBrightNeutral = isNeutral && luma >= 220;
      const shouldRemoveCenterWatermark = inCenter && isBrightNeutral && y < lowerBandStart;

      if (shouldRemoveGrayBackground || shouldRemoveCenterWatermark) {
        data[i + 3] = 0;
      }
    }

    scratchCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(scratch, 0, 0, width, height);
  } catch {
    ctx.drawImage(overlay, 0, 0, width, height);
  }
}

async function renderFrameFromThumbnailWithCropWindow(
  ctx: CanvasRenderingContext2D,
  thumbnailUrl: string,
  width: number,
  height: number,
  cropWindow: CropWindow,
) {
  const overlay = await loadImage(thumbnailUrl);
  drawOverlayWithCropWindow(ctx, overlay, 0, 0, width, height, cropWindow);
}

async function renderFrameCanvas(params: ExportFrameInputsAsImageParams) {
  const resolvedSize = resolveCanvasSize(params.renderSize, params.templateLayers);
  const canvas = document.createElement('canvas');
  canvas.width = resolvedSize.width;
  canvas.height = resolvedSize.height;
  let renderMode: RenderMode = 'blank';

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas not supported');
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let backgroundSizing: RenderDebugInfo['backgroundSizing'] = null;
  let backgroundDrawn = false;
  if (params.backgroundUrl) {
    try {
      const bg = await loadImage(params.backgroundUrl);
      backgroundSizing = drawImageCover(ctx, bg, 0, 0, canvas.width, canvas.height);
      backgroundDrawn = true;
    } catch {
      backgroundDrawn = false;
      backgroundSizing = null;
    }
  }

  const hasTemplateLayers = Array.isArray(params.templateLayers) && params.templateLayers.length > 0;
  const strictFrame2Mode = isStrictFrame2Like(params.frameTitle);
  const frameCropWindow = getFrameCropWindowOverride(params.frameTitle, canvas.width, canvas.height);
  let usedThumbnailFallback = false;
  let latestMetrics: RenderMetrics | null = null;
  let templateBackgroundReference: HTMLImageElement | null = null;
  if (hasTemplateLayers) {
    const backgroundLayer = (params.templateLayers ?? []).find(layer => isLikelyFullCanvasBackgroundLayer(layer, canvas.width, canvas.height));
    if (backgroundLayer?.src) {
      try {
        templateBackgroundReference = await loadImage(backgroundLayer.src);
      } catch {
        templateBackgroundReference = null;
      }
    }
  }

  if (backgroundDrawn) {
    if (hasTemplateLayers) {
      if (strictFrame2Mode) {
        // Strict Frame2 path: draw selected image as base and use transparent template overlay layers only.
        // Do not use thumbnail fallback here because Frame2 thumbnail is an opaque composite (it bakes the gray matte).
        const metrics = await renderFromTemplateLayers(ctx, params, {
          useBackgroundBase: false,
          skipTemplateBackgroundImage: true,
          skipFullCanvasStaticImageLayers: false,
          removeOpaqueFullCanvasLayers: true,
          forceSkipBackgroundTokenLayers: true,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          cleanNeutralOverlayFrame: false,
          templateBackgroundReference,
          replaceBackgroundWithImage: true,
          frameTitle: params.frameTitle,
        });
        latestMetrics = metrics;

        if (metrics.staticImageLayersDrawn === 0 && params.thumbnailUrl && frameCropWindow) {
          await renderFrameFromThumbnailWithCropWindow(ctx, params.thumbnailUrl, canvas.width, canvas.height, frameCropWindow);
          renderMode = 'thumbnail-fallback';
          usedThumbnailFallback = true;
        } else {
          renderMode = 'full-template';
        }
      } else {
        // Selected image is base; apply full frame template on top.
        const metrics = await renderFromTemplateLayers(ctx, params, {
          useBackgroundBase: false,
          skipTemplateBackgroundImage: true,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          cleanNeutralOverlayFrame: true,
          templateBackgroundReference,
          replaceBackgroundWithImage: true,
          frameTitle: params.frameTitle,
        });
        latestMetrics = metrics;

        // Fallback for imported PSD/ZIP templates where image layer src paths are not web-resolvable.
        if (metrics.staticImageLayersDrawn === 0 && params.thumbnailUrl) {
          await renderFrameFromThumbnailOverlay(ctx, params.thumbnailUrl, canvas.width, canvas.height);
          renderMode = 'thumbnail-fallback';
          usedThumbnailFallback = true;
        } else {
          renderMode = 'full-template';
        }
      }
    } else {
      // Legacy fallback for frames without template layers.
      await renderDynamicImagesOnBackground(ctx, params);
      renderDynamicFieldsOnBackground(ctx, params);
      renderMode = 'dynamic-only';
    }
  } else if (hasTemplateLayers) {
    const metrics = await renderFromTemplateLayers(ctx, params, {
      useBackgroundBase: false,
      skipTemplateBackgroundImage: false,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      cleanNeutralOverlayFrame: false,
      templateBackgroundReference,
      replaceBackgroundWithImage: false,
      frameTitle: params.frameTitle,
    });
    latestMetrics = metrics;
    if (metrics.staticImageLayersDrawn === 0 && params.thumbnailUrl) {
      await renderFrameFromThumbnailOverlay(ctx, params.thumbnailUrl, canvas.width, canvas.height);
      renderMode = 'thumbnail-fallback';
      usedThumbnailFallback = true;
    } else {
      renderMode = 'full-template';
    }
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    renderMode = 'blank';
  }

  const debug: RenderDebugInfo = {
    strictFrame2Mode,
    hasTemplateLayers,
    backgroundDrawn,
    usedThumbnailFallback,
    renderMode,
    metrics: latestMetrics,
    backgroundSizing,
  };

  return { canvas, renderMode, debug };
}

export async function renderFrameInputsAsDataUrl(params: ExportFrameInputsAsImageParams) {
  const { canvas } = await renderFrameCanvas(params);
  try {
    return canvas.toDataURL('image/png');
  } catch {
    throw new Error('Canvas export blocked. Frame contains a non-CORS image source.');
  }
}

export async function renderFrameInputsPreview(params: ExportFrameInputsAsImageParams) {
  const { canvas, renderMode, debug } = await renderFrameCanvas(params);
  try {
    return {
      dataUrl: canvas.toDataURL('image/png'),
      renderMode,
      debug,
    };
  } catch {
    throw new Error('Canvas export blocked. Frame contains a non-CORS image source.');
  }
}

export async function exportFrameInputsAsImage(params: ExportFrameInputsAsImageParams) {
  const { canvas } = await renderFrameCanvas(params);
  const blob = await canvasToBlob(canvas);
  await saveBlob(params.filename, blob);
}
