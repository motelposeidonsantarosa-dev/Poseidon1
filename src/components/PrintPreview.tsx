import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Share2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const PrintPreview = () => {
  const [html, setHtml] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePrintEvent = (e: any) => {
      setHtml(e.detail.html);
      setIsOpen(true);
    };

    window.addEventListener('app-print-ticket', handlePrintEvent);
    return () => window.removeEventListener('app-print-ticket', handlePrintEvent);
  }, []);

  if (!isOpen || !html) return null;

  const generatePDF = async (): Promise<Blob | null> => {
    if (!previewRef.current) return null;
    
    try {
      setIsProcessing(true);
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 80; // 80mm thermal paper
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      return pdf.output('blob');
    } catch (error) {
      console.error('Error generating PDF:', error);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShare = async () => {
    const pdfBlob = await generatePDF();
    if (!pdfBlob) {
      alert('Error al generar el PDF.');
      return;
    }

    const file = new File([pdfBlob], 'ticket-poseidon.pdf', { type: 'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: 'Ticket Poseidon',
          text: 'Adjunto el ticket de su reservación/estancia.',
          files: [file]
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: download the PDF if sharing is not supported
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ticket-poseidon.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handlePrint = async () => {
    const pdfBlob = await generatePDF();
    if (!pdfBlob) {
      alert('Error al generar el PDF.');
      return;
    }

    const url = URL.createObjectURL(pdfBlob);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // On mobile, opening the PDF directly is usually the best way to trigger the native print/share dialog
      const printWindow = window.open(url, '_blank');
      if (!printWindow) {
        // Fallback if popup blocked: download it
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ticket-poseidon.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } else {
      // Desktop (iframe)
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = url;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.error('Print failed:', e);
          }
        }, 500);
      };
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
            ref={previewRef}
            className="bg-white shadow-lg p-8 w-full max-w-[80mm] min-h-[100mm] ticket-preview-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
        
        <div className="p-4 sm:p-6 bg-white border-t border-slate-200 grid grid-cols-3 gap-2 sm:gap-4">
          <button
            onClick={() => setIsOpen(false)}
            className="px-2 sm:px-6 py-3 sm:py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-xl sm:rounded-2xl uppercase tracking-widest transition-all text-xs sm:text-sm"
          >
            Cerrar
          </button>
          <button
            onClick={handleShare}
            disabled={isProcessing}
            className="px-2 sm:px-6 py-3 sm:py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-black rounded-xl sm:rounded-2xl uppercase tracking-widest transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm"
          >
            <Share2 size={18} /> <span className="hidden sm:inline">{isProcessing ? 'Generando...' : 'Compartir'}</span><span className="sm:hidden">Comp.</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={isProcessing}
            className="px-2 sm:px-6 py-3 sm:py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black rounded-xl sm:rounded-2xl uppercase tracking-widest transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm"
          >
            <Printer size={18} /> {isProcessing ? 'Generando...' : 'Imprimir'}
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
