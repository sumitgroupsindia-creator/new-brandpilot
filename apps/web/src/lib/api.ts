import axios from 'axios';
import { showGlobalDialog, showGlobalToast } from '@brandpilot/shared';
import { DynamicFieldDefinition, FrameInputDraft, FrameTemplateLayer } from '../types/frameFields';

const DEFAULT_TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG ?? 'default';

export const webApi = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let webRefreshRequest: Promise<TokenPairResponse> | null = null;

webApi.interceptors.request.use(config => {
  const accessToken = localStorage.getItem('bp_access_token');
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  if (!config.headers['x-tenant-slug']) {
    config.headers['x-tenant-slug'] = DEFAULT_TENANT_SLUG;
  }

  return config;
});

webApi.interceptors.response.use(
  response => response,
  async error => {
    if (axios.isAxiosError(error) && error.code !== 'ERR_CANCELED') {
      const originalRequest = error.config;
      const shouldTryRefresh =
        error.response?.status === 401 &&
        !originalRequest?.url?.includes('/auth/refresh') &&
        !(originalRequest as typeof originalRequest & { _retry?: boolean })?._retry;

      if (shouldTryRefresh) {
        const storedRefreshToken = localStorage.getItem('bp_refresh_token');
        if (storedRefreshToken) {
          try {
            webRefreshRequest ??= axios
              .post<TokenPairResponse>(
                '/api/auth/refresh',
                { refreshToken: storedRefreshToken },
                { headers: { 'Content-Type': 'application/json', 'x-tenant-slug': DEFAULT_TENANT_SLUG } },
              )
              .then(response => response.data)
              .finally(() => {
                webRefreshRequest = null;
              });

            const refreshed = await webRefreshRequest;
            localStorage.setItem('bp_access_token', refreshed.accessToken);
            localStorage.setItem('bp_refresh_token', refreshed.refreshToken);

            if (originalRequest) {
              (originalRequest as typeof originalRequest & { _retry?: boolean })._retry = true;
              originalRequest.headers.Authorization = `Bearer ${refreshed.accessToken}`;
              return webApi(originalRequest);
            }
          } catch {
            localStorage.removeItem('bp_access_token');
            localStorage.removeItem('bp_refresh_token');
          }
        }
      }

      const message = extractApiErrorMessage(error);
      const status = error.response?.status;

      if (status === 401 || status === 403 || /subscription|plan|premium|access/i.test(message)) {
        showGlobalDialog({
          title: 'Action needs access',
          description: message,
          tone: 'warning',
          confirmLabel: 'Okay',
        });
      } else {
        showGlobalToast({
          title: 'Something went wrong',
          description: message,
          tone: 'error',
        });
      }
    }

    return Promise.reject(error);
  },
);

