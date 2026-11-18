/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { AboutView } from './components/AboutView.tsx';
import { AdminStudioView } from './components/AdminStudioView.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { ContentDetailView } from './components/ContentDetailView.tsx';
import { FeedView } from './components/FeedView.tsx';
import { Header } from './components/Header.tsx';
import { ProfileModal } from './components/ProfileModal.tsx';
import { t } from './i18n/translations.ts';

function AppShell() {
  const { lang, route, siteSettings, navigate } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  const siteName = siteSettings
    ? lang === 'ur'
      ? siteSettings.siteNameUr
      : siteSettings.siteNameEn
    : 'MediaHub';

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Header searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <div className="flex-1">
        {route.view === 'feed' && (
          <FeedView searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        )}
        {route.view === 'detail' && <ContentDetailView id={route.id} />}
        {route.view === 'about' && <AboutView />}
        {route.view === 'studio' && <AdminStudioView />}
      </div>

      <footer className="mt-16 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            © 2026 {siteName}
          </span>
          <div className="flex items-center gap-5">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
              className="hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {t(lang, 'navFeed')}
            </a>
            <a
              href="/about"
              onClick={(e) => {
                e.preventDefault();
                navigate('/about');
              }}
              className="hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {t(lang, 'navAbout')}
            </a>
          </div>
        </div>
      </footer>

      <AuthModal />
      <ProfileModal />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
