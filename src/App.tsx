import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
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

import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from './firebase';
import { KeyRound, X } from 'lucide-react';

function ConnectionErrorBanner() {
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (err) {
        if (err instanceof Error) {
          const msg = err.message.toLowerCase();
          if (msg.includes('offline') || msg.includes('reach') || msg.includes('unavailable') || msg.includes('failed')) {
            setError("Error de conexión con Firestore. El sistema guardará los cambios localmente y se subirán al recuperar la red.");
          }
        }
      }
    }
    testConnection();
  }, []);

  if (!error) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:w-96 bg-red-600 text-white p-4 rounded-2xl shadow-2xl z-[1000] animate-in slide-in-from-bottom-10">
      <div className="flex items-center gap-3">
        <div className="text-2xl">⚠️</div>
        <div className="flex-1">
          <p className="font-black text-sm uppercase mb-1">Estado de Red</p>
          <p className="text-[10px] font-bold opacity-90 leading-tight">{error}</p>
        </div>
        <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded-lg">
          <X size={20} />
        </button>
      </div>
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
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
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
