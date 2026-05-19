import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { HardHat, Lock, User, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err?.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sand-lightest p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-olive mb-4">
            <HardHat className="text-sand-lightest" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-brown tracking-tight">DEMARQ</h1>
          <p className="text-brown/50 text-sm mt-1">Sistema de Administración de Obras</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h2 className="text-lg font-semibold text-brown mb-6">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brown/70 mb-1">Usuario</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-brown/30" size={16} />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-sand-light bg-white text-brown placeholder-brown/30 focus:outline-none focus:border-olive focus:ring-2 focus:ring-olive/20"
                  placeholder="usuario"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-brown/70 mb-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-brown/30" size={16} />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-sand-light bg-white text-brown placeholder-brown/30 focus:outline-none focus:border-olive focus:ring-2 focus:ring-olive/20"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brown/30 hover:text-brown/60"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-600 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
