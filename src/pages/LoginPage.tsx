import { useState } from 'react';
import { Store, Lock, User, Eye, EyeOff } from 'lucide-react';

// ── Credenciais — altere aqui para mudar o acesso ────────────────────────────
const CREDENTIALS = { user: 'admin', password: 'belissima2024' };

interface Props {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: Props) {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTimeout(() => {
      if (user.trim() === CREDENTIALS.user && password === CREDENTIALS.password) {
        sessionStorage.setItem('belissima_auth', 'true');
        onLogin();
      } else {
        setError('Usuário ou senha incorretos. Tente novamente.');
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-rose-500 rounded-2xl flex items-center justify-center shadow-lg mb-4 ring-4 ring-rose-100">
            <Store size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Motor Analítico</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Belíssima Bonsucesso</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xl p-8">
          <p className="text-sm font-semibold text-slate-600 text-center mb-6">
            Entre com suas credenciais de acesso
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Usuário */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Usuário
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={user}
                  onChange={(e) => { setUser(e.target.value); setError(''); }}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-all placeholder:text-slate-300"
                  placeholder="Seu usuário"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition-all placeholder:text-slate-300"
                  placeholder="Sua senha"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                <p className="text-xs text-red-600 text-center">{error}</p>
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading || !user || !password}
              className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition-all text-sm mt-2 flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Verificando...
                </>
              ) : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Motor Analítico Belíssima Bonsucesso © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
