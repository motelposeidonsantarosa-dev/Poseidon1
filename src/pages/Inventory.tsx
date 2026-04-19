import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useFeedback } from '../hooks/useFeedback';
import { Plus, Edit2, Trash2, Save, X, Database, Package } from 'lucide-react';
import { cn } from '../lib/utils';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
}

const CATEGORIES = ['Bebidas', 'Sexshop', 'Servicios', 'Otros'];

const INITIAL_INVENTORY = [
  { name: 'Cerveza Andina', price: 6000, stock: 50, category: 'Bebidas' },
  { name: 'Cerveza Aguila normal', price: 6000, stock: 50, category: 'Bebidas' },
  { name: 'Cerveza Corona', price: 8000, stock: 50, category: 'Bebidas' },
  { name: 'Cerveza Budweiser', price: 6000, stock: 50, category: 'Bebidas' },
  { name: 'Cerveza Costeña', price: 6000, stock: 50, category: 'Bebidas' },
  { name: 'Cerveza Poker', price: 6000, stock: 50, category: 'Bebidas' },
  { name: 'Smirnoff', price: 14000, stock: 30, category: 'Bebidas' },
  { name: 'Aguardiente', price: 40000, stock: 20, category: 'Bebidas' },
  { name: 'JP Chenet Lata', price: 17000, stock: 30, category: 'Bebidas' },
  { name: 'JP Chenet 200 ml', price: 35000, stock: 20, category: 'Bebidas' },
  { name: 'JP Chenet 750 ml', price: 110000, stock: 10, category: 'Bebidas' },
  { name: 'Agua', price: 2000, stock: 100, category: 'Bebidas' },
  { name: 'Gatorade', price: 6000, stock: 40, category: 'Bebidas' },
  { name: 'Soda', price: 4000, stock: 40, category: 'Bebidas' },
  { name: 'Electrolit', price: 12000, stock: 30, category: 'Bebidas' },
  { name: 'Coca-Cola', price: 4000, stock: 60, category: 'Bebidas' },
  { name: 'Cola y Pola', price: 4000, stock: 40, category: 'Bebidas' },
  { name: 'Jugo Hit', price: 3000, stock: 40, category: 'Bebidas' },
  { name: 'Hatsu', price: 6000, stock: 30, category: 'Bebidas' },
  { name: 'Servicio Base', price: 60000, stock: 0, category: 'Servicios' },
  { name: 'Hora Adicional', price: 20000, stock: 0, category: 'Servicios' },
  { name: 'Persona Adicional', price: 20000, stock: 0, category: 'Servicios' },
  { name: 'Lubricantes', price: 5000, stock: 30, category: 'Sexshop' },
  { name: 'Vibradores', price: 25000, stock: 15, category: 'Sexshop' },
  { name: 'Retardantes', price: 15000, stock: 20, category: 'Sexshop' }
];

