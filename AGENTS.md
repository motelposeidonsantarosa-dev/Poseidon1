# Project Checkpoints

## CODIGO GUADALUPE
- **Date:** 2026-04-12
- **Description:** This checkpoint represents the project at 100% completion with final refinements, including:
    - Custom PIN-based authentication system.
    - Responsive bottom navigation for mobile and ALL tablets (Vertical/Horizontal up to 2xl).
    - Reservations module with 3-hour advance visual alerts (bright blue pulse) and robust detection logic.
    - **NEW:** Reservations history automatically filters out completed and cancelled reservations, showing only active (pending) ones.
    - Custom confirmation modal for cancelling reservations.
    - Updated ticket headers (Facebook: @PoseidonMot) and personalized footer messages.
    - **NEW:** Robust PDF generation for tickets using `html2canvas` and `jsPDF`.
    - **NEW:** Ticket preview includes "Cerrar", "Guardar" (direct download), "Compartir" (native Web Share API), and "Imprimir" (opens PDF in new tab to bypass cross-origin/popup blockers) buttons.
    - **NEW:** Fixed `oklch` color parsing errors by isolating ticket HTML in a temporary iframe during PDF generation.
    - Financial module with balance reset and ticket printing.
    - Inventory and Expense management with role-based access.
    - Audio and haptic feedback (useFeedback hook).
    - Fixed Firestore rules for `app_users` and custom auth.
    - Optimized layout for tablets to prevent hidden buttons in room details.

**Instruction:** If the user says "VUELVE AL CODIGO GUADALUPE" or "CODIGO GUADALUPE", the agent should attempt to revert any changes made after this checkpoint to restore the functionality and design described above.
