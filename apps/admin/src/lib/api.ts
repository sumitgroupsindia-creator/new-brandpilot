import axios from 'axios';
import { showGlobalDialog, showGlobalToast } from '@brandpilot/shared';

const DEFAULT_TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG ?? 'default';

export const adminApi = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let adminRefreshRequest: Promise<TokenPairResponse> | null = null;

adminApi.interceptors.request.use(config => {
  const token = localStorage.getItem('bp_admin_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!config.headers['x-tenant-slug']) {
    config.headers['x-tenant-slug'] = DEFAULT_TENANT_SLUG;
  }
  return config;
});

adminApi.interceptors.response.use(
  response => response,
  async error => {
    if (axios.isAxiosError(error) && error.code !== 'ERR_CANCELED') {
      const originalRequest = error.config;
      const shouldTryRefresh =
        error.response?.status === 401 &&
        !originalRequest?.url?.includes('/auth/refresh') &&
        !(originalRequest as typeof originalRequest & { _retry?: boolean })?._retry;

      if (shouldTryRefresh) {
        const storedRefreshToken = localStorage.getItem('bp_admin_refresh_token');
        if (storedRefreshToken) {
          try {
            adminRefreshRequest ??= axios
              .post<TokenPairResponse>(
                '/api/auth/refresh',
                { refreshToken: storedRefreshToken },
                { headers: { 'Content-Type': 'application/json', 'x-tenant-slug': DEFAULT_TENANT_SLUG } },
              )
              .then(response => response.data)
              .finally(() => {
                adminRefreshRequest = null;
              });

            const refreshed = await adminRefreshRequest;
            localStorage.setItem('bp_admin_access_token', refreshed.accessToken);
            localStorage.setItem('bp_admin_refresh_token', refreshed.refreshToken);

            if (originalRequest) {
              (originalRequest as typeof originalRequest & { _retry?: boolean })._retry = true;
              originalRequest.headers.Authorization = `Bearer ${refreshed.accessToken}`;
              return adminApi(originalRequest);
            }
          } catch {
            localStorage.removeItem('bp_admin_access_token');
            localStorage.removeItem('bp_admin_refresh_token');
          }
        }
      }

      const message = extractAdminApiErrorMessage(error);
      const status = error.response?.status;

      if (status === 401 || status === 403 || /permission|access|subscription|premium/i.test(message)) {
        showGlobalDialog({
          title: 'Permission required',
          description: message,
          tone: 'warning',
          confirmLabel: 'Okay',
        });
      } else {
        showGlobalToast({
          title: 'Request failed',
          description: message,
          tone: 'error',
        });
      }
    }

    return Promise.reject(error);
  },
);

function extractAdminApiErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return 'Unexpected error occurred. Please try again.';
  }

  const payload = error.response?.data as { message?: string | string[]; error?: string } | undefined;

  if (Array.isArray(payload?.message)) {
    return payload.message.join(' ');
  }

  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  if (typeof payload?.error === 'string' && payload.error.trim()) {
    return payload.error;
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return 'Unexpected error occurred. Please try again.';
}

export interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AdminKpi {
  key: string;
  value: string;
}

export interface AdminFailedJob {
  id: string;
  queue: string;
  reason: string;
  when: string;
}

export interface AdminDashboardResponse {
  kpis: AdminKpi[];
  failedJobs: AdminFailedJob[];
}

export interface AdminUserRow {
  id: string;
  email: string;
  role: string;
  status: string;
}

export interface AdminAuditRow {
  action: string;
  actor: string;
  entity: string;
  when: string;
}

export interface AdminFrameRow {
  id: string;
  title: string;
  categoryId?: string | null;
  category: string;
  tier: 'FREE' | 'PREMIUM';
  thumbnailUrl?: string | null;
  active?: boolean;
  status: string;
  version: number;
}

export interface AdminFrameDynamicField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'url' | 'tel' | 'image';
  defaultValue: string;
  supportsBackgroundRemoval?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  font?: string;
  fontSize?: number;
  color?: string;
  lineHeight?: number;
  justification?: string;
}

