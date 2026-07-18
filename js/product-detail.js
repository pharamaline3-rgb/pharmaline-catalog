/* ==========================================================================
   product.html — full product detail view (?sku=1001)
   ========================================================================== */

(function () {
  let product = null;

  function getSku() {
    return new URLSearchParams(window.location.search).get("sku");
  }

  function unitLabel(p) {
    if (!p.unit_size) return "";
    return `${p.unit_size} ${p.unit_type || ""}`.trim();
  }

  function render() {
    const wrap = document.getElementById("productDetail");
    if (!wrap) return;

    if (!product) {
      wrap.innerHTML = `<div class="empty-state">${t("product.notFound")}</div>`;
      return;
    }

    const images = product.images && product.images.length ? product.images : [firstImage(product)];
    const catColor = categoryColorVar(product.category);

    wrap.innerHTML = `
      <div class="product-detail">
        <div class="product-detail__gallery" style="--cat-color:${catColor}">
          <img id="mainImage" src="${escapeHtml(images[0])}" alt="${escapeHtml(productName(product))}">
          ${
            images.length > 1
              ? `<div class="product-detail__thumbs">${images
                  .map(
                    (img, i) =>
                      `<img src="${escapeHtml(img)}" class="${i === 0 ? "active" : ""}" data-src="${escapeHtml(img)}">`
                  )
                  .join("")}</div>`
              : ""
          }
        </div>
        <div class="product-detail__info">
          ${product.sale ? `<span class="badge" style="position:static;display:inline-block;margin-bottom:10px;">${escapeHtml(t("product.sale.badge"))}</span>` : ""}
          <span class="product-card__cat" style="--cat-color:${catColor}">${escapeHtml(categoryLabel(product.category))}</span>
          <h1>${escapeHtml(productName(product))}</h1>
          <span class="product-detail__sku">${escapeHtml(t("products.sku"))} #${escapeHtml(product.sku)}</span>
          <p>${escapeHtml(productDescription(product))}</p>
          <table class="spec-table">
            <tr><th>${escapeHtml(t("product.spec.sku"))}</th><td>${escapeHtml(product.sku)}</td></tr>
            ${product.barcode ? `<tr><th>UPC / Barcode</th><td>${escapeHtml(product.barcode)}</td></tr>` : ""}
            <tr><th>${escapeHtml(t("product.spec.category"))}</th><td>${escapeHtml(categoryLabel(product.category))}</td></tr>
            ${unitLabel(product) ? `<tr><th>${escapeHtml(t("product.spec.size"))}</th><td>${escapeHtml(unitLabel(product))}</td></tr>` : ""}
            ${product.case_qty ? `<tr><th>${escapeHtml(t("product.spec.case"))}</th><td>${escapeHtml(product.case_qty)}</td></tr>` : ""}
            ${product.pallet_qty ? `<tr><th>${escapeHtml(t("product.spec.pallet"))}</th><td>${escapeHtml(product.pallet_qty)}</td></tr>` : ""}
            ${
              product.case_qty && product.pallet_qty
                ? `<tr><th>${escapeHtml(t("product.spec.pallet_units"))}</th><td>${escapeHtml(product.case_qty * product.pallet_qty)}</td></tr>`
                : ""
            }
          </table>
          <div style="display:flex; gap:12px; margin-top:16px;">
            <a class="btn btn--primary" href="contact.html">${escapeHtml(t("nav.contact"))}</a>
            <button class="btn btn--outline" id="wishlistDetailBtn" data-sku="${product.sku}">
              ${isInWishlist(product.sku) ? "❤️ In Wishlist" : "🤍 Add to Wishlist"}
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("wishlistDetailBtn").addEventListener("click", () => {
      const nowIn = toggleWishlist(product.sku);
      document.getElementById("wishlistDetailBtn").innerHTML = nowIn ? "❤️ In Wishlist" : "🤍 Add to Wishlist";
    });

    wrap.querySelectorAll(".product-detail__thumbs img").forEach((thumb) => {
      thumb.addEventListener("click", () => {
        document.getElementById("mainImage").src = thumb.dataset.src;
        wrap.querySelectorAll(".product-detail__thumbs img").forEach((i) => i.classList.remove("active"));
        thumb.classList.add("active");
      });
    });
  }

  async function init() {
    const sku = getSku();
    const products = await loadProducts();
    product = products.find((p) => String(p.sku) === String(sku)) || null;
    render();
    document.addEventListener("langchange", render);
  }

  document.addEventListener("DOMContentLoaded", init);
})();