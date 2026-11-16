// Velo PAGE code for the Wix page that embeds the game.
//
// 1. Add an "HTML iframe / Embed a site" element, point it at your GitHub Pages game URL and give it the ID  #gameFrame
//    (or change GAME_FRAME_ID below).
// 2. Turn on Dev Mode, paste this into that page's code panel.
// 3. Add backend/starPayments.jsw and backend/events.js from this folder.
//
// Message protocol with the game (window.postMessage):
//   game -> page   { type:'gsa-ready' }                         game finished loading, asks "are you Wix?"
//   page -> game   { type:'gsa-wix' }                           yes: use Wix Payments for the Star Shop
//   game -> page   { type:'gsa-buy', packId, playerId }         player pressed a star pack
//   page -> game   { type:'gsa-purchase', packId, status, orderId, error? }
import wixPay from 'wix-pay';
import { createStarPayment, recordPurchase } from 'backend/starPayments.jsw';

const GAME_FRAME_ID = '#gameFrame';

$w.onReady(() => {
  const frame = $w(GAME_FRAME_ID);
  const tell = (msg) => frame.postMessage(msg);
  let busy = false;

  frame.onMessage(async (event) => {
    const msg = event.data || {};

    if (msg.type === 'gsa-ready') { tell({ type: 'gsa-wix' }); return; }

    if (msg.type === 'gsa-buy') {
      if (busy) return;
      busy = true;
      const packId = String(msg.packId || '');
      try {
        const { paymentId } = await createStarPayment(packId);       // price is decided on the server
        await recordPurchase(paymentId, packId, msg.playerId, 'Started');
        const result = await wixPay.startPayment(paymentId);          // opens the Wix checkout popup
        if (result.status === 'Successful' || result.status === 'Pending') {
          await recordPurchase(paymentId, packId, msg.playerId, result.status);
        }
        tell({ type: 'gsa-purchase', packId, status: result.status, orderId: paymentId });
      } catch (err) {
        tell({ type: 'gsa-purchase', packId, status: 'Failed', error: String(err && err.message || err) });
      } finally { busy = false; }
    }
  });

  // In case the game loaded before this page code attached its listener.
  setTimeout(() => tell({ type: 'gsa-wix' }), 1500);
});
