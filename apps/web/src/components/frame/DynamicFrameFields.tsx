import { DynamicFieldDefinition, DynamicFrameFieldValues } from '../../types/frameFields';

interface DynamicFrameFieldsProps {
  fields: DynamicFieldDefinition[];
  values: DynamicFrameFieldValues;
  onTextChange: (key: string, value: string) => void;
  onImageSelect: (key: string, file: File) => void;
  onImageBackgroundModeChange: (key: string, mode: 'with' | 'without') => void;
}

export function DynamicFrameFields({
  fields,
  values,
  onTextChange,
  onImageSelect,
  onImageBackgroundModeChange,
}: DynamicFrameFieldsProps) {
  if (fields.length === 0) {
    return <p className="md:col-span-2 text-sm text-slate-500">No dynamic fields found for this frame yet.</p>;
  }

  return (
    <>
      {fields.map(field => (
        field.type === 'image' ? (
          <div key={field.key} className="rounded-xl border border-slate-200 p-3 md:col-span-2">
            <p className="mb-2 text-sm font-medium text-slate-800">{field.label}</p>
            <input
              className="field"
              type="file"
              accept="image/*"
              onChange={event => {
                const file = event.target.files?.[0];
                if (!file) return;
                onImageSelect(field.key, file);
              }}
            />

            {field.supportsBackgroundRemoval ? (
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`bg-mode-${field.key}`}
                    checked={(values.imageBackgroundMode[field.key] ?? 'with') === 'with'}
                    onChange={() => onImageBackgroundModeChange(field.key, 'with')}
                  />
                  With background
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`bg-mode-${field.key}`}
                    checked={(values.imageBackgroundMode[field.key] ?? 'with') === 'without'}
                    onChange={() => onImageBackgroundModeChange(field.key, 'without')}
                  />
                  Without background (remove background)
                </label>
              </div>
            ) : null}

            {values.imagePreviewUrl[field.key] || field.defaultValue ? (
              <img
                className="mt-3 h-28 w-28 rounded-lg border border-slate-200 object-cover"
                src={values.imagePreviewUrl[field.key] ?? field.defaultValue}
                alt={field.label}
              />
            ) : null}
          </div>
        ) : (
          <div key={field.key} className="space-y-1">
            <input
              className="field"
              type={field.type}
              placeholder={field.label}
              value={values.text[field.key] ?? ''}
              onChange={event => onTextChange(field.key, event.target.value)}
            />
            {field.defaultValue ? (
              <p className="text-xs text-slate-500">Current frame value: {field.defaultValue}</p>
            ) : null}
          </div>
        )
      ))}
    </>
  );
}
