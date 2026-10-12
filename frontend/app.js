const SUPABASE_URL = 'https://crpmzottswggzoatfchd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AfE3pnqyEQr1Maj6Is0s-Q_HNDs0JXk';
const SUPABASE_REST = `${SUPABASE_URL}/rest/v1`;
const state = { materials: [], suppliers: [], purchaseOrders: [], categories: [], collapsedCategories: new Set() };
const DEFAULT_CATEGORIES = ['Bahan Kering', 'Dairy & Telur', 'Buah & Berry', 'Perasa & Topping'];
const DEFAULT_SUPPLIERS = [
  { name: 'Berry Shop', phone: '0813-1111-2222', address: 'Bandung' },
  { name: 'PT Mitra Pangan Sejahtera', phone: '0812-2001-1000', address: 'Bandung' },
  { name: 'PT Prima Bakery Supply', phone: '0812-2001-2000', address: 'Bandung' },
  { name: 'CV Prima Fresh Produce', phone: '0812-2001-3000', address: 'Bandung' },
  { name: 'CV Mitra Pangan Jaya', phone: '0812-2001-4000', address: 'Bandung' }
];

const $ = (selector) => document.querySelector(selector);
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const money = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
const dateLabel = (value) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.page-panel');

  function activatePage(target, selectedTab) {
    tabs.forEach((item) => item.classList.toggle('active', item === selectedTab));
    panels.forEach((panel) => {
      const panelName = panel.dataset.page;
      panel.classList.toggle('active-page',
        (panelName === 'beranda' && target === 'beranda') ||
        (panelName === 'ringkasan' && target === 'ringkasan') ||
        (panelName === 'persediaan' && target === 'persediaan') ||
        (panelName === 'riwayat-stok' && target === 'riwayat stok') ||
        (panelName === 'tambah-bahan' && target === 'tambah bahan') ||
        (panelName === 'update-stock' && target === 'update stock') ||
        (panelName === 'pesanan-bahan' && target === 'pesanan bahan')
      );
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.textContent.trim().toLowerCase();
      activatePage(target, tab);
    });
  });

  document.querySelectorAll('[data-open-page]').forEach((button) => {
    button.addEventListener('click', () => activatePage(button.dataset.openPage, [...tabs].find((tab) => tab.textContent.trim().toLowerCase() === button.dataset.openPage)));
  });
}

function showToast(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast visible ${isError ? 'error' : ''}`;
  setTimeout(() => { toast.className = 'toast'; }, 3200);
}

async function api(path, options = {}) {
  const response = await fetch(`${SUPABASE_REST}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!response.ok) {
    const detail = data?.message || data?.hint || data?.details || data?.error || 'Permintaan ke Supabase gagal.';
    if (response.status === 401 || response.status === 403) throw new Error('Supabase menolak akses. Jalankan backend/policies.sql di SQL Editor Supabase.');
    throw new Error(detail);
  }
  return data;
}

