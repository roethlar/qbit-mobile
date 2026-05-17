import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/directApi';
import type { LocationPreset } from '../services/directApi';

const PRESETS_KEY = ['location-presets'] as const;

export function useLocationPresets() {
  return useQuery({
    queryKey: PRESETS_KEY,
    queryFn: api.getLocationPresets,
    staleTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateLocationPresets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (locations: LocationPreset[]) => api.putLocationPresets(locations),
    onSuccess: (saved) => {
      // Reflect the server-side validated/trimmed result immediately.
      queryClient.setQueryData(PRESETS_KEY, saved);
    },
  });
}
