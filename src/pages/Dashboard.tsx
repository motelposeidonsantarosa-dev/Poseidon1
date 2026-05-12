import { useEffect, useState, useRef, ChangeEvent } from 'react';
import { collection, onSnapshot, doc, setDoc, query, where, getDocs, updateDoc, addDoc, deleteDoc, runTransaction, getDoc, orderBy, limit, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, Users, BedDouble, PlayCircle, StopCircle, Plus, Edit2, X, CalendarCheck, AlertCircle, User, ShoppingBag, Wine, Heart, Trash2, Camera, RotateCcw, Search, Printer, Minus, Cookie } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { handleFirestoreError, OperationType } from '../utils/error';
import { parseISO, isBefore, addHours, subHours, format } from 'date-fns';
import { printTicket } from '../utils/print';
import { compressImage } from '../utils/image';
import { es } from 'date-fns/locale';

const PRODUCT_COLORS = [
  "bg-red-100 text-red-700 hover:bg-red-200",
  "bg-orange-100 text-orange-700 hover:bg-orange-200",
  "bg-amber-100 text-amber-700 hover:bg-amber-200",
  "bg-green-100 text-green-700 hover:bg-green-200",
  "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
  "bg-teal-100 text-teal-700 hover:bg-teal-200",
  "bg-cyan-100 text-cyan-700 hover:bg-cyan-200",
  "bg-blue-100 text-blue-700 hover:bg-blue-200",
  "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
  "bg-violet-100 text-violet-700 hover:bg-violet-200",
  "bg-purple-100 text-purple-700 hover:bg-purple-200",
  "bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200",
  "bg-pink-100 text-pink-700 hover:bg-pink-200",
  "bg-rose-100 text-rose-700 hover:bg-rose-200"
];

