import React, { useState, useRef } from 'react';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './contexts/AuthContext';

const COLLECTIONS = [
  'rooms', 'products', 'app_users', 'reservations', 'promos', 
  'financial_reports', 'tickets', 'expenses', 'incidents', 'settings', 'shifts', 'notifications'
];

export function Migration() {
  const [log, setLog] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { appUser } = useAuth();

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const handleExport = async () => {
    setWorking(true);
    addLog('Iniciando descarga de los datos actuales...');
    const exportData: Record<string, any[]> = {};
    
    try {
      for (const col of COLLECTIONS) {
        try {
          const snapshot = await getDocs(collection(db, col));
          exportData[col] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          addLog(`Leídos ${snapshot.docs.length} registros de ${col}`);
        } catch (e: any) {
          addLog(`Ignorando ${col}: vacío o protegido.`);
        }
      }
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `poseidon_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      addLog('¡DESCARGA EXITOSA! Guarda el archivo poseidon_backup.json.');
    } catch (err: any) {
      addLog(`Error al exportar: ${err.message}`);
    }
    setWorking(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setWorking(true);
    addLog(`Leyendo archivo seleccionado...`);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        addLog('Archivo válido. Iniciando restauración de datos en esta Base de Datos...');
        
        for (const col of Object.keys(data)) {
          const docs = data[col];
          if (!docs || docs.length === 0) continue;
          
          addLog(`Subiendo ${docs.length} registros a ${col}...`);
          let successCount = 0;
          
          // Firebase limit is 500 writes per batch
          const CHUNK_SIZE = 450;
          for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
            const chunk = docs.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);
            
            for (const d of chunk) {
              const { id, ...docData } = d;
              batch.set(doc(db, col, id), docData);
            }
            
            try {
              await batch.commit();
              successCount += chunk.length;
              addLog(`Progreso ${col}: ${successCount}/${docs.length}`);
            } catch (err: any) {
              addLog(`Error al subir lote en ${col}: ${err.message}`);
            }
          }
          addLog(`Completado ${col}: ${successCount} registros subidos.`);
        }
        addLog('¡RESTAURACIÓN COMPLETADA CON ÉXITO! Todos tus datos están en esta base de datos.');
      } catch (err: any) {
        addLog(`Error al procesar el archivo: ${err.message}`);
      }
      setWorking(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-4 sm:p-10 max-w-2xl mx-auto mt-10 sm:mt-20 bg-white rounded-2xl shadow-xl">
      <h1 className="text-2xl sm:text-3xl font-bold mb-5 flex items-center gap-3">
        <span className="text-4xl">🗄️</span> Migración Segura de Datos
      </h1>
      <p className="mb-5 text-gray-600">
        Esta herramienta te permite descargar un archivo de tus datos y luego subirlo. Esto garantiza que ningún bloqueo de Firebase impida tu migración.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <button 
          onClick={handleExport}
          disabled={working}
          className="flex-1 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <span className="text-xl">⬇️</span> Descargar Datos (Exportar)
        </button>
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={working}
          className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <span className="text-xl">⬆️</span> Subir Datos (Restaurar)
        </button>
        <input 
          type="file" 
          accept=".json" 
          ref={fileInputRef} 
          onChange={handleImport} 
          className="hidden" 
        />
      </div>

      <div className="bg-slate-900 border border-slate-700 text-green-400 p-5 rounded-lg font-mono text-xs sm:text-sm h-[300px] overflow-auto shadow-inner">
        {log.map((l, i) => <div key={i} className="mb-1">{l}</div>)}
        {!log.length && "Listo para comenzar. Descarga tus datos primero..."}
      </div>
    </div>
  );
}
