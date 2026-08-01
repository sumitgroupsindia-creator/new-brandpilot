import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PagePanel } from '../components/PagePanel';
import { adminGetConfigNamespace, adminUpdateConfig } from '../lib/api';

export function ConfigPage() {
  const [namespace, setNamespace] = useState('limits');
  const [key, setKey] = useState('gen.perUser.daily');
  const [value, setValue] = useState('100');

  const namespaceQuery = useQuery({
    queryKey: ['admin-config-namespace', namespace],
    queryFn: () => adminGetConfigNamespace(namespace),
  });

  const saveMutation = useMutation({
    mutationFn: () => adminUpdateConfig(namespace, key, value, 'Updated from admin config page'),
  });

  const namespaceKeys = useMemo(() => Object.keys(namespaceQuery.data ?? {}), [namespaceQuery.data]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveMutation.mutateAsync();
  };

  return (
    <PagePanel title="System Config" subtitle="Runtime key/value namespaces with rollback support.">
      <form className="grid gap-3 md:grid-cols-3" onSubmit={onSubmit}>
        <select className="field" value={namespace} onChange={e => setNamespace(e.target.value)}>
          <option value="limits">limits</option>
          <option value="billing">billing</option>
          <option value="flags">flags</option>
          <option value="branding">branding</option>
          <option value="ai">ai</option>
        </select>
        <input className="field" placeholder="Key" value={key} onChange={e => setKey(e.target.value)} />
        <input className="field" placeholder="Value" value={value} onChange={e => setValue(e.target.value)} />
        <button className="btn-dark md:col-span-3" type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : 'Save versioned config'}
        </button>
      </form>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-sm font-semibold text-slate-900">Namespace keys</p>
        {namespaceQuery.isLoading ? <p className="text-sm text-slate-500">Loading...</p> : null}
        {namespaceQuery.isError ? <p className="text-sm text-rose-700">Failed to load namespace.</p> : null}
        {!namespaceQuery.isLoading && !namespaceQuery.isError ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {namespaceKeys.length === 0 ? (
              <span className="text-sm text-slate-500">No keys found.</span>
            ) : (
              namespaceKeys.map(item => (
                <button key={item} type="button" className="btn-soft" onClick={() => setKey(item)}>
                  {item}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      {saveMutation.isSuccess ? <p className="mt-3 text-sm text-emerald-700">Config updated.</p> : null}
      {saveMutation.isError ? <p className="mt-3 text-sm text-rose-700">Unable to save config.</p> : null}
    </PagePanel>
  );
}
