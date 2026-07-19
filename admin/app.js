/* ==========================================================================
   Pharmaline Admin Dashboard — with email/password login
   ========================================================================== */

const WORKER_URL = "https://pharmaline-oauth.pharamaline3.workers.dev";

let state = {
  products: [],
  sha: null,
  activeCategory: "all",
  searchTerm: "",
  pendingImages: [],
  removedImages: [],
  scanner: null,
  isOwner: false,
};

function firstImage(p) {
  if (p.images && p.images.length) return "../" + p.images[0];
  return "https://placehold.co/100x100/E8F1F8/2E6FA3?text=No+Photo";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sessionToken() {
  return sessionStorage.getItem("session_token");
}

async function api(path, body) {
  const res = await fetch(WORKER_URL + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken() ? { Authorization: `Bearer ${sessionToken()}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/* ---------------- Auth / Login screen ---------------- */
function showApp() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("app").style.display = "block";
  document.getElementById("manageUsersBtn").style.display = state.isOwner ? "inline-block" : "none";
}
function showLogin(message) {
  document.getElementById("loginScreen").style.display = "flex";
  document.getElementById("app").style.display = "none";
  if (message) document.getElementById("loginStatus").textContent = message;
}

let isSignupMode = false;

async function checkAuthStatus() {
  try {
    const data = await api("/auth-status");
    isSignupMode = !data.hasOwner;
    if (isSignupMode) {
      document.getElementById("loginTitle").textContent = "Create Your Admin Account";
      document.getElementById("loginSubtitle").textContent = "This will be the owner account — you can add more logins later.";
      document.getElementById("loginSubmitBtn").textContent = "Create Account";
    } else {
      document.getElementById("loginTitle").textContent = "Pharmaline Admin";
      document.getElementById("loginSubtitle").textContent = "Sign in to manage your catalog.";
      document.getElementById("loginSubmitBtn").textContent = "Log In";
    }
  } catch {}
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const statusEl = document.getElementById("loginStatus");
  statusEl.textContent = "Please wait...";
  try {
    if (isSignupMode) {
      await api("/auth-signup-owner", { email, password });
    }
    const data = await api("/auth-login", { email, password });
    sessionStorage.setItem("session_token", data.token);
    state.isOwner = data.isOwner;
    statusEl.textContent = "";
    showApp();
    await refreshProducts();
  } catch (err) {
    statusEl.textContent = err.message;
  }
});

async function verifyAndInit() {
  const token = sessionToken();
  if (!token) {
    await checkAuthStatus();
    return showLogin();
  }
  try {
    const data = await api("/auth-verify");
    state.isOwner = data.isOwner;
    showApp();
    await refreshProducts();
  } catch {
    sessionStorage.removeItem("session_token");
    await checkAuthStatus();
    showLogin("Your session expired — please log in again.");
  }
}

document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem("session_token");
  checkAuthStatus().then(() => showLogin());
});

/* ---------------- Manage Users ---------------- */
document.getElementById("manageUsersBtn").addEventListener("click", openUsersModal);

async function openUsersModal() {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-box">
        <h2>Manage Users</h2>
        <div id="usersList" style="margin-bottom:20px;">Loading...</div>
        <div class="form-row">
          <label>Add New User</label>
          <div class="two-col">
            <input type="email" id="newUserEmail" placeholder="Email address">
            <input type="text" id="newUserPassword" placeholder="Temporary password">
          </div>
          <button class="btn-primary" id="addUserBtn" style="margin-top:10px;">Add User</button>
        </div>
        <p class="status-msg" id="usersStatus"></p>
        <div class="modal-actions">
          <div></div>
          <button class="btn-secondary" id="closeUsersBtn">Close</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById("closeUsersBtn").addEventListener("click", closeModal);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });
  document.getElementById("addUserBtn").addEventListener("click", async () => {
    const email = document.getElementById("newUserEmail").value.trim();
    const password = document.getElementById("newUserPassword").value;
    const statusEl = document.getElementById("usersStatus");
    try {
      await api("/users-add", { email, password });
      statusEl.className = "status-msg success";
      statusEl.textContent = "User added!";
      loadUsersList();
    } catch (err) {
      statusEl.className = "status-msg error";
      statusEl.textContent = err.message;
    }
  });
  loadUsersList();
}

async function loadUsersList() {
  const listEl = document.getElementById("usersList");
  try {
    const data = await api("/users-list");
    listEl.innerHTML = data.users
      .map(
        (u) => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #DCE4EC;">
        <span>${escapeHtml(u.email)} ${u.isOwner ? "<strong>(Owner)</strong>" : ""}</span>
        ${
          !u.isOwner
            ? `<div style="display:flex; gap:8px;">
                <button class="btn-secondary" data-action="reset" data-email="${escapeHtml(u.email)}">Reset Password</button>
                <button class="btn-secondary" data-action="remove" data-email="${escapeHtml(u.email)}" style="border-color:#C0392B;color:#C0392B;">Remove</button>
              </div>`
            : ""
        }
      </div>`
      )
      .join("");

    listEl.querySelectorAll('[data-action="remove"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm(`Remove access for ${btn.dataset.email}?`)) return;
        await api("/users-remove", { email: btn.dataset.email });
        loadUsersList();
      });
    });
    listEl.querySelectorAll('[data-action="reset"]').forEach((btn) => {
      btn.addEventListener("click", async () => {
        const newPassword = prompt(`New temporary password for ${btn.dataset.email}:`);
        if (!newPassword) return;
        try {
          await api("/users-change-password", { email: btn.dataset.email, newPassword });
          alert("Password updated.");
        } catch (err) {
          alert(err.message);
        }
      });
    });
  } catch (err) {
    listEl.textContent = "Error loading users: " + err.message;
  }
}

/* ---------------- Spinner ---------------- */
function setBusy(isBusy) {
  document.getElementById("spinner").style.display = isBusy ? "flex" : "none";
}

/* ---------------- Categories ---------------- */
const ADMIN_CATEGORIES = [
  { key: "baby", label: "Baby" },
  { key: "health_beauty", label: "Health & Beauty" },
  { key: "grocery", label: "Grocery" },
  { key: "drinks", label: "Drinks" },
  { key: "cleaning", label: "Cleaning" },
  { key: "household", label: "Household" },
  { key: "laundry_fabric", label: "Laundry & Fabric Care" },
  { key: "paper", label: "Paper Products" },
  { key: "bags_wraps", label: "Bags & Wraps" },
  { key: "air_freshener", label: "Air Freshener" },
];

/* ---------------- Load + render dashboard ---------------- */
async function refreshProducts() {
  setBusy(true);
  try {
    const data = await api("/products-get");
    const previewMap = {};
    state.products.forEach((p) => {
      if (p._localPreview) previewMap[p.sku] = p._localPreview;
    });
    data.products.forEach((p) => {
      if (previewMap[p.sku]) p._localPreview = previewMap[p.sku];
    });
    state.products = data.products;
    state.sha = data.sha;
    renderStats();
    renderFilterTabs();
    renderGrid();
  } catch (err) {
    alert("Error loading products: " + err.message);
  }
  setBusy(false);
}

function renderStats() {
  const p = state.products;
  document.getElementById("statsRow").innerHTML = `
    <div class="stat-card"><div class="num">${p.length}</div><div class="label">Total Products</div></div>
    <div class="stat-card"><div class="num">${p.filter((x) => x.sale).length}</div><div class="label">On Sale</div></div>
    <div class="stat-card"><div class="num">${new Set(p.map((x) => x.category)).size}</div><div class="label">Categories</div></div>
  `;
}

function renderFilterTabs() {
  const tabs = [{ key: "all", label: "All" }, { key: "__sale__", label: "🔥 On Sale" }, ...ADMIN_CATEGORIES];
  const wrap = document.getElementById("filterTabs");
  wrap.innerHTML = "";
  tabs.forEach((tab) => {
    const btn = document.createElement("button");
    btn.textContent = tab.label;
    btn.className = state.activeCategory === tab.key ? "active" : "";
    btn.addEventListener("click", () => {
      state.activeCategory = tab.key;
      renderFilterTabs();
      renderGrid();
    });
    wrap.appendChild(btn);
  });
}