export default function Inventory() {
  const { playClick, playSuccess, playError } = useFeedback();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showLoadBaseModal, setShowLoadBaseModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      // Remove duplicates from the view based on name
      const unique = Array.from(new Map(prods.map(p => [p.name, p])).values());
      unique.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      setProducts(unique);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleEdit = (product: Product) => {
    playClick();
    setEditingId(product.id);
    setEditForm(product);
  };

  const handleSave = async () => {
    playClick();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), editForm);
        setEditingId(null);
      } else if (isAdding) {
        await addDoc(collection(db, 'products'), editForm);
        setIsAdding(false);
      }
      playSuccess();
      setEditForm({});
    } catch (err) {
      playError();
      console.error(err);
    }
  };

  const handleDelete = async () => {
    playClick();
    if (deletingId) {
      try {
        await deleteDoc(doc(db, 'products', deletingId));
        playSuccess();
        setDeletingId(null);
      } catch (err) {
        playError();
        console.error(err);
      }
    }
  };

  const startAdd = () => {
    playClick();
    setIsAdding(true);
    setEditingId(null);
    setEditForm({ name: '', price: 0, stock: 0, category: 'Bebidas' });
  };

  const loadInitialInventory = async () => {
    playClick();
    try {
      const batch = writeBatch(db);
      INITIAL_INVENTORY.forEach(prod => {
        const docRef = doc(collection(db, 'products'));
        batch.set(docRef, prod);
      });
      await batch.commit();
      playSuccess();
      setShowLoadBaseModal(false);
    } catch (err) {
      playError();
      console.error(err);
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="max-w-7xl mx-auto pb-10 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight">Inventario</h1>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          {products.length === 0 && (
            <button 
              onClick={() => { playClick(); setShowLoadBaseModal(true); }} 
              className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
            >
              <Database size={20} /> Cargar Base
            </button>
          )}
          <button 
            onClick={startAdd} 
            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-100"
          >
            <Plus size={20} /> Nuevo Producto
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
          <Package size={24} />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Todos los Productos</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Catálogo completo de bebidas y sex shop</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="p-4 md:p-1.5 md:px-1 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 font-black uppercase tracking-widest text-[10px] md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[7px]">Nombre</th>
                <th className="p-4 md:p-1.5 md:px-1 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 font-black uppercase tracking-widest text-[10px] md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[7px]">Cat.</th>
                <th className="p-4 md:p-1.5 md:px-1 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 font-black uppercase tracking-widest text-[10px] md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[7px]">Precio</th>
                <th className="p-4 md:p-1.5 md:px-1 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 font-black uppercase tracking-widest text-[10px] md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[7px]">Stock</th>
                <th className="p-4 md:p-1.5 md:px-1 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 font-black uppercase tracking-widest text-[10px] md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[7px] text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isAdding && (
                <tr className="border-b border-slate-100 bg-blue-50/50 animate-in fade-in slide-in-from-top-4">
                  <td className="p-6 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1"><input type="text" className="w-full p-3 md:p-1 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-1.5 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 bg-white border border-slate-200 rounded-xl font-bold md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px] h-full" placeholder="Nombre" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} /></td>
                  <td className="p-6 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1">
                    <select className="w-full p-3 md:p-1 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-1.5 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 bg-white border border-slate-200 rounded-xl font-bold md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px] h-full" value={editForm.category || 'Bebidas'} onChange={e => setEditForm({...editForm, category: e.target.value})}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="p-6 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1"><input type="number" className="w-full p-3 md:p-1 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-1.5 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 bg-white border border-slate-200 rounded-xl font-bold md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px] h-full" placeholder="Precio" value={editForm.price || ''} onChange={e => setEditForm({...editForm, price: Number(e.target.value)})} /></td>
                  <td className="p-6 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1"><input type="number" className="w-full p-3 md:p-1 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-1.5 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 bg-white border border-slate-200 rounded-xl font-bold md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[8px] h-full" placeholder="Stock" value={editForm.stock || ''} onChange={e => setEditForm({...editForm, stock: Number(e.target.value)})} /></td>
                  <td className="p-6 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 text-right flex justify-end gap-2 md:gap-1 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:gap-1 [@media(max-width:639px)_and_(orientation:portrait)]:gap-0.5">
                    <button onClick={handleSave} className="p-1 px-1.5 md:p-0.5 md:px-1 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-colors"><Save size={14} className="md:w-3 md:h-3" /></button>
                    <button onClick={() => { playClick(); setIsAdding(false); }} className="p-1 px-1.5 md:p-0.5 md:px-1 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-colors"><X size={14} className="md:w-3 md:h-3" /></button>
                  </td>
                </tr>
              )}
                             {products.map(product => {
                 const isEditing = editingId === product.id;
                 return (                  <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1">
                      {isEditing ? <input type="text" className="w-full p-2 md:p-1 bg-white border border-slate-200 rounded-xl font-bold text-xs md:text-[8px]" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /> : <span className="font-bold text-slate-800 text-sm md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[7px] truncate max-w-[80px] md:max-w-[70px] block">{product.name}</span>}
                    </td>
                    <td className="p-4 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1">
                      {isEditing ? (
                        <select className="w-full p-2 md:p-1 bg-white border border-slate-200 rounded-xl font-bold text-xs md:text-[8px]" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : <span className="bg-slate-100 text-slate-600 px-3 py-1 md:px-1.5 md:py-0.5 rounded-full text-[10px] md:text-[7px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[6px] font-black uppercase tracking-wider">{product.category.substring(0, 3)}</span>}
                    </td>
                    <td className="p-4 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 font-mono font-black text-slate-700 text-sm md:text-[8px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[10px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[7px]">
                      {isEditing ? <input type="number" className="w-full p-2 md:p-1 bg-white border border-slate-200 rounded-xl font-bold text-xs md:text-[8px]" value={editForm.price} onChange={e => setEditForm({...editForm, price: Number(e.target.value)})} /> : `$${product.price.toLocaleString()}`}
                    </td>
                    <td className="p-4 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1">
                      {isEditing ? <input type="number" className="w-full p-2 md:p-1 bg-white border border-slate-200 rounded-xl font-bold text-xs md:text-[8px]" value={editForm.stock} onChange={e => setEditForm({...editForm, stock: Number(e.target.value)})} /> : (
                        <span className={cn("px-4 py-1 md:px-1.5 md:py-0.5 rounded-full text-[10px] md:text-[7px] [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:text-[8px] [@media(max-width:639px)_and_(orientation:portrait)]:text-[6px] font-black uppercase tracking-wider", product.stock > 20 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                          {product.stock}
                        </span>
                      )}
                    </td>
                    <td className="p-4 md:p-1.5 [@media(max-height:600px)_and_(max-width:960px)_and_(orientation:landscape)]:p-2 [@media(max-width:639px)_and_(orientation:portrait)]:p-1 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2 md:gap-0.5">
                          <button onClick={handleSave} className="p-1.5 md:p-0.5 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-colors"><Save size={14} className="md:w-3 md:h-3" /></button>
                          <button onClick={() => { playClick(); setEditingId(null); }} className="p-1.5 md:p-0.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors"><X size={14} className="md:w-3 md:h-3" /></button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2 md:gap-0.5">
                          <button onClick={() => handleEdit(product)} className="p-2 md:p-1 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"><Edit2 size={16} className="md:w-3 md:h-3" /></button>
                          <button onClick={() => { playClick(); setDeletingId(product.id); }} className="p-2 md:p-1 text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={16} className="md:w-3 md:h-3" /></button>
                        </div>
                      )}
                    </td>
                  </tr>


                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Load Base Confirmation Modal */}
      {showLoadBaseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-5xl mb-4">📦</div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">¿Cargar inventario base?</h3>
            <p className="text-slate-500 mb-8 font-medium italic">Se agregarán los productos por defecto (bebidas y sexshop) al sistema.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => { playClick(); setShowLoadBaseModal(false); }} 
                className="flex-1 px-6 py-4 text-slate-600 hover:bg-slate-100 rounded-2xl font-black uppercase tracking-widest transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={loadInitialInventory} 
                className="flex-1 px-6 py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg"
              >
                Cargar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-5xl mb-4">🗑️</div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">¿Eliminar producto?</h3>
            <p className="text-slate-500 mb-8 font-medium">Esta acción no se puede deshacer y el producto desaparecerá del inventario.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => { playClick(); setDeletingId(null); }} 
                className="flex-1 px-6 py-4 text-slate-600 hover:bg-slate-100 rounded-2xl font-black uppercase tracking-widest transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDelete} 
                className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-red-100"
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