interface Room {
  id: string;
  name: string;
  status: 'Libre' | 'Ocupada' | 'Limpieza';
  startTime: string | null;
  endTime: string | null;
  persons: number;
  total: number;
  basePrice?: number;
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
  const navigate = useNavigate();
  const { playClick, playSuccess, playError } = useFeedback();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [globalActiveShift, setGlobalActiveShift] = useState<Shift | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editRoomName, setEditRoomName] = useState('');
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);
  const [showStartShiftModal, setShowStartShiftModal] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Venta Directa States
  const [showDirectSale, setShowDirectSale] = useState(false);
  const [directSaleProducts, setDirectSaleProducts] = useState<any[]>([]);
  const [directSaleTotal, setDirectSaleTotal] = useState(0);
  const [directSalePaymentMethod, setDirectSalePaymentMethod] = useState<'Efectivo' | 'Transferencia' | null>(null);
  const [directSalePhoto, setDirectSalePhoto] = useState<string | null>(null);
  const [isDirectSaleSaving, setIsDirectSaleSaving] = useState(false);
  const [isCapturingDirectPhoto, setIsCapturingDirectPhoto] = useState(false);
  const directFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const prods = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      // Duplicate prevention
      const unique = Array.from(new Map(prods.map((item: any) => [item.name, item])).values());
      setInventory(unique);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'reservations'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReservations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'reservations');
    });
    return () => unsubscribe();
  }, []);

  const getBasePrice = () => {
    const baseService = inventory.find(p => p.name.toLowerCase().trim() === 'servicio base' && p.category === 'Servicios');
    return baseService ? baseService.price : 60000;
  };

  // Sincronizar precios de habitaciones libres cuando cambia el inventario
  useEffect(() => {
    if (inventory.length === 0 || loading) return;
    
    const currentBasePrice = getBasePrice();
    rooms.forEach(async (room) => {
      if (room.status === 'Libre' && (room.total !== currentBasePrice || room.basePrice !== currentBasePrice)) {
        try {
          await updateDoc(doc(db, 'rooms', room.id), { 
            total: currentBasePrice,
            basePrice: currentBasePrice
          });
        } catch (e) {
          console.error("Error syncing room price:", e);
        }
      }
    });
  }, [inventory, rooms, loading]);

  useEffect(() => {
    const checkReservations = async () => {
      const nowMs = now.getTime();
      const staleReservations = reservations.filter(res => {
        if (res.status !== 'pending') return false;
        const resDate = parseISO(res.date);
        const diffMins = (nowMs - resDate.getTime()) / (1000 * 60);
        return diffMins >= 30;
      });

      for (const res of staleReservations) {
        try {
          // 1. Cancel Reservation
          await updateDoc(doc(db, 'reservations', res.id), { status: 'cancelled' });

          // 2. Adjust ticket if it had an abono: remove temporary flag so it stays in history
          if (res.abono && res.abono > 0) {
            const q = query(collection(db, 'tickets'), where('reservationId', '==', res.id), where('isTemporary', '==', true));
            const snap = await getDocs(q);
            for (const d of snap.docs) {
              await updateDoc(d.ref, { 
                isTemporary: false, 
                roomName: `Reserva No Ocupada: ${res.roomName}`,
                isNoShow: true 
              });
            }
            
            // If no ticket was found (unlikely), create it now
            if (snap.empty) {
              await addDoc(collection(db, 'tickets'), {
                roomId: 'NO_SHOW',
                roomName: `Reserva No Ocupada: ${res.roomName}`,
                startTime: res.date,
                endTime: new Date().toISOString(),
                products: [],
                services: [],
                total: res.abono,
                date: new Date().toISOString(),
                hostName: 'Sistema',
                paymentMethod: res.paymentMethod || 'Efectivo',
                reservationAbono: 0,
                finalTotal: res.abono,
                isNoShow: true,
                reservationId: res.id
              });
            }
          }
          
          console.log(`Reserva de ${res.clientName} cancelada automáticamente por retraso.`);
        } catch (err) {
          console.error("Error in auto-cancellation:", err);
        }
      }
    };

    if (reservations.length > 0) {
      checkReservations();
    }
  }, [now, reservations]);

  useEffect(() => {
    audioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!appUser) return;
    
    // Escuchar CUALQUIER turno activo en el sistema
    const qGlobal = query(collection(db, 'shifts'), where('status', '==', 'active'));
    const unsubscribeGlobal = onSnapshot(qGlobal, (snapshot) => {
      if (!snapshot.empty) {
        const shiftDoc = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Shift;
        setGlobalActiveShift(shiftDoc);
        
        // Si el turno activo es el MÍO, lo marco como activeShift
        if (shiftDoc.hostId === appUser.id) {
          setActiveShift(shiftDoc);
          setShowStartShiftModal(false);
        } else {
          setActiveShift(null);
          if (appUser.role === 'host') {
            setShowStartShiftModal(true);
          }
        }
      } else {
        setGlobalActiveShift(null);
        setActiveShift(null);
        if (appUser.role === 'host') {
          setShowStartShiftModal(true);
        }
      }
    });

    return () => unsubscribeGlobal();
  }, [appUser]);

  useEffect(() => {
    if (appUser?.role !== 'admin') return;
    const q = query(
      collection(db, 'notifications'), 
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [appUser]);

  useEffect(() => {
    const seedProducts = async () => {
      const productsSnap = await getDocs(collection(db, 'products'));
      
      if (productsSnap.empty || productsSnap.size < 5) {
        const requiredServices = [
          { name: "Servicio Base", price: 60000, stock: 999, category: "Servicios" },
          { name: "Hora Adicional", price: 20000, stock: 999, category: "Servicios" },
          { name: "Persona Adicional", price: 20000, stock: 999, category: "Servicios" },
          { name: "Jacuzzi", price: 30000, stock: 999, category: "Servicios" },
          { name: "Sauna", price: 20000, stock: 999, category: "Servicios" },
          { name: "Turco", price: 20000, stock: 999, category: "Servicios" },
          { name: "Valor Reserva", price: 40000, stock: 999, category: "Servicios" }
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
        const existingNames = productsSnap.docs.map(doc => doc.data().name);
        
        for (const prod of allToSeed) {
          if (!existingNames.includes(prod.name)) {
            await addDoc(collection(db, 'products'), prod);
          }
        }
      }
    };
    seedProducts();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'rooms'), async (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      roomsData.sort((a, b) => parseInt(a.id) - parseInt(b.id));
      setRooms(roomsData);
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

    // Verificar de nuevo si hay un turno activo global antes de iniciar (por seguridad)
    const q = query(collection(db, 'shifts'), where('status', '==', 'active'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      alert(`No se puede iniciar turno. El host ${snap.docs[0].data().hostName} ya tiene un turno activo.`);
      return;
    }

    try {
      const shiftData = {
        hostId: appUser.id,
        hostName: appUser.name,
        startTime: new Date().toISOString(),
        status: 'active'
      };
      
      const docRef = await addDoc(collection(db, 'shifts'), shiftData);
      
      // Notificación para Admins
      await addDoc(collection(db, 'notifications'), {
        type: 'shift_start',
        userName: appUser.name,
        userId: appUser.id,
        timestamp: new Date().toISOString(),
        message: `El host ${appUser.name} ha INICIADO turno.`,
        readBy: []
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
      let directSalesCount = 0;
      let directSalesTotal = 0;
      
      ticketsSnap.forEach(doc => {
        const data = doc.data();
        if (data.date >= activeShift.startTime) {
          if (data.roomId === 'DIRECTA') {
            directSalesCount++;
            directSalesTotal += data.total;
          } else {
            servicesCount++;
          }
          
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

      // Notificación para Admins
      await addDoc(collection(db, 'notifications'), {
        type: 'shift_end',
        userName: appUser.name,
        userId: appUser.id,
        timestamp: new Date().toISOString(),
        message: `El host ${appUser.name} ha TERMINADO su turno.`,
        readBy: []
      });

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
                <div class="border-t mt-2 pt-2">
                  <div class="flex-between"><span>Servicios Hab:</span> <span>${servicesCount}</span></div>
                  <div class="flex-between"><span>Ventas Directas:</span> <span>${directSalesCount} ($${directSalesTotal.toLocaleString()})</span></div>
                </div>
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

  const handleDirectSaleToggleProduct = (product: any) => {
    playSuccess();
    const existing = directSaleProducts.find(p => p.id === product.id);
    const currentQty = existing ? existing.quantity : 0;

    if (currentQty + 1 > product.stock) {
      playError();
      return;
    }

    let newProducts;
    if (existing) {
      newProducts = directSaleProducts.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p);
    } else {
      newProducts = [...directSaleProducts, { ...product, quantity: 1 }];
    }
    setDirectSaleProducts(newProducts);
    setDirectSaleTotal(newProducts.reduce((acc, p) => acc + (p.price * p.quantity), 0));
  };

  const handleUpdateDirectSaleQuantity = (productId: string, delta: number) => {
    const existing = directSaleProducts.find(p => p.id === productId);
    if (!existing) return;

    if (delta > 0) {
      // Check stock
      const inventoryItem = inventory.find(i => i.id === productId);
      if (inventoryItem && existing.quantity + 1 > inventoryItem.stock) {
        playError();
        return;
      }
    }

    playClick();
    const newProducts = directSaleProducts.map(p => {
      if (p.id === productId) {
        const newQty = Math.max(1, p.quantity + delta);
        return { ...p, quantity: newQty };
      }
      return p;
    });

    setDirectSaleProducts(newProducts);
    setDirectSaleTotal(newProducts.reduce((acc, p) => acc + (p.price * p.quantity), 0));
  };

  const handleDirectSaleRemoveProduct = (productId: string) => {
    playClick();
    const newProducts = directSaleProducts.filter(p => p.id !== productId);
    setDirectSaleProducts(newProducts);
    setDirectSaleTotal(newProducts.reduce((acc, p) => acc + (p.price * p.quantity), 0));
  };

  const handleProcessDirectSale = async (method: 'Efectivo' | 'Transferencia', photoToSave?: string | null) => {
    if (directSaleProducts.length === 0) return;
    setIsDirectSaleSaving(true);
    playClick();

    try {
      // Offline-friendly invoice fetch
      const invoiceRef = doc(db, 'settings', 'invoice');
      let currentInvoiceNumber = null;
      try {
        const invoiceDoc = await Promise.race([
          getDoc(invoiceRef),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
        ]) as any;
        if (invoiceDoc && invoiceDoc.exists() && invoiceDoc.data().enabled) {
          currentInvoiceNumber = invoiceDoc.data().currentNumber;
          updateDoc(invoiceRef, { currentNumber: increment(1) }).catch(e => console.error(e));
        }
      } catch(e) {
        console.warn("Could not read invoice settings (possibly offline), continuing without invoice number.", e);
      }

      // Create ticket
      const ticketRef = doc(collection(db, 'tickets'));
      const ticketData = {
        roomId: 'DIRECTA',
        roomName: 'Venta Directa',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        products: directSaleProducts,
        services: [],
        total: directSaleTotal,
        date: new Date().toISOString(),
        hostId: appUser?.id || '',
        hostName: appUser?.name || 'Desconocido',
        shiftId: activeShift?.id || null,
        paymentMethod: method,
        invoiceNumber: currentInvoiceNumber,
        transferPhoto: method === 'Transferencia' ? (photoToSave || directSalePhoto) : null
      };

      // Apply ticket and increment sequentially (optimistic UI)
      setDoc(ticketRef, ticketData).catch(e => console.error(e));
      
      directSaleProducts.forEach((item) => {
        updateDoc(doc(db, 'products', item.id), { stock: increment(-item.quantity) }).catch(e => console.error(e));
      });

      // Print
      const ticketHtml = `
          <html>
            <head>
              <title>Venta Directa</title>
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
                <p>Facebook: @PoseidonMot</p>
                <p class="font-bold border-t border-b py-1" style="margin-top: 5px; font-size: 1.1rem;">VENTA DIRECTA</p>
                ${currentInvoiceNumber ? `<p style="font-size: 1.2rem; font-weight: bold; margin-top: 5px;">FACTURA NÚMERO: ${currentInvoiceNumber}</p>` : ''}
                ${method === 'Transferencia' && (photoToSave || directSalePhoto) ? `<p style="color: blue; font-weight: bold;">[COMPROBANTE ADJUNTO EN SISTEMA]</p>` : ''}
              </div>
              <div class="border-t border-b">
                <div class="flex-between"><span>Fecha:</span> <span>${format(new Date(), 'dd/MM/yyyy HH:mm')}</span></div>
                <div class="flex-between"><span>Atiende:</span> <span>${appUser?.name}</span></div>
                <div class="flex-between"><span>Pago:</span> <span>${method}</span></div>
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
                  ${directSaleProducts.map(p => `
                    <tr>
                      <td>${p.quantity}</td>
                      <td>${p.name}</td>
                      <td class="text-right">$${(p.price * p.quantity).toLocaleString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div class="border-t flex-between font-bold" style="font-size: 1.2rem;">
                <span>TOTAL</span>
                <span>$${directSaleTotal.toLocaleString()}</span>
              </div>
              <div class="text-center border-t mt-4">
                <p class="font-bold">EN POSEIDÓN, TE SENTIRÁS COMO LOS DIOSES</p>
                <p>¡Gracias por tu compra!</p>
              </div>
            </body>
          </html>
        `;
        printTicket(ticketHtml);
        playSuccess();
        setShowDirectSale(false);
        setDirectSaleProducts([]);
        setDirectSaleTotal(0);
        setDirectSalePaymentMethod(null);
        setDirectSalePhoto(null);
    } catch (err) {
      playError();
      console.error(err);
      alert('Error al realizar la venta directa.');
    } finally {
      setIsDirectSaleSaving(false);
    }
  };

  const handleDirectPhotoCapture = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result as string);
          setDirectSalePhoto(compressed);
          setIsCapturingDirectPhoto(false);
          playSuccess();
        } catch (err) {
          playError();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddRoom = async (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    playClick();
    if (!newRoomName.trim()) return;
    
    // Close modal immediately to ensure it closes
    setShowAddRoom(false);
    
    try {
      const newId = (rooms.length > 0 ? Math.max(...rooms.map(r => parseInt(r.id))) + 1 : 1).toString();
      // fire-and-forget
      setDoc(doc(db, 'rooms', newId), {
        id: newId,
        name: newRoomName,
        status: 'Libre',
        startTime: null,
        endTime: null,
        persons: 2,
        services: [],
        products: [],
        total: getBasePrice(),
        basePrice: getBasePrice(),
        currentHostId: null,
        currentHostName: null
      }).catch(console.error);
      playSuccess();
      setNewRoomName('');
    } catch (err) {
      playError();
      console.error(err);
    }
  };

  const handleEditRoomName = async () => {
    playClick();
    if (!editingRoom || !editRoomName.trim()) return;
    try {
      updateDoc(doc(db, 'rooms', editingRoom.id), {
        name: editRoomName
      }).catch(console.error);
      playSuccess();
      setEditingRoom(null);
      setEditRoomName('');
    } catch (err) {
      playError();
      console.error(err);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    playClick();
    setRoomToDelete(roomId);
  };

  const confirmDeleteRoom = async (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!roomToDelete) return;
    
    // Grab ID and close modal immediately
    const targetRoom = roomToDelete;
    setRoomToDelete(null);
    
    try {
      deleteDoc(doc(db, 'rooms', targetRoom)).catch(console.error);
      playSuccess();
    } catch (err) {
      playError();
      console.error(err);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center">
      <div className="text-7xl animate-spin mb-4">🔱</div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Cargando Sistema...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      {(isNavigating || isDirectSaleSaving) && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[200] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl animate-spin">🔱</div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">
              {isDirectSaleSaving ? 'Procesando Venta...' : 'Cargando Habitación...'}
            </p>
          </div>
        </div>
      )}
      {appUser?.role === 'admin' && inventory.filter(p => !['Servicios', 'Servicio'].includes(p.category) && p.stock <= 5).length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 sm:p-4 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0 animate-pulse">
              <AlertCircle size={24} className="text-red-600" />
            </div>
            <div>
              <h4 className="font-black text-sm sm:text-base uppercase tracking-tight text-red-900 leading-none mb-1">Stock Critico</h4>
              <p className="text-[10px] sm:text-xs font-bold opacity-80 leading-tight">
                Hay {inventory.filter(p => !['Servicios', 'Servicio'].includes(p.category) && p.stock <= 5).length} items con 5 uds o menos.
              </p>
            </div>
          </div>
          <button onClick={() => { playClick(); navigate('/dashboard/inventory'); }} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-xl text-[9px] sm:text-xs font-bold uppercase transition-colors shrink-0 whitespace-nowrap shadow-sm active:scale-95">
            Comprar
          </button>
        </div>
      )}

      <div className="flex justify-between items-center mb-4 lg:mb-4 sm:mb-5">
        <h1 className="text-xl sm:text-2xl lg:text-xl font-bold text-slate-900 uppercase tracking-tight">Estado de Habitaciones</h1>
        <div className="flex flex-wrap sm:flex-nowrap gap-2">
          <button 
            onClick={() => { playClick(); setShowDirectSale(true); }} 
            className="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1.5 lg:px-3 lg:py-2 border border-amber-600/20 rounded-xl font-bold text-[10px] sm:text-xs lg:text-[10px] flex items-center gap-2 shadow-sm transition-transform hover:scale-105"
          >
            <ShoppingBag size={16} /> Venta Directa
          </button>
          {appUser?.role === 'admin' && (
            <button onClick={() => { playClick(); setShowAddRoom(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 lg:px-3 lg:py-2 border border-blue-700/20 rounded-xl font-bold text-[10px] sm:text-xs lg:text-[10px] flex items-center gap-2 shadow-sm transition-transform hover:scale-105">
              <Plus size={16} /> Añadir Habitación
            </button>
          )}
          {appUser?.role === 'host' && (
            <div className="w-full lg:w-auto 2xl:w-auto">
              {!activeShift ? (
                <button 
                  onClick={handleStartShift} 
                  className="w-full lg:w-auto 2xl:w-auto bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 lg:px-4 lg:py-2 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 text-[10px] sm:text-xs lg:text-[10px] uppercase"
                >
                  <PlayCircle size={18} /> Iniciar Turno
                </button>
              ) : (
                <button 
                  onClick={handleEndShift} 
                  disabled={isEndingShift}
                  className={cn(
                    "w-full lg:w-auto 2xl:w-auto bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 lg:px-4 lg:py-2 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 text-[10px] sm:text-xs lg:text-[10px] uppercase",
                    isEndingShift && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <StopCircle size={18} className={cn(isEndingShift && "animate-spin")} /> 
                  {isEndingShift ? 'Cerrando Turno...' : 'Terminar Turno'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5 gap-2 sm:gap-4 lg:gap-2 xl:gap-3">
        {rooms.map(room => {
          const isOccupied = room.status === 'Ocupada';
          const isCleaning = room.status === 'Limpieza';
          const isFree = room.status === 'Libre';
          
          // Check for upcoming reservations (within 2 hours / 120 minutes)
          const upcomingReservation = reservations.find(res => {
            const resRoomId = String(res.roomId).trim();
            const currentRoomId = String(room.id).trim();
            if (resRoomId !== currentRoomId) return false;
            
            const resDate = parseISO(res.date);
            const diffMs = resDate.getTime() - now.getTime();
            const diffMins = diffMs / (1000 * 60);
            
            // Show alert if reservation is in the next 120 minutes
            // and hasn't passed more than 15 minutes (grace period)
            return diffMins >= -15 && diffMins <= 120;
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
              to={`/dashboard/room/${room.id}`}
              onClick={(e) => {
                e.preventDefault();
                playClick();
                setIsNavigating(true);
                setTimeout(() => {
                  navigate(`/dashboard/room/${room.id}`);
                }, 300);
              }}
              className={cn(
                "rounded-xl sm:rounded-2xl p-2 sm:p-3.5 lg:p-2 shadow-lg border-2 transition-all active:scale-95 flex flex-col h-full text-white min-h-[110px] sm:min-h-[160px] lg:min-h-[110px] xl:min-h-0 xl:aspect-square relative overflow-hidden",
                isActuallyFree && !isReservedSoon && "bg-emerald-500 border-emerald-600",
                isActuallyFree && isReservedSoon && "bg-blue-600 border-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.7)] animate-pulse",
                isOccupied && !isWarning && "bg-red-600 border-red-700",
                isOccupied && isWarning && "bg-red-600 border-red-700 animate-pulse",
                isCleaning && "bg-yellow-500 border-yellow-600"
              )}
            >
              <div className="flex justify-between items-start mb-1 sm:mb-2 lg:mb-1">
                <div>
                  <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-1">
                    <h2 className="text-sm sm:text-lg lg:text-sm xl:text-lg font-black drop-shadow-md uppercase">
                      {room.name}
                    </h2>
                    {appUser?.role === 'admin' && (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            playClick();
                            setEditingRoom(room);
                            setEditRoomName(room.name);
                          }}
                          className="p-1 sm:p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors"
                         
                        >
                          <Edit2 size={10} className="sm:hidden lg:block lg:w-3 lg:h-3" />
                          <Edit2 size={18} className="hidden sm:block lg:hidden" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteRoom(room.id);
                          }}
                          className="p-1 sm:p-2 bg-white/20 hover:bg-red-500 hover:text-white rounded-full transition-colors"
                         
                        >
                          <Trash2 size={10} className="sm:hidden lg:block lg:w-3 lg:h-3" />
                          <Trash2 size={18} className="hidden sm:block lg:hidden" />
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="inline-block px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[7px] sm:text-sm lg:text-[7px] xl:text-[10px] font-bold mt-1 sm:mt-2 lg:mt-1 bg-black/20 backdrop-blur-sm uppercase tracking-wider">
                    {isReservedSoon && isActuallyFree ? 'RESERVA' : room.status}
                  </span>
                </div>
                <BedDouble size={20} className="sm:hidden lg:block lg:w-5 lg:h-5 opacity-80" />
                <BedDouble size={40} className="hidden sm:block lg:hidden opacity-80" />
              </div>

              {isReservedSoon && (
                <div className={cn(
                  "mt-1 sm:mt-4 space-y-0.5 sm:space-y-2 p-1.5 sm:p-3 rounded-lg sm:rounded-xl backdrop-blur-sm border",
                  isActuallyFree ? "bg-white/20 border-white/30" : "bg-blue-600/40 border-blue-400/50"
                )}>
                  <div className="flex items-center gap-1 sm:gap-2 text-[8px] sm:text-sm lg:text-[8px] xl:text-[11px] font-black uppercase tracking-tight">
                    <CalendarCheck size={10} className="sm:hidden lg:block lg:w-3 lg:h-3" />
                    <CalendarCheck size={18} className="hidden sm:block lg:hidden" />
                    {format(parseISO(upcomingReservation.date), 'HH:mm')}
                  </div>
                </div>
              )}

              {isOccupied && (
                <div className="mt-auto space-y-0.5 sm:space-y-3 lg:space-y-0.5 bg-black/10 p-1.5 sm:p-4 lg:p-1.5 rounded-lg sm:rounded-xl backdrop-blur-sm">
                  <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xl lg:text-[10px] xl:text-base font-mono font-bold">
                    <Clock size={12} className="sm:hidden lg:block lg:w-3 lg:h-3" />
                    <Clock size={24} className="hidden sm:block lg:hidden" />
                    {timeLeftStr}
                  </div>
                  <div className="text-xs sm:text-3xl lg:text-xs xl:text-2xl font-black mt-0.5 sm:mt-4 lg:mt-0.5 xl:mt-2 drop-shadow-md">
                    ${room.total.toLocaleString('es-CO')}
                  </div>
                </div>
              )}

              {isActuallyFree && !isReservedSoon && (
                <div className="mt-auto text-[8px] sm:text-xl lg:text-[8px] xl:text-sm font-black opacity-90 flex items-center gap-1 sm:gap-2 uppercase">
                  <PlayCircle size={12} className="sm:hidden lg:block lg:w-3 lg:h-3" />
                  <PlayCircle size={24} className="hidden sm:block lg:hidden" />
                  LIBRE
                </div>
              )}
              
              {isCleaning && (
                <div className="mt-auto text-[8px] sm:text-xl lg:text-[8px] xl:text-xs font-black uppercase tracking-tighter opacity-90">
                  LIMPIEZA
                </div>
              )}

              {/* Marca de agua del número de habitación (Gigante, siempre visible y 60% opacidad) */}
              <div className="absolute -bottom-2 -right-1 text-6xl sm:text-8xl lg:text-7xl xl:text-9xl font-black italic opacity-60 pointer-events-none select-none leading-none z-0 text-white">
                {room.name.match(/\d+/)?.[0] || room.id}
              </div>
            </Link>
          );
        })}
      </div>
      
      {/* Notifications Section (Only for Admins) */}
      {appUser?.role === 'admin' && notifications.length > 0 && (
        <div className="mt-8 bg-white/50 backdrop-blur-sm rounded-[2rem] p-6 border border-slate-100 shadow-sm animate-in slide-in-from-bottom-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <AlertCircle size={16} className="text-blue-500" /> Historial Reciente de Turnos
          </h3>
          <div className="space-y-2">
            {notifications.map((notif) => (
              <div key={notif.id} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-50 shadow-sm group hover:border-blue-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm",
                    notif.type === 'shift_start' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                  )}>
                    {notif.type === 'shift_start' ? <PlayCircle size={16} /> : <StopCircle size={16} />}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-700 leading-tight">{notif.message}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-0.5">
                      {format(new Date(notif.timestamp), "d 'de' MMMM, HH:mm", { locale: es })}
                    </p>
                  </div>
                </div>
                <div className="text-[8px] font-black text-slate-300 uppercase group-hover:text-blue-400 transition-colors">Notificación</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Room Modal */}
      {showAddRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900">Añadir Habitación</h3>
              <button onClick={() => { playClick(); setShowAddRoom(false); }} className="text-slate-400 hover:text-slate-600">
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
              <button onClick={() => { playClick(); setShowAddRoom(false); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancelar</button>
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
              <button onClick={() => { playClick(); setEditingRoom(null); }} className="text-slate-400 hover:text-slate-600">
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
              <button onClick={() => { playClick(); setEditingRoom(null); }} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancelar</button>
              <button onClick={handleEditRoomName} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Inicio de Turno / Bloqueo */}
      {showStartShiftModal && appUser?.role === 'host' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
            
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-inner mt-4">
              <div className="text-4xl drop-shadow-md">🔱</div>
            </div>

            <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Bienvenido, {appUser.name}</h2>
            
            {globalActiveShift ? (
              <>
                <p className="text-slate-600 mb-8 font-medium">
                  Actualmente hay un turno activo manejado por:
                  <span className="block text-amber-600 font-black mt-1 uppercase tracking-wider">{globalActiveShift.hostName}</span>
                </p>
                <div className="p-4 bg-red-50 rounded-2xl border border-red-100 mb-8">
                  <div className="flex items-center gap-2 text-red-700 font-bold justify-center text-sm uppercase">
                    <AlertCircle size={18} /> Sistema Bloqueado
                  </div>
                  <p className="text-[10px] text-red-600 mt-1 uppercase font-black tracking-widest">Sólo puede haber un host en turno a la vez.</p>
                </div>
                <button 
                  onClick={() => { playClick(); logout(); }}
                  className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-2xl font-black transition-all active:scale-95 uppercase tracking-wider text-sm shadow-xl"
                >
                  Cerrar Sesión
                </button>
              </>
            ) : (
              <>
                <p className="text-slate-600 mb-8 font-medium italic">
                  Para acceder a las funciones del motel, primero debes iniciar tu turno.
                </p>
                <div className="space-y-3">
                  <button 
                    onClick={handleStartShift}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black shadow-lg shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wider text-sm border-b-4 border-emerald-800"
                  >
                    <PlayCircle size={20} /> Iniciar Turno Ahora
                  </button>
                  <button 
                    onClick={() => { playClick(); logout(); }}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-500 py-3 rounded-2xl font-bold transition-all active:scale-95 uppercase text-[10px] tracking-widest"
                  >
                    Salir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Venta Directa Modal */}
      {showDirectSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-2 md:p-4">
          <div className="bg-white rounded-3xl p-4 lg:p-8 max-w-6xl w-full h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <input 
              type="file" 
              accept="image/*" 
              capture="environment"
              ref={directFileInputRef} 
              onChange={handleDirectPhotoCapture}
              className="hidden" 
            />
            
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <ShoppingBag size={32} className="text-amber-500" />
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Venta Directa</h3>
              </div>
              <button 
                onClick={() => { playClick(); setShowDirectSale(false); }} 
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row gap-8 pb-10 sm:pb-0">
              {/* Left Column: Products Selection */}
              <div className="w-full lg:flex-1 lg:overflow-y-auto lg:pr-2 custom-scrollbar space-y-8 pb-8">
                {/* Bebidas */}
                <section>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 border-b pb-2">
                    <Wine size={16} /> Bebidas
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 [@media(max-height:600px)_and_(orientation:landscape)]:grid-cols-4 gap-2 sm:gap-3">
                    {(() => {
                      const getBOrder = (name: string) => {
                        const low = name.toLowerCase();
                        if (low.includes('cerveza')) return 1;
                        if (low.includes('aguardiente')) return 2;
                        if (low.includes('smirnoff')) return 3;
                        if (low.includes('champaña')) return 4;
                        if (low.includes('agua')) return 5;
                        if (low.includes('coca cola')) return 6;
                        if (low === 'soda') return 7;
                        if (low.includes('electrolit')) return 8;
                        if (low.includes('hatsu')) return 9;
                        if (low.includes('gatorade')) return 10;
                        if (low.includes('cola y pola')) return 11;
                        if (low.includes('jugo hit')) return 12;
                        return 99;
                      };
                      
                      return inventory
                        .filter(p => p.category === 'Bebidas')
                        .sort((a, b) => {
                          const oa = getBOrder(a.name);
                          const ob = getBOrder(b.name);
                          if (oa !== ob) return oa - ob;
                          return a.name.localeCompare(b.name);
                        })
                        .map((p, idx) => {
                          const inCart = directSaleProducts.find(item => item.id === p.id)?.quantity || 0;
                          const effectiveStock = p.stock - inCart;
                          return (
                            <button
                              key={p.id}
                              onClick={() => handleDirectSaleToggleProduct(p)}
                              className={cn(
                                "p-3 sm:p-4 rounded-3xl text-left transition-all active:scale-95 shadow-sm border border-transparent flex flex-col justify-between h-24 sm:h-32 relative overflow-hidden group",
                                PRODUCT_COLORS[idx % PRODUCT_COLORS.length]
                              )}
                              disabled={effectiveStock <= 0}
                            >
                              <div className="relative z-10">
                                <div className="text-[10px] font-black uppercase opacity-60 leading-none mb-1">{p.name}</div>
                                <div className="text-xl font-black tracking-tighter leading-none">${p.price.toLocaleString()}</div>
                              </div>
                              <div className="relative z-10 flex justify-between items-end">
                                <span className={cn(
                                  "text-[11px] sm:text-xs font-black uppercase px-2 py-0.5 rounded-full",
                                  effectiveStock >= 15 ? "bg-green-500 text-white" : effectiveStock >= 5 ? "bg-amber-500 text-white" : "bg-red-500 text-white"
                                )}>Stock: {effectiveStock}</span>
                                <Plus size={20} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </button>
                          );
                        });
                    })()}
                  </div>
                </section>

                {/* Sexshop */}
                <section>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 border-b pb-2">
                    <Heart size={16} /> Sex Shop
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 [@media(max-height:600px)_and_(orientation:landscape)]:grid-cols-4 gap-2 sm:gap-3">
                    {inventory.filter(p => p.category === 'Sexshop' || p.category === 'Sex Shop').map((p, idx) => {
                      const inCart = directSaleProducts.find(item => item.id === p.id)?.quantity || 0;
                      const effectiveStock = p.stock - inCart;
                      return (
                         <button
                          key={p.id}
                          onClick={() => handleDirectSaleToggleProduct(p)}
                          className={cn(
                            "p-3 sm:p-4 rounded-3xl text-left transition-all active:scale-95 shadow-sm border border-transparent flex flex-col justify-between h-24 sm:h-32 relative overflow-hidden group",
                            PRODUCT_COLORS[(idx + 6) % PRODUCT_COLORS.length]
                          )}
                          disabled={effectiveStock <= 0}
                        >
                          <div className="relative z-10 w-full">
                            <div className="text-[8px] font-black uppercase opacity-60 leading-[1.1] mb-1 whitespace-normal">{p.name}</div>
                            <div className="text-xl font-black tracking-tighter leading-none">${p.price.toLocaleString()}</div>
                          </div>
                          <div className="relative z-10 flex justify-between items-end">
                            <span className={cn(
                              "text-[11px] sm:text-xs font-black uppercase px-2 py-0.5 rounded-full",
                              effectiveStock >= 15 ? "bg-green-500 text-white" : effectiveStock >= 5 ? "bg-amber-500 text-white" : "bg-red-500 text-white"
                            )}>Stock: {effectiveStock}</span>
                            <Plus size={20} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Snacks */}
                <section>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 border-b pb-2">
                    <Cookie size={16} /> Snacks
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 [@media(max-height:600px)_and_(orientation:landscape)]:grid-cols-4 gap-2 sm:gap-3">
                    {inventory.filter(p => p.category === 'Snacks').map((p, idx) => {
                      const inCart = directSaleProducts.find(item => item.id === p.id)?.quantity || 0;
                      const effectiveStock = p.stock - inCart;
                      return (
                         <button
                          key={p.id}
                          onClick={() => handleDirectSaleToggleProduct(p)}
                          className={cn(
                            "p-3 sm:p-4 rounded-3xl text-left transition-all active:scale-95 shadow-sm border border-transparent flex flex-col justify-between h-24 sm:h-32 relative overflow-hidden group",
                            PRODUCT_COLORS[(idx + 3) % PRODUCT_COLORS.length]
                          )}
                          disabled={effectiveStock <= 0}
                        >
                          <div className="relative z-10 w-full">
                            <div className="text-[8px] font-black uppercase opacity-60 leading-[1.1] mb-1 whitespace-normal">{p.name}</div>
                            <div className="text-xl font-black tracking-tighter leading-none">${p.price.toLocaleString()}</div>
                          </div>
                          <div className="relative z-10 flex justify-between items-end">
                            <span className={cn(
                              "text-[11px] sm:text-xs font-black uppercase px-2 py-0.5 rounded-full",
                              effectiveStock >= 15 ? "bg-green-500 text-white" : effectiveStock >= 5 ? "bg-amber-500 text-white" : "bg-red-500 text-white"
                            )}>Stock: {effectiveStock}</span>
                            <Plus size={20} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              {/* Right Column: Order Summary & Checkout */}
              <div className="w-full lg:w-[320px] 2xl:w-[380px] flex flex-col lg:h-full bg-slate-50 rounded-[2.5rem] p-3 md:p-4 border border-slate-100 shadow-inner mt-4 lg:mt-0 lg:overflow-y-auto custom-scrollbar">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-1">Resumen de Venta</h4>
                
                <div className="flex-1 overflow-y-auto space-y-1.5 mb-2 pr-1 custom-scrollbar min-h-[200px]">
                  {directSaleProducts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center py-12">
                      <ShoppingBag size={48} className="mb-4 opacity-10" />
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-40 text-center">Pedido Vacío</p>
                    </div>
                  ) : (
                    directSaleProducts.map(p => (
                      <div key={p.id} className="bg-white p-2 rounded-xl border border-slate-100 flex justify-between items-center group animate-in slide-in-from-right-4 shadow-sm">
                        <div className="flex-1 min-w-0 pr-1">
                          <div className="text-[9px] font-black text-slate-900 uppercase truncate mb-0.5 leading-none">{p.name}</div>
                          <div className="text-[9px] font-bold text-slate-400 leading-none">
                            ${p.price.toLocaleString()} x {p.quantity}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-100">
                            <button 
                              onClick={() => handleUpdateDirectSaleQuantity(p.id, -1)}
                              className="w-5 h-5 flex items-center justify-center hover:bg-white rounded-md transition-colors text-slate-400"
                            >
                              <Minus size={10} />
                            </button>
                            <span className="w-5 text-center text-[10px] font-black">{p.quantity}</span>
                            <button 
                              onClick={() => handleUpdateDirectSaleQuantity(p.id, 1)}
                              className="w-5 h-5 flex items-center justify-center hover:bg-white rounded-md transition-colors text-slate-400"
                            >
                              <Plus size={10} />
                            </button>
                          </div>
                          <span className="text-[10px] font-black text-amber-600 tracking-tighter w-14 text-right leading-none">${(p.price * p.quantity).toLocaleString()}</span>
                          <button 
                            onClick={() => handleDirectSaleRemoveProduct(p.id)} 
                            className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-slate-200 pt-2 space-y-3">
                  <div className="flex flex-col items-end px-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 leading-none">Total Venta</span>
                    <span className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter leading-none">${directSaleTotal.toLocaleString()}</span>
                  </div>

                  {!directSalePaymentMethod ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => { playClick(); setDirectSalePaymentMethod('Efectivo'); }}
                        disabled={directSaleProducts.length === 0 || isDirectSaleSaving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-xl shadow-emerald-100 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2"
                      >
                        Efectivo
                      </button>
                      <button 
                        onClick={() => { playClick(); setDirectSalePaymentMethod('Transferencia'); }}
                        disabled={directSaleProducts.length === 0 || isDirectSaleSaving}
                        className="bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-2xl font-black uppercase text-xs shadow-xl shadow-amber-100 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2"
                      >
                        Transfer
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                      <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Pago: {directSalePaymentMethod}</span>
                          <button onClick={() => { playClick(); setDirectSalePaymentMethod(null); }} className="text-amber-400 hover:text-amber-600">
                            <X size={14} />
                          </button>
                        </div>

                        {directSalePaymentMethod === 'Transferencia' && (
                          <div className="space-y-3">
                            {directSalePhoto ? (
                              <div className="relative">
                                <img src={directSalePhoto} alt="Comprobante" className="w-full h-24 object-cover rounded-xl shadow-md" />
                                <button 
                                  onClick={() => { playClick(); setDirectSalePhoto(null); }} 
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => { playClick(); directFileInputRef.current?.click(); }}
                                className="w-full py-4 bg-amber-50 text-amber-600 border-2 border-dashed border-amber-200 rounded-xl font-bold flex flex-col items-center gap-2 hover:bg-amber-100 transition-colors"
                              >
                                <Camera size={20} />
                                <span className="text-[9px] uppercase">Adjuntar Comprobante</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={() => handleProcessDirectSale(directSalePaymentMethod)}
                        disabled={isDirectSaleSaving || (directSalePaymentMethod === 'Transferencia' && !directSalePhoto)}
                        className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-2xl font-black uppercase text-base shadow-2xl transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2"
                      >
                        {isDirectSaleSaving ? (
                          <RotateCcw className="animate-spin" size={20} />
                        ) : (
                          <>
                            <Printer size={20} />
                            <span>Confirmar Venta</span>
                          </>
                        )}
                      </button>
                      
                      <button 
                        onClick={() => { playClick(); setDirectSalePaymentMethod(null); }}
                        className="w-full py-1 text-slate-400 font-bold uppercase text-[9px] tracking-widest"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {roomToDelete && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-sm border border-slate-100 shadow-2xl relative overflow-hidden text-center">
            <div className="absolute top-0 inset-x-0 h-4 bg-gradient-to-r from-red-500 to-rose-600" />
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={40} className="text-red-500 ml-1" />
            </div>
            
            <h3 className="text-slate-900 font-black text-xl mb-3 tracking-tight">
              ¿Eliminar Habitación?
            </h3>
            
            <p className="text-slate-500 text-xs font-medium mb-8 leading-relaxed">
              Esta acción no se puede deshacer. Todos los datos de la habitación serán borrados permanentemente.
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => { playClick(); setRoomToDelete(null); }}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-colors uppercase tracking-widest text-[10px]"
              >
                Cancelar
              </button>
              <button 
                onClick={() => { playClick(); confirmDeleteRoom(); }}
                className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-500/30 uppercase tracking-widest text-[10px] active:scale-95"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

