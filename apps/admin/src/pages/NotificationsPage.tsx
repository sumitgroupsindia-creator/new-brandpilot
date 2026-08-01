import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PagePanel } from '../components/PagePanel';
import {
  adminGetNotificationTemplates,
  adminUpsertNotificationTemplate,
  AdminNotificationTemplateRow,
} from '../lib/api';

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const templatesQuery = useQuery({
    queryKey: ['admin-notification-templates'],
    queryFn: adminGetNotificationTemplates,
  });

  const [event, setEvent] = useState('GENERATION_COMPLETED');
  const [channel, setChannel] = useState('EMAIL');
  const [locale, setLocale] = useState('en');
  const [title, setTitle] = useState('Your asset is ready');
  const [body, setBody] = useState('Hello {{name}}, your asset {{assetId}} is ready.');
  const [active, setActive] = useState(true);

  const upsertTemplate = useMutation({
    mutationFn: (payload: AdminNotificationTemplateRow) => adminUpsertNotificationTemplate(payload),
    onSuccess: data => {
      queryClient.setQueryData(['admin-notification-templates'], data);
    },
  });

  const templates = templatesQuery.data ?? [];

  const onSave = async () => {
    const id = `${event.toLowerCase()}_${channel.toLowerCase()}_${locale.toLowerCase()}`;
    await upsertTemplate.mutateAsync({
      id,
      event,
      channel,
      locale,
      title,
      body,
      active,
    });
  };

  return (
    <PagePanel title="Notification Templates" subtitle="Editable templates for email, push, and in-app.">
      {templatesQuery.isLoading ? <p className="mb-3 text-sm text-slate-500">Loading templates...</p> : null}
      {templatesQuery.isError ? <p className="mb-3 text-sm text-rose-700">Failed to load templates.</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <select className="field" value={event} onChange={event => setEvent(event.target.value)}>
          <option value="RECHARGE_SUCCESS">Event: recharge success</option>
          <option value="RECHARGE_FAILED">Event: recharge failed</option>
          <option value="GENERATION_COMPLETED">Event: generation completed</option>
          <option value="GENERATION_FAILED">Event: generation failed</option>
          <option value="WALLET_LOW_BALANCE">Event: wallet low balance</option>
        </select>
        <select className="field" value={channel} onChange={event => setChannel(event.target.value)}>
          <option value="EMAIL">Channel: email</option>
          <option value="PUSH">Channel: push</option>
          <option value="IN_APP">Channel: in-app</option>
        </select>
        <input className="field" value={locale} onChange={event => setLocale(event.target.value)} placeholder="Locale (e.g. en)" />
        <input className="field" value={title} onChange={event => setTitle(event.target.value)} placeholder="Title template" />
        <textarea className="field md:col-span-2" rows={5} value={body} onChange={event => setBody(event.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />
          Active
        </label>
        <button className="btn-dark md:col-span-2" type="button" onClick={onSave} disabled={upsertTemplate.isPending}>
          {upsertTemplate.isPending ? 'Saving...' : 'Save template'}
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {templates.map(template => (
          <article key={template.id} className="rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-900">
              {template.event} • {template.channel} • {template.locale} • {template.active ? 'active' : 'inactive'}
            </p>
            <p className="text-xs text-slate-700">{template.title}</p>
            <p className="text-xs text-slate-600">{template.body}</p>
          </article>
        ))}
      </div>
    </PagePanel>
  );
}
