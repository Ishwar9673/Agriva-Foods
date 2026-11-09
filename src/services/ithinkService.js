const BASE = (process.env.ITHINK_API_BASE || 'https://my.ithinklogistics.com/api_v3').replace(/\/$/, '');

function credentials() {
  const access_token = process.env.ITHINK_ACCESS_TOKEN;
  const secret_key = process.env.ITHINK_SECRET_KEY;
  if (!access_token || !secret_key) {
    const error = new Error('iThink Logistics API credentials are not configured in Render.');
    error.status = 503;
    throw error;
  }
  return { access_token, secret_key };
}

async function post(path, data) {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cache-control': 'no-cache' },
    body: JSON.stringify({ data: { ...data, ...credentials() } }),
    signal: AbortSignal.timeout(25000)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) {
    const error = new Error(body?.message || `iThink Logistics request failed (${response.status}).`);
    error.status = 502;
    throw error;
  }
  return body;
}

export function buildParcel(items = []) {
  const quantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  if (!quantity) throw new Error('Cannot calculate parcel for an empty order.');
  // Product packed weight supplied by the merchant: 120 g per 100 g unit.
  const unitWeightKg = Number(process.env.ITHINK_UNIT_WEIGHT_KG || 0.12);
  const mailerWeightKg = Number(process.env.ITHINK_MAILER_WEIGHT_KG || 0.04);
  const tiers = [
    { max: 1, l: 20, w: 15, h: 5 },
    { max: 3, l: 25, w: 20, h: 8 },
    { max: 6, l: 30, w: 25, h: 12 },
    { max: 10, l: 35, w: 30, h: 15 }
  ];
  const tier = tiers.find(t => quantity <= t.max) || tiers[3];
  const parcels = quantity > 10 ? Math.ceil(quantity / 10) : 1;
  const weight = Number(((quantity * unitWeightKg + mailerWeightKg * parcels) / parcels).toFixed(3));
  return {
    quantity, parcels, length: Number(process.env.ITHINK_MAILER_LENGTH_CM || tier.l),
    width: Number(process.env.ITHINK_MAILER_WIDTH_CM || tier.w),
    height: Number(process.env.ITHINK_MAILER_HEIGHT_CM || tier.h),
    weightKg: weight
  };
}

export async function checkPincode(pinCode) {
  const body = await post('/pincode/check.json', { pincode: String(pinCode) });
  const success = String(body.status || '').toLowerCase() === 'success' ||
    Number(body.status_code) === 200;
  const data = body.data;
  const serviceable = success && data !== null && data !== false &&
    !(Array.isArray(data) && data.length === 0);
  return { serviceable, raw: body };
}

function extractRates(payload) {
  const data = Array.isArray(payload?.data) ? payload.data : [];
  const found = data
    .filter(item => item && Number.isFinite(Number(item.rate)) && Number(item.rate) > 0)
    .map(item => ({
      courier: item.logistic_name || item.courier_name || 'Available courier',
      amount: Number(item.rate),
      estimatedDays: item.delivery_tat || payload.expected_delivery_date || null
    }));
  if (!found.length) {
    const error = new Error(payload?.message || 'iThink did not return a usable courier rate. Check your API access and parcel configuration.');
    error.status = 502;
    throw error;
  }
  found.sort((a, b) => a.amount - b.amount);
  return found[0];
}

export async function getShippingQuote({ pinCode, parcel, paymentMethod, productMrp }) {
  const from = String(process.env.ITHINK_PICKUP_PINCODE || '');
  if (!/^\d{6}$/.test(from)) {
    const error = new Error('Set ITHINK_PICKUP_PINCODE to your registered 6-digit pickup warehouse PIN in Render.');
    error.status = 503;
    throw error;
  }
  const body = await post('/rate/check.json', {
    from_pincode: from,
    to_pincode: String(pinCode),
    shipping_length_cms: String(parcel.length),
    shipping_width_cms: String(parcel.width),
    shipping_height_cms: String(parcel.height),
    shipping_weight_kg: String(parcel.weightKg),
    order_type: 'forward',
    payment_method: paymentMethod.toLowerCase(),
    product_mrp: Number(productMrp).toFixed(2)
  });
  if (String(body.status || '').toLowerCase() !== 'success' && Number(body.status_code) !== 200) {
    const error = new Error(body.message || 'iThink could not calculate a shipping rate.');
    error.status = 422;
    throw error;
  }
  const selected = extractRates(body);
  return { shippingFee: Number(selected.amount.toFixed(2)), courier: selected.courier, estimatedDays: selected.estimatedDays, raw: body };
}
