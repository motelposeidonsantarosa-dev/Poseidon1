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
import { PrintPreview } from './components/PrintPreview';

import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from './firebase';

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

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
      </BrowserRouter>
    </AuthProvider>
  );
}
