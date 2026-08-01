import { AssetItem, FrameItem, ProjectItem, WalletTxn } from '../types/domain';

export const mockFrames: FrameItem[] = [
  {
    id: 'f-1',
    title: 'Executive Business Intro',
    category: 'Business Cards',
    tier: 'FREE',
    trending: true,
    featured: true,
    description: 'A clean corporate frame with logo and contact emphasis.',
    estimatedCredits: 10,
  },
  {
    id: 'f-2',
    title: 'Monsoon Sale Burst',
    category: 'Festival Campaigns',
    tier: 'PREMIUM',
    trending: true,
    featured: false,
    description: 'High-impact promo frame with strong CTA zones.',
    estimatedCredits: 16,
  },
  {
    id: 'f-3',
    title: 'Startup Product Spotlight',
    category: 'Product Ads',
    tier: 'FREE',
    trending: false,
    featured: true,
    description: 'Hero-style spotlight suitable for app launches.',
    estimatedCredits: 12,
  },
];

export const mockAssets: AssetItem[] = [
  {
    id: 'a-1',
    title: 'Q3 Promo V1',
    kind: 'IMAGE',
    frameName: 'Monsoon Sale Burst',
    createdAt: '2026-07-28T08:40:00Z',
    creditsUsed: 16,
    status: 'SUCCEEDED',
  },
  {
    id: 'a-2',
    title: 'Founder Intro Reel',
    kind: 'VIDEO',
    frameName: 'Executive Business Intro',
    createdAt: '2026-07-29T11:10:00Z',
    creditsUsed: 40,
    status: 'RUNNING',
  },
  {
    id: 'a-3',
    title: 'Launch Poster',
    kind: 'IMAGE',
    frameName: 'Startup Product Spotlight',
    createdAt: '2026-07-29T17:05:00Z',
    creditsUsed: 12,
    status: 'SUCCEEDED',
  },
];

export const mockWalletTxns: WalletTxn[] = [
  {
    id: 'w-1',
    type: 'CREDIT',
    amount: 100,
    summary: 'Recharge: Growth 499 Plan',
    createdAt: '2026-07-26T10:20:00Z',
  },
  {
    id: 'w-2',
    type: 'DEBIT',
    amount: -16,
    summary: 'Image generation: Monsoon Sale Burst',
    createdAt: '2026-07-28T08:41:00Z',
  },
  {
    id: 'w-3',
    type: 'BONUS',
    amount: 20,
    summary: 'Promotional top-up',
    createdAt: '2026-07-28T09:00:00Z',
  },
  {
    id: 'w-4',
    type: 'DEBIT',
    amount: -40,
    summary: 'Video generation: Founder Intro Reel',
    createdAt: '2026-07-29T11:11:00Z',
  },
];

export const mockProjects: ProjectItem[] = [
  {
    id: 'p-1',
    name: 'Independence Day Campaign',
    frameName: 'Monsoon Sale Burst',
    updatedAt: '2026-07-29T20:00:00Z',
  },
  {
    id: 'p-2',
    name: 'Founder Launch Intro',
    frameName: 'Executive Business Intro',
    updatedAt: '2026-07-27T14:20:00Z',
  },
];
