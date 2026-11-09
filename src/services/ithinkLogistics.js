const API_BASE = (process.env.ITHINK_API_BASE_URL || 'https://my.ithinklogistics.com').replace(/\/+$/, '');
const TRACK_BASE = (process.env.ITHINK_TRACK_API_BASE_URL || 'https://api.ithinklogistics.com').replace(/\/+$/, '');

function credentials() {
  const access_token = process.env.ITHINK_ACCESS_TOKEN;
  const secret_key = process.env.ITHINK_SECRET_KEY;
  if (!access_token || !secret_key) {
    const error = new Error('iThink Logistics API credentials are not configured.');
    error.status = 503;
    throw error;
  }
  return { access_token, secret_key };
}

async function postJson(url, data) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cache-control': 'no-cache' },
      body: JSON.stringify({ data }),
      signal: controller.signal
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result?.message || `iThink Logistics returned HTTP ${response.status}`);
      error.status = 502;
      throw error;
    }
    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('iThink Logistics request timed out. Please try again.');
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkPincode(pincode) {
  const auth = credentials();
  const result = await postJson(`${API_BASE}/api_v3/pincode/check.json`, {
    pincode: String(pincode), ...auth
  });
  const success = String(result?.status || '').toLowerCase() === 'success' ||
    Number(result?.status_code) === 200;
  return { success, raw: result };
}

export async function getShippingRates({ toPincode, paymentMethod, subtotal }) {
  const auth = credentials();
  const fromPincode = process.env.ITHINK_PICKUP_PINCODE;
  if (!fromPincode) {
    const error = new Error('Set ITHINK_PICKUP_PINCODE in Render Environment before calculating rates.');
    error.status = 503;
    throw error;
  }
  const result = await postJson(`${API_BASE}/api_v3/rate/check.json`, {
    from_pincode: String(fromPincode),
    to_pincode: String(toPincode),
    shipping_length_cms: String(process.env.ITHINK_PACKAGE_LENGTH_CM || 20),
    shipping_width_cms: String(process.env.ITHINK_PACKAGE_WIDTH_CM || 15),
    shipping_height_cms: String(process.env.ITHINK_PACKAGE_HEIGHT_CM || 10),
    shipping_weight_kg: String(process.env.ITHINK_PACKAGE_WEIGHT_KG || 0.5),
    order_type: 'forward',
    payment_method: String(paymentMethod || 'Prepaid').toLowerCase() === 'cod' ? 'cod' : 'prepaid',
    product_mrp: Number(subtotal || 0).toFixed(2),
    ...auth
  });
  const rates = Array.isArray(result?.data) ? result.data : [];
  const usable = rates.filter(r => Number.isFinite(Number(r.rate)) && Number(r.rate) >= 0);
  if (String(result?.status || '').toLowerCase() !== 'success' || !usable.length) {
    const error = new Error(result?.message || 'No iThink Logistics courier rate is available for this PIN code.');
    error.status = 422;
    throw error;
  }
  usable.sort((a, b) => Number(a.rate) - Number(b.rate));
  const cheapest = usable[0];
  const threshold = Number(process.env.FREE_SHIPPING_THRESHOLD || 499);
  const shippingFee = Number(subtotal || 0) >= threshold ? 0 : Number(cheapest.rate);
  return {
    shippingFee,
    courier: cheapest.logistic_name || '',
    courierRate: Number(cheapest.rate),
    expectedDelivery: result.expected_delivery_date || cheapest.delivery_tat || '',
    rates: usable.map(r => ({ courier: r.logistic_name, rate: Number(r.rate), deliveryTat: r.delivery_tat || '' }))
  };
}

export async function trackAwb(awbNumber) {
  const auth = credentials();
  return postJson(`${TRACK_BASE}/api/order/track.json`, {
    awb_number_list: String(awbNumber), ...auth
  });
}