function renderGrid() {
  const grid = document.getElementById("productGrid");
  const term = state.searchTerm.toLowerCase();
  const filtered = state.products.filter((p) => {
    const catOk =
      state.activeCategory === "all" ||
      (state.activeCategory === "__sale__" ? p.sale === true : p.category === state.activeCategory);
    if (!catOk) return false;
    if (!term) return true;
    return (
      (p.name_en || "").toLowerCase().includes(term) ||
      String(p.sku || "").toLowerCase().includes(term) ||
      String(p.barcode || "").toLowerCase().includes(term)
    );
  });

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-note">No products found. Click "+ Add Product" to create your first one.</div>`;
    return;
  }

  grid.innerHTML = filtered
    .map((p) => {
      const img = p._localPreview || (p.images && p.images[0] ? "../" + p.images[0] + "?t=" + Date.now() : "");
      return `
      <div class="admin-product-card" data-sku="${p.sku}">
        <div class="admin-product-card__img">
          ${img ? `<img src="${img}" alt="">` : ""}
        </div>
        <div class="admin-product-card__body">
          <div class="admin-product-card__sku">SKU #${p.sku}</div>
          <div class="admin-product-card__name">${p.name_en || "(untitled)"}</div>
          <span class="admin-product-card__tag">${p.category || ""}</span>
          ${p.sale ? `<span class="admin-product-card__tag sale">Sale</span>` : ""}
        </div>
      </div>`;
    })
    .join("");

  grid.querySelectorAll(".admin-product-card").forEach((card) => {
    card.addEventListener("click", () => {
      const sku = card.dataset.sku;
      const product = state.products.find((p) => String(p.sku) === String(sku));
      openProductModal(product);
    });
  });
}

document.getElementById("searchInput").addEventListener("input", (e) => {
  state.searchTerm = e.target.value.trim();
  renderGrid();
});

document.getElementById("addProductBtn").addEventListener("click", () => openProductModal(null));

document.getElementById("enrichAllBtn").addEventListener("click", openEnrichModal);

let enrichShouldStop = false;
let enrichStagedUpdates = {};

function openEnrichModal() {
  enrichShouldStop = false;
  enrichStagedUpdates = {};
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-box" style="max-width:700px;">
        <h2>✨ AI Enrich All Products</h2>
        <p style="color:#5B6672; font-size:0.9rem;">
          This organizes every product: it never deletes anything — it copies your full original product text into
          the description if that's empty, pulls out size/unit info from the name, and translates anything still
          missing into French. Existing data is never overwritten. You can stop anytime and apply whatever's ready.
        </p>
        <div id="enrichCounters" style="display:flex; gap:16px; margin:16px 0; font-size:0.9rem;">
          <span>Processed: <strong id="enrichProcessed">0</strong> / ${state.products.length}</span>
          <span style="color:#2F8F76;">Updated: <strong id="enrichUpdated">0</strong></span>
          <span style="color:#5B6672;">Skipped: <strong id="enrichSkipped">0</strong></span>
        </div>
        <div id="enrichLog" style="height:200px; overflow-y:auto; background:#F7F9FB; border:1px solid #DCE4EC; border-radius:8px; padding:12px; font-size:0.82rem; font-family:monospace;"></div>
        <div id="enrichPreview" style="display:none; margin-top:16px; border:1px solid #DCE4EC; border-radius:8px; padding:14px;"></div>
        <div class="modal-actions">
          <div><button class="btn-secondary" id="enrichStopBtn" style="border-color:#C0392B;color:#C0392B;">Stop</button></div>
          <div style="display:flex; gap:10px;">
            <button class="btn-secondary" id="enrichPreviewBtn" style="display:none;">See Example (Before / After)</button>
            <button class="btn-secondary" id="enrichCloseBtn">Close</button>
            <button class="btn-primary" id="enrichApplyBtn" disabled>Apply All Changes</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById("enrichStopBtn").addEventListener("click", () => (enrichShouldStop = true));
  document.getElementById("enrichCloseBtn").addEventListener("click", () => {
    enrichShouldStop = true;
    closeModal();
  });
  document.getElementById("enrichApplyBtn").addEventListener("click", applyEnrichChanges);
  document.getElementById("enrichPreviewBtn").addEventListener("click", showEnrichExample);
  runEnrichment();
}

function enrichLog(msg) {
  const log = document.getElementById("enrichLog");
  if (!log) return;
  log.innerHTML += msg + "<br>";
  log.scrollTop = log.scrollHeight;
}

const UNIT_PATTERN = /(\d+(?:\.\d+)?)\s?(ml|mL|L|l|kg|g|oz|ct|Ct|CT|count|Count)\b/;

function extractUnitFromName(name) {
  const m = name.match(UNIT_PATTERN);
  if (!m) return null;
  let unit = m[2].toLowerCase();
  if (unit === "l") unit = "L";
  if (unit === "count" || unit === "ct") unit = "ct";
  return { size: m[1], unit };
}

