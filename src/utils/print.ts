
export const printTicket = (html: string) => {
  // Device detection for Mobile and Tablet
  const isMobileOrTablet = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                           (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024);

  if (isMobileOrTablet) {
    // Dispatch custom event for the PrintPreview component to show a modal on mobile/tablet
    // This provides the "Vista Previa" (Preview) requested by the user
    const event = new CustomEvent('app-print-ticket', { detail: { html } });
    window.dispatchEvent(event);
  } else {
    // Standard PC behavior: trigger print dialog directly via hidden iframe
    // This generates the PDF/Print dialog as requested
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

      // Small delay to ensure styles and content are loaded
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Print failed:', e);
        }
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    } else {
      // Fallback for browsers that block iframe printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      }
    }
  }
};
