import { useEffect, useState, useRef, ChangeEvent } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, writeBatch, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { useFeedback } from '../hooks/useFeedback';
import { Plus, Edit2, Trash2, Save, X, Database, Package, Camera, BedDouble, Info, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { compressImage } from '../utils/image';

import { handleFirestoreError, OperationType } from '../utils/error';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  images?: string[];
  description?: string;
}

interface Room {
  id: string;
  name: string;
  images?: string[];
  description?: string;
}

interface InfoItem {
  id: string;
  name: string;
  images?: string[];
  description?: string;
  createdAt: string;
}

const CATEGORIES = ['Bebidas', 'Snacks', 'Sexshop', 'Servicios', 'VIP / Promos', 'Otros'];

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
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingType, setDeletingType] = useState<'product' | 'info' | null>(null);
  const [showLoadBaseModal, setShowLoadBaseModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'rooms' | 'info'>('products');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [infoItems, setInfoItems] = useState<InfoItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      // Deduplicate by name to prevent multiple entries of the same item
      const unique = Array.from(new Map(prods.map(p => [p.name.toLowerCase(), p])).values());
      unique.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      setProducts(unique);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
      setLoading(false);
    });

    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      roomsData.sort((a, b) => a.name.localeCompare(b.name));
      setRooms(roomsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rooms');
    });

    const unsubInfo = onSnapshot(collection(db, 'promos'), (snapshot) => {
      setInfoItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InfoItem)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'promos');
    });

    return () => {
      unsubProducts();
      unsubRooms();
      unsubInfo();
    };
  }, []);

  const handlePhotoCapture = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const compressed = await compressImage(reader.result as string);
          setEditForm(prev => {
            const currentImages = Array.isArray(prev.images) ? [...prev.images] : [];
            return {
              ...prev,
              images: [...currentImages, compressed],
              image: null // Clear legacy singular field in state
            };
          });
          playSuccess();
        };
        reader.readAsDataURL(file);
        e.target.value = '';
      } catch (err) {
        playError();
      }
    }
  };

  const removeImage = (index: number) => {
    playClick();
    setEditForm(prev => {
      const currentImages = Array.isArray(prev.images) ? [...prev.images] : [];
      const newImages = currentImages.filter((_, i) => i !== index);
      return {
        ...prev,
        images: newImages,
        image: null // Ensure legacy field is cleared
      };
    });
  };

  const handleEditInfo = (info: InfoItem) => {
    playClick();
    setIsAdding(false);
    setEditingId(info.id);
    const images = info.images || [];
    const legacyImage = (info as any).image;
    const normalizedImages = legacyImage && !images.includes(legacyImage) ? [legacyImage, ...images] : images;
    setEditForm({ ...info, images: normalizedImages });
  };

  const handleEditRoom = (room: Room) => {
    playClick();
    setIsAdding(false);
    setEditingId(room.id);
    const images = room.images || [];
    const legacyImage = (room as any).image;
    const normalizedImages = legacyImage && !images.includes(legacyImage) ? [legacyImage, ...images] : images;
    setEditForm({ ...room, images: normalizedImages });
  };

  const handleSaveRoom = async () => {
    playClick();
    if (!editingId) return;
    setIsSaving(true);
    try {
      const { id, ...dataToSave } = editForm as any;
      // Force clean update: images is the new array, image is removed from Firestore
      await updateDoc(doc(db, 'rooms', editingId), {
        ...dataToSave,
        image: deleteField(),
        updatedAt: new Date().toISOString()
      });
      setEditingId(null);
      setEditForm({});
      playSuccess();
    } catch (err) {
      playError();
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${editingId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveInfo = async () => {
    playClick();
    if (!editForm.images || editForm.images.length === 0) return alert("Debes subir al menos una imagen");
    setIsSaving(true);
    try {
      const { id, image, ...dataToSave } = editForm as any;
      
      if (editingId) {
        await updateDoc(doc(db, 'promos', editingId), {
          ...dataToSave,
          image: deleteField(),
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'promos'), {
          ...dataToSave,
          createdAt: new Date().toISOString()
        });
      }
      setEditingId(null);
      setIsAdding(false);
      setEditForm({});
      playSuccess();
    } catch (err) {
      playError();
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'promos');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteInfo = (id: string) => {
    playClick();
    setDeletingType('info');
    setDeletingId(id);
  };

  const handleEdit = (product: Product) => {
    playClick();
    setIsAdding(false);
    setEditingId(product.id);
    const images = product.images || [];
    const legacyImage = (product as any).image;
    const normalizedImages = legacyImage && !images.includes(legacyImage) ? [legacyImage, ...images] : images;
    setEditForm({ ...product, images: normalizedImages });
  };

  const handleSave = async () => {
    playClick();
    setIsSaving(true);
    try {
      const { id, image, ...dataToSave } = editForm as any;
      
      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), {
          ...dataToSave,
          image: deleteField(),
          updatedAt: new Date().toISOString()
        });
        setEditingId(null);
      } else if (isAdding) {
        // Prevent accidental duplicates if name already exists
        const exists = products.find(p => p.name.toLowerCase() === (dataToSave.name || '').toLowerCase());
        if (exists && !window.confirm(`Ya existe un producto con el nombre "${dataToSave.name}". ¿Desea crearlo de todas formas?`)) {
          setIsSaving(false);
          return;
        }
        await addDoc(collection(db, 'products'), {
          ...dataToSave,
          createdAt: new Date().toISOString()
        });
        setIsAdding(false);
      }
      playSuccess();
      setEditForm({});
    } catch (err) {
      playError();
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'products');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    playClick();
    if (deletingId) {
      setIsSaving(true);
      try {
        const collectionName = deletingType === 'info' ? 'promos' : 'products';
        await deleteDoc(doc(db, collectionName, deletingId));
        playSuccess();
        setDeletingId(null);
        setDeletingType(null);
      } catch (err) {
        playError();
        handleFirestoreError(err, OperationType.DELETE, `${deletingType === 'info' ? 'promos' : 'products'}/${deletingId}`);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const startAdd = () => {
    playClick();
    setEditingId(null);
    setIsAdding(true);
    setEditForm({ name: '', price: 0, stock: 0, category: 'Bebidas', images: [] });
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

  if (loading) return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center">
      <div className="text-7xl animate-spin drop-shadow-2xl mb-4">🔱</div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">Cargando Inventario...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto pb-10 px-1 sm:px-6 lg:px-4">
      {/* Global Hidden Input for Photos */}
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handlePhotoCapture} 
        className="hidden" 
      />

      <div className="flex flex-col sm:flex-row lg:flex-row justify-between items-start sm:items-center lg:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Gestión de Catálogo</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Configura productos, habitaciones y fotos</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl w-full sm:w-auto">
          <button
            onClick={() => { 
              playClick(); 
              setActiveTab('info'); 
              setEditingId(null); 
              setIsAdding(false); 
              setEditForm({}); 
            }}
            className={cn(
              "flex-1 sm:px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
              activeTab === 'info' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Info
          </button>
          <button
            onClick={() => { 
              playClick(); 
              setActiveTab('products'); 
              setEditingId(null); 
              setIsAdding(false); 
              setEditForm({}); 
            }}
            className={cn(
              "flex-1 sm:px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
              activeTab === 'products' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Productos
          </button>
          <button
            onClick={() => { 
              playClick(); 
              setActiveTab('rooms'); 
              setEditingId(null); 
              setIsAdding(false); 
              setEditForm({}); 
            }}
            className={cn(
              "flex-1 sm:px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
              activeTab === 'rooms' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Habitaciones
          </button>
        </div>
      </div>

      {activeTab === 'info' ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
                <Sparkles size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Info & Gestión</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Imágenes informativas para clientes</p>
              </div>
            </div>
            <button 
              onClick={() => { playClick(); setIsAdding(true); setEditingId(null); setEditForm({}); }} 
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-100"
            >
              <Plus size={20} /> Nueva Información
            </button>
          </div>

          {(isAdding || editingId) && activeTab === 'info' && (
            <div className="bg-white p-6 rounded-3xl border-2 border-indigo-100 shadow-xl animate-in fade-in slide-in-from-top-4 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Galería de Imágenes</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(editForm.images || []).map((img: string, idx: number) => (
                      <div key={idx} className="aspect-video relative rounded-xl overflow-hidden bg-slate-100 group">
                        <img src={img} className="w-full h-full object-contain" />
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(idx);
                          }}
                          className="absolute top-2 right-2 w-8 h-8 bg-red-600 text-white rounded-lg flex items-center justify-center shadow-xl active:scale-95 z-20"
                          title="Eliminar foto"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-video rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
                    >
                      <Camera size={24} />
                      <span className="text-[8px] font-black uppercase mt-1">Agregar Foto</span>
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  <input 
                    type="text" 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold"
                    placeholder="Título de la información..."
                    value={editForm.name || ''}
                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                  />
                  <textarea 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold min-h-[100px]"
                    placeholder="Descripción opcional..."
                    value={editForm.description || ''}
                    onChange={e => setEditForm({...editForm, description: e.target.value})}
                  />
                  <div className="flex gap-3">
                    <button onClick={handleSaveInfo} className="flex-1 bg-indigo-600 text-white p-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-100">
                      Guardar Info
                    </button>
                    <button onClick={() => { playClick(); setIsAdding(false); setEditingId(null); }} className="px-6 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase">
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {infoItems.map(info => (
              <div key={info.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm group">
                <div className="aspect-square bg-slate-50 relative">
                  {info.images && info.images.length > 0 ? (
                    <img src={info.images[0]} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-200"><Sparkles size={40} /></div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={() => handleEditInfo(info)} className="p-2 bg-white text-blue-600 rounded-xl hover:scale-110 transition-transform">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDeleteInfo(info.id)} className="p-2 bg-white text-red-600 rounded-xl hover:scale-110 transition-transform">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  {info.images && info.images.length > 1 && (
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[8px] font-black px-2 py-0.5 rounded-full">
                      +{info.images.length - 1} FOTOS
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-bold text-slate-800 text-xs truncate uppercase tracking-tight">{info.name || 'Sin título'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'products' ? (
        <>
          <div className="flex flex-col sm:flex-row lg:flex-row justify-between items-start sm:items-center lg:items-center gap-4 mb-4 sm:mb-8 lg:mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
                <Package size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Inventario de Productos</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Bebidas, Snacks y Sex Shop</p>
              </div>
            </div>
            <div className="flex flex-wrap lg:flex-nowrap gap-3 w-full sm:w-auto">
              {products.length === 0 && (
                <button 
                  onClick={() => { playClick(); setShowLoadBaseModal(true); }} 
                  className="flex-1 sm:flex-none lg:px-4 lg:py-2 bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg lg:text-sm"
                >
                  <Database size={20} className="lg:w-5 lg:h-5" /> Cargar Base
                </button>
              )}
              <button 
                onClick={startAdd} 
                className="flex-1 sm:flex-none lg:px-4 lg:py-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-100 lg:text-sm"
              >
                <Plus size={20} className="lg:w-5 lg:h-5" /> Nuevo Producto
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-full table-fixed md:table-auto">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="p-2 sm:p-4 font-black uppercase tracking-widest text-[8px] sm:text-xs w-[12%] sm:w-auto">Foto</th>
                    <th className="p-2 sm:p-4 font-black uppercase tracking-widest text-[8px] sm:text-xs">Nombre</th>
                    <th className="p-2 sm:p-4 font-black uppercase tracking-widest text-[8px] sm:text-xs w-[15%] sm:w-auto">Cat.</th>
                    <th className="p-2 sm:p-4 font-black uppercase tracking-widest text-[8px] sm:text-xs">Precio</th>
                    <th className="p-2 sm:p-4 font-black uppercase tracking-widest text-[8px] sm:text-xs w-[12%] sm:w-auto">Stock</th>
                    <th className="p-2 sm:p-4 font-black uppercase tracking-widest text-[8px] sm:text-xs text-right">Acc.</th>
                  </tr>
                </thead>
                <tbody>
                  {isAdding && (
                    <tr className="border-b border-slate-100 bg-blue-50/50 animate-in fade-in slide-in-from-top-4">
                      <td className="p-2 sm:p-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {(editForm.images || []).map((img, idx) => (
                              <div key={idx} className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden bg-slate-50 border border-slate-200">
                                <img src={img} className="w-full h-full object-cover" />
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeImage(idx);
                                  }}
                                  className="absolute top-0 right-0 bg-red-600 text-white p-1 rounded-bl-lg z-20 shadow-lg"
                                  title="Eliminar foto"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                            <button 
                              onClick={() => fileInputRef.current?.click()}
                              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 bg-slate-50"
                            >
                              <Camera size={14} />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="p-2 sm:p-4"><input type="text" className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-[10px] sm:text-sm" placeholder="Nombre" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} /></td>
                      <td className="p-2 sm:p-4">
                        <select className="w-full p-1 sm:p-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl font-bold text-[9px] sm:text-sm" value={editForm.category || 'Bebidas'} onChange={e => setEditForm({...editForm, category: e.target.value})}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="p-2 sm:p-4"><input type="number" className="w-full p-1 sm:p-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-sm" placeholder="Precio" value={editForm.price || ''} onChange={e => setEditForm({...editForm, price: Number(e.target.value)})} /></td>
                      <td className="p-2 sm:p-4"><input type="number" className="w-full p-1 sm:p-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-sm" placeholder="Stock" value={editForm.stock || ''} onChange={e => setEditForm({...editForm, stock: Number(e.target.value)})} /></td>
                      <td className="p-2 sm:p-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={handleSave} className="p-1.5 sm:p-2 bg-green-100 text-green-700 rounded-lg sm:rounded-xl hover:bg-green-200 transition-colors"><Save size={14} /></button>
                          <button onClick={() => { playClick(); setIsAdding(false); }} className="p-1.5 sm:p-2 bg-red-100 text-red-700 rounded-lg sm:rounded-xl hover:bg-red-200 transition-colors"><X size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {products.map(product => {
                    const isEditing = editingId === product.id;
                    return (
                      <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-2 sm:p-4">
                          <div className="flex flex-wrap gap-1">
                            {isEditing ? (
                              <>
                                {(editForm.images || []).map((img, idx) => (
                                  <div key={idx} className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden bg-slate-50 border border-slate-200">
                                    <img src={img} className="w-full h-full object-cover" />
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeImage(idx);
                                      }}
                                      className="absolute top-0 right-0 bg-red-600 text-white p-1 rounded-bl-lg z-20 shadow-lg"
                                      title="Eliminar foto"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))}
                                <button 
                                  onClick={() => fileInputRef.current?.click()}
                                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 bg-slate-50"
                                >
                                  <Camera size={14} />
                                </button>
                              </>
                            ) : (
                              (product.images && product.images.length > 0) ? (
                                <div className="relative w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                                  <img src={product.images[0]} className="w-full h-full object-contain" />
                                  {product.images.length > 1 && (
                                    <div className="absolute bottom-0 right-0 bg-black/60 text-white text-[6px] sm:text-[8px] font-black px-1 rounded-tl-md">
                                      +{product.images.length - 1}
                                    </div>
                                  )}
                                </div>
                              ) : (product as any).image ? (
                                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                                  <img src={(product as any).image} className="w-full h-full object-contain" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-slate-300">
                                  <Package size={14} className="sm:w-5 sm:h-5" />
                                </div>
                              )
                            )}
                          </div>
                        </td>
                        <td className="p-2 sm:p-4">
                          {isEditing ? (
                            <input 
                              type="text" 
                              className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-[10px] sm:text-sm" 
                              value={editForm.name} 
                              onChange={e => setEditForm({...editForm, name: e.target.value})} 
                            />
                          ) : (
                            <span className="font-bold text-slate-800 text-[10px] sm:text-sm">
                              {product.name}
                            </span>
                          )}
                        </td>
                        <td className="p-2 sm:p-4">
                          {isEditing ? (
                            <select className="w-full p-1 sm:p-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl font-bold text-[9px] sm:text-sm" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})}>
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : <span className="bg-slate-100 text-slate-600 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider">{product.category.substring(0, 5)}</span>}
                        </td>
                        <td className="p-2 sm:p-4 font-mono font-black text-slate-700 text-[10px] sm:text-sm">
                          {isEditing ? <input type="number" className="w-full p-1 sm:p-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-sm" value={editForm.price} onChange={e => setEditForm({...editForm, price: Number(e.target.value)})} /> : `$${product.price.toLocaleString()}`}
                        </td>
                        <td className="p-2 sm:p-4">
                          {isEditing ? <input type="number" className="w-full p-1 sm:p-4 bg-white border border-slate-200 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-sm" value={editForm.stock} onChange={e => setEditForm({...editForm, stock: Number(e.target.value)})} /> : (
                            <span className={cn("px-2 sm:px-4 py-0.5 sm:py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider", product.stock > 10 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                              {product.stock}
                            </span>
                          )}
                        </td>
                        <td className="p-2 sm:p-4 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1">
                              <button onClick={handleSave} className="p-1.5 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-colors"><Save size={14} /></button>
                              <button onClick={() => { playClick(); setEditingId(null); }} className="p-1.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors"><X size={14} /></button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <button onClick={() => handleEdit(product)} className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                              <button onClick={() => { playClick(); setDeletingId(product.id); }} className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
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
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-600 text-white rounded-2xl shadow-lg shadow-amber-100">
              <BedDouble size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Catálogo de Habitaciones</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Configura fotos y descripciones para clientes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => {
              const isEditing = editingId === room.id;
              return (
                <div key={room.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl">
                  {isEditing ? (
                    <div className="p-6 space-y-4">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Galería de Fotos</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(editForm.images || []).map((img: string, idx: number) => (
                            <div key={idx} className="aspect-video relative rounded-2xl overflow-hidden bg-slate-50 group">
                              <img src={img} className="w-full h-full object-cover" />
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeImage(idx);
                                }}
                                className="absolute top-2 right-2 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center shadow-xl active:scale-95 z-20"
                                title="Eliminar foto"
                              >
                                <X size={20} />
                              </button>
                            </div>
                          ))}
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-video rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-amber-400 hover:text-amber-500 transition-colors"
                          >
                            <Camera size={24} />
                            <span className="text-[8px] font-black uppercase mt-1">Agregar Foto</span>
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Habitación</label>
                        <input 
                          type="text" 
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm"
                          value={editForm.name || ''}
                          onChange={e => setEditForm({...editForm, name: e.target.value})}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción Publica</label>
                        <textarea 
                          rows={3}
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm"
                          placeholder="Describe la habitación para el catálogo..."
                          value={editForm.description || ''}
                          onChange={e => setEditForm({...editForm, description: e.target.value})}
                        />
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button onClick={handleSaveRoom} className="flex-1 bg-amber-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-amber-100 flex items-center justify-center gap-2">
                          <Save size={18} /> Guardar
                        </button>
                        <button onClick={() => { playClick(); setEditingId(null); }} className="px-6 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200">
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="aspect-video bg-slate-100 relative overflow-hidden group">
                        {room.images && room.images.length > 0 ? (
                          <img src={room.images[0]} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        ) : (room as any).image ? (
                          <img src={(room as any).image} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <BedDouble size={48} />
                          </div>
                        )}
                        <button 
                          onClick={() => handleEditRoom(room)}
                          className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-md rounded-xl shadow-lg flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all transform hover:scale-110"
                        >
                          <Edit2 size={18} />
                        </button>
                        {room.images && room.images.length > 1 && (
                          <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                            {room.images.length} Fotos
                          </div>
                        )}
                      </div>
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{room.name}</h3>
                          <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Activa</span>
                        </div>
                        <p className="text-slate-500 text-xs italic line-clamp-2 min-h-[2rem]">
                          {room.description || 'Sin descripción configurada.'}
                        </p>
                        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2 text-slate-400">
                           <Info size={14} />
                           <span className="text-[10px] font-bold uppercase tracking-widest">Información para Clientes</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hidden Global File Input */}
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoCapture} className="hidden" />

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
            <div className="text-5xl mb-4">{deletingType === 'info' ? '📋' : '🗑️'}</div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">
              {deletingType === 'info' ? '¿Eliminar información?' : '¿Eliminar producto?'}
            </h3>
            <p className="text-slate-500 mb-8 font-medium">
              {deletingType === 'info' 
                ? 'Esta información junto con sus fotos serán eliminadas permanentemente.' 
                : 'Esta acción no se puede deshacer y el producto desaparecerá del inventario.'}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => { playClick(); setDeletingId(null); setDeletingType(null); }} 
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
