import React, { createContext, useContext, useMemo, useState } from 'react';
import { getTheme } from '../theme';

const ThemeContext = createContext({
  mode: 'dark',
  setMode: () => {},
  toggleTheme: () => {},
  theme: getTheme('dark')
});

export const ThemeProvider = ({ children, initialMode = 'dark' }) => {
  const [mode, setMode] = useState(initialMode);

  const value = useMemo(() => ({
    mode,
    setMode,
    toggleTheme: () => setMode(prev => (prev === 'dark' ? 'light' : 'dark')),
    theme: getTheme(mode)
  }), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext debe usarse dentro de ThemeProvider');
  }
  return context;
};

export default ThemeContext;
