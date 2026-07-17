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

document.getElementById("viewProductsBtn").addEventListener("click", () => {
  document.getElementById("viewProductsBtn").classList.add("active");
  document.getElementById("viewCustomersBtn").classList.remove("active");
  document.getElementById("productsView").style.display = "block";
  document.getElementById("customersView").style.display = "none";
});
document.getElementById("viewCustomersBtn").addEventListener("click", () => {
  document.getElementById("viewCustomersBtn").classList.add("active");
  document.getElementById("viewProductsBtn").classList.remove("active");
  document.getElementById("productsView").style.display = "none";
  document.getElementById("customersView").style.display = "block";
  refreshCustomers();
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
  if (!state.pendingImages.length) return;
  btn.disabled = true;
  btn.textContent = "Reading photos...";
  try {
    const images = state.pendingImages.map((img) => ({ data: img.base64, mime: img.mime }));
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

function openCustomerModal(existing) {
  const isEdit = !!existing;
  const c = existing || { id: "", name: "", business_name: "", phone: "", email: "", address: "", notes: "" };

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

/* ---------------- Init ---------------- */
verifyAndInit();