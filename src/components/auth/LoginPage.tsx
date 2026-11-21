import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
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

export const LoginPage: React.FC = () => {
  const {
    state,
    hasRegisteredUsers,
    passwordRecoveryMode,
    loginLocal,
    registerLocal,
    loginWithSupabase,
    signUpWithSupabase,
    signInWithGoogle,
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
  const [googleBusy, setGoogleBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured && !hasRegisteredUsers) {
      setMode('register');
    } else if (isSupabaseConfigured && mode === 'register') {
      setMode('login');
    }
  }, [hasRegisteredUsers]);

  const handleGoogleContinue = async () => {
    if (googleBusy || submitting) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Google sign-in failed.');
      setGoogleBusy(false);
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
    if (submitting || googleBusy) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setSubmitting(true);

    try {
      if (mode === 'reset') {
        await sendPasswordReset(email.trim());
        setInfoMsg(
          `Password reset link sent to ${email.trim()}. Check your inbox and open the link to set a new password.`
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
            setInfoMsg(
              `Verification email sent to ${email.trim()}. Please verify your email address before signing in.`
            );
            setMode('login');
            setPassword('');
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
                Sign in with Google or Email to access your private document custody workspace, SHA-256 verification ledger, recipient-specific PDF watermarking, and webhook relay tools.
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

          {/* Right Column: Clean 2-Method Auth Card */}
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
                    Your recovery session is verified. Enter a new password (minimum 8 characters) to continue.
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
                  {/* Method 1: Continue with Google */}
                  {mode !== 'reset' && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        disabled={googleBusy || submitting}
                        onClick={() => void handleGoogleContinue()}
                        className="w-full inline-flex items-center justify-center gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800/80 disabled:opacity-50 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 transition-colors"
                      >
                        {googleBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />
                        ) : (
                          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
                            <path
                              fill="#4285F4"
                              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                            />
                          </svg>
                        )}
                        <span>Continue with Google</span>
                      </button>

                      <div className="relative flex items-center py-1">
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                        <span className="mx-3 text-[11px] font-mono text-slate-400 uppercase">
                          or continue with email
                        </span>
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                      </div>
                    </div>
                  )}

                  {/* Method 2: Continue with Email (Sign In / Sign Up / Reset Switcher) */}
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

                  {!isSupabaseConfigured && !hasRegisteredUsers && mode === 'register' && (
                    <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-800 dark:text-cyan-200 flex items-start gap-2">
                      <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-cyan-600 dark:text-cyan-400" />
                      <span>
                        Create your email account below to access your private workspace (configure VITE_SUPABASE_URL &amp; VITE_SUPABASE_ANON_KEY to enable cloud Supabase &amp; Google sign-in).
                      </span>
                    </div>
                  )}

                  {isSupabaseConfigured && mode !== 'reset' && (
                    <div className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-3">
                      <span className="text-slate-500 dark:text-slate-400">Email Auth Mode</span>
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
                            Full Name
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
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{infoMsg}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting || googleBusy}
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
                              ? 'Continue with Email'
                              : 'Create Email Account'}
                        </span>
                      )}
                    </button>
                  </form>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center pt-2 border-t border-slate-100 dark:border-slate-800">
                    {isSupabaseConfigured
                      ? 'Secured via Supabase Auth (Google & Email) with per-user Row Level Security.'
                      : 'Local Server Session active. Configure VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY for Google Auth & email recovery.'}
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
