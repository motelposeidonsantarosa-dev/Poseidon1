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

## PJ
- **Date:** 2026-04-21
- **Description:** Optimized for PC/Mobile, PWA features, and Fullscreen mode.
    - **Dashboard PC:** Room cards are now square and displayed in a 5-column grid (`xl:grid-cols-5`) to show all 5 rooms on one screen with proportional typography.
    - **PWA & Fullscreen:** Added `manifest.json`, `sw.js`, and logic for "Add to Home Screen" (native app feel). Integrated a **Fullscreen** toggle button in Sidebar and Mobile Nav.
    - **Netlify Deploy Fix:** Added and refined `netlify.toml` to bypass secrets scanning (false positives on public Firebase keys) and ensure smooth production deployment.
    - **Sidebar PC:** Reduced font size for navigation items and logo to avoid scrolling.
    - **Inventory UI:** Added "Stock:" label to all items in Room Details and optimized Sex Shop sections for tablets.
    - **Users UI (Mobile Landscape):** Fixed overlap in user table by reducing font sizes in landscape mode.
    - **Code Quality:** Fully linted and compiled for production.

**Instruction:** If the user says "VUELVE AL CODIGO PJ" or "PJ", the agent should attempt to revert any changes made after this checkpoint to restore the functionality and design described above.

## OK MAYO
- **Date:** 2026-05-01
- **Description:** Optimized for performance, shift control, and offline robustness.
    - **VIP / Promos:** Added a new inventory category and a dedicated, visually distinct section (indigo/purple theme with Sparkles icon) in Room Details for VIP services and combos.
    - **Shift History:** Admins can now view and print the last 5 shift tickets for any specific Host directly from the History section.
    - **Global Shift Lock:** Implemented a system-wide lock that allows only one Host to be in turn at a time. If a Host is active, other Hosts are restricted from accessing operational windows until the shift is closed.
    - **Admin Notifications:** Real-time notifications for Administrators on the Dashboard, reporting exactly when a Host starts or ends their shift.
    - **Offline Capabilities:** Enabled multi-tab Firestore indexedDB persistence with unlimited cache, allowing the system to work fully offline and sync perfectly when the connection returns.
    - **Registry Attribution:** Fixed "Sistema" labels in tickets and records; now everything is correctly attributed to the active Host or "Administración" for automated processes.
    - **Code Quality:** Fully linted and compiled for production.

**Instruction:** If the user says "VUELVE AL CODIGO OK MAYO" or "OK MAYO", the agent should attempt to revert any changes made after this checkpoint to restore the functionality and design described above.

## JUNIO RESERVAS
- **Date:** 2026-05-03
- **Description:** Updated reservation rules and automated abono calculation.
    - **Advance Limit:** Reservations are now restricted to a minimum of 1 hour in advance.
    - **Visual Alerts:** The dashboard and room details now display the blue pulse alert 2 hours before the reservation time.
    - **Abono Logic:** 
        - > 3h lead time: $30k paid ($20k anticipation fee + $10k credit). The $20k fee appears as a ticket item.
        - 1-3h lead time: $30k paid (100% credit).
    - **Extra Services (Abono):** 
        - Jacuzzi: +$30k (credited).
        - Alistamiento / Decoración: +$20k extra (credited). Applies if Jacuzzi or Decoration is selected.
    - **UI:** Added dynamic abono calculator in the reservation modal showing "Total to Pay Today" vs "Credit for Final Payment". Displayed service prices on selection buttons.
    - **Code Quality:** Fully linted and compiled for production.

**Instruction:** If the user says "VUELVE AL CODIGO JUNIO RESERVAS" or "JUNIO RESERVAS", the agent should attempt to revert any changes made after this checkpoint to restore the functionality and design described above.

## JUNIO SESIONES
- **Date:** 2026-05-03
- **Description:** Implemented device session limits based on user roles.
    - **Multi-device Support:** Administrators can now have up to 20 concurrent sessions (virtually unlimited).
    - **Host Limit:** Host users are restricted to a maximum of 2 concurrent devices. If a 3rd session is started, the oldest one is automatically invalidated.
    - **Session Tracking:** Replaced single `lastSessionId` with `activeSessions` array in Firestore for real-time tracking and invalidation.
    - **Code Quality:** Fully linted and compiled for production.

**Instruction:** If the user says "VUELVE AL CODIGO JUNIO SESIONES" or "JUNIO SESIONES" or "SESIONES", the agent should attempt to revert any changes made after this checkpoint to restore the functionality and design described above.

## GUADA OK
- **Date:** 2026-05-04
- **Description:** Optimized reservations and improved desktop UI accessibility.
    - **Simplified Reservations:** Fixed $40,000 down payment (configurable via 'Valor Reserva' in inventory). Reservations are strictly non-refundable.
    - **Auto-Cancellation:** Reservations automatically cancel after 30 minutes of delay, converting the deposit into a "Reserva No Ocupada" ticket for accounting.
    - **Financial Integrity:** Deposits are registered as temporary tickets. They are deleted if the service starts (avoiding duplicate income) or finalized if the reservation is cancelled/no-show.
    - **PC/Desktop UI Fix:** Optimized scrolling in "Venta Directa" (Room Detail) to ensure that the "Terminar Servicio" and payment buttons are always accessible on desktop screens.
    - **Code Quality:** Fully linted and compiled for production.

**Instruction:** If the user says "VUELVE AL CODIGO GUADA OK" or "GUADA OK" or "GuadaOk", the agent should attempt to revert any changes made after this checkpoint to restore the functionality and design described above.

## GUADA MAYO
- **Date:** 2026-05-05
- **Description:** Optimized room interaction logic and multi-device usability.
    - **Room Logic:** Products and services added while a room is "Libre" now correctly sum up to the total in real-time. "Terminar Servicio" is strictly blocked until "Iniciar Tiempo" is clicked to prevent accounting errors (official session starts the timer).
    - **UI/UX PC:** Fixed "Venta Directa" modal on PC to ensure that payment and confirmation buttons are always visible and correctly scrollable regardless of the number of items.
    - **UI/UX Mobile:** Optimized "Venta Directa" mobile view to ensure products remain fully visible while the checkout summary is accessible at the bottom.
    - **Accounting:** Refined total calculation to prevent negative balances and ensured "Servicio Base" price is correctly initialized and displayed in both "Libre" and "Ocupada" states.
    - **Catalog Management:** Improved image handling in Inventory with a global file input for better reliability across browsers and better clean-up of product image fields.
    - **Code Quality:** Fully linted and compiled for production.

**Instruction:** If the user says "VUELVE AL CODIGO GUADA MAYO" or "Guada Mayo" or "GUADA MAYO", the agent should attempt to revert any changes made after this checkpoint to restore the functionality and design described above.
