import React, { useState, useEffect } from 'react';
import { X, Printer, Download } from 'lucide-react';

export const PrintPreview = () => {
  const [html, setHtml] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handlePrintEvent = (e: any) => {
      setHtml(e.detail.html);
      setIsOpen(true);
    };

    window.addEventListener('app-print-ticket', handlePrintEvent);
    return () => window.removeEventListener('app-print-ticket', handlePrintEvent);
  }, []);

  if (!isOpen || !html) return null;

  const handlePrint = () => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Print failed:', e);
        }
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[9999] flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <h3 className="font-black uppercase tracking-tight flex items-center gap-2">
            <Printer size={20} /> Vista Previa del Ticket
          </h3>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
          <div 
            className="bg-white shadow-lg p-8 w-full max-w-[80mm] min-h-[100mm] ticket-preview-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
        
        <div className="p-6 bg-white border-t border-slate-200 grid grid-cols-2 gap-4">
          <button
            onClick={() => setIsOpen(false)}
            className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl uppercase tracking-widest transition-all"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl uppercase tracking-widest transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
          >
            <Printer size={20} /> Imprimir / Guardar
          </button>
        </div>
      </div>
      
      <style>{`
        .ticket-preview-content {
          font-family: monospace;
          font-size: 12px;
          line-height: 1.4;
        }
        .ticket-preview-content * {
          max-width: 100%;
        }
      `}</style>
    </div>
  );
};
