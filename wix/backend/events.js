// Velo BACKEND file  ->  backend/events.js
// Wix calls this whenever a payment you created changes state (Successful, Declined, Pending...).
import wixData from 'wix-data';

export function wixPay_onPaymentUpdate(event) {
  const payment = event.payment || {};
  const status = event.status || payment.status;
  wixData.query('StarPurchases').eq('paymentId', payment.id).find({ suppressAuth: true })
    .then(r => {
      if (!r.items.length) return;
      const row = r.items[0];
      row.status = status;
      return wixData.update('StarPurchases', row, { suppressAuth: true });
    })
    .catch(() => { /* collection not created yet */ });
}
