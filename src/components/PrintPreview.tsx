import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Share2, Download } from 'lucide-react';
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
    if (!html) return null;
    
    try {
      setIsProcessing(true);
      
      // Create an isolated iframe to prevent html2canvas from parsing Tailwind's oklch colors
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = '170px'; // Approx 45mm printable area at 96 DPI to ensure no right side cutoff
      iframe.style.height = '2000px'; // Large enough to avoid scrolling
      document.body.appendChild(iframe);
      
      const doc = iframe.contentWindow?.document;
      if (!doc) {
        document.body.removeChild(iframe);
        return null;
      }
      
      doc.open();
      // Inject viewport meta tag to prevent mobile browsers from inflating text size
      const modifiedHtml = html.replace('<head>', '<head><meta name="viewport" content="width=170, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">');
      doc.write(modifiedHtml);
      doc.close();
      
      // Wait for rendering
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const contentHeight = doc.body.scrollHeight || 1000;
      iframe.style.height = `${contentHeight}px`;
      
      const canvas = await html2canvas(doc.body, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: doc.body.scrollWidth,
        windowHeight: contentHeight
      });
      
      document.body.removeChild(iframe);
      
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 46; // 46mm printable area on 58mm thermal paper
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [58, pdfHeight > 58 ? pdfHeight + 10 : 58] // 58mm paper width, dynamic height
      });
      
      // Shift slightly to the left (2mm margin) to guarantee right side doesn't cut off
      pdf.addImage(imgData, 'PNG', 2, 0, pdfWidth, pdfHeight);
      return pdf.output('blob');
    } catch (error) {
      console.error('Error generating PDF:', error);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShare = async () => {
    setIsProcessing(true);
    const pdfBlob = await generatePDF();
    setIsProcessing(false);
    
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
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  const handleSave = async () => {
    setIsProcessing(true);
    const pdfBlob = await generatePDF();
    setIsProcessing(false);

    if (!pdfBlob) {
      alert('Error al generar el PDF.');
      return;
    }

    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-poseidon-${new Date().getTime()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handlePrint = async () => {
    // Open window immediately before async operation to bypass popup blockers
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write('<html><body style="font-family:sans-serif;text-align:center;padding-top:50px;">Generando PDF, por favor espere...</body></html>');
    }

    setIsProcessing(true);
    const pdfBlob = await generatePDF();
    setIsProcessing(false);

    if (!pdfBlob) {
      if (printWindow) printWindow.close();
      alert('Error al generar el PDF.');
      return;
    }

    const url = URL.createObjectURL(pdfBlob);
    
    if (printWindow) {
      // Redirect the already opened window to the PDF blob
      printWindow.location.href = url;
    } else {
      // Fallback if popup blocked entirely: download it
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ticket-poseidon.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
        
        <div className="p-4 sm:p-6 bg-white border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <button
            onClick={() => {
              if ('vibrate' in navigator) navigator.vibrate(10);
              setIsOpen(false);
            }}
            className="px-2 sm:px-4 py-3 sm:py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl sm:rounded-2xl uppercase tracking-widest transition-all text-xs sm:text-sm active:scale-95 shadow-lg shadow-red-200"
          >
            Cerrar
          </button>
          <button
            onClick={() => {
              if ('vibrate' in navigator) navigator.vibrate(10);
              handleSave();
            }}
            disabled={isProcessing}
            className="px-2 sm:px-4 py-3 sm:py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black rounded-xl sm:rounded-2xl uppercase tracking-widest transition-all shadow-lg shadow-amber-100 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm active:scale-95"
          >
            <Download size={18} /> <span className="hidden sm:inline">{isProcessing ? '...' : 'Guardar'}</span><span className="sm:hidden">Guardar</span>
          </button>
          <button
            onClick={() => {
              if ('vibrate' in navigator) navigator.vibrate(10);
              handleShare();
            }}
            disabled={isProcessing}
            className="px-2 sm:px-4 py-3 sm:py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-black rounded-xl sm:rounded-2xl uppercase tracking-widest transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm active:scale-95"
          >
            <Share2 size={18} /> <span className="hidden sm:inline">{isProcessing ? '...' : 'Compartir'}</span><span className="sm:hidden">Comp.</span>
          </button>
          <button
            onClick={() => {
              if ('vibrate' in navigator) navigator.vibrate(10);
              handlePrint();
            }}
            disabled={isProcessing}
            className="px-2 sm:px-4 py-3 sm:py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black rounded-xl sm:rounded-2xl uppercase tracking-widest transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm active:scale-95"
          >
            <Printer size={18} /> <span className="hidden sm:inline">{isProcessing ? '...' : 'Imprimir'}</span><span className="sm:hidden">Impr.</span>
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