async function runEnrichment() {
  let processed = 0;
  let updated = 0;
  let skipped = 0;

  for (const p of state.products) {
    if (enrichShouldStop) {
      enrichLog(`<span style="color:#C0392B;">Stopped by user.</span>`);
      break;
    }
    processed++;
    document.getElementById("enrichProcessed").textContent = processed;

    const changed = {};

    if (!p.description_en || !p.description_en.trim()) {
      changed.description_en = p.name_en;
    }

    if (!p.unit_size || !p.unit_type) {
      const found = extractUnitFromName(p.name_en || "");
      if (found) {
        if (!p.unit_size) changed.unit_size = found.size;
        if (!p.unit_type) changed.unit_type = found.unit;
      }
    }

    try {
      if (!p.name_fr || !p.name_fr.trim()) {
        const res = await api("/translate", { text: p.name_en });
        if (res.translated) changed.name_fr = res.translated;
      }
      const descForTranslation = changed.description_en || p.description_en;
      if (descForTranslation && (!p.description_fr || !p.description_fr.trim())) {
        const res2 = await api("/translate", { text: descForTranslation });
        if (res2.translated) changed.description_fr = res2.translated;
      }
    } catch {}

    if (Object.keys(changed).length) {
      enrichStagedUpdates[p.sku] = changed;
      updated++;
      document.getElementById("enrichUpdated").textContent = updated;
      enrichLog(`✅ #${escapeHtml(p.sku)} ${escapeHtml((p.name_en || "").slice(0, 40))} — organized`);
    } else {
      skipped++;
      document.getElementById("enrichSkipped").textContent = skipped;
      enrichLog(`— #${escapeHtml(p.sku)} already complete`);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  enrichLog(`<strong>Done. ${Object.keys(enrichStagedUpdates).length} products have suggested updates ready.</strong>`);
  document.getElementById("enrichApplyBtn").disabled = Object.keys(enrichStagedUpdates).length === 0;
  document.getElementById("enrichPreviewBtn").style.display = Object.keys(enrichStagedUpdates).length ? "inline-block" : "none";
}

let enrichExampleIndex = 0;
function showEnrichExample() {
  const skus = Object.keys(enrichStagedUpdates);
  if (!skus.length) return;
  const sku = skus[enrichExampleIndex % skus.length];
  enrichExampleIndex++;
  const p = state.products.find((x) => String(x.sku) === String(sku));
  const changes = enrichStagedUpdates[sku];

  const rows = Object.keys(changes)
    .map((field) => {
      const before = p[field] || "(empty)";
      const after = changes[field];
      const label = { description_en: "Description (EN)", description_fr: "Description (FR)", name_fr: "Name (FR)", unit_size: "Size", unit_type: "Unit" }[field] || field;
      return `
        <div style="margin-bottom:12px;">
          <div style="font-weight:700; font-size:0.85rem; color:#0F2E4C;">${escapeHtml(label)}</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:4px;">
            <div style="background:#F9E4E1; padding:8px 10px; border-radius:6px; font-size:0.85rem;"><strong>Before:</strong> ${escapeHtml(String(before))}</div>
            <div style="background:#E1F5EA; padding:8px 10px; border-radius:6px; font-size:0.85rem;"><strong>After:</strong> ${escapeHtml(String(after))}</div>
          </div>
        </div>`;
    })
    .join("");

  const preview = document.getElementById("enrichPreview");
  preview.style.display = "block";
  preview.innerHTML = `
    <div style="font-weight:700; margin-bottom:10px;">Example: SKU #${escapeHtml(sku)} — ${escapeHtml(p.name_en)}</div>
    ${rows}
    <div style="text-align:right; margin-top:8px;">
      <button class="btn-secondary" onclick="document.getElementById('enrichPreviewBtn').click()">Show Another Example</button>
    </div>
  `;
}

async function applyEnrichChanges() {
  setBusy(true);
  try {
    state.products = state.products.map((p) => {
      const changes = enrichStagedUpdates[p.sku];
      if (!changes) return p;
      const updated = { ...p, ...changes };
      updated.name = { en: updated.name_en, fr: updated.name_fr };
      updated.description = { en: updated.description_en, fr: updated.description_fr };
      return updated;
    });
    const cleanProducts = state.products.map(({ _localPreview, ...rest }) => rest);
    const saveRes = await api("/products-save", {
      products: cleanProducts,
      sha: state.sha,
      message: `AI-enrich ${Object.keys(enrichStagedUpdates).length} products`,
    });
    state.sha = saveRes.sha;
    renderGrid();
    alert(`Applied! ${Object.keys(enrichStagedUpdates).length} products updated in one save.`);
    closeModal();
  } catch (err) {
    alert("Error saving changes: " + err.message);
  }
  setBusy(false);
}

document.getElementById("clearSalesBtn").addEventListener("click", async () => {
  const saleCount = state.products.filter((p) => p.sale).length;
  if (!saleCount) return alert("No products are currently marked as Special.");
  if (!confirm(`Remove the Special/Sale flag from all ${saleCount} products? This cannot be undone.`)) return;
  setBusy(true);
  try {
    const updated = state.products.map((p) => ({ ...p, sale: false }));
    const cleanProducts = updated.map(({ _localPreview, ...rest }) => rest);
    const saveRes = await api("/products-save", {
      products: cleanProducts,
      sha: state.sha,
      message: "Clear all sale flags",
    });
    state.sha = saveRes.sha;
    state.products = updated;
    renderStats();
    renderGrid();
    alert("Done! All Specials have been cleared.");
  } catch (err) {
    alert("Error: " + err.message);
  }
  setBusy(false);
});

document.getElementById("viewProductsBtn").addEventListener("click", () => {
  document.getElementById("viewProductsBtn").classList.add("active");
  document.getElementById("viewCustomersBtn").classList.remove("active");
  document.getElementById("viewQuotesBtn").classList.remove("active");
  document.getElementById("viewMessagesBtn").classList.remove("active");
  document.getElementById("viewInvoicesBtn").classList.remove("active");
  document.getElementById("productsView").style.display = "block";
  document.getElementById("customersView").style.display = "none";
  document.getElementById("quotesView").style.display = "none";
  document.getElementById("messagesView").style.display = "none";
  document.getElementById("invoicesView").style.display = "none";
});
document.getElementById("viewCustomersBtn").addEventListener("click", () => {
  document.getElementById("viewCustomersBtn").classList.add("active");
  document.getElementById("viewProductsBtn").classList.remove("active");
  document.getElementById("viewQuotesBtn").classList.remove("active");
  document.getElementById("viewMessagesBtn").classList.remove("active");
  document.getElementById("viewInvoicesBtn").classList.remove("active");
  document.getElementById("productsView").style.display = "none";
  document.getElementById("customersView").style.display = "block";
  document.getElementById("quotesView").style.display = "none";
  document.getElementById("messagesView").style.display = "none";
  document.getElementById("invoicesView").style.display = "none";
  refreshCustomers();
});
document.getElementById("viewMessagesBtn").addEventListener("click", () => {
  document.getElementById("viewMessagesBtn").classList.add("active");
  document.getElementById("viewProductsBtn").classList.remove("active");
  document.getElementById("viewCustomersBtn").classList.remove("active");
  document.getElementById("viewQuotesBtn").classList.remove("active");
  document.getElementById("viewInvoicesBtn").classList.remove("active");
  document.getElementById("productsView").style.display = "none";
  document.getElementById("customersView").style.display = "none";
  document.getElementById("quotesView").style.display = "none";
  document.getElementById("messagesView").style.display = "block";
  document.getElementById("invoicesView").style.display = "none";
  refreshMessages();
});
document.getElementById("viewInvoicesBtn").addEventListener("click", () => {
  document.getElementById("viewInvoicesBtn").classList.add("active");
  document.getElementById("viewProductsBtn").classList.remove("active");
  document.getElementById("viewCustomersBtn").classList.remove("active");
  document.getElementById("viewQuotesBtn").classList.remove("active");
  document.getElementById("viewMessagesBtn").classList.remove("active");
  document.getElementById("productsView").style.display = "none";
  document.getElementById("customersView").style.display = "none";
  document.getElementById("quotesView").style.display = "none";
  document.getElementById("messagesView").style.display = "none";
  document.getElementById("invoicesView").style.display = "block";
  refreshInvoices();
});
document.getElementById("viewQuotesBtn").addEventListener("click", () => {
  document.getElementById("viewQuotesBtn").classList.add("active");
  document.getElementById("viewProductsBtn").classList.remove("active");
  document.getElementById("viewCustomersBtn").classList.remove("active");
  document.getElementById("viewMessagesBtn").classList.remove("active");
  document.getElementById("viewInvoicesBtn").classList.remove("active");
  document.getElementById("productsView").style.display = "none";
  document.getElementById("customersView").style.display = "none";
  document.getElementById("quotesView").style.display = "block";
  document.getElementById("messagesView").style.display = "none";
  document.getElementById("invoicesView").style.display = "none";
  refreshQuotes();
});
document.getElementById("addCustomerBtn").addEventListener("click", () => openCustomerModal(null));
document.getElementById("customerSearchInput").addEventListener("input", (e) => {
  state.customerSearchTerm = e.target.value.trim().toLowerCase();
  renderCustomerList();
});

/* ---------------- Add / Edit modal ---------------- */
function nextSku() {
  const nums = state.products.map((p) => parseInt(p.sku, 10)).filter((n) => !isNaN(n));
  if (!nums.length) return "1001";
  return String(Math.max(...nums) + 1);
}

function openProductModal(existing) {
  const isEdit = !!existing;
  const product = existing || {
    sku: nextSku(),
    category: "baby",
    name_en: "",
    name_fr: "",
    description_en: "",
    description_fr: "",
    unit_size: "",
    unit_type: "ml",
    case_qty: "",
    pallet_qty: "",
    sale: false,
    images: [],
    barcode: "",
  };

  state.pendingImages = [];
  state.removedImages = [];
  state.currentProductImages = product.images || [];

  const catOptions = ADMIN_CATEGORIES.map((c) => `<option value="${c.key}">${c.label}</option>`).join("");

  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-box">
        <h2>${isEdit ? "Edit Product" : "Add Product"} — SKU #${product.sku}</h2>

        <div class="form-row">
          <label>Barcode Number</label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="f_barcode" placeholder="Scan or type barcode number" style="flex:1;">
            <button class="btn-secondary" id="scanBarcodeBtn" type="button">📷 Scan</button>
            <button class="btn-secondary" id="lookupBarcodeBtn" type="button">Look Up</button>
          </div>
          <div id="scannerBox" style="display:none; margin-top:10px;">
            <div id="scannerReader" style="width:100%; max-width:400px;"></div>
            <button class="btn-secondary" id="stopScanBtn" type="button" style="margin-top:8px;">Stop Scanning</button>
          </div>
        </div>

        <div class="form-row">
          <label>Product Photos (front and back of package)</label>
          <div class="image-drop" id="imageDrop">Click to choose front + back photos from your computer</div>
          <input type="file" id="imageInput" accept="image/*" multiple style="display:none;">
          <div class="image-preview-row" id="imagePreviewRow"></div>
          <button class="btn-autofill" id="autofillBtn" style="display:none;">✨ Auto-fill details from photos</button>
        </div>

        <div class="form-row">
          <label>Category</label>
          <select id="f_category">${catOptions}</select>
        </div>

        <div class="form-row">
          <label>Product Name (English)</label>
          <input type="text" id="f_name_en">
        </div>
        <div class="form-row">
          <label>Product Name (French) <button class="btn-translate" id="translateNameBtn" type="button">Translate →</button></label>
          <input type="text" id="f_name_fr">
        </div>

        <div class="form-row">
          <label>Description (English)</label>
          <textarea id="f_description_en"></textarea>
        </div>
        <div class="form-row">
          <label>Description (French) <button class="btn-translate" id="translateDescBtn" type="button">Translate →</button></label>
          <textarea id="f_description_fr"></textarea>
        </div>

        <div class="two-col">
          <div class="form-row">
            <label>Size / Amount</label>
            <input type="text" id="f_unit_size" placeholder="e.g. 250">
          </div>
          <div class="form-row">
            <label>Unit</label>
            <select id="f_unit_type">
              <option value="ml">ml</option>
              <option value="L">L</option>
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="oz">oz</option>
              <option value="ct">ct</option>
              <option value="capsules">capsules</option>
              <option value="tablets">tablets</option>
              <option value="units">units</option>
            </select>
          </div>
        </div>

        <div class="two-col">
          <div class="form-row">
            <label>Units per Case</label>
            <input type="number" id="f_case_qty">
          </div>
          <div class="form-row">
            <label>Cases per Pallet</label>
            <input type="number" id="f_pallet_qty">
          </div>
        </div>

        <div class="form-row">
          <label><input type="checkbox" id="f_sale" style="width:auto;"> Mark as Special / On Sale</label>
        </div>

        <div class="form-row" style="background:#F7F9FB; border:1px solid #DCE4EC; border-radius:10px; padding:16px;">
          <label style="margin-bottom:10px;">🔒 Private Info (never shown to customers)</label>
          <label style="font-weight:400;"><input type="checkbox" id="f_in_stock" style="width:auto;" checked> In Stock</label>
          <div class="two-col" style="margin-top:12px;">
            <div class="form-row">
              <label>Cases in Stock</label>
              <input type="number" id="f_stock_cases" placeholder="e.g. 40">
            </div>
            <div class="form-row">
              <label>Pallets in Stock</label>
              <input type="number" id="f_stock_pallets" placeholder="e.g. 3">
            </div>
          </div>
          <div class="form-row">
            <label>Cost Price (per unit)</label>
            <input type="text" id="f_cost_price" placeholder="e.g. 4.25">
          </div>
        </div>

        <p class="status-msg" id="modalStatus"></p>

        <div class="modal-actions">
          <div>
            ${isEdit ? `<button class="btn-secondary" id="deleteBtn" style="border-color:#C0392B;color:#C0392B;">Delete Product</button>` : ""}
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn-secondary" id="cancelBtn">Cancel</button>
            <button class="btn-primary" id="saveBtn">Save Product</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("f_barcode").value = product.barcode || "";
  document.getElementById("f_category").value = product.category;
  document.getElementById("f_name_en").value = product.name_en || "";
  document.getElementById("f_name_fr").value = product.name_fr || "";
  document.getElementById("f_description_en").value = product.description_en || "";
  document.getElementById("f_description_fr").value = product.description_fr || "";
  document.getElementById("f_unit_size").value = product.unit_size || "";
  document.getElementById("f_unit_type").value = product.unit_type || "ml";
  document.getElementById("f_case_qty").value = product.case_qty || "";
  document.getElementById("f_pallet_qty").value = product.pallet_qty || "";
  document.getElementById("f_sale").checked = !!product.sale;

  document.getElementById("f_in_stock").checked = true;
  document.getElementById("f_stock_cases").value = "";
  document.getElementById("f_stock_pallets").value = "";
  document.getElementById("f_cost_price").value = "";
  if (isEdit) loadPrivateData(product.sku);

  if (product.images && product.images.length) {
    renderExistingImagePreviews(product.images);
    document.getElementById("autofillBtn").style.display = "block";
  }

  document.getElementById("imageDrop").addEventListener("click", () => {
    document.getElementById("imageInput").click();
  });
  document.getElementById("imageInput").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const base64 = await fileToBase64(file);
      state.pendingImages.push({ file, base64, mime: file.type });
    }
    renderPendingImagePreviews();
    document.getElementById("autofillBtn").style.display = state.pendingImages.length ? "block" : "none";
  });

  document.getElementById("translateNameBtn").addEventListener("click", () =>
    translateField("f_name_en", "f_name_fr", "translateNameBtn")
  );
  document.getElementById("translateDescBtn").addEventListener("click", () =>
    translateField("f_description_en", "f_description_fr", "translateDescBtn")
  );

  document.getElementById("autofillBtn").addEventListener("click", runAutofill);
  document.getElementById("lookupBarcodeBtn").addEventListener("click", runBarcodeLookup);
  document.getElementById("scanBarcodeBtn").addEventListener("click", startBarcodeScanner);
  document.getElementById("stopScanBtn").addEventListener("click", stopBarcodeScanner);

  document.getElementById("cancelBtn").addEventListener("click", closeModal);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });

  if (isEdit) {
    document.getElementById("deleteBtn").addEventListener("click", () => deleteProduct(product.sku));
  }

  document.getElementById("saveBtn").addEventListener("click", () => saveProduct(product.sku, isEdit));
}

