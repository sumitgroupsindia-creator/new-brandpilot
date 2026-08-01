import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@shared/components/shared/PageHeader';
import { SectionHeader } from '@shared/components/shared/SectionHeader';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { ErrorState } from '@shared/components/ui/ErrorState';
import { LoadingState } from '@shared/components/ui/LoadingState';
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

  const onTogglePreference = (eventKey: string, field: 'email' | 'push' | 'inApp', value: boolean) => {
    setPreferences(current => current.map(item => (item.eventKey === eventKey ? { ...item, [field]: value } : item)));
  };

  const onSavePreferences = async () => {
    await updatePreferences.mutateAsync(preferences);
  };

  const currentSubscription = mySubscriptionQuery.data;
  const plans = plansQuery.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Account and Personalization"
        title="Settings"
        description="Manage profile, notifications, subscription, and recent system communication in a single workspace."
      />

      <Card className="p-4 sm:p-5">
        <SectionHeader title="Profile Settings" subtitle="Manage account and session preferences." />
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onSaveProfile}>
          <input className="field" placeholder="Name" value={name} onChange={event => setName(event.target.value)} />
          <input className="field" placeholder="Email" value={me.data?.email ?? ''} disabled />
          <input className="field" placeholder="Company" value={company} onChange={event => setCompany(event.target.value)} />
          <input className="field" placeholder="Phone" value={phone} onChange={event => setPhone(event.target.value)} />
          <input className="field" placeholder="Website" value={website} onChange={event => setWebsite(event.target.value)} />
          <input className="field" placeholder="Tagline" value={tagline} onChange={event => setTagline(event.target.value)} />
          <textarea className="field md:col-span-2" placeholder="Address" rows={3} value={address} onChange={event => setAddress(event.target.value)} />
          <select className="field">
            <option>English</option>
          </select>
          <Button className="md:col-span-2" type="submit" loading={updateMe.isPending}>Save profile</Button>
        </form>
        {updateMe.isSuccess ? <p className="mt-3 text-sm text-[var(--color-success-700)]">Profile updated.</p> : null}
      </Card>

      <Card className="p-4 sm:p-5">
        <SectionHeader title="Notification Preferences" subtitle="Event/channel controls." />
        {preferencesQuery.isLoading ? <LoadingState lines={3} /> : null}
        {preferencesQuery.isError ? <ErrorState description="Failed to load preferences." /> : null}

        {!preferencesQuery.isLoading && !preferencesQuery.isError ? (
          <div className="space-y-4 text-sm text-slate-700">
            {preferences.map(item => (
              <div key={item.eventKey} className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-800">{item.eventKey.replace(/_/g, ' ')}</p>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={item.email} onChange={event => onTogglePreference(item.eventKey, 'email', event.target.checked)} />
                    Email
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={item.push} onChange={event => onTogglePreference(item.eventKey, 'push', event.target.checked)} />
                    Push
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={item.inApp} onChange={event => onTogglePreference(item.eventKey, 'inApp', event.target.checked)} />
                    In-app
                  </label>
                </div>
              </div>
            ))}

            <Button
              type="button"
              onClick={onSavePreferences}
              loading={updatePreferences.isPending}
              disabled={preferences.length === 0 || preferencesQuery.isLoading}
            >
              Save notification preferences
            </Button>

            {updatePreferences.isSuccess ? <p className="text-xs text-[var(--color-success-700)]">Notification settings updated.</p> : null}
          </div>
        ) : null}
      </Card>

      <Card className="p-4 sm:p-5">
        <SectionHeader title="Subscription" subtitle="Manage premium frame access." />
        {mySubscriptionQuery.isLoading ? <LoadingState lines={2} /> : null}

        {!mySubscriptionQuery.isLoading ? (
          currentSubscription ? (
            <div className="space-y-3 text-sm text-slate-700">
              <p><span className="font-semibold">Plan:</span> {currentSubscription.plan.name}</p>
              <p><span className="font-semibold">Status:</span> {currentSubscription.status}</p>
              <p>
                <span className="font-semibold">Current period end:</span>{' '}
                {currentSubscription.currentPeriodEnd ? new Date(currentSubscription.currentPeriodEnd).toLocaleString() : 'N/A'}
              </p>
              <div className="flex flex-wrap gap-2">
                {!currentSubscription.cancelAtPeriodEnd ? (
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => cancelSubscriptionMutation.mutate()}
                    loading={cancelSubscriptionMutation.isPending}
                  >
                    Cancel at period end
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => resumeSubscriptionMutation.mutate()}
                    loading={resumeSubscriptionMutation.isPending}
                  >
                    Resume subscription
                  </Button>
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
                    <p className="text-sm text-slate-600">INR {plan.amountInr} / {plan.period.toLowerCase()}</p>
                    <Button className="mt-3" type="button" onClick={() => createSubscriptionMutation.mutate(plan.id)} loading={createSubscriptionMutation.isPending}>
                      Subscribe
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : null}
      </Card>

      <Card className="p-4 sm:p-5">
        <SectionHeader title="Recent Notifications" subtitle="Latest delivery attempts and in-app events." />
        {eventsQuery.isLoading ? <LoadingState lines={3} /> : null}
        {eventsQuery.isError ? <ErrorState description="Failed to load notifications." /> : null}

        {!eventsQuery.isLoading && !eventsQuery.isError ? (
          (eventsQuery.data ?? []).length ? (
            <div className="space-y-2 text-sm text-slate-700">
              {(eventsQuery.data ?? []).map(event => (
                <div key={event.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-800">{event.title}</p>
                    <Badge variant="default">{event.channel} • {event.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{event.body}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{new Date(event.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No notifications yet" description="Events will appear here after activity in generation, wallet, or subscription flows." />
          )
        ) : null}
      </Card>
    </>
  );
}
