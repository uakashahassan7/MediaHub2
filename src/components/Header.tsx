import React, { useState } from 'react';
import { Moon, Search, Sun, User as UserIcon, X } from 'lucide-react';
import { api } from '../api/client.ts';
import { useApp } from '../context/AppContext.tsx';
import { t } from '../i18n/translations.ts';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function Header({ searchQuery, onSearchChange }: HeaderProps) {
  const {
    lang,
    toggleLang,
    theme,
    toggleTheme,
    user,
    setUser,
    siteSettings,
    route,
    navigate,
    setAuthModalOpen,
    setProfileModalOpen,
    refreshSiteSettings,
  } = useApp();

  const [menuOpen, setMenuOpen] = useState(false);

  const logoText = siteSettings?.logoText || 'MediaHub';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (route.view !== 'feed') {
      navigate('/');
    }
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await api.logout();
    setUser(null);
    await refreshSiteSettings();
    if (route.view === 'studio') {
      navigate('/');
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <div className="flex items-center gap-6 shrink-0">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
            className="font-display text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 rounded"
          >
            {logoText}
          </a>

          {/* Primary Nav Links */}
          <nav className="flex items-center gap-3.5 sm:gap-5 text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-300">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-zinc-900 dark:hover:text-white ${
                route.view === 'feed'
                  ? 'text-zinc-950 dark:text-white underline decoration-red-600 decoration-2 underline-offset-8'
                  : ''
              }`}
            >
              {t(lang, 'navFeed')}
            </a>
            <a
              href="/about"
              onClick={(e) => {
                e.preventDefault();
                navigate('/about');
              }}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-zinc-900 dark:hover:text-white ${
                route.view === 'about'
                  ? 'text-zinc-950 dark:text-white underline decoration-red-600 decoration-2 underline-offset-8'
                  : ''
              }`}
            >
              {t(lang, 'navAbout')}
            </a>
            {user?.role === 'admin' && (
              <a
                href="/studio"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/studio');
                }}
                className={`hidden md:inline-block whitespace-nowrap shrink-0 py-1 transition-colors hover:text-zinc-900 dark:hover:text-white ${
                  route.view === 'studio'
                    ? 'text-zinc-950 dark:text-white underline decoration-red-600 decoration-2 underline-offset-8'
                    : ''
                }`}
              >
                {t(lang, 'navStudio')}
              </a>
            )}
          </nav>
        </div>

        {/* Zone 2: Desktop Search */}
        <form
          onSubmit={handleSearchSubmit}
          className="hidden md:flex flex-1 max-w-md items-center relative"
          role="search"
        >
          <Search
            className="w-4 h-4 text-zinc-400 pointer-events-none absolute start-3"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              if (route.view !== 'feed') navigate('/');
            }}
            placeholder={t(lang, 'searchPlaceholder')}
            aria-label={t(lang, 'searchPlaceholder')}
            className="w-full h-9 ps-9 pe-8 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-600/70"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label={t(lang, 'clearSearch')}
              className="absolute end-2 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Zone 3: Language, Theme, Account CTA */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleLang}
            className="h-9 px-2.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            aria-label={lang === 'en' ? 'Switch language to Urdu' : 'Switch language to English'}
          >
            {t(lang, 'languageLabel')}
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            aria-label={theme === 'light' ? t(lang, 'switchToDark') : t(lang, 'switchToLight')}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="h-9 px-3 flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
              >
                <UserIcon className="w-4 h-4 text-zinc-500" aria-hidden="true" />
                <span className="max-w-[110px] truncate">{user.displayName}</span>
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute end-0 mt-2 w-48 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg py-1.5 z-50"
                >
                  <div className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {user.email}
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/');
                    }}
                    className="w-full text-start px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden"
                  >
                    {t(lang, 'navFeed')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/about');
                    }}
                    className="w-full text-start px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 md:hidden"
                  >
                    {t(lang, 'navAbout')}
                  </button>
                  {user.role === 'admin' && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/studio');
                      }}
                      className="w-full text-start px-3 py-2 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {t(lang, 'navStudio')}
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setProfileModalOpen(true);
                    }}
                    className="w-full text-start px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {t(lang, 'profile')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full text-start px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {t(lang, 'signOut')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="h-9 px-3.5 text-xs sm:text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
            >
              {t(lang, 'signIn')}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
