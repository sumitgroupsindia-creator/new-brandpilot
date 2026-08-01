import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ShellCard } from '../../components/ShellCard';
import { DynamicFrameFields } from '../../components/frame/DynamicFrameFields';
import { useDynamicFrameFields } from '../../hooks/useDynamicFrameFields';
import { apiGetFrame } from '../../lib/api';
import { exportFrameInputsAsImage } from '../../lib/frameInputImageExport';
import { saveFrameInputDraft } from '../../lib/frameInputDrafts';
import { readLocalProfileFields } from '../../lib/profileFields';

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read file'));
      }
    };
    reader.onerror = () => reject(new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

export function FrameDetailPage() {
  const { frameId } = useParams();
  const frameQuery = useQuery({
    queryKey: ['frame', frameId],
    queryFn: () => apiGetFrame(frameId ?? ''),
    enabled: Boolean(frameId),
  });
  const frame = frameQuery.data;

  const profileFields = useMemo(() => readLocalProfileFields(), []);
  const dynamicFields = frame?.dynamicFields ?? [];
  const dynamicFieldState = useDynamicFrameFields(dynamicFields);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  if (frameQuery.isLoading) {
    return <ShellCard title="Loading frame" subtitle="Fetching latest frame data..." />;
  }

  if (!frame || frameQuery.isError) {
    return <ShellCard title="Frame not found" subtitle="This frame may be unpublished or moved." />;
  }

  const pickFromProfile = () => {
    const nextValues: Record<string, string> = {};

    for (const item of dynamicFields) {
      const key = item.key.toLowerCase();
      if (/(company|brand|name)/.test(key) && profileFields.company) {
        nextValues[item.key] = profileFields.company;
      } else if (/(phone|mobile|contact|tel)/.test(key) && profileFields.phone) {
        nextValues[item.key] = profileFields.phone;
      } else if (/(web|site|url|link)/.test(key) && profileFields.website) {
        nextValues[item.key] = profileFields.website;
      } else if (/(address|location)/.test(key) && profileFields.address) {
        nextValues[item.key] = profileFields.address;
      } else if (/(tagline|slogan|headline)/.test(key) && profileFields.tagline) {
        nextValues[item.key] = profileFields.tagline;
      }
    }

    dynamicFieldState.fillTextFromMap(nextValues);
  };

  const saveDraft = () => {
    if (!frameId) {
      return;
    }

    const images = Object.fromEntries(
      Object.entries(dynamicFieldState.values.imageDataUrl)
        .filter((entry) => entry[1]?.length > 0)
        .map(([key, dataUrl]) => [
          key,
          {
            dataUrl,
            backgroundMode: dynamicFieldState.values.imageBackgroundMode[key] ?? 'with',
          },
        ]),
    );

    saveFrameInputDraft(frameId, {
      text: dynamicFieldState.values.text,
      images,
    });

    setSaveNote('Saved. Generate page will auto-use these values.');
  };

  const downloadFilledData = async () => {
    const safeTitle = frame.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'frame';
    await exportFrameInputsAsImage({
      filename: `${safeTitle}-inputs.png`,
      frameTitle: frame.title,
      backgroundUrl: frame.thumbnailUrl,
      templateLayers: frame.templateLayers,
      renderSize: frame.renderSize,
      fields: dynamicFields,
      values: dynamicFieldState.values,
    });
  };

  return (
    <>
      <ShellCard title={frame.title} subtitle={`${frame.category} • ${frame.tier}`}>
        <p className="text-sm text-slate-600">{frame.description}</p>
        {frame.isLocked ? (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This premium frame requires an active subscription before generation.
          </p>
        ) : null}
      </ShellCard>

      <ShellCard title="Dynamic Placeholders" subtitle="Rendered from frame schema at runtime.">
        <form className="grid gap-3 md:grid-cols-2">
          <button className="btn-secondary md:col-span-2" type="button" onClick={pickFromProfile}>
            Pick from profile
          </button>

          <DynamicFrameFields
            fields={dynamicFields}
            values={dynamicFieldState.values}
            onTextChange={dynamicFieldState.setTextValue}
            onImageSelect={async (key, file) => {
              const previewUrl = URL.createObjectURL(file);
              dynamicFieldState.setImagePreview(key, previewUrl);
              const dataUrl = await fileToDataUrl(file);
              dynamicFieldState.setImageData(key, dataUrl);
            }}
            onImageBackgroundModeChange={dynamicFieldState.setImageBackground}
          />

          <div className="md:col-span-2 flex flex-wrap gap-2">
            <button className="btn-primary" type="button" onClick={saveDraft}>
              Save as project
            </button>
            <button className="btn-secondary" type="button" onClick={downloadFilledData}>
              Download as image
            </button>
          </div>
          {saveNote ? <p className="md:col-span-2 text-sm text-teal-700">{saveNote}</p> : null}
        </form>
      </ShellCard>
    </>
  );
}
