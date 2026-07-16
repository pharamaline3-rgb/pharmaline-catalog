/* ==========================================================================
   Shared site logic used on every page
   ========================================================================== */

const PRODUCTS_URL = "data/products.json";
const SETTINGS_URL = "data/settings.json";

function initMobileNav() {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => nav.classList.toggle("open"));
}

async function loadProducts() {
  if (window.__PRODUCTS__) return window.__PRODUCTS__;
  try {
    const res = await fetch(PRODUCTS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load products.json");
    const data = await res.json();
    window.__PRODUCTS__ = data;
    return data;
  } catch (err) {
    console.error(err);
    window.__PRODUCTS__ = [];
    return [];
  }
}

async function loadSettings() {
  if (window.__SETTINGS__) return window.__SETTINGS__;
  try {
    const res = await fetch(SETTINGS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load settings.json");
    const data = await res.json();
    window.__SETTINGS__ = data;
    return data;
  } catch (err) {
    console.error(err);
    window.__SETTINGS__ = {};
    return {};
  }
}

async function applySettings() {
  const settings = await loadSettings();
  document.querySelectorAll(".js-phone").forEach((el) => {
    if (settings.phone) el.setAttribute("href", "tel:" + settings.phone.replace(/[^+\d]/g, ""));
    if (settings.phone_display) el.textContent = settings.phone_display;
  });
  document.querySelectorAll(".js-email").forEach((el) => {
    if (settings.email) {
      el.setAttribute("href", "mailto:" + settings.email);
      el.textContent = settings.email;
    }
  });
  document.querySelectorAll(".js-address").forEach((el) => {
    if (settings.address) el.textContent = settings.address;
  });
}

function productName(p) {
  const lang = getLang();
  return (p.name && (p.name[lang] || p.name.en)) || "Untitled Product";
}

function productDescription(p) {
  const lang = getLang();
  return (p.description && (p.description[lang] || p.description.en)) || "";
}

function categoryLabel(cat) {
  const map = { health: "cat.health.name", beauty: "cat.beauty.name", food: "cat.food.name" };
  return t(map[cat] || "cat.health.name");
}

function categoryColorVar(cat) {
  const map = { health: "var(--color-teal)", beauty: "var(--color-plum)", food: "var(--color-amber)" };
  return map[cat] || "var(--color-blue)";
}

function firstImage(p) {
  if (p.images && p.images.length) return p.images[0];
  return "https://placehold.co/400x400/E8F1F8/2E6FA3?text=Pharmaline";
}

/* ---------------------------------------------------------------------
   Specials Ticker (renders on every page that has a #ticker element)
   --------------------------------------------------------------------- */
async function initTicker() {
  const el = document.getElementById("ticker");
  if (!el) return;

  const products = await loadProducts();
  const saleItems = products.filter((p) => p.sale);

  function render() {
    const track = el.querySelector(".ticker__track");
    if (!track) return;
    if (!saleItems.length) {
      track.innerHTML = `<span class="ticker__empty">${t("ticker.empty")}</span>`;
      return;
    }
    const itemsHtml = saleItems
      .map(
        (p) =>
          `<span class="ticker__item"><a href="product.html?sku=${encodeURIComponent(p.sku)}">${escapeHtml(productName(p))} — ${escapeHtml(t("product.sale.badge"))} #${escapeHtml(p.sku)}</a></span>`
      )
      .join("");
    // duplicate content so the marquee loop is seamless
    track.innerHTML = itemsHtml + itemsHtml;
  }

  render();
  document.addEventListener("langchange", render);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
  initTicker();
  applySettings();
});