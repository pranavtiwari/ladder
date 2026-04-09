import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'neon-court' | 'glassmorphism' | 'midnight-navy' | 'clay-court';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const ALL_THEMES: Theme[] = ['neon-court', 'glassmorphism', 'midnight-navy', 'clay-court'];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('app-theme') as Theme;
    return saved && ALL_THEMES.includes(saved) ? saved : 'glassmorphism';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('app-theme', newTheme);
  };

  useEffect(() => {
    // Sync theme class to body
    ALL_THEMES.forEach(t => document.body.classList.remove(`theme-${t}`));
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
