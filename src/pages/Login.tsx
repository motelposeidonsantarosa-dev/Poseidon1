import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { KeyRound, User, ArrowLeft } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { appUser, login, users } = useAuth();
  const { playClick, playSuccess, playError } = useFeedback();
  const [selectedUser, setSelectedUser] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (appUser) {
    return <Navigate to="/dashboard" />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    setError('');
    if (!selectedUser || !pin) {
      playError();
      setError('Seleccione un usuario e ingrese la contraseña');
      return;
    }
    
    try {
      await login(selectedUser, pin);
      playSuccess();
    } catch (err: any) {
      playError();
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative">
      <button 
        onClick={() => { playClick(); navigate('/'); }}
        className="absolute top-[max(1.5rem,env(safe-area-inset-top))] left-4 sm:left-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-bold uppercase tracking-widest text-[10px] sm:top-8 mt-2"
      >
        <ArrowLeft size={16} /> Volver al Inicio
      </button>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md text-center">
        <div className="text-7xl mb-6 drop-shadow-2xl">🔱</div>
        <h1 className="text-4xl font-black text-slate-900 mb-1 uppercase tracking-tighter">Poseidón</h1>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-10">Sistema de Administración</p>
        
        <form onSubmit={handleLogin} className="space-y-6 text-left">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-black uppercase tracking-widest animate-in fade-in zoom-in-95">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seleccionar Host</label>
            <div className="relative group">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              <select 
                className="w-full bg-slate-50 border border-slate-100 p-4 pl-12 rounded-2xl font-bold text-slate-800 focus:bg-white focus:border-blue-500 transition-all outline-none appearance-none"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                required
              >
                <option value="">Selecciona tu usuario</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PIN Secreto</label>
            <div className="relative group">
              <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              <input 
                type="password" 
                className="w-full bg-slate-50 border border-slate-100 p-4 pl-12 rounded-2xl font-bold text-slate-800 focus:bg-white focus:border-blue-500 transition-all outline-none"
                placeholder="****"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
          >
            Ingresar al Tridente
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-slate-50 space-y-4">
          <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.3em]">Síguenos en redes</p>
          <div className="flex flex-col gap-1 text-slate-500 text-[10px] font-bold">
            <p>Instagram: @motel_poseidon</p>
            <p>Facebook: @PoseidonMot</p>
            <p>WhatsApp: 3157170874</p>
          </div>
        </div>
      </div>
    </div>
  );
}
