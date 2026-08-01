import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { DynamicFrameFields } from '../../components/frame/DynamicFrameFields';
import { DownloadButton } from '@shared/components/shared/DownloadButton';
import { PageHeader } from '@shared/components/shared/PageHeader';
import { SectionHeader } from '@shared/components/shared/SectionHeader';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { ErrorState } from '@shared/components/ui/ErrorState';
import { LoadingState } from '@shared/components/ui/LoadingState';
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
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (frameQuery.isLoading) {
    return <LoadingState lines={4} />;
  }

  if (!frame || frameQuery.isError) {
    return <ErrorState title="Frame not found" description="This frame may be unpublished or moved." />;
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
    setDownloadError(null);
    setIsDownloading(true);
    const safeTitle = frame.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'frame';
    try {
      await exportFrameInputsAsImage({
        filename: `${safeTitle}-inputs.png`,
        frameTitle: frame.title,
        backgroundUrl: frame.thumbnailUrl,
        templateLayers: frame.templateLayers,
        renderSize: frame.renderSize,
        fields: dynamicFields,
        values: dynamicFieldState.values,
      });
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Download failed.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Editor Workspace"
        title={frame.title}
        description={frame.description}
        actions={
          <>
            <Badge variant={frame.tier === 'PREMIUM' ? 'warning' : 'success'}>{frame.tier}</Badge>
            <Badge variant="default">{frame.category}</Badge>
          </>
        }
      />

      {frame.isLocked ? (
        <ErrorState title="Subscription required" description="This premium frame requires an active subscription before generation." />
      ) : null}

      <Card className="p-4 sm:p-5">
        <SectionHeader title="Dynamic placeholders" subtitle="Populate text and image fields, then preview/download using existing rendering logic." />
        <form className="grid gap-3 md:grid-cols-2">
          <Button className="md:col-span-2" variant="secondary" type="button" onClick={pickFromProfile}>
            Autofill from profile
          </Button>

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
            <Button type="button" onClick={saveDraft}>Save as project</Button>
            <DownloadButton type="button" variant="secondary" isDownloading={isDownloading} onClick={downloadFilledData}>
              Download as image
            </DownloadButton>
          </div>
          {saveNote ? <p className="md:col-span-2 text-sm text-[var(--color-success-700)]">{saveNote}</p> : null}
          {downloadError ? <p className="md:col-span-2 text-sm text-[var(--color-danger-700)]">{downloadError}</p> : null}
        </form>
      </Card>
    </>
  );
}
