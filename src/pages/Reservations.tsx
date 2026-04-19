import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useFeedback } from '../hooks/useFeedback';
import { CalendarCheck, Plus, X, Trash2, Clock, User, DoorOpen, AlertCircle, CheckCircle, RotateCcw, Search, Calendar } from 'lucide-react';
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
  abono?: number;
  paymentMethod?: 'Efectivo' | 'Transferencia';
  transferPhoto?: string | null;
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
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoToUpload, setPhotoToUpload] = useState<string | null>(null);
  const [photoToRefund, setPhotoToRefund] = useState<string | null>(null);
  const [activeShift, setActiveShift] = useState<any>(null);

  // Form state
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [clientName, setClientName] = useState('');
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('');
  const [abono, setAbono] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Transferencia'>('Efectivo');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const refundFileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Get active shift for current host
    const userJson = localStorage.getItem('poseidon_user');
    if (userJson) {
      const user = JSON.parse(userJson);
      const q = query(collection(db, 'shifts'), where('hostId', '==', user.id), where('status', '==', 'active'));
      const unsubscribeShift = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          setActiveShift({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
        } else {
          setActiveShift(null);
        }
      });
      return () => unsubscribeShift();
    }
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'reservations'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const resData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Reservation))
        .filter(res => res.status === 'pending'); // Only show active/pending reservations
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

    if (paymentMethod === 'Transferencia' && Number(abono) > 0 && !photoToUpload) {
      playError();
      alert('Por favor adjunte el comprobante de transferencia.');
      return;
    }

    const room = rooms.find(r => r.id === selectedRoomId);
    if (!room) return;

    setLoading(true);
    try {
      const dateTime = `${reservationDate}T${reservationTime}:00`;
      const abonoValue = Number(abono);
      
      const resData = {
        roomId: selectedRoomId,
        roomName: room.name,
        clientName,
        date: new Date(dateTime).toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        abono: abonoValue,
        paymentMethod: abonoValue > 0 ? paymentMethod : null,
        transferPhoto: abonoValue > 0 && paymentMethod === 'Transferencia' ? photoToUpload : null
      };

      const resRef = await addDoc(collection(db, 'reservations'), resData);

      // If there is a down payment, register it as a ticket so it appears in shift summary and history
      if (abonoValue > 0) {
        const userJson = localStorage.getItem('poseidon_user');
        const user = userJson ? JSON.parse(userJson) : null;
        
        await addDoc(collection(db, 'tickets'), {
          roomId: selectedRoomId,
          roomName: `Reserva: ${room.name}`,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          products: [],
          services: [{ id: 'abono_' + resRef.id, name: 'Abono Reserva', price: abonoValue, quantity: 1 }],
          total: abonoValue,
          date: new Date().toISOString(),
          hostName: user?.name || 'Sistema',
          paymentMethod: paymentMethod,
          isAbono: true,
          reservationId: resRef.id,
          transferPhoto: paymentMethod === 'Transferencia' ? photoToUpload : null
        });
      }

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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, isRefund = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const { compressImage } = await import('../utils/image');
          const compressed = await compressImage(reader.result as string);
          if (isRefund) {
            setPhotoToRefund(compressed);
          } else {
            setPhotoToUpload(compressed);
          }
          playSuccess();
        } catch (err) {
          playError();
          alert("Error al comprimir la imagen.");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCancelReservation = async (isRefunding = false) => {
    if (!cancellingId) return;
    playClick();

    try {
      const res = reservations.find(r => r.id === cancellingId);
      if (!res) return;

      const userJson = localStorage.getItem('poseidon_user');
      const user = userJson ? JSON.parse(userJson) : null;

      if (isRefunding && res.abono && res.abono > 0) {
        if (!photoToRefund) {
          alert("Debe adjuntar el soporte de la devolución.");
          return;
        }
        // Register negative expense for refund
        await addDoc(collection(db, 'expenses'), {
          description: `Reembolso Reserva ${res.roomName} - ${res.clientName}`,
          amount: res.abono,
          category: 'Reembolso',
          date: new Date().toISOString(),
          hostName: user?.name || 'Sistema',
          photo: photoToRefund
        });
        alert("Reserva cancelada con éxito. Se ha registrado el reembolso del abono.");
      } else if (res.abono && res.abono > 0) {
        // No refund logic (less than 3 hours or chosen not to)
        const ticketsQ = query(collection(db, 'tickets'), where('reservationId', '==', cancellingId));
        const ticketsSnap = await getDocs(ticketsQ);
        if (!ticketsSnap.empty) {
          await updateDoc(doc(db, 'tickets', ticketsSnap.docs[0].id), {
            roomName: `Reserva Cancelada (Sin Reembolso): ${res.roomName}`,
            isCancelledAbono: true
          });
        }
        alert("Reserva cancelada. Menos de 3 horas para la cita: el abono NO es reembolsable.");
      }

      await updateDoc(doc(db, 'reservations', cancellingId), {
        status: 'cancelled',
        refundPhoto: isRefunding ? photoToRefund : null
      });

      playSuccess();
      setCancellingId(null);
      setPhotoToRefund(null);
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
    setAbono('0');
    setPaymentMethod('Efectivo');
    setPhotoToUpload(null);
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
    <div className="max-w-6xl mx-auto pb-32 2xl:pb-10 overflow-auto custom-scrollbar h-full">
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
        {reservations.filter(r => r.status === 'pending').length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center">
            <CalendarCheck size={64} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-bold text-xl">No hay reservas pendientes</p>
          </div>
        ) : (
          reservations
            .filter(r => r.status === 'pending')
            .map((res) => (
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
                {res.abono && res.abono > 0 && (
                  <div className="flex items-center justify-between text-blue-700 bg-blue-50 px-3 py-2 rounded-xl">
                    <span className="text-xs font-black uppercase">Abono:</span>
                    <span className="font-black">${res.abono.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {res.status === 'pending' && (
                <button
                  onClick={() => { playClick(); setCancellingId(res.id); }}
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <div className="text-center">
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-2">¿Cancelar Reserva?</h3>
              <p className="text-slate-500 font-medium mb-4">Esta acción no se puede deshacer y la habitación quedará disponible.</p>
              
              {(() => {
                const res = reservations.find(r => r.id === cancellingId);
                if (!res) return null;
                const resDate = parseISO(res.date);
                const now = new Date();
                const diffHours = (resDate.getTime() - now.getTime()) / (1000 * 60 * 60);

                if (res.abono && res.abono > 0) {
                  return (
                    <div className="mb-6 space-y-4 pt-4 border-t border-slate-100">
                      <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 italic text-orange-700 text-sm">
                        {diffHours >= 3 
                          ? `Esta reserva tiene un abono de $${res.abono.toLocaleString()}. Al faltar más de 3 horas, ES POSIBLE realizar la devolución.`
                          : `Esta reserva tiene un abono de $${res.abono.toLocaleString()}. Al faltar menos de 3 horas, NO es posible realizar la devolución.`
                        }
                      </div>

                      {diffHours >= 3 && (
                        <div className="space-y-4">
                          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 text-center underline">Soporte de Devolución</label>
                          <input
                            type="file"
                            accept="image/*"
                            ref={refundFileInputRef}
                            onChange={(e) => handlePhotoUpload(e, true)}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => { playClick(); refundFileInputRef.current?.click(); }}
                            className={cn(
                              "w-full py-4 border-2 border-dashed rounded-2xl flex flex-col items-center gap-2 transition-colors",
                              photoToRefund ? "bg-green-50 border-green-200 text-green-600" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                            )}
                          >
                            {photoToRefund ? (
                              <>
                                <CheckCircle size={24} />
                                <span className="text-xs font-bold uppercase tracking-wider">Soporte Adjunto</span>
                                <img src={photoToRefund} className="h-16 w-16 object-cover rounded-md mt-1 shadow-sm" />
                              </>
                            ) : (
                              <>
                                <Plus size={24} />
                                <span className="text-xs font-bold uppercase tracking-wider text-center">Adjuntar o Tomar Soporte de Devolución</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleCancelReservation(true)}
                            disabled={!photoToRefund}
                            className="w-full py-5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-green-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                            <RotateCcw size={20} /> Realizar Devolución
                          </button>
                          
                          <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                            <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-white px-2 text-slate-400 font-black tracking-[0.2em]">O</span></div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { playClick(); setCancellingId(null); setPhotoToRefund(null); }}
                  className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-colors"
                >
                  No, Volver
                </button>
                <button
                  onClick={() => handleCancelReservation(false)}
                  className="py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold shadow-lg shadow-red-100 transition-all active:scale-95"
                >
                  {(() => {
                    const res = reservations.find(r => r.id === cancellingId);
                    return (res?.abono && res.abono > 0) ? 'Cancelar sin devolución' : 'Sí, Cancelar';
                  })()}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Reservation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[95vh] custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900">Nueva Reserva</h3>
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

              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Pago Abono (Opcional)</label>
                <div className="flex gap-2 mb-4">
                  <input
                    type="number"
                    value={abono}
                    onChange={(e) => setAbono(e.target.value)}
                    className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                    placeholder="Valor del abono"
                  />
                </div>
                
                {Number(abono) > 0 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { playClick(); setPaymentMethod('Efectivo'); }}
                        className={cn(
                          "flex-1 py-3 rounded-xl font-bold border-2 transition-all",
                          paymentMethod === 'Efectivo' ? "bg-blue-600 border-blue-600 text-white shadow-md" : "border-slate-200 text-slate-500"
                        )}
                      >
                        Efectivo
                      </button>
                      <button
                        type="button"
                        onClick={() => { playClick(); setPaymentMethod('Transferencia'); }}
                        className={cn(
                          "flex-1 py-3 rounded-xl font-bold border-2 transition-all",
                          paymentMethod === 'Transferencia' ? "bg-blue-600 border-blue-600 text-white shadow-md" : "border-slate-200 text-slate-500"
                        )}
                      >
                        Transferencia
                      </button>
                    </div>

                    {paymentMethod === 'Efectivo' && (
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center animate-in fade-in duration-300">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                          Confirmado: Pago en Efectivo (No requiere foto)
                        </p>
                      </div>
                    )}

                    {paymentMethod === 'Transferencia' && (
                      <div className="flex flex-col gap-3">
                        <input
                          type="file"
                          accept="image/*"
                          ref={fileInputRef}
                          onChange={(e) => handlePhotoUpload(e)}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => { playClick(); fileInputRef.current?.click(); }}
                          className={cn(
                            "w-full py-4 border-2 border-dashed rounded-2xl flex flex-col items-center gap-2 transition-colors",
                            photoToUpload ? "bg-green-50 border-green-200 text-green-600" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                          )}
                        >
                          {photoToUpload ? (
                            <>
                              <CheckCircle size={24} />
                              <span className="text-xs font-bold uppercase tracking-wider">Comprobante Adjunto</span>
                              <img src={photoToUpload} className="h-12 w-12 object-cover rounded-md mt-1" />
                            </>
                          ) : (
                            <>
                              <Plus size={24} />
                              <span className="text-xs font-bold uppercase tracking-wider">Adjuntar o Tomar Comprobante</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
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