function closeModal() {
  stopBarcodeScanner();
  document.getElementById("modalRoot").innerHTML = "";
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderPendingImagePreviews() {
  const row = document.getElementById("imagePreviewRow");
  row.innerHTML = state.pendingImages.map((img) => `<img src="data:${img.mime};base64,${img.base64}">`).join("");
}

function renderExistingImagePreviews(paths) {
  const row = document.getElementById("imagePreviewRow");
  row.innerHTML = paths
    .map(
      (p) => `
    <div class="image-thumb-wrap" data-path="${escapeHtml(p)}">
      <img src="../${escapeHtml(p)}">
      <button type="button" class="image-remove-btn" data-path="${escapeHtml(p)}">×</button>
    </div>`
    )
    .join("");

  row.querySelectorAll(".image-remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.removedImages.push(btn.dataset.path);
      btn.closest(".image-thumb-wrap").remove();
    });
  });
}

async function translateField(fromId, toId, btnId) {
  const btn = document.getElementById(btnId);
  const text = document.getElementById(fromId).value.trim();
  if (!text) return;
  btn.disabled = true;
  btn.textContent = "Translating...";
  try {
    const data = await api("/translate", { text });
    document.getElementById(toId).value = data.translated || "";
  } catch {
    alert("Translation failed — check your connection and try again.");
  }
  btn.disabled = false;
  btn.textContent = "Translate →";
}

async function runAutofill() {
  const btn = document.getElementById("autofillBtn");
  btn.disabled = true;
  btn.textContent = "Reading photos...";
  try {
    let images = state.pendingImages.map((img) => ({ data: img.base64, mime: img.mime }));
    if (!images.length && state.currentProductImages && state.currentProductImages.length) {
      for (const path of state.currentProductImages.slice(0, 2)) {
        try {
          const res = await fetch("../" + path);
          const blob = await res.blob();
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(",")[1]);
            reader.readAsDataURL(blob);
          });
          images.push({ data: base64, mime: blob.type || "image/jpeg" });
        } catch {}
      }
    }
    if (!images.length) {
      btn.disabled = false;
      btn.textContent = "✨ Auto-fill details from photos";
      return alert("No photo available to read yet — upload one first.");
    }
    const data = await api("/autofill", { images });
    if (data.name_en) document.getElementById("f_name_en").value = data.name_en;
    if (data.name_fr) document.getElementById("f_name_fr").value = data.name_fr;
    if (data.description_en) document.getElementById("f_description_en").value = data.description_en;
    if (data.description_fr) document.getElementById("f_description_fr").value = data.description_fr;
    if (data.unit_size) document.getElementById("f_unit_size").value = data.unit_size;
    if (data.unit_type) document.getElementById("f_unit_type").value = data.unit_type;
    if (data.barcode) document.getElementById("f_barcode").value = data.barcode;
  } catch {
    alert("Auto-fill failed — you can still fill the form in manually.");
  }
  btn.disabled = false;
  btn.textContent = "✨ Auto-fill details from photos";
}

