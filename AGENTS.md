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

## CODIGO GUADALUPE 3007
- **Date:** 2026-04-15
- **Description:** This checkpoint builds upon CODIGO GUADALUPE and includes the following recent updates:
    - **UI/UX:** Reverted sidebar/bottom nav to original behavior (bottom nav on mobile/tablet portrait, sidebar on desktop).
    - **Mobile Landscape:** Bottom navigation moves to a scrollable left sidebar specifically for mobile landscape mode (`@media(max-height:600px) and (max-width:960px) and (orientation:landscape)`), maximizing vertical space. Fixed scrolling issues to ensure full menu visibility.
    - **Mobile Landscape Dashboard:** Room cards automatically shrink and display in a 5-column grid (`grid-cols-5`) when a mobile device is turned horizontally, allowing all 5 rooms to be visible on screen simultaneously without scrolling.
    - **Mobile Tables (Landscape & Portrait):** Tables in Expenses, History, Inventory, and Users automatically shrink proportionally (reduced padding, font sizes, and icon sizes) to fit all columns on the screen without horizontal scrolling in both vertical and horizontal mobile views.
    - **Desktop Dashboard:** Room cards are now larger and displayed in a 3-column grid (`xl:grid-cols-3`) on desktop screens, showing 3 on top and 2 on the bottom.
    - **Navigation Feedback:** Active navigation items across all devices now use a golden/amber color (`text-amber-400`) with a subtle glow (`drop-shadow`) to match the trident logo, instead of the previous blue.
    - **Haptic/Audio Feedback (Reinforced):** Improved `useFeedback` hook with much stronger, more distinct vibration patterns (25ms for click, [40, 60, 40] for success, [60, 60, 60, 60] for error) for mobile/tablet. Increased audio volume (0.4 for click, 0.5 for success/error) to ensure clear audible feedback on desktop.
    - **Performance Optimization (Instant UI):** Refactored room actions (adding products, services, extra hours, persons, and starting service) to use Optimistic UI updates and fire-and-forget Firestore writes. This eliminates network latency, making the UI feel completely instant and highly responsive.
    - **Dashboard:** Tablet landscape mode now displays rooms in a 3-top / 2-bottom grid (`grid-cols-3` for `md`).
    - **Room Details:** "Iniciar Tiempo" button is now bright green (`bg-green-500`) and the active timer text/icon turns green when occupied. "1 Hora Adicional" button remains blue but its width is reduced in tablet landscape to match "Iniciar Tiempo".
    - **History:** Administrators can now filter history by specific User (Host/Admin) in addition to date ranges.
    - **Expenses:** Administrators have a new "Acciones" column to Edit (modify description, amount, category) and Delete expenses.
    - **Tickets:** Added "NIT: 1095823098-1" to all tickets. Fixed dynamic island overlap on iPhones (`safe-area-inset-top`). Added consecutive invoice numbering for room sales.
    - **Financials:** Added date/time filtering for generating balances.
    - **Code Quality:** Fully linted and compiled, ready for production deployment on Netlify/Vercel.

**Instruction:** If the user says "VUELVE AL CODIGO GUADALUPE 3007" or "CODIGO GUADALUPE 3007" or "GUADALUPE3007", the agent should attempt to revert any changes made after this checkpoint to restore the functionality and design described above.

## CODIGO GUADALUPE 1604
- **Date:** 2026-04-16
- **Description:** This checkpoint includes the latest functional requirements:
    - **Dynamic Pricing:** Starting service price (Servicio Base) is no longer hardcoded. It now dynamically fetches the price from the inventory exactly when a room service is started or reset.
    - **Transfer Proof:** Added a capture photo workflow when "Transferencia" is selected as payment. Users can take a photo of the receipt, which is then stored as part of the ticket record for administration review.
    - **Novedades Module:** New section for "Host" users to register damages, losses, or forgotten objects. Includes room selection, type of incident, and description with real-time Firestore persistence.
    - **Incident Resolution & Photos:** Administrators can now resolve incidents with specific reasons (e.g., "Returned to owner", "Unclaimed after 30 days"). Added support for capturing and storing evidence photos using the device camera for damages and forgotten items.
    - **Photo Optimization:** Implemented client-side image compression for both Novedades and Transfer payments to ensure fast uploads and compatibility with Firestore storage limits.
    - **Code Quality:** Fully linted and compiled.

**Instruction:** If the user says "VUELVE AL CODIGO GUADALUPE 1604" or "CODIGO GUADALUPE 1604" or "GUADALUPE 1604", the agent should attempt to revert any changes made after this checkpoint to restore the functionality and design described above.

## CODIGO GUADA OK
- **Date:** 2026-04-17
- **Description:** System fully optimized for performance and responsiveness across all devices (Mobile, Tablet, Desktop).
    - **Tablet portrait fixes:** Eliminated horizontal scrolling in Expenses, History, Inventory, and Users sections by tightening layout, reducing padding, and using responsive font sizes.
    - **Stability:** Complete system review for agility and dynamic behavior.
    - **Refinement:** Finalized UI adjustments for justified and polished look without functional regression.
    - **Code Quality:** Fully linted and compiled for production.

**Instruction:** If the user says "VUELVE AL CODIGO GUADA OK" or "CODIGO GUADA OK" or "GUADA OK", the agent should attempt to revert any changes made after this checkpoint to restore the functionality and design described above.
