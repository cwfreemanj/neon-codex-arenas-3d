# Wix Payments -> Neon Codex Star Shop

The game runs inside a Wix page (HTML/iframe element). When a player presses a star pack, the game
asks the Wix page to open Wix Payments, then credits the stars when Wix reports `Successful`.

## Setup (about 10 minutes)

1. **Wix Payments** must be connected on your site (Dashboard -> Accept Payments).
2. In the Wix editor turn on **Dev Mode**.
3. Backend (the `{}` panel -> Backend):
   * create `starPayments.jsw` and paste `backend/starPayments.jsw`
   * create `events.js` and paste `backend/events.js`
4. Add the game: **Add -> Embed Code -> Embed a site**, URL = your GitHub Pages link. Open its settings and set the **ID to `gameFrame`**.
   Make it big (full width, ~900px tall) or use a full-screen strip.
5. Paste `page-code.js` into that page's code panel.
6. *(optional ledger)* Content Manager -> create collection **StarPurchases** with text fields `paymentId`, `packId`, `playerId`, `status` and number field `stars`.
7. Publish, then test with Wix Payments' test mode / a $0.99 pack.

## Pack prices
Edit `PACKS` in `backend/starPayments.jsw` (server side - authoritative) and `STAR_SHOP.packs` in the game so the labels match.

## Security note
Stars live in the player's browser save (localStorage), like the rest of the game's progress. Wix confirms the payment
(`status: 'Successful'`) and the game ignores repeated order ids, but a technical player could still edit their own save.
If you later add accounts, move the star balance to a Wix collection keyed by member id and credit it inside `events.js`.
