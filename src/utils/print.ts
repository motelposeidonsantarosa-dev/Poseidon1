
export const printTicket = (html: string) => {
  // Always dispatch the custom event to show the PrintPreview modal
  // This provides a consistent "Vista Previa" with Print/Save/Close options on all devices
  const event = new CustomEvent('app-print-ticket', { detail: { html } });
  window.dispatchEvent(event);
};