export interface AdminFrameDetail extends AdminFrameRow {
  description: string;
  dynamicFields: AdminFrameDynamicField[];
  templateLayers: Array<Record<string, unknown>>;
  renderSize: {
    width: number;
    height: number;
  } | null;
}

export interface AdminCategoryRow {
  id: string;
  name: string;
  parent: string | null;
  order: number;
  active?: boolean;
}

export interface AdminImageCategoryImageRow {
  id: string;
  name: string;
  url: string;
  active: boolean;
  createdAt: string;
  sortOrder?: number;
  tier?: 'FREE' | 'PREMIUM';
  estimatedCredits?: number;
}

export interface AdminImageCategoryRow {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  images: AdminImageCategoryImageRow[];
}

export interface AdminWalletOpsRow {
  id: string;
  userEmail: string;
  type: string;
  amount: number;
  reason: string;
  when: string;
}

export interface AdminPlanRow {
  id: string;
  amountInr: number;
  credits: number;
  bonus: number;
  active: boolean;
}

export interface AdminSubscriptionPlanRow {
  id: string;
  name: string;
  amountInr: number;
  currency: string;
  period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  premiumFrames: boolean;
  monthlyCredits: number;
  graceDays: number;
  active: boolean;
  displayOrder: number;
  tenantId: string | null;
}

export interface AdminSubscriptionRow {
  id: string;
  userEmail: string;
  status: 'PENDING' | 'ACTIVE' | 'IN_GRACE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
  planName: string;
  amountInr: number;
  period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  providerSubId: string;
}

export interface AdminBrandingResponse {
  appName: string;
  primaryColor: string;
  logoUrl: string;
}

export interface AdminNotificationTemplateRow {
  id: string;
  event: string;
  channel: string;
  locale: string;
  title: string;
  body: string;
  active: boolean;
}

export interface AdminTenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  userCap: number;
}

export interface AdminAiConfigResponse {
  imageProvider: string;
  videoProvider: string;
  openaiTimeoutMs: number;
  openaiRetries: number;
  runwayTimeoutMs: number;
  runwayRetries: number;
}

export async function adminLogin(payload: { email: string; password: string }) {
  const { data } = await adminApi.post<TokenPairResponse>('/auth/login', payload);
  return data;
}

export async function adminRefresh(refreshToken: string) {
  const { data } = await adminApi.post<TokenPairResponse>('/auth/refresh', { refreshToken });
  return data;
}

export async function adminGetConfigNamespace(namespace: string) {
  const { data } = await adminApi.get<Record<string, unknown>>(`/config/${namespace}`);
  return data;
}

export async function adminUpdateConfig(namespace: string, key: string, value: unknown, reason?: string) {
  const { data } = await adminApi.put(`/config/${namespace}/${key}`, {
    value,
    reason,
    isSecret: false,
  });
  return data;
}

export async function adminGetDashboard() {
  const { data } = await adminApi.get<AdminDashboardResponse>('/admin/dashboard');
  return data;
}

export async function adminGetUsers() {
  const { data } = await adminApi.get<AdminUserRow[]>('/admin/users');
  return data;
}

export async function adminGetFailedJobs() {
  const { data } = await adminApi.get<AdminFailedJob[]>('/admin/jobs/failed');
  return data;
}

export async function adminGetAudit() {
  const { data } = await adminApi.get<AdminAuditRow[]>('/admin/audit');
  return data;
}

export async function adminGetFrames() {
  const { data } = await adminApi.get<AdminFrameRow[]>('/admin/frames');
  return data;
}

