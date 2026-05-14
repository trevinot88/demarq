import { createContext, useContext, useState, useEffect } from 'react';

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const [role, setRole] = useState(() => localStorage.getItem('ca_role') || 'CEO');

  useEffect(() => {
    localStorage.setItem('ca_role', role);
  }, [role]);

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
