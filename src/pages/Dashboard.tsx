import { useEffect, useState, useRef, ChangeEvent } from 'react';
import { collection, onSnapshot, doc, setDoc, query, where, getDocs, updateDoc, addDoc, deleteDoc, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, Users, BedDouble, PlayCircle, StopCircle, Plus, Edit2, X, CalendarCheck, AlertCircle, User, ShoppingBag, Wine, Heart, Trash2, Camera, RotateCcw, Search, Printer, Minus } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editRoomName, setEditRoomName] = useState('');
  const [showStartShiftModal, setShowStartShiftModal] = useState(false);

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
          { name: "Servicio Base", price: 60000, stock: 999, category: "Servicios" },
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
            basePrice: getBasePrice(),
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
    playClick();
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
      await runTransaction(db, async (transaction) => {
        // Step 1: Fetch all required data first (Reads)
        const invoiceRef = doc(db, 'settings', 'invoice');
        const invoiceDoc = await transaction.get(invoiceRef);
        
        const prodDocs = await Promise.all(
          directSaleProducts.map(item => transaction.get(doc(db, 'products', item.id)))
        );

        // Step 2: Handle Invoice number (Writes)
        let currentInvoiceNumber = null;
        if (invoiceDoc.exists() && invoiceDoc.data().enabled) {
          currentInvoiceNumber = invoiceDoc.data().currentNumber;
          transaction.update(invoiceRef, { currentNumber: currentInvoiceNumber + 1 });
        }

        // Step 3: Create ticket (Writes)
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
        transaction.set(ticketRef, ticketData);

        // Step 4: Update stock (Writes)
        prodDocs.forEach((prodDoc, index) => {
          if (prodDoc.exists()) {
            const item = directSaleProducts[index];
            const currentStock = prodDoc.data().stock || 0;
            transaction.update(prodDoc.ref, { stock: Math.max(0, currentStock - item.quantity) });
          }
        });

        return { currentInvoiceNumber, method, photoToSave };
      }).then(async (result) => {
        // Step 4: Print
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
                ${result.currentInvoiceNumber ? `<p style="font-size: 1.2rem; font-weight: bold; margin-top: 5px;">FACTURA NÚMERO: ${result.currentInvoiceNumber}</p>` : ''}
                ${result.method === 'Transferencia' && (result.photoToSave || directSalePhoto) ? `<p style="color: blue; font-weight: bold;">[COMPROBANTE ADJUNTO EN SISTEMA]</p>` : ''}
              </div>
              <div class="border-t border-b">
                <div class="flex-between"><span>Fecha:</span> <span>${format(new Date(), 'dd/MM/yyyy HH:mm')}</span></div>
                <div class="flex-between"><span>Atiende:</span> <span>${appUser?.name}</span></div>
                <div class="flex-between"><span>Pago:</span> <span>${result.method}</span></div>
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
      });
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
        <div className="flex flex-wrap sm:flex-nowrap gap-3">
          <button 
            onClick={() => { playClick(); setShowDirectSale(true); }} 
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform hover:scale-105"
          >
            <ShoppingBag size={20} /> Venta Directa
          </button>
          {appUser?.role === 'admin' && (
            <button onClick={() => { playClick(); setShowAddRoom(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform hover:scale-105">
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
      
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:grid-cols-5 gap-2 sm:gap-6 xl:gap-8 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:gap-2">
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
                "rounded-xl sm:rounded-2xl p-3 sm:p-6 xl:p-8 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 shadow-lg border-2 transition-all active:scale-95 flex flex-col h-full text-white min-h-[130px] sm:min-h-[220px] xl:min-h-[280px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:min-h-[100px]",
                isActuallyFree && !isReservedSoon && "bg-emerald-500 border-emerald-600",
                isActuallyFree && isReservedSoon && "bg-blue-600 border-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.7)] animate-pulse",
                isOccupied && !isWarning && "bg-red-600 border-red-700",
                isOccupied && isWarning && "bg-red-600 border-red-700 animate-pulse",
                isCleaning && "bg-yellow-500 border-yellow-600"
              )}
            >
              <div className="flex justify-between items-start mb-2 sm:mb-4">
                <div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <h2 className="text-xl sm:text-3xl xl:text-4xl [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-xs font-black drop-shadow-md">
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
                        className="p-1 sm:p-2 bg-white/20 hover:bg-white/40 rounded-full transition-colors"
                      >
                        <Edit2 size={14} className="sm:hidden" />
                        <Edit2 size={18} className="hidden sm:block" />
                      </button>
                    )}
                  </div>
                  <span className="inline-block px-2 sm:px-3 xl:px-4 py-0.5 sm:py-1 xl:py-1.5 rounded-full text-[9px] sm:text-sm xl:text-base [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[7px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:px-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:py-0.5 font-bold mt-1 sm:mt-2 xl:mt-3 bg-black/20 backdrop-blur-sm uppercase tracking-wider">
                    {isReservedSoon && isActuallyFree ? 'RESERVADA PRONTO' : room.status}
                  </span>
                </div>
                <BedDouble size={24} className="sm:hidden [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:block [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:w-4 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:h-4 opacity-80" />
                <BedDouble size={40} className="hidden sm:block xl:hidden [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:hidden opacity-80" />
                <BedDouble size={56} className="hidden xl:block opacity-80" />
              </div>

              {isReservedSoon && (
                <div className={cn(
                  "mt-2 sm:mt-4 space-y-1 sm:space-y-2 p-2 sm:p-3 rounded-lg sm:rounded-xl backdrop-blur-sm border",
                  isActuallyFree ? "bg-white/20 border-white/30" : "bg-blue-600/40 border-blue-400/50"
                )}>
                  <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-sm [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] font-black uppercase tracking-tight">
                    <CalendarCheck size={14} className="sm:hidden" />
                    <CalendarCheck size={18} className="hidden sm:block" />
                    RESERVA: {format(parseISO(upcomingReservation.date), 'HH:mm')}
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 font-bold text-[9px] sm:text-xs [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[7px] truncate">
                    <User size={12} className="sm:hidden" />
                    <User size={14} className="hidden sm:block" />
                    {upcomingReservation.clientName}
                  </div>
                  {isActuallyFree && (
                    <div className="flex items-center gap-1 sm:gap-2 font-bold text-[8px] sm:text-[10px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[6px] text-blue-50 uppercase">
                      <AlertCircle size={10} className="sm:hidden" />
                      <AlertCircle size={14} className="hidden sm:block" />
                      NO OCUPAR
                    </div>
                  )}
                </div>
              )}

              {isOccupied && (
                <div className="mt-auto space-y-1 sm:space-y-3 bg-black/10 p-2 sm:p-4 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-1.5 rounded-lg sm:rounded-xl backdrop-blur-sm">
                  <div className="flex items-center gap-1 sm:gap-2 text-sm sm:text-xl xl:text-2xl [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] font-mono font-bold">
                    <Clock size={16} className="sm:hidden [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:block [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:w-3 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:h-3" />
                    <Clock size={24} className="hidden sm:block xl:hidden [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:hidden" />
                    <Clock size={32} className="hidden xl:block" />
                    {timeLeftStr}
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 font-medium text-xs sm:text-lg xl:text-xl [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px]">
                    <Users size={16} className="sm:hidden [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:block [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:w-3 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:h-3" />
                    <Users size={24} className="hidden sm:block xl:hidden [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:hidden" />
                    <Users size={32} className="hidden xl:block" />
                    {room.persons} Personas
                  </div>
                  <div className="text-base sm:text-3xl xl:text-5xl [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-xs font-black mt-1 sm:mt-4 xl:mt-6 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:mt-1 drop-shadow-md">
                    ${room.total.toLocaleString('es-CO')}
                  </div>
                </div>
              )}

              {isActuallyFree && !isReservedSoon && (
                <div className="mt-auto text-xs sm:text-xl [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[9px] font-bold opacity-90 flex items-center gap-1 sm:gap-2">
                  <PlayCircle size={16} className="sm:hidden [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:block [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:w-3 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:h-3" />
                  <PlayCircle size={24} className="hidden sm:block [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:hidden" />
                  Lista para usar
                </div>
              )}
              
              {isCleaning && (
                <div className="mt-auto text-xs sm:text-xl [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[9px] font-bold opacity-90">
                  En mantenimiento
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

      {/* Venta Directa Modal */}
      {showDirectSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl p-4 lg:p-8 max-w-6xl w-full h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <input 
              type="file" 
              accept="image/*" 
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
                onClick={() => setShowDirectSale(false)} 
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
                                  "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                                  effectiveStock > 10 ? "bg-black/5" : "bg-red-500 text-white"
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
                              "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                              effectiveStock > 10 ? "bg-black/5" : "bg-red-500 text-white"
                            )}>Stock: {effectiveStock}</span>
                            <Plus size={20} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Servicios */}
                {inventory.some(p => p.category === 'Servicios') && (
                  <section>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 border-b pb-2">
                      <Users size={16} /> Servicios
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 [@media(max-height:600px)_and_(orientation:landscape)]:grid-cols-4 gap-2 sm:gap-3">
                      {inventory.filter(p => p.category === 'Servicios').map((p, idx) => {
                        return (
                          <button
                            key={p.id}
                            onClick={() => handleDirectSaleToggleProduct(p)}
                            className={cn(
                              "p-3 sm:p-4 rounded-3xl text-left transition-all active:scale-95 shadow-sm border border-transparent flex flex-col justify-between h-24 sm:h-32 relative overflow-hidden group",
                              PRODUCT_COLORS[(idx + 12) % PRODUCT_COLORS.length]
                            )}
                          >
                            <div className="relative z-10 w-full">
                              <div className="text-[8px] font-black uppercase opacity-60 leading-[1.1] mb-1 whitespace-normal">{p.name}</div>
                              <div className="text-xl font-black tracking-tighter leading-none">${p.price.toLocaleString()}</div>
                            </div>
                            <div className="relative z-10 flex justify-end items-end">
                              <Plus size={20} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>

              {/* Right Column: Order Summary & Checkout */}
              <div className="w-full lg:w-[320px] 2xl:w-[380px] flex flex-col lg:h-full bg-slate-50 rounded-[2.5rem] p-3 md:p-4 lg:p-6 border border-slate-100 shadow-inner mt-auto lg:mt-0">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-1">Resumen de Venta</h4>
                
                <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1 custom-scrollbar min-h-[200px]">
                  {directSaleProducts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center py-12">
                      <ShoppingBag size={64} className="mb-4 opacity-10" />
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-40 text-center">Pedido Vacío</p>
                    </div>
                  ) : (
                    directSaleProducts.map(p => (
                      <div key={p.id} className="bg-white p-2 md:p-3 rounded-2xl border border-slate-100 flex justify-between items-center group animate-in slide-in-from-right-4 shadow-sm">
                        <div className="flex-1 min-w-0 pr-1">
                          <div className="text-[9px] md:text-[10px] font-black text-slate-900 uppercase truncate mb-0.5">{p.name}</div>
                          <div className="text-[9px] md:text-[11px] font-bold text-slate-400">
                            ${p.price.toLocaleString()} x {p.quantity}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-100">
                            <button 
                              onClick={() => handleUpdateDirectSaleQuantity(p.id, -1)}
                              className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center hover:bg-white rounded-md transition-colors text-slate-400"
                            >
                              <Minus size={10} />
                            </button>
                            <span className="w-4 md:w-5 text-center text-[10px] md:text-xs font-black">{p.quantity}</span>
                            <button 
                              onClick={() => handleUpdateDirectSaleQuantity(p.id, 1)}
                              className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center hover:bg-white rounded-md transition-colors text-slate-400"
                            >
                              <Plus size={10} />
                            </button>
                          </div>
                          <span className="text-[9px] md:text-[11px] font-black text-blue-600 tracking-tighter w-14 text-right">${(p.price * p.quantity).toLocaleString()}</span>
                          <button 
                            onClick={() => handleDirectSaleRemoveProduct(p.id)} 
                            className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-slate-200 pt-4 space-y-4">
                  <div className="flex flex-col items-end px-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Total Venta</span>
                    <span className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter leading-none">${directSaleTotal.toLocaleString()}</span>
                  </div>

                  {!directSalePaymentMethod ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => { playClick(); setDirectSalePaymentMethod('Efectivo'); }}
                        disabled={directSaleProducts.length === 0 || isDirectSaleSaving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-2xl font-black uppercase text-sm shadow-xl shadow-emerald-100 transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-2"
                      >
                        Efectivo
                      </button>
                      <button 
                        onClick={() => { playClick(); setDirectSalePaymentMethod('Transferencia'); }}
                        disabled={directSaleProducts.length === 0 || isDirectSaleSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black uppercase text-sm shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-2"
                      >
                        Transfer
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Pago: {directSalePaymentMethod}</span>
                          <button onClick={() => setDirectSalePaymentMethod(null)} className="text-amber-400 hover:text-amber-600">
                            <X size={16} />
                          </button>
                        </div>

                        {directSalePaymentMethod === 'Transferencia' && (
                          <div className="space-y-4">
                            {directSalePhoto ? (
                              <div className="relative">
                                <img src={directSalePhoto} alt="Comprobante" className="w-full h-32 object-cover rounded-xl shadow-md" />
                                <button 
                                  onClick={() => setDirectSalePhoto(null)} 
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => directFileInputRef.current?.click()}
                                className="w-full py-4 bg-blue-50 text-blue-600 border-2 border-dashed border-blue-200 rounded-xl font-bold flex flex-col items-center gap-2 hover:bg-blue-100 transition-colors"
                              >
                                <Camera size={24} />
                                <span className="text-[10px] uppercase">Adjuntar o Tomar Comprobante</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={() => handleProcessDirectSale(directSalePaymentMethod)}
                        disabled={isDirectSaleSaving || (directSalePaymentMethod === 'Transferencia' && !directSalePhoto)}
                        className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black uppercase text-base shadow-2xl transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-3"
                      >
                        {isDirectSaleSaving ? (
                          <RotateCcw className="animate-spin" size={24} />
                        ) : (
                          <>
                            <Printer size={24} />
                            <span>Confirmar y Ticket</span>
                          </>
                        )}
                      </button>
                      
                      <button 
                        onClick={() => setDirectSalePaymentMethod(null)}
                        className="w-full py-2 text-slate-400 font-bold uppercase text-[10px] tracking-widest"
                      >
                        Cancelar Pago
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

