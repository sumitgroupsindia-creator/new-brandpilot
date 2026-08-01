import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { PagePanel } from '../components/PagePanel';
import {
  adminCreateImageCategory,
  adminDeleteImage,
  adminDeleteImageCategory,
  adminGetImageCategories,
  adminSetImageActive,
  adminSetImageCategoryActive,
  adminUpdateImage,
  adminUpdateImageCategory,
  adminUploadCategoryImages,
} from '../lib/api';

interface UploadImageDraft {
  file: File;
  name: string;
  sortOrder: string;
}

export function CategoriesPage() {
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId?: string }>();
  const queryClient = useQueryClient();
  const imageCategoriesQuery = useQuery({ queryKey: ['admin-image-categories'], queryFn: adminGetImageCategories });
  const imageCategories = imageCategoriesQuery.data ?? [];

  const [imageCategoryName, setImageCategoryName] = useState('');
  const [imageCategoryOrder, setImageCategoryOrder] = useState('');
  const [uploadItems, setUploadItems] = useState<UploadImageDraft[]>([]);

  const createImageCategoryMutation = useMutation({
    mutationFn: adminCreateImageCategory,
    onSuccess: async () => {
      setImageCategoryName('');
      setImageCategoryOrder('');
      await queryClient.invalidateQueries({ queryKey: ['admin-image-categories'] });
    },
  });

  const setImageCategoryActiveMutation = useMutation({
    mutationFn: ({ categoryId, active }: { categoryId: string; active: boolean }) =>
      adminSetImageCategoryActive(categoryId, active),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-image-categories'] });
    },
  });

  const deleteImageCategoryMutation = useMutation({
    mutationFn: adminDeleteImageCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-image-categories'] });
    },
  });

  const updateImageCategoryMutation = useMutation({
    mutationFn: ({ categoryId, name, order }: { categoryId: string; name?: string; order?: number }) =>
      adminUpdateImageCategory(categoryId, {
        name,
        sortOrder: order,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-image-categories'] });
    },
  });

  const uploadImagesMutation = useMutation({
    mutationFn: ({ categoryId, items }: { categoryId: string; items: UploadImageDraft[] }) =>
      adminUploadCategoryImages(
        categoryId,
        items.map(item => ({
          file: item.file,
          name: item.name,
          sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : undefined,
        })),
      ),
    onSuccess: async () => {
      setUploadItems([]);
      await queryClient.invalidateQueries({ queryKey: ['admin-image-categories'] });
    },
  });

  const setImageActiveMutation = useMutation({
    mutationFn: ({ categoryId, imageId, active }: { categoryId: string; imageId: string; active: boolean }) =>
      adminSetImageActive(categoryId, imageId, active),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-image-categories'] });
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: ({ categoryId, imageId }: { categoryId: string; imageId: string }) =>
      adminDeleteImage(categoryId, imageId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-image-categories'] });
    },
  });

  const updateImageMutation = useMutation({
    mutationFn: ({ categoryId, imageId, name, sortOrder, tier, estimatedCredits }: {
      categoryId: string;
      imageId: string;
      name?: string;
      sortOrder?: number;
      tier?: 'FREE' | 'PREMIUM';
      estimatedCredits?: number;
    }) =>
      adminUpdateImage(categoryId, imageId, {
        name,
        sortOrder,
        tier,
        estimatedCredits,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-image-categories'] });
    },
  });

  const selectedImageCategory = useMemo(
    () => imageCategories.find(category => category.id === categoryId) ?? null,
    [imageCategories, categoryId],
  );

  const onCreateImageCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!imageCategoryName.trim()) return;
    await createImageCategoryMutation.mutateAsync({
      name: imageCategoryName.trim(),
      sortOrder: imageCategoryOrder.trim() ? Number(imageCategoryOrder.trim()) : undefined,
      active: true,
    });
  };

  const onBulkUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedImageCategory || uploadItems.length === 0) return;
    await uploadImagesMutation.mutateAsync({
      categoryId: selectedImageCategory.id,
      items: uploadItems,
    });
  };

  if (categoryId && !selectedImageCategory) {
    return (
      <PagePanel title="Category" subtitle="Category not found.">
        <button className="btn-dark" type="button" onClick={() => navigate('/categories')}>
          Back to categories
        </button>
      </PagePanel>
    );
  }

  if (selectedImageCategory) {
    return (
      <PagePanel title="Category" subtitle={`Manage images in ${selectedImageCategory.name}.`}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Category Details</p>
            <h4 className="mt-1 text-lg font-semibold text-slate-900">{selectedImageCategory.name}</h4>
          </div>
          <button
            className="btn-dark"
            type="button"
            onClick={() => {
              navigate('/categories');
              setUploadItems([]);
            }}
          >
            Back to categories
          </button>
        </div>

        <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={onBulkUpload}>
          <input
            className="field"
            type="file"
            accept="image/*"
            multiple
            onChange={event => {
              const files = Array.from(event.target.files ?? []);
              if (!files.length) {
                setUploadItems([]);
                return;
              }

              const nextStartOrder = selectedImageCategory.images.length + 1;
              setUploadItems(
                files.map((file, index) => ({
                  file,
                  name: file.name.replace(/\.[^.]+$/, '').trim() || `Image ${index + 1}`,
                  sortOrder: String(nextStartOrder + index),
                })),
              );
            }}
          />
          <button className="btn-dark" type="submit" disabled={uploadImagesMutation.isPending}>
            {uploadImagesMutation.isPending ? 'Uploading...' : `Upload to ${selectedImageCategory.name}`}
          </button>
        </form>

        {uploadItems.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Image Name</th>
                  <th className="px-3 py-2">Order</th>
                </tr>
              </thead>
              <tbody>
                {uploadItems.map((item, index) => (
                  <tr key={`${item.file.name}-${index}`} className="border-t border-slate-200">
                    <td className="px-3 py-2">{item.file.name}</td>
                    <td className="px-3 py-2">
                      <input
                        className="field"
                        value={item.name}
                        onChange={event =>
                          setUploadItems(current =>
                            current.map((currentItem, currentIndex) =>
                              currentIndex === index
                                ? { ...currentItem, name: event.target.value }
                                : currentItem,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="field"
                        value={item.sortOrder}
                        onChange={event =>
                          setUploadItems(current =>
                            current.map((currentItem, currentIndex) =>
                              currentIndex === index
                                ? { ...currentItem, sortOrder: event.target.value }
                                : currentItem,
                            ),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Preview</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">Credits</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {selectedImageCategory.images.map(image => (
                <tr key={image.id} className="border-t border-slate-200">
                  <td className="px-3 py-2">
                    <img src={image.url} alt={image.name} className="h-14 w-20 rounded object-cover" />
                  </td>
                  <td className="px-3 py-2">{image.name}</td>
                  <td className="px-3 py-2">{image.sortOrder ?? 0}</td>
                  <td className="px-3 py-2">{image.tier ?? 'FREE'}</td>
                  <td className="px-3 py-2">{image.estimatedCredits ?? 0}</td>
                  <td className="px-3 py-2">{image.active ? 'Active' : 'Inactive'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn-dark"
                        type="button"
                        onClick={() => {
                          const nextName = window.prompt('Image name', image.name)?.trim();
                          if (!nextName) return;
                          const rawOrder = window.prompt('Image order', String(image.sortOrder ?? 0));
                          const order = rawOrder && Number.isFinite(Number(rawOrder)) ? Number(rawOrder) : (image.sortOrder ?? 0);
                          const rawTier = window.prompt('Image tier (FREE/PREMIUM)', image.tier ?? 'FREE');
                          const tier = rawTier?.trim().toUpperCase() === 'PREMIUM' ? 'PREMIUM' : 'FREE';
                          const rawCredits = window.prompt('Image credits', String(image.estimatedCredits ?? 0));
                          const estimatedCredits = rawCredits && Number.isFinite(Number(rawCredits))
                            ? Math.max(0, Math.floor(Number(rawCredits)))
                            : (image.estimatedCredits ?? 0);
                          updateImageMutation.mutate({
                            categoryId: selectedImageCategory.id,
                            imageId: image.id,
                            name: nextName,
                            sortOrder: order,
                            tier,
                            estimatedCredits,
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-dark"
                        type="button"
                        onClick={() =>
                          setImageActiveMutation.mutate({
                            categoryId: selectedImageCategory.id,
                            imageId: image.id,
                            active: !image.active,
                          })
                        }
                      >
                        {image.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="btn-dark"
                        type="button"
                        onClick={() => deleteImageMutation.mutate({ categoryId: selectedImageCategory.id, imageId: image.id })}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PagePanel>
    );
  }

  return (
    <PagePanel title="Categories" subtitle="Create category and open it to manage category images.">
      {imageCategoriesQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading image categories...</p> : null}
      {imageCategoriesQuery.isError ? <p className="mb-3 text-sm text-rose-700">Failed to load image categories.</p> : null}

      <form className="mt-2 grid gap-3 md:grid-cols-3" onSubmit={onCreateImageCategory}>
        <input
          className="field"
          placeholder="Image category name"
          value={imageCategoryName}
          onChange={event => setImageCategoryName(event.target.value)}
        />
        <input
          className="field"
          placeholder="Sort order (optional)"
          value={imageCategoryOrder}
          onChange={event => setImageCategoryOrder(event.target.value)}
        />
        <button className="btn-dark" type="submit" disabled={createImageCategoryMutation.isPending}>
          {createImageCategoryMutation.isPending ? 'Adding...' : 'Add image category'}
        </button>
      </form>

      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Images</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {imageCategories.map(category => (
              <tr key={category.id} className="border-t border-slate-200">
                <td className="px-3 py-2">
                  <button
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                    type="button"
                    onClick={() => {
                      navigate(`/categories/${category.id}`);
                      setUploadItems([]);
                    }}
                  >
                    {category.name}
                  </button>
                </td>
                <td className="px-3 py-2">{category.images.length}</td>
                <td className="px-3 py-2">{category.active ? 'Active' : 'Inactive'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-dark"
                      type="button"
                      onClick={() => {
                        navigate(`/categories/${category.id}`);
                        setUploadItems([]);
                      }}
                    >
                      Open
                    </button>
                    <button
                      className="btn-dark"
                      type="button"
                      onClick={() =>
                        setImageCategoryActiveMutation.mutate({
                          categoryId: category.id,
                          active: !category.active,
                        })
                      }
                    >
                      {category.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className="btn-dark"
                      type="button"
                      onClick={() => {
                        const nextName = window.prompt('Image category name', category.name)?.trim();
                        if (!nextName) return;
                        const rawOrder = window.prompt('Sort order', String(category.sortOrder));
                        const order = rawOrder && Number.isFinite(Number(rawOrder)) ? Number(rawOrder) : category.sortOrder;
                        updateImageCategoryMutation.mutate({
                          categoryId: category.id,
                          name: nextName,
                          order,
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-dark"
                      type="button"
                      onClick={() => {
                        deleteImageCategoryMutation.mutate(category.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-slate-500">Click category name to open category page and manage that category images.</p>
    </PagePanel>
  );
}