export async function adminUploadFrame(payload: {
  title: string;
  description?: string;
  categoryId?: string;
  tier: 'FREE' | 'PREMIUM';
  estimatedCredits?: number;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  isFeatured?: boolean;
  isTrending?: boolean;
  frameZip: File;
  thumbnail?: File;
}) {
  const formData = new FormData();
  formData.append('title', payload.title);
  if (payload.description) formData.append('description', payload.description);
  if (payload.categoryId) formData.append('categoryId', payload.categoryId);
  formData.append('tier', payload.tier);
  if (typeof payload.estimatedCredits === 'number') {
    formData.append('estimatedCredits', String(payload.estimatedCredits));
  }
  formData.append('status', payload.status ?? 'PUBLISHED');
  formData.append('isFeatured', String(Boolean(payload.isFeatured)));
  formData.append('isTrending', String(Boolean(payload.isTrending)));
  formData.append('frameZip', payload.frameZip);
  if (payload.thumbnail) {
    formData.append('thumbnail', payload.thumbnail);
  }

  const { data } = await adminApi.post<AdminFrameRow>('/admin/frames/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

export async function adminSetFrameActive(frameId: string, active: boolean) {
  const { data } = await adminApi.patch<AdminFrameRow>(`/admin/frames/${frameId}/active`, {
    active: String(active),
  });
  return data;
}

export async function adminGetFrame(frameId: string) {
  const { data } = await adminApi.get<AdminFrameDetail>(`/admin/frames/${frameId}`);
  return data;
}

export async function adminUpdateFrameTemplate(frameId: string, payload: {
  dynamicFields: AdminFrameDynamicField[];
}) {
  const { data } = await adminApi.patch<AdminFrameDetail>(`/admin/frames/${frameId}/template`, payload);
  return data;
}

export async function adminGetCategories() {
  const { data } = await adminApi.get<AdminCategoryRow[]>('/admin/categories');
  return data;
}

export async function adminCreateFrameCategory(payload: {
  name: string;
  parentId?: string;
  sortOrder?: number;
  active?: boolean;
}) {
  const { data } = await adminApi.post<AdminCategoryRow>('/admin/frame-categories', {
    name: payload.name,
    parentId: payload.parentId,
    sortOrder: payload.sortOrder !== undefined ? String(payload.sortOrder) : undefined,
    active: payload.active !== undefined ? String(payload.active) : undefined,
  });
  return data;
}

export async function adminUpdateFrameCategory(categoryId: string, payload: {
  name?: string;
  parentId?: string;
  sortOrder?: number;
  active?: boolean;
}) {
  const { data } = await adminApi.patch<AdminCategoryRow>(`/admin/frame-categories/${categoryId}`, {
    name: payload.name,
    parentId: payload.parentId,
    sortOrder: payload.sortOrder !== undefined ? String(payload.sortOrder) : undefined,
    active: payload.active !== undefined ? String(payload.active) : undefined,
  });
  return data;
}

export async function adminDeleteFrameCategory(categoryId: string) {
  const { data } = await adminApi.delete<{ success: boolean; categoryId: string }>(`/admin/frame-categories/${categoryId}`);
  return data;
}

export async function adminSetFrameCategoryActive(categoryId: string, active: boolean) {
  const { data } = await adminApi.patch<AdminCategoryRow>(`/admin/frame-categories/${categoryId}/active`, {
    active: String(active),
  });
  return data;
}

export async function adminGetImageCategories() {
  const { data } = await adminApi.get<AdminImageCategoryRow[]>('/admin/image-categories');
  return data;
}

export async function adminCreateImageCategory(payload: {
  name: string;
  sortOrder?: number;
  active?: boolean;
}) {
  const { data } = await adminApi.post<AdminImageCategoryRow>('/admin/image-categories', {
    name: payload.name,
    sortOrder: payload.sortOrder !== undefined ? String(payload.sortOrder) : undefined,
    active: payload.active !== undefined ? String(payload.active) : undefined,
  });
  return data;
}

export async function adminUpdateImageCategory(categoryId: string, payload: {
  name?: string;
  sortOrder?: number;
  active?: boolean;
}) {
  const { data } = await adminApi.patch<AdminImageCategoryRow>(`/admin/image-categories/${categoryId}`, {
    name: payload.name,
    sortOrder: payload.sortOrder !== undefined ? String(payload.sortOrder) : undefined,
    active: payload.active !== undefined ? String(payload.active) : undefined,
  });
  return data;
}

export async function adminDeleteImageCategory(categoryId: string) {
  const { data } = await adminApi.delete<{ success: boolean; categoryId: string }>(`/admin/image-categories/${categoryId}`);
  return data;
}

export async function adminSetImageCategoryActive(categoryId: string, active: boolean) {
  const { data } = await adminApi.patch<AdminImageCategoryRow>(`/admin/image-categories/${categoryId}/active`, {
    active: String(active),
  });
  return data;
}

export async function adminUploadCategoryImages(categoryId: string, images: Array<{
  file: File;
  name?: string;
  sortOrder?: number;
}>) {
  const formData = new FormData();
  const metadata: Array<{ name?: string; sortOrder?: number }> = [];

  for (const image of images) {
    formData.append('images', image.file);
    metadata.push({
      name: image.name?.trim() || undefined,
      sortOrder: typeof image.sortOrder === 'number' && Number.isFinite(image.sortOrder) ? image.sortOrder : undefined,
    });
  }
  formData.append('metadata', JSON.stringify(metadata));

  const { data } = await adminApi.post<{ categoryId: string; uploaded: AdminImageCategoryImageRow[] }>(
    `/admin/image-categories/${categoryId}/images/upload`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );

  return data;
}

export async function adminSetImageActive(categoryId: string, imageId: string, active: boolean) {
  const { data } = await adminApi.patch<AdminImageCategoryImageRow>(
    `/admin/image-categories/${categoryId}/images/${imageId}/active`,
    { active: String(active) },
  );
  return data;
}

export async function adminUpdateImage(categoryId: string, imageId: string, payload: {
  name?: string;
  sortOrder?: number;
  active?: boolean;
  tier?: 'FREE' | 'PREMIUM';
  estimatedCredits?: number;
}) {
  const { data } = await adminApi.patch<AdminImageCategoryImageRow>(
    `/admin/image-categories/${categoryId}/images/${imageId}`,
    {
      name: payload.name,
      sortOrder: payload.sortOrder !== undefined ? String(payload.sortOrder) : undefined,
      active: payload.active !== undefined ? String(payload.active) : undefined,
      tier: payload.tier,
      estimatedCredits: payload.estimatedCredits !== undefined ? String(payload.estimatedCredits) : undefined,
    },
  );
  return data;
}

export async function adminDeleteImage(categoryId: string, imageId: string) {
  const { data } = await adminApi.delete<{ success: boolean; imageId: string }>(
    `/admin/image-categories/${categoryId}/images/${imageId}`,
  );
  return data;
}

export async function adminGetWalletOps() {
  const { data } = await adminApi.get<AdminWalletOpsRow[]>('/admin/wallet-ops');
  return data;
}

export async function adminGetPlans() {
  const { data } = await adminApi.get<AdminPlanRow[]>('/admin/plans');
  return data;
}

export async function adminGetBranding() {
  const { data } = await adminApi.get<AdminBrandingResponse>('/admin/branding');
  return data;
}

export async function adminGetNotificationTemplates() {
  const { data } = await adminApi.get<AdminNotificationTemplateRow[]>('/admin/notification-templates');
  return data;
}

export async function adminUpsertNotificationTemplate(payload: AdminNotificationTemplateRow) {
  const { data } = await adminApi.post<AdminNotificationTemplateRow[]>('/admin/notification-templates', payload);
  return data;
}

export async function adminGetTenants() {
  const { data } = await adminApi.get<AdminTenantRow[]>('/admin/tenants');
  return data;
}

export async function adminGetAiConfig() {
  const { data } = await adminApi.get<AdminAiConfigResponse>('/admin/ai-config');
  return data;
}

export async function adminGetSubscriptionPlans() {
  const { data } = await adminApi.get<AdminSubscriptionPlanRow[]>('/admin/subscription-plans');
  return data;
}

export async function adminUpsertSubscriptionPlan(payload: {
  id?: string;
  name: string;
  amountInr: number;
  currency?: string;
  period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  premiumFrames?: boolean;
  monthlyCredits?: number;
  graceDays?: number;
  active?: boolean;
  displayOrder?: number;
}) {
  const { data } = await adminApi.post<AdminSubscriptionPlanRow>('/admin/subscription-plans', payload);
  return data;
}

export async function adminGetSubscriptions() {
  const { data } = await adminApi.get<AdminSubscriptionRow[]>('/admin/subscriptions');
  return data;
}
