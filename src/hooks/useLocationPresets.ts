import { useQuery } from '@tanstack/react-query';
import * as api from '../services/directApi';

// Presets rarely change at runtime (they come from DOWNLOAD_LOCATIONS env at
// boot), so a long staleTime + one retry on failure is the sensible cadence.
export function useLocationPresets() {
  return useQuery({
    queryKey: ['location-presets'],
    queryFn: api.getLocationPresets,
    staleTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
