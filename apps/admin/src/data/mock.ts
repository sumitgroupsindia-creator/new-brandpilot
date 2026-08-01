export const kpis = [
  { key: 'Revenue (30d)', value: 'INR 12.4L' },
  { key: 'AI Jobs (today)', value: '842' },
  { key: 'Failed Jobs', value: '18' },
  { key: 'Active Tenants', value: '24' },
];

export const failedJobs = [
  { id: 'j-12', queue: 'generation.video', reason: 'provider timeout', when: '2m ago' },
  { id: 'j-15', queue: 'payment.reconcile', reason: 'webhook mismatch', when: '9m ago' },
  { id: 'j-22', queue: 'notification.push', reason: 'device token expired', when: '14m ago' },
];

export const auditRows = [
  { action: 'config.update', actor: 'ops@brandpilot.app', entity: 'ai.openai.timeoutMs', when: '2026-07-30 08:44' },
  { action: 'wallet.refund', actor: 'finance@brandpilot.app', entity: 'user:u-2831', when: '2026-07-30 08:12' },
  { action: 'frame.publish', actor: 'admin@brandpilot.app', entity: 'frame:f-2@v7', when: '2026-07-30 07:53' },
];
