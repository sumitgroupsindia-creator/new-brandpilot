import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShellCard } from '../../components/ShellCard';
import { useMe, useUpdateMe } from '../../hooks/useAuth';
import {
  useNotificationEvents,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '../../hooks/useNotifications';
import {
  apiCancelSubscription,
  apiCreateSubscription,
  apiGetMySubscription,
  apiGetSubscriptionPlans,
  apiResumeSubscription,
  NotificationPreferenceResponse,
} from '../../lib/api';
import { readLocalProfileFields, writeLocalProfileFields } from '../../lib/profileFields';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const me = useMe();
  const updateMe = useUpdateMe();
  const preferencesQuery = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const eventsQuery = useNotificationEvents(20);
  const plansQuery = useQuery({ queryKey: ['subscription-plans'], queryFn: apiGetSubscriptionPlans });
  const mySubscriptionQuery = useQuery({ queryKey: ['my-subscription'], queryFn: apiGetMySubscription });
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [tagline, setTagline] = useState('');
  const [preferences, setPreferences] = useState<NotificationPreferenceResponse[]>([]);

  const createSubscriptionMutation = useMutation({
    mutationFn: apiCreateSubscription,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
      await queryClient.invalidateQueries({ queryKey: ['frames'] });
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: apiCancelSubscription,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
    },
  });

  const resumeSubscriptionMutation = useMutation({
    mutationFn: apiResumeSubscription,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
    },
  });

  useEffect(() => {
    if (me.data?.name) {
      setName(me.data.name);
    }
  }, [me.data?.name]);

  useEffect(() => {
    const localProfile = readLocalProfileFields();
    setCompany(localProfile.company);
    setPhone(localProfile.phone);
    setWebsite(localProfile.website);
    setAddress(localProfile.address);
    setTagline(localProfile.tagline);
  }, []);

  useEffect(() => {
    if (preferencesQuery.data) {
      setPreferences(preferencesQuery.data);
    }
  }, [preferencesQuery.data]);

  const onSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await updateMe.mutateAsync({ name });
    writeLocalProfileFields({
      company: company.trim(),
      phone: phone.trim(),
      website: website.trim(),
      address: address.trim(),
      tagline: tagline.trim(),
    });
  };

  const onTogglePreference = (
    eventKey: string,
    field: 'email' | 'push' | 'inApp',
    value: boolean,
  ) => {
    setPreferences(current =>
      current.map(item => (item.eventKey === eventKey ? { ...item, [field]: value } : item)),
    );
  };

  const onSavePreferences = async () => {
    await updatePreferences.mutateAsync(preferences);
  };

  const currentSubscription = mySubscriptionQuery.data;
  const plans = plansQuery.data ?? [];

  return (
    <>
      <ShellCard title="Profile Settings" subtitle="Manage account and session preferences.">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onSaveProfile}>
          <input className="field" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
          <input className="field" placeholder="Email" value={me.data?.email ?? ''} disabled />
          <input className="field" placeholder="Company" value={company} onChange={e => setCompany(e.target.value)} />
          <input className="field" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
          <input className="field" placeholder="Website" value={website} onChange={e => setWebsite(e.target.value)} />
          <input className="field" placeholder="Tagline" value={tagline} onChange={e => setTagline(e.target.value)} />
          <textarea
            className="field md:col-span-2"
            placeholder="Address"
            rows={3}
            value={address}
            onChange={e => setAddress(e.target.value)}
          />
          <select className="field">
            <option>English</option>
          </select>
          <button className="btn-primary md:col-span-2" type="submit" disabled={updateMe.isPending}>
            {updateMe.isPending ? 'Saving...' : 'Save profile'}
          </button>
        </form>

        {updateMe.isSuccess ? <p className="mt-3 text-sm text-teal-700">Profile updated.</p> : null}
      </ShellCard>

      <ShellCard title="Notification Preferences" subtitle="Event/channel controls.">
        <div className="space-y-4 text-sm text-slate-700">
          {preferences.map(item => (
            <div key={item.eventKey} className="rounded-xl border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-800">{item.eventKey.replace(/_/g, ' ')}</p>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.email}
                    onChange={event => onTogglePreference(item.eventKey, 'email', event.target.checked)}
                  />
                  Email
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.push}
                    onChange={event => onTogglePreference(item.eventKey, 'push', event.target.checked)}
                  />
                  Push
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.inApp}
                    onChange={event => onTogglePreference(item.eventKey, 'inApp', event.target.checked)}
                  />
                  In-app
                </label>
              </div>
            </div>
          ))}

          <button
            className="btn-primary"
            type="button"
            onClick={onSavePreferences}
            disabled={updatePreferences.isPending || preferences.length === 0 || preferencesQuery.isLoading}
          >
            {updatePreferences.isPending
              ? 'Saving...'
              : preferencesQuery.isLoading
                ? 'Loading...'
                : 'Save notification preferences'}
          </button>

          {updatePreferences.isSuccess ? <p className="text-xs text-teal-700">Notification settings updated.</p> : null}
        </div>
      </ShellCard>

      <ShellCard title="Subscription" subtitle="Manage premium frame access.">
        {mySubscriptionQuery.isLoading ? <p className="text-sm text-slate-500">Loading subscription...</p> : null}
        {currentSubscription ? (
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-semibold">Plan:</span> {currentSubscription.plan.name}
            </p>
            <p>
              <span className="font-semibold">Status:</span> {currentSubscription.status}
            </p>
            <p>
              <span className="font-semibold">Current period end:</span>{' '}
              {currentSubscription.currentPeriodEnd ? new Date(currentSubscription.currentPeriodEnd).toLocaleString() : 'N/A'}
            </p>
            <div className="flex flex-wrap gap-2">
              {!currentSubscription.cancelAtPeriodEnd ? (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => cancelSubscriptionMutation.mutate()}
                  disabled={cancelSubscriptionMutation.isPending}
                >
                  {cancelSubscriptionMutation.isPending ? 'Cancelling...' : 'Cancel at period end'}
                </button>
              ) : (
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => resumeSubscriptionMutation.mutate()}
                  disabled={resumeSubscriptionMutation.isPending}
                >
                  {resumeSubscriptionMutation.isPending ? 'Resuming...' : 'Resume subscription'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">No active subscription. Choose a plan to unlock premium frames.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {plans.map(plan => (
                <div key={plan.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-semibold text-slate-900">{plan.name}</p>
                  <p className="text-sm text-slate-600">
                    INR {plan.amountInr} / {plan.period.toLowerCase()}
                  </p>
                  <button
                    className="btn-primary mt-3"
                    type="button"
                    onClick={() => createSubscriptionMutation.mutate(plan.id)}
                    disabled={createSubscriptionMutation.isPending}
                  >
                    {createSubscriptionMutation.isPending ? 'Starting...' : 'Subscribe'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </ShellCard>

      <ShellCard title="Recent Notifications" subtitle="Latest delivery attempts and in-app events.">
        <div className="space-y-2 text-sm text-slate-700">
          {(eventsQuery.data ?? []).map(event => (
            <div key={event.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-800">{event.title}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] uppercase text-slate-700">
                  {event.channel} • {event.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{event.body}</p>
              <p className="mt-1 text-[11px] text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
            </div>
          ))}
          {!eventsQuery.isLoading && (eventsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-xs text-slate-500">No notifications yet.</p>
          ) : null}
        </div>
      </ShellCard>
    </>
  );
}
