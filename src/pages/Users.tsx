import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, where, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth, AppUser } from '../contexts/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { Users as UsersIcon, Shield, User as UserIcon, KeyRound, X, Edit2, Trash2 } from 'lucide-react';
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

  // Add User states
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'host'>('host');
  const [addUserError, setAddUserError] = useState('');

  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'app_users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
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

  const toggleStatus = (user: AppUser) => {
    playClick();
    if (user.id === appUser?.id) {
      playError();
      alert('No puedes desactivar tu propio usuario.');
      return;
    }
    updateDoc(doc(db, 'app_users', user.id), { active: !user.active }).catch(console.error);
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: !user.active } : u));
    playSuccess();
  };

  const toggleRole = (user: AppUser) => {
    playClick();
    if (user.id === appUser?.id) {
      playError();
      alert('No puedes cambiar tu propio rol.');
      return;
    }
    const newRole = user.role === 'admin' ? 'host' : 'admin';
    updateDoc(doc(db, 'app_users', user.id), { role: newRole }).catch(console.error);
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    playSuccess();
  };

  const handleChangePin = (user: AppUser) => {
    playClick();
    setResetPinUser(user);
    setNewPin('');
    setPinError('');
  };

  const submitNewPin = () => {
    playClick();
    if (!resetPinUser) return;
    if (newPin.length < 4) {
      playError();
      setPinError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    updatePin(resetPinUser.id, newPin).catch(console.error);
    playSuccess();
    setResetPinUser(null);
  };

  const handleEditName = (user: AppUser) => {
    playClick();
    setEditNameUser(user);
    setNewName(user.name);
    setNameError('');
  };

  const submitNewName = () => {
    playClick();
    if (!editNameUser) return;
    if (newName.trim().length < 3) {
      playError();
      setNameError('El nombre debe tener al menos 3 caracteres.');
      return;
    }
    updateDoc(doc(db, 'app_users', editNameUser.id), { name: newName.trim() }).catch(console.error);
    setUsers(prev => prev.map(u => u.id === editNameUser.id ? { ...u, name: newName.trim() } : u));
    playSuccess();
    setEditNameUser(null);
  };

  const handleAddUser = () => {
    playClick();
    if (newUserId.trim().length < 3 || newUserName.trim().length < 3) {
      playError();
      setAddUserError('El ID y el Nombre deben tener al menos 3 caracteres.');
      return;
    }
    
    // Check if ID already exists
    if (users.some(u => u.id.toLowerCase() === newUserId.trim().toLowerCase())) {
        playError();
        setAddUserError('Ese ID de usuario ya existe.');
        return;
    }

    const newUser = {
      id: newUserId.trim().toLowerCase(),
      name: newUserName.trim(),
      role: newUserRole,
      pin: '1234',
      active: true,
      activeSessions: []
    };

    setDoc(doc(db, 'app_users', newUser.id), newUser).catch(console.error);
    
    // Optimistic update
    setUsers(prev => [...prev, newUser]);
    
    playSuccess();
    setShowAddUser(false);
    setNewUserId('');
    setNewUserName('');
    setNewUserRole('host');
    setAddUserError('');
  };

  const handleDeleteUser = () => {
    if (!confirmDeleteUser) return;
    playClick();
    deleteDoc(doc(db, 'app_users', confirmDeleteUser.id)).catch(console.error);
    setUsers(prev => prev.filter(u => u.id !== confirmDeleteUser.id));
    playSuccess();
    setConfirmDeleteUser(null);
  };

  if (loading) return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center">
      <div className="text-7xl animate-spin mb-4">🔱</div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Cargando Usuarios...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-1 sm:px-4">
      <div className="flex justify-between items-center mb-4 sm:mb-8 lg:mb-4">
        <h1 className="text-xl sm:text-2xl lg:text-xl font-bold text-slate-900 flex items-center gap-2 sm:gap-3">
          <UsersIcon size={24} className="lg:w-6 lg:h-6" /> Gestión de Usuarios
        </h1>
        {appUser?.role === 'admin' && (
          <button 
            onClick={() => { playClick(); setShowAddUser(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-[10px] sm:text-xs lg:text-[11px] font-bold shadow-sm transition-transform hover:scale-105 active:scale-95"
          >
            + Añadir
          </button>
        )}
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-full">
            <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="p-2 sm:p-4 md:p-1.5 lg:p-2 font-bold md:text-[8px] lg:text-xs sm:text-xs text-[7px] uppercase tracking-wider">Nombre</th>
              <th className="p-2 sm:p-4 md:p-1.5 lg:p-2 font-bold md:text-[8px] lg:text-xs sm:text-xs text-[7px] uppercase tracking-wider">Rol</th>
              <th className="p-2 sm:p-4 md:p-1.5 lg:p-2 font-bold md:text-[8px] lg:text-xs sm:text-xs text-[7px] uppercase tracking-wider">Estado</th>
              <th className="p-2 sm:p-4 md:p-1.5 lg:p-2 font-bold md:text-[8px] lg:text-xs sm:text-xs text-[7px] uppercase tracking-wider text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-2 sm:p-4 md:p-1.5 lg:p-2">
                  <div className="font-bold md:text-[8px] lg:text-sm sm:text-xs text-[7px] truncate max-w-[80px] lg:max-w-xs">{user.name}</div>
                  <div className="text-[6px] md:text-[7px] lg:text-[10px] text-slate-500 uppercase font-medium">{user.id}</div>
                </td>
                <td className="p-2 sm:p-4 md:p-1.5 lg:p-2">
                  <span className={cn(
                    "px-1.5 py-0.5 sm:px-3 sm:py-1 md:px-1 md:py-0.5 lg:px-2 lg:py-0.5 rounded-full text-[6px] sm:text-xs md:text-[7px] lg:text-[10px] font-black flex items-center gap-1 w-max uppercase",
                    user.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {user.role === 'admin' ? <Shield size={10} className="lg:w-3 lg:h-3" /> : <UserIcon size={10} className="lg:w-3 lg:h-3" />}
                    {user.role}
                  </span>
                </td>
                <td className="p-2 sm:p-4 lg:p-2">
                  <span className={cn(
                    "px-1.5 py-0.5 sm:px-3 sm:py-1 lg:px-2 lg:py-0.5 rounded-full text-[6px] sm:text-xs lg:text-[10px] font-black uppercase",
                    activeShifts[user.id] ? "bg-indigo-100 text-indigo-700" :
                    ((user.activeSessions && user.activeSessions.length > 0)) ? "bg-green-100 text-green-700" :
                    user.active ? "bg-slate-100 text-slate-500" : "bg-red-100 text-red-700"
                  )}>
                    {activeShifts[user.id] ? 'EN TURNO' : ((user.activeSessions && user.activeSessions.length > 0)) ? 'ONLINE' : user.active ? 'INACTIVO' : 'OFF'}
                  </span>
                </td>
                <td className="p-2 sm:p-4 md:p-1.5 lg:p-2 text-right space-x-1 sm:space-x-2">
                  <button 
                    onClick={() => handleEditName(user)}
                    className="p-1 sm:p-2 lg:p-1.5 bg-indigo-50 text-indigo-600 hover:bg-white rounded-lg transition-colors inline-flex items-center justify-center"
                  >
                    <Edit2 size={12} className="lg:w-4 lg:h-4" />
                  </button>
                  <button 
                    onClick={() => handleChangePin(user)}
                    className="p-1 sm:p-2 lg:p-1.5 bg-yellow-50 text-yellow-600 hover:bg-white rounded-lg transition-colors inline-flex items-center justify-center"
                  >
                    <KeyRound size={12} className="lg:w-4 lg:h-4" />
                  </button>
                  <button 
                    onClick={() => toggleRole(user)}
                    disabled={user.id === appUser?.id}
                    className="px-1 py-0.5 sm:px-3 sm:py-1.5 lg:px-2 lg:py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[7px] [@media(max-height:600px)_and_(orientation:landscape)]:text-[6px] sm:text-xs lg:text-[10px] font-black uppercase disabled:opacity-50"
                  >
                    Rol
                  </button>
                  <button 
                    onClick={() => toggleStatus(user)}
                    disabled={user.id === appUser?.id}
                    className={cn(
                      "px-1 py-0.5 sm:px-3 sm:py-1.5 lg:px-2 lg:py-1 rounded text-[7px] [@media(max-height:600px)_and_(orientation:landscape)]:text-[6px] sm:text-xs lg:text-[10px] font-black uppercase disabled:opacity-50",
                      user.active ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"
                    )}
                  >
                    {user.active ? 'Dar de Baja' : 'Dar de Alta'}
                  </button>
                  {appUser?.role === 'admin' && user.id !== appUser.id && (
                    <button 
                      onClick={() => { playClick(); setConfirmDeleteUser(user); }}
                      className="p-1 sm:p-2 lg:p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors inline-flex items-center justify-center"
                    >
                      <Trash2 size={12} className="lg:w-4 lg:h-4" />
                    </button>
                  )}
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

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Añadir Nuevo Usuario</h3>
              <button onClick={() => { playClick(); setShowAddUser(false); }} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <p className="text-sm text-slate-500 mb-4">
              La contraseña por defecto será <strong>1234</strong>.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">ID de Acceso</label>
                <input
                  type="text"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none lowercase"
                  placeholder="ej. carlos, maria2, host4"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none"
                  placeholder="Nombre a mostrar"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Rol</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'host')}
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none bg-white font-medium"
                >
                  <option value="host">Host / Recepción</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            
            {addUserError && <p className="text-red-500 text-sm mt-4">{addUserError}</p>}
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { playClick(); setShowAddUser(false); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddUser}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors cursor-pointer"
              >
                Crear Usuario
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete User Modal */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">¿Eliminar Usuario?</h3>
            <p className="text-slate-500 mb-6 font-medium">
              El usuario <strong>{confirmDeleteUser.name}</strong> y su acceso serán eliminados permanentemente.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => { playClick(); setConfirmDeleteUser(null); }}
                className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
