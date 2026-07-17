/* ==========================================================================
   products.html — catalog grid, category filter, live search
   ========================================================================== */

(function () {
  let allProducts = [];
  let activeCategory = "all";
  let searchTerm = "";

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function renderPill(cat, label) {
    const pill = document.createElement("button");
    pill.className = "filter-pill" + (activeCategory === cat ? " active" : "");
    pill.textContent = label;
    pill.dataset.cat = cat;
    pill.addEventListener("click", () => {
      activeCategory = cat;
      document.querySelectorAll(".filter-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      renderGrid();
    });
    return pill;
  }

  function renderFilters() {
    const wrap = document.getElementById("filterPills");
    if (!wrap) return;
    wrap.innerHTML = "";
    wrap.appendChild(renderPill("all", t("products.filter.all")));
    CATEGORIES.forEach((c) => {
      wrap.appendChild(renderPill(c.key, t("cat." + c.key + ".name")));
    });
  }

  function matches(p) {
    const catOk = activeCategory === "all" || p.category === activeCategory;
    if (!catOk) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const name = productName(p).toLowerCase();
    const sku = String(p.sku || "").toLowerCase();
    const barcode = String(p.barcode || "").toLowerCase();
    return name.includes(term) || sku.includes(term) || barcode.includes(term);
  }

  function renderGrid() {
    const grid = document.getElementById("productGrid");
    if (!grid) return;
    const filtered = allProducts.filter(matches);

    if (!filtered.length) {
      grid.innerHTML = `<div class="empty-state">${t("products.empty")}</div>`;
      return;
    }

    grid.innerHTML = filtered
      .map((p) => {
        const catColor = categoryColorVar(p.category);
        return `
        <div class="product-card" style="--cat-color:${catColor}">
          ${p.sale ? `<span class="badge">${escapeHtml(t("product.sale.badge"))}</span>` : ""}
          <div class="product-card__image">
            <img src="${escapeHtml(firstImage(p))}" alt="${escapeHtml(productName(p))}" loading="lazy">
          </div>
          <div class="product-card__body">
            <span class="product-card__cat">${escapeHtml(categoryLabel(p.category))}</span>
            <span class="product-card__name">${escapeHtml(productName(p))}</span>
            <span class="product-card__sku">${escapeHtml(t("products.sku"))} #${escapeHtml(p.sku)}</span>
          </div>
          <a class="stretched" href="product.html?sku=${encodeURIComponent(p.sku)}" aria-label="${escapeHtml(productName(p))}"></a>
        </div>`;
      })
      .join("");
  }

  async function init() {
    allProducts = await loadProducts();

    const catParam = getParam("category");
    if (catParam) activeCategory = catParam;

    renderFilters();
    renderGrid();

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchTerm = e.target.value.trim();
        renderGrid();
      });
    }

    document.addEventListener("langchange", () => {
      renderFilters();
      renderGrid();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();