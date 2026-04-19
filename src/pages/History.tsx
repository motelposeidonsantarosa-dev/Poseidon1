import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { History as HistoryIcon, Search, X, User } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { printTicket } from '../utils/print';

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

  if (loading) return <div className="p-8 text-center">Cargando...</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
        <HistoryIcon size={32} /> {appUser?.role === 'admin' ? (isFiltering ? 'Historial Filtrado' : 'Historial General (Últimos 100)') : 'Mis Servicios del Turno'}
      </h1>

      {appUser?.role === 'admin' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-4 uppercase tracking-tight">Filtrar por Fechas y Usuario</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Fecha y Hora Inicio</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Fecha y Hora Fin</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Usuario (Opcional)</label>
              <div className="relative">
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 appearance-none"
                >
                  <option value="">Todos los usuarios</option>
                  {usersList.map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
                <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSearch}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center gap-2"
            >
              <Search size={20} /> Buscar
            </button>
            {isFiltering && (
              <button
                onClick={handleClear}
                className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all active:scale-95 flex items-center gap-2"
              >
                <X size={20} /> Limpiar
              </button>
            )}
          </div>
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
                  <th className="p-4 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 font-bold md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[7px]">Fecha / Hora</th>
                  <th className="p-4 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 font-bold md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[7px]">Habitación</th>
                  <th className="p-4 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 font-bold md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[7px]">Pago</th>
                  <th className="p-4 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 font-bold md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[7px]">Atendido por</th>
                  <th className="p-4 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 font-bold md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[7px] text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => {
                  const start = new Date(ticket.startTime);
                  const end = new Date(ticket.endTime);
                  const durationMs = end.getTime() - start.getTime();
                  const hours = Math.floor(durationMs / (1000 * 60 * 60));
                  const mins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

                  return (
                    <tr key={ticket.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-4 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1">
                        <div className="font-medium md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[7px]">{format(new Date(ticket.date), "d MMM yyyy", { locale: es })}</div>
                        <div className="text-sm md:text-[7px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[6px] text-slate-500">{format(start, "HH:mm")} - {format(end, "HH:mm")}</div>
                      </td>
                      <td className="p-4 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 font-bold text-slate-700 md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[7px] truncate max-w-[80px]">
                        {ticket.roomName}
                      </td>
                      <td className="p-4 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 text-sm md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[7px] text-slate-600">
                        <div className="flex flex-col gap-1">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[6px] font-black uppercase w-fit md:scale-95",
                            ticket.paymentMethod === 'Transferencia' ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                          )}>
                            {ticket.paymentMethod || 'Efectivo'}
                          </span>
                          {ticket.transferPhoto && (
                            <button
                              onClick={() => { playClick(); setViewPhoto(ticket.transferPhoto!); }}
                              className="text-blue-600 underline font-bold text-[6px] uppercase flex items-center gap-1 md:text-[5px]"
                            >
                              <Search size={8} /> Ver Foto
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-4 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 text-sm md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[7px] text-slate-500">
                        <div className="truncate max-w-[60px] md:max-w-[50px] md:text-[8px] uppercase">{ticket.hostName}</div>
                      </td>
                      <td className="p-4 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 text-right font-mono font-black text-green-600 text-lg md:text-[9px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-xs [@media(max-width:639px)_and_(orientation:portrait)]:text-[9px]">
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
          onClick={() => setViewPhoto(null)}
        >
          <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
            <button 
              className="absolute top-0 right-0 p-4 text-white bg-black/20 rounded-full hover:bg-black/40 transition-colors"
              onClick={() => setViewPhoto(null)}
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
