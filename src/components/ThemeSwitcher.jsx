import React from 'react';

export default function ThemeSwitcher({ theme, setTheme }) {
  return (
    <div className="theme-switcher" role="group" aria-label="Theme">
      <button
        type="button"
        className={`theme-switcher__btn ${theme === 'midnight' ? 'is-active' : ''}`}
        onClick={() => setTheme('midnight')}
      >
        Midnight
      </button>
      <button
        type="button"
        className={`theme-switcher__btn ${theme === 'porcelain' ? 'is-active' : ''}`}
        onClick={() => setTheme('porcelain')}
      >
        Porcelain
      </button>
    </div>
  );
}
