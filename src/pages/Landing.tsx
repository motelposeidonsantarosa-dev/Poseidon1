import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, ChevronRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useFeedback } from '../hooks/useFeedback';

export default function Landing() {
  const navigate = useNavigate();
  const { playClick, playError } = useFeedback();
  const [showAgeVerification, setShowAgeVerification] = useState(false);
  const [ageRestricted, setAgeRestricted] = useState(false);

  React.useEffect(() => {
    // Clear verification when landing to force re-verification every time they leave and return
    sessionStorage.removeItem('poseidon_age_verified');
  }, []);

  const handleVerProductos = () => {
    playClick();
    // Revisar si ya verificó edad en esta sesión
    const hasVerified = sessionStorage.getItem('poseidon_age_verified') === 'true';
    if (hasVerified) {
      navigate('/catalog');
    } else {
      setShowAgeVerification(true);
    }
  };

  const handleAgeConfirm = (isOver18: boolean) => {
    playClick();
    if (isOver18) {
      sessionStorage.setItem('poseidon_age_verified', 'true');
      setShowAgeVerification(false);
      navigate('/catalog');
    } else {
      setAgeRestricted(true);
      playError();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden pt-[env(safe-area-inset-top,2rem)] pb-[env(safe-area-inset-bottom,1rem)]">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-900/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 w-full max-w-lg text-center space-y-8">
        {/* Logo/Icon Area */}
        <div className="space-y-4">
          <div className="text-7xl mb-2 drop-shadow-2xl">🔱</div>
          <div>
            <h1 className="text-5xl font-black text-white uppercase tracking-tighter">POSEIDÓN</h1>
            <p className="text-amber-500 font-bold uppercase tracking-widest text-[10px] mt-1 italic">En Poseidón te sentirás como los Dioses</p>
          </div>
        </div>

        {/* Main Actions */}
        <div className="space-y-6">
          <button
            onClick={handleVerProductos}
            className="group w-full bg-white text-slate-950 hover:bg-amber-500 hover:text-white transition-all duration-300 rounded-[2rem] p-4 flex items-center justify-between shadow-2xl active:scale-[0.98]"
          >
            <div className="flex items-center gap-4 ml-2">
              <div className="w-14 h-14 bg-slate-100 group-hover:bg-amber-400/20 rounded-2xl flex items-center justify-center transition-colors">
                <ShoppingBag size={28} className="text-slate-600 group-hover:text-white" />
              </div>
              <div className="text-left">
                <p className="font-black text-xl uppercase tracking-tight leading-none mb-1">Ver Productos</p>
                <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">& Servicios</p>
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-900 text-white mr-2 group-hover:translate-x-1 transition-transform">
              <ChevronRight size={24} />
            </div>
          </button>

          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] px-10 leading-relaxed">
            Explora nuestro menú y servicios. Realiza tus pedidos marcando a la recepción (108) desde tu habitación.
          </p>
        </div>

        {/* Social Media & Discreet Staff Entry */}
        <div className="pt-2 space-y-6">
          <div className="space-y-3">
            <p className="text-slate-600 text-[8px] font-black uppercase tracking-[0.3em]">Síguenos en redes</p>
            <div className="flex flex-col gap-1.5 text-slate-400 text-[10px] font-medium">
              <p>Instagram: <span className="text-amber-500/80">@motel_poseidon</span></p>
              <p>Facebook: <span className="text-amber-500/80">@PoseidonMot</span></p>
              <p>WhatsApp: <span className="text-amber-500/80">3157170874</span></p>
            </div>
          </div>

          <button
            onClick={() => { playClick(); navigate('/login'); }}
            className="group inline-flex flex-col items-center gap-2 transition-all active:scale-95"
          >
            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-slate-800 group-hover:border-amber-500/50 group-hover:text-amber-500 transition-colors">
              <ShieldCheck size={16} />
            </div>
          </button>
        </div>
      </div>

      {/* Age Verification Modal */}
      {showAgeVerification && !ageRestricted && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl z-[100] flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="max-w-sm w-full bg-slate-900 border border-white/10 p-10 rounded-[3.5rem] text-center shadow-2xl relative overflow-hidden">
            {/* Background decoration inside modal */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/10 blur-[60px] rounded-full"></div>
            
            <div className="relative z-10">
              <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-amber-500/20">
                <ShieldCheck size={48} className="text-amber-500" />
              </div>
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-4 leading-tight">CONTROL DE ACCESO</h3>
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-10 leading-relaxed">
                ESTA APLICACIÓN CONTIENE CONTENIDO PARA ADULTOS. ¿CONFIRMAS QUE ERES <span className="text-amber-500">MAYOR DE 18 AÑOS</span>?
              </p>
              
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => handleAgeConfirm(true)}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 py-5 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-amber-500/20"
                >
                  SÍ, SOY MAYOR
                </button>
                <button
                  onClick={() => handleAgeConfirm(false)}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 py-5 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95"
                >
                  NO, SOY MENOR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restriction Screen */}
      {ageRestricted && (
        <div className="fixed inset-0 bg-slate-950 z-[110] flex items-center justify-center p-6 animate-in fade-in duration-500">
          <div className="max-w-sm w-full text-center space-y-8">
            <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20 animate-pulse">
              <AlertTriangle size={48} className="text-red-500" />
            </div>
            <h3 className="text-4xl font-black text-white uppercase tracking-tighter leading-tight">ACCESO DENEGADO</h3>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest leading-relaxed">
              LO SENTIMOS, NUESTROS SERVICIOS Y CATÁLOGO ESTÁN RESTRINGIDOS PARA <span className="text-red-500">MENORES DE EDAD</span>.
            </p>
            <div className="pt-8">
              <button
                onClick={() => { playClick(); setAgeRestricted(false); setShowAgeVerification(false); }}
                className="inline-flex items-center gap-2 text-amber-500 font-black uppercase tracking-widest text-[10px] bg-amber-500/10 px-6 py-3 rounded-full hover:bg-amber-500/20 transition-all active:scale-95"
              >
                INTENTAR DE NUEVO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
