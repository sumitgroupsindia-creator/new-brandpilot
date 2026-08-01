import { FrameInputDraft, ImageBackgroundMode } from '../types/frameFields';

const STORAGE_KEY = 'bp_frame_input_drafts';

type DraftMap = Record<string, FrameInputDraft>;

function readMap(): DraftMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as DraftMap;
  } catch {
    return {};
  }
}

function writeMap(map: DraftMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function saveFrameInputDraft(frameId: string, draft: FrameInputDraft) {
  const all = readMap();
  all[frameId] = draft;
  writeMap(all);
}

export function readFrameInputDraft(frameId: string): FrameInputDraft | null {
  const all = readMap();
  const draft = all[frameId];
  if (!draft || typeof draft !== 'object') {
    return null;
  }

  const text = draft.text && typeof draft.text === 'object' ? draft.text : {};
  const imagesRaw = draft.images && typeof draft.images === 'object' ? draft.images : {};
  const images: FrameInputDraft['images'] = {};

  for (const [key, value] of Object.entries(imagesRaw)) {
    if (!value || typeof value !== 'object') continue;
    const row = value as { dataUrl?: unknown; backgroundMode?: unknown };
    if (typeof row.dataUrl !== 'string' || row.dataUrl.length === 0) continue;
    const backgroundMode: ImageBackgroundMode = row.backgroundMode === 'without' ? 'without' : 'with';
    images[key] = {
      dataUrl: row.dataUrl,
      backgroundMode,
    };
  }

  return {
    text: Object.fromEntries(
      Object.entries(text).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
    images,
  };
}
