import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.ts';
import type { Language, SiteSettings, ThemeMode, UserProfile } from '../shared/types.ts';

export type AppRoute =
  | { view: 'feed' }
  | { view: 'detail'; id: string }
  | { view: 'about' }
  | { view: 'studio' };

function parseRouteFromPath(pathname: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/about') return { view: 'about' };
  if (clean === '/studio' || clean === '/admin') return { view: 'studio' };
  const detailMatch = clean.match(/^\/(watch|image|article)\/([^/]+)$/);
  if (detailMatch) {
    return { view: 'detail', id: decodeURIComponent(detailMatch[2]) };
  }
  return { view: 'feed' };
}

interface AppContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  authReady: boolean;
  siteSettings: SiteSettings | null;
  refreshSiteSettings: () => Promise<void>;
  route: AppRoute;
  navigate: (to: string) => void;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  profileModalOpen: boolean;
  setProfileModalOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('mh_lang') : null;
    return saved === 'ur' ? 'ur' : 'en';
  });

  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('mh_theme') : null;
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [user, setUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [route, setRoute] = useState<AppRoute>(() =>
    typeof window !== 'undefined' ? parseRouteFromPath(window.location.pathname) : { view: 'feed' },
  );
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
    localStorage.setItem('mh_lang', lang);
  }, [lang]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('mh_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!siteSettings) return;
    const siteTitle = lang === 'ur' ? siteSettings.siteNameUr : siteSettings.siteNameEn;
    if (route.view === 'feed') {
      document.title = `${siteTitle} — ${lang === 'ur' ? 'ویڈیوز، تصاویر اور مضامین' : 'Videos, Photography & Essays'}`;
    } else if (route.view === 'about') {
      document.title = `${lang === 'ur' ? 'تعارف' : 'About'} — ${siteTitle}`;
    } else if (route.view === 'studio') {
      document.title = `${lang === 'ur' ? 'ایڈمن اسٹوڈیو' : 'Creator Studio'} — ${siteTitle}`;
    }
  }, [siteSettings, lang, route]);

  const refreshSiteSettings = useCallback(async () => {
    try {
      const res = await api.getSettings();
      setSiteSettings(res.settings);
    } catch {
      // Ignore transient error
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([api.getMe(), api.getSettings()])
      .then(([meRes, settingsRes]) => {
        if (!active) return;
        setUser(meRes.user);
        setSiteSettings(settingsRes.settings);
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseRouteFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (window.location.pathname !== to) {
      window.history.pushState({}, '', to);
    }
    setRoute(parseRouteFromPath(to));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === 'en' ? 'ur' : 'en'));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  return (
    <AppContext.Provider
      value={{
        lang,
        setLang,
        toggleLang,
        theme,
        toggleTheme,
        user,
        setUser,
        authReady,
        siteSettings,
        refreshSiteSettings,
        route,
        navigate,
        authModalOpen,
        setAuthModalOpen,
        profileModalOpen,
        setProfileModalOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
