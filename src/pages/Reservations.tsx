import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useFeedback } from '../hooks/useFeedback';
import { CalendarCheck, Plus, X, Trash2, Clock, User, DoorOpen, AlertCircle } from 'lucide-react';
import { format, isAfter, isBefore, addHours, subHours, parseISO } from 'date-fns';
import { cn } from '../lib/utils';

interface Reservation {
  id: string;
  roomId: string;
  roomName: string;
  date: string;
  clientName: string;
  status: 'pending' | 'cancelled' | 'completed';
  createdAt: string;
}

interface Room {
  id: string;
  name: string;
  status: string;
}

export default function Reservations() {
  const { playClick, playSuccess, playError } = useFeedback();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Form state
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [clientName, setClientName] = useState('');
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'reservations'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const resData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation));
      setReservations(resData);
    });

    const unsubscribeRooms = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const roomData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      setRooms(roomData);
    });

    return () => {
      unsubscribe();
      unsubscribeRooms();
    };
  }, []);

  const handleAddReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    playClick();

    if (!selectedRoomId || !clientName || !reservationDate || !reservationTime) {
      playError();
      alert('Por favor complete todos los campos.');
      return;
    }

    const room = rooms.find(r => r.id === selectedRoomId);
    if (!room) return;

    setLoading(true);
    try {
      const dateTime = `${reservationDate}T${reservationTime}:00`;
      
      await addDoc(collection(db, 'reservations'), {
        roomId: selectedRoomId,
        roomName: room.name,
        clientName,
        date: new Date(dateTime).toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      playSuccess();
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      playError();
      console.error("Error adding reservation:", error);
      alert("Error al registrar la reserva.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReservation = async () => {
    if (!cancellingId) return;
    playClick();

    try {
      await updateDoc(doc(db, 'reservations', cancellingId), {
        status: 'cancelled'
      });
      playSuccess();
      setCancellingId(null);
    } catch (error) {
      playError();
      console.error("Error cancelling reservation:", error);
    }
  };

  const resetForm = () => {
    setSelectedRoomId('');
    setClientName('');
    setReservationDate('');
    setReservationTime('');
  };

  const getStatusBadge = (status: string, date: string) => {
    if (status === 'cancelled') return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold uppercase">Cancelada</span>;
    if (status === 'completed') return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase">Completada</span>;
    
    const resDate = parseISO(date);
    const now = new Date();
    const threeHoursFromNow = addHours(now, 3);

    if (isBefore(resDate, now)) return <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold uppercase">Pasada</span>;
    if (isBefore(resDate, threeHoursFromNow)) return <span className="px-2 py-1 bg-blue-600 text-white rounded-full text-xs font-bold uppercase animate-pulse">Próxima</span>;
    
    return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase">Pendiente</span>;
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 2xl:pb-0">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl 2xl:text-4xl font-black text-slate-900 flex items-center gap-4 uppercase tracking-tight">
          <CalendarCheck size={40} className="text-blue-600" /> Reservas
        </h1>
        <button
          onClick={() => { playClick(); setShowAddModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 2xl:px-6 2xl:py-3 rounded-2xl flex items-center gap-2 font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-200"
        >
          <Plus size={24} />
          <span className="hidden 2xl:inline">Nueva Reserva</span>
        </button>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
        {reservations.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center">
            <CalendarCheck size={64} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-bold text-xl">No hay reservas registradas</p>
          </div>
        ) : (
          reservations.map((res) => (
            <div 
              key={res.id} 
              className={cn(
                "bg-white p-6 rounded-3xl border-2 transition-all shadow-sm",
                res.status === 'cancelled' ? "opacity-60 border-slate-100" : "border-slate-100 hover:border-blue-200 hover:shadow-md"
              )}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2 text-blue-600 font-black uppercase tracking-tighter">
                  <DoorOpen size={20} />
                  {res.roomName}
                </div>
                {getStatusBadge(res.status, res.date)}
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-slate-700">
                  <User size={18} className="text-slate-400" />
                  <span className="font-bold">{res.clientName}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <Clock size={18} className="text-slate-400" />
                  <span className="font-bold">
                    {format(parseISO(res.date), 'dd/MM/yyyy - HH:mm')}
                  </span>
                </div>
              </div>

              {res.status === 'pending' && (
                <button
                  onClick={() => setCancellingId(res.id)}
                  className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-black uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} /> Cancelar Reserva
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {cancellingId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="text-center">
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={40} />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-2">¿Cancelar Reserva?</h3>
              <p className="text-slate-500 font-medium mb-8">Esta acción no se puede deshacer y la habitación quedará disponible.</p>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setCancellingId(null)}
                  className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-colors"
                >
                  No, Volver
                </button>
                <button
                  onClick={handleCancelReservation}
                  className="py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold shadow-lg shadow-red-100 transition-all active:scale-95"
                >
                  Sí, Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Reservation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900">Nueva Reserva</h3>
              <button onClick={() => { playClick(); setShowAddModal(false); }} className="text-slate-400 hover:text-slate-600">
                <X size={28} />
              </button>
            </div>

            <form onSubmit={handleAddReservation} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Habitación</label>
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                  required
                >
                  <option value="">Seleccionar Habitación</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Nombre del Cliente</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                  placeholder="Ej: Juan Pérez"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Fecha</label>
                  <input
                    type="date"
                    value={reservationDate}
                    onChange={(e) => setReservationDate(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Hora</label>
                  <input
                    type="time"
                    value={reservationTime}
                    onChange={(e) => setReservationTime(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                    required
                  />
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl flex gap-3 text-blue-700 text-sm">
                <AlertCircle size={20} className="shrink-0" />
                <p className="font-medium">La habitación se marcará en azul brillante 3 horas antes de la reserva.</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black py-5 rounded-2xl text-xl shadow-lg shadow-blue-100 transition-all active:scale-95 uppercase tracking-widest"
              >
                {loading ? 'Registrando...' : 'Confirmar Reserva'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