function renderMaterials() {
  const grid = $('#materials-table');
  const categories = [...state.categories];
  const categoryGroups = categories.map((category) => ({
    id: Number(category.id),
    name: category.name,
    materials: state.materials.filter((material) => Number(material.category_id) === Number(category.id))
  }));
  const uncategorized = state.materials.filter((material) => !material.category_id || !categories.some((category) => Number(category.id) === Number(material.category_id)));
  if (uncategorized.length) categoryGroups.push({ name: 'Belum dikategorikan', materials: uncategorized });

  if (!state.materials.length) grid.innerHTML = '<p class="empty">Belum ada bahan baku. Tambahkan dari panel di samping.</p>';
  else grid.innerHTML = categoryGroups.map((group) => {
    const categoryKey = group.id ? String(group.id) : 'uncategorized';
    const isExpanded = !state.collapsedCategories.has(categoryKey);
    const categoryIcon = group.name.includes('Kering') ? 'bahan%20kering-icon.png' : group.name.includes('Dairy') ? 'dairy-icon.png' : group.name.includes('Berry') ? 'buah-icon.png?v=2' : group.name.includes('Perasa') || group.name.includes('Topping') ? 'toping-icon.png' : null;
    const restockCount = group.materials.filter((material) => Number(material.current_stock) <= Number(material.minimum_stock)).length;
    const safeCount = group.materials.length - restockCount;
    const materials = group.materials.map((material) => {
      const isLow = Number(material.current_stock) <= Number(material.minimum_stock);
      return `<article class="category-material" data-category-material="${categoryKey}"${isExpanded ? '' : ' hidden'}><div class="category-material-top"><div><strong>${escapeHTML(material.name)}</strong><small>${escapeHTML(material.supplier_name)}</small></div><span class="badge ${isLow ? 'badge-alert' : 'badge-ok'}">${isLow ? 'Restock' : 'Aman'}</span></div><div class="category-material-stock"><strong>${Number(material.current_stock).toLocaleString('id-ID')}</strong><span>${escapeHTML(material.unit)} tersedia</span><small>Minimum ${Number(material.minimum_stock).toLocaleString('id-ID')} ${escapeHTML(material.unit)}</small></div><div class="material-actions"><button class="table-action edit-material" data-id="${material.id}">Edit bahan</button><button class="table-action edit-stock" data-id="${material.id}" data-name="${escapeHTML(material.name)}" data-stock="${material.current_stock}" data-unit="${escapeHTML(material.unit)}" title="Edit stok awal">Edit stok</button><button class="table-action delete-material" data-id="${material.id}" data-name="${escapeHTML(material.name)}" title="Hapus bahan">Hapus</button></div></article>`;
    }).join('');
    return `<section class="category-card${isExpanded ? ' expanded' : ''}"><button class="category-toggle" type="button" data-category="${categoryKey}" aria-expanded="${isExpanded}"><span class="category-symbol" aria-hidden="true">${categoryIcon ? `<img src="${categoryIcon}" alt="">` : '📦'}</span><span class="category-title"><strong>${escapeHTML(group.name)}</strong><small>${group.materials.length} bahan · ${restockCount} perlu restock · ${safeCount} stok aman</small></span><span class="category-chevron" aria-hidden="true">${isExpanded ? '−' : '+'}</span></button><div class="category-materials">${materials}</div></section>`;
  }).join('');
  const materialOptions = state.materials.map((material) => `<option value="${material.id}">${material.name} (${material.current_stock} ${material.unit})</option>`).join('');
  $('#material-select').innerHTML = '<option value="">Pilih bahan</option>' + materialOptions;
  $('#purchase-material-select').innerHTML = '<option value="">Pilih bahan</option>' + materialOptions;
}

$('#materials-table').addEventListener('click', (event) => {
  const toggle = event.target.closest('.category-toggle');
  if (!toggle) return;
  const categoryKey = toggle.dataset.category;
  const shouldExpand = toggle.getAttribute('aria-expanded') !== 'true';
  if (shouldExpand) state.collapsedCategories.delete(categoryKey);
  else state.collapsedCategories.add(categoryKey);
  toggle.setAttribute('aria-expanded', String(shouldExpand));
  toggle.querySelector('.category-chevron').textContent = shouldExpand ? '−' : '+';
  toggle.closest('.category-card').classList.toggle('expanded', shouldExpand);
  document.querySelectorAll(`[data-category-material="${categoryKey}"]`).forEach((row) => { row.hidden = !shouldExpand; });
});

function renderCategories() {
  const categoriesByName = new Map(state.categories.map((category) => [category.name.toLowerCase(), category]));
  const options = DEFAULT_CATEGORIES.map((name) => {
    const category = categoriesByName.get(name.toLowerCase());
    const value = category?.id || `new:${encodeURIComponent(name)}`;
    return `<option value="${value}">${escapeHTML(name)}</option>`;
  });
  state.categories
    .filter((category) => !DEFAULT_CATEGORIES.some((name) => name.toLowerCase() === category.name.toLowerCase()))
    .forEach((category) => options.push(`<option value="${category.id}">${escapeHTML(category.name)}</option>`));

  $('#material-category-select').innerHTML = '<option value="">Pilih kategori</option>' + options.join('') + '<option value="__new__">+ Kategori Baru</option>';
  $('#edit-material-category-select').innerHTML = '<option value="">Pilih kategori</option>' + options.join('');
}

