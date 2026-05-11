import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { Home, Package, Receipt, Users, LogOut, History, KeyRound, Calculator, X, StopCircle, Menu, CalendarCheck, ShieldAlert, Maximize } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { printTicket } from '../utils/print';

export default function Layout() {
  const { appUser, logout, updatePin } = useAuth();
  const { playClick, playSuccess, playError } = useFeedback();
  const location = useLocation();
  const [activeHosts, setActiveHosts] = useState<string[]>([]);
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const [activeShiftStartTime, setActiveShiftStartTime] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Modal states
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    // Escuchar turnos activos para mostrar qué host está trabajando
    const q = query(collection(db, 'shifts'), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hosts = snapshot.docs.map(doc => doc.data().hostName);
      setActiveHosts(hosts);
      
      if (appUser) {
        const myShift = snapshot.docs.find(d => d.data().hostId === appUser.id);
        if (myShift) {
          setActiveShiftId(myShift.id);
          setActiveShiftStartTime(myShift.data().startTime);
        } else {
          setActiveShiftId(null);
          setActiveShiftStartTime(null);
        }
      }
    });
    return () => unsubscribe();
  }, [appUser]);

  const navItems = [
    { name: 'Habitaciones', path: '/dashboard', icon: Home },
    { name: 'Reservas', path: '/dashboard/reservations', icon: CalendarCheck },
    { name: 'Gastos', path: '/dashboard/expenses', icon: Receipt },
    { name: 'Historial', path: '/dashboard/history', icon: History },
    { name: 'Novedades', path: '/dashboard/incidents', icon: ShieldAlert },
  ];

  if (appUser?.role === 'admin') {
    navItems.push({ name: 'Inventario', path: '/dashboard/inventory', icon: Package });
    navItems.push({ name: 'Usuarios', path: '/dashboard/users', icon: Users });
    navItems.push({ name: 'Financiera', path: '/dashboard/financial', icon: Calculator });
  }

  const handleChangeMyPin = () => {
    playClick();
    setNewPin('');
    setPinError('');
    setIsChangingPin(true);
  };

  const submitNewPin = async () => {
    playClick();
    if (!appUser) return;
    if (newPin.length < 4) {
      playError();
      setPinError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    try {
      await updatePin(appUser.id, newPin);
      playSuccess();
      setIsChangingPin(false);
      alert('Contraseña actualizada correctamente.');
    } catch (err: any) {
      playError();
      setPinError(err.message);
    }
  };

  const toggleFullscreen = () => {
    playClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleLogout = async () => {
    playClick();
    if (appUser?.role === 'host' && activeShiftId) {
      setShowEndShiftModal(true);
      return;
    }
    try {
      await logout();
      playSuccess();
    } catch (err: any) {
      playError();
      alert(err.message);
    }
  };

  const [isEndingShift, setIsEndingShift] = useState(false);

  const handleEndShiftAndLogout = async () => {
    playClick();
    if (!activeShiftId || !activeShiftStartTime || !appUser) return;
    setIsEndingShift(true);
    
    try {
      // Fetch data for summary
      const ticketsQ = query(collection(db, 'tickets'), where('hostName', '==', appUser.name));
      const ticketsSnap = await getDocs(ticketsQ);
      let totalIncome = 0;
      let incomeEfectivo = 0;
      let incomeTransferencia = 0;
      let servicesCount = 0;
      
      ticketsSnap.forEach(doc => {
        const data = doc.data();
        if (data.date >= activeShiftStartTime) {
          servicesCount++;
          totalIncome += data.total;
          if (data.paymentMethod === 'Transferencia') {
            incomeTransferencia += data.total;
          } else {
            incomeEfectivo += data.total;
          }
        }
      });

      const expensesQ = query(collection(db, 'expenses'), where('hostName', '==', appUser.name));
      const expensesSnap = await getDocs(expensesQ);
      let totalExpenses = 0;
      expensesSnap.forEach(doc => {
        const data = doc.data();
        if (data.date >= activeShiftStartTime) {
          totalExpenses += data.amount;
        }
      });

      const utilidadesTotales = totalIncome - totalExpenses;
      const utilidadesEfectivo = incomeEfectivo - totalExpenses;
      const utilidadesTransferencia = incomeTransferencia;

      const roomsSnap = await getDocs(collection(db, 'rooms'));
      const rooms = roomsSnap.docs.map(d => d.data());
      const activeRooms = rooms.filter(r => r.status === 'Ocupada');
      const pendingBalance = activeRooms.reduce((acc, r) => acc + r.total, 0);

      const shiftSummary = {
        endTime: new Date().toISOString(),
        status: 'closed',
        totalIncome,
        totalExpenses,
        servicesCount: servicesCount,
        activeRoomsCount: activeRooms.length,
        pendingBalance
      };

      await updateDoc(doc(db, 'shifts', activeShiftId), shiftSummary);

      // Generate Shift Ticket
      const ticketHtml = `
          <html>
            <head>
              <title>Resumen de Turno</title>
              <style>
                @page { margin: 0; size: 58mm auto; }
                body { font-family: monospace; width: 100%; margin: 0 auto; padding: 2mm; box-sizing: border-box; font-size: 10px; }
                .text-center { text-align: center; }
                .font-bold { font-weight: bold; }
                .text-2xl { font-size: 1.5rem; }
                .mb-4 { margin-bottom: 1rem; }
                .flex-between { display: flex; justify-content: space-between; }
                .border-t { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; }
              </style>
            </head>
            <body>
              <div class="text-center mb-4">
                <div class="text-2xl">🔱</div>
                <h1 class="font-bold">POSEIDÓN</h1>
                <p>Motel</p>
                <p>NIT: 1095823098-1</p>
                <p>Km 1 Vía Santa Rosa-Simití</p>
                <p>Cel: 3157170874</p>
                <p>motelposeidonsantarosa@gmail.com</p>
                <p>instagram:@motel_poseidon</p>
                <p>Facebook: @PoseidonMot</p>
                <p class="mt-2 font-bold">Resumen de Turno</p>
              </div>
              <div class="mb-4">
                <div class="flex-between"><span>Host:</span> <span>${appUser.name}</span></div>
                <div class="flex-between"><span>Inicio:</span> <span>${new Date(activeShiftStartTime).toLocaleTimeString()}</span></div>
                <div class="flex-between"><span>Fin:</span> <span>${new Date().toLocaleTimeString()}</span></div>
              </div>
              <div class="border-t">
                <div class="flex-between font-bold"><span>Ingresos Totales:</span> <span>$${totalIncome.toLocaleString()}</span></div>
                <div class="flex-between text-slate-600"><span>- Efectivo:</span> <span>$${incomeEfectivo.toLocaleString()}</span></div>
                <div class="flex-between text-slate-600"><span>- Transferencia:</span> <span>$${incomeTransferencia.toLocaleString()}</span></div>
                <div class="flex-between"><span>Gastos Totales:</span> <span>-$${totalExpenses.toLocaleString()}</span></div>
                <div class="flex-between font-bold mt-2"><span>UTILIDADES:</span> <span>$${utilidadesTotales.toLocaleString()}</span></div>
                <div class="flex-between text-slate-600"><span>- Efectivo:</span> <span>$${utilidadesEfectivo.toLocaleString()}</span></div>
                <div class="flex-between text-slate-600"><span>- Transferencia:</span> <span>$${utilidadesTransferencia.toLocaleString()}</span></div>
                <div class="flex-between mt-2"><span>Servicios Terminados:</span> <span>${servicesCount}</span></div>
              </div>
              <div class="border-t">
                <div class="font-bold mb-2">Habitaciones Activas: ${activeRooms.length}</div>
                ${activeRooms.map(r => `<div class="flex-between"><span>${r.name}</span> <span>$${r.total.toLocaleString()}</span></div>`).join('')}
                <div class="flex-between font-bold mt-2"><span>Saldo Pendiente:</span> <span>$${pendingBalance.toLocaleString()}</span></div>
              </div>
              <div class="text-center border-t mt-4">
                <p>"EN POSEIDÓN, TE SENTIRÁS COMO LOS DIOSES"</p>
                <p>¡Gracias por tu servicio!</p>
              </div>
            </body>
          </html>
        `;
      
      printTicket(ticketHtml);
      playSuccess();

      // Small delay to ensure the print event is captured before unmounting/redirecting
      setTimeout(async () => {
        setShowEndShiftModal(false);
        await logout();
      }, 2000);
    } catch (err: any) {
      playError();
      alert('Error al cerrar turno: ' + err.message);
      setIsEndingShift(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row pb-20 lg:pb-0 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:pb-0 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:pl-20">
      {/* Mobile/Tablet Header (Logo Only) */}
      <div 
        className="lg:hidden [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:hidden bg-slate-900 text-white px-4 pb-4 flex justify-center items-center sticky top-0 z-40 shadow-md"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔱</span>
          <span className="font-black tracking-tighter text-xl uppercase">Poseidón</span>
        </div>
      </div>

      {/* Sidebar (Desktop & Tablet Landscape) */}
      <aside className="hidden lg:flex bg-slate-900 text-white w-20 lg:[@media(orientation:landscape)]:w-40 xl:w-48 flex-col sticky top-0 h-screen transition-all duration-300">
        <div className="p-4 xl:p-4 flex items-center justify-center lg:[@media(orientation:landscape)]:justify-start xl:justify-start gap-2 border-b border-slate-800">
          <span className="text-2xl xl:text-2xl">🔱</span>
          <span className="hidden lg:[@media(orientation:landscape)]:block xl:block font-black tracking-tighter text-base xl:text-base uppercase">Poseidón</span>
        </div>
        
        <nav className="flex-1 p-2 xl:p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => playClick()}
              className={cn(
                "flex items-center justify-center lg:[@media(orientation:landscape)]:justify-start xl:justify-start gap-4 p-2.5 lg:[@media(orientation:landscape)]:px-3 lg:[@media(orientation:landscape)]:py-2.5 xl:px-4 xl:py-3 rounded-xl transition-all font-black text-xs xl:text-sm uppercase tracking-tight",
                location.pathname === item.path
                  ? "text-amber-400 bg-slate-800/80 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
              title={item.name}
            >
              <item.icon size={18} className="shrink-0 xl:w-5 xl:h-5" />
              <span className="hidden lg:[@media(orientation:landscape)]:block xl:block">{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="p-2 xl:p-2 border-t border-slate-800 space-y-1.5">
          <div className="p-2 xl:px-4 xl:py-2.5 bg-slate-800/50 rounded-xl flex flex-col items-center lg:[@media(orientation:landscape)]:items-start xl:items-start overflow-hidden whitespace-nowrap">
            <div className="hidden lg:[@media(orientation:landscape)]:block xl:block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Usuario</div>
            <div className="hidden lg:[@media(orientation:landscape)]:block xl:block font-black text-blue-400 text-sm truncate w-full">{appUser?.name}</div>
            <div className="hidden lg:[@media(orientation:landscape)]:block xl:block text-[10px] font-bold text-slate-500 uppercase tracking-tighter opacity-70 leading-none">{appUser?.role}</div>
            
            {/* Minimal user info for lg portrait */}
            <div className="lg:[@media(orientation:portrait)]:flex xl:hidden w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-black text-white" title={appUser?.name}>
              {appUser?.name?.charAt(0).toUpperCase()}
            </div>
          </div>

          <button
            onClick={toggleFullscreen}
            className="w-full flex items-center justify-center lg:[@media(orientation:landscape)]:justify-start xl:justify-start gap-4 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors text-slate-300 mb-2 border border-slate-700/50"
            title="Pantalla Completa"
          >
            <Maximize size={20} className="shrink-0" />
            <span className="hidden lg:[@media(orientation:landscape)]:block xl:block text-[10px] font-bold uppercase tracking-wider">Pantalla Completa</span>
          </button>

          <div className="flex flex-col lg:[@media(orientation:landscape)]:grid lg:[@media(orientation:landscape)]:grid-cols-2 xl:grid xl:grid-cols-2 gap-2">
            <button
              onClick={handleChangeMyPin}
              className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors text-slate-300"
              title="Cambiar Clave"
            >
              <KeyRound size={20} />
              <span className="hidden lg:[@media(orientation:landscape)]:block xl:block text-[10px] font-bold uppercase">Clave</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-red-900/20 hover:bg-red-900/40 transition-colors text-red-400"
              title="Cerrar Sesión"
            >
              <LogOut size={20} />
              <span className="hidden lg:[@media(orientation:landscape)]:block xl:block text-[10px] font-bold uppercase">Salir</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Bottom Navigation (Mobile/Tablet Only) -> Left Sidebar on Mobile Landscape */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900 text-white z-50 flex items-center justify-start overflow-x-auto overflow-y-auto p-2 border-t border-slate-800 shadow-[0_-4px_10px_rgba(0,0,0,0.3)] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:top-0 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:bottom-0 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:right-auto [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:w-20 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:flex-col [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:overflow-y-auto [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:overflow-x-hidden [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:border-t-0 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:border-r [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:justify-start [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:pt-4 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:pb-4 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:gap-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => playClick()}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all shrink-0 min-w-[70px] sm:min-w-[90px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:min-w-0 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:w-full",
                isActive
                  ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                  : "text-slate-400 hover:text-slate-300"
              )}
            >
              <item.icon 
                size={24} 
                className="shrink-0 transition-all" 
              />
              <span className="text-[10px] font-black uppercase tracking-tighter text-center leading-tight">{item.name}</span>
            </Link>
          );
        })}
        <button
          onClick={handleChangeMyPin}
          className="flex flex-col items-center gap-1 p-2 text-slate-400 shrink-0 min-w-[70px] sm:min-w-[90px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:min-w-0 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:w-full"
        >
          <KeyRound size={24} className="shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-tighter text-center leading-tight">Clave</span>
        </button>
        <button
          onClick={toggleFullscreen}
          className="flex flex-col items-center gap-1 p-2 text-slate-400 shrink-0 min-w-[70px] sm:min-w-[90px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:min-w-0 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:w-full"
        >
          <Maximize size={24} className="shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-tighter text-center leading-tight">Pantalla</span>
        </button>
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 p-2 text-red-400 shrink-0 min-w-[70px] sm:min-w-[90px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:min-w-0 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:w-full [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:mt-auto"
        >
          <LogOut size={24} className="shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-tighter text-center leading-tight">Salir</span>
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-4 overflow-y-auto w-full max-w-7xl mx-auto uppercase">
        <Outlet />
      </main>

      {/* Change PIN Modal */}
      {isChangingPin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900">Cambiar Mi Clave</h3>
              <button onClick={() => { playClick(); setIsChangingPin(false); }} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <p className="text-slate-600 mb-4">
              Ingrese su nueva contraseña de acceso:
            </p>
            
            <input
              type="text"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl mb-2 focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
              placeholder="Nueva contraseña (mínimo 4 caracteres)"
            />
            
            {pinError && <p className="text-red-500 text-sm mb-4">{pinError}</p>}
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { playClick(); setIsChangingPin(false); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={submitNewPin}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Guardar Clave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Shift Confirmation Modal */}
      {showEndShiftModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
            <div className="text-6xl mb-4">🛑</div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Terminar Turno</h3>
            <p className="text-slate-600 mb-8">
              Tienes un turno activo. Debes terminar tu turno y generar el resumen antes de cerrar sesión.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleEndShiftAndLogout}
                disabled={isEndingShift}
                className={cn(
                  "w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl text-lg shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-2",
                  isEndingShift && "opacity-50 cursor-not-allowed"
                )}
              >
                <StopCircle size={24} className={cn(isEndingShift && "animate-spin")} /> 
                {isEndingShift ? 'Cerrando Turno...' : 'Terminar Turno y Salir'}
              </button>
              <button 
                onClick={() => { playClick(); setShowEndShiftModal(false); }}
                className="w-full py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Print Preview Modal */}
    </div>
  );
}
