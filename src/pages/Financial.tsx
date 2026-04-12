import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useFeedback } from '../hooks/useFeedback';
import { Calculator, Printer, Trash2, X, AlertTriangle, Calendar, History } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, subDays } from 'date-fns';
import { printTicket } from '../utils/print';

export default function Financial() {
  const { playClick, playSuccess, playError } = useFeedback();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [lastResetDate, setLastResetDate] = useState<string | null>(null);
  const [resetPeriod, setResetPeriod] = useState<'30days' | 'lastReset'>('30days');

  useEffect(() => {
    const fetchLastReset = async () => {
      const docRef = doc(db, 'settings', 'financial');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setLastResetDate(docSnap.data().lastResetDate);
      }
    };
    fetchLastReset();
  }, []);

  const handleGenerateBalance = async () => {
    playClick();
    if (!startDate || !endDate) {
      playError();
      alert('Por favor seleccione ambas fechas.');
      return;
    }

    setLoading(true);
    try {
      // Ajustar fechas para incluir todo el día
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const ticketsQ = query(
        collection(db, 'tickets'),
        where('date', '>=', start.toISOString()),
        where('date', '<=', end.toISOString())
      );
      const ticketsSnap = await getDocs(ticketsQ);
      let totalIncome = 0;
      let servicesCount = 0;
      ticketsSnap.forEach(doc => {
        totalIncome += doc.data().total;
        servicesCount++;
      });

      const expensesQ = query(
        collection(db, 'expenses'),
        where('date', '>=', start.toISOString()),
        where('date', '<=', end.toISOString())
      );
      const expensesSnap = await getDocs(expensesQ);
      let totalExpenses = 0;
      let expensesCount = 0;
      expensesSnap.forEach(doc => {
        totalExpenses += doc.data().amount;
        expensesCount++;
      });

      const netBalance = totalIncome - totalExpenses;

      // Generar Ticket
      const ticketHtml = `
          <html>
            <head>
              <title>Balance Financiero</title>
              <style>
                @page { margin: 0; size: 80mm auto; }
                body { font-family: monospace; width: 80mm; margin: 0 auto; padding: 5mm; box-sizing: border-box; font-size: 12px; }
                .text-center { text-align: center; }
                .font-bold { font-weight: bold; }
                .text-2xl { font-size: 1.5rem; }
                .mb-4 { margin-bottom: 1rem; }
                .flex-between { display: flex; justify-content: space-between; margin-bottom: 5px; }
                .border-t { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; }
                .border-b { border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
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
                <p class="mt-2 font-bold">BALANCE FINANCIERO</p>
              </div>
              
              <div class="border-b">
                <p><strong>Desde:</strong> ${format(start, 'dd/MM/yyyy')}</p>
                <p><strong>Hasta:</strong> ${format(end, 'dd/MM/yyyy')}</p>
                <p><strong>Generado:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
              </div>

              <div class="mb-4">
                <h3 class="font-bold text-center">INGRESOS</h3>
                <div class="flex-between">
                  <span>Tickets Generados:</span>
                  <span>${servicesCount}</span>
                </div>
                <div class="flex-between font-bold">
                  <span>Total Ingresos:</span>
                  <span>$${totalIncome.toLocaleString()}</span>
                </div>
              </div>

              <div class="border-t mb-4">
                <h3 class="font-bold text-center">GASTOS</h3>
                <div class="flex-between">
                  <span>Cant. Gastos:</span>
                  <span>${expensesCount}</span>
                </div>
                <div class="flex-between font-bold">
                  <span>Total Gastos:</span>
                  <span>$${totalExpenses.toLocaleString()}</span>
                </div>
              </div>

              <div class="border-t">
                <div class="flex-between font-bold text-2xl">
                  <span>BALANCE NETO:</span>
                  <span>$${netBalance.toLocaleString()}</span>
                </div>
              </div>
              
              <div class="text-center mt-8">
                <p>*** FIN DEL REPORTE ***</p>
              </div>
            </body>
          </html>
        `;
      
      printTicket(ticketHtml);
      playSuccess();
    } catch (error) {
      playError();
      console.error("Error generating balance:", error);
      alert("Hubo un error al generar el balance.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetCounters = async () => {
    playClick();
    if (resetConfirmText !== 'REINICIAR') {
      playError();
      alert("Por favor escriba 'REINICIAR' para confirmar.");
      return;
    }

    setLoading(true);
    try {
      // 1. Determinar fecha de inicio para el balance
      let balanceStartDate: Date;
      let periodLabel: string;

      if (resetPeriod === '30days') {
        balanceStartDate = subDays(new Date(), 30);
        periodLabel = 'Últimos 30 días';
      } else {
        balanceStartDate = lastResetDate ? new Date(lastResetDate) : subDays(new Date(), 30);
        periodLabel = lastResetDate ? `Desde el último reinicio (${format(balanceStartDate, 'dd/MM/yyyy')})` : 'Últimos 30 días';
      }
      
      balanceStartDate.setHours(0, 0, 0, 0);
      const now = new Date();
      
      const ticketsQ = query(
        collection(db, 'tickets'),
        where('date', '>=', balanceStartDate.toISOString())
      );
      const ticketsSnap = await getDocs(ticketsQ);
      let totalIncome = 0;
      let servicesCount = 0;
      ticketsSnap.forEach(doc => {
        totalIncome += doc.data().total;
        servicesCount++;
      });

      const expensesQ = query(
        collection(db, 'expenses'),
        where('date', '>=', balanceStartDate.toISOString())
      );
      const expensesSnap = await getDocs(expensesQ);
      let totalExpenses = 0;
      let expensesCount = 0;
      expensesSnap.forEach(doc => {
        totalExpenses += doc.data().amount;
        expensesCount++;
      });

      const netBalance = totalIncome - totalExpenses;

      // 2. Generar Ticket de Cierre
      const ticketHtml = `
          <html>
            <head>
              <title>Cierre de Periodo - Poseidón</title>
              <style>
                @page { margin: 0; size: 80mm auto; }
                body { font-family: monospace; width: 80mm; margin: 0 auto; padding: 5mm; box-sizing: border-box; font-size: 12px; }
                .text-center { text-align: center; }
                .font-bold { font-weight: bold; }
                .text-2xl { font-size: 1.5rem; }
                .mb-4 { margin-bottom: 1rem; }
                .flex-between { display: flex; justify-content: space-between; margin-bottom: 5px; }
                .border-t { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; }
                .border-b { border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
              </style>
            </head>
            <body>
              <div class="text-center mb-4">
                <div class="text-2xl">🔱</div>
                <h1 class="font-bold">POSEIDÓN</h1>
                <p>Motel</p>
                <p>instagram:@motel_poseidon</p>
                <p>Facebook: @PoseidonMot</p>
                <p class="mt-2 font-bold">TICKET DE CIERRE FINANCIERO</p>
                <p>${periodLabel}</p>
              </div>
              
              <div class="border-b">
                <p><strong>Desde:</strong> ${format(balanceStartDate, 'dd/MM/yyyy')}</p>
                <p><strong>Hasta:</strong> ${format(now, 'dd/MM/yyyy')}</p>
                <p><strong>Fecha Cierre:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
              </div>

              <div class="mb-4">
                <h3 class="font-bold text-center">RESUMEN FINAL</h3>
                <div class="flex-between">
                  <span>Servicios:</span>
                  <span>${servicesCount}</span>
                </div>
                <div class="flex-between font-bold">
                  <span>Total Ingresos:</span>
                  <span>$${totalIncome.toLocaleString()}</span>
                </div>
              </div>

              <div class="border-t mb-4">
                <div class="flex-between">
                  <span>Gastos:</span>
                  <span>${expensesCount}</span>
                </div>
                <div class="flex-between font-bold">
                  <span>Total Gastos:</span>
                  <span>$${totalExpenses.toLocaleString()}</span>
                </div>
              </div>

              <div class="border-t">
                <div class="flex-between font-bold text-2xl">
                  <span>BALANCE NETO:</span>
                  <span>$${netBalance.toLocaleString()}</span>
                </div>
              </div>
              
              <div class="text-center mt-8">
                <p>LOS BALANCES HAN SIDO</p>
                <p>REINICIADOS A CERO</p>
                <p>*** FIN DEL REPORTE ***</p>
              </div>
            </body>
          </html>
        `;
      
      printTicket(ticketHtml);

      // 3. Eliminar todos los tickets y gastos
      const allTicketsSnap = await getDocs(collection(db, 'tickets'));
      const deleteTicketsPromises = allTicketsSnap.docs.map(docSnap => deleteDoc(docSnap.ref));
      
      const allExpensesSnap = await getDocs(collection(db, 'expenses'));
      const deleteExpensesPromises = allExpensesSnap.docs.map(docSnap => deleteDoc(docSnap.ref));

      await Promise.all([...deleteTicketsPromises, ...deleteExpensesPromises]);

      // 4. Actualizar fecha de último reinicio
      const newResetDate = new Date().toISOString();
      await setDoc(doc(db, 'settings', 'financial'), { lastResetDate: newResetDate });
      setLastResetDate(newResetDate);

      playSuccess();
      setShowResetModal(false);
      setResetConfirmText('');
      alert("Balances reiniciados a cero exitosamente.");
    } catch (error) {
      playError();
      console.error("Error resetting counters:", error);
      alert("Hubo un error al reiniciar los contadores.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <h1 className="text-4xl font-black text-slate-900 mb-10 flex items-center gap-4 uppercase tracking-tight">
        <Calculator size={40} className="text-blue-600" /> Financiera
      </h1>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-8">
        {/* Generar Balance */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl">
          <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-slate-800 uppercase tracking-tight">
            <Printer className="text-blue-600" size={28} /> Generar Balance
          </h2>
          <p className="text-slate-500 mb-8 font-medium">
            Seleccione un rango de fechas para generar un ticket con el resumen total de ingresos y gastos.
          </p>

          <div className="space-y-6 mb-8">
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Fecha Inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Fecha Fin</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
              />
            </div>
          </div>

          <button
            onClick={handleGenerateBalance}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 text-xl shadow-lg shadow-blue-100 transition-all active:scale-95 uppercase tracking-widest"
          >
            {loading ? 'Procesando...' : 'Generar Ticket'}
          </button>
        </div>

        {/* Reinicio de Contadores */}
        <div className="bg-white p-8 rounded-3xl border border-red-100 shadow-xl bg-red-50/30">
          <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-red-700 uppercase tracking-tight">
            <Trash2 size={28} /> Reinicio de Balances
          </h2>
          <p className="text-red-600/70 mb-8 font-medium">
            Esta opción eliminará todos los registros de ingresos y gastos actuales, poniendo los balances en cero. Se recomienda hacerlo mensualmente.
          </p>

          <button
            onClick={() => { playClick(); setShowResetModal(true); }}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 text-xl shadow-lg shadow-red-100 transition-all active:scale-95 uppercase tracking-widest mt-auto"
          >
            {loading ? 'Procesando...' : 'Poner en Cero'}
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 text-red-600 mb-6">
              <AlertTriangle size={48} />
              <h3 className="text-3xl font-black uppercase tracking-tight">¿Reiniciar?</h3>
            </div>
            
            <p className="text-slate-500 mb-8 font-medium">
              Esta acción eliminará <strong>todos</strong> los tickets y gastos. Seleccione el periodo para el ticket de balance final.
            </p>

            <div className="space-y-4 mb-8">
              <button
                onClick={() => { playClick(); setResetPeriod('30days'); }}
                className={cn(
                  "w-full p-5 rounded-2xl border-2 text-left flex items-center justify-between transition-all",
                  resetPeriod === '30days' ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-100 hover:border-slate-200 text-slate-500"
                )}
              >
                <div className="flex items-center gap-4">
                  <Calendar size={24} />
                  <div>
                    <div className="font-black uppercase tracking-tight">Últimos 30 días</div>
                    <div className="text-xs font-bold opacity-70">Balance del último mes</div>
                  </div>
                </div>
                {resetPeriod === '30days' && <div className="w-4 h-4 bg-blue-600 rounded-full shadow-sm" />}
              </button>

              <button
                onClick={() => { playClick(); setResetPeriod('lastReset'); }}
                className={cn(
                  "w-full p-5 rounded-2xl border-2 text-left flex items-center justify-between transition-all",
                  resetPeriod === 'lastReset' ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-100 hover:border-slate-200 text-slate-500"
                )}
              >
                <div className="flex items-center gap-4">
                  <History size={24} />
                  <div>
                    <div className="font-black uppercase tracking-tight">Desde el último reinicio</div>
                    <div className="text-xs font-bold opacity-70">
                      {lastResetDate ? `Desde: ${format(new Date(lastResetDate), 'dd/MM/yyyy')}` : 'No hay reinicios previos'}
                    </div>
                  </div>
                </div>
                {resetPeriod === 'lastReset' && <div className="w-4 h-4 bg-blue-600 rounded-full shadow-sm" />}
              </button>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-black text-slate-700 mb-3 uppercase tracking-widest">
                Escriba <span className="text-red-600">REINICIAR</span> para confirmar:
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none font-black text-center text-xl uppercase tracking-widest"
                placeholder="REINICIAR"
              />
            </div>

            <div className="flex flex-col gap-4">
              <button
                onClick={handleResetCounters}
                disabled={loading || resetConfirmText !== 'REINICIAR'}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-black py-5 rounded-2xl text-xl shadow-lg shadow-red-100 transition-all active:scale-95 uppercase tracking-widest"
              >
                {loading ? 'Procesando...' : 'Confirmar Reinicio'}
              </button>
              <button
                onClick={() => {
                  playClick();
                  setShowResetModal(false);
                  setResetConfirmText('');
                }}
                disabled={loading}
                className="w-full py-4 text-slate-500 hover:bg-slate-100 rounded-2xl font-black uppercase tracking-widest transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