async function createCategory(name) {
  const normalizedName = name.trim();
  const existing = state.categories.find((category) => category.name.toLowerCase() === normalizedName.toLowerCase());
  if (existing) return existing;

  let category;
  try {
    const created = await api('/material_categories', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ name: normalizedName })
    });
    category = Array.isArray(created) ? created[0] : created;
  } catch (error) {
    const matches = await api(`/material_categories?select=id,name&name=eq.${encodeURIComponent(normalizedName)}`);
    category = matches.find((item) => item.name.toLowerCase() === normalizedName.toLowerCase());
    if (!category) throw error;
  }

  if (!category) {
    const matches = await api(`/material_categories?select=id,name&name=eq.${encodeURIComponent(normalizedName)}`);
    category = matches.find((item) => item.name.toLowerCase() === normalizedName.toLowerCase());
  }
  if (!category) throw new Error('Kategori berhasil diproses tetapi tidak dapat ditemukan. Coba muat ulang halaman.');
  state.categories = [...state.categories, category];
  renderCategories();
  return category;
}

async function ensureDefaultSuppliers() {
  for (const supplierData of DEFAULT_SUPPLIERS) {
    const existing = state.suppliers.find((supplier) => supplier.name.toLowerCase() === supplierData.name.toLowerCase());
    if (existing) continue;

    const created = await api('/suppliers', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(supplierData)
    });

    const supplier = Array.isArray(created) ? created[0] : created;
    state.suppliers = [...state.suppliers, supplier];
  }
}

function renderSuppliers() {
  const suppliersByName = new Map(state.suppliers.map((supplier) => [supplier.name.toLowerCase(), supplier]));
  const defaultOptions = DEFAULT_SUPPLIERS.map((supplierData) => {
    const supplier = suppliersByName.get(supplierData.name.toLowerCase());
    const value = supplier?.id || `new:${encodeURIComponent(supplierData.name)}`;
    return `<option value="${value}">${supplierData.name}</option>`;
  });
  const customOptions = state.suppliers
    .filter((supplier) => !DEFAULT_SUPPLIERS.some((item) => item.name.toLowerCase() === supplier.name.toLowerCase()))
    .map((supplier) => `<option value="${supplier.id}">${supplier.name}</option>`);
  const supplierOptions = defaultOptions.join('') + customOptions.join('');
  $('#supplier-select').innerHTML = '<option value="">Belum dipilih</option>' + supplierOptions;
  $('#purchase-supplier-select').innerHTML = '<option value="">Pilih pemasok</option>' + supplierOptions;
}

function renderPurchaseOrders(orders, failed = false) {
  const table = $('#purchase-orders-table');
  if (failed) {
    table.innerHTML = '<tr><td colspan="7" class="empty">Tabel pesanan belum tersedia. Jalankan backend/schema.sql di Supabase.</td></tr>';
    return;
  }
  if (!orders.length) {
    table.innerHTML = '<tr><td colspan="7" class="empty">Belum ada pesanan bahan.</td></tr>';
    return;
  }
  table.innerHTML = orders.map((order) => `<tr><td>${dateLabel(order.order_date)}</td><td>${order.suppliers?.name || '-'}</td><td>${order.materials?.name || 'Bahan'}<small>${order.materials?.unit || ''}</small></td><td>${Number(order.quantity).toLocaleString('id-ID')} ${order.materials?.unit || ''}</td><td>${money(Number(order.quantity) * Number(order.unit_price))}</td><td><span class="badge ${order.status === 'Diterima' ? 'badge-ok' : 'badge-alert'}">${order.status}</span></td><td>${order.status === 'Dipesan' ? `<button class="table-action receive-order" data-id="${order.id}" data-material="${order.materials?.name || 'bahan'}">Tandai diterima</button>` : '—'}</td></tr>`).join('');
}

