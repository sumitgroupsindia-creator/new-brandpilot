export type AssetKind = 'IMAGE' | 'VIDEO';

export interface FrameItem {
  id: string;
  title: string;
  category: string;
  tier: 'FREE' | 'PREMIUM';
  trending: boolean;
  featured: boolean;
  description: string;
  estimatedCredits: number;
}

export interface AssetItem {
  id: string;
  title: string;
  kind: AssetKind;
  frameName: string;
  createdAt: string;
  creditsUsed: number;
  status: 'SUCCEEDED' | 'FAILED' | 'RUNNING' | 'QUEUED';
}

export interface WalletTxn {
  id: string;
  type: 'CREDIT' | 'DEBIT' | 'REFUND' | 'BONUS' | 'EXPIRY';
  amount: number;
  summary: string;
  createdAt: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  frameName: string;
  updatedAt: string;
}
