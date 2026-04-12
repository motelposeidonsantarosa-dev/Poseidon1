import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { KeyRound, User } from 'lucide-react';

export default function Login() {
  const { appUser, login, users } = useAuth();
  const { playClick, playSuccess, playError } = useFeedback();
  const [selectedUser, setSelectedUser] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (appUser) {
    return <Navigate to="/" />;
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
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md text-center">
        <div className="text-6xl mb-4 text-blue-600">🔱</div>
        <h1 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-wider">Poseidón</h1>
        <p className="text-slate-500 mb-8 font-medium">Sistema de Administración</p>
        
        <form onSubmit={handleLogin} className="space-y-6 text-left">
          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm font-bold text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              <User size={16} /> Usuario
            </label>
            <select 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="" disabled>Seleccione un usuario...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
              <KeyRound size={16} /> Contraseña
            </label>
            <input 
              type="password" 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-center tracking-[0.5em] text-2xl"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-xl transition-colors text-lg shadow-lg"
          >
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}
