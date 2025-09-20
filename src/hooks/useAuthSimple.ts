import { useState, useEffect } from 'react';
import { qbApi } from '../services/api';

export function useAuthSimple() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Try to login with empty credentials for local bypass
    const initAuth = async () => {
      try {
        // Ensure API is initialized first
        await qbApi.ensureInitialized();
      } catch (error) {
        // Auth initialization error
      } finally {
        // Always proceed - qBittorrent is configured for local access
        setIsReady(true);
      }
    };

    initAuth();
  }, []);

  return {
    isReady,
    isAuthenticated: isReady, // Always authenticated for local access
    isLoading: !isReady
  };
}