function renderActivity(items) {
  $('#activity-list').innerHTML = items.length ? items.map((item) => `<div class="activity-row"><span class="activity-mark ${item.transaction_type === 'IN' ? 'in' : 'out'}">${item.transaction_type === 'IN' ? '↓' : '↑'}</span><div><strong>${item.materials?.name || 'Bahan'}</strong><small>${item.notes || (item.transaction_type === 'IN' ? 'Bahan masuk' : 'Bahan keluar')} · ${dateLabel(item.transaction_date)}</small></div><strong class="activity-quantity ${item.transaction_type === 'IN' ? 'text-green' : 'text-red'}">${item.transaction_type === 'IN' ? '+' : '-'}${Number(item.quantity).toLocaleString('id-ID')} ${item.materials?.unit || ''}</strong><div class="activity-actions"><button class="icon-button edit-transaction" data-id="${item.id}" data-quantity="${item.quantity}" title="Edit jumlah stok" aria-label="Edit jumlah stok">✎ Edit</button><button class="icon-button delete-transaction" data-id="${item.id}" title="Hapus transaksi" aria-label="Hapus transaksi">× Hapus</button></div></div>`).join('') : '<p class="empty">Belum ada transaksi.</p>';
}

async function loadData() {
  const results = await Promise.allSettled([
    api('/materials?select=id,name,unit,minimum_stock,supplier_id,category_id,suppliers(id,name)&order=name.asc'),
    api('/suppliers?select=id,name&order=name.asc'),
    api('/stock_transactions?select=id,material_id,transaction_type,quantity,unit_price,notes,transaction_date,created_at,materials(name,unit)&order=created_at.desc'),
    api('/purchase_orders?select=id,supplier_id,material_id,quantity,unit_price,order_date,status,received_at,materials(name,unit),suppliers(name)&order=created_at.desc'),
    api('/material_categories?select=id,name&order=name.asc')
  ]);
  if (results[0].status === 'rejected') {
    $('#materials-table').innerHTML = '<p class="empty">Data bahan gagal dimuat dari Supabase. Data belum tentu terhapus; periksa koneksi, tabel materials, dan policy RLS lalu muat ulang.</p>';
    showToast(`Data bahan gagal dimuat: ${results[0].reason.message}`, true);
  }
  const materials = results[0].status === 'fulfilled' ? results[0].value : state.materials;
  const suppliers = results[1].status === 'fulfilled' ? results[1].value : [];
  const transactions = results[2].status === 'fulfilled' ? results[2].value : [];
  const purchaseOrders = results[3].status === 'fulfilled' ? results[3].value : state.purchaseOrders;
  if (results[4].status === 'fulfilled') state.categories = results[4].value;

  state.suppliers = suppliers;
  try {
    await ensureDefaultSuppliers();
  } catch (error) {
    showToast('Nama pemasok tetap tersedia dan akan dibuat saat disimpan.', true);
  }

  state.materials = materials.map((material) => ({
    ...material,
    supplier_name: material.suppliers?.name || '-',
    category_name: state.categories.find((category) => Number(category.id) === Number(material.category_id))?.name || 'Belum dikategorikan',
    current_stock: transactions.filter((item) => item.material_id === material.id).reduce((stock, item) => stock + (item.transaction_type === 'IN' ? Number(item.quantity) : -Number(item.quantity)), 0)
  }));

  $('#total-materials').textContent = state.materials.length;
  $('#low-stock').textContent = state.materials.filter((material) => material.current_stock <= Number(material.minimum_stock)).length;
  $('#inventory-value').textContent = money(transactions.reduce((total, item) => total + (item.transaction_type === 'IN' ? Number(item.quantity) * Number(item.unit_price) : 0), 0));
  const purchaseCosts = transactions.reduce((costs, item) => {
    if (item.transaction_type === 'IN') {
      const current = costs.get(item.material_id) || { quantity: 0, value: 0 };
      current.quantity += Number(item.quantity);
      current.value += Number(item.quantity) * Number(item.unit_price);
      costs.set(item.material_id, current);
    }
    return costs;
  }, new Map());
  const totalExpenses = transactions.reduce((total, item) => {
    if (item.transaction_type !== 'OUT') return total;
    const purchases = purchaseCosts.get(item.material_id);
    const averageCost = purchases?.quantity ? purchases.value / purchases.quantity : 0;
    return total + Number(item.quantity) * averageCost;
  }, 0);
  $('#expense-value').textContent = money(totalExpenses);
  if (results[0].status === 'fulfilled') renderMaterials();
  renderCategories();
  renderSuppliers();
  renderActivity(transactions.slice(0, 8));
  state.purchaseOrders = purchaseOrders;
  renderPurchaseOrders(purchaseOrders, results[3].status === 'rejected');
}

