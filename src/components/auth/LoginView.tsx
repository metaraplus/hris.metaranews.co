import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MetaraLogo } from '../brand/MetaraLogo';
import {
  RefreshCw,
  Lock,
  Zap,
  User as UserIcon,
  ArrowRight,
  X,
  ShieldCheck,
} from 'lucide-react';
import {
  getRecentAccounts,
  removeRecentAccount,
  SavedAccount,
} from '../../utils/recentAccounts';

export const LoginView: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const [loggingIn, setLoggingIn] = useState(false);
  const [activeLoginEmail, setActiveLoginEmail] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [recentAccounts, setRecentAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    setRecentAccounts(getRecentAccounts());
  }, []);

  const handleQuickLogin = async (account: SavedAccount) => {
    setLoggingIn(true);
    setActiveLoginEmail(account.email);
    setLoginError(null);
    try {
      await signInWithGoogle(account.email);
    } catch (err: any) {
      console.error('Quick login error:', err);
      setLoginError(err.message || 'Gagal masuk. Silakan coba kembali.');
    } finally {
      setLoggingIn(false);
      setActiveLoginEmail(null);
    }
  };

  const handleStandardGoogleLogin = async () => {
    setLoggingIn(true);
    setActiveLoginEmail('other');
    setLoginError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Standard login error:', err);
      setLoginError(err.message || 'Gagal masuk dengan Google. Silakan coba kembali.');
    } finally {
      setLoggingIn(false);
      setActiveLoginEmail(null);
    }
  };

  const handleRemoveAccount = (e: React.MouseEvent, email: string) => {
    e.stopPropagation();
    const updated = removeRecentAccount(email);
    setRecentAccounts(updated);
  };

  const primaryAccount = recentAccounts.length > 0 ? recentAccounts[0] : null;
  const secondaryAccounts = recentAccounts.slice(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-neutral-900 to-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-white relative overflow-hidden">
      {/* Subtle Decorative Glow Elements with Metara Red Accents */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-white/10 backdrop-blur-xl border border-white/15 p-6 sm:p-8 rounded-3xl shadow-2xl relative z-10">
        {/* Metara Brand Logo & Title */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="mb-3 p-1 rounded-full bg-white shadow-xl shadow-black/20 ring-4 ring-white/10">
            <MetaraLogo size="xl" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
            HRIS <span className="text-red-500">metaranews.co</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xs">
            Sistem Informasi Kepegawaian & Presensi Karyawan
          </p>
        </div>

        {/* Error message */}
        {loginError && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs text-center">
            {loginError}
          </div>
        )}

        {/* QUICK LOGIN SECTION (Bagi yang sudah pernah login) */}
        {primaryAccount && (
          <div className="mb-5">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-xs font-semibold text-red-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 fill-red-400 text-red-400" />
                <span>Masuk Cepat</span>
              </span>
              <span className="text-[11px] text-slate-400">Akun Tersimpan</span>
            </div>

            {/* Primary Quick Login Card */}
            <div
              onClick={() => !loggingIn && handleQuickLogin(primaryAccount)}
              className="group relative p-4 rounded-2xl bg-gradient-to-r from-white/15 to-white/5 hover:from-white/20 hover:to-white/10 border border-red-500/30 hover:border-red-400/60 shadow-lg cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
            >
              <div className="flex items-center gap-3.5">
                {/* Avatar with fallback */}
                <div className="relative shrink-0">
                  {primaryAccount.photoUrl ? (
                    <img
                      src={primaryAccount.photoUrl}
                      alt={primaryAccount.name}
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-red-500/50 shadow-md"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-red-600 to-rose-400 flex items-center justify-center text-white font-bold text-lg ring-2 ring-red-500/40 shadow-md">
                      {primaryAccount.name ? primaryAccount.name.charAt(0).toUpperCase() : <UserIcon className="w-6 h-6" />}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                </div>

                {/* Account Details */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-sm truncate">
                      {primaryAccount.name}
                    </span>
                    {primaryAccount.role === 'admin' && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/30 text-red-200 border border-red-500/40">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 truncate">
                    {primaryAccount.email}
                  </p>
                  {primaryAccount.department && (
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {primaryAccount.department}
                    </p>
                  )}
                </div>

                {/* Quick Action Button */}
                <button
                  type="button"
                  disabled={loggingIn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickLogin(primaryAccount);
                  }}
                  className="shrink-0 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-red-600/30 transition-all cursor-pointer"
                >
                  {loggingIn && activeLoginEmail === primaryAccount.email ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Masuk</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>

                {/* Remove button */}
                <button
                  type="button"
                  title="Hapus dari daftar cepat"
                  onClick={(e) => handleRemoveAccount(e, primaryAccount.email)}
                  className="opacity-40 hover:opacity-100 hover:text-rose-300 p-1 rounded-lg transition-opacity cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Secondary accounts if any */}
            {secondaryAccounts.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                <span className="text-[11px] text-slate-400 px-1">Akun lain di perangkat ini:</span>
                {secondaryAccounts.map((acc) => (
                  <div
                    key={acc.email}
                    onClick={() => !loggingIn && handleQuickLogin(acc)}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                        {acc.name ? acc.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="min-w-0 text-left">
                        <span className="text-xs font-medium text-white truncate block">{acc.name}</span>
                        <span className="text-[10px] text-slate-400 truncate block">{acc.email}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={loggingIn}
                      className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1 rounded cursor-pointer"
                    >
                      {loggingIn && activeLoginEmail === acc.email ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        'Gunakan'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Divider if quick login exists */}
        {primaryAccount && (
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/15" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900/80 px-3 text-slate-400 rounded-full text-[11px]">
                atau masuk dengan akun lain
              </span>
            </div>
          </div>
        )}

        {/* Standard Google Login Button */}
        <div>
          <button
            onClick={handleStandardGoogleLogin}
            disabled={loggingIn}
            className={`w-full py-3.5 px-6 rounded-2xl ${
              primaryAccount
                ? 'bg-white/10 hover:bg-white/15 text-white border border-white/20'
                : 'bg-white hover:bg-slate-100 text-slate-900'
            } font-bold text-sm flex items-center justify-center gap-3 shadow-xl shadow-black/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer`}
          >
            {loggingIn && activeLoginEmail === 'other' ? (
              <RefreshCw className="w-5 h-5 animate-spin text-red-500" />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>
              {loggingIn && activeLoginEmail === 'other'
                ? 'Menghubungkan...'
                : primaryAccount
                ? 'Gunakan Akun Google Lain'
                : 'Masuk dengan Google'}
            </span>
          </button>
        </div>

        {/* Security badge */}
        <div className="mt-6 text-center">
          <span className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Terhubung aman dengan Database HRIS Firebase</span>
          </span>
        </div>
      </div>
    </div>
  );
};
