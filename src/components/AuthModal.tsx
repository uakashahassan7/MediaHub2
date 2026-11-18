import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../api/client.ts';
import { useApp } from '../context/AppContext.tsx';
import { t } from '../i18n/translations.ts';

type AuthTab = 'signin' | 'signup' | 'reset';

export function AuthModal() {
  const { lang, authModalOpen, setAuthModalOpen, setUser, refreshSiteSettings } = useApp();
  const [tab, setTab] = useState<AuthTab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetRequested, setResetRequested] = useState(false);
  const [demoCodeNotice, setDemoCodeNotice] = useState('');
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!authModalOpen) return null;

  const resetMessages = () => {
    setError('');
    setStatusMsg('');
  };

  const handleClose = () => {
    resetMessages();
    setAuthModalOpen(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setSubmitting(true);
    try {
      const res = await api.login(email, password);
      setUser(res.user);
      await refreshSiteSettings();
      setAuthModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setSubmitting(true);
    try {
      const res = await api.signup(email, password, displayName);
      setUser(res.user);
      await refreshSiteSettings();
      setAuthModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setSubmitting(true);
    try {
      const res = await api.requestPasswordReset(email);
      setResetRequested(true);
      setStatusMsg(res.message);
      if (res.demoResetCode) {
        setDemoCodeNotice(res.demoResetCode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request reset code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setSubmitting(true);
    try {
      const res = await api.confirmPasswordReset(email, resetCode, newPassword);
      setStatusMsg(res.message);
      setResetRequested(false);
      setDemoCodeNotice('');
      setTab('signin');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl p-6">
        <div className="flex items-center justify-between gap-4 mb-5">
          <h2
            id="auth-dialog-title"
            className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-50"
          >
            {tab === 'signin'
              ? t(lang, 'authSignInTitle')
              : tab === 'signup'
                ? t(lang, 'authSignUpTitle')
                : t(lang, 'authResetTitle')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t(lang, 'closeLightbox')}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 mb-5">
          <button
            type="button"
            onClick={() => {
              setTab('signin');
              resetMessages();
            }}
            className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === 'signin'
                ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            {t(lang, 'tabSignIn')}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('signup');
              resetMessages();
            }}
            className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === 'signup'
                ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            {t(lang, 'tabSignUp')}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('reset');
              resetMessages();
            }}
            className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === 'reset'
                ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            {t(lang, 'tabReset')}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 px-3.5 py-2.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300"
          >
            {error}
          </div>
        )}

        {statusMsg && (
          <div className="mb-4 px-3.5 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-sm text-emerald-800 dark:text-emerald-200">
            {statusMsg}
            {demoCodeNotice && (
              <div className="mt-1 font-mono text-xs font-semibold">
                Code: {demoCodeNotice}
              </div>
            )}
          </div>
        )}

        {tab === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label
                htmlFor="signin-email"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                {t(lang, 'emailLabel')}
              </label>
              <input
                id="signin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div>
              <label
                htmlFor="signin-password"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                {t(lang, 'passwordLabel')}
              </label>
              <input
                id="signin-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-10 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              {t(lang, 'submitSignIn')}
            </button>

            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@mediahub.local');
                  setPassword('Admin123!');
                }}
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-4"
              >
                {t(lang, 'demoAdminFill')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('viewer@mediahub.local');
                  setPassword('Viewer123!');
                }}
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-4"
              >
                {t(lang, 'demoViewerFill')}
              </button>
            </div>
          </form>
        )}

        {tab === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label
                htmlFor="signup-name"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                {t(lang, 'displayNameLabel')}
              </label>
              <input
                id="signup-name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div>
              <label
                htmlFor="signup-email"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                {t(lang, 'emailLabel')}
              </label>
              <input
                id="signup-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div>
              <label
                htmlFor="signup-password"
                className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              >
                {t(lang, 'passwordLabel')}
              </label>
              <input
                id="signup-password"
                type="password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-10 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              {t(lang, 'submitSignUp')}
            </button>
          </form>
        )}

        {tab === 'reset' && (
          <div className="space-y-4">
            {!resetRequested ? (
              <form onSubmit={handleResetRequest} className="space-y-4">
                <div>
                  <label
                    htmlFor="reset-email"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    {t(lang, 'emailLabel')}
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                >
                  {t(lang, 'requestResetCode')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetConfirm} className="space-y-4">
                <div>
                  <label
                    htmlFor="reset-code"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    {t(lang, 'resetCodeLabel')}
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    required
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>
                <div>
                  <label
                    htmlFor="reset-new-pw"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                  >
                    {t(lang, 'newPasswordLabel')}
                  </label>
                  <input
                    id="reset-new-pw"
                    type="password"
                    minLength={6}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
                >
                  {t(lang, 'confirmResetBtn')}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
