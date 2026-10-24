(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'stockwise-lite-v1';
  const initialProducts = [
    {id:1,name:'Wireless Mouse',sku:'ACC-001',category:'Electronics',qty:24,min:10,cost:450},
    {id:2,name:'USB-C Hub',sku:'ACC-002',category:'Electronics',qty:7,min:10,cost:1250},
    {id:3,name:'Notebook A5',sku:'STA-001',category:'Stationery',qty:68,min:15,cost:65},
    {id:4,name:'Ballpoint Pens (Pack)',sku:'STA-002',category:'Stationery',qty:4,min:10,cost:95},
    {id:5,name:'Desk Organizer',sku:'OFF-001',category:'Office supplies',qty:15,min:5,cost:320},
    {id:6,name:'Laptop Stand',sku:'ACC-003',category:'Electronics',qty:0,min:5,cost:890}
  ];
  let products = initialProducts;
  let history = [];
  let nextId = 7;
  let toastTimer;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.products) && Array.isArray(saved.history)) {
        products = saved.products;
        history = saved.history;
        nextId = Math.max(0, ...products.map(p => Number(p.id) || 0)) + 1;
      }
    } catch (err) {
      console.warn('Could not load saved inventory:', err);
    }
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({products, history}));
    } catch (err) {
      notify('Could not save changes in this browser.');
    }
  }
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
  const money = value => new Intl.NumberFormat('en-PH', {
    style:'currency', currency:'PHP', maximumFractionDigits:2
  }).format(Number(value) || 0);
  const status = p => p.qty === 0 ? 'Out of stock' : p.qty <= p.min ? 'Low stock' : 'In stock';
  const statusBadge = p => {
    const s = status(p);
    const cls = s === 'In stock' ? 'pill-ok' : s === 'Low stock' ? 'pill-low' : 'pill-out';
    return `<span class="pill ${cls}">${s}</span>`;
  };
  const totalValue = p => p.qty * p.cost;

  function notify(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }
  function logMovement(product, type, delta) {
    history.unshift({
      time: new Date().toLocaleString(),
      name: product.name,
      sku: product.sku,
      type,
      delta,
      qty: product.qty
    });
    history = history.slice(0, 500);
    saveState();
  }

  function productRow(p) {
    return `<tr>
      <td><div class="product-name">${escapeHtml(p.name)}</div><div class="product-sku">${escapeHtml(p.sku)}</div></td>
      <td>${escapeHtml(p.category)}</td>
      <td><strong>${p.qty.toLocaleString()}</strong></td>
      <td>${p.min.toLocaleString()}</td>
      <td>${money(p.cost)}</td>
      <td>${statusBadge(p)}</td>
      <td><button class="table-action" data-adjust="${p.id}">± Stock</button><button class="table-action" data-edit="${p.id}">Edit</button></td>
    </tr>`;
  }
  function makeTable(list) {
    if (!list.length) return '<div class="empty-state">No products found. Try a different search or add a product.</div>';
    return `<div class="table-wrap"><table><thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>QTY</th><th>MIN. STOCK</th><th>UNIT COST</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>${list.map(productRow).join('')}</tbody></table></div>`;
  }
  function getFilteredProducts() {
    const query = ($('product-search')?.value || '').trim().toLowerCase();
    const filter = $('status-filter')?.value || 'all';
    return products.filter(p =>
      `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(query) &&
      (filter === 'all' || status(p) === filter)
    );
  }

  function render() {
    const units = products.reduce((sum,p) => sum + p.qty, 0);
    const value = products.reduce((sum,p) => sum + totalValue(p), 0);
    const alerts = products.filter(p => status(p) !== 'In stock').length;
    $('metric-products').textContent = products.length.toLocaleString();
    $('metric-units').textContent = units.toLocaleString();
    $('metric-value').textContent = money(value);
    $('metric-alerts').textContent = alerts.toLocaleString();
    $('footer-products').textContent = `${products.length} products`;
    $('sidebar-status').textContent = alerts ? `${alerts} item(s) need attention` : 'All stock levels healthy';

    const distribution = [
      {name:'In stock',count:products.filter(p=>status(p)==='In stock').length,color:'#21865a'},
      {name:'Low stock',count:products.filter(p=>status(p)==='Low stock').length,color:'#e3a044'},
      {name:'Out of stock',count:products.filter(p=>status(p)==='Out of stock').length,color:'#dc625c'}
    ];
    $('distribution-bars').innerHTML = distribution.map(item => `
      <div><div class="bar-meta"><span>${item.name}</span><strong>${item.count} <span>products</span></strong></div>
      <div class="bar-track"><div class="bar-fill" style="width:${products.length ? item.count/products.length*100 : 0}%;background:${item.color}"></div></div></div>
    `).join('');
    $('recent-table').innerHTML = makeTable([...products].sort((a,b) => a.qty-b.qty).slice(0,5));
    const filtered = getFilteredProducts();
    $('products-table').innerHTML = makeTable(filtered);
    $('product-count').textContent = `${filtered.length} product${filtered.length === 1 ? '' : 's'}`;

    const categories = [...new Set(products.map(p => p.category))].sort((a,b)=>a.localeCompare(b));
    $('category-list').innerHTML = categories.length ? categories.map(category => {
      const list = products.filter(p => p.category === category);
      const qty = list.reduce((sum,p)=>sum+p.qty,0);
      const value = list.reduce((sum,p)=>sum+totalValue(p),0);
      return `<button class="category-card" data-category="${escapeHtml(category)}"><span class="category-icon">◫</span><h3>${escapeHtml(category)}</h3><p>${list.length} products · ${qty.toLocaleString()} units</p><p style="margin-top:6px">${money(value)} inventory value</p></button>`;
    }).join('') : '<div class="empty-state">No categories yet. Add a product to create one.</div>';

    $('activity-table').innerHTML = history.length ? `<div class="table-wrap"><table><thead><tr><th>TIME</th><th>PRODUCT</th><th>MOVEMENT</th><th>CHANGE</th><th>RESULTING QTY</th></tr></thead><tbody>${history.map(item => `<tr><td>${escapeHtml(item.time)}</td><td><div class="product-name">${escapeHtml(item.name)}</div><div class="product-sku">${escapeHtml(item.sku)}</div></td><td>${escapeHtml(item.type)}</td><td style="font-weight:700;color:${item.delta >= 0 ? '#21865a' : '#c84a43'}">${item.delta > 0 ? '+' : ''}${item.delta}</td><td>${item.qty}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No stock movements yet. Use the Stock button to record your first adjustment.</div>';
  }

  const pageDetails = {
    dashboard: ['Inventory overview','Here\\'s what\\'s happening with your stock today.','OVERVIEW'],
    products: ['Product catalog','Manage products, costs, stock levels, and reorder thresholds.','PRODUCTS'],
    categories: ['Product categories','Explore your inventory by product category.','CATEGORIES'],
    activity: ['Stock activity','Track stock changes and inventory adjustments.','STOCK ACTIVITY']
  };
  function goToPage(page) {
    Object.keys(pageDetails).forEach(key => {
      $(`page-${key}`).hidden = key !== page;
    });
    document.querySelectorAll('[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === page));
    $('page-title').textContent = pageDetails[page][0];
    $('page-description').textContent = pageDetails[page][1];
    $('breadcrumb').textContent = pageDetails[page][2];
    $('add-product-button').hidden = page === 'categories' || page === 'activity';
    $('mobile-nav').classList.remove('mobile-nav-open');
    render();
  }

  function closeModal() { $('modal-root').innerHTML = ''; }
  function showModal(title, content) {
    $('modal-root').innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><section class="modal-box" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-heading"><h2 id="modal-title">${title}</h2><button class="icon-button" id="close-modal" aria-label="Close dialog">✕</button></div>${content}</section></div>`;
    $('close-modal').addEventListener('click', closeModal);
    $('modal-backdrop').addEventListener('click', e => { if (e.target.id === 'modal-backdrop') closeModal(); });
    document.addEventListener('keydown', escapeModal, {once:true});
  }
  function escapeModal(e) { if (e.key === 'Escape') closeModal(); }

  function openProductForm(existing = null) {
    const isEdit = Boolean(existing);
    const categories = [...new Set(products.map(p=>p.category))];
    showModal(isEdit ? 'Edit product' : 'Add new product', `
      <form id="product-form">
        <div class="form-field"><label for="product-name">Product name *</label><input id="product-name" name="name" maxlength="100" required value="${escapeHtml(existing?.name || '')}" placeholder="e.g. Wireless Keyboard"></div>
        <div class="form-grid">
          <div class="form-field"><label for="product-sku">SKU / Code *</label><input id="product-sku" name="sku" maxlength="40" required value="${escapeHtml(existing?.sku || '')}" placeholder="e.g. ACC-004"></div>
          <div class="form-field"><label for="product-category">Category *</label><input id="product-category" name="category" list="category-options" maxlength="60" required value="${escapeHtml(existing?.category || '')}" placeholder="e.g. Electronics"><datalist id="category-options">${categories.map(c=>`<option value="${escapeHtml(c)}"></option>`).join('')}</datalist></div>
        </div>
        <div class="form-grid">
          <div class="form-field"><label for="product-qty">Quantity in stock *</label><input id="product-qty" name="qty" type="number" min="${isEdit ? existing.qty : 0}" step="1" required value="${existing?.qty ?? 0}"></div>
          <div class="form-field"><label for="product-min">Minimum stock *</label><input id="product-min" name="min" type="number" min="0" step="1" required value="${existing?.min ?? 5}"></div>
        </div>
        <div class="form-field"><label for="product-cost">Unit cost (PHP) *</label><input id="product-cost" name="cost" type="number" min="0" step="0.01" required value="${existing?.cost ?? 0}"></div>
        <p class="form-note">Quantities must be whole numbers. Unit cost is used to calculate inventory value. SKU codes must be unique.</p>
        <div class="modal-actions"><button type="button" class="button button-secondary" id="cancel-product">Cancel</button><button type="submit" class="button button-primary">${isEdit ? 'Save changes' : 'Add product'}</button></div>
      </form>`);
    $('cancel-product').addEventListener('click', closeModal);
    $('product-form').addEventListener('submit', event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      data.name = data.name.trim();
      data.sku = data.sku.trim();
      data.category = data.category.trim();
      data.qty = Number(data.qty);
      data.min = Number(data.min);
      data.cost = Number(data.cost);
      if (!data.name || !data.sku || !data.category || !Number.isInteger(data.qty) || !Number.isInteger(data.min) || data.qty < 0 || data.min < 0 || !Number.isFinite(data.cost) || data.cost < 0) {
        notify('Please check all product fields.'); return;
      }
      if (products.some(p => p.sku.toLowerCase() === data.sku.toLowerCase() && p.id !== existing?.id)) {
        notify('That SKU already exists.'); return;
      }
      if (isEdit) {
        const product = products.find(p => p.id === existing.id);
        const delta = data.qty - product.qty;
        Object.assign(product, data);
        if (delta !== 0) logMovement(product, delta > 0 ? 'Stock received' : 'Stock issued', delta);
      } else {
        const product = {...data, id:nextId++};
        products.unshift(product);
        logMovement(product, 'Initial stock', product.qty);
      }
      saveState(); closeModal(); render();
      notify(isEdit ? 'Product updated successfully.' : 'Product added successfully.');
    });
    $('product-name').focus();
  }

  function openStockForm(product = null) {
    if (!products.length) { notify('Add a product before updating stock.'); return; }
    if (!product) {
      showModal('Update stock', `<div class="form-field"><label for="choose-product">Select product</label><select id="choose-product" class="field">${products.map(p=>`<option value="${p.id}">${escapeHtml(p.name)} (${p.qty} units)</option>`).join('')}</select></div><div class="modal-actions"><button class="button button-secondary" id="cancel-stock">Cancel</button><button class="button button-primary" id="continue-stock">Continue →</button></div>`);
      $('cancel-stock').addEventListener('click', closeModal);
      $('continue-stock').addEventListener('click', () => {
        const selected = products.find(p => p.id === Number($('choose-product').value));
        if (selected) openStockForm(selected);
      });
      return;
    }
    showModal('Update stock', `
      <p style="font-size:12px;margin:0 0 13px">${escapeHtml(product.name)} <span class="muted">· ${escapeHtml(product.sku)}</span></p>
      <div class="current-stock"><span class="muted">Current quantity</span><strong>${product.qty} units</strong></div>
      <form id="stock-form">
        <div class="form-field"><label for="movement-type">Movement type</label><select id="movement-type" class="field"><option value="in">Stock received (+)</option><option value="out">Stock issued (−)</option><option value="set">Set exact quantity</option></select></div>
        <div class="form-field"><label id="quantity-label" for="movement-amount">Quantity to receive</label><input id="movement-amount" type="number" min="0" step="1" required value="1"></div>
        <p class="form-note">You cannot issue more units than are currently in stock.</p>
        <div class="modal-actions"><button type="button" class="button button-secondary" id="cancel-stock">Cancel</button><button type="submit" class="button button-primary">Save adjustment</button></div>
      </form>`);
    $('cancel-stock').addEventListener('click', closeModal);
    $('movement-type').addEventListener('change', () => {
      $('quantity-label').textContent = ({in:'Quantity to receive',out:'Quantity to issue',set:'New total quantity'})[$('movement-type').value];
    });
    $('stock-form').addEventListener('submit', event => {
      event.preventDefault();
      const amount = Number($('movement-amount').value);
      const type = $('movement-type').value;
      if (!Number.isInteger(amount) || amount < 0) { notify('Enter a valid whole number.'); return; }
      if (type === 'out' && amount > product.qty) { notify('Not enough stock available.'); return; }
      const delta = type === 'in' ? amount : type === 'out' ? -amount : amount - product.qty;
      product.qty += delta;
      logMovement(product, ({in:'Stock received',out:'Stock issued',set:'Quantity adjusted'})[type], delta);
      closeModal(); render(); notify('Stock updated successfully.');
    });
  }

  function exportCsv() {
    const rows = [
      ['SKU','Product','Category','Quantity','Minimum Stock','Unit Cost PHP','Total Value PHP','Status'],
      ...products.map(p=>[p.sku,p.name,p.category,p.qty,p.min,p.cost,totalValue(p).toFixed(2),status(p)])
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8;'}));
    const link = document.createElement('a');
    link.href = url; link.download = 'inventory-lite.csv'; link.style.display = 'none';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Inventory CSV exported.');
  }

  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => goToPage(button.dataset.page)));
  $('add-product-button').addEventListener('click', () => openProductForm());
  $('quick-add').addEventListener('click', () => openProductForm());
  $('quick-stock').addEventListener('click', () => openStockForm());
  $('quick-low').addEventListener('click', () => {
    goToPage('products');
    $('status-filter').value = 'Low stock';
    render();
    const lowAndOut = products.filter(p => status(p) !== 'In stock');
    $('products-table').innerHTML = makeTable(lowAndOut);
    $('product-count').textContent = `${lowAndOut.length} products need attention`;
  });
  $('view-all').addEventListener('click', () => goToPage('products'));
  $('product-search').addEventListener('input', render);
  $('status-filter').addEventListener('change', render);
  $('export-button').addEventListener('click', exportCsv);
  $('mobile-menu').addEventListener('click', () => $('mobile-nav').classList.toggle('mobile-nav-open'));

  document.addEventListener('click', event => {
    const adjustButton = event.target.closest('[data-adjust]');
    const editButton = event.target.closest('[data-edit]');
    const categoryButton = event.target.closest('[data-category]');
    if (adjustButton) {
      const product = products.find(p => p.id === Number(adjustButton.dataset.adjust));
      if (product) openStockForm(product);
    }
    if (editButton) {
      const product = products.find(p => p.id === Number(editButton.dataset.edit));
      if (product) openProductForm(product);
    }
    if (categoryButton) {
      goToPage('products');
      $('product-search').value = categoryButton.dataset.category;
      $('status-filter').value = 'all';
      render();
      $('product-search').value = '';
      const list = products.filter(p => p.category === categoryButton.dataset.category);
      $('products-table').innerHTML = makeTable(list);
      $('product-count').textContent = `${list.length} products in ${categoryButton.dataset.category}`;
    }
  });

  loadState();
  render();
})();