function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function extractApiErrorMessage(error: unknown) {
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

export interface PublicUserResponse {
  id: string;
  email: string;
  name: string | null;
  themeMode: 'light' | 'dark' | 'system';
  status: string;
  emailVerifiedAt: string | null;
  tenantId: string;
  roles: string[];
  createdAt: string;
}

export interface FrameResponse {
  id: string;
  title: string;
  categoryId?: string | null;
  category: string;
  thumbnailUrl?: string | null;
  dynamicFields?: DynamicFieldDefinition[];
  templateLayers?: FrameTemplateLayer[];
  renderSize?: {
    width: number;
    height: number;
  };
  tier: 'FREE' | 'PREMIUM';
  trending: boolean;
  featured: boolean;
  description: string;
  estimatedCredits: number;
  requiresSubscription?: boolean;
  isLocked?: boolean;
}

export interface FrameCategoryResponse {
  id: string;
  name: string;
  parentId?: string | null;
  sortOrder: number;
  active: boolean;
}

export interface ImageCategoryResponse {
  id: string;
  name: string;
  parentId?: string | null;
  sortOrder: number;
  images: Array<{
    id: string;
    name: string;
    url: string;
    sortOrder: number;
    tier?: 'FREE' | 'PREMIUM';
    estimatedCredits?: number;
    isLocked?: boolean;
    isUnlocked?: boolean;
  }>;
}

export interface SubscriptionPlanResponse {
  id: string;
  name: string;
  amountInr: number;
  currency: string;
  period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  premiumFrames: boolean;
  monthlyCredits: number;
  graceDays: number;
  active: boolean;
}

export interface MySubscriptionResponse {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'IN_GRACE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
  providerSubId: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  plan: {
    id: string;
    name: string;
    amountInr: number;
    period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    premiumFrames: boolean;
    monthlyCredits: number;
  };
}

export interface CreateSubscriptionResponse {
  subscriptionId: string;
  providerSubId: string;
  status: 'PENDING' | 'ACTIVE' | 'IN_GRACE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
  currentPeriodEnd: string | null;
  idempotent?: boolean;
}

export interface AssetResponse {
  id: string;
  title: string;
  kind: 'IMAGE' | 'VIDEO';
  frameName: string;
  createdAt: string;
  creditsUsed: number;
  status: 'SUCCEEDED' | 'FAILED' | 'RUNNING' | 'QUEUED';
  outputUrl?: string | null;
}

export interface ProjectResponse {
  id: string;
  name: string;
  frameName: string;
  updatedAt: string;
}

export interface WalletSummaryResponse {
  available: number;
  held: number;
  lowBalanceThreshold: number;
}

export interface WalletLedgerResponse {
  id: string;
  type: 'CREDIT' | 'DEBIT' | 'REFUND' | 'BONUS' | 'EXPIRY';
  amount: number;
  summary: string;
  createdAt: string;
}

export interface WalletPlanResponse {
  id: string;
  amountInr: number;
  credits: number;
  bonus: number;
  active: boolean;
}

export interface CreateRechargeOrderResponse {
  orderId: string;
  providerOrderId: string;
  amountInr: number;
  amountPaise: number;
  credits: number;
  bonusCredits: number;
  currency: string;
  razorpayKeyId: string;
  idempotent?: boolean;
}

export interface ConfirmRechargeOrderResponse {
  success: boolean;
  orderId: string;
  status: 'CREATED' | 'PAID' | 'FAILED' | 'EXPIRED';
  balance: number;
  credited?: number;
  idempotent: boolean;
}

export interface GenerationJobCreateRequest {
  frameId: string;
  imageId?: string;
  kind: 'IMAGE' | 'VIDEO';
  prompt: string;
  title?: string;
  negativePrompt?: string;
  model?: string;
  frameInputs?: FrameInputDraft;
}

export interface GenerationJobCreateResponse {
  jobId: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  creditsHeld: number;
  idempotent?: boolean;
}

export type NotificationEventKey =
  | 'RECHARGE_SUCCESS'
  | 'RECHARGE_FAILED'
  | 'GENERATION_COMPLETED'
  | 'GENERATION_FAILED'
  | 'WALLET_LOW_BALANCE';

export interface NotificationPreferenceResponse {
  eventKey: NotificationEventKey;
  email: boolean;
  push: boolean;
  inApp: boolean;
}

export interface NotificationEventResponse {
  id: string;
  eventKey: NotificationEventKey;
  channel: 'EMAIL' | 'PUSH' | 'IN_APP';
  title: string;
  body: string;
  status: string;
  metadata?: Record<string, unknown>;
  deliveredAt: string | null;
  createdAt: string;
}

export async function apiLogin(payload: {
  email: string;
  password: string;
  deviceName?: string;
}) {
  const { data } = await webApi.post<TokenPairResponse>('/auth/login', payload);
  return data;
}

export async function apiRegister(payload: {
  name?: string;
  email: string;
  password: string;
}) {
  const { data } = await webApi.post<TokenPairResponse>('/auth/register', payload);
  return data;
}

export async function apiRefresh(refreshToken: string) {
  const { data } = await webApi.post<TokenPairResponse>('/auth/refresh', { refreshToken });
  return data;
}

export async function apiGetMe() {
  const { data } = await webApi.get<PublicUserResponse>('/me');
  return data;
}

export async function apiUpdateMe(payload: { name?: string; themeMode?: 'light' | 'dark' | 'system' }) {
  const { data } = await webApi.patch<PublicUserResponse>('/me', payload);
  return data;
}

export async function apiGetPublicConfig() {
  const { data } = await webApi.get<Record<string, Record<string, unknown>>>('/config/public');
  return data;
}

export async function apiGetFrames() {
  const { data } = await webApi.get<FrameResponse[]>('/frames');
  return data;
}

export async function apiGetFramesByCategory(params?: {
  categoryId?: string;
  filter?: 'all' | 'featured' | 'trending';
}) {
  const { data } = await webApi.get<FrameResponse[]>('/frames', {
    params: {
      ...(params?.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params?.filter ? { filter: params.filter } : {}),
    },
  });
  return data;
}

export async function apiGetFrame(frameId: string) {
  const { data } = await webApi.get<FrameResponse>(`/frames/${frameId}`);
  return data;
}

export async function apiGetFrameCategories() {
  const { data } = await webApi.get<FrameCategoryResponse[]>('/frame-categories');
  return data;
}

export async function apiGetImageCategories() {
  const { data } = await webApi.get<ImageCategoryResponse[]>('/image-categories');
  return data;
}

export async function apiGetAssets() {
  const { data } = await webApi.get<AssetResponse[]>('/assets');
  return data;
}

export async function apiGetProjects() {
  const { data } = await webApi.get<ProjectResponse[]>('/projects');
  return data;
}

export async function apiGetWalletSummary() {
  const { data } = await webApi.get<WalletSummaryResponse>('/wallet/summary');
  return data;
}

export async function apiGetWalletLedger() {
  const { data } = await webApi.get<WalletLedgerResponse[]>('/wallet/ledger');
  return data;
}

export async function apiGetWalletPlans() {
  const { data } = await webApi.get<WalletPlanResponse[]>('/wallet/plans');
  return data;
}

export async function apiCreateRechargeOrder(planId: string) {
  const { data } = await webApi.post<CreateRechargeOrderResponse>(
    '/wallet/recharge/order',
    { planId },
    { headers: { 'Idempotency-Key': createIdempotencyKey() } },
  );
  return data;
}

export async function apiConfirmRechargeOrder(payload: { orderId: string; paymentId: string; signature?: string }) {
  const { data } = await webApi.post<ConfirmRechargeOrderResponse>(
    '/wallet/recharge/confirm',
    payload,
    { headers: { 'Idempotency-Key': createIdempotencyKey() } },
  );
  return data;
}

export async function apiCreateGenerationJob(payload: GenerationJobCreateRequest) {
  const { data } = await webApi.post<GenerationJobCreateResponse>(
    '/generation/jobs',
    payload,
    { headers: { 'Idempotency-Key': createIdempotencyKey() } },
  );
  return data;
}

export async function apiGetGenerationJobs() {
  const { data } = await webApi.get<AssetResponse[]>('/generation/jobs');
  return data;
}

export async function apiGetNotificationPreferences() {
  const { data } = await webApi.get<NotificationPreferenceResponse[]>('/notifications/preferences');
  return data;
}

export async function apiUpdateNotificationPreferences(preferences: NotificationPreferenceResponse[]) {
  const { data } = await webApi.post<NotificationPreferenceResponse[]>('/notifications/preferences', { preferences });
  return data;
}

export async function apiGetNotificationEvents(limit = 30) {
  const { data } = await webApi.get<NotificationEventResponse[]>('/notifications/events', { params: { limit } });
  return data;
}

export async function apiGetSubscriptionPlans() {
  const { data } = await webApi.get<SubscriptionPlanResponse[]>('/subscription-plans');
  return data;
}

export async function apiGetMySubscription() {
  const { data } = await webApi.get<MySubscriptionResponse | null>('/me/subscription');
  return data;
}

export async function apiCreateSubscription(planId: string) {
  const { data } = await webApi.post<CreateSubscriptionResponse>(
    '/subscriptions',
    { planId },
    { headers: { 'Idempotency-Key': createIdempotencyKey() } },
  );
  return data;
}

export async function apiCancelSubscription() {
  const { data } = await webApi.post<{ subscriptionId: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null }>(
    '/subscriptions/cancel',
    {},
    { headers: { 'Idempotency-Key': createIdempotencyKey() } },
  );
  return data;
}

export async function apiResumeSubscription() {
  const { data } = await webApi.post<{ subscriptionId: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null }>(
    '/subscriptions/resume',
    {},
    { headers: { 'Idempotency-Key': createIdempotencyKey() } },
  );
  return data;
}
