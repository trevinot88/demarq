import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // null = loading, false = not authenticated, true = authenticated
  const [authenticated, setAuthenticated] = useState(null);

  useEffect(() => {
    axios.get('/api/auth/me', { withCredentials: true })
      .then(r => setAuthenticated(r.data.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const r = await axios.post('/api/auth/login', { username, password }, { withCredentials: true });
    if (r.data.ok) setAuthenticated(true);
    return r.data;
  }, []);

  const logout = useCallback(async () => {
    await axios.post('/api/auth/logout', {}, { withCredentials: true });
    setAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ authenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
