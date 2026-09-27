import { useEffect, useState } from 'react';

const KEY = 'gomoku_theme';
const THEMES = ['midnight', 'porcelain'];

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    const stored = localStorage.getItem(KEY);
    return THEMES.includes(stored) ? stored : 'midnight';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = (next) => {
    if (!THEMES.includes(next)) return;
    localStorage.setItem(KEY, next);
    setThemeState(next);
  };

  return [theme, setTheme];
}
