import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth, AppUser } from '../contexts/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { Users as UsersIcon, Shield, User as UserIcon, KeyRound, X, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Users() {
  const { appUser, updatePin } = useAuth();
  const { playClick, playSuccess, playError } = useFeedback();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [activeShifts, setActiveShifts] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [resetPinUser, setResetPinUser] = useState<AppUser | null>(null);
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState('');
  
  const [editNameUser, setEditNameUser] = useState<AppUser | null>(null);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'app_users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as AppUser));
      setLoading(false);
    });

    const q = query(collection(db, 'shifts'), where('status', '==', 'active'));
    const unsubscribeShifts = onSnapshot(q, (snapshot) => {
      const shiftsMap: Record<string, boolean> = {};
      snapshot.docs.forEach(doc => {
        shiftsMap[doc.data().hostId] = true;
      });
      setActiveShifts(shiftsMap);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeShifts();
    };
  }, []);

  const toggleStatus = async (user: AppUser) => {
    playClick();
    if (user.id === appUser?.id) {
      playError();
      alert('No puedes desactivar tu propio usuario.');
      return;
    }
    await updateDoc(doc(db, 'app_users', user.id), { active: !user.active });
    playSuccess();
  };

  const toggleRole = async (user: AppUser) => {
    playClick();
    if (user.id === appUser?.id) {
      playError();
      alert('No puedes cambiar tu propio rol.');
      return;
    }
    await updateDoc(doc(db, 'app_users', user.id), { role: user.role === 'admin' ? 'host' : 'admin' });
    playSuccess();
  };

  const handleChangePin = (user: AppUser) => {
    playClick();
    setResetPinUser(user);
    setNewPin('');
    setPinError('');
  };

  const submitNewPin = async () => {
    playClick();
    if (!resetPinUser) return;
    if (newPin.length < 4) {
      playError();
      setPinError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    await updatePin(resetPinUser.id, newPin);
    playSuccess();
    setResetPinUser(null);
  };

  const handleEditName = (user: AppUser) => {
    playClick();
    setEditNameUser(user);
    setNewName(user.name);
    setNameError('');
  };

  const submitNewName = async () => {
    playClick();
    if (!editNameUser) return;
    if (newName.trim().length < 3) {
      playError();
      setNameError('El nombre debe tener al menos 3 caracteres.');
      return;
    }
    await updateDoc(doc(db, 'app_users', editNameUser.id), { name: newName.trim() });
    playSuccess();
    setEditNameUser(null);
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
        <UsersIcon size={32} /> Gestión de Usuarios
      </h1>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:min-w-full [@media(max-width:639px)_and_(orientation:portrait)]:min-w-full">
            <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="p-4 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2 font-bold [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[10px]">Nombre</th>
              <th className="p-4 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2 font-bold [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[10px]">Rol</th>
              <th className="p-4 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2 font-bold [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[10px]">Estado</th>
              <th className="p-4 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2 font-bold [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[10px] text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-4 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2">
                  <div className="font-medium [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[10px]">{user.name}</div>
                  <div className="text-xs [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px] text-slate-500 uppercase">{user.id}</div>
                </td>
                <td className="p-4 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2">
                  <span className={cn(
                    "px-3 py-1 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:px-2 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:py-0.5 [@media(max-width:639px)_and_(orientation:portrait)]:px-2 [@media(max-width:639px)_and_(orientation:portrait)]:py-0.5 rounded-full text-xs [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px] font-bold flex items-center gap-1 w-max",
                    user.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {user.role === 'admin' ? <Shield size={14} className="[@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:w-3 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:h-3 [@media(max-width:639px)_and_(orientation:portrait)]:w-3 [@media(max-width:639px)_and_(orientation:portrait)]:h-3" /> : <UserIcon size={14} className="[@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:w-3 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:h-3 [@media(max-width:639px)_and_(orientation:portrait)]:w-3 [@media(max-width:639px)_and_(orientation:portrait)]:h-3" />}
                    {user.role.toUpperCase()}
                  </span>
                </td>
                <td className="p-4 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2">
                  <span className={cn(
                    "px-3 py-1 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:px-2 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:py-0.5 [@media(max-width:639px)_and_(orientation:portrait)]:px-2 [@media(max-width:639px)_and_(orientation:portrait)]:py-0.5 rounded-full text-xs [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px] font-bold",
                    activeShifts[user.id] ? "bg-blue-100 text-blue-700" :
                    user.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  )}>
                    {activeShifts[user.id] ? 'EN TURNO' : user.active ? 'ACTIVO' : 'INACTIVO'}
                  </span>
                </td>
                <td className="p-4 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2 text-right space-x-2 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:space-x-1 [@media(max-width:639px)_and_(orientation:portrait)]:space-x-1">
                  <button 
                    onClick={() => handleEditName(user)}
                    className="px-3 py-1 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:px-2 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:py-0.5 [@media(max-width:639px)_and_(orientation:portrait)]:px-2 [@media(max-width:639px)_and_(orientation:portrait)]:py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded text-sm [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px] font-medium inline-flex items-center gap-1"
                  >
                    <Edit2 size={14} className="[@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:w-3 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:h-3 [@media(max-width:639px)_and_(orientation:portrait)]:w-3 [@media(max-width:639px)_and_(orientation:portrait)]:h-3" /> Nombre
                  </button>
                  <button 
                    onClick={() => handleChangePin(user)}
                    className="px-3 py-1 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:px-2 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:py-0.5 [@media(max-width:639px)_and_(orientation:portrait)]:px-2 [@media(max-width:639px)_and_(orientation:portrait)]:py-0.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded text-sm [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px] font-medium inline-flex items-center gap-1"
                  >
                    <KeyRound size={14} className="[@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:w-3 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:h-3 [@media(max-width:639px)_and_(orientation:portrait)]:w-3 [@media(max-width:639px)_and_(orientation:portrait)]:h-3" /> Contraseña
                  </button>
                  <button 
                    onClick={() => toggleRole(user)}
                    disabled={user.id === appUser?.id}
                    className="px-3 py-1 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:px-2 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:py-0.5 [@media(max-width:639px)_and_(orientation:portrait)]:px-2 [@media(max-width:639px)_and_(orientation:portrait)]:py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-sm [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px] font-medium disabled:opacity-50"
                  >
                    Cambiar Rol
                  </button>
                  <button 
                    onClick={() => toggleStatus(user)}
                    disabled={user.id === appUser?.id}
                    className={cn(
                      "px-3 py-1 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:px-2 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:py-0.5 [@media(max-width:639px)_and_(orientation:portrait)]:px-2 [@media(max-width:639px)_and_(orientation:portrait)]:py-0.5 rounded text-sm [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px] font-medium disabled:opacity-50",
                      user.active ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"
                    )}
                  >
                    {user.active ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Reset PIN Modal */}
      {resetPinUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Cambiar Contraseña</h3>
              <button onClick={() => { playClick(); setResetPinUser(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <p className="text-slate-600 mb-4">
              Ingrese la nueva contraseña para <strong>{resetPinUser.name}</strong>:
            </p>
            
            <input
              type="text"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl mb-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Nueva contraseña (mínimo 4 caracteres)"
            />
            
            {pinError && <p className="text-red-500 text-sm mb-4">{pinError}</p>}
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { playClick(); setResetPinUser(null); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={submitNewPin}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Guardar Contraseña
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Name Modal */}
      {editNameUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Cambiar Nombre</h3>
              <button onClick={() => { playClick(); setEditNameUser(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <p className="text-slate-600 mb-4">
              Ingrese el nuevo nombre para el usuario <strong>{editNameUser.id}</strong>:
            </p>
            
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl mb-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Nuevo nombre"
            />
            
            {nameError && <p className="text-red-500 text-sm mb-4">{nameError}</p>}
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { playClick(); setEditNameUser(null); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={submitNewName}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                Guardar Nombre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
