import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('sunrise_token');
    if (!token) {
      setUser(null);
      setPolicy(null);
      setLoading(false);
      return;
    }
    try {
      const res = await client.get('/auth/me');
      setUser(res.data.user);
      setPolicy(res.data.policy);
    } catch {
      setUser(null);
      setPolicy(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    const res = await client.post('/auth/login', { email, password });
    localStorage.setItem('sunrise_token', res.data.token);
    setUser(res.data.user);
    setPolicy(res.data.policy);
    return res.data.user;
  };

  const logout = async () => {
    try {
      await client.post('/auth/logout');
    } catch {
      /* token may already be invalid */
    }
    localStorage.removeItem('sunrise_token');
    setUser(null);
    setPolicy(null);
  };

  return (
    <AuthContext.Provider value={{ user, policy, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