async function resolveSupplierId(value) {
  if (!value) return null;
  if (!value.startsWith('new:')) return Number(value);

  const supplierName = decodeURIComponent(value.slice(4));
  const supplierData = DEFAULT_SUPPLIERS.find((supplier) => supplier.name === supplierName);
  const created = await api('/suppliers', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(supplierData)
  });
  const supplier = Array.isArray(created) ? created[0] : created;
  state.suppliers = [...state.suppliers, supplier];
  return Number(supplier.id);
}

async function resolveCategoryId(value) {
  if (!value) return null;
  if (!value.startsWith('new:')) return Number(value);
  const categoryName = decodeURIComponent(value.slice(4));
  const category = await createCategory(categoryName);
  return Number(category.id);
}

$('#material-category-select').addEventListener('change', async (event) => {
  if (event.target.value !== '__new__') return;
  const categoryName = window.prompt('Masukkan nama kategori baru:');
  if (!categoryName?.trim()) {
    event.target.value = '';
    return;
  }
  try {
    const category = await createCategory(categoryName.trim());
    event.target.value = String(category.id);
    showToast('Kategori berhasil ditambahkan.');
  } catch (error) {
    event.target.value = '';
    showToast(error.message, true);
  }
});

$('#material-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const formData = Object.fromEntries(new FormData(event.target));
    const initialStock = Number(formData.initial_stock || 0);
    const unitPrice = Number(formData.unit_price || 0);
    const supplierId = await resolveSupplierId(formData.supplier_id);
    const categoryId = await resolveCategoryId(formData.category_id);

    const material = await api('/materials', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        name: formData.name.trim(),
        unit: formData.unit,
        minimum_stock: Number(formData.minimum_stock || 0),
        supplier_id: supplierId,
        category_id: categoryId
      })
    });

    const createdMaterial = Array.isArray(material) ? material[0] : material;

    if (initialStock > 0) {
      await api('/stock_transactions', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          material_id: createdMaterial.id,
          transaction_type: 'IN',
          quantity: initialStock,
          unit_price: unitPrice,
          notes: 'Stok awal bahan'
        })
      });
    }

    event.target.reset();
    showToast('Bahan berhasil ditambahkan.');
    await loadData();
  } catch (error) { showToast(error.message, true); }
});

$('#stock-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const formData = Object.fromEntries(new FormData(event.target));
    await api('/stock_transactions', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        material_id: Number(formData.material_id),
        transaction_type: formData.transaction_type,
        quantity: Number(formData.quantity),
        unit_price: 0,
        notes: formData.notes.trim() || 'Update stok'
      })
    });
    event.target.reset();
    showToast('Update stock berhasil disimpan.');
    await loadData();
  } catch (error) { showToast(error.message, true); }
});

$('#purchase-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const formData = Object.fromEntries(new FormData(event.target));
    const supplierId = await resolveSupplierId(formData.supplier_id);
    await api('/purchase_orders', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        supplier_id: supplierId,
        material_id: Number(formData.material_id),
        quantity: Number(formData.quantity),
        unit_price: Number(formData.unit_price),
        order_date: formData.order_date,
        status: 'Dipesan'
      })
    });
    event.target.reset();
    $('#purchase-order-date').value = new Date().toISOString().slice(0, 10);
    showToast('Pesanan bahan berhasil disimpan.');
    await loadData();
  } catch (error) { showToast(error.message, true); }
});

$('#purchase-orders-table').addEventListener('click', async (event) => {
  const receiveButton = event.target.closest('.receive-order');
  if (!receiveButton || !window.confirm(`Tandai pesanan ${receiveButton.dataset.material} sebagai diterima? Stok akan bertambah sesuai jumlah pesanan.`)) return;

  try {
    await api('/rpc/receive_purchase_order', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ p_order_id: Number(receiveButton.dataset.id) })
    });
    showToast('Pesanan diterima dan stok berhasil diperbarui.');
    await loadData();
  } catch (error) { showToast(error.message, true); }
});

