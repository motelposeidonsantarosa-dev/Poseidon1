import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { Phone, Grid, Package, BedDouble, Info, ChevronRight, ChevronLeft, X, Sparkles, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { useFeedback } from '../hooks/useFeedback';

const PRODUCT_COLORS = [
  "bg-red-50 border-red-100 text-red-700 hover:bg-red-100",
  "bg-orange-50 border-orange-100 text-orange-700 hover:bg-orange-100",
  "bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100",
  "bg-green-50 border-green-100 text-green-700 hover:bg-green-100",
  "bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100",
  "bg-teal-50 border-teal-100 text-teal-700 hover:bg-teal-100",
  "bg-cyan-50 border-cyan-100 text-cyan-700 hover:bg-cyan-100",
  "bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100",
  "bg-orange-50 border-orange-100 text-orange-700 hover:bg-orange-100",
  "bg-yellow-50 border-yellow-100 text-yellow-700 hover:bg-yellow-100",
  "bg-amber-100 border-amber-200 text-amber-800 hover:bg-amber-200",
  "bg-fuchsia-50 border-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-100",
  "bg-pink-50 border-pink-100 text-pink-700 hover:bg-pink-100",
  "bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100"
];

interface CatalogItem {
  id: string;
  name: string;
  price: number;
  category: string;
  images?: string[];
  stock?: number;
}

interface RoomInfo {
  id: string;
  name: string;
  images?: string[];
  description?: string;
}

export default function Catalog() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [infoItems, setInfoItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'rooms' | 'info'>('products');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | RoomInfo | any | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { playClick } = useFeedback();

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CatalogItem));
      // Deduplicate by name and filter valid items
      const validItems = items.filter(i => i.category === 'Servicios' || (i.stock !== undefined && i.stock > 0));
      const unique = Array.from(new Map(validItems.map(p => [p.name.toLowerCase(), p])).values())
        .sort((a, b) => a.name.localeCompare(b.name));
      setProducts(unique);
    });

    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoomInfo))
        .sort((a, b) => a.name.localeCompare(b.name));
      setRooms(items);
    });

    const unsubInfo = onSnapshot(collection(db, 'promos'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setInfoItems(items);
      setLoading(false);
    });

    return () => {
      unsubProducts();
      unsubRooms();
      unsubInfo();
    };
  }, []);

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [selectedItem]);

  const categories = ['Todos', ...Array.from(new Set(products.map(p => p.category))).sort((a, b) => (a as string).localeCompare(b as string))];

  const filteredProducts = selectedCategory === 'Todos' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  if (loading) return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center">
      <div className="text-7xl animate-spin mb-4 text-amber-500">🔱</div>
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] animate-pulse">Cargando Menú...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 md:p-6 sticky top-0 z-40 border-b border-amber-500/20 shadow-2xl pt-[env(safe-area-inset-top,1rem)]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <button 
              onClick={() => { playClick(); navigate('/'); }}
              className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-slate-700 transition-all active:scale-90"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="text-center md:text-left cursor-pointer" onClick={() => { playClick(); navigate("/"); }}>
              <h1 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2 justify-center md:justify-start leading-none mb-1">
                 POSEIDÓN <span className="text-xl">🔱</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">En Poseidón te sentirás como los Dioses</p>
            </div>
            <div className="w-10 h-10 md:hidden" /> {/* Spacer for mobile balance */}
          </div>

          <div className="flex bg-slate-800 p-1.5 rounded-2xl w-full md:w-auto shadow-inner">
            <button
              onClick={() => { playClick(); setActiveTab('products'); }}
              className={cn(
                "flex-1 md:px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                activeTab === 'products' ? "bg-amber-500 text-slate-950 shadow-lg" : "text-slate-400"
              )}
            >
              <Package size={14} /> Menú
            </button>
            <button
              onClick={() => { playClick(); setActiveTab('rooms'); }}
              className={cn(
                "flex-1 md:px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                activeTab === 'rooms' ? "bg-amber-500 text-slate-950 shadow-lg" : "text-slate-400"
              )}
            >
              <BedDouble size={14} /> Habitaciones
            </button>
            <button
              onClick={() => { playClick(); setActiveTab('info'); }}
              className={cn(
                "flex-1 md:px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                activeTab === 'info' ? "bg-amber-500 text-slate-950 shadow-lg" : "text-slate-400"
              )}
            >
              <Sparkles size={14} /> Info
            </button>
          </div>

          <div className="flex items-center gap-4 bg-amber-500/10 px-4 py-3 rounded-2xl border border-amber-500/20 w-full md:w-auto">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-slate-950 shrink-0">
              <Phone size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-amber-500 leading-none mb-1">Pedidos (Ext. 108)</p>
              <p className="text-sm font-black text-amber-100 whitespace-nowrap tracking-tight">Marca a Recepción</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 pb-24">
        {activeTab === 'info' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {infoItems.length === 0 ? (
              <div className="col-span-full py-20 text-center">
                <Sparkles size={48} className="text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay información vigente en este momento.</p>
              </div>
            ) : (
              infoItems.map((info) => (
                <div
                  key={info.id}
                  onClick={() => { playClick(); setSelectedItem(info); }}
                  className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-2xl transition-all group cursor-pointer"
                >
                  <div className="aspect-square bg-slate-50 relative overflow-hidden">
                    {info.images && info.images.length > 0 ? (
                      <img src={info.images[0]} alt={info.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700" />
                    ) : (info as any).image ? (
                      <img src={(info as any).image} alt={info.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-200 opacity-20"><Sparkles size={64} /></div>
                    )}
                    <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/20 transition-colors flex items-center justify-center">
                       <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-transform">
                          <Info size={24} />
                       </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="font-black text-slate-800 text-lg uppercase tracking-tighter mb-2">{info.name || 'Información Especial'}</h3>
                    <button className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-2">
                       Ver en pantalla completa <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'products' ? (
          <div className="space-y-8">
            {/* Category Filter */}
            <div className="flex overflow-x-auto gap-2 pb-4 scrollbar-none snap-x h-16 items-center">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { playClick(); setSelectedCategory(cat); }}
                  className={cn(
                    "whitespace-nowrap px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all border snap-start shrink-0 h-full flex items-center",
                    selectedCategory === cat 
                      ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200" 
                      : "bg-white border-slate-200 text-slate-500 hover:border-amber-300"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
              {filteredProducts.map((product, idx) => {
                const colorClass = PRODUCT_COLORS[idx % PRODUCT_COLORS.length];
                const parts = colorClass.split(' ');
                const bgColor = parts[0];
                const borderColor = parts[1];
                const textColor = parts[2];

                return (
                  <div
                    key={product.id}
                    onClick={() => { playClick(); setSelectedItem(product); }}
                    className={cn(
                      "rounded-[2rem] border overflow-hidden shadow-sm hover:shadow-xl transition-all group cursor-pointer active:scale-95",
                      bgColor,
                      borderColor
                    )}
                  >
                    <div className="aspect-square bg-white/50 relative overflow-hidden flex items-center justify-center">
                      {product.images && product.images.length > 0 ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" />
                      ) : (product as any).image ? (
                        <img src={(product as any).image} alt={product.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 opacity-20">
                           <Package size={48} className={textColor} />
                           <span className={cn("text-[8px] font-bold uppercase tracking-widest", textColor)}>Sin Foto</span>
                        </div>
                      )}
                      {product.category === 'VIP / Promos' && (
                        <div className="absolute top-3 right-3 bg-amber-500 text-slate-950 p-2 rounded-xl shadow-lg">
                          <Sparkles size={16} />
                        </div>
                      )}
                    </div>
                    <div className="p-4 space-y-2">
                      <p className={cn("text-[8px] font-black uppercase tracking-widest leading-none opacity-60", textColor)}>{product.category}</p>
                      <h3 className={cn("font-bold text-xs sm:text-sm leading-tight h-8 line-clamp-2 uppercase tracking-tight", textColor)}>{product.name}</h3>
                      <div className="flex items-center justify-between pt-1 border-t border-black/5">
                        <p className={cn("text-base font-black tracking-tighter", textColor)}>${product.price.toLocaleString()}</p>
                        <button className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-current/40 group-hover:bg-white group-hover:text-current transition-colors">
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div
                key={room.id}
                onClick={() => { playClick(); setSelectedItem(room); }}
                className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-2xl transition-all group cursor-pointer"
              >
                <div className="aspect-[16/10] bg-slate-100 relative overflow-hidden">
                  {room.images && room.images.length > 0 ? (
                    <img src={room.images[0]} alt={room.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (room as any).image ? (
                    <img src={(room as any).image} alt={room.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center opacity-10 bg-gradient-to-br from-slate-200 to-slate-400">
                      <BedDouble size={80} />
                      <span className="text-[10px] font-black uppercase tracking-[0.4em] mt-4">Habitación Real</span>
                    </div>
                  )}
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-white/20">
                    <p className="font-black text-slate-900 uppercase tracking-tighter">{room.name}</p>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Info size={16} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Detalles</span>
                    </div>
                    <button className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Ver Servicios <ChevronRight size={14} />
                    </button>
                  </div>
                  <p className="text-slate-500 text-xs italic leading-relaxed line-clamp-2">
                    {room.description || 'Habitación equipada con todas las comodidades para una experiencia inolvidable. Incluye servicio de limpieza y atención a la habitación.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Item Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[100] flex items-center justify-center p-0 md:p-8">
          <button 
            onClick={() => { playClick(); setSelectedItem(null); }}
            className="absolute top-6 right-6 z-[110] w-14 h-14 bg-white/10 hover:bg-red-500 rounded-full flex items-center justify-center text-white transition-all active:scale-90"
          >
            <X size={32} />
          </button>

          {'createdAt' in selectedItem ? (
            // Info Full Screen Mode
            <div className="w-full h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-200 p-4">
              <div className="max-w-4xl w-full h-full flex flex-col">
                <div className="flex-1 min-h-0 flex items-center justify-center relative group">
                  {selectedItem.images && selectedItem.images.length > 1 && (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); playClick(); setCurrentImageIndex(prev => prev === 0 ? selectedItem.images.length - 1 : prev - 1); }}
                        className="absolute left-4 z-20 w-12 h-12 bg-black/20 hover:bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all"
                      >
                        <ChevronLeft size={32} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); playClick(); setCurrentImageIndex(prev => (prev + 1) % selectedItem.images.length); }}
                        className="absolute right-4 z-20 w-12 h-12 bg-black/20 hover:bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-all"
                      >
                        <ChevronRight size={32} />
                      </button>
                    </>
                  )}
                  <img 
                    src={selectedItem.images ? selectedItem.images[currentImageIndex] : (selectedItem.image || '')} 
                    alt={selectedItem.name} 
                    className="max-w-full max-h-full object-contain shadow-2xl rounded-3xl"
                  />
                  {selectedItem.images && selectedItem.images.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-[10px] font-black uppercase tracking-widest">
                      {currentImageIndex + 1} / {selectedItem.images.length}
                    </div>
                  )}
                </div>
                {selectedItem.name && (
                  <div className="pt-8 text-center px-4">
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">{selectedItem.name}</h2>
                    <p className="text-slate-400 font-medium max-w-2xl mx-auto">{selectedItem.description}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Regular Product/Room Detail
            <div className="bg-white w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
              <button 
                onClick={() => { playClick(); setSelectedItem(null); }}
                className="absolute top-6 right-6 z-20 w-12 h-12 bg-white/90 backdrop-blur-md rounded-full shadow-xl flex items-center justify-center text-slate-950 hover:bg-red-500 hover:text-white transition-all active:scale-90 shadow-red-100/20"
              >
                <X size={24} />
              </button>

              <div className="max-h-[85vh] overflow-y-auto scrollbar-none">
                <div className="aspect-square sm:aspect-video bg-slate-100 flex items-center justify-center overflow-hidden relative">
                  {(selectedItem.images && selectedItem.images.length > 1) ? (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); playClick(); setCurrentImageIndex(prev => prev === 0 ? selectedItem.images.length - 1 : prev - 1); }}
                        className="absolute left-4 z-10 w-10 h-10 bg-white/80 hover:bg-white text-slate-900 rounded-full flex items-center justify-center shadow-lg transition-all"
                      >
                        <ChevronLeft size={24} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); playClick(); setCurrentImageIndex(prev => (prev + 1) % selectedItem.images.length); }}
                        className="absolute right-4 z-10 w-10 h-10 bg-white/80 hover:bg-white text-slate-900 rounded-full flex items-center justify-center shadow-lg transition-all"
                      >
                        <ChevronRight size={24} />
                      </button>
                      <img src={selectedItem.images[currentImageIndex]} alt={selectedItem.name} className="w-full h-full object-contain" />
                      <div className="absolute bottom-4 bg-white/80 backdrop-blur-md px-3 py-1 rounded-full text-slate-900 text-[10px] font-black">
                        {currentImageIndex + 1} / {selectedItem.images.length}
                      </div>
                    </>
                  ) : (
                    selectedItem.images && selectedItem.images.length > 0 ? (
                      <img src={selectedItem.images[0]} alt={selectedItem.name} className="w-full h-full object-contain" />
                    ) : selectedItem.image ? (
                      <img src={selectedItem.image} alt={selectedItem.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-slate-200">
                        {'category' in selectedItem ? <Package size={120} /> : <BedDouble size={120} />}
                      </div>
                    )
                  )}
                </div>
                <div className="p-8 space-y-6">
                  <div>
                    {'category' in selectedItem && (
                       <p className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] mb-2">{selectedItem.category}</p>
                    )}
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-tight">{selectedItem.name}</h2>
                  </div>

                  {'price' in selectedItem && (
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Precio</p>
                      <p className="text-3xl font-black text-slate-900 tracking-tighter">${selectedItem.price.toLocaleString()}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Descripción</h4>
                    <p className="text-slate-600 text-sm leading-relaxed font-medium">
                      {'description' in selectedItem && selectedItem.description 
                        ? selectedItem.description 
                        : 'Nuestros productos y servicios cumplen con los más altos estándares de calidad e higiene para brindarte la mejor experiencia.'}
                    </p>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={() => { playClick(); setSelectedItem(null); }}
                      className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 active:scale-95 transition-all"
                    >
                      Cerrar Detalle
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
