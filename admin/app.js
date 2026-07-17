/* ==========================================================================
   Pharmaline Admin Dashboard
   ========================================================================== */

const WORKER_URL = "https://pharmaline-oauth.pharamaline3.workers.dev";
const REPO = "pharamaline3-rgb/pharmaline-catalog";
const BRANCH = "main";
const PRODUCTS_PATH = "data/products.json";
const IMAGES_PATH = "static/images/products";

let state = {
  products: [],
  sha: null,
  activeCategory: "all",
  searchTerm: "",
  pendingImages: [],
  scanner: null,
};

/* ---------------- Unicode-safe base64 helpers ---------------- */
function b64EncodeUnicode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}
function b64DecodeUnicode(str) {
  const binary = atob(str.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

/* ---------------- GitHub API ---------------- */
function ghToken() {
  return sessionStorage.getItem("gh_token");
}

async function ghApi(path, opts = {}) {
  return fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    ...opts,
    headers: {
      Authorization: `token ${ghToken()}`,
      Accept: "application/vnd.github.v3+json",
      ...(opts.headers || {}),
    },
  });
}

async function getProductsFile() {
  const res = await ghApi(`contents/${PRODUCTS_PATH}?ref=${BRANCH}`);
  if (!res.ok) throw new Error("Could not load products.json (status " + res.status + ")");
  const data = await res.json();
  const content = b64DecodeUnicode(data.content);
  return { products: JSON.parse(content), sha: data.sha };
}

async function saveProductsFile(products, message) {
  const content = b64EncodeUnicode(JSON.stringify(products, null, 2));
  const res = await ghApi(`contents/${PRODUCTS_PATH}`, {
    method: "PUT",
    body: JSON.stringify({ message, content, sha: state.sha, branch: BRANCH }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || "Failed to save products.json");
  }
  const data = await res.json();
  state.sha = data.content.sha;
}

async function uploadImage(filename, base64Data, message) {
  const res = await ghApi(`contents/${IMAGES_PATH}/${filename}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: base64Data, branch: BRANCH }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || "Failed to upload image");
  }
  const data = await res.json();
  return data.content.path;
}

/* ---------------- Auth ---------------- */
function showApp() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("app").style.display = "block";
}
function showLogin(message) {
  document.getElementById("loginScreen").style.display = "flex";
  document.getElementById("app").style.display = "none";
  if (message) document.getElementById("loginStatus").textContent = message;
}

async function verifyAndInit() {
  const token = ghToken();
  if (!token) return showLogin();
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `token ${token}` },
    });
    if (!res.ok) throw new Error();
    showApp();
    await refreshProducts();
  } catch {
    sessionStorage.removeItem("gh_token");
    showLogin("Your session expired — please log in again.");
  }
}

document.getElementById("loginBtn").addEventListener("click", () => {
  window.location.href = WORKER_URL + "/auth";
});

(function checkForTokenInUrl() {
  if (window.location.hash.startsWith("#gh_token=")) {
    const token = window.location.hash.replace("#gh_token=", "");
    sessionStorage.setItem("gh_token", token);
    history.replaceState(null, "", window.location.pathname);
  }
})();

document.getElementById("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem("gh_token");
  showLogin();
});

/* ---------------- Spinner ---------------- */
function setBusy(isBusy) {
  document.getElementById("spinner").style.display = isBusy ? "flex" : "none";
}

/* ---------------- Load + render dashboard ---------------- */
async function refreshProducts() {
  setBusy(true);
  try {
    const { products, sha } = await getProductsFile();
    // keep any local-only preview images we already had in memory
    const previewMap = {};
    state.products.forEach((p) => {
      if (p._localPreview) previewMap[p.sku] = p._localPreview;
    });
    products.forEach((p) => {
      if (previewMap[p.sku]) p._localPreview = previewMap[p.sku];
    });
    state.products = products;
    state.sha = sha;
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
  const tabs = [
    { key: "all", label: "All" },
    { key: "baby", label: "Baby" },
    { key: "health_beauty", label: "Health & Beauty" },
    { key: "grocery", label: "Grocery" },
    { key: "drinks", label: "Drinks" },
    { key: "cleaning", label: "Cleaning" },
    { key: "household", label: "Household" },
    { key: "laundry_fabric", label: "Laundry & Fabric" },
    { key: "paper", label: "Paper" },
    { key: "bags_wraps", label: "Bags & Wraps" },
    { key: "air_freshener", label: "Air Freshener" },
  ];
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
    const catOk = state.activeCategory === "all" || p.category === state.activeCategory;
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
    category: "health",
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
          <select id="f_category">
            <option value="baby">Baby</option>
            <option value="health_beauty">Health & Beauty</option>
            <option value="grocery">Grocery</option>
            <option value="drinks">Drinks</option>
            <option value="cleaning">Cleaning</option>
            <option value="household">Household</option>
            <option value="laundry_fabric">Laundry & Fabric Care</option>
            <option value="paper">Paper Products</option>
            <option value="bags_wraps">Bags & Wraps</option>
            <option value="air_freshener">Air Freshener</option>
          </select>
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
  row.innerHTML = paths.map((p) => `<img src="../${p}">`).join("");
}

async function translateField(fromId, toId, btnId) {
  const btn = document.getElementById(btnId);
  const text = document.getElementById(fromId).value.trim();
  if (!text) return;
  btn.disabled = true;
  btn.textContent = "Translating...";
  try {
    const res = await fetch(WORKER_URL + "/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
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
    const res = await fetch(WORKER_URL + "/autofill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images }),
    });
    const data = await res.json();
    if (data.name_en) document.getElementById("f_name_en").value = data.name_en;
    if (data.name_fr) document.getElementById("f_name_fr").value = data.name_fr;
    if (data.description_en) document.getElementById("f_description_en").value = data.description_en;
    if (data.description_fr) document.getElementById("f_description_fr").value = data.description_fr;
    if (data.category) document.getElementById("f_category").value = data.category;
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
    const res = await fetch(WORKER_URL + "/barcode-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode }),
    });
    const data = await res.json();
    if (data.found) {
      if (data.name_en) document.getElementById("f_name_en").value = data.name_en;
      if (data.category) document.getElementById("f_category").value = data.category;
      if (data.unit_size) document.getElementById("f_unit_size").value = data.unit_size;
      if (data.unit_type) document.getElementById("f_unit_type").value = data.unit_type;

      if (data.image_url) {
        btn.textContent = "Fetching photo...";
        try {
          const imgRes = await fetch(WORKER_URL + "/fetch-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_url: data.image_url }),
          });
          const imgData = await imgRes.json();
          if (imgData.base64) {
            state.pendingImages.push({ base64: imgData.base64, mime: imgData.mime });
            renderPendingImagePreviews();
            document.getElementById("autofillBtn").style.display = "block";
          }
        } catch {}
      }

      alert("Found it! Details and photo filled in — please double check them, then click Auto-fill for descriptions in both languages.");
    } else {
      alert("Not found in the free product databases. Try uploading a photo instead and use Auto-fill.");
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
    if (state.scanner) {
      state.scanner.stop().then(() => {}).catch(() => {});
    }
  } catch (e) {}
  state.scanner = null;
  const box = document.getElementById("scannerBox");
  if (box) box.style.display = "none";
}

async function loadPrivateData(sku) {
  try {
    const res = await fetch(WORKER_URL + "/private-get", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ghToken()}` },
      body: JSON.stringify({ skus: [sku] }),
    });
    const data = await res.json();
    const info = data[sku] || {};
    document.getElementById("f_in_stock").checked = info.in_stock !== false;
    document.getElementById("f_stock_cases").value = info.stock_cases || "";
    document.getElementById("f_stock_pallets").value = info.stock_pallets || "";
    document.getElementById("f_cost_price").value = info.cost_price || "";
  } catch {
    // if this fails, fields just stay at their defaults
  }
}

