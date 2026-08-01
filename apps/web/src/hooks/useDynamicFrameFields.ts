import { useEffect, useMemo, useState } from 'react';
import { DynamicFieldDefinition, DynamicFrameFieldValues, ImageBackgroundMode } from '../types/frameFields';

export function useDynamicFrameFields(fields: DynamicFieldDefinition[]) {
  const textDefaults = useMemo(() => {
    const defaults: Record<string, string> = {};
    for (const field of fields) {
      if (field.type !== 'image') {
        defaults[field.key] = field.defaultValue ?? '';
      }
    }
    return defaults;
  }, [fields]);

  const [text, setText] = useState<Record<string, string>>(textDefaults);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<Record<string, string>>({});
  const [imageDataUrl, setImageDataUrl] = useState<Record<string, string>>({});
  const [imageBackgroundMode, setImageBackgroundMode] = useState<Record<string, ImageBackgroundMode>>({});

  useEffect(() => {
    setText(current => ({
      ...textDefaults,
      ...current,
    }));
  }, [textDefaults]);

  const values: DynamicFrameFieldValues = {
    text,
    imagePreviewUrl,
    imageDataUrl,
    imageBackgroundMode,
  };

  const setTextValue = (key: string, value: string) => {
    setText(current => ({
      ...current,
      [key]: value,
    }));
  };

  const setImagePreview = (key: string, previewUrl: string) => {
    setImagePreviewUrl(current => ({
      ...current,
      [key]: previewUrl,
    }));
  };

  const setImageBackground = (key: string, mode: ImageBackgroundMode) => {
    setImageBackgroundMode(current => ({
      ...current,
      [key]: mode,
    }));
  };

  const setImageData = (key: string, dataUrl: string) => {
    setImageDataUrl(current => ({
      ...current,
      [key]: dataUrl,
    }));
  };

  const fillTextFromMap = (map: Record<string, string>) => {
    setText(current => ({
      ...current,
      ...map,
    }));
  };

  const resetTextToDefaults = () => {
    setText(textDefaults);
  };

  return {
    values,
    setTextValue,
    setImagePreview,
    setImageData,
    setImageBackground,
    fillTextFromMap,
    resetTextToDefaults,
  };
}
