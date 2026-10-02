import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MetaraLogo } from '../brand/MetaraLogo';
import {
  RefreshCw,
  Lock,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoggingIn(true);
    setLoginError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Login error:', err);
      setLoginError(err.message || 'Gagal masuk dengan Google. Silakan coba kembali.');
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-neutral-900 to-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-white relative overflow-hidden">
      {/* Subtle Decorative Glow Elements with Metara Red Accents */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-white/10 backdrop-blur-xl border border-white/15 p-8 sm:p-10 rounded-3xl shadow-2xl relative z-10 text-center">
        {/* Metara Brand Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="mb-4 p-1.5 rounded-3xl bg-white shadow-xl shadow-black/20 ring-4 ring-white/10">
            <MetaraLogo size="xl" />
          </div>

          {/* Header Title */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
            HRIS <span className="text-red-500">metaranews.co</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1.5 max-w-xs">
            Sistem Informasi Kepegawaian & Presensi Karyawan
          </p>
        </div>

        {/* Error message */}
        {loginError && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs text-center">
            {loginError}
          </div>
        )}

        {/* Sign In CTA */}
        <div className="mt-4 mb-2">
          <button
            onClick={handleGoogleLogin}
            disabled={loggingIn}
            className="w-full py-3.5 px-6 rounded-2xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-sm flex items-center justify-center gap-3 shadow-xl shadow-black/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
          >
            {loggingIn ? (
              <RefreshCw className="w-5 h-5 animate-spin text-red-600" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            <span>{loggingIn ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
          </button>
        </div>

        <div className="mt-8 text-center">
          <span className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Terhubung aman dengan Database HRIS Firebase</span>
          </span>
        </div>
      </div>
    </div>
  );
};
