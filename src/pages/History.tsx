import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../firebase';
import { History as HistoryIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';

interface Ticket {
  id: string;
  roomId: string;
  roomName: string;
  startTime: string;
  endTime: string;
  total: number;
  date: string;
  hostName: string;
}

export default function History() {
  const { appUser } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeShift, setActiveShift] = useState<any>(null);

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
      q = query(collection(db, 'tickets'), orderBy('date', 'desc'), limit(100));
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
      setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching history:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [appUser, activeShift]);

  if (loading) return <div className="p-8 text-center">Cargando...</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
        <HistoryIcon size={32} /> {appUser?.role === 'admin' ? 'Historial General (Últimos 100)' : 'Mis Servicios del Turno'}
      </h1>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {tickets.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {appUser?.role === 'host' && !activeShift 
              ? "Inicia tu turno para ver tus servicios registrados." 
              : "No hay servicios registrados en este periodo."}
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="p-4 font-bold">Fecha / Hora</th>
                <th className="p-4 font-bold">Habitación</th>
                <th className="p-4 font-bold">Duración</th>
                <th className="p-4 font-bold">Atendido por</th>
                <th className="p-4 font-bold text-right">Total</th>
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
                    <td className="p-4">
                      <div className="font-medium">{format(new Date(ticket.date), "d MMM yyyy", { locale: es })}</div>
                      <div className="text-sm text-slate-500">{format(start, "HH:mm")} - {format(end, "HH:mm")}</div>
                    </td>
                    <td className="p-4 font-bold text-slate-700">
                      {ticket.roomName}
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {hours}h {mins}m
                    </td>
                    <td className="p-4 text-sm text-slate-500">
                      {ticket.hostName}
                    </td>
                    <td className="p-4 text-right font-mono font-black text-green-600 text-lg">
                      ${ticket.total.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
