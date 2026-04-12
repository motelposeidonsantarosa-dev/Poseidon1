import { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc, query, where, getDocs, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import { Clock, Users, BedDouble, PlayCircle, StopCircle, Plus, Edit2, X, CalendarCheck, AlertCircle, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { parseISO, isBefore, addHours, subHours, format } from 'date-fns';
import { printTicket } from '../utils/print';

interface Room {
  id: string;
  name: string;
  status: 'Libre' | 'Ocupada' | 'Limpieza';
  startTime: string | null;
  endTime: string | null;
  persons: number;
  total: number;
}

interface Shift {
  id: string;
  hostId: string;
  hostName: string;
  startTime: string;
  status: 'active' | 'closed';
}

export default function Dashboard() {
  const { appUser, logout } = useAuth();
  const { playClick, playSuccess, playError } = useFeedback();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editRoomName, setEditRoomName] = useState('');
  const [showStartShiftModal, setShowStartShiftModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      setInventory(snapshot.docs.map(d => d.data()));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'reservations'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReservations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const getBasePrice = () => {
    const baseService = inventory.find(p => p.name === 'Servicio Base' && p.category === 'Servicios');
    return baseService ? baseService.price : 70000;
  };

  useEffect(() => {
    audioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!appUser) return;
    const q = query(collection(db, 'shifts'), where('hostId', '==', appUser.id), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveShift({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Shift);
        setShowStartShiftModal(false);
      } else {
        setActiveShift(null);
        if (appUser.role === 'host') {
          setShowStartShiftModal(true);
        }
      }
    });
    return () => unsubscribe();
  }, [appUser]);

  useEffect(() => {
    const seedProducts = async () => {
      // Only seed if not already done in this session or if forced
      const isSeeded = localStorage.getItem('poseidon_products_seeded');
      if (isSeeded) return;

      const productsSnap = await getDocs(collection(db, 'products'));
      
      if (productsSnap.empty) {
        const requiredServices = [
          { name: "Servicio Base", price: 70000, stock: 999, category: "Servicios" },
          { name: "Hora Adicional", price: 20000, stock: 999, category: "Servicios" },
          { name: "Persona Adicional", price: 20000, stock: 999, category: "Servicios" },
          { name: "Jacuzzi", price: 20000, stock: 999, category: "Servicios" },
          { name: "Sauna", price: 20000, stock: 999, category: "Servicios" },
          { name: "Turco", price: 20000, stock: 999, category: "Servicios" }
        ];

        const initialProducts = [
          { name: "Cerveza Andina Lata", price: 6000, stock: 50, category: "Bebidas" },
          { name: "Cerveza Águila Negra", price: 6000, stock: 50, category: "Bebidas" },
          { name: "Cerveza Corona", price: 8000, stock: 50, category: "Bebidas" },
          { name: "Cerveza Budweiser", price: 6000, stock: 50, category: "Bebidas" },
          { name: "Cerveza Costeña", price: 6000, stock: 50, category: "Bebidas" },
          { name: "Cerveza Póker", price: 6000, stock: 50, category: "Bebidas" },
          { name: "Smirnoff", price: 14000, stock: 50, category: "Bebidas" },
          { name: "Aguardiente 200 ml", price: 40000, stock: 50, category: "Bebidas" },
          { name: "Champaña JP Chenet Lata", price: 17000, stock: 50, category: "Bebidas" },
          { name: "Champaña JP Chenet 200 ml", price: 35000, stock: 50, category: "Bebidas" },
          { name: "Champaña JP Chenet Grande", price: 110000, stock: 50, category: "Bebidas" },
          { name: "Botella de Agua", price: 2000, stock: 50, category: "Bebidas" },
          { name: "Gatorade", price: 6000, stock: 50, category: "Bebidas" },
          { name: "Soda", price: 4000, stock: 50, category: "Bebidas" },
          { name: "Electrolit", price: 12000, stock: 50, category: "Bebidas" },
          { name: "Coca Cola", price: 4000, stock: 50, category: "Bebidas" },
          { name: "Cola y Pola", price: 4000, stock: 50, category: "Bebidas" },
          { name: "Jugo Hit", price: 3000, stock: 50, category: "Bebidas" },
          { name: "Soda Hatsu", price: 6000, stock: 50, category: "Bebidas" },
          { name: "Retardantes", price: 15000, stock: 50, category: "Sexshop" },
          { name: "Lubricantes", price: 7000, stock: 50, category: "Sexshop" },
          { name: "Condones", price: 5000, stock: 50, category: "Sexshop" }
        ];

        const allToSeed = [...requiredServices, ...initialProducts];
        for (const prod of allToSeed) {
          await addDoc(collection(db, 'products'), prod);
        }
      }
      
      localStorage.setItem('poseidon_products_seeded', 'true');
    };
    seedProducts();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'rooms'), async (snapshot) => {
      if (snapshot.empty) {
        for (let i = 1; i <= 5; i++) {
          await setDoc(doc(db, 'rooms', i.toString()), {
            id: i.toString(),
            name: `Habitación ${i}`,
            status: 'Libre',
            startTime: null,
            endTime: null,
            persons: 2,
            services: [],
            products: [],
            total: getBasePrice(),
            currentHostId: null,
            currentHostName: null
          });
        }
      } else {
        const roomsData = snapshot.docs.map(doc => doc.data() as Room);
        roomsData.sort((a, b) => parseInt(a.id) - parseInt(b.id));
        setRooms(roomsData);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let shouldBeep = false;
    rooms.forEach(room => {
      if (room.status === 'Ocupada' && room.endTime) {
        const end = new Date(room.endTime);
        const diffMs = end.getTime() - now.getTime();
        if (diffMs > 899000 && diffMs <= 900000) {
          shouldBeep = true;
        }
      }
    });

    if (shouldBeep && audioRef.current) {
      audioRef.current.play().catch(e => console.log("Audio play blocked by browser", e));
    }
  }, [now, rooms]);

  const handleStartShift = async () => {
    playClick();
    if (!appUser) return;
    try {
      await addDoc(collection(db, 'shifts'), {
        hostId: appUser.id,
        hostName: appUser.name,
        startTime: new Date().toISOString(),
        status: 'active'
      });
      playSuccess();
    } catch (err) {
      playError();
      console.error(err);
    }
  };

  const [isEndingShift, setIsEndingShift] = useState(false);

  const handleEndShift = async () => {
    playClick();
    if (!activeShift || !appUser) return;
    setIsEndingShift(true);
    
    try {
      // Calculate totals for shift
      const ticketsQ = query(collection(db, 'tickets'), where('hostName', '==', appUser.name));
      const ticketsSnap = await getDocs(ticketsQ);
      let totalIncome = 0;
      let incomeEfectivo = 0;
      let incomeTransferencia = 0;
      let servicesCount = 0;
      
      ticketsSnap.forEach(doc => {
        const data = doc.data();
        if (data.date >= activeShift.startTime) {
          servicesCount++;
          totalIncome += data.total;
          if (data.paymentMethod === 'Transferencia') {
            incomeTransferencia += data.total;
          } else {
            incomeEfectivo += data.total; // Default to Efectivo if not specified
          }
        }
      });

      const expensesQ = query(collection(db, 'expenses'), where('hostName', '==', appUser.name));
      const expensesSnap = await getDocs(expensesQ);
      let totalExpenses = 0;
      expensesSnap.forEach(doc => {
        const data = doc.data();
        if (data.date >= activeShift.startTime) {
          totalExpenses += data.amount;
        }
      });

      const utilidadesTotales = totalIncome - totalExpenses;
      const utilidadesEfectivo = incomeEfectivo - totalExpenses;
      const utilidadesTransferencia = incomeTransferencia;

      // Get active rooms
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

      await updateDoc(doc(db, 'shifts', activeShift.id), shiftSummary);

      // Generate Shift Ticket
      const ticketHtml = `
          <html>
            <head>
              <title>Resumen de Turno</title>
              <style>
                @page { margin: 0; size: 80mm auto; }
                body { font-family: monospace; width: 80mm; margin: 0 auto; padding: 5mm; box-sizing: border-box; font-size: 12px; }
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
                <p>Km 1 Vía Santa Rosa-Simití</p>
                <p>Cel: 3157170874</p>
                <p>motelposeidonsantarosa@gmail.com</p>
                <p>instagram:@motel_poseidon</p>
                <p>Facebook: @PoseidonMot</p>
                <p class="mt-2 font-bold">Resumen de Turno</p>
              </div>
              <div class="mb-4">
                <div class="flex-between"><span>Host:</span> <span>${appUser.name}</span></div>
                <div class="flex-between"><span>Inicio:</span> <span>${new Date(activeShift.startTime).toLocaleTimeString()}</span></div>
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
        await logout();
      }, 2000);
    } catch (err) {
      playError();
      console.error(err);
      setIsEndingShift(false);
    }
  };

  const handleAddRoom = async () => {
    playClick();
    if (!newRoomName.trim()) return;
    try {
      const newId = (rooms.length > 0 ? Math.max(...rooms.map(r => parseInt(r.id))) + 1 : 1).toString();
      await setDoc(doc(db, 'rooms', newId), {
        id: newId,
        name: newRoomName,
        status: 'Libre',
        startTime: null,
        endTime: null,
        persons: 2,
        services: [],
        products: [],
        total: getBasePrice(),
        currentHostId: null,
        currentHostName: null
      });
      playSuccess();
      setNewRoomName('');
      setShowAddRoom(false);
    } catch (err) {
      playError();
      console.error(err);
    }
  };

  const handleEditRoomName = async () => {
    playClick();
    if (!editingRoom || !editRoomName.trim()) return;
    try {
      await updateDoc(doc(db, 'rooms', editingRoom.id), {
        name: editRoomName
      });
      playSuccess();
      setEditingRoom(null);
      setEditRoomName('');
    } catch (err) {
      playError();
      console.error(err);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin text-4xl">🔱</div></div>;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Estado de Habitaciones</h1>
        <div className="flex gap-3">
          {appUser?.role === 'admin' && (
            <button onClick={() => setShowAddRoom(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform hover:scale-105">
              <Plus size={20} /> Añadir Habitación
            </button>
          )}
          {appUser?.role === 'host' && (
            <div className="w-full 2xl:w-auto">
              {!activeShift ? (
                <button 
                  onClick={handleStartShift} 
                  className="w-full 2xl:w-auto bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
                >
                  <PlayCircle size={24} /> Iniciar Turno
                </button>
              ) : (
                <button 
                  onClick={handleEndShift} 
                  disabled={isEndingShift}
                  className={cn(
                    "w-full 2xl:w-auto bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95",
                    isEndingShift && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <StopCircle size={24} className={cn(isEndingShift && "animate-spin")} /> 
                  {isEndingShift ? 'Cerrando Turno...' : 'Terminar Turno'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {rooms.map(room => {
          const isOccupied = room.status === 'Ocupada';
          const isCleaning = room.status === 'Limpieza';
          const isFree = room.status === 'Libre';
          
          // Check for upcoming reservations (within 3 hours / 180 minutes)
          const upcomingReservation = reservations.find(res => {
            const resRoomId = String(res.roomId).trim();
            const currentRoomId = String(room.id).trim();
            if (resRoomId !== currentRoomId) return false;
            
            const resDate = parseISO(res.date);
            const diffMs = resDate.getTime() - now.getTime();
            const diffMins = diffMs / (1000 * 60);
            
            // Show alert if reservation is in the next 180 minutes
            // and hasn't passed more than 15 minutes (grace period)
            return diffMins >= -15 && diffMins <= 180;
          });

          const isReservedSoon = !!upcomingReservation;
          const isActuallyFree = room.status === 'Libre';
          
          let timeLeftStr = '';
          let isWarning = false;

          if (isOccupied && room.endTime) {
            const end = new Date(room.endTime);
            const diffMs = end.getTime() - now.getTime();
            
            if (diffMs <= 0) {
              timeLeftStr = 'Tiempo agotado';
              isWarning = true;
            } else {
              const hours = Math.floor(diffMs / (1000 * 60 * 60));
              const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
              const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
              timeLeftStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
              
              if (diffMs <= 900000) {
                isWarning = true;
              }
            }
          }

          return (
            <Link 
              key={room.id} 
              to={`/room/${room.id}`}
              onClick={playClick}
              className={cn(
                "rounded-2xl p-6 shadow-lg border-2 transition-all active:scale-95 flex flex-col h-full text-white min-h-[220px]",
                isActuallyFree && !isReservedSoon && "bg-emerald-500 border-emerald-600",
                isActuallyFree && isReservedSoon && "bg-blue-600 border-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.7)] animate-pulse",
                isOccupied && !isWarning && "bg-red-600 border-red-700",
                isOccupied && isWarning && "bg-red-600 border-red-700 animate-pulse",
                isCleaning && "bg-yellow-500 border-yellow-600"
              )}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-3xl font-black drop-shadow-md">
                      {room.name}
                    </h2>
                    {appUser?.role === 'admin' && (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          playClick();
                          setEditingRoom(room);
                          setEditRoomName(room.name);
                        }}
                        className="p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                    )}
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full text-sm font-bold mt-2 bg-black/20 backdrop-blur-sm uppercase tracking-wider">
                    {isReservedSoon && isActuallyFree ? 'RESERVADA PRONTO' : room.status}
                  </span>
                </div>
                <BedDouble size={40} className="opacity-80" />
              </div>

              {isReservedSoon && (
                <div className={cn(
                  "mt-4 space-y-2 p-3 rounded-xl backdrop-blur-sm border",
                  isActuallyFree ? "bg-white/20 border-white/30" : "bg-blue-600/40 border-blue-400/50"
                )}>
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-tight">
                    <CalendarCheck size={18} />
                    RESERVA: {format(parseISO(upcomingReservation.date), 'HH:mm')}
                  </div>
                  <div className="flex items-center gap-2 font-bold text-xs truncate">
                    <User size={14} />
                    {upcomingReservation.clientName}
                  </div>
                  {isActuallyFree && (
                    <div className="flex items-center gap-2 font-bold text-[10px] text-blue-50 uppercase">
                      <AlertCircle size={14} />
                      NO OCUPAR
                    </div>
                  )}
                </div>
              )}

              {isOccupied && (
                <div className="mt-auto space-y-3 bg-black/10 p-4 rounded-xl backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-xl font-mono font-bold">
                    <Clock size={24} />
                    {timeLeftStr}
                  </div>
                  <div className="flex items-center gap-2 font-medium text-lg">
                    <Users size={24} />
                    {room.persons} Personas
                  </div>
                  <div className="text-3xl font-black mt-4 drop-shadow-md">
                    ${room.total.toLocaleString('es-CO')}
                  </div>
                </div>
              )}

              {isActuallyFree && !isReservedSoon && (
                <div className="mt-auto text-xl font-bold opacity-90 flex items-center gap-2">
                  <PlayCircle size={24} /> Lista para usar
                </div>
              )}
              
              {isCleaning && (
                <div className="mt-auto text-xl font-bold opacity-90">
                  En mantenimiento / limpieza
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Add Room Modal */}
      {showAddRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900">Añadir Habitación</h3>
              <button onClick={() => setShowAddRoom(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Nombre de la habitación"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAddRoom(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancelar</button>
              <button onClick={handleAddRoom} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Añadir</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Room Name Modal */}
      {editingRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900">Editar Nombre</h3>
              <button onClick={() => setEditingRoom(null)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <input
              type="text"
              value={editRoomName}
              onChange={(e) => setEditRoomName(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Nuevo nombre"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setEditingRoom(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancelar</button>
              <button onClick={handleEditRoomName} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Start Shift Reminder Modal */}
      {showStartShiftModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
            <div className="text-6xl mb-4">📢</div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">¡Bienvenido!</h3>
            <p className="text-slate-600 mb-8">
              Para comenzar a registrar servicios, por favor registre el <strong>Inicio de Turno</strong> en el botón superior derecho.
            </p>
            <button 
              onClick={() => setShowStartShiftModal(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-lg shadow-lg transition-transform hover:scale-105"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

