import { useState, useEffect, useCallback } from 'react';
import { qbApi } from '../services/api';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authBypassed, setAuthBypassed] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      let authenticated = await qbApi.checkAuth();
      
      // If not authenticated, try empty credentials for local bypass
      if (!authenticated) {
        const result = await qbApi.login('', '');
        if (result.success) {
          authenticated = true;
          setAuthBypassed(true);
        }
      } else {
        setAuthBypassed(true);
      }
      
      setIsAuthenticated(authenticated);
    } catch (err) {
      setIsAuthenticated(false);
      setAuthBypassed(false);
    } finally {
      setIsLoading(false);
    }
  }, []); // Remove authBypassed dependency to avoid circular reference

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await qbApi.login(username, password);
      if (result.success) {
        setIsAuthenticated(true);
        setAuthBypassed(false);
      } else {
        setError(result.message || 'Login failed');
        setIsAuthenticated(false);
      }
    } catch (err) {
      setError('Connection failed');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!authBypassed) {
        await qbApi.logout();
      }
    } finally {
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  }, [authBypassed]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    checkAuth,
    authBypassed
  };
}