import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  apiGetNotificationEvents,
  apiGetNotificationPreferences,
  apiUpdateNotificationPreferences,
  NotificationPreferenceResponse,
} from '../lib/api';

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: apiGetNotificationPreferences,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: NotificationPreferenceResponse[]) => apiUpdateNotificationPreferences(preferences),
    onSuccess: data => {
      queryClient.setQueryData(['notification-preferences'], data);
    },
  });
}

export function useNotificationEvents(limit = 30) {
  return useQuery({
    queryKey: ['notification-events', limit],
    queryFn: () => apiGetNotificationEvents(limit),
    refetchInterval: 15000,
  });
}
