/* ==========================================================================
   wishlist.html — review saved items and submit a quote request
   ========================================================================== */

(function () {
  const WORKER_URL = "https://pharmaline-oauth.pharamaline3.workers.dev";
  let wishlistProducts = [];

  function render() {
    const wrap = document.getElementById("wishlistItems");
    const skus = getWishlist();
    const products = wishlistProducts.filter((p) => skus.includes(String(p.sku)));

    if (!products.length) {
      wrap.innerHTML = `<div class="empty-state">Your wishlist is empty. Browse the <a href="products.html">catalog</a> and tap the heart on anything you're interested in.</div>`;
      document.getElementById("quoteFormWrap").style.display = "none";
      return;
    }

    wrap.innerHTML = `
      <div class="product-grid">
        ${products
          .map(
            (p) => `
          <div class="product-card">
            <div class="product-card__image">
              <img src="${escapeHtml(firstImage(p))}" alt="${escapeHtml(productName(p))}">
            </div>
            <div class="product-card__body">
              <span class="product-card__cat">${escapeHtml(categoryLabel(p.category))}</span>
              <span class="product-card__name">${escapeHtml(productName(p))}</span>
              <span class="product-card__sku">SKU #${escapeHtml(p.sku)}</span>
            </div>
            <button class="wishlist-remove-btn" data-sku="${p.sku}" style="position:absolute; top:10px; right:10px; background:#fff; border:1px solid #DCE4EC; border-radius:999px; width:30px; height:30px; cursor:pointer;">✕</button>
          </div>`
          )
          .join("")}
      </div>
    `;

    wrap.querySelectorAll(".wishlist-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        toggleWishlist(btn.dataset.sku);
        render();
      });
    });

    document.getElementById("quoteFormWrap").style.display = "block";
  }

  async function init() {
    wishlistProducts = await loadProducts();
    render();
    document.addEventListener("langchange", render);
  }

  document.getElementById("quoteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById("quoteStatus");
    statusEl.className = "status-msg";
    statusEl.textContent = "Sending...";

    const skus = getWishlist();
    const products = wishlistProducts.filter((p) => skus.includes(String(p.sku)));

    const customer_info = {
      name: document.getElementById("q_name").value.trim(),
      business_name: document.getElementById("q_business").value.trim(),
      email: document.getElementById("q_email").value.trim(),
      phone: document.getElementById("q_phone").value.trim(),
      message: document.getElementById("q_message").value.trim(),
    };

    const items = products.map((p) => ({ sku: p.sku, name: productName(p) }));

    try {
      const res = await fetch(WORKER_URL + "/quote-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_info, items }),
      });
      const data = await res.json();
      if (data.ok) {
        statusEl.className = "status-msg success";
        statusEl.textContent = "Thank you! We've received your request and will get back to you shortly.";
        localStorage.removeItem("pharmaline_wishlist");
        updateWishlistBadge();
        document.getElementById("quoteForm").reset();
        setTimeout(() => render(), 1500);
      } else {
        throw new Error(data.error || "Something went wrong");
      }
    } catch (err) {
      statusEl.className = "status-msg error";
      statusEl.textContent = "Failed to send — please try again or contact us directly.";
    }
  });

  document.addEventListener("DOMContentLoaded", init);
})();