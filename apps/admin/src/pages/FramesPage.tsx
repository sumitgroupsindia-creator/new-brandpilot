import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PagePanel } from '../components/PagePanel';
import {
  AdminFrameDynamicField,
  adminGetCategories,
  adminGetFrame,
  adminGetFrames,
  adminSetFrameActive,
  adminUpdateFrameTemplate,
  adminUploadFrame,
} from '../lib/api';

interface DragState {
  key: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
}

const DEFAULT_RENDER_SIZE = { width: 1280, height: 720 };

export function FramesPage() {
  const queryClient = useQueryClient();
  const framesQuery = useQuery({ queryKey: ['admin-frames'], queryFn: adminGetFrames });
  const categoriesQuery = useQuery({ queryKey: ['admin-categories'], queryFn: adminGetCategories });
  const frames = framesQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tier, setTier] = useState<'FREE' | 'PREMIUM'>('FREE');
  const [frameZip, setFrameZip] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [selectedFrameId, setSelectedFrameId] = useState('');
  const [editableFields, setEditableFields] = useState<AdminFrameDynamicField[]>([]);
  const [editorNotice, setEditorNotice] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const frameDetailQuery = useQuery({
    queryKey: ['admin-frame', selectedFrameId],
    queryFn: () => adminGetFrame(selectedFrameId),
    enabled: Boolean(selectedFrameId),
  });

  const activeFrameDetail = frameDetailQuery.data;
  const renderSize = activeFrameDetail?.renderSize ?? DEFAULT_RENDER_SIZE;

  const uploadMutation = useMutation({
    mutationFn: adminUploadFrame,
    onSuccess: async () => {
      setTitle('');
      setDescription('');
      setCategoryId('');
      setTier('FREE');
      setFrameZip(null);
      setThumbnail(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-frames'] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ frameId, active }: { frameId: string; active: boolean }) =>
      adminSetFrameActive(frameId, active),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-frames'] });
    },
  });

  const updateFrameTemplateMutation = useMutation({
    mutationFn: ({ frameId, dynamicFields }: { frameId: string; dynamicFields: AdminFrameDynamicField[] }) =>
      adminUpdateFrameTemplate(frameId, { dynamicFields }),
    onSuccess: async (updated) => {
      setEditableFields(updated.dynamicFields ?? []);
      setEditorNotice('Frame template saved.');
      await queryClient.invalidateQueries({ queryKey: ['admin-frames'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-frame', updated.id] });
    },
  });

  useEffect(() => {
    if (!activeFrameDetail) {
      return;
    }
    setEditableFields(activeFrameDetail.dynamicFields ?? []);
  }, [activeFrameDetail]);

  useEffect(() => {
    const onMouseMove = (event: globalThis.MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }

      const previewEl = previewRef.current;
      if (!previewEl) {
        return;
      }

      const rect = previewEl.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }

      const deltaXUnits = ((event.clientX - drag.startClientX) / rect.width) * renderSize.width;
      const deltaYUnits = ((event.clientY - drag.startClientY) / rect.height) * renderSize.height;

      setEditableFields(current =>
        current.map(field => {
          if (field.key !== drag.key) {
            return field;
          }

          return {
            ...field,
            x: Math.max(0, Math.round(drag.startX + deltaXUnits)),
            y: Math.max(0, Math.round(drag.startY + deltaYUnits)),
          };
        }),
      );
    };

    const onMouseUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [renderSize.height, renderSize.width]);

  const canSubmit = useMemo(
    () => title.trim().length > 0 && frameZip !== null && !uploadMutation.isPending,
    [title, frameZip, uploadMutation.isPending],
  );

  const canSaveTemplate = Boolean(selectedFrameId) && !updateFrameTemplateMutation.isPending;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!frameZip) return;

    await uploadMutation.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      categoryId: categoryId || undefined,
      tier,
      status: 'PUBLISHED',
      frameZip,
      thumbnail: thumbnail ?? undefined,
    });
  };

  const onSaveTemplate = async () => {
    if (!selectedFrameId) {
      return;
    }

    setEditorNotice(null);
    await updateFrameTemplateMutation.mutateAsync({
      frameId: selectedFrameId,
      dynamicFields: editableFields.map(field => ({
        ...field,
        x: typeof field.x === 'number' ? field.x : 0,
        y: typeof field.y === 'number' ? field.y : 0,
      })),
    });
  };

  const updateField = (key: string, patch: Partial<AdminFrameDynamicField>) => {
    setEditableFields(current => current.map(field => (field.key === key ? { ...field, ...patch } : field)));
  };

  const onFieldDragStart = (event: MouseEvent<HTMLDivElement>, field: AdminFrameDynamicField) => {
    event.preventDefault();
    dragRef.current = {
      key: field.key,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: field.x ?? 0,
      startY: field.y ?? 0,
    };
  };

  return (
    <PagePanel title="Frame Studio" subtitle="Create, version, publish, and rank templates.">
      {framesQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading frames...</p> : null}
      {framesQuery.isError ? <p className="mb-3 text-sm text-rose-700">Failed to load frames.</p> : null}

      <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
        <input
          className="field"
          placeholder="Frame title"
          value={title}
          onChange={event => setTitle(event.target.value)}
        />
        <select
          className="field"
          value={categoryId}
          onChange={event => setCategoryId(event.target.value)}
        >
          <option value="">Select category</option>
          {categories.map(category => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>

        <select className="field" value={tier} onChange={event => setTier(event.target.value as 'FREE' | 'PREMIUM')}>
          <option value="FREE">FREE</option>
          <option value="PREMIUM">PREMIUM</option>
        </select>

        <div className="field flex items-center text-sm text-slate-600">
          Credits auto-set by tier (FREE/PREMIUM)
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Frame ZIP Upload</p>
          <input
            className="field"
            type="file"
            accept=".zip"
            onChange={event => setFrameZip(event.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Thumbnail Upload</p>
          <input
            className="field"
            type="file"
            accept="image/*"
            onChange={event => setThumbnail(event.target.files?.[0] ?? null)}
          />
        </div>

        <textarea
          className="field md:col-span-2"
          rows={3}
          placeholder="Description"
          value={description}
          onChange={event => setDescription(event.target.value)}
        />

        <button className="btn-dark md:col-span-2" type="submit" disabled={!canSubmit}>
          {uploadMutation.isPending ? 'Uploading frame...' : 'Upload Frame ZIP + Thumbnail'}
        </button>
      </form>

      {uploadMutation.isError ? <p className="mt-3 text-sm text-rose-700">Frame upload failed. Check ZIP/JSON and try again.</p> : null}
      {uploadMutation.isSuccess ? <p className="mt-3 text-sm text-emerald-700">Frame uploaded successfully.</p> : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Preview</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Version</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {frames.map(frame => (
              <tr key={frame.id} className="border-t border-slate-200">
                <td className="px-3 py-2">
                  {frame.thumbnailUrl ? (
                    <img src={frame.thumbnailUrl} alt={frame.title} className="h-12 w-20 rounded object-cover" />
                  ) : (
                    <span className="text-xs text-slate-400">No image</span>
                  )}
                </td>
                <td className="px-3 py-2">{frame.title}</td>
                <td className="px-3 py-2">{frame.category}</td>
                <td className="px-3 py-2">{frame.tier}</td>
                <td className="px-3 py-2">{frame.status}</td>
                <td className="px-3 py-2">v{frame.version}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-dark"
                      type="button"
                      onClick={() => toggleActiveMutation.mutate({ frameId: frame.id, active: frame.status !== 'PUBLISHED' })}
                      disabled={toggleActiveMutation.isPending}
                    >
                      {frame.status === 'PUBLISHED' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className="btn-dark"
                      type="button"
                      onClick={() => {
                        setSelectedFrameId(frame.id);
                        setEditorNotice(null);
                      }}
                    >
                      Edit template
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedFrameId ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Template Editor</h3>
              <p className="text-sm text-slate-500">Drag placeholders on preview, edit defaults/styles, then save.</p>
            </div>
            <button className="btn-dark" type="button" onClick={onSaveTemplate} disabled={!canSaveTemplate}>
              {updateFrameTemplateMutation.isPending ? 'Saving...' : 'Save template fields'}
            </button>
          </div>

          {frameDetailQuery.isLoading ? <p className="text-sm text-slate-500">Loading frame details...</p> : null}
          {frameDetailQuery.isError ? <p className="text-sm text-rose-700">Failed to load frame details.</p> : null}
          {editorNotice ? <p className="mb-3 text-sm text-emerald-700">{editorNotice}</p> : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Drag & Drop Preview</p>
              <div
                ref={previewRef}
                className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-white"
                style={{ aspectRatio: `${renderSize.width} / ${renderSize.height}` }}
              >
                {activeFrameDetail?.thumbnailUrl ? (
                  <img
                    src={activeFrameDetail.thumbnailUrl}
                    alt={activeFrameDetail.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}

                {editableFields.map(field => {
                  const x = field.x ?? 0;
                  const y = field.y ?? 0;
                  const width = field.width ?? 220;
                  const height = field.height ?? 70;

                  return (
                    <div
                      key={field.key}
                      className={`absolute cursor-move rounded border px-2 py-1 text-[10px] font-semibold shadow ${field.type === 'image' ? 'border-amber-300 bg-amber-100/80 text-amber-800' : 'border-teal-300 bg-teal-100/80 text-teal-800'}`}
                      style={{
                        left: `${(x / renderSize.width) * 100}%`,
                        top: `${(y / renderSize.height) * 100}%`,
                        width: `${(width / renderSize.width) * 100}%`,
                        height: `${(height / renderSize.height) * 100}%`,
                      }}
                      onMouseDown={event => onFieldDragStart(event, field)}
                    >
                      {field.label}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="overflow-auto rounded-lg border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Editable Fields</p>
              <div className="space-y-4">
                {editableFields.map(field => (
                  <div key={field.key} className="rounded-lg border border-slate-200 p-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <input
                        className="field"
                        value={field.label}
                        onChange={event => updateField(field.key, { label: event.target.value })}
                        placeholder="Label"
                      />
                      <input
                        className="field"
                        value={field.defaultValue}
                        onChange={event => updateField(field.key, { defaultValue: event.target.value })}
                        placeholder="Default value"
                      />
                      <input
                        className="field"
                        type="number"
                        value={field.x ?? 0}
                        onChange={event => updateField(field.key, { x: Number(event.target.value) })}
                        placeholder="X"
                      />
                      <input
                        className="field"
                        type="number"
                        value={field.y ?? 0}
                        onChange={event => updateField(field.key, { y: Number(event.target.value) })}
                        placeholder="Y"
                      />
                      <input
                        className="field"
                        type="number"
                        value={field.width ?? 220}
                        onChange={event => updateField(field.key, { width: Number(event.target.value) })}
                        placeholder="Width"
                      />
                      <input
                        className="field"
                        type="number"
                        value={field.height ?? 70}
                        onChange={event => updateField(field.key, { height: Number(event.target.value) })}
                        placeholder="Height"
                      />

                      {field.type !== 'image' ? (
                        <>
                          <input
                            className="field"
                            value={field.font ?? ''}
                            onChange={event => updateField(field.key, { font: event.target.value })}
                            placeholder="Font"
                          />
                          <input
                            className="field"
                            type="number"
                            value={field.fontSize ?? 28}
                            onChange={event => updateField(field.key, { fontSize: Number(event.target.value) })}
                            placeholder="Font size"
                          />
                          <input
                            className="field"
                            value={field.color ?? ''}
                            onChange={event => updateField(field.key, { color: event.target.value })}
                            placeholder="Color"
                          />
                          <input
                            className="field"
                            value={field.justification ?? ''}
                            onChange={event => updateField(field.key, { justification: event.target.value })}
                            placeholder="Alignment"
                          />
                        </>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Key: {field.key} • Type: {field.type}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PagePanel>
  );
}
