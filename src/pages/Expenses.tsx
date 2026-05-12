import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, addDoc, query, orderBy, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { Plus, Receipt, X, Edit2, Trash2, Camera, RotateCcw, Search } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { compressImage } from '../utils/image';
import { cn } from '../lib/utils';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  hostName: string;
  photo?: string | null;
}

const CATEGORIES = ['Agua', 'Luz', 'Internet', 'Aseo', 'Pago Host', 'Otros'];

export default function Expenses() {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const { playClick, playSuccess, playError } = useFeedback();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [showNoShiftModal, setShowNoShiftModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'Otros'
  });

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
    let q;
    if (appUser?.role === 'admin') {
      q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    } else if (appUser?.role === 'host' && activeShift) {
      q = query(
        collection(db, 'expenses'),
        where('hostName', '==', appUser.name),
        where('date', '>=', activeShift.startTime),
        orderBy('date', 'desc')
      );
    } else {
      setExpenses([]);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching expenses:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [appUser, activeShift]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    if (appUser?.role === 'host' && !activeShift) {
      playError();
      setShowNoShiftModal(true);
      return;
    }
    if (!form.description || !form.amount) {
      playError();
      return;
    }

    setIsSaving(true);
    try {
      if (editingExpenseId) {
        updateDoc(doc(db, 'expenses', editingExpenseId), {
          description: form.description,
          amount: Number(form.amount),
          category: form.category,
          photo: photo || null
        }).catch(err => {
            console.error(err);
            playError();
            alert('Error al guardar el gasto.');
        });
        setEditingExpenseId(null);
      } else {
        addDoc(collection(db, 'expenses'), {
          description: form.description,
          amount: Number(form.amount),
          category: form.category,
          date: new Date().toISOString(),
          hostName: appUser?.name || 'Desconocido',
          hostId: appUser?.id || '',
          shiftId: activeShift?.id || null,
          photo: photo || null
        }).catch(err => {
            console.error(err);
            playError();
            alert('Error al guardar el gasto.');
        });
      }
      playSuccess();
      setForm({ description: '', amount: '', category: 'Otros' });
      setPhoto(null);
      setIsSaving(false);
    } catch (err) {
      playError();
      console.error(err);
      alert('Error al guardar el gasto. Verifique su conexión y el tamaño de la imagen.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result as string);
          setPhoto(compressed);
          playSuccess();
        } catch (err) {
          console.error("Error compressing image", err);
          playError();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEdit = (expense: Expense) => {
    playClick();
    setForm({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category
    });
    setPhoto(expense.photo || null);
    setEditingExpenseId(expense.id);
  };

  const handleDelete = () => {
    if (!confirmDeleteId) return;
    playClick();
    deleteDoc(doc(db, 'expenses', confirmDeleteId)).catch(console.error);
    playSuccess();
    setConfirmDeleteId(null);
  };

  if (loading) return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center">
      <div className="text-7xl animate-spin mb-4">🔱</div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Cargando Gastos...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 2xl:grid-cols-3 gap-8 pb-10">
      {isSaving && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[200] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl animate-spin">🔱</div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Guardando Gasto...</p>
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
      <div className="2xl:col-span-1">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 sticky top-8">
          <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3 uppercase tracking-tight">
            {editingExpenseId ? (
              <><Edit2 size={28} className="text-blue-600" /> Modificar Gasto</>
            ) : (
              <><Plus size={28} className="text-blue-600" /> Registrar Gasto</>
            )}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Categoría</label>
              <select 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                value={form.category}
                onChange={e => setForm({...form, category: e.target.value})}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Descripción</label>
              <input 
                type="text" 
                required
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700"
                placeholder="Ej. Compra de jabón"
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-widest">Valor ($)</label>
              <input 
                type="number" 
                required
                min="0"
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 text-2xl"
                placeholder="0"
                value={form.amount}
                onChange={e => setForm({...form, amount: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-500 mb-2 ml-1 tracking-widest">Soporte/Foto (Opcional)</label>
              {photo ? (
                <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-slate-200">
                  <img src={photo} alt="Vista previa" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => setPhoto(null)}
                    className="absolute top-3 right-3 bg-red-500 text-white p-2 rounded-xl shadow-lg transition-transform active:scale-90"
                  >
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { playClick(); fileInputRef.current?.click(); }}
                  className="w-full py-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all group"
                >
                  <div className="p-4 bg-white rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                    <Camera size={32} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">Adjuntar o Tomar Soporte</span>
                </button>
              )}
            </div>

            <button 
              type="submit" 
              disabled={isSaving}
              className={cn(
                "w-full text-white font-black py-5 rounded-2xl shadow-lg transition-all active:scale-95 text-xl uppercase tracking-widest mt-4 flex items-center justify-center gap-2",
                isSaving ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-blue-100"
              )}
            >
              {isSaving ? (
                <>
                  <RotateCcw className="animate-spin" size={24} />
                  Guardando...
                </>
              ) : (
                editingExpenseId ? 'Actualizar Gasto' : 'Guardar Gasto'
              )}
            </button>
            {editingExpenseId && (
              <button 
                type="button"
                onClick={() => {
                  playClick();
                  setEditingExpenseId(null);
                  setForm({ description: '', amount: '', category: 'Otros' });
                }}
                className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-black py-5 rounded-2xl shadow-lg transition-all active:scale-95 text-xl uppercase tracking-widest mt-2"
              >
                Cancelar
              </button>
            )}
          </form>
        </div>
      </div>

      <div className="2xl:col-span-2">
        <h2 className="text-xl sm:text-3xl lg:text-xl font-black text-slate-900 mb-4 sm:mb-8 lg:mb-4 flex items-center gap-2 sm:gap-3 uppercase tracking-tight">
          <Receipt size={24} className="text-blue-600 lg:w-6 lg:h-6" /> Historial de Gastos
        </h2>
        
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          {expenses.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-bold text-xl">No hay gastos registrados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-full">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="p-2 sm:p-4 lg:p-2 [@media(max-width:1024px)]:p-1 md:p-1 font-bold uppercase tracking-wider text-[7px] sm:text-[10px] md:text-[8px] lg:text-sm">Fecha / Hora</th>
                      <th className="p-2 sm:p-4 lg:p-2 [@media(max-width:1024px)]:p-1 md:p-1 font-bold uppercase tracking-wider text-[7px] sm:text-[10px] md:text-[8px] lg:text-sm">Cat.</th>
                      <th className="p-2 sm:p-4 lg:p-2 [@media(max-width:1024px)]:p-1 md:p-1 font-bold uppercase tracking-wider text-[7px] sm:text-[10px] md:text-[8px] lg:text-sm">Descripción</th>
                      <th className="p-2 sm:p-4 lg:p-2 [@media(max-width:1024px)]:p-1 md:p-1 font-bold uppercase tracking-wider text-[7px] sm:text-[10px] md:text-[8px] lg:text-sm">Registró</th>
                      <th className="p-2 sm:p-4 lg:p-2 [@media(max-width:1024px)]:p-1 md:p-1 font-bold uppercase tracking-wider text-[7px] sm:text-[10px] md:text-[8px] lg:text-sm text-right">Valor</th>
                      {appUser?.role === 'admin' && (
                        <th className="p-2 sm:p-4 lg:p-2 [@media(max-width:1024px)]:p-1 md:p-1 font-bold uppercase tracking-wider text-[7px] sm:text-[10px] md:text-[8px] lg:text-sm text-center">Acc..</th>
                      )}
                    </tr>
                </thead>
                <tbody>
                  {expenses.map(expense => (
                    <tr key={expense.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-2 sm:p-4 lg:p-2 [@media(max-width:1024px)]:p-1 md:p-1 text-[7px] sm:text-xs md:text-[8px] lg:text-xs font-bold text-slate-500 whitespace-nowrap">
                        <div className="lg:text-xs">{format(new Date(expense.date), "d MMM", { locale: es })}</div>
                        <div className="text-[6px] md:text-[7px] lg:text-[10px] font-medium opacity-70">{format(new Date(expense.date), "HH:mm")}</div>
                      </td>
                      <td className="p-2 sm:p-4 lg:p-2 [@media(max-width:1024px)]:p-1 md:p-1">
                        <span className="bg-blue-100 text-blue-700 px-1 sm:px-3 py-0.5 sm:py-1 lg:px-2 lg:py-0.5 rounded-full text-[6px] sm:text-[10px] md:text-[7px] lg:text-[10px] font-black uppercase tracking-wider">
                          {expense.category.substring(0, 3)}
                        </span>
                      </td>
                      <td className="p-2 sm:p-4 lg:p-2 [@media(max-width:1024px)]:p-1 md:p-1 font-bold text-slate-800 text-[7px] sm:text-xs md:text-[8px] lg:text-xs">
                        <div className="flex flex-col gap-1">
                          <span className="truncate max-w-[80px] [@media(max-width:1024px)]:max-w-[60px] md:max-w-[60px] lg:max-w-xs">{expense.description}</span>
                          {expense.photo && (
                            <button
                              onClick={() => { playClick(); setViewPhoto(expense.photo!); }}
                              className="text-blue-600 underline font-black text-[6px] sm:text-[9px] md:text-[6px] lg:text-[10px] uppercase flex items-center gap-1 w-fit"
                            >
                              <Search size={8} className="lg:w-3 lg:h-3" /> Foto
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-2 sm:p-4 lg:p-2 [@media(max-width:1024px)]:p-1 md:p-1 text-[7px] sm:text-xs md:text-[8px] lg:text-xs font-bold text-slate-500 uppercase">
                        <div className="truncate max-w-[60px] [@media(max-width:1024px)]:max-w-[45px] md:max-w-[45px] lg:max-w-xs">{expense.hostName}</div>
                      </td>
                      <td className="p-2 sm:p-4 lg:p-2 [@media(max-width:1024px)]:p-1 md:p-1 text-right font-mono font-black text-red-600 text-[8px] sm:text-sm md:text-sm lg:text-base">
                        -${expense.amount.toLocaleString()}
                      </td>
                      {appUser?.role === 'admin' && (
                        <td className="p-2 sm:p-4 lg:p-2 [@media(max-width:1024px)]:p-1 md:p-1 text-center font-bold">
                          <div className="flex items-center justify-center gap-1 sm:gap-2 lg:gap-2">
                            <button 
                              onClick={() => handleEdit(expense)}
                              className="p-1 sm:p-2 lg:p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            >
                              <Edit2 size={12} className="sm:w-4 sm:h-4 lg:w-4 lg:h-4 [@media(max-width:1024px)]:w-3 [@media(max-width:1024px)]:h-3" />
                            </button>
                            <button 
                              onClick={() => { playClick(); setConfirmDeleteId(expense.id); }}
                              className="p-1 sm:p-2 lg:p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              <Trash2 size={12} className="sm:w-4 sm:h-4 lg:w-4 lg:h-4 [@media(max-width:1024px)]:w-3 [@media(max-width:1024px)]:h-3" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* No active shift modal */}
      {showNoShiftModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Turno No Iniciado</h3>
            <p className="text-slate-600 mb-8">
              No puedes registrar gastos sin haber iniciado tu turno. Por favor, ve al <strong>Tablero</strong> e inicia tu turno.
            </p>
            <button 
              onClick={() => { playClick(); navigate('/dashboard'); }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-lg shadow-lg"
            >
              Ir al Tablero
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">¿Eliminar Gasto?</h3>
              <p className="text-slate-500 text-sm font-bold uppercase mt-2">Esta acción no se puede deshacer</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase text-xs rounded-2xl transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDelete}
                className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs rounded-2xl shadow-lg shadow-red-100 transition-all active:scale-95"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal for Review */}
      {viewPhoto && (
        <div 
          className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[100] p-4 cursor-zoom-out"
          onClick={() => { playClick(); setViewPhoto(null); }}
        >
          <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
            <button 
              className="absolute top-0 right-0 p-4 text-white bg-black/20 rounded-full hover:bg-black/40 transition-colors"
              onClick={() => { playClick(); setViewPhoto(null); }}
            >
              <X size={32} />
            </button>
            <img 
              src={viewPhoto} 
              alt="Soporte completo" 
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in-90 duration-300" 
            />
          </div>
        </div>
      )}
    </div>
  );
}