async function runBarcodeLookup() {
  const barcode = document.getElementById("f_barcode").value.trim();
  if (!barcode) return alert("Type or scan a barcode number first.");
  const btn = document.getElementById("lookupBarcodeBtn");
  btn.disabled = true;
  btn.textContent = "Looking up...";
  try {
    const data = await api("/barcode-lookup", { barcode });
    if (data.found) {
      if (data.name_en) document.getElementById("f_name_en").value = data.name_en;
      if (data.unit_size) document.getElementById("f_unit_size").value = data.unit_size;
      if (data.unit_type) document.getElementById("f_unit_type").value = data.unit_type;
      if (data.image_url) {
        btn.textContent = "Fetching photo...";
        try {
          const imgData = await api("/fetch-image", { image_url: data.image_url });
          if (imgData.base64) {
            state.pendingImages.push({ base64: imgData.base64, mime: imgData.mime });
            renderPendingImagePreviews();
            document.getElementById("autofillBtn").style.display = "block";
          }
        } catch {}
      }
      alert("Found it! Details filled in — please double check them, then click Auto-fill for descriptions.");
    } else {
      alert("Not found in the free product databases. Take a photo of the product instead, then click the green Auto-fill button.");
    }
  } catch {
    alert("Lookup failed — check your connection and try again.");
  }
  btn.disabled = false;
  btn.textContent = "Look Up";
}

function startBarcodeScanner() {
  document.getElementById("scannerBox").style.display = "block";
  const reader = new Html5Qrcode("scannerReader");
  state.scanner = reader;
  reader
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      (decodedText) => {
        document.getElementById("f_barcode").value = decodedText;
        stopBarcodeScanner();
        runBarcodeLookup();
      },
      () => {}
    )
    .catch(() => {
      alert("Could not access the camera. You can still type the barcode number manually.");
      document.getElementById("scannerBox").style.display = "none";
    });
}

function stopBarcodeScanner() {
  try {
    if (state.scanner) state.scanner.stop().then(() => {}).catch(() => {});
  } catch (e) {}
  state.scanner = null;
  const box = document.getElementById("scannerBox");
  if (box) box.style.display = "none";
}

/* ---------------- Private (stock/cost) data ---------------- */
async function loadPrivateData(sku) {
  try {
    const data = await api("/private-get", { skus: [sku] });
    const info = data[sku] || {};
    document.getElementById("f_in_stock").checked = info.in_stock !== false;
    document.getElementById("f_stock_cases").value = info.stock_cases || "";
    document.getElementById("f_stock_pallets").value = info.stock_pallets || "";
    document.getElementById("f_cost_price").value = info.cost_price || "";
  } catch {}
}

async function savePrivateData(sku) {
  try {
    await api("/private-set", {
      sku,
      in_stock: document.getElementById("f_in_stock").checked,
      stock_cases: document.getElementById("f_stock_cases").value.trim(),
      stock_pallets: document.getElementById("f_stock_pallets").value.trim(),
      cost_price: document.getElementById("f_cost_price").value.trim(),
    });
  } catch {
    alert("Product saved, but the private stock/cost info failed to save — try again from the edit screen.");
  }
}

/* ---------------- Save / Delete product ---------------- */
async function saveProduct(sku, isEdit) {
  const statusEl = document.getElementById("modalStatus");
  statusEl.className = "status-msg";
  statusEl.textContent = "Saving...";
  setBusy(true);
  try {
    const existingProduct = isEdit ? state.products.find((p) => String(p.sku) === String(sku)) : null;
    let images = existingProduct
      ? (existingProduct.images || []).filter((p) => !state.removedImages.includes(p))
      : [];

    for (let i = 0; i < state.pendingImages.length; i++) {
      const img = state.pendingImages[i];
      const ext = (img.mime.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const filename = `${sku}_${Date.now()}_${i}.${ext}`;
      const data = await api("/image-upload", { filename, content: img.base64, message: `Add image for product ${sku}` });
      images.push(data.path);
    }

    const localPreview = state.pendingImages[0]
      ? `data:${state.pendingImages[0].mime};base64,${state.pendingImages[0].base64}`
      : images[0]
      ? "../" + images[0]
      : null;

    const updatedProduct = {
      sku: sku,
      _localPreview: localPreview,
      barcode: document.getElementById("f_barcode").value.trim(),
      category: document.getElementById("f_category").value,
      name_en: document.getElementById("f_name_en").value.trim(),
      name_fr: document.getElementById("f_name_fr").value.trim(),
      description_en: document.getElementById("f_description_en").value.trim(),
      description_fr: document.getElementById("f_description_fr").value.trim(),
      unit_size: document.getElementById("f_unit_size").value.trim(),
      unit_type: document.getElementById("f_unit_type").value,
      case_qty: parseInt(document.getElementById("f_case_qty").value, 10) || 0,
      pallet_qty: parseInt(document.getElementById("f_pallet_qty").value, 10) || 0,
      sale: document.getElementById("f_sale").checked,
      images: images,
      name: { en: document.getElementById("f_name_en").value.trim(), fr: document.getElementById("f_name_fr").value.trim() },
      description: {
        en: document.getElementById("f_description_en").value.trim(),
        fr: document.getElementById("f_description_fr").value.trim(),
      },
    };

    if (isEdit) {
      const idx = state.products.findIndex((p) => String(p.sku) === String(sku));
      state.products[idx] = updatedProduct;
    } else {
      state.products.push(updatedProduct);
    }

    const cleanProducts = state.products.map(({ _localPreview, ...rest }) => rest);
    const saveRes = await api("/products-save", {
      products: cleanProducts,
      sha: state.sha,
      message: `${isEdit ? "Update" : "Add"} product ${sku}`,
    });
    state.sha = saveRes.sha;
    await savePrivateData(sku);

    statusEl.className = "status-msg success";
    statusEl.textContent = "Saved!";
    renderStats();
    renderGrid();
    setTimeout(() => closeModal(), 500);
  } catch (err) {
    statusEl.className = "status-msg error";
    statusEl.textContent = "Error: " + err.message;
  }
  setBusy(false);
}

async function deleteProduct(sku) {
  if (!confirm("Delete this product? This cannot be undone.")) return;
  setBusy(true);
  try {
    state.products = state.products.filter((p) => String(p.sku) !== String(sku));
    const cleanProducts = state.products.map(({ _localPreview, ...rest }) => rest);
    const saveRes = await api("/products-save", { products: cleanProducts, sha: state.sha, message: `Delete product ${sku}` });
    state.sha = saveRes.sha;
    closeModal();
    renderStats();
    renderGrid();
  } catch (err) {
    alert("Error deleting product: " + err.message);
  }
  setBusy(false);
}

/* ---------------- Customers ---------------- */
state.customers = [];
state.customerSearchTerm = "";

async function refreshCustomers() {
  setBusy(true);
  try {
    const data = await api("/customers-list");
    state.customers = data.customers || [];
    renderCustomerList();
  } catch (err) {
    document.getElementById("customerList").innerHTML = `<div class="empty-note">Error loading customers: ${escapeHtml(err.message)}</div>`;
  }
  setBusy(false);
}

function renderCustomerList() {
  const wrap = document.getElementById("customerList");
  const term = state.customerSearchTerm;
  const filtered = state.customers.filter((c) => {
    if (!term) return true;
    return (
      (c.name || "").toLowerCase().includes(term) ||
      (c.business_name || "").toLowerCase().includes(term) ||
      (c.email || "").toLowerCase().includes(term) ||
      (c.phone || "").toLowerCase().includes(term)
    );
  });

  if (!filtered.length) {
    wrap.innerHTML = `<div class="empty-note">No customers yet. Click "+ Add Customer" to create your first one.</div>`;
    return;
  }

  wrap.innerHTML = filtered
    .map(
      (c) => `
    <div class="admin-product-card" data-id="${escapeHtml(c.id)}" style="cursor:pointer; padding:16px; display:block;">
      <div class="admin-product-card__name" style="font-size:1.05rem;">${escapeHtml(c.name || "(no name)")}</div>
      ${c.business_name ? `<div style="color:#5B6672; font-size:0.9rem;">${escapeHtml(c.business_name)}</div>` : ""}
      <div style="margin-top:8px; font-size:0.85rem; color:#5B6672;">
        ${c.phone ? `📞 ${escapeHtml(c.phone)}<br>` : ""}
        ${c.email ? `✉️ ${escapeHtml(c.email)}<br>` : ""}
        ${c.address ? `📍 ${escapeHtml(c.address)}` : ""}
      </div>
    </div>`
    )
    .join("");

  wrap.querySelectorAll(".admin-product-card").forEach((card) => {
    card.addEventListener("click", () => {
      const customer = state.customers.find((c) => c.id === card.dataset.id);
      openCustomerModal(customer);
    });
  });
}

async function openCustomerModal(existing) {
  const isEdit = !!existing;
  const c = existing || { id: "", name: "", business_name: "", phone: "", email: "", address: "", notes: "" };

  let customerInvoices = [];
  if (isEdit) {
    try {
      const data = await api("/invoices-list");
      customerInvoices = (data.invoices || []).filter((inv) => inv.customer_name === c.name);
    } catch {}
  }

  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-box">
        <h2>${isEdit ? "Edit Customer" : "Add Customer"}</h2>
        <div class="form-row"><label>Full Name</label><input type="text" id="c_name"></div>
        <div class="form-row"><label>Business Name</label><input type="text" id="c_business"></div>
        <div class="two-col">
          <div class="form-row"><label>Phone</label><input type="text" id="c_phone"></div>
          <div class="form-row"><label>Email</label><input type="email" id="c_email"></div>
        </div>
        <div class="form-row"><label>Address</label><input type="text" id="c_address"></div>
        <div class="form-row"><label>Notes</label><textarea id="c_notes" placeholder="Anything else — delivery preferences, order history notes, etc."></textarea></div>

        ${
          isEdit && customerInvoices.length
            ? `
          <div class="form-row" style="background:#F7F9FB; border:1px solid #DCE4EC; border-radius:10px; padding:16px;">
            <label style="margin-bottom:10px;">📋 Invoice History (${customerInvoices.length})</label>
            ${customerInvoices
              .map((inv) => {
                const total = (inv.items || []).reduce((sum, i) => sum + i.qty * (parseFloat(i.price) || 0), 0);
                return `
              <div class="customer-invoice-row" data-id="${escapeHtml(inv.id)}" style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #DCE4EC; cursor:pointer;">
                <span>Invoice #${escapeHtml(inv.number)} — ${new Date(inv.updated_at).toLocaleDateString()}</span>
                <span style="font-weight:700;">$${total.toFixed(2)}</span>
              </div>`;
              })
              .join("")}
          </div>`
            : ""
        }

        <p class="status-msg" id="customerModalStatus"></p>
        <div class="modal-actions">
          <div>${isEdit ? `<button class="btn-secondary" id="deleteCustomerBtn" style="border-color:#C0392B;color:#C0392B;">Delete Customer</button>` : ""}</div>
          <div style="display:flex; gap:10px;">
            <button class="btn-secondary" id="cancelCustomerBtn">Cancel</button>
            <button class="btn-primary" id="saveCustomerBtn">Save Customer</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("c_name").value = c.name || "";
  document.getElementById("c_business").value = c.business_name || "";
  document.getElementById("c_phone").value = c.phone || "";
  document.getElementById("c_email").value = c.email || "";
  document.getElementById("c_address").value = c.address || "";
  document.getElementById("c_notes").value = c.notes || "";

  document.querySelectorAll(".customer-invoice-row").forEach((row) => {
    row.addEventListener("click", async () => {
      const inv = customerInvoices.find((i) => i.id === row.dataset.id);
      const settings = await loadSettingsForInvoice();
      openInvoicePreview(inv, settings);
    });
  });

  document.getElementById("cancelCustomerBtn").addEventListener("click", closeModal);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });

  if (isEdit) {
    document.getElementById("deleteCustomerBtn").addEventListener("click", async () => {
      if (!confirm("Delete this customer? This cannot be undone.")) return;
      setBusy(true);
      try {
        await api("/customers-delete", { id: c.id });
        closeModal();
        refreshCustomers();
      } catch (err) {
        alert("Error: " + err.message);
      }
      setBusy(false);
    });
  }

  document.getElementById("saveCustomerBtn").addEventListener("click", async () => {
    const statusEl = document.getElementById("customerModalStatus");
    statusEl.className = "status-msg";
    statusEl.textContent = "Saving...";
    setBusy(true);
    try {
      await api("/customers-save", {
        id: c.id,
        name: document.getElementById("c_name").value.trim(),
        business_name: document.getElementById("c_business").value.trim(),
        phone: document.getElementById("c_phone").value.trim(),
        email: document.getElementById("c_email").value.trim(),
        address: document.getElementById("c_address").value.trim(),
        notes: document.getElementById("c_notes").value.trim(),
      });
      statusEl.className = "status-msg success";
      statusEl.textContent = "Saved!";
      setTimeout(() => {
        closeModal();
        refreshCustomers();
      }, 400);
    } catch (err) {
      statusEl.className = "status-msg error";
      statusEl.textContent = "Error: " + err.message;
    }
    setBusy(false);
  });
}

