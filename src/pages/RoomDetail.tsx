import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, getDocs, addDoc, runTransaction, query, where, orderBy, getDoc, increment, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { ArrowLeft, Plus, Minus, Printer, Trash2, Clock, Users, Coffee, CheckCircle, Heart, Package, X, Wine, CalendarCheck, AlertCircle, RotateCcw, Cookie, Sparkles } from 'lucide-react';

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
import { cn } from '../lib/utils';
import { format, parseISO, isBefore, addHours, isAfter, subHours } from 'date-fns';
import { printTicket } from '../utils/print';
import { compressImage } from '../utils/image';
import { handleFirestoreError, OperationType } from '../utils/error';

interface ProductItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Room {
  id: string;
  name: string;
  status: 'Libre' | 'Ocupada' | 'Limpieza';
  startTime: string | null;
  endTime: string | null;
  persons: number;
  services: ProductItem[];
  products: ProductItem[];
  total: number;
  basePrice?: number;
  currentHostId: string | null;
  currentHostName: string | null;
  reservationAbono?: number;
}

interface InventoryProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
}

const BASE_PRICE = 60000;
const EXTRA_HOUR_PRICE = 20000;
const EXTRA_PERSON_PRICE = 20000;
const SERVICE_PRICE = 20000;

export default function RoomDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const { playClick, playSuccess, playError } = useFeedback();
  const [room, setRoom] = useState<Room | null>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [inventory, setInventory] = useState<InventoryProduct[]>([]);
  const [now, setNow] = useState(new Date());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReservationWarning, setShowReservationWarning] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [showNoShiftModal, setShowNoShiftModal] = useState(false);
  const [transferPhoto, setTransferPhoto] = useState<string | null>(null);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!appUser) return;
    const q = query(collection(db, 'shifts'), where('hostId', '==', appUser.id), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setActiveShift({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
        setShowNoShiftModal(false);
      } else {
        setActiveShift(null);
      }
    });
    return () => unsubscribe();
  }, [appUser]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, 'rooms', id), (doc) => {
      if (doc.exists()) {
        setRoom({ id: doc.id, ...doc.data() } as Room);
      }
    });
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'reservations'), where('roomId', '==', id), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReservations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const allProducts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InventoryProduct));
      // Remove duplicates by name
      const unique = Array.from(new Map(allProducts.map(item => [item.name, item])).values());
      setInventory(unique);
    });
    return () => unsubscribe();
  }, []);

  if (!room) return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center">
      <div className="text-7xl animate-spin mb-4">🔱</div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Cargando Habitación...</p>
    </div>
  );

  const getServicePrice = (name: string, defaultPrice: number) => {
    const service = inventory.find(p => 
      p.name.toLowerCase().trim() === name.toLowerCase().trim() && 
      p.category === 'Servicios'
    );
    return service ? service.price : defaultPrice;
  };

  const handleStartService = async () => {
    playClick();
    if (appUser?.role === 'host' && !activeShift) {
      setShowNoShiftModal(true);
      return;
    }

    if (room.status === 'Ocupada') {
      // Already started (maybe by adding a product first)
      playSuccess();
      return;
    }

    const nextRes = reservations.find(res => 
      isBefore(parseISO(res.date), addHours(now, 2)) &&
      isBefore(now, parseISO(res.date))
    );

    if (nextRes) {
      setShowReservationWarning(nextRes);
      return;
    }

    startService();
  };

  const startService = (resToUse: any = null) => {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 180 * 60000); // 3 hours
    const inventoryPrice = getServicePrice('Servicio Base', 60000);
    
    // Total money paid upfront
    const abonoValue = resToUse?.abono || 0;

    // Check if we already have items (added during Libre state)
    const existingServices = room?.services || [];
    const existingProducts = room?.products || [];
    
    // Ensure "Servicio Base" is in services if not already there (though it should be the same price)
    const hasBase = existingServices.some(s => s.name === 'Servicio Base');
    let finalServices = [...existingServices];
    if (!hasBase) {
      finalServices.unshift({ id: 'base_' + Date.now(), name: 'Servicio Base', price: inventoryPrice, quantity: 1 });
    }

    // Calculate final total (respecting existing items)
    const itemsTotal = finalServices.reduce((acc, s) => acc + (s.price * s.quantity), 0) + 
                       existingProducts.reduce((acc, p) => acc + (p.price * p.quantity), 0);

    // Fire and forget for instant UI feedback
    updateDoc(doc(db, 'rooms', room!.id), {
      status: 'Ocupada',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      persons: room!.persons || 2,
      total: itemsTotal,
      basePrice: inventoryPrice,
      currentHostId: appUser?.id,
      currentHostName: appUser?.name,
      reservationAbono: abonoValue,
      services: finalServices,
      products: existingProducts
    }).catch(console.error);
    
    // Mark reservation as completed if it was used
    if (resToUse) {
      updateDoc(doc(db, 'reservations', resToUse.id), {
        status: 'completed'
      }).catch(console.error);

      // Delete the temporary reservation ticket so it doesn't duplicate in history
      const deleteTempTicket = async () => {
        const q = query(collection(db, 'tickets'), where('reservationId', '==', resToUse.id), where('isTemporary', '==', true));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
      };
      deleteTempTicket().catch(console.error);
    }
    
    playSuccess();
    setShowReservationWarning(null);
  };

  const handleAddExtraHour = () => {
    playSuccess();
    if (appUser?.role === 'host' && !activeShift) {
      setShowNoShiftModal(true);
      return;
    }
    const currentEnd = new Date(room!.endTime || new Date().toISOString());
    const newEnd = new Date(currentEnd.getTime() + 60 * 60000);
    const price = getServicePrice('Hora Adicional', EXTRA_HOUR_PRICE);
    const roomRef = doc(db, 'rooms', room!.id);
    
    updateDoc(roomRef, {
      endTime: room!.status === 'Ocupada' ? newEnd.toISOString() : null,
      total: (room!.total || 0) + price,
      services: [...(room!.services || []), { id: 'hora_extra_' + Date.now(), name: 'Hora Adicional', price: price, quantity: 1 }]
    }).then(() => playSuccess()).catch(e => { playError(); console.error(e); });
  };

  const handleAddPerson = () => {
    playSuccess();
    if (appUser?.role === 'host' && !activeShift) {
      setShowNoShiftModal(true);
      return;
    }
    const price = getServicePrice('Persona Adicional', EXTRA_PERSON_PRICE);
    const roomRef = doc(db, 'rooms', room!.id);

    updateDoc(roomRef, {
      persons: (room!.persons || 0) + 1,
      total: (room!.total || 0) + price,
      services: [...(room!.services || []), { id: 'persona_extra_' + Date.now(), name: 'Persona Adicional', price: price, quantity: 1 }]
    }).then(() => playSuccess()).catch(e => { playError(); console.error(e); });
  };

  const handleAddService = (serviceName: string) => {
    playSuccess();
    if (appUser?.role === 'host' && !activeShift) {
      setShowNoShiftModal(true);
      return;
    }
    const price = getServicePrice(serviceName, SERVICE_PRICE);
    const roomRef = doc(db, 'rooms', room!.id);

    updateDoc(roomRef, {
      total: (room!.total || 0) + price,
      services: [...(room!.services || []), { id: 'srv_' + Date.now(), name: serviceName, price: price, quantity: 1 }]
    }).then(() => playSuccess()).catch(e => { playError(); console.error(e); });
  };

  const handleAddProduct = (product: InventoryProduct) => {
    playSuccess();
    if (appUser?.role === 'host' && !activeShift) {
      setShowNoShiftModal(true);
      return;
    }
    if ((product.stock || 0) <= 0) {
      playError();
      alert('Sin stock disponible');
      return;
    }

    const roomRef = doc(db, 'rooms', room!.id);
    const productRef = doc(db, 'products', product.id);
    
    const existingProducts = room!.products || [];
    const existingProductIndex = existingProducts.findIndex(p => p.id === product.id);
    
    let newProducts = [...existingProducts];
    if (existingProductIndex >= 0) {
      newProducts[existingProductIndex] = {
        ...newProducts[existingProductIndex],
        quantity: (newProducts[existingProductIndex].quantity || 0) + 1
      };
    } else {
      newProducts.push({ id: product.id, name: product.name, price: product.price, quantity: 1 });
    }
    
    // Optimistic UI updates
    updateDoc(roomRef, {
      products: newProducts,
      total: (room!.total || 0) + product.price
    }).then(() => playSuccess()).catch(e => { playError(); console.error(e); });
    
    updateDoc(productRef, { stock: increment(-1) }).catch(e => console.error(e));
  };

  const handleRemoveItem = (item: ProductItem, type: 'product' | 'service') => {
    playClick();
    if (appUser?.role === 'host' && !activeShift) {
      setShowNoShiftModal(true);
      return;
    }

    const roomRef = doc(db, 'rooms', room!.id);

    if (type === 'service') {
      const existingServices = room!.services || [];
      const itemIdx = existingServices.findIndex(s => s.id === item.id);
      
      if (itemIdx >= 0) {
        const newServices = existingServices.filter(s => s.id !== item.id);
        updateDoc(roomRef, {
          services: newServices,
          total: Math.max(0, (room!.total || 0) - (item.price * item.quantity))
        }).then(() => playSuccess()).catch(e => { playError(); console.error(e); });
      }
    } else {
      const productRef = doc(db, 'products', item.id);
      const existingProducts = room!.products || [];
      let newProducts = [...existingProducts];
      const index = newProducts.findIndex(p => p.id === item.id);
      
      if (index >= 0) {
        if (newProducts[index].quantity > 1) {
          newProducts[index] = {
            ...newProducts[index],
            quantity: newProducts[index].quantity - 1
          };
        } else {
          newProducts.splice(index, 1);
        }

        const newTotal = Math.max(0, (room!.total || 0) - item.price);
        
        updateDoc(roomRef, {
          products: newProducts,
          total: newTotal
        }).then(() => playSuccess()).catch(e => { playError(); console.error(e); });
        
        updateDoc(productRef, { stock: increment(1) }).catch(e => console.error(e));
      }
    }
  };

  const handleCloseAccount = async (paymentMethod: 'Efectivo' | 'Transferencia', photoToSave?: string | null) => {
    if (appUser?.role === 'host' && !activeShift) {
      setShowNoShiftModal(true);
      return;
    }
    
    setIsSaving(true);
    try {
      // Offline-friendly reads
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

      // Prepare final ticket
      const ticketRef = doc(collection(db, 'tickets'));
      const dbRoom = room!;
      
      const ticketData = {
        roomId: room!.id,
        roomName: room!.name,
        startTime: dbRoom.startTime || new Date().toISOString(),
        endTime: new Date().toISOString(),
        products: dbRoom.products || [],
        services: dbRoom.services || [],
        total: dbRoom.total || 0,
        date: new Date().toISOString(),
        hostId: appUser?.id || '',
        hostName: appUser?.name || 'Desconocido',
        shiftId: activeShift?.id || null,
        paymentMethod,
        invoiceNumber: currentInvoiceNumber,
        transferPhoto: paymentMethod === 'Transferencia' ? (photoToSave || transferPhoto) : null,
        reservationAbono: dbRoom.reservationAbono || 0,
        finalTotal: (dbRoom.total || 0) - (dbRoom.reservationAbono || 0)
      };

      // Reset Room optimistically
      const nextBasePrice = getServicePrice('Servicio Base', 60000);
      
      // Fire-and-forget writes
      setDoc(ticketRef, ticketData).catch(e => console.error(e));
      
      updateDoc(doc(db, 'rooms', dbRoom.id), {
        status: 'Limpieza',
        startTime: null,
        endTime: null,
        persons: 2,
        services: [],
        products: [],
        total: nextBasePrice,
        basePrice: nextBasePrice,
        currentHostId: null,
        currentHostName: null,
        reservationAbono: 0
      });

      setShowPaymentModal(false);
      setTransferPhoto(null);
      setIsCapturingPhoto(false);

      const ticketHtml = `
          <html>
            <head>
              <title>Ticket ${room!.name}</title>
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
                ${currentInvoiceNumber !== null ? `<p style="font-size: 1.2rem; font-weight: bold; margin-top: 5px;">FACTURA NÚMERO: ${currentInvoiceNumber}</p>` : ''}
                ${paymentMethod === 'Transferencia' && (photoToSave || transferPhoto) ? `<p style="color: blue; font-weight: bold;">[COMPROBANTE ADJUNTO EN SISTEMA]</p>` : ''}
              </div>
              <div class="border-t border-b">
                <div class="flex-between"><span>Habitación:</span> <strong>${room!.name}</strong></div>
                <div class="flex-between"><span>Fecha:</span> <span>${format(new Date(), 'dd/MM/yyyy')}</span></div>
                <div class="flex-between"><span>Inicio:</span> <span>${dbRoom.startTime ? format(new Date(dbRoom.startTime), 'HH:mm') : ''}</span></div>
                <div class="flex-between"><span>Fin:</span> <span>${format(new Date(), 'HH:mm')}</span></div>
                <div class="flex-between"><span>Atiende:</span> <span>${dbRoom.currentHostName || appUser?.name}</span></div>
                <div class="flex-between"><span>Pago:</span> <span>${paymentMethod}</span></div>
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
                  <tr>
                    <td>1</td>
                    <td>Servicio Base</td>
                    <td class="text-right">$${(dbRoom.basePrice || 60000).toLocaleString()}</td>
                  </tr>
                  ${(dbRoom.services || []).filter(s => s.name !== 'Servicio Base').map(srv => `
                    <tr>
                      <td>${srv.quantity}</td>
                      <td>${srv.name}</td>
                      <td class="text-right">$${(srv.price * srv.quantity).toLocaleString()}</td>
                    </tr>
                  `).join('')}
                  ${(dbRoom.products || []).map(prod => `
                    <tr>
                      <td>${prod.quantity}</td>
                      <td>${prod.name}</td>
                      <td class="text-right">$${(prod.price * prod.quantity).toLocaleString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
                ${dbRoom.reservationAbono ? `
                <div class="border-t pt-2">
                  <div class="flex-between"><span>Subtotal:</span> <span>$${(dbRoom.total || 0).toLocaleString()}</span></div>
                  <div class="flex-between"><span>Abono Reserva:</span> <span>-$${dbRoom.reservationAbono.toLocaleString()}</span></div>
                </div>
                ` : ''}
              <div class="border-t flex-between font-bold" style="font-size: 1.2rem;">
                <span>TOTAL A PAGAR</span>
                <span>$${((dbRoom.total || 0) - (dbRoom.reservationAbono || 0)).toLocaleString()}</span>
              </div>
              <div class="text-center border-t mt-4">
                <p class="font-bold">EN POSEIDÓN, TE SENTIRÁS COMO LOS DIOSES</p>
                <p>¡Gracias por tu visita!</p>
              </div>
            </body>
          </html>
        `;

      printTicket(ticketHtml);
      playSuccess();
      setIsNavigating(true);
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (err: any) {
      console.error("Error closing account", err);
      playError();
      if (err.message?.includes('permission') || err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.WRITE, `rooms/${room!.id}/close-account`);
      } else {
        alert('Error al guardar el servicio. Es posible que la foto sea muy pesada o haya un error de conexión.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetFree = async () => {
    playClick();
    if (appUser?.role === 'host' && !activeShift) {
      setShowNoShiftModal(true);
      return;
    }
    updateDoc(doc(db, 'rooms', room.id), {
      status: 'Libre',
      startTime: null,
      endTime: null,
      persons: 2,
      services: [],
      products: [],
      total: getServicePrice('Servicio Base', 60000),
      basePrice: getServicePrice('Servicio Base', 60000),
      currentHostId: null,
      currentHostName: null
    }).catch(err => {
      console.error(err);
    });
    playSuccess();
    navigate('/dashboard');
  };

  let timeLeftStr = '';
  let isWarning = false;

  if (room.status === 'Ocupada' && room.endTime) {
    const end = new Date(room.endTime);
    const diffMs = end.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      timeLeftStr = '00:00:00';
      isWarning = true;
    } else {
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
      timeLeftStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      if (diffMs <= 900000) isWarning = true;
    }
  }

  const getBebidaOrder = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('cerveza')) return 1;
    if (lowerName.includes('aguardiente')) return 2;
    if (lowerName.includes('smirnoff')) return 3;
    if (lowerName.includes('champaña')) return 4;
    if (lowerName.includes('agua')) return 5;
    if (lowerName.includes('coca cola')) return 6;
    if (lowerName === 'soda') return 7;
    if (lowerName.includes('electrolit')) return 8;
    if (lowerName.includes('hatsu')) return 9;
    if (lowerName.includes('gatorade')) return 10;
    if (lowerName.includes('cola y pola')) return 11;
    if (lowerName.includes('jugo hit')) return 12;
    return 99;
  };

  const bebidas = inventory
    .filter(p => p.category === 'Bebidas')
    .sort((a, b) => {
      const orderA = getBebidaOrder(a.name);
      const orderB = getBebidaOrder(b.name);
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  const snacks = inventory.filter(p => p.category === 'Snacks');
  const sexshop = inventory.filter(p => p.category === 'Sex Shop' || p.category === 'Sexshop');
  const servicios = inventory.filter(p => p.category === 'Servicios');
  const vips = inventory.filter(p => p.category === 'VIP / Promos');
  const otros = inventory.filter(p => 
    p.category !== 'Bebidas' && 
    p.category !== 'Snacks' && 
    p.category !== 'Sexshop' && 
    p.category !== 'Sex Shop' && 
    p.category !== 'Servicios' &&
    p.category !== 'VIP / Promos'
  );

  const upcomingReservation = reservations.find(res => 
    isBefore(parseISO(res.date), addHours(now, 2)) &&
    isBefore(now, parseISO(res.date))
  );

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result as string);
          setTransferPhoto(compressed);
          setIsCapturingPhoto(false);
          playSuccess();
          // De inmediato procesar pago al capturar foto
          handleCloseAccount('Transferencia', compressed);
        } catch (err) {
          console.error("Error compressing image", err);
          playError();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTransferClick = () => {
    playClick();
    setIsCapturingPhoto(true);
  };

  return (
    <div className="max-w-7xl mx-auto pb-10">
      {/* Loading Overlay */}
      {(isNavigating || isSaving) && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[200] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl animate-spin">🔱</div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">
              {isSaving ? 'Guardando cambios...' : 'Cargando Dashboard...'}
            </p>
          </div>
        </div>
      )}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment"
        ref={fileInputRef} 
        onChange={handlePhotoCapture}
        className="hidden" 
      />
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4 sm:mb-8 lg:mb-4">
        <div className="flex items-center gap-2 sm:gap-4 lg:gap-2">
          <button 
            onClick={() => { 
                playClick(); 
                navigate('/dashboard');
            }} 
            className="p-2 sm:p-3 lg:p-2 bg-white hover:bg-slate-100 rounded-xl shadow-sm transition-colors border border-slate-200"
          >
            <ArrowLeft size={18} className="lg:w-4 lg:h-4 sm:w-6 sm:h-6" />
          </button>
          <div>
            <h1 className="text-xl sm:text-4xl lg:text-3xl xl:text-4xl font-black text-slate-900 uppercase tracking-tight">{room.name}</h1>
            <div className="flex items-center gap-2 mt-0.5 sm:mt-1 lg:mt-0.5">
              <span className={cn(
                "px-2 py-0.5 sm:px-3 sm:py-1 lg:px-2 lg:py-0.5 rounded-full text-[8px] sm:text-xs lg:text-[10px] font-bold uppercase",
                room.status === 'Libre' ? (upcomingReservation ? "bg-red-600 text-white animate-pulse" : "bg-emerald-100 text-emerald-700") : 
                room.status === 'Ocupada' ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
              )}>
                {upcomingReservation && room.status === 'Libre' ? 'RESERVA' : room.status}
              </span>
              {room.currentHostName && (
                <span className="text-[8px] sm:text-xs lg:text-[10px] font-bold text-slate-500 flex items-center gap-1 sm:gap-3 lg:gap-1">
                  <Users size={10} className="lg:w-3 lg:h-3 sm:w-4 sm:h-4" /> {room.currentHostName}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {room.status === 'Limpieza' && (
        <div className="bg-white p-12 rounded-3xl shadow-xl border border-slate-200 text-center max-w-2xl mx-auto">
          <div className="text-7xl mb-6">🧹</div>
          <h2 className="text-3xl font-black mb-2 uppercase tracking-tight">En Limpieza</h2>
          <p className="text-slate-500 mb-8 font-medium">Marca la habitación como libre cuando esté lista para un nuevo servicio.</p>
          <button 
            onClick={handleSetFree}
            className="bg-green-600 hover:bg-green-700 text-white font-black py-5 px-10 rounded-2xl text-xl shadow-lg shadow-green-100 transition-all active:scale-95 flex items-center justify-center gap-3 mx-auto"
          >
            <CheckCircle size={28} />
            Marcar como Libre
          </button>
        </div>
      )}

      {(room.status === 'Ocupada' || room.status === 'Libre') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Timer Section */}
            <div className={cn(
              "p-4 sm:p-8 lg:p-4 rounded-3xl shadow-xl flex flex-col lg:flex-row items-center justify-between gap-4 transition-all",
              isWarning ? "bg-red-600 text-white animate-pulse" : "bg-white border border-slate-200"
            )}>
              <div className="flex items-center gap-4 sm:gap-6 lg:gap-4">
                <div className={cn(
                  "p-3 sm:p-5 lg:p-3 rounded-2xl",
                  isWarning ? "bg-white/20" : room.status === 'Ocupada' ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"
                )}>
                  <Clock size={32} className="sm:hidden lg:block lg:w-8 lg:h-8" />
                  <Clock size={48} className="hidden sm:block lg:hidden" />
                </div>
                <div>
                  <div className={cn("text-[10px] sm:text-sm lg:text-[10px] font-bold uppercase tracking-wider mb-0.5", isWarning ? "text-white/80" : "text-slate-500")}>
                    {room.status === 'Libre' ? 'Estado' : 'Tempo Restante'}
                  </div>
                  <div className={cn(
                    "text-3xl sm:text-6xl lg:text-4xl xl:text-5xl font-black font-mono tracking-tighter",
                    room.status === 'Ocupada' && !isWarning ? "text-green-500" : ""
                  )}>
                    {room.status === 'Libre' ? '00:00:00' : timeLeftStr}
                  </div>
                </div>
              </div>
              {room.status === 'Libre' ? (
                <button 
                  onClick={handleStartService}
                  className="w-full lg:w-auto lg:px-6 py-4 sm:py-5 lg:py-3 rounded-2xl font-black text-sm sm:text-xl lg:text-sm flex items-center justify-center gap-3 bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-200 transition-all active:scale-95 uppercase tracking-widest"
                >
                  <Clock size={18} className="lg:w-4 lg:h-4" /> Iniciar Tiempo
                </button>
              ) : (
                <button 
                  onClick={handleAddExtraHour}
                  className={cn(
                    "w-full lg:w-auto lg:px-6 py-4 sm:py-5 lg:py-3 rounded-2xl font-black text-sm sm:text-xl lg:text-sm flex items-center justify-center gap-3 shadow-lg transition-all active:scale-95 uppercase tracking-widest",
                    isWarning ? "bg-white text-red-600 hover:bg-red-50" : "bg-amber-600 text-white hover:bg-amber-700 shadow-amber-200"
                  )}
                >
                  <Plus size={18} className="lg:w-4 lg:h-4" /> 1 Hora Mas
                </button>
              )}
            </div>

            {/* Quick Add Services (Dynamic from Inventory) */}
            <div className="bg-white p-4 sm:p-8 lg:p-4 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-base sm:text-xl lg:text-base font-black mb-4 flex items-center gap-2 text-slate-800 uppercase tracking-tight">
                <Users size={18} className="text-amber-600 lg:w-5 lg:h-5"/> Servicios Extra
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-2">
                {servicios
                  .filter(s => s.name !== 'Servicio Base' && s.name !== 'Hora Adicional')
                  .sort((a, b) => {
                    const getOrder = (name: string) => {
                      const n = name.toLowerCase();
                      if (n.includes('persona')) return 1;
                      if (n.includes('jacuzzi')) return 2;
                      return 3;
                    };
                    return getOrder(a.name) - getOrder(b.name);
                  })
                  .map((srv, idx) => (
                  <button
                    key={srv.id}
                    onClick={() => srv.name.toLowerCase().includes('persona') ? handleAddPerson() : handleAddService(srv.name)}
                    className={cn(
                      "p-2 sm:p-3 rounded-2xl text-left transition-all active:scale-95 shadow-sm border border-transparent flex flex-col justify-between h-20 sm:h-28 lg:h-20 relative overflow-hidden group",
                      PRODUCT_COLORS[(idx + 10) % PRODUCT_COLORS.length]
                    )}
                  >
                    <div className="relative z-10 w-full">
                      <div className="text-[7px] font-bold uppercase opacity-80 leading-[1] mb-1 sm:mb-2 lg:mb-1 truncate">{srv.name}</div>
                      <div className="text-sm sm:text-lg lg:text-sm font-black tracking-tighter leading-none">${srv.price.toLocaleString()}</div>
                    </div>
                  </button>
                ))}
                {servicios.length === 0 && (
                  <div className="col-span-full py-2 text-center text-slate-400 italic font-medium">
                    Sin servicios.
                  </div>
                )}
              </div>
            </div>

            {/* Bebidas */}
            {bebidas.length > 0 && (
              <div className="bg-white p-4 sm:p-8 lg:p-4 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-base sm:text-xl lg:text-base font-black mb-4 flex items-center gap-2 text-slate-800 uppercase tracking-tight">
                  <Wine size={18} className="text-red-600 lg:w-5 lg:h-5"/> Bebidas
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-2">
                  {bebidas.map((prod, idx) => (
                    <button 
                      key={prod.id}
                      onClick={() => handleAddProduct(prod)}
                      disabled={prod.stock <= 0}
                      className={cn(
                        "p-2 sm:p-3 rounded-2xl text-left transition-all active:scale-95 shadow-sm border border-transparent flex flex-col justify-between h-20 sm:h-28 lg:h-20 relative overflow-hidden group",
                        prod.stock > 0 
                          ? PRODUCT_COLORS[idx % PRODUCT_COLORS.length] 
                          : "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
                      )}
                    >
                      <div className="relative z-10 w-full">
                        <div className="text-[7px] font-bold uppercase opacity-80 leading-[1] mb-1 sm:mb-2 lg:mb-1 truncate">{prod.name}</div>
                        <div className="text-sm sm:text-lg lg:text-sm font-black tracking-tighter leading-none">${prod.price.toLocaleString()}</div>
                      </div>
                      <div className="relative z-10 flex flex-col justify-end mt-1">
                        <span className={cn(
                          "text-[10px] sm:text-xs font-black uppercase px-1 py-0.5 rounded-full w-max",
                          prod.stock >= 15 ? "bg-green-500 text-white" : prod.stock >= 5 ? "bg-amber-500 text-white" : "bg-red-500 text-white"
                        )}>Stock: {prod.stock}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Snacks */}
            {snacks.length > 0 && (
              <div className="bg-white p-4 sm:p-8 lg:p-4 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-base sm:text-xl lg:text-base font-black mb-4 flex items-center gap-2 text-slate-800 uppercase tracking-tight">
                  <Cookie size={18} className="text-amber-600 lg:w-5 lg:h-5"/> Snacks
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-2">
                  {snacks.map((prod, idx) => (
                    <button 
                      key={prod.id}
                      onClick={() => handleAddProduct(prod)}
                      disabled={prod.stock <= 0}
                      className={cn(
                        "p-2 sm:p-3 rounded-2xl text-left transition-all active:scale-95 shadow-sm border border-transparent flex flex-col justify-between h-20 sm:h-28 lg:h-20 relative overflow-hidden group",
                        prod.stock > 0 
                          ? PRODUCT_COLORS[(idx + 2) % PRODUCT_COLORS.length] 
                          : "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
                      )}
                    >
                      <div className="relative z-10 w-full">
                        <div className="text-[7px] font-bold uppercase opacity-80 leading-[1] mb-1 sm:mb-2 lg:mb-1 truncate">{prod.name}</div>
                        <div className="text-sm sm:text-lg lg:text-sm font-black tracking-tighter leading-none">${prod.price.toLocaleString()}</div>
                      </div>
                      <div className="relative z-10 flex flex-col justify-end mt-1">
                        <span className={cn(
                          "text-[10px] sm:text-xs font-black uppercase px-1 py-0.5 rounded-full w-max",
                          prod.stock >= 15 ? "bg-green-500 text-white" : prod.stock >= 5 ? "bg-amber-500 text-white" : "bg-red-500 text-white"
                        )}>Stock: {prod.stock}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sexshop */}
            {sexshop.length > 0 && (
              <div className="bg-white p-4 sm:p-8 lg:p-4 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-base sm:text-xl lg:text-base font-black mb-4 flex items-center gap-2 text-slate-800 uppercase tracking-tight">
                  <Heart size={18} className="text-pink-600 lg:w-5 lg:h-5"/> Sex Shop
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-2">
                  {sexshop.map((prod, idx) => (
                    <button 
                      key={prod.id}
                      onClick={() => handleAddProduct(prod)}
                      disabled={prod.stock <= 0}
                      className={cn(
                        "p-2 sm:p-3 rounded-2xl text-left transition-all active:scale-95 shadow-sm border border-transparent flex flex-col justify-between h-20 sm:h-28 lg:h-20 relative overflow-hidden group",
                        prod.stock > 0 
                          ? PRODUCT_COLORS[(idx + 5) % PRODUCT_COLORS.length] 
                          : "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
                      )}
                    >
                      <div className="relative z-10 w-full">
                        <div className="text-[7px] font-bold uppercase opacity-80 leading-[1] mb-1 sm:mb-2 lg:mb-1 truncate">{prod.name}</div>
                        <div className="text-sm sm:text-lg lg:text-sm font-black tracking-tighter leading-none">${prod.price.toLocaleString()}</div>
                      </div>
                      <div className="relative z-10 flex justify-between items-end">
                        <span className={cn(
                          "text-[10px] sm:text-xs font-black uppercase px-1 py-0.5 rounded-full",
                          prod.stock >= 15 ? "bg-green-500 text-white" : prod.stock >= 5 ? "bg-amber-500 text-white" : "bg-red-500 text-white"
                        )}>Stock: {prod.stock}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* VIP, Promos, Combos */}
            {vips.length > 0 && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 sm:p-8 lg:p-4 rounded-3xl border border-indigo-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                  <Sparkles size={60} className="text-indigo-600" />
                </div>
                <h3 className="text-base sm:text-xl lg:text-base font-black mb-4 flex items-center gap-2 text-indigo-900 uppercase tracking-tight relative z-10">
                  <Sparkles size={18} className="text-indigo-600 lg:w-5 lg:h-5"/> PROMOS, COMBOS, SERVICIOS VIP
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 relative z-10">
                  {vips.map((prod, idx) => (
                    <button 
                      key={prod.id}
                      onClick={() => handleAddProduct(prod)}
                      disabled={prod.stock <= 0}
                      className={cn(
                        "p-3 sm:p-4 rounded-2xl text-left transition-all active:scale-95 shadow-md border border-indigo-100 flex flex-col justify-between h-24 sm:h-32 lg:h-24 relative overflow-hidden group",
                        prod.stock > 0 
                          ? "bg-white text-indigo-900 hover:shadow-lg hover:border-indigo-300" 
                          : "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200"
                      )}
                    >
                      <div className="relative z-10 w-full">
                        <div className="text-[8px] sm:text-[10px] lg:text-[8px] font-black uppercase text-indigo-500 mb-1 leading-tight line-clamp-2">{prod.name}</div>
                        <div className="text-sm sm:text-xl lg:text-sm font-black tracking-tighter leading-none">${prod.price.toLocaleString()}</div>
                      </div>
                      <div className="relative z-10 flex flex-col justify-end mt-1">
                        <span className={cn(
                          "text-[10px] sm:text-xs font-black uppercase px-2 py-0.5 rounded-full w-max shadow-sm",
                          prod.stock >= 15 ? "bg-green-500 text-white" : prod.stock >= 5 ? "bg-amber-500 text-white" : "bg-red-500 text-white"
                        )}>Stock: {prod.stock}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Ticket / Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white p-4 xl:p-6 rounded-3xl border border-slate-200 shadow-xl flex flex-col lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
              <h3 className="text-xl sm:text-2xl font-black mb-2 xl:mb-4 border-b pb-2 text-slate-800 uppercase tracking-tight shrink-0">Cuenta Actual</h3>
              
              <div className="flex-1 overflow-y-auto space-y-2 xl:space-y-3 mb-2 xl:mb-4 pr-1 custom-scrollbar">
                <div className="flex justify-between items-center text-xs sm:text-sm font-bold text-slate-700">
                  <span>Servicio Base (3h)</span>
                  <span>${(room.basePrice || getServicePrice('Servicio Base', 60000)).toLocaleString()}</span>
                </div>
                
                {room.reservationAbono && room.reservationAbono > 0 && (
                      <div className="flex justify-between items-center text-xs sm:text-sm font-black text-amber-600 bg-amber-50 p-2 rounded-lg">
                        <span>Abono Reserva</span>
                        <span>-${room.reservationAbono.toLocaleString()}</span>
                      </div>
                )}
                
                {room.services.filter(s => s.name !== 'Servicio Base').map(srv => (
                  <div key={srv.id} className="flex justify-between items-center text-xs sm:text-sm group animate-in fade-in slide-in-from-right-4 bg-slate-50/50 p-1 rounded-lg">
                    <span className="text-slate-600 font-medium truncate pr-2">{srv.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-[11px] sm:text-sm">${srv.price.toLocaleString()}</span>
                      {srv.name !== 'Servicio Base' && (
                        <button 
                          onClick={() => handleRemoveItem(srv, 'service')} 
                          className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {room.products.map(prod => (
                  <div key={prod.id} className="flex justify-between items-center text-xs sm:text-sm group animate-in fade-in slide-in-from-right-4 bg-slate-50/50 p-1 rounded-lg">
                    <span className="text-slate-600 font-medium truncate pr-2">{prod.quantity}x {prod.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-[11px] sm:text-sm">${(prod.price * prod.quantity).toLocaleString()}</span>
                      <button 
                        onClick={() => handleRemoveItem(prod, 'product')} 
                        className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Minus size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t-4 border-double pt-2 xl:pt-4 space-y-1 sm:space-y-2 mb-4 shrink-0">
                <div className="flex justify-between items-center text-slate-500 font-bold text-[10px] sm:text-xs">
                  <span>Subtotal Acumulado</span>
                  <span className="text-sm sm:text-base">${room.total.toLocaleString()}</span>
                </div>
                {room.reservationAbono ? (
                  <div className="flex justify-between items-center text-amber-600 font-bold px-2 py-1 bg-amber-50 rounded-lg text-[10px] sm:text-xs">
                    <span>Abono Aplicado</span>
                    <span className="text-sm sm:text-base">-${room.reservationAbono.toLocaleString()}</span>
                  </div>
                ) : null}
                <div className="flex flex-col items-end pt-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total a Pagar</span>
                  <span className="text-2xl sm:text-4xl lg:text-3xl xl:text-4xl font-black text-slate-900 tracking-tighter leading-none">
                    ${(room.total - (room.reservationAbono || 0)).toLocaleString()}
                  </span>
                </div>

                <button 
                  onClick={() => { 
                    if (room.status === 'Libre') {
                      alert('Atención: El servicio no ha sido iniciado (el tiempo no está corriendo). Debe dar en "Iniciar Tiempo" para que el servicio sea oficial. Si desea cobrar estos artículos sin iniciar habitación, use Venta Directa en el Tablero.');
                      return;
                    }
                    playClick(); 
                    setShowPaymentModal(true); 
                  }}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 sm:py-4 rounded-2xl flex items-center justify-center gap-2 text-base sm:text-lg shadow-lg shadow-orange-100 transition-all active:scale-95 mt-2"
                >
                  <Printer size={22} />
                  Terminar Servicio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 xl:p-8 max-w-md w-full shadow-2xl max-h-[95vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900">Forma de Pago</h3>
              <button onClick={() => { playClick(); setShowPaymentModal(false); }} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <p className="text-slate-600 mb-6">
              Seleccione el método de pago para el saldo de <strong>${(room.total - (room.reservationAbono || 0)).toLocaleString()}</strong>:
            </p>
            <div className="flex flex-col gap-3">
              {isSaving ? (
                <div className="py-12 flex flex-col items-center gap-4">
                  <div className="text-7xl animate-spin">🔱</div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Procesando Pago...</p>
                </div>
              ) : !isCapturingPhoto ? (
                <>
                  <button
                    onClick={() => { playClick(); handleCloseAccount('Efectivo'); }}
                    className="w-full py-5 bg-green-600 hover:bg-green-700 text-white font-black rounded-2xl text-xl shadow-lg shadow-green-100 transition-all active:scale-95"
                  >
                    Efectivo
                  </button>
                  <button
                    onClick={handleTransferClick}
                    className="w-full py-5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl text-xl shadow-lg shadow-amber-100 transition-all active:scale-95"
                  >
                    Transferencia
                  </button>
                </>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="p-4 bg-amber-50 rounded-2xl mb-4">
                    <p className="text-amber-700 font-bold mb-2 uppercase text-xs">Pago por Transferencia</p>
                    {transferPhoto ? (
                      <div className="relative inline-block">
                        <img src={transferPhoto} alt="Comprobante" className="max-h-48 rounded-lg shadow-md mx-auto" />
                        <button 
                          onClick={() => { playClick(); setTransferPhoto(null); }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="py-8 border-2 border-dashed border-amber-200 rounded-xl flex flex-col items-center gap-3">
                        <AlertCircle size={32} className="text-amber-400" />
                        <p className="text-slate-500 text-sm">Tome una foto del comprobante de transferencia para continuar</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {!transferPhoto ? (
                      <button
                        onClick={() => { playClick(); fileInputRef.current?.click(); }}
                        className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl text-lg flex items-center justify-center gap-2"
                      >
                        Adjuntar o Tomar Fotografía
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCloseAccount('Transferencia')}
                        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-black rounded-2xl text-lg flex items-center justify-center gap-2"
                      >
                        Confirmar y Guardar
                      </button>
                    )}
                    <button
                      onClick={() => { playClick(); setIsCapturingPhoto(false); setTransferPhoto(null); }}
                      className="w-full py-2 text-slate-500 font-bold uppercase text-xs"
                    >
                      Volver
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reservation Warning Modal */}
      {showReservationWarning && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarCheck size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-tight">¡Ojo! Reserva Próxima</h3>
              <p className="text-slate-500 text-sm font-bold uppercase mt-2">
                Cliente: <span className="text-amber-600">{showReservationWarning.clientName}</span><br />
                Hora: {parseISO(showReservationWarning.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            
            <p className="text-slate-600 text-center mb-8 font-medium">
              ¿Esta persona es quien hizo la reserva? Si es así, se aplicará el abono de <span className="text-amber-600 font-bold">${(showReservationWarning.abono || 0).toLocaleString()}</span> a la cuenta.
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => { playClick(); startService(showReservationWarning); }}
                className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-xs rounded-2xl shadow-lg shadow-amber-100 transition-all active:scale-95"
              >
                Sí, es el Cliente (Aplicar Abono)
              </button>
              <button 
                onClick={() => { playClick(); startService(null); }}
                className="w-full py-4 bg-slate-900 hover:bg-black text-white font-black uppercase text-xs rounded-2xl transition-all"
              >
                No es él (Iniciar sin Abono)
              </button>
              <button 
                onClick={() => { playClick(); setShowReservationWarning(null); }}
                className="w-full py-3 text-slate-500 font-bold uppercase text-[10px] tracking-widest"
              >
                Cancelar y Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No active shift modal */}
      {showNoShiftModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Turno No Iniciado</h3>
            <p className="text-slate-600 mb-8">
              No puedes registrar servicios ni productos sin haber iniciado tu turno. Por favor, ve al <strong>Tablero</strong> e inicia tu turno.
            </p>
            <button 
              onClick={() => { playClick(); navigate("/"); }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-lg shadow-lg"
            >
              Ir al Tablero
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
