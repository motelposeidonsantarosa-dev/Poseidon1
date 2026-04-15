import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, addDoc, query, orderBy, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { Plus, Receipt, X, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  hostName: string;
}

const CATEGORIES = ['Agua', 'Luz', 'Internet', 'Aseo', 'Pago Host', 'Otros'];

export default function Expenses() {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const { playClick, playSuccess, playError } = useFeedback();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [showNoShiftModal, setShowNoShiftModal] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  
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

    try {
      if (editingExpenseId) {
        await updateDoc(doc(db, 'expenses', editingExpenseId), {
          description: form.description,
          amount: Number(form.amount),
          category: form.category
        });
        setEditingExpenseId(null);
      } else {
        await addDoc(collection(db, 'expenses'), {
          description: form.description,
          amount: Number(form.amount),
          category: form.category,
          date: new Date().toISOString(),
          hostName: appUser?.name || 'Desconocido'
        });
      }
      playSuccess();
      setForm({ description: '', amount: '', category: 'Otros' });
    } catch (err) {
      playError();
      console.error(err);
    }
  };

  const handleEdit = (expense: Expense) => {
    playClick();
    setForm({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category
    });
    setEditingExpenseId(expense.id);
  };

  const handleDelete = async (id: string) => {
    playClick();
    if (window.confirm('¿Estás seguro de que deseas eliminar este gasto?')) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
        playSuccess();
      } catch (err) {
        playError();
        console.error(err);
      }
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 2xl:grid-cols-3 gap-8">
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

            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-95 text-xl uppercase tracking-widest mt-4"
            >
              {editingExpenseId ? 'Actualizar Gasto' : 'Guardar Gasto'}
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
        <h2 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-3 uppercase tracking-tight">
          <Receipt size={32} className="text-blue-600" /> Historial de Gastos
        </h2>
        
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          {expenses.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-bold text-xl">No hay gastos registrados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="p-6 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2 font-black uppercase tracking-widest text-xs [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px]">Fecha</th>
                    <th className="p-6 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2 font-black uppercase tracking-widest text-xs [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px]">Categoría</th>
                    <th className="p-6 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2 font-black uppercase tracking-widest text-xs [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px]">Descripción</th>
                    <th className="p-6 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2 font-black uppercase tracking-widest text-xs [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px]">Registrado por</th>
                    <th className="p-6 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2 font-black uppercase tracking-widest text-xs [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px] text-right">Valor</th>
                    {appUser?.role === 'admin' && (
                      <th className="p-6 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2 font-black uppercase tracking-widest text-xs [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px] text-center">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(expense => (
                    <tr key={expense.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-6 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2 text-sm [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[10px] font-bold text-slate-500">
                        {format(new Date(expense.date), "d MMM yyyy, HH:mm", { locale: es })}
                      </td>
                      <td className="p-6 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2">
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:px-2 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:py-0.5 [@media(max-width:639px)_and_(orientation:portrait)]:px-2 [@media(max-width:639px)_and_(orientation:portrait)]:py-0.5 rounded-full text-xs [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px] font-black uppercase tracking-wider">
                          {expense.category}
                        </span>
                      </td>
                      <td className="p-6 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2 font-bold text-slate-800 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[10px]">{expense.description}</td>
                      <td className="p-6 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2 text-sm [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[10px] font-bold text-slate-500">{expense.hostName}</td>
                      <td className="p-6 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2 text-right font-mono font-black text-red-600 text-lg [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-xs [@media(max-width:639px)_and_(orientation:portrait)]:text-xs">
                        -${expense.amount.toLocaleString()}
                      </td>
                      {appUser?.role === 'admin' && (
                        <td className="p-6 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-2 text-center">
                          <div className="flex items-center justify-center gap-2 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:gap-1 [@media(max-width:639px)_and_(orientation:portrait)]:gap-1">
                            <button 
                              onClick={() => handleEdit(expense)}
                              className="p-2 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-1 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Modificar"
                            >
                              <Edit2 size={18} className="[@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:w-3 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:h-3 [@media(max-width:639px)_and_(orientation:portrait)]:w-3 [@media(max-width:639px)_and_(orientation:portrait)]:h-3" />
                            </button>
                            <button 
                              onClick={() => handleDelete(expense.id)}
                              className="p-2 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-1 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={18} className="[@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:w-3 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:h-3 [@media(max-width:639px)_and_(orientation:portrait)]:w-3 [@media(max-width:639px)_and_(orientation:portrait)]:h-3" />
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
              onClick={() => { playClick(); navigate('/'); }}
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
