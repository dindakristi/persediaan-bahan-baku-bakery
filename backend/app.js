const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const SUPABASE_URL = 'https://crpmzottswggzoatfchd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AfE3pnqyEQr1Maj6Is0s-Q_HNDs0JXk';
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL dan SUPABASE_KEY wajib diatur sebelum menjalankan backend.');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

async function supabaseRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || data?.hint || 'Permintaan ke Supabase gagal.');
  }
  return data;
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
}

function send(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  response.end(JSON.stringify(data));
}

function serveFrontend(response, pathname) {
  const requestedFile = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.resolve(FRONTEND_DIR, requestedFile);
  const frontendRoot = path.resolve(FRONTEND_DIR);

  if (!filePath.startsWith(`${frontendRoot}${path.sep}`) && filePath !== frontendRoot) {
    return send(response, 403, { error: 'Akses file tidak diizinkan.' });
  }

  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8'
  };
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return send(response, 404, { error: 'File frontend tidak ditemukan.' });
  }

  response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(response);
}

function calculateStock(materialId, transactions) {
  return transactions
    .filter((item) => item.material_id === materialId)
    .reduce((stock, item) => stock + (item.transaction_type === 'IN' ? Number(item.quantity) : -Number(item.quantity)), 0);
}

async function getMaterials() {
  const materials = await supabaseRequest('materials?select=id,name,unit,minimum_stock,supplier_id,suppliers(id,name)&order=name.asc');
  const transactions = await supabaseRequest('stock_transactions?select=material_id,transaction_type,quantity');
  return materials.map((material) => ({
    ...material,
    supplier_name: material.suppliers?.name || '-',
    current_stock: calculateStock(material.id, transactions)
  }));
}

async function getSummary() {
  const materials = await getMaterials();
  const transactions = await supabaseRequest('stock_transactions?select=id,material_id,transaction_type,quantity,unit_price,notes,transaction_date,created_at,materials(name,unit)&order=created_at.desc&limit=8');
  return {
    total_materials: materials.length,
    low_stock: materials.filter((material) => material.current_stock <= Number(material.minimum_stock)).length,
    inventory_value: transactions.reduce((total, item) => total + (item.transaction_type === 'IN' ? Number(item.quantity) * Number(item.unit_price) : 0), 0),
    recent_transactions: transactions
  };
}

async function handle(request, response) {
  if (request.method === 'OPTIONS') return send(response, 204, null);
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === 'GET' && !url.pathname.startsWith('/api/')) return serveFrontend(response, url.pathname);
    if (request.method === 'GET' && url.pathname === '/api/materials') return send(response, 200, await getMaterials());
    if (request.method === 'GET' && url.pathname === '/api/summary') return send(response, 200, await getSummary());
    if (request.method === 'GET' && url.pathname === '/api/suppliers') {
      return send(response, 200, await supabaseRequest('suppliers?select=id,name&order=name.asc'));
    }
    if (request.method === 'GET' && url.pathname === '/api/transactions') {
      return send(response, 200, await supabaseRequest('stock_transactions?select=id,material_id,transaction_type,quantity,unit_price,notes,transaction_date,materials(name,unit)&order=created_at.desc'));
    }

    if (request.method === 'POST' && url.pathname === '/api/materials') {
      const body = await readJson(request);
      if (!body.name || !body.unit) return send(response, 400, { error: 'Nama dan satuan bahan wajib diisi.' });
      const created = await supabaseRequest('materials', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ name: body.name.trim(), unit: body.unit, minimum_stock: Number(body.minimum_stock || 0), supplier_id: body.supplier_id || null })
      });
      return send(response, 201, created[0]);
    }

    if (request.method === 'POST' && url.pathname === '/api/transactions') {
      const body = await readJson(request);
      const quantity = Number(body.quantity);
      if (!body.material_id || !['IN', 'OUT'].includes(body.transaction_type) || !quantity || quantity <= 0) {
        return send(response, 400, { error: 'Bahan, jenis transaksi, dan jumlah valid wajib diisi.' });
      }
      if (body.transaction_type === 'OUT') {
        const materials = await getMaterials();
        const material = materials.find((item) => item.id === Number(body.material_id));
        if (!material || material.current_stock < quantity) return send(response, 400, { error: 'Stok tidak mencukupi untuk transaksi keluar.' });
      }
      const created = await supabaseRequest('stock_transactions', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          material_id: Number(body.material_id),
          transaction_type: body.transaction_type,
          quantity,
          unit_price: Number(body.unit_price || 0),
          notes: body.notes?.trim() || null,
          transaction_date: body.transaction_date || new Date().toISOString().slice(0, 10)
        })
      });
      return send(response, 201, created[0]);
    }

    send(response, 404, { error: 'Endpoint tidak ditemukan.' });
  } catch (error) {
    console.error(error);
    send(response, 500, { error: error.message || 'Terjadi kesalahan server.' });
  }
}

http.createServer(handle).listen(PORT, () => {
  console.log(`Bunberry Bakery API berjalan di http://localhost:${PORT}`);
});
