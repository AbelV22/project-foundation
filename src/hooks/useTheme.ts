import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'auto';

// Barcelona timezone offset
const getBarcelonaHour = (): number => {
  const now = new Date();
  // Get Barcelona time
  const barcelonaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  return barcelonaTime.getHours();
};

const isDayTime = (): boolean => {
  const hour = getBarcelonaHour();
  // Day time: 7:00 - 20:00
  return hour >= 7 && hour < 20;
};

const getSystemTheme = (): 'light' | 'dark' => {
  return isDayTime() ? 'light' : 'dark';
};

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'auto';
    const saved = localStorage.getItem('theme') as Theme | null;
    return saved || 'auto';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved === 'light' || saved === 'dark') return saved;
    return getSystemTheme();
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = () => {
      let effectiveTheme: 'light' | 'dark';
      
      if (theme === 'auto') {
        effectiveTheme = getSystemTheme();
      } else {
        effectiveTheme = theme;
      }
      
      setResolvedTheme(effectiveTheme);
      root.classList.remove('light', 'dark');
      root.classList.add(effectiveTheme);
    };

    applyTheme();

    // Update every minute for auto theme
    let interval: NodeJS.Timeout | null = null;
    if (theme === 'auto') {
      interval = setInterval(applyTheme, 60000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [theme]);

  const setThemeValue = (newTheme: Theme) => {
    localStorage.setItem('theme', newTheme);
    setTheme(newTheme);
  };

  return {
    theme,
    resolvedTheme,
    setTheme: setThemeValue,
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
  };
}
