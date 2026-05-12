import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { History as HistoryIcon, Search, X, User, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { printTicket } from '../utils/print';

interface ProductItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Ticket {
  id: string;
  roomId: string;
  roomName: string;
  startTime: string;
  endTime: string;
  total: number;
  date: string;
  hostName: string;
  paymentMethod?: string;
  transferPhoto?: string;
  products?: ProductItem[];
  services?: ProductItem[];
  invoiceNumber?: number | null;
  reservationAbono?: number;
  finalTotal?: number;
}

export default function History() {
  const { appUser } = useAuth();
  const { playClick, playError, playSuccess } = useFeedback();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [usersList, setUsersList] = useState<{id: string, name: string}[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const [triggerPrint, setTriggerPrint] = useState(false);
  const [lastShifts, setLastShifts] = useState<any[]>([]);

  useEffect(() => {
    if (appUser?.role === 'admin' && selectedUser) {
      const q = query(
        collection(db, 'shifts'),
        where('hostName', '==', selectedUser),
        where('status', '==', 'closed'),
        orderBy('endTime', 'desc'),
        limit(5)
      );
      getDocs(q).then(snap => {
        setLastShifts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
    } else {
      setLastShifts([]);
    }
  }, [appUser, selectedUser]);

  useEffect(() => {
    if (appUser?.role === 'admin') {
      getDocs(collection(db, 'app_users')).then(snap => {
        const users = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
        setUsersList(users);
      });
    }
  }, [appUser]);

  useEffect(() => {
    if (!appUser || appUser.role !== 'host') return;
    const q = query(collection(db, 'shifts'), where('hostId', '==', appUser.id), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveShift({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setActiveShift(null);
      }
    });
    return () => unsubscribe();
  }, [appUser]);

  useEffect(() => {
    let q;
    if (appUser?.role === 'admin') {
      if (isFiltering && startDate && endDate) {
        const start = new Date(startDate).toISOString();
        const end = new Date(endDate).toISOString();
        if (selectedUser) {
          q = query(
            collection(db, 'tickets'),
            where('date', '>=', start),
            where('date', '<=', end),
            where('hostName', '==', selectedUser),
            orderBy('date', 'desc')
          );
        } else {
          q = query(
            collection(db, 'tickets'),
            where('date', '>=', start),
            where('date', '<=', end),
            orderBy('date', 'desc')
          );
        }
      } else {
        q = query(collection(db, 'tickets'), orderBy('date', 'desc'), limit(100));
      }
    } else if (appUser?.role === 'host' && activeShift) {
      q = query(
        collection(db, 'tickets'),
        where('hostName', '==', appUser.name),
        where('date', '>=', activeShift.startTime),
        orderBy('date', 'desc')
      );
    } else {
      if (appUser?.role === 'host' && !loading && !activeShift) {
        setTickets([]);
      }
      if (!appUser) return;
      if (appUser.role === 'admin') return; // Handled by first if
      
      // If host but no active shift yet, wait for activeShift to load or set empty
      if (loading) return;
      setTickets([]);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
      setTickets(newTickets);
      setLoading(false);

      if (triggerPrint) {
        generateHistoryTicket(newTickets);
        setTriggerPrint(false);
      }
    }, (error) => {
      console.error("Error fetching history:", error);
      setLoading(false);
      setTriggerPrint(false);
    });
    return () => unsubscribe();
  }, [appUser, activeShift, isFiltering, startDate, endDate, selectedUser, triggerPrint]);

  const generateHistoryTicket = (ticketsToPrint: Ticket[]) => {
    const totalIncome = ticketsToPrint.reduce((acc, t) => acc + t.total, 0);
    
    const ticketHtml = `
      <html>
        <head>
          <title>Historial Filtrado</title>
          <style>
            @page { margin: 0; size: 58mm auto; }
            body { font-family: monospace; width: 100%; margin: 0 auto; padding: 2mm; box-sizing: border-box; font-size: 10px; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .text-2xl { font-size: 1.2rem; }
            .mb-4 { margin-bottom: 0.5rem; }
            .flex-between { display: flex; justify-content: space-between; margin-bottom: 3px; }
            .border-t { border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px; }
            .border-b { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
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
            <p class="mt-2 font-bold">HISTORIAL FILTRADO</p>
          </div>
          
          <div class="border-b">
            <p><strong>Desde:</strong> ${format(new Date(startDate), 'dd/MM/yyyy HH:mm')}</p>
            <p><strong>Hasta:</strong> ${format(new Date(endDate), 'dd/MM/yyyy HH:mm')}</p>
            ${selectedUser ? `<p><strong>Usuario:</strong> ${selectedUser}</p>` : ''}
            <p><strong>Servicios:</strong> ${ticketsToPrint.length}</p>
          </div>

          <div class="border-b">
            ${ticketsToPrint.map(t => `
              <div class="flex-between">
                <span>${format(new Date(t.date), 'dd/MM HH:mm')}</span>
                <span>${t.roomName}</span>
              </div>
              <div class="flex-between text-slate-600" style="margin-bottom: 5px;">
                <span>${t.hostName}</span>
                <span>$${t.total.toLocaleString()}</span>
              </div>
            `).join('')}
          </div>

          <div class="border-t flex-between font-bold" style="font-size: 1.2rem;">
            <span>TOTAL</span>
            <span>$${totalIncome.toLocaleString()}</span>
          </div>
        </body>
      </html>
    `;
    printTicket(ticketHtml);
  };

  const handleSearch = () => {
    playClick();
    if (!startDate || !endDate) {
      playError();
      alert('Por favor seleccione ambas fechas y horas.');
      return;
    }
    setIsFiltering(true);
    setTriggerPrint(true);
  };

  const handleClear = () => {
    playClick();
    setIsFiltering(false);
    setStartDate('');
    setEndDate('');
    setSelectedUser('');
  };

  const handleViewTicket = (ticket: Ticket) => {
    playClick();
    const ticketHtml = `
          <html>
            <head>
              <title>Ticket ${ticket.roomName}</title>
              <style>
                @page { margin: 0; size: 58mm auto; }
                body { font-family: monospace; width: 100%; margin: 0 auto; padding: 2mm; box-sizing: border-box; font-size: 10px; }
                .text-center { text-align: center; }
                .font-bold { font-weight: bold; }
                .text-2xl { font-size: 1.2rem; }
                .mb-4 { margin-bottom: 0.5rem; }
                .flex-between { display: flex; justify-content: space-between; }
                .border-t { border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px; }
                .border-b { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
                table { width: 100%; text-align: left; border-collapse: collapse; }
                th, td { padding: 4px 0; }
                th { border-bottom: 1px solid #000; }
                .text-right { text-align: right; }
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
                ${ticket.invoiceNumber ? `<p style="font-size: 1.2rem; font-weight: bold; margin-top: 5px;">FACTURA NÚMERO: ${ticket.invoiceNumber}</p>` : ''}
              </div>
              <div class="border-t border-b">
                <div class="flex-between"><span>Habitación:</span> <strong>${ticket.roomName}</strong></div>
                <div class="flex-between"><span>Fecha:</span> <span>${format(new Date(ticket.date), 'dd/MM/yyyy')}</span></div>
                <div class="flex-between"><span>Inicio:</span> <span>${ticket.startTime ? format(new Date(ticket.startTime), 'HH:mm') : ''}</span></div>
                <div class="flex-between"><span>Fin:</span> <span>${format(new Date(ticket.endTime), 'HH:mm')}</span></div>
                <div class="flex-between"><span>Atiende:</span> <span>${ticket.hostName}</span></div>
                <div class="flex-between"><span>Pago:</span> <span>${ticket.paymentMethod || 'Efectivo'}</span></div>
              </div>
              <table class="mb-4">
                <thead>
                  <tr>
                    <th>Cant</th>
                    <th>Descripción</th>
                    <th class="text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  ${ticket.services?.map(srv => `
                    <tr>
                      <td>${srv.quantity}</td>
                      <td>${srv.name}</td>
                      <td class="text-right">$${(srv.price * srv.quantity).toLocaleString()}</td>
                    </tr>
                  `).join('') || ''}
                  ${ticket.products?.map(prod => `
                    <tr>
                      <td>${prod.quantity}</td>
                      <td>${prod.name}</td>
                      <td class="text-right">$${(prod.price * prod.quantity).toLocaleString()}</td>
                    </tr>
                  `).join('') || ''}
                </tbody>
              </table>

              <div class="border-t pt-2">
                <div class="flex-between font-bold">
                  <span>TOTAL BRUTO</span>
                  <span>$${ticket.total.toLocaleString()}</span>
                </div>
                ${ticket.reservationAbono && ticket.reservationAbono > 0 ? `
                  <div class="flex-between text-blue-600">
                    <span>ABONO RESERVA</span>
                    <span>-$${ticket.reservationAbono.toLocaleString()}</span>
                  </div>
                ` : ''}
                <div class="flex-between font-bold text-xl mt-1 pt-1 border-t">
                  <span>TOTAL A PAGAR</span>
                  <span>$${(ticket.finalTotal || ticket.total).toLocaleString()}</span>
                </div>
              </div>

              <div class="text-center border-t mt-4">
                <p>"EN POSEIDÓN, TE SENTIRÁS COMO LOS DIOSES"</p>
                <p>Copia de Historial</p>
              </div>
            </body>
          </html>
        `;
    printTicket(ticketHtml);
  };

  const printShiftTicket = (shift: any) => {
    playClick();
    const ticketHtml = `
      <html>
        <head>
          <title>Resumen de Turno</title>
          <style>
            @page { margin: 0; size: 58mm auto; }
            body { font-family: monospace; width: 100%; margin: 0 auto; padding: 2mm; box-sizing: border-box; font-size: 10px; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .text-2xl { font-size: 1.2rem; }
            .mb-4 { margin-bottom: 0.5rem; }
            .flex-between { display: flex; justify-content: space-between; }
            .border-t { border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px; }
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
            <div class="flex-between"><span>Host:</span> <span>${shift.hostName}</span></div>
            <div class="flex-between"><span>Inicio:</span> <span>${new Date(shift.startTime).toLocaleString()}</span></div>
            <div class="flex-between"><span>Fin:</span> <span>${new Date(shift.endTime).toLocaleString()}</span></div>
          </div>
          <div class="border-t">
            <div class="flex-between font-bold"><span>Ingresos Totales:</span> <span>$${(shift.totalIncome || 0).toLocaleString()}</span></div>
            <div class="flex-between"><span>Gastos Totales:</span> <span>-$${(shift.totalExpenses || 0).toLocaleString()}</span></div>
            <div class="flex-between font-bold mt-2"><span>UTILIDAD NETA:</span> <span>$${((shift.totalIncome || 0) - (shift.totalExpenses || 0)).toLocaleString()}</span></div>
            <div class="border-t mt-2 pt-2">
              <div class="flex-between"><span>Servicios Hab:</span> <span>${shift.servicesCount || 0}</span></div>
            </div>
          </div>
          <div class="text-center border-t mt-4">
            <p>"EN POSEIDÓN, TE SENTIRÁS COMO LOS DIOSES"</p>
            <p>Copia de Historial</p>
          </div>
        </body>
      </html>
    `;
    printTicket(ticketHtml);
    playSuccess();
  };

  if (loading) return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center">
      <div className="text-7xl animate-spin mb-4">🔱</div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Cargando Historial...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-1 sm:px-4">
      <h1 className="text-xl sm:text-2xl lg:text-xl font-bold text-slate-900 mb-4 sm:mb-5 lg:mb-4 flex items-center gap-2 sm:gap-3">
        <HistoryIcon size={24} className="lg:w-6 lg:h-6" /> {appUser?.role === 'admin' ? (isFiltering ? 'Historial Filtrado' : 'Historial General (Últimos 100)') : 'Mis Servicios del Turno'}
      </h1>

      {appUser?.role === 'admin' && (
        <div className="bg-white p-2.5 sm:p-4 lg:p-4 rounded-2xl shadow-sm border border-slate-200 mb-4 sm:mb-6 lg:mb-4">
          <h2 className="text-[11px] sm:text-base lg:text-sm font-bold text-slate-800 mb-2 sm:mb-3 lg:mb-2 uppercase tracking-tight">Filtrar por Fechas y Usuario</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-3 mb-2 sm:mb-3">
            <div>
              <label className="block text-[8px] sm:text-[10px] lg:text-[10px] font-black text-slate-700 mb-0.5 sm:mb-1 uppercase tracking-widest">Fecha y Hora Inicio</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 sm:p-2.5 lg:p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 text-[10px] sm:text-sm lg:text-xs"
              />
            </div>
            <div>
              <label className="block text-[8px] sm:text-[10px] lg:text-[10px] font-black text-slate-700 mb-0.5 sm:mb-1 uppercase tracking-widest">Fecha y Hora Fin</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 sm:p-2.5 lg:p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 text-[10px] sm:text-sm lg:text-xs"
              />
            </div>
            <div>
              <label className="block text-[8px] sm:text-[10px] lg:text-[10px] font-black text-slate-700 mb-0.5 sm:mb-1 uppercase tracking-widest">Usuario (Opcional)</label>
              <div className="relative">
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full p-2 sm:p-2.5 lg:p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 text-[10px] sm:text-sm lg:text-xs appearance-none"
                >
                  <option value="">Todos los usuarios</option>
                  {usersList.map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
                <User className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSearch}
              className="px-3 py-1.5 sm:px-4 sm:py-2 lg:px-4 lg:py-2 bg-blue-600 hover:bg-blue-700 text-white text-[9px] sm:text-xs lg:text-xs font-bold rounded-xl transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Search size={14} className="lg:w-4 lg:h-4" /> Buscar
            </button>
            {isFiltering && (
              <button
                onClick={handleClear}
                className="px-3 py-1.5 sm:px-4 sm:py-2 lg:px-4 lg:py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] sm:text-xs lg:text-xs font-bold rounded-xl transition-all active:scale-95 flex items-center gap-1.5"
              >
                <X size={14} className="lg:w-4 lg:h-4" /> Limpiar
              </button>
            )}
          </div>

          {/* New Section for Last 5 Turns */}
          {selectedUser && lastShifts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h3 className="text-[10px] sm:text-xs lg:text-[10px] font-black text-slate-800 mb-2 uppercase tracking-widest flex items-center gap-2">
                <Clock size={14} className="text-amber-500" /> ÚLTIMOS 5 TURNOS: {selectedUser}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                {lastShifts.map((shift, idx) => (
                  <button
                    key={shift.id}
                    onClick={() => printShiftTicket(shift)}
                    className="p-2 bg-slate-50 hover:bg-amber-50 border border-slate-100 hover:border-amber-200 rounded-xl transition-all group flex flex-col items-center text-center"
                  >
                    <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1 group-hover:text-amber-600">Turno {idx + 1}</span>
                    <span className="text-[10px] font-bold text-slate-700 leading-none">{format(new Date(shift.endTime), 'dd/MM')}</span>
                    <span className="text-[10px] font-bold text-slate-700 leading-none mt-0.5">{format(new Date(shift.endTime), 'HH:mm')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {tickets.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {appUser?.role === 'host' && !activeShift 
              ? "Inicia tu turno para ver tus servicios registrados." 
              : "No hay servicios registrados en este periodo."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="p-1 sm:p-2 xl:p-4 font-black uppercase tracking-wider text-[7px] sm:text-[10px] md:text-[8px] lg:text-xs w-[20%]">Fec/Hora</th>
                  <th className="p-1 sm:p-2 xl:p-4 font-black uppercase tracking-wider text-[7px] sm:text-[10px] md:text-[8px] lg:text-xs w-[18%]">Habitación</th>
                  <th className="p-1 sm:p-2 xl:p-4 font-black uppercase tracking-wider text-[7px] sm:text-[10px] md:text-[8px] lg:text-xs w-[18%]">Pago</th>
                  <th className="p-1 sm:p-2 xl:p-4 font-black uppercase tracking-wider text-[7px] sm:text-[10px] md:text-[8px] lg:text-xs w-[12%]">Reg.</th>
                  <th className="p-1 sm:p-2 xl:p-4 font-black uppercase tracking-wider text-[7px] sm:text-[10px] md:text-[8px] lg:text-xs text-right w-[24%]">Total</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => {
                  const start = new Date(ticket.startTime);
                  
                  return (
                    <tr key={ticket.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-1 sm:p-2 xl:p-4 text-[7px] sm:text-xs md:text-[8px] lg:text-sm font-bold text-slate-500 whitespace-nowrap">
                        <div className="lg:text-sm leading-none uppercase">{format(new Date(ticket.date), "d MMM", { locale: es }).replace('.', '').toUpperCase()}</div>
                        <div className="text-[6px] md:text-[7px] lg:text-xs font-medium opacity-70 leading-none">{format(start, "HH:mm")}</div>
                      </td>
                      <td className="p-1 sm:p-2 xl:p-4 font-bold text-slate-800 text-[8px] sm:text-xs md:text-[8px] lg:text-sm">
                        <button 
                          onClick={() => handleViewTicket(ticket)}
                          className="text-left hover:text-amber-600 transition-colors group"
                        >
                          <div className="line-clamp-2 max-w-[80px] sm:max-w-[150px] lg:max-w-xs uppercase leading-tight group-hover:underline decoration-amber-300">
                            {ticket.roomName}
                          </div>
                          {ticket.invoiceNumber && (
                            <div className="text-[5px] sm:text-[8px] md:text-[6px] lg:text-[10px] text-slate-400 mt-0.5">#{ ticket.invoiceNumber }</div>
                          )}
                        </button>
                      </td>
                      <td className="p-1 sm:p-2 xl:p-4">
                        <div className="flex flex-col gap-0.5">
                          <span className={cn(
                            "px-1 py-0.5 rounded-full text-[5px] sm:text-[9px] md:text-[7px] lg:text-xs font-black uppercase tracking-wider w-fit shrink-0",
                            ticket.paymentMethod === 'Transferencia' ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                          )}>
                            {ticket.paymentMethod?.substring(0, 3) || 'Efe'}
                          </span>
                          {ticket.paymentMethod === 'Transferencia' && (ticket as any).transferPhoto && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); playClick(); setViewPhoto((ticket as any).transferPhoto); }}
                              className="text-blue-500 font-black text-[5px] sm:text-[9px] md:text-[7px] lg:text-[10px] hover:text-blue-700 underline underline-offset-2 transition-all w-fit decoration-blue-300"
                            >
                              Ver Soporte
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-1 sm:p-2 xl:p-4 text-[7px] sm:text-xs md:text-[8px] lg:text-sm font-bold text-slate-400 uppercase">
                        <div className="truncate max-w-[40px] sm:max-w-[100px] lg:max-w-xs">
                          {ticket.hostName}
                        </div>
                      </td>
                      <td className="p-1 sm:p-2 xl:p-4 text-right font-mono font-black text-green-600 text-[8px] sm:text-sm md:text-sm lg:text-xl leading-tight">
                        ${ticket.total.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Image Modal for Review */}
      {viewPhoto && (
        <div 
          className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[100] p-4 cursor-zoom-out"
          onClick={() => { playClick(); setViewPhoto(null); }}
        >
          <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
            <button 
              className="absolute top-0 right-0 p-4 text-white bg-black/20 rounded-full hover:bg-black/40 transition-colors"
              onClick={() => { playClick(); setViewPhoto(null); }}
            >
              <X size={32} />
            </button>
            <img 
              src={viewPhoto} 
              alt="Comprobante completo" 
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in-90 duration-300" 
            />
          </div>
        </div>
      )}
    </div>
  );
}
