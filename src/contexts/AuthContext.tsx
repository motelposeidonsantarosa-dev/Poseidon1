import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, doc, getDocs, setDoc, getDoc, updateDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface AppUser {
  id: string;
  name: string;
  role: 'admin' | 'host';
  pin: string;
  active: boolean;
  lastSessionId?: string;
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
        const savedUserId = localStorage.getItem('poseidon_user_id');
        const savedSessionId = localStorage.getItem('poseidon_session_id');

        if (savedUserId && savedSessionId) {
          const userRef = doc(db, 'app_users', savedUserId);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as AppUser;
            
            // Check if session is still valid
            if (userData.lastSessionId === savedSessionId) {
              setAppUser(userData);
              
              // Listen for session changes (Single Session Restriction)
              unsubscribeUser = onSnapshot(userRef, (doc) => {
                if (doc.exists()) {
                  const data = doc.data() as AppUser;
                  const currentSavedSessionId = localStorage.getItem('poseidon_session_id');
                  
                  // Only trigger if we have a session ID locally and it differs from Firestore
                  // and Firestore's ID is NOT null (which would mean an intentional logout)
                  if (currentSavedSessionId && data.lastSessionId && data.lastSessionId !== currentSavedSessionId) {
                    // Session invalidated by another login
                    setAppUser(null);
                    localStorage.removeItem('poseidon_user_id');
                    localStorage.removeItem('poseidon_session_id');
                    alert('Tu sesión ha sido cerrada porque se inició sesión en otro dispositivo.');
                  }
                }
              });
            } else {
              localStorage.removeItem('poseidon_user_id');
              localStorage.removeItem('poseidon_session_id');
            }
          } else {
            localStorage.removeItem('poseidon_user_id');
            localStorage.removeItem('poseidon_session_id');
          }
        }

        const usersSnap = await getDocs(collection(db, 'app_users'));
        if (usersSnap.empty) {
          // Bootstrap users only if collection is totally empty
          for (const u of DEFAULT_USERS) {
            await setDoc(doc(db, 'app_users', u.id), u);
          }
          setUsers(DEFAULT_USERS);
        } else {
          setUsers(usersSnap.docs.map(d => d.data() as AppUser));
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
    const userRef = doc(db, 'app_users', id);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const userData = userDoc.data() as AppUser;
      if (userData.pin === pin && userData.active) {
        // Generate new session ID
        const newSessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        
        if (userData.role === 'host') {
          const q = query(collection(db, 'shifts'), where('status', '==', 'active'));
          const activeShiftsSnap = await getDocs(q);
          if (!activeShiftsSnap.empty) {
            const activeShift = activeShiftsSnap.docs[0].data();
            if (activeShift.hostId !== id) {
              throw new Error(`No puedes iniciar sesión. El host ${activeShift.hostName} tiene un turno activo.`);
            }
          }
        }

        // Update session ID in Firestore
        await updateDoc(userRef, { lastSessionId: newSessionId });
        
        setAppUser({ ...userData, lastSessionId: newSessionId });
        localStorage.setItem('poseidon_user_id', id);
        localStorage.setItem('poseidon_session_id', newSessionId);
        return;
      }
    }
    throw new Error('Contraseña incorrecta o usuario inactivo');
  };

  const logout = async () => {
    if (appUser?.role === 'host') {
      const q = query(collection(db, 'shifts'), where('hostId', '==', appUser.id), where('status', '==', 'active'));
      const activeShiftsSnap = await getDocs(q);
      if (!activeShiftsSnap.empty) {
        throw new Error('Debes terminar tu turno antes de cerrar sesión.');
      }
    }
    
    // Clear session in Firestore if desired, or just local
    if (appUser) {
      await updateDoc(doc(db, 'app_users', appUser.id), { lastSessionId: null });
    }

    setAppUser(null);
    localStorage.removeItem('poseidon_user_id');
    localStorage.removeItem('poseidon_session_id');
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