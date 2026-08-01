import { useQuery } from '@tanstack/react-query';
import { PagePanel } from '../components/PagePanel';
import { adminGetAiConfig } from '../lib/api';

export function AiConfigPage() {
  const aiConfigQuery = useQuery({ queryKey: ['admin-ai-config'], queryFn: adminGetAiConfig });
  const aiConfig = aiConfigQuery.data;

  return (
    <PagePanel title="AI Configuration" subtitle="Providers, keys, limits, and retries.">
      {aiConfigQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading AI config...</p> : null}
      {aiConfigQuery.isError ? <p className="mb-3 text-sm text-rose-700">Failed to load AI config.</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <select className="field"><option>{`Default image provider: ${aiConfig?.imageProvider ?? 'openai'}`}</option></select>
        <select className="field"><option>{`Default video provider: ${aiConfig?.videoProvider ?? 'runway'}`}</option></select>
        <input className="field" placeholder="openai.timeoutMs" defaultValue={String(aiConfig?.openaiTimeoutMs ?? '')} />
        <input className="field" placeholder="openai.retries" defaultValue={String(aiConfig?.openaiRetries ?? '')} />
        <input className="field" placeholder="runway.timeoutMs" defaultValue={String(aiConfig?.runwayTimeoutMs ?? '')} />
        <input className="field" placeholder="runway.retries" defaultValue={String(aiConfig?.runwayRetries ?? '')} />
        <button className="btn-dark md:col-span-2" type="button">Save AI config</button>
      </div>
    </PagePanel>
  );
}