async function savePrivateData(sku) {
  try {
    await fetch(WORKER_URL + "/private-set", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ghToken()}` },
      body: JSON.stringify({
        sku,
        in_stock: document.getElementById("f_in_stock").checked,
        stock_cases: document.getElementById("f_stock_cases").value.trim(),
        stock_pallets: document.getElementById("f_stock_pallets").value.trim(),
        cost_price: document.getElementById("f_cost_price").value.trim(),
      }),
    });
  } catch {
    alert("Product saved, but the private stock/cost info failed to save — please try again from the product's edit screen.");
  }
}

async function saveProduct(sku, isEdit) {
  const statusEl = document.getElementById("modalStatus");
  statusEl.className = "status-msg";
  statusEl.textContent = "Saving...";
  setBusy(true);
  try {
    const existingProduct = isEdit ? state.products.find((p) => String(p.sku) === String(sku)) : null;
    let images = existingProduct ? existingProduct.images || [] : [];

    for (let i = 0; i < state.pendingImages.length; i++) {
      const img = state.pendingImages[i];
      const ext = (img.mime.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const filename = `${sku}_${Date.now()}_${i}.${ext}`;
      const path = await uploadImage(filename, img.base64, `Add image for product ${sku}`);
      images.push(path);
    }

    const localPreview = state.pendingImages[0]
      ? `data:${state.pendingImages[0].mime};base64,${state.pendingImages[0].base64}`
      : existingProduct && existingProduct._localPreview;

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
      name: {
        en: document.getElementById("f_name_en").value.trim(),
        fr: document.getElementById("f_name_fr").value.trim(),
      },
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

    // Save a clean copy (without our local-only preview field) to GitHub
    const cleanProducts = state.products.map(({ _localPreview, ...rest }) => rest);
    await saveProductsFile(cleanProducts, `${isEdit ? "Update" : "Add"} product ${sku}`);
    await savePrivateData(sku);

    statusEl.className = "status-msg success";
    statusEl.textContent = "Saved!";
    renderStats();
    renderGrid();
    setTimeout(() => {
      closeModal();
    }, 500);
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
    await saveProductsFile(cleanProducts, `Delete product ${sku}`);
    closeModal();
    renderStats();
    renderGrid();
  } catch (err) {
    alert("Error deleting product: " + err.message);
  }
  setBusy(false);
}

/* ---------------- Init ---------------- */
verifyAndInit();