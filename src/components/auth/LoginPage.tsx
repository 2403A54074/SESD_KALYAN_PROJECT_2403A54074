import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Fingerprint,
  Inbox,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  Moon,
  ShieldCheck,
  Stamp,
  Sun,
  UserPlus,
  Webhook,
} from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

type OAuthChoice = 'google' | 'facebook' | 'github' | 'azure';

const OAUTH_PROVIDERS: {
  id: OAuthChoice;
  label: string;
  renderIcon: () => React.ReactNode;
}[] = [
  {
    id: 'google',
    label: 'Google',
    renderIcon: () => (
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M12 10.2v3.9h5.4c-.2 1.2-1.4 3.6-5.4 3.6-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z"
        />
      </svg>
    ),
  },
  {
    id: 'facebook',
    label: 'Facebook',
    renderIcon: () => (
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
        <path
          fill="#1877F2"
          d="M22 12a10 10 0 1 0-11.6 9.9v-7h-2.5V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4H15c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z"
        />
      </svg>
    ),
  },
  {
    id: 'github',
    label: 'GitHub',
    renderIcon: () => (
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current" aria-hidden="true">
        <path d="M12 2C6.5 2 2 6.5 2 12c0 4.4 2.9 8.2 6.8 9.5.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 3 .8.1-.6.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-4.9 0-1.1.4-2 1-2.7-.1-.2-.4-1.3.1-2.6 0 0 .8-.3 2.7 1 .8-.2 1.7-.3 2.5-.3s1.7.1 2.5.3c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.4.1 2.6.6.7 1 1.6 1 2.7 0 3.8-2.4 4.6-4.6 4.9.4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 22 12c0-5.5-4.5-10-10-10z" />
      </svg>
    ),
  },
  {
    id: 'azure',
    label: 'Microsoft',
    renderIcon: () => (
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
        <path fill="#F25022" d="M3 3h8.5v8.5H3z" />
        <path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" />
        <path fill="#00A4EF" d="M3 12.5h8.5V21H3z" />
        <path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" />
      </svg>
    ),
  },
];