$('#materials-table').addEventListener('click', async (event) => {
  const editMaterialButton = event.target.closest('.edit-material');
  const editButton = event.target.closest('.edit-stock');
  const deleteButton = event.target.closest('.delete-material');
  if (editMaterialButton) {
    const material = state.materials.find((item) => Number(item.id) === Number(editMaterialButton.dataset.id));
    if (!material) return;
    const form = $('#edit-material-form');
    renderCategories();
    renderSuppliers();
    form.elements.id.value = material.id;
    form.elements.name.value = material.name;
    form.elements.unit.value = material.unit;
    form.elements.minimum_stock.value = material.minimum_stock;
    $('#edit-material-category-select').value = material.category_id ? String(material.category_id) : '';
    $('#edit-material-supplier-select').innerHTML = $('#supplier-select').innerHTML;
    $('#edit-material-supplier-select').value = material.supplier_id ? String(material.supplier_id) : '';
    $('#edit-material-dialog').showModal();
    return;
  }
  if (!editButton && !deleteButton) return;

  try {
    if (editButton) {
      const targetStock = window.prompt(`Masukkan stok baru untuk ${editButton.dataset.name} (${editButton.dataset.unit}):`, editButton.dataset.stock);
      if (targetStock === null) return;
      const newStock = Number(targetStock);
      const currentStock = Number(editButton.dataset.stock);
      if (!Number.isFinite(newStock) || newStock < 0) {
        showToast('Stok harus berupa angka 0 atau lebih.', true);
        return;
      }
      const difference = newStock - currentStock;
      if (difference !== 0) {
        await api('/stock_transactions', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            material_id: Number(editButton.dataset.id),
            transaction_type: difference > 0 ? 'IN' : 'OUT',
            quantity: Math.abs(difference),
            unit_price: 0,
            notes: 'Penyesuaian stok awal'
          })
        });
      }
      showToast('Stok berhasil diperbarui.');
    } else if (window.confirm(`Hapus bahan "${deleteButton.dataset.name}" beserta seluruh riwayat stoknya?`)) {
      await api(`/materials?id=eq.${deleteButton.dataset.id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      showToast('Bahan dan riwayat stok berhasil dihapus.');
    } else return;
    await loadData();
  } catch (error) { showToast(error.message, true); }
});

$('#edit-material-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const formData = Object.fromEntries(new FormData(event.target));
    const categoryId = await resolveCategoryId(formData.category_id);
    const supplierId = await resolveSupplierId(formData.supplier_id);
    await api(`/materials?id=eq.${Number(formData.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        name: formData.name.trim(),
        unit: formData.unit,
        minimum_stock: Number(formData.minimum_stock),
        category_id: categoryId,
        supplier_id: supplierId
      })
    });
    $('#edit-material-dialog').close();
    showToast('Data bahan berhasil diperbarui.');
    await loadData();
  } catch (error) { showToast(error.message, true); }
});

$('#close-edit-material').addEventListener('click', () => $('#edit-material-dialog').close());
$('#cancel-edit-material').addEventListener('click', () => $('#edit-material-dialog').close());

$('#activity-list').addEventListener('click', async (event) => {
  const editButton = event.target.closest('.edit-transaction');
  const deleteButton = event.target.closest('.delete-transaction');
  const transactionId = editButton?.dataset.id || deleteButton?.dataset.id;
  if (!transactionId) return;

  try {
    if (editButton) {
      const quantity = window.prompt('Masukkan jumlah stok yang benar:', editButton.dataset.quantity);
      if (quantity === null) return;
      const parsedQuantity = Number(quantity);
      if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
        showToast('Jumlah stok harus lebih besar dari 0.', true);
        return;
      }
      await api(`/stock_transactions?id=eq.${transactionId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ quantity: parsedQuantity })
      });
      showToast('Jumlah stok berhasil diubah.');
    } else if (window.confirm('Hapus transaksi stok ini? Stok akan dihitung ulang.')) {
      await api(`/stock_transactions?id=eq.${transactionId}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      showToast('Transaksi stok berhasil dihapus.');
    } else return;
    await loadData();
  } catch (error) { showToast(error.message, true); }
});

$('#refresh-button').addEventListener('click', () => loadData().catch((error) => showToast(error.message, true)));
setupTabs();
$('#today').textContent = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date());
$('#purchase-order-date').value = new Date().toISOString().slice(0, 10);
loadData().catch((error) => showToast(`Backend belum terhubung: ${error.message}`, true));
