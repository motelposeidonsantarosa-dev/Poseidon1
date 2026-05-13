import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Catalog from './pages/Catalog';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RoomDetail from './pages/RoomDetail';
import Inventory from './pages/Inventory';
import Expenses from './pages/Expenses';
import History from './pages/History';
import Users from './pages/Users';
import Financial from './pages/Financial';
import Reservations from './pages/Reservations';
import Incidents from './pages/Incidents';
import { PrintPreview } from './components/PrintPreview';

import { doc } from 'firebase/firestore';
import { db } from './firebase';
import { KeyRound, X } from 'lucide-react';

import { RefreshCcw } from 'lucide-react';
import { clearIndexedDbPersistence } from 'firebase/firestore';

function ConnectionErrorBanner() {
  const [error, setError] = React.useState<string | null>(null);
  const [syncing, setSyncing] = React.useState(false);

  React.useEffect(() => {
    const handleOnline = () => {
      setError(null);
      console.log("Sistema: Conexión recuperada.");
    };
    const handleOffline = () => {
      setError("El dispositivo se encuentra sin internet. El MODO OFFLINE está activo: puedes seguir trabajando y los datos se sincronizarán al volver la red.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleForceSync = async () => {
    if (confirm('Al forzar sincronización, el sistema reiniciará la base de datos local prevenida para corregir desfases de red. ¿Desea continuar?')) {
      setSyncing(true);
      try {
        await clearIndexedDbPersistence(db);
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert('Error al forzar sincronización: Primero asegure que no tenga otras ventanas del sistema abiertas.');
        setSyncing(false);
      }
    }
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:w-96 flex flex-col gap-2 z-[1000]">
      {error && (
        <div className="bg-blue-600 text-white p-5 rounded-3xl shadow-2xl animate-in slide-in-from-bottom-10 border-2 border-white/20 backdrop-blur-md">
          <div className="flex items-start gap-4">
            <div className="text-3xl animate-pulse">📡</div>
            <div className="flex-1">
              <p className="font-black text-xs uppercase mb-1 tracking-widest text-blue-100">Modo Fuera de Línea</p>
              <p className="text-[11px] font-bold leading-relaxed">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
      )}
      
      {!error && (
        <button 
          onClick={handleForceSync}
          disabled={syncing}
          className="flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-black transition-colors"
        >
          <RefreshCcw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Sincronizando...' : 'Forzar Sincronización Local'}
        </button>
      )}
    </div>
  );
}

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) {
  const { appUser } = useAuth();

  if (!appUser) {
    return <Navigate to="/login" />;
  }

  if (!appUser.active) {
    return <div className="p-8 text-center text-red-600 font-bold">Usuario desactivado. Contacte al administrador.</div>;
  }

  if (requireAdmin && appUser.role !== 'admin') {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/catalog" element={<Catalog />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="room/:id" element={<RoomDetail />} />
        <Route path="inventory" element={<ProtectedRoute requireAdmin><Inventory /></ProtectedRoute>} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="history" element={<History />} />
        <Route path="reservations" element={<Reservations />} />
        <Route path="incidents" element={<Incidents />} />
        <Route path="users" element={<ProtectedRoute requireAdmin><Users /></ProtectedRoute>} />
        <Route path="financial" element={<ProtectedRoute requireAdmin><Financial /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <PrintPreview />
        <ConnectionErrorBanner />
      </BrowserRouter>
    </AuthProvider>
  );
}