export const LoginPage: React.FC = () => {
  const {
    state,
    hasRegisteredUsers,
    passwordRecoveryMode,
    loginLocal,
    registerLocal,
    loginWithSupabase,
    signUpWithSupabase,
    signInWithOAuthProvider,
    sendPasswordReset,
    updatePassword,
    cancelPasswordRecovery,
    toggleTheme,
  } = useSystem();

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(
    isSupabaseConfigured || hasRegisteredUsers ? 'login' : 'register'
  );
  const [provider, setProvider] = useState<'supabase' | 'local'>(
    isSupabaseConfigured ? 'supabase' : 'local'
  );
  const [displayName, setDisplayName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<OAuthChoice | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured && !hasRegisteredUsers) {
      setMode('register');
    } else if (mode === 'register' && isSupabaseConfigured) {
      setMode('login');
    }
  }, [hasRegisteredUsers]);

  const handleOAuthClick = async (choice: OAuthChoice) => {
    setErrorMsg(null);
    setInfoMsg(null);
    setOauthBusy(choice);
    try {
      await signInWithOAuthProvider(choice);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'OAuth sign-in failed.');
      setOauthBusy(null);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    setInfoMsg(null);

    if (password.length < 8) {
      setErrorMsg('New password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmNewPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword({ newPassword: password });
      setPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setSubmitting(true);

    try {
      if (mode === 'reset') {
        await sendPasswordReset(email.trim());
        setInfoMsg(
          `Password recovery email dispatched to ${email.trim()}. Open the link in your inbox to set a new password.`
        );
        return;
      }

      if (provider === 'supabase' && isSupabaseConfigured) {
        if (mode === 'login') {
          await loginWithSupabase(email.trim(), password);
        } else {
          const res = await signUpWithSupabase({
            displayName: displayName.trim() || email.split('@')[0] || 'Workspace User',
            email: email.trim(),
            password,
            organization: organization.trim(),
          });
          if (res.requiresConfirmation) {
            setInfoMsg('Check your email to confirm your Supabase account, then sign in.');
            setMode('login');
          }
        }
      } else {
        if (mode === 'login') {
          await loginLocal(email.trim(), password);
        } else {
          await registerLocal({
            displayName: displayName.trim(),
            email: email.trim(),
            password,
            organization: organization.trim(),
          });
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#070B14] text-slate-900 dark:text-slate-100">
      {/* Top Minimal Header */}
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
          RelayWatermark
        </span>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle dark or light theme"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {state?.settings.theme === 'dark' ? (
            <>
              <Sun className="h-3.5 w-3.5 text-amber-400" />
              <span>Light</span>
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5 text-violet-600" />
              <span>Dark</span>
            </>
          )}
        </button>
      </header>

      {/* Main Split Auth Layout */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: System Overview */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              <p className="text-xs font-mono text-cyan-600 dark:text-cyan-400">
                Workspace Access · Private Custodian Isolation
              </p>
              <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white text-balance leading-tight">
                Digital Document Watermarking &amp; Ephemeral SMTP–Webhook Relay
              </h1>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
                Sign in to access your private document custody workspace, SHA-256 verification ledger, recipient-specific PDF watermarking, and ephemeral SMTP–webhook relay studio.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {[
                {
                  icon: Fingerprint,
                  title: 'SHA-256 Fingerprinting',
                  desc: 'Client-side cryptographic hashing via Web Crypto API.',
                },
                {
                  icon: Stamp,
                  title: 'PDF Watermarking',
                  desc: 'Visible recipient attribution stamped directly into PDFs.',
                },
                {
                  icon: Inbox,
                  title: 'Ephemeral SMTP Demo',
                  desc: 'Simulated disposable dropboxes & MIME attachment routing.',
                },
                {
                  icon: Webhook,
                  title: 'Signed Webhooks',
                  desc: 'HMAC-SHA256 payload verification & delivery telemetry.',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4"
                  >
                    <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400 mb-2" />
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Auth Card */}
          <div className="lg:col-span-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 space-y-5">
              {passwordRecoveryMode ? (
                <form onSubmit={(e) => void handleRecoverySubmit(e)} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <LockKeyhole className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Set New Account Password
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Your recovery token was verified. Choose a new password (minimum 8 characters) to continue to your workspace.
                  </p>
                  <div>
                    <label
                      htmlFor="recovery-new-password"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      New Password
                    </label>
                    <input
                      id="recovery-new-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="recovery-confirm-password"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Confirm New Password
                    </label>
                    <input
                      id="recovery-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      className="accent-cyan-600"
                    />
                    <span>Show password</span>
                  </label>

                  {errorMsg && (
                    <div
                      role="alert"
                      className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
                    >
                      {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      <span>Update Password &amp; Continue</span>
                    </button>
                    <button
                      type="button"
                      onClick={cancelPasswordRecovery}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Mode Switcher */}
                  {mode !== 'reset' ? (
                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setErrorMsg(null);
                          setInfoMsg(null);
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold transition-colors ${
                          mode === 'login'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        <span>Sign In</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('register');
                          setErrorMsg(null);
                          setInfoMsg(null);
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold transition-colors ${
                          mode === 'register'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>Create Account</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                        <span className="text-xs font-semibold text-slate-900 dark:text-white">
                          Reset Account Password
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setErrorMsg(null);
                          setInfoMsg(null);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
                      >
                        <ArrowLeft className="h-3 w-3" />
                        <span>Back to Sign In</span>
                      </button>
                    </div>
                  )}

                  {/* OAuth Providers Grid */}
                  {mode !== 'reset' && (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        {OAUTH_PROVIDERS.map((oauth) => (
                          <button
                            key={oauth.id}
                            type="button"
                            disabled={oauthBusy !== null || submitting}
                            onClick={() => void handleOAuthClick(oauth.id)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800/80 disabled:opacity-50 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 transition-colors"
                          >
                            {oauthBusy === oauth.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />
                            ) : (
                              oauth.renderIcon()
                            )}
                            <span>{oauth.label}</span>
                          </button>
                        ))}
                      </div>
                      <div className="relative flex items-center py-1">
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                        <span className="mx-3 text-[11px] font-mono text-slate-400 uppercase">
                          or with email
                        </span>
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                      </div>
                    </div>
                  )}

                  {!isSupabaseConfigured && !hasRegisteredUsers && mode === 'register' && (
                    <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-800 dark:text-cyan-200 flex items-start gap-2">
                      <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-cyan-600 dark:text-cyan-400" />
                      <span>
                        First-run local setup: create your account below or configure VITE_SUPABASE_URL &amp; VITE_SUPABASE_ANON_KEY for cloud auth and OAuth.
                      </span>
                    </div>
                  )}

                  {isSupabaseConfigured && mode !== 'reset' && (
                    <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-3">
                      <span className="text-slate-500 dark:text-slate-400">Auth Backend</span>
                      <div className="flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 p-0.5">
                        <button
                          type="button"
                          onClick={() => setProvider('supabase')}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium ${
                            provider === 'supabase'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                              : 'text-slate-500'
                          }`}
                        >
                          Supabase Auth
                        </button>
                        <button
                          type="button"
                          onClick={() => setProvider('local')}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium ${
                            provider === 'local'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                              : 'text-slate-500'
                          }`}
                        >
                          Local Server
                        </button>
                      </div>
                    </div>
                  )}

                  <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                    {mode === 'register' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label
                            htmlFor="auth-display-name"
                            className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                          >
                            Display Name
                          </label>
                          <input
                            id="auth-display-name"
                            type="text"
                            required
                            minLength={2}
                            maxLength={80}
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Your full name"
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="auth-org"
                            className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                          >
                            Organization (Optional)
                          </label>
                          <input
                            id="auth-org"
                            type="text"
                            maxLength={80}
                            value={organization}
                            onChange={(e) => setOrganization(e.target.value)}
                            placeholder="Organization or team"
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="auth-email"
                        className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                      >
                        Email Address
                      </label>
                      <input
                        id="auth-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@organization.com"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
                      />
                    </div>

                    {mode !== 'reset' && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            htmlFor="auth-password"
                            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                          >
                            Password{' '}
                            {mode === 'register' && (
                              <span className="text-slate-400">(min 8 characters)</span>
                            )}
                          </label>
                          {mode === 'login' && (
                            <button
                              type="button"
                              onClick={() => {
                                setMode('reset');
                                setErrorMsg(null);
                                setInfoMsg(null);
                              }}
                              className="text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
                            >
                              Forgot password?
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            id="auth-password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={mode === 'register' ? 8 : 1}
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 pr-10 text-xs text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5"
                          >
                            {showPassword ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {errorMsg && (
                      <div
                        role="alert"
                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300"
                      >
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    {infoMsg && (
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                        {infoMsg}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting || oauthBusy !== null}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>
                            {mode === 'reset'
                              ? 'Sending Reset Link…'
                              : mode === 'login'
                                ? 'Signing In…'
                                : 'Creating Account…'}
                          </span>
                        </>
                      ) : (
                        <span>
                          {mode === 'reset'
                            ? 'Send Password Reset Email'
                            : mode === 'login'
                              ? 'Sign In to Workspace'
                              : 'Create Account'}
                        </span>
                      )}
                    </button>
                  </form>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center pt-2 border-t border-slate-100 dark:border-slate-800">
                    {isSupabaseConfigured
                      ? 'Protected by Supabase Auth, Row Level Security (RLS), and per-user data isolation.'
                      : 'Local Server Session active (salted scrypt + HMAC tokens). Configure Supabase Auth env vars for OAuth & email reset.'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Persistent Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-6xl w-full mx-auto">
        <span>Digital Document Watermarking &amp; Ephemeral SMTP–Webhook Relay System</span>
        <span className="font-medium text-slate-700 dark:text-slate-300">
          Developed by Kalyan Reddy.
        </span>
      </footer>
    </div>
  );
};