/* ---------------- Quote Requests ---------------- */
async function refreshQuotes() {
  const wrap = document.getElementById("quotesList");
  wrap.innerHTML = "Loading...";
  try {
    const data = await api("/quotes-list");
    renderQuotesList(data.quotes || []);
  } catch (err) {
    wrap.innerHTML = `<div class="empty-note">Error loading requests: ${escapeHtml(err.message)}</div>`;
  }
}

function renderQuotesList(quotes) {
  const wrap = document.getElementById("quotesList");
  if (!quotes.length) {
    wrap.innerHTML = `<div class="empty-note">No quote requests yet. Once a customer submits their wishlist, it'll show up here.</div>`;
    return;
  }

  wrap.innerHTML = quotes
    .map((q) => {
      const date = new Date(q.created_at).toLocaleString();
      const c = q.customer_info || {};
      const isReturning = !!q.matched_customer;
      return `
      <div class="admin-product-card" style="cursor:default; padding:20px; display:block; margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
          <div>
            <div style="font-weight:700; font-size:1.05rem;">
              ${escapeHtml(c.name || "(no name)")}
              ${isReturning ? `<span class="admin-product-card__tag" style="background:#E1F5EA; color:#2F8F76;">Returning Customer</span>` : `<span class="admin-product-card__tag" style="background:#FDF3E3; color:#C97A2B;">New Contact</span>`}
            </div>
            ${c.business_name ? `<div style="color:#5B6672;">${escapeHtml(c.business_name)}</div>` : ""}
            <div style="font-size:0.85rem; color:#5B6672; margin-top:6px;">
              ${c.phone ? `📞 ${escapeHtml(c.phone)} &nbsp; ` : ""}${c.email ? `✉️ ${escapeHtml(c.email)}` : ""}
            </div>
            <div style="font-size:0.75rem; color:#999; margin-top:4px;">${escapeHtml(date)}</div>
          </div>
          <button class="btn-secondary delete-quote-btn" data-id="${escapeHtml(q.id)}" style="border-color:#C0392B; color:#C0392B;">Delete</button>
        </div>

        ${c.message ? `<div style="margin-top:10px; padding:10px; background:#F7F9FB; border-radius:8px; font-size:0.9rem;">"${escapeHtml(c.message)}"</div>` : ""}

        <div style="margin-top:14px;">
          <div style="font-weight:600; font-size:0.85rem; margin-bottom:6px;">Requested Products (${q.items.length}):</div>
          <ul style="margin:0; padding-left:20px; font-size:0.88rem;">
            ${q.items.map((item) => `<li>${escapeHtml(item.name)} — SKU #${escapeHtml(item.sku)}</li>`).join("")}
          </ul>
        </div>

        ${
          !isReturning
            ? `<button class="btn-primary add-as-customer-btn" data-id="${escapeHtml(q.id)}" style="margin-top:14px;">+ Add as Customer</button>`
            : ""
        }
      </div>`;
    })
    .join("");

  wrap.querySelectorAll(".delete-quote-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this request?")) return;
      await api("/quotes-delete", { id: btn.dataset.id });
      refreshQuotes();
    });
  });

  wrap.querySelectorAll(".add-as-customer-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const quote = quotes.find((q) => q.id === btn.dataset.id);
      const c = quote.customer_info;
      try {
        await api("/customers-save", {
          name: c.name || "",
          business_name: c.business_name || "",
          phone: c.phone || "",
          email: c.email || "",
          address: "",
          notes: "Added from a quote request.",
        });
        alert("Added to your Customers list!");
        refreshQuotes();
      } catch (err) {
        alert("Error: " + err.message);
      }
    });
  });
}

/* ---------------- Messages ---------------- */
async function refreshMessages() {
  const wrap = document.getElementById("messagesList");
  wrap.innerHTML = "Loading...";
  try {
    const data = await api("/messages-list");
    renderMessagesList(data.messages || []);
  } catch (err) {
    wrap.innerHTML = `<div class="empty-note">Error loading messages: ${escapeHtml(err.message)}</div>`;
  }
}

function renderMessagesList(messages) {
  const wrap = document.getElementById("messagesList");
  if (!messages.length) {
    wrap.innerHTML = `<div class="empty-note">No messages yet. Anything submitted through your Contact page will show up here.</div>`;
    return;
  }

  wrap.innerHTML = messages
    .map((m) => {
      const date = new Date(m.created_at).toLocaleString();
      return `
      <div class="admin-product-card" style="cursor:default; padding:20px; display:block; margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
          <div>
            <div style="font-weight:700; font-size:1.05rem;">${escapeHtml(m.name || "(no name)")}</div>
            <div style="font-size:0.85rem; color:#5B6672; margin-top:4px;">
              ${m.email ? `✉️ ${escapeHtml(m.email)} &nbsp; ` : ""}${m.phone ? `📞 ${escapeHtml(m.phone)}` : ""}
            </div>
            ${m.subject ? `<div style="font-weight:600; margin-top:8px;">Subject: ${escapeHtml(m.subject)}</div>` : ""}
            <div style="font-size:0.75rem; color:#999; margin-top:4px;">${escapeHtml(date)}</div>
          </div>
          <button class="btn-secondary delete-message-btn" data-id="${escapeHtml(m.id)}" style="border-color:#C0392B; color:#C0392B;">Delete</button>
        </div>
        <div style="margin-top:12px; padding:12px; background:#F7F9FB; border-radius:8px; font-size:0.9rem;">${escapeHtml(m.message || "")}</div>
      </div>`;
    })
    .join("");

  wrap.querySelectorAll(".delete-message-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this message?")) return;
      await api("/messages-delete", { id: btn.dataset.id });
      refreshMessages();
    });
  });
}

/* ---------------- Invoices ---------------- */
let currentInvoice = null;

async function refreshInvoices() {
  const wrap = document.getElementById("invoicesList");
  wrap.innerHTML = "Loading...";
  try {
    const data = await api("/invoices-list");
    renderInvoicesList(data.invoices || []);
  } catch (err) {
    wrap.innerHTML = `<div class="empty-note">Error loading invoices: ${escapeHtml(err.message)}</div>`;
  }
}

function renderInvoicesList(invoices) {
  const wrap = document.getElementById("invoicesList");
  if (!invoices.length) {
    wrap.innerHTML = `<div class="empty-note">No invoices yet. Click "+ Create Invoice" to make your first one.</div>`;
    return;
  }
  wrap.innerHTML = invoices
    .map((inv) => {
      const total = (inv.items || []).reduce((sum, i) => sum + i.qty * i.price, 0);
      return `
      <div class="admin-product-card" data-id="${escapeHtml(inv.id)}" style="cursor:pointer; padding:16px; display:block; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:700;">
              Invoice #${escapeHtml(inv.number)} — ${escapeHtml(inv.customer_name || "No customer")}
              <span class="admin-product-card__tag" style="${inv.status === "paid" ? "background:#E1F5EA;color:#2F8F76;" : inv.status === "sent" ? "background:#FDF3E3;color:#C97A2B;" : "background:#EEE;color:#666;"}">${escapeHtml(inv.status || "draft")}</span>
            </div>
            <div style="font-size:0.8rem; color:#5B6672;">${new Date(inv.updated_at).toLocaleDateString()} · ${(inv.items || []).length} items</div>
          </div>
          <div style="font-weight:700; font-size:1.1rem;">$${total.toFixed(2)}</div>
        </div>
      </div>`;
    })
    .join("");

  wrap.querySelectorAll(".admin-product-card").forEach((card) => {
    card.addEventListener("click", async () => {
      const data = await api("/invoices-list");
      const inv = data.invoices.find((i) => i.id === card.dataset.id);
      openInvoiceBuilder(inv);
    });
  });
}

document.getElementById("createInvoiceBtn").addEventListener("click", () => openInvoiceBuilder(null));

async function openInvoiceBuilder(existing) {
  currentInvoice = existing || {
    id: "",
    number: null,
    customer_name: "",
    customer_business: "",
    customer_address: "",
    customer_phone: "",
    customer_email: "",
    items: [],
    notes: "",
  };

  if (!existing) {
    try {
      const data = await api("/invoices-next-number");
      currentInvoice.number = data.number;
    } catch {
      currentInvoice.number = "----";
    }
  }

  const settings = await loadSettingsForInvoice();

  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-box" style="max-width:800px;">
        <h2>Invoice #${escapeHtml(currentInvoice.number)}</h2>

        <div class="form-row">
          <label>Select Existing Customer (optional)</label>
          <select id="inv_customer_picker">
            <option value="">— Type details manually below —</option>
          </select>
        </div>

        <div class="two-col">
          <div class="form-row"><label>Customer Name</label><input type="text" id="inv_customer_name"></div>
          <div class="form-row"><label>Business Name</label><input type="text" id="inv_customer_business"></div>
        </div>
        <div class="two-col">
          <div class="form-row"><label>Phone</label><input type="text" id="inv_customer_phone"></div>
          <div class="form-row"><label>Email</label><input type="text" id="inv_customer_email"></div>
        </div>
        <div class="form-row"><label>Address</label><input type="text" id="inv_customer_address"></div>

        <div class="form-row">
          <label>Add a Product</label>
          <input type="text" id="invProductSearch" placeholder="Search by product name or SKU...">
          <div class="product-picker-results" id="invProductResults" style="display:none;"></div>
        </div>

        <div id="invoiceLineItems" style="margin:16px 0;"></div>
        <div class="invoice-totals" id="invoiceTotal">Total: $0.00</div>

        <div class="form-row">
          <label>Status</label>
          <select id="inv_status">
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        <div class="form-row"><label>Notes</label><textarea id="inv_notes" placeholder="Payment terms, delivery details, etc."></textarea></div>

        <p class="status-msg" id="invoiceStatus"></p>

        <div class="modal-actions">
          <div>${existing ? `<button class="btn-secondary" id="deleteInvoiceBtn" style="border-color:#C0392B;color:#C0392B;">Delete</button>` : ""}</div>
          <div style="display:flex; gap:10px;">
            <button class="btn-secondary" id="cancelInvoiceBtn">Cancel</button>
            <button class="btn-secondary" id="printInvoiceBtn">🖨️ Print</button>
            <button class="btn-primary" id="saveInvoiceBtn">Save Invoice</button>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const custData = await api("/customers-list");
    const picker = document.getElementById("inv_customer_picker");
    (custData.customers || []).forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name + (c.business_name ? " — " + c.business_name : "");
      picker.appendChild(opt);
    });
    picker.addEventListener("change", () => {
      const c = custData.customers.find((x) => x.id === picker.value);
      if (c) {
        document.getElementById("inv_customer_name").value = c.name || "";
        document.getElementById("inv_customer_business").value = c.business_name || "";
        document.getElementById("inv_customer_phone").value = c.phone || "";
        document.getElementById("inv_customer_email").value = c.email || "";
        document.getElementById("inv_customer_address").value = c.address || "";
      }
    });
  } catch {}

  document.getElementById("inv_customer_name").value = currentInvoice.customer_name || "";
  document.getElementById("inv_customer_business").value = currentInvoice.customer_business || "";
  document.getElementById("inv_customer_phone").value = currentInvoice.customer_phone || "";
  document.getElementById("inv_customer_email").value = currentInvoice.customer_email || "";
  document.getElementById("inv_customer_address").value = currentInvoice.customer_address || "";
  document.getElementById("inv_notes").value = currentInvoice.notes || "";
  document.getElementById("inv_status").value = currentInvoice.status || "draft";

  renderInvoiceLineItems();

  document.getElementById("invProductSearch").addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    const resultsBox = document.getElementById("invProductResults");
    if (!term) {
      resultsBox.style.display = "none";
      return;
    }
    const matches = state.products
      .filter((p) => (p.name_en || "").toLowerCase().includes(term) || String(p.sku).includes(term))
      .slice(0, 8);
    if (!matches.length) {
      resultsBox.style.display = "none";
      return;
    }
    resultsBox.style.display = "block";
    resultsBox.innerHTML = matches
      .map(
        (p) => `
      <div class="product-picker-row" data-sku="${p.sku}">
        <img src="${escapeHtml(firstImage(p))}">
        <span>${escapeHtml(p.name_en)} — SKU #${escapeHtml(p.sku)}</span>
      </div>`
      )
      .join("");
    resultsBox.querySelectorAll(".product-picker-row").forEach((row) => {
      row.addEventListener("click", () => {
        addProductToInvoice(row.dataset.sku);
        document.getElementById("invProductSearch").value = "";
        resultsBox.style.display = "none";
      });
    });
  });

  document.getElementById("cancelInvoiceBtn").addEventListener("click", closeModal);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });
  document.getElementById("saveInvoiceBtn").addEventListener("click", saveInvoice);
  document.getElementById("printInvoiceBtn").addEventListener("click", () => printInvoice(settings));

  if (existing) {
    document.getElementById("deleteInvoiceBtn").addEventListener("click", async () => {
      if (!confirm("Delete this invoice?")) return;
      await api("/invoices-delete", { id: currentInvoice.id });
      closeModal();
      refreshInvoices();
    });
  }
}

function addProductToInvoice(sku) {
  const p = state.products.find((x) => String(x.sku) === String(sku));
  if (!p) return;
  currentInvoice.items = currentInvoice.items || [];
  currentInvoice.items.push({
    sku: p.sku,
    barcode: p.barcode || "",
    name: p.name_en,
    image: firstImage(p),
    qty: 1,
    price: 0,
  });
  renderInvoiceLineItems();
}

function renderInvoiceLineItems() {
  const wrap = document.getElementById("invoiceLineItems");
  const items = currentInvoice.items || [];
  if (!items.length) {
    wrap.innerHTML = `<div class="empty-note">No products added yet — search above to add some.</div>`;
  } else {
    wrap.innerHTML = items
      .map(
        (item, i) => `
      <div class="invoice-line-item">
        <img src="${escapeHtml(item.image)}">
        <div>
          <div style="font-weight:600;">${escapeHtml(item.name)}</div>
          <div style="font-size:0.75rem; color:#5B6672;">SKU #${escapeHtml(item.sku)} ${item.barcode ? "· UPC " + escapeHtml(item.barcode) : ""}</div>
        </div>
        <input type="number" min="1" value="${item.qty}" data-i="${i}" data-field="qty" class="inv-item-field">
        <input type="text" value="${item.price}" placeholder="Price" data-i="${i}" data-field="price" class="inv-item-field">
        <div style="font-weight:700;">$${(item.qty * (parseFloat(item.price) || 0)).toFixed(2)}</div>
        <button type="button" class="inv-remove-btn" data-i="${i}" style="background:none;border:none;color:#C0392B;font-size:1.2rem;cursor:pointer;">×</button>
      </div>`
      )
      .join("");

    wrap.querySelectorAll(".inv-item-field").forEach((input) => {
      input.addEventListener("input", (e) => {
        const i = parseInt(e.target.dataset.i, 10);
        const field = e.target.dataset.field;
        currentInvoice.items[i][field] = field === "qty" ? parseInt(e.target.value, 10) || 1 : e.target.value;
        renderInvoiceLineItems();
      });
    });
    wrap.querySelectorAll(".inv-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentInvoice.items.splice(parseInt(btn.dataset.i, 10), 1);
        renderInvoiceLineItems();
      });
    });
  }

  const total = items.reduce((sum, i) => sum + i.qty * (parseFloat(i.price) || 0), 0);
  document.getElementById("invoiceTotal").textContent = `Total: $${total.toFixed(2)}`;
}

async function saveInvoice() {
  const statusEl = document.getElementById("invoiceStatus");
  statusEl.className = "status-msg";
  statusEl.textContent = "Saving...";
  currentInvoice.customer_name = document.getElementById("inv_customer_name").value.trim();
  currentInvoice.customer_business = document.getElementById("inv_customer_business").value.trim();
  currentInvoice.customer_phone = document.getElementById("inv_customer_phone").value.trim();
  currentInvoice.customer_email = document.getElementById("inv_customer_email").value.trim();
  currentInvoice.customer_address = document.getElementById("inv_customer_address").value.trim();
  currentInvoice.notes = document.getElementById("inv_notes").value.trim();
  currentInvoice.status = document.getElementById("inv_status").value;

  try {
    const res = await api("/invoices-save", currentInvoice);
    currentInvoice.id = res.id;
    currentInvoice.number = res.number;
    statusEl.className = "status-msg success";
    statusEl.textContent = "Saved!";
    setTimeout(() => {
      closeModal();
      refreshInvoices();
    }, 400);
  } catch (err) {
    statusEl.className = "status-msg error";
    statusEl.textContent = "Error: " + err.message;
  }
}

async function loadSettingsForInvoice() {
  try {
    const res = await fetch("../data/settings.json", { cache: "no-store" });
    return await res.json();
  } catch {
    return {};
  }
}

function invoiceHtml(invoice, settings) {
  const items = invoice.items || [];
  const total = items.reduce((sum, i) => sum + i.qty * (parseFloat(i.price) || 0), 0);
  const paidStamp =
    invoice.status === "paid"
      ? `<div style="position:absolute; top:40%; left:50%; transform:translate(-50%,-50%) rotate(-25deg); font-size:4rem; font-weight:900; color:#C0392B; border:6px solid #C0392B; padding:6px 30px; border-radius:12px; opacity:0.75; letter-spacing:0.1em; pointer-events:none; z-index:10;">PAID</div>`
      : "";
  return `
    <div style="position:relative;">
    ${paidStamp}
    <div class="print-header">
      <div>
        <img src="../static/images/logo.svg" style="height:50px;">
        <p>${escapeHtml(settings.address || "")}<br>${escapeHtml(settings.phone_display || "")} · ${escapeHtml(settings.email || "")}</p>
      </div>
      <div style="text-align:right;">
        <h2>INVOICE #${escapeHtml(invoice.number)}</h2>
        <p>${new Date(invoice.updated_at).toLocaleDateString()}</p>
      </div>
    </div>
    <div>
      <strong>Bill To:</strong><br>
      ${escapeHtml(invoice.customer_name || "")}<br>
      ${invoice.customer_business ? escapeHtml(invoice.customer_business) + "<br>" : ""}
      ${invoice.customer_address ? escapeHtml(invoice.customer_address) + "<br>" : ""}
      ${invoice.customer_phone ? escapeHtml(invoice.customer_phone) + "<br>" : ""}
      ${invoice.customer_email ? escapeHtml(invoice.customer_email) : ""}
    </div>
    <table class="print-table" style="width:100%; border-collapse:collapse; margin-top:20px;">
      <thead><tr><th>Photo</th><th>Product</th><th>SKU / UPC</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>
        ${items
          .map(
            (item) => `
          <tr>
            <td><img src="${escapeHtml(item.image)}" style="width:40px;height:40px;object-fit:cover;"></td>
            <td>${escapeHtml(item.name)}</td>
            <td>#${escapeHtml(item.sku)}${item.barcode ? " / " + escapeHtml(item.barcode) : ""}</td>
            <td>${item.qty}</td>
            <td>$${parseFloat(item.price || 0).toFixed(2)}</td>
            <td>$${(item.qty * (parseFloat(item.price) || 0)).toFixed(2)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
    <div style="text-align:right; margin-top:20px; font-size:1.1rem; font-weight:700;">Total: $${total.toFixed(2)}</div>
    ${invoice.notes ? `<p style="margin-top:20px;">${escapeHtml(invoice.notes)}</p>` : ""}
    </div>
  `;
}

function openInvoicePreview(invoice, settings) {
  const root = document.getElementById("modalRoot");
  root.innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal-box" style="max-width:800px;">
        <div style="border:1px solid #DCE4EC; border-radius:8px; padding:24px; background:#fff;">
          ${invoiceHtml(invoice, settings)}
        </div>
        <div class="modal-actions">
          <div></div>
          <div style="display:flex; gap:10px;">
            <button class="btn-secondary" id="closePreviewBtn">Close</button>
            <button class="btn-primary" id="printPreviewBtn">🖨️ Print / Save as PDF</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById("closePreviewBtn").addEventListener("click", closeModal);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });
  document.getElementById("printPreviewBtn").addEventListener("click", () => {
    document.getElementById("printInvoiceArea").innerHTML = invoiceHtml(invoice, settings);
    window.print();
  });
}

function printInvoice(settings) {
  currentInvoice.status = document.getElementById("inv_status").value;
  document.getElementById("printInvoiceArea").innerHTML = invoiceHtml(currentInvoice, settings);
  window.print();
}

/* ---------------- Init ---------------- */
verifyAndInit();