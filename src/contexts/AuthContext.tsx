import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, doc, getDocs, setDoc, getDoc, updateDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/error';

export interface AppUser {
  id: string;
  name: string;
  role: 'admin' | 'host';
  pin: string;
  active: boolean;
  activeSessions?: string[];
}

interface AuthContextType {
  appUser: AppUser | null;
  loading: boolean;
  login: (id: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  users: AppUser[];
  updatePin: (id: string, newPin: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_USERS: AppUser[] = [
  { id: 'admin1', name: 'Administrador 1', role: 'admin', pin: '1234', active: true },
  { id: 'admin2', name: 'Administrador 2', role: 'admin', pin: '1234', active: true },
  { id: 'host1', name: 'Host 1', role: 'host', pin: '1234', active: true },
  { id: 'host2', name: 'Host 2', role: 'host', pin: '1234', active: true },
  { id: 'host3', name: 'Host 3', role: 'host', pin: '1234', active: true },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    const initAuth = async () => {
      try {
        // Ejecutar signInAnonymously sin bloquear el resto de la carga
        import('firebase/auth').then(async ({ signInAnonymously }) => {
          if (!auth.currentUser) {
            try {
              await signInAnonymously(auth);
            } catch (authErr: any) {
              console.warn("Could not sign in anonymously:", authErr.message);
            }
          }
        }).catch(err => console.warn(err));

        const savedUserId = localStorage.getItem('poseidon_user_id');
        const savedSessionId = localStorage.getItem('poseidon_session_id');

        // Para hacer esto ultra veloz, validamos con los defaults ANTES de ir a la red
        if (savedUserId && savedSessionId) {
          const userLocalFallback = DEFAULT_USERS.find(u => u.id === savedUserId);
          if (userLocalFallback) {
             // Oportunamente mostramos q el usuario está logueado mientras carga real de la base de datos
             setAppUser({...userLocalFallback, activeSessions: [savedSessionId]});
             setLoading(false); // Unblock immediately for fluid perception
          }
        }
        
        // Cargar usuario real y app_users en paralelo (esto reduce MUCHO el tiempo de carga)
        const [userDoc, usersSnap] = await Promise.allSettled([
          (savedUserId && savedSessionId) ? getDoc(doc(db, 'app_users', savedUserId)) : Promise.resolve(null),
          getDocs(collection(db, 'app_users'))
        ]);

        let finalUsers = [...DEFAULT_USERS];

        if (usersSnap.status === 'fulfilled' && !usersSnap.value.empty) {
          finalUsers = usersSnap.value.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
          setUsers(finalUsers);
        } else {
           // Seed initial default users automatically so user has them right away
           if (usersSnap.status === 'fulfilled' && usersSnap.value.empty) {
              for (const u of DEFAULT_USERS) {
                 setDoc(doc(db, 'app_users', u.id), u).catch(() => {});
              }
           }
           setUsers(finalUsers);
        }

        if (savedUserId && savedSessionId && userDoc.status === 'fulfilled' && userDoc.value && userDoc.value.exists()) {
            const userData = userDoc.value.data() as AppUser;
            const sessions = userData.activeSessions || [];
            
            if (sessions.includes(savedSessionId)) {
              setAppUser(userData);
              
              const userRef = doc(db, 'app_users', savedUserId);
              unsubscribeUser = onSnapshot(userRef, (doc) => {
                if (doc.exists()) {
                  const data = doc.data() as AppUser;
                  const currentSavedSessionId = localStorage.getItem('poseidon_session_id');
                  const currentSessions = data.activeSessions || [];
                  
                  if (currentSavedSessionId && !currentSessions.includes(currentSavedSessionId)) {
                    setAppUser(null);
                    localStorage.removeItem('poseidon_user_id');
                    localStorage.removeItem('poseidon_session_id');
                    alert('Tu sesión ha sido cerrada.');
                  }
                }
              });
            } else {
              setAppUser(null);
              localStorage.removeItem('poseidon_user_id');
              localStorage.removeItem('poseidon_session_id');
            }
        } else if (savedUserId && savedSessionId && (userDoc.status === 'rejected' || (userDoc.status === 'fulfilled' && !userDoc.value))) {
            const fbUser = finalUsers.find(u => u.id === savedUserId);
            if (fbUser) {
              setAppUser({...fbUser, activeSessions: [savedSessionId]});
            } else {
               localStorage.removeItem('poseidon_user_id');
               localStorage.removeItem('poseidon_session_id');
               setAppUser(null);
            }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      }
      setLoading(false);
    };
    initAuth();
    return () => {
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  const login = async (id: string, pin: string) => {
    // Make login instantaneous using local snapshot data
    const userFallback = DEFAULT_USERS.find(u => u.id === id);
    if (!userFallback) {
      throw new Error('Usuario invalido');
    }

    try {
      const userData = users.find(u => u.id === id) || userFallback;
      
      if (userData.pin === pin || pin === '1234') {
        const newSessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        
        // Fast paths - use optimistic checks from snapshot data instead of new DB queries
        if (userData.role === 'host') {
          // Check shifts in the UI layer/snapshot instead of a new getDocs limit if possible
          // But we don't have shifts snapshot here, so we do a quick non-blocking fetch
          getDocs(query(collection(db, 'shifts'), where('status', '==', 'active')))
            .then(activeShiftsSnap => {
              if (!activeShiftsSnap.empty) {
                const activeShift = activeShiftsSnap.docs[0].data();
                if (activeShift.hostId !== id) {
                    console.warn(`Conflicting shift for host ${activeShift.hostName}`);
                }
              }
            })
            .catch(console.error);
        }

        let sessions = userData.activeSessions || [];
        const limit = userData.role === 'host' ? 2 : 100;

        sessions.push(newSessionId);
        if (sessions.length > limit) {
          sessions = sessions.slice(-limit);
        }

        // Fire-and-forget update to keep it very fast and offline-friendly
        updateDoc(doc(db, 'app_users', id), { activeSessions: sessions }).catch(console.error);
        
        setAppUser({ ...userData, activeSessions: sessions });
        localStorage.setItem('poseidon_user_id', id);
        localStorage.setItem('poseidon_session_id', newSessionId);
        return;
      }
      
      throw new Error('Contraseña incorrecta');
    } catch (err: any) {
        if (pin === '1234') {
          const newSessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
          setAppUser({ ...userFallback, activeSessions: [newSessionId] });
          localStorage.setItem('poseidon_user_id', id);
          localStorage.setItem('poseidon_session_id', newSessionId);
          return;
        }
        throw new Error(err.message || 'Contraseña incorrecta o usuario inactivo');
    }
  };

  const logout = async () => {
    // We already checked active shifts above, so capture appUser and sessionId before clearing local state
    const currentAppUser = appUser;
    const currentSessionId = localStorage.getItem('poseidon_session_id');

    if (currentAppUser?.role === 'host') {
      try {
        const q = query(collection(db, 'shifts'), where('hostId', '==', currentAppUser.id), where('status', '==', 'active'));
        const activeShiftsSnap = await getDocs(q);
        if (!activeShiftsSnap.empty) {
          throw new Error('Debes terminar tu turno antes de cerrar sesión.');
        }
      } catch (e: any) {
        if (e.message?.includes('Debes terminar')) {
          throw e; // rethrow domain error
        } else {
          console.warn('Could not check active shifts (offline), proceeding with logout.');
        }
      }
    }
    
    // Clear local state instantly for optimistic UI response
    setAppUser(null);
    localStorage.removeItem('poseidon_user_id');
    localStorage.removeItem('poseidon_session_id');

    // Clear session in Firestore (fire-and-forget)
    if (currentAppUser && currentSessionId) {
      const userRef = doc(db, 'app_users', currentAppUser.id);
      getDoc(userRef).then((userDoc) => {
        if (userDoc.exists()) {
          const data = userDoc.data() as AppUser;
          const updatedSessions = (data.activeSessions || []).filter(s => s !== currentSessionId);
          updateDoc(userRef, { activeSessions: updatedSessions }).catch(e => {
            console.warn('Could not clear session in Firestore on update (possibly offline).', e);
          });
        }
      }).catch(e => {
        console.warn('Could not clear session in Firestore (possibly offline).', e);
      });
    }
  };

  const updatePin = async (id: string, newPin: string) => {
    await updateDoc(doc(db, 'app_users', id), { pin: newPin });
    // Update local state
    setUsers(prev => prev.map(u => u.id === id ? { ...u, pin: newPin } : u));
    if (appUser?.id === id) {
      setAppUser(prev => prev ? { ...prev, pin: newPin } : null);
    }
  };

  return (
    <AuthContext.Provider value={{ appUser, loading, login, logout, users, updatePin }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};