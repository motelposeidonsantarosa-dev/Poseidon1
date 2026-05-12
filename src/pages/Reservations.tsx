import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, orderBy, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useFeedback } from '../hooks/useFeedback';
import { handleFirestoreError, OperationType } from '../utils/error';
import { CalendarCheck, Plus, X, Trash2, Clock, User, DoorOpen, AlertCircle, CheckCircle, Search, Calendar } from 'lucide-react';
import { format, isBefore, addHours, parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import { compressImage } from '../utils/image';
import { useAuth } from '../contexts/AuthContext';

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
  const { appUser } = useAuth();
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
  const [abono, setAbono] = useState<string>('40000');
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Transferencia'>('Efectivo');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    // Try to get "Valor Reserva" from products (formerly inventory typo)
    const unsubscribeInventory = onSnapshot(collection(db, 'products'), (snapshot) => {
      const items = snapshot.docs.map(doc => doc.data());
      const resItem = items.find(item => item.name === 'Valor Reserva');
      if (resItem && resItem.price) {
        setAbono(resItem.price.toString());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    // Get active shift for current user
    if (appUser) {
      const q = query(collection(db, 'shifts'), where('hostId', '==', appUser.id), where('status', '==', 'active'));
      const unsubscribeShift = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          setActiveShift({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
        } else {
          setActiveShift(null);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'shifts');
      });
      return () => {
        unsubscribeInventory();
        unsubscribeShift();
      };
    }

    return () => unsubscribeInventory();
  }, [appUser]);

  useEffect(() => {
    const q = query(collection(db, 'reservations'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const resData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Reservation))
        .filter(res => res.status === 'pending'); // Only show active/pending reservations
      setReservations(resData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'reservations');
    });

    const unsubscribeRooms = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const roomData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      setRooms(roomData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'rooms');
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
      setFormError('Por favor complete todos los campos.');
      return;
    }

    const [year, month, day] = reservationDate.split('-');
    const [hours, minutes] = reservationTime.split(':');
    const resDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes));
    
    const now = new Date();
    const oneHourFromNow = addHours(now, 1);

    if (isBefore(resDate, oneHourFromNow)) {
      playError();
      setFormError('Las reservas deben realizarse con al menos 1 hora de anticipación.');
      return;
    }

    if (paymentMethod === 'Transferencia' && Number(abono) > 0 && !photoToUpload) {
      playError();
      setFormError('Por favor adjunte el comprobante de transferencia.');
      return;
    }

    const room = rooms.find(r => r.id === selectedRoomId);
    if (!room) return;

    setLoading(true);
    setFormError(null);
    try {
      const abonoValue = Number(abono);
      
      const resData = {
        roomId: selectedRoomId,
        roomName: room.name,
        clientName,
        date: resDate.toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        abono: abonoValue,
        paymentMethod: abonoValue > 0 ? paymentMethod : null,
        transferPhoto: abonoValue > 0 && paymentMethod === 'Transferencia' ? photoToUpload : null
      };

      const resRef = doc(collection(db, 'reservations'));

      // Fire and forget setDoc
      setDoc(resRef, resData).catch(e => console.error("Res log failed:", e));

      // If there is a down payment, register it as a ticket so it appears in shift summary and history
      // We do this optimistically without awaiting to prevent UI blocking
      if (abonoValue > 0) {
        setDoc(doc(collection(db, 'tickets')), {
          roomId: selectedRoomId,
          roomName: `Reserva: ${room.name}`,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          products: [],
          services: [{ id: 'abono_' + resRef.id, name: 'Abono Reserva', price: abonoValue, quantity: 1 }],
          total: abonoValue,
          date: new Date().toISOString(),
          hostName: appUser?.name || 'Administración',
          paymentMethod: paymentMethod,
          isAbono: true,
          reservationId: resRef.id,
          isTemporary: true,
          transferPhoto: paymentMethod === 'Transferencia' ? photoToUpload : null
        }).catch(e => console.error("Ticket log failed:", e));
      }

      playSuccess();
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      playError();
      console.error("Error adding reservation:", error);
      setFormError("Error al registrar la reserva. Comprueba tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result as string);
          setPhotoToUpload(compressed);
          playSuccess();
        } catch (err) {
          playError();
          setFormError("Error al comprimir la imagen.");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCancelReservation = () => {
    if (!cancellingId) return;
    playClick();
    setFormError(null);

    const res = reservations.find(r => r.id === cancellingId);
    if (!res) return;

    if (res.abono && res.abono > 0) {
      // Optimistically update tickets in the background
      const ticketsQ = query(collection(db, 'tickets'), where('reservationId', '==', cancellingId));
      getDocs(ticketsQ).then(ticketsSnap => {
        if (!ticketsSnap.empty) {
          updateDoc(doc(db, 'tickets', ticketsSnap.docs[0].id), {
            roomName: `Reserva Cancelada (Sin Reembolso): ${res.roomName}`,
            isCancelledAbono: true,
            isTemporary: false
          });
        }
      }).catch(e => console.error(e));
    }

    // Optimistically update UI
    setCancellingId(null);
    playSuccess();

    updateDoc(doc(db, 'reservations', cancellingId), {
      status: 'cancelled'
    }).catch((error) => {
      console.error("Error cancelling reservation:", error);
      // We don't restore the ID or show error here since it might just be offline,
      // and it will sync when online.
    });
  };

  const resetForm = () => {
    setSelectedRoomId('');
    setClientName('');
    setReservationDate('');
    setReservationTime('');
    setPaymentMethod('Efectivo');
    setPhotoToUpload(null);
    setFormError(null);
  };

  const getStatusBadge = (status: string, date: string) => {
    if (status === 'cancelled') return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold uppercase">Cancelada</span>;
    if (status === 'completed') return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase">Completada</span>;
    
    const resDate = parseISO(date);
    const now = new Date();
    const twoHoursFromNow = addHours(now, 2);

    if (isBefore(resDate, now)) return <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold uppercase">Pasada</span>;
    if (isBefore(resDate, twoHoursFromNow)) return <span className="px-2 py-1 bg-blue-600 text-white rounded-full text-xs font-bold uppercase animate-pulse">Próxima</span>;
    
    return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase">Pendiente</span>;
  };

  return (
    <div className="max-w-6xl mx-auto pb-32 2xl:pb-10 overflow-auto custom-scrollbar h-full relative">
      {loading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[200] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl animate-spin">🔱</div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Procesando Reserva...</p>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-4 sm:mb-8 lg:mb-4">
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 flex items-center gap-2 sm:gap-4 uppercase tracking-tight">
          <CalendarCheck size={28} className="text-blue-600 sm:w-10 sm:h-10" /> Reservas
        </h1>
        <button
          onClick={() => { playClick(); setShowAddModal(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 sm:px-6 sm:py-3 lg:px-4 lg:py-2 rounded-2xl flex items-center gap-2 font-black text-xs sm:text-base lg:text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-200"
        >
          <Plus size={20} /> Registrar
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-3">
        {reservations.filter(r => r.status === 'pending').length === 0 ? (
          <div className="col-span-full bg-white p-6 sm:p-12 lg:p-6 rounded-3xl border-2 border-dashed border-slate-200 text-center">
            <CalendarCheck size={48} className="mx-auto text-slate-300 mb-2 sm:mb-4 sm:w-16 sm:h-16" />
            <p className="text-slate-500 font-bold text-sm sm:text-xl uppercase">Sin pendientes</p>
          </div>
        ) : (
          reservations
            .filter(r => r.status === 'pending')
            .map((res) => (
            <div 
              key={res.id} 
              className={cn(
                "bg-white p-3 sm:p-6 lg:p-3 rounded-3xl border-2 transition-all shadow-sm flex flex-col",
                res.status === 'cancelled' ? "opacity-60 border-slate-100" : "border-slate-100 hover:border-blue-200 hover:shadow-md"
              )}
            >
              <div className="flex justify-between items-start mb-2 sm:mb-4">
                <div className="flex items-center gap-1 sm:gap-2 text-blue-600 font-black uppercase tracking-tighter text-[9px] sm:text-base lg:text-[10px]">
                  <DoorOpen size={14} className="sm:w-5 sm:h-5 lg:w-4 lg:h-4" />
                  <span className="truncate">{res.roomName}</span>
                </div>
              </div>

              <div className="space-y-1 sm:space-y-3 mb-4 sm:mb-6 lg:mb-4">
                <div className="flex items-center gap-2 sm:gap-3 text-slate-700">
                  <User size={12} className="text-slate-400 sm:w-4 sm:h-4 lg:w-3 lg:h-3" />
                  <span className="font-bold text-[9px] sm:text-sm lg:text-[9px] truncate uppercase">{res.clientName}</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 text-slate-700">
                  <Clock size={12} className="text-slate-400 sm:w-4 sm:h-4 lg:w-3 lg:h-3" />
                  <span className="font-bold text-[8px] sm:text-sm lg:text-[8px] uppercase">
                    {format(parseISO(res.date), 'dd/MM HH:mm')}
                  </span>
                </div>
                {res.abono && res.abono > 0 && (
                  <div className="flex items-center justify-between text-blue-700 bg-blue-50 px-2 py-1 sm:p-4 lg:px-2 lg:py-1 rounded-xl">
                    <span className="text-[7px] sm:text-[9px] font-black uppercase">Abono:</span>
                    <span className="font-black text-[9px] sm:text-sm lg:text-[9px]">${res.abono.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {res.status === 'pending' && (
                <button
                  onClick={() => { playClick(); setCancellingId(res.id); }}
                  className="w-full py-2 sm:py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-black uppercase tracking-widest text-[8px] sm:text-xs lg:text-[8px] transition-colors flex items-center justify-center gap-1 sm:gap-2"
                >
                  <Trash2 size={12} className="sm:w-4 sm:h-4 lg:w-3 lg:h-3" /> Cancelar
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
              {formError && (
                <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-2">
                  <AlertCircle className="shrink-0" />
                  <p className="text-[10px] sm:text-xs">{formError}</p>
                </div>
              )}
              <p className="text-slate-500 font-medium mb-4">Esta acción no se puede deshacer y la habitación quedará disponible.</p>
              
              {(() => {
                const res = reservations.find(r => r.id === cancellingId);
                if (!res) return null;

                if (res.abono && res.abono > 0) {
                  return (
                    <div className="mb-6 space-y-4 pt-4 border-t border-slate-100 text-center">
                      <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 italic text-orange-700 text-sm">
                        Esta reserva tiene un abono de ${res.abono.toLocaleString()}. 
                        <br/>
                        <span className="font-black">RECUERDA QUE NO TIENE DEVOLUCIÓN.</span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { playClick(); setCancellingId(null); setFormError(null); }}
                  className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-colors"
                >
                  No, Volver
                </button>
                <button
                  onClick={() => handleCancelReservation()}
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[95vh] custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900">Nueva Reserva</h3>
              <button onClick={() => { playClick(); setShowAddModal(false); }} className="text-slate-400 hover:text-slate-600">
                <X size={28} />
              </button>
            </div>

            {formError && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl font-bold flex items-center gap-2">
                <AlertCircle className="shrink-0" />
                <p className="text-sm">{formError}</p>
              </div>
            )}

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
                <div className="bg-blue-50 p-4 rounded-2xl space-y-2 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-blue-700 uppercase">Abono Requerido:</span>
                    <span className="text-xl font-black text-blue-800">${Number(abono).toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] font-bold text-blue-600 uppercase text-center border-t border-blue-100 pt-2">
                    Este valor será abonado al total de la cuenta.
                  </p>
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
                          capture="environment"
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

              <div className="bg-blue-50 p-4 rounded-2xl flex flex-col gap-3 text-blue-700 text-sm">
                <div className="flex gap-3">
                  <AlertCircle size={20} className="shrink-0" />
                  <p className="font-medium">
                    Reserva mínima con 1 hora de anticipación. No hay devolución de abono.
                    Cancelación automática tras 30 min de retraso.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black py-5 rounded-2xl text-xl shadow-lg shadow-blue-100 transition-all active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Registrando...</span>
                  </>
                ) : 'Confirmar Reserva'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
