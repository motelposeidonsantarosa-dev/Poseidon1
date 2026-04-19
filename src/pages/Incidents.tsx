import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useFeedback } from '../hooks/useFeedback';
import { AlertTriangle, Trash2, Plus, X, Box, ShieldAlert, Camera, CheckCircle2, RotateCcw, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { compressImage } from '../utils/image';

interface Incident {
  id: string;
  roomId: string;
  roomName: string;
  type: 'damage' | 'loss' | 'forgotten';
  description: string;
  hostName: string;
  date: any;
  status: 'pending' | 'resolved';
  photo?: string | null;
  resolutionReason?: string;
  resolvedAt?: any;
}

const INCIDENT_TYPES = [
  { id: 'damage', label: 'Daño', icon: AlertTriangle, color: 'text-red-600 bg-red-100' },
  { id: 'loss', label: 'Pérdida', icon: ShieldAlert, color: 'text-orange-600 bg-orange-100' },
  { id: 'forgotten', label: 'Objeto Olvidado', icon: Box, color: 'text-blue-600 bg-blue-100' }
];

export default function Incidents() {
  const { appUser } = useAuth();
  const { playClick, playSuccess, playError } = useFeedback();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showResolutionModal, setShowResolutionModal] = useState<Incident | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    roomId: '',
    roomName: '',
    type: 'damage' as 'damage' | 'loss' | 'forgotten',
    description: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'incidents'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIncidents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching incidents:", error);
      setLoading(false);
    });
    
    const unsubscribeRooms = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const r = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      r.sort((a, b) => a.name.localeCompare(b.name));
      setRooms(r);
    }, (error) => {
      console.error("Error fetching rooms:", error);
    });

    return () => {
      unsubscribe();
      unsubscribeRooms();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playClick();

    if (!formData.roomId || !formData.description) {
      playError();
      alert('Por favor complete todos los campos');
      return;
    }

    const room = rooms.find(r => r.id === formData.roomId);
    setIsSaving(true);
    
    try {
      await addDoc(collection(db, 'incidents'), {
        ...formData,
        roomName: room?.name || 'Habitación desconocida',
        hostName: appUser?.name || 'Host desconocido',
        date: serverTimestamp(),
        status: 'pending',
        photo: photo
      });
      playSuccess();
      setShowModal(false);
      setPhoto(null);
      setFormData({ roomId: '', roomName: '', type: 'damage', description: '' });
    } catch (err) {
      playError();
      console.error(err);
      alert('Error al guardar la novedad. Verifique su conexión.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResolve = async (incident: Incident, reason: string) => {
    if (appUser?.role !== 'admin') return;
    playClick();
    try {
      await updateDoc(doc(db, 'incidents', incident.id), {
        status: 'resolved',
        resolutionReason: reason,
        resolvedAt: serverTimestamp()
      });
      playSuccess();
      setShowResolutionModal(null);
    } catch (err) {
      playError();
      console.error(err);
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setPhoto(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = async () => {
    if (appUser?.role !== 'admin' || !confirmDeleteId) return;
    playClick();
    try {
      await deleteDoc(doc(db, 'incidents', confirmDeleteId));
      playSuccess();
      setConfirmDeleteId(null);
    } catch (err) {
      playError();
      console.error(err);
      alert('Error al eliminar');
    }
  };

  if (loading) return <div className="p-8">Cargando...</div>;

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        onChange={handlePhotoCapture}
        className="hidden" 
      />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight">Novedades</h1>
          <p className="text-slate-500 font-bold uppercase text-xs tracking-wider">Registro de daños, pérdidas y objetos olvidados</p>
        </div>
        <button 
          onClick={() => { playClick(); setShowModal(true); }} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-blue-100 transition-all active:scale-95"
        >
          <Plus size={20} /> Registrar Novedad
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {incidents.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-3xl border border-slate-200 text-center">
            <div className="text-6xl mb-4">✨</div>
            <h3 className="text-xl font-black text-slate-800 uppercase">No hay novedades registradas</h3>
          </div>
        ) : (
          incidents.map(incident => {
            const typeInfo = INCIDENT_TYPES.find(t => t.id === incident.type);
            const TypeIcon = typeInfo?.icon || AlertTriangle;
            
            return (
              <div key={incident.id} className={cn(
                "bg-white rounded-3xl p-6 shadow-sm border flex flex-col gap-4 group hover:shadow-md transition-all",
                incident.status === 'resolved' ? "border-green-100 bg-green-50/20" : "border-slate-100"
              )}>
                <div className="flex justify-between items-start">
                  <div className={cn("p-3 rounded-2xl", typeInfo?.color)}>
                    <TypeIcon size={24} />
                  </div>
                  <div className="flex gap-2">
                    {incident.status === 'pending' && appUser?.role === 'admin' && (
                      <button 
                        onClick={() => { playClick(); setShowResolutionModal(incident); }}
                        className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-xl transition-all shadow-md active:scale-95"
                        title="Resolver Novedad"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                    )}
                    {appUser?.role === 'admin' && (
                      <button 
                        onClick={() => { playClick(); setConfirmDeleteId(incident.id); }}
                        className="text-slate-300 hover:text-red-500 p-2 transition-colors"
                        title="Eliminar Registro"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{incident.roomName}</h3>
                      <span className={cn(
                        "text-[10px] font-black uppercase px-2 py-1 rounded-full",
                        incident.status === 'resolved' ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                      )}>
                        {incident.status === 'resolved' ? 'Resuelto' : typeInfo?.label}
                      </span>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed font-medium">{incident.description}</p>
                  </div>

                  {incident.photo && (
                    <div 
                      className="rounded-2xl overflow-hidden border border-slate-100 shadow-inner cursor-zoom-in group/img relative"
                      onClick={() => setViewPhoto(incident.photo!)}
                    >
                      <img src={incident.photo} alt="Evidencia" className="w-full h-40 object-cover group-hover/img:scale-105 transition-transform" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Camera size={24} />
                      </div>
                    </div>
                  )}

                  {incident.status === 'resolved' && incident.resolutionReason && (
                    <div className="bg-white/80 p-3 rounded-2xl border border-green-100 flex gap-2 items-start">
                      <CheckCircle2 size={16} className="text-green-600 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black uppercase text-green-700 leading-none mb-1">Cerrado por el Admin</p>
                        <p className="text-xs text-green-800 font-bold leading-tight">{incident.resolutionReason}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-500 text-xs">
                      {incident.hostName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Host</p>
                      <p className="text-xs font-black text-slate-700 leading-none">{incident.hostName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Fecha</p>
                    <p className="text-xs font-black text-slate-700 leading-none">
                      {incident.date?.toDate ? format(incident.date.toDate(), 'dd/MM/yy HH:mm') : '...'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Registar Novedad</h3>
              <button 
                onClick={() => { playClick(); setShowModal(false); }} 
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-2 ml-1">Habitación</label>
                <select 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                  value={formData.roomId}
                  onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                  required
                >
                  <option value="">Seleccione habitación...</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>{room.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-2 ml-1">Tipo de Novedad</label>
                <div className="grid grid-cols-3 gap-3">
                  {INCIDENT_TYPES.map(type => {
                    const TypeIcon = type.icon;
                    const isActive = formData.type === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => { playClick(); setFormData({ ...formData, type: type.id as any }); }}
                        className={cn(
                          "p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all",
                          isActive 
                            ? "bg-slate-900 border-slate-900 text-white shadow-lg" 
                            : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                        )}
                      >
                        <TypeIcon size={20} />
                        <span className="text-[10px] font-black uppercase leading-tight text-center">{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-2 ml-1">Descripción</label>
                <textarea 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none min-h-[120px]"
                  placeholder="Detalle el daño, pérdida u objeto olvidado..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-2 ml-1">Evidencia Fotográfica (Opcional)</label>
                {photo ? (
                  <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-slate-200">
                    <img src={photo} alt="Evidencia" className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={() => setPhoto(null)}
                      className="absolute top-3 right-3 bg-red-500 text-white p-2 rounded-xl shadow-lg"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all group"
                  >
                    <div className="p-4 bg-white rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                      <Camera size={32} />
                    </div>
                    <span className="text-xs font-black uppercase">Adjuntar o Tomar Foto</span>
                  </button>
                )}
              </div>

              <button 
                type="submit"
                disabled={isSaving}
                className={cn(
                  "w-full text-white font-black py-5 px-6 rounded-2xl text-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2",
                  isSaving ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-blue-100"
                )}
              >
                {isSaving ? (
                  <>
                    <RotateCcw className="animate-spin" size={24} />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Plus size={24} />
                    Guardar Novedad
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {showResolutionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 max-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Cerrar Novedad</h3>
              <p className="text-slate-500 text-sm font-bold uppercase mt-2">Seleccione el motivo de resolución</p>
            </div>

            <div className="space-y-3">
              {showResolutionModal.type === 'forgotten' ? (
                <>
                  <button
                    onClick={() => handleResolve(showResolutionModal, 'Se devolvió el objeto al dueño')}
                    className="w-full p-4 bg-slate-50 hover:bg-green-600 hover:text-white border border-slate-200 rounded-2xl text-left font-black uppercase text-xs transition-all flex items-center gap-3 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-green-100 text-green-600 group-hover:bg-white/20 group-hover:text-white flex items-center justify-center">
                      <CheckCircle2 size={16} />
                    </div>
                    Objeto devuelto al dueño
                  </button>
                  <button
                    onClick={() => handleResolve(showResolutionModal, 'Nadie reclamó el objeto pasados 30 días')}
                    className="w-full p-4 bg-slate-50 hover:bg-slate-900 hover:text-white border border-slate-200 rounded-2xl text-left font-black uppercase text-xs transition-all flex items-center gap-3 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-600 group-hover:bg-white/20 group-hover:text-white flex items-center justify-center">
                      <Clock size={16} />
                    </div>
                    No reclamado (30 días)
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleResolve(showResolutionModal, 'Novedad gestionada y cerrada')}
                  className="w-full p-4 bg-slate-50 hover:bg-green-600 hover:text-white border border-slate-200 rounded-2xl text-left font-black uppercase text-xs transition-all flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-100 text-green-600 group-hover:bg-white/20 group-hover:text-white flex items-center justify-center">
                    <CheckCircle2 size={16} />
                  </div>
                  Marcar como Gestionado
                </button>
              )}
              
              <button
                onClick={() => setShowResolutionModal(null)}
                className="w-full p-4 text-slate-400 font-black uppercase text-[10px] hover:text-slate-600"
              >
                Cancelar
              </button>
            </div>
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
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">¿Eliminar Registro?</h3>
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

      {/* Image Modal */}
      {viewPhoto && (
        <div 
          className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[100] p-4 cursor-zoom-out"
          onClick={() => setViewPhoto(null)}
        >
          <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
            <button 
              className="absolute top-0 right-0 p-4 text-white bg-black/20 rounded-full hover:bg-black/40 transition-colors"
              onClick={() => setViewPhoto(null)}
            >
              <X size={32} />
            </button>
            <img 
              src={viewPhoto} 
              alt="Foto completa" 
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in-90 duration-300" 
            />
          </div>
        </div>
      )}
    </div>
  );
}
