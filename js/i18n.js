/* ==========================================================================
   i18n — English / French dictionary + switching logic
   Usage in HTML: <span data-i18n="nav.about">About Us</span>
   Usage for placeholders: <input data-i18n-placeholder="search.placeholder">
   ========================================================================== */

const DICT = {
  en: {
    "nav.home": "Home",
    "nav.about": "About Us",
    "nav.products": "Products",
    "nav.contact": "Contact",
    "nav.admin": "Admin",
    "ticker.label": "Specials",
    "ticker.empty": "No current specials — check back soon.",
    "hero.title": "Your partner in Health, Beauty & Food distribution",
    "hero.subtitle": "Pharmaline supplies retailers across Canada with a wide range of trusted products, working closely with manufacturers to bring competitive pricing and reliable delivery.",
    "hero.cta.products": "Browse the Catalog",
    "hero.cta.about": "About Us",
    "home.categories.title": "Shop by Category",
    "home.categories.subtitle": "Explore our full range across three product lines.",
    "cat.health.name": "Health",
    "cat.health.desc": "Vitamins, supplements, over-the-counter and personal wellness products.",
    "cat.beauty.name": "Beauty",
    "cat.beauty.desc": "Skincare, cosmetics, hair care and personal care essentials.",
    "cat.food.name": "Food",
    "cat.food.desc": "Grocery, snacks and specialty food products for retail shelves.",
    "cat.view": "View Products",
    "home.why.title": "Why Retailers Work With Us",
    "home.why.1.title": "Wide Product Range",
    "home.why.1.desc": "Thousands of products across Health, Beauty and Food, continually updated with new items.",
    "home.why.2.title": "Reliable Delivery",
    "home.why.2.desc": "Next-day delivery on stocked products for clients in the Montreal area.",
    "home.why.3.title": "Trusted Partnerships",
    "home.why.3.desc": "We work closely with manufacturers to bring you competitive pricing and consistent quality.",
    "products.title": "Our Products",
    "products.subtitle": "Browse our full catalog. Click any product for full details and specifications.",
    "products.search.placeholder": "Search by product name or SKU...",
    "products.filter.all": "All Categories",
    "products.empty": "No products match your search.",
    "products.sku": "SKU",
    "product.viewDetails": "View Details",
    "product.back": "Back to Products",
    "product.details.title": "Product Details",
    "product.spec.sku": "Product Number (SKU)",
    "product.spec.category": "Category",
    "product.spec.size": "Size",
    "product.spec.case": "Units per Case",
    "product.spec.pallet": "Cases per Pallet",
    "product.spec.pallet_units": "Units per Pallet",
    "product.sale.badge": "Special",
    "product.notFound": "Product not found.",
    "about.title": "About Pharmaline",
    "about.body1": "Pharmaline is a leading wholesale distributor of Health, Beauty and Food products, proudly serving retailers across Canada.",
    "about.body2": "Working closely with manufacturers allows us to offer a wide and continually growing range of products, backed by market research so we can bring the newest items to shelves around the country.",
    "about.body3": "We are proud to offer next-day delivery on stocked products to our clients in the Montreal area, and we strive to maintain strong, lasting relationships with every retailer and partner we work with.",
    "about.cta": "Get in Touch",
    "contact.title": "Contact Us",
    "contact.subtitle": "Have a question about a product, an order, or becoming a retail partner? Reach out any time.",
    "contact.phone": "Phone",
    "contact.email": "Email",
    "contact.address": "Address",
    "contact.form.title": "Send Us a Message",
    "contact.form.name": "Full Name",
    "contact.form.email": "Email Address",
    "contact.form.phone": "Phone Number",
    "contact.form.subject": "Subject",
    "contact.form.message": "Message",
    "contact.form.submit": "Send Message",
    "footer.tagline": "Wholesale distribution in Health, Beauty and Food across Canada.",
    "footer.links": "Quick Links",
    "footer.contact": "Contact",
    "footer.rights": "All Rights Reserved.",
    "footer.original": "Visit our main site",
  },
  fr: {
    "nav.home": "Accueil",
    "nav.about": "À propos",
    "nav.products": "Produits",
    "nav.contact": "Contact",
    "nav.admin": "Admin",
    "ticker.label": "Aubaines",
    "ticker.empty": "Aucune promotion en ce moment — revenez bientôt.",
    "hero.title": "Votre partenaire en distribution Santé, Beauté et Alimentation",
    "hero.subtitle": "Pharmaline approvisionne des détaillants partout au Canada avec une vaste gamme de produits fiables, en collaborant étroitement avec les fabricants pour offrir des prix compétitifs et une livraison fiable.",
    "hero.cta.products": "Parcourir le catalogue",
    "hero.cta.about": "À propos",
    "home.categories.title": "Magasiner par catégorie",
    "home.categories.subtitle": "Découvrez notre gamme complète répartie en trois lignes de produits.",
    "cat.health.name": "Santé",
    "cat.health.desc": "Vitamines, suppléments, produits en vente libre et de bien-être personnel.",
    "cat.beauty.name": "Beauté",
    "cat.beauty.desc": "Soins de la peau, cosmétiques, soins capillaires et essentiels de soins personnels.",
    "cat.food.name": "Alimentation",
    "cat.food.desc": "Épicerie, collations et produits alimentaires spécialisés pour les tablettes.",
    "cat.view": "Voir les produits",
    "home.why.title": "Pourquoi les détaillants nous font confiance",
    "home.why.1.title": "Vaste gamme de produits",
    "home.why.1.desc": "Des milliers de produits en Santé, Beauté et Alimentation, mis à jour continuellement.",
    "home.why.2.title": "Livraison fiable",
    "home.why.2.desc": "Livraison le lendemain sur les produits en stock pour nos clients de la région de Montréal.",
    "home.why.3.title": "Partenariats de confiance",
    "home.why.3.desc": "Nous collaborons étroitement avec les fabricants afin d'offrir des prix compétitifs et une qualité constante.",
    "products.title": "Nos produits",
    "products.subtitle": "Parcourez notre catalogue complet. Cliquez sur un produit pour tous les détails.",
    "products.search.placeholder": "Rechercher par nom de produit ou numéro SKU...",
    "products.filter.all": "Toutes les catégories",
    "products.empty": "Aucun produit ne correspond à votre recherche.",
    "products.sku": "SKU",
    "product.viewDetails": "Voir les détails",
    "product.back": "Retour aux produits",
    "product.details.title": "Détails du produit",
    "product.spec.sku": "Numéro de produit (SKU)",
    "product.spec.category": "Catégorie",
    "product.spec.size": "Format",
    "product.spec.case": "Unités par caisse",
    "product.spec.pallet": "Caisses par palette",
    "product.spec.pallet_units": "Unités par palette",
    "product.sale.badge": "Spécial",
    "product.notFound": "Produit introuvable.",
    "about.title": "À propos de Pharmaline",
    "about.body1": "Pharmaline est un chef de file de la distribution en gros de produits Santé, Beauté et Alimentation, fièrement au service des détaillants partout au Canada.",
    "about.body2": "Notre collaboration étroite avec les fabricants nous permet d'offrir une gamme vaste et en constante croissance, appuyée par des études de marché afin d'apporter les plus récents produits sur les tablettes du pays.",
    "about.body3": "Nous sommes fiers d'offrir une livraison le lendemain sur les produits en stock à nos clients de la région de Montréal, et nous nous efforçons de maintenir des relations solides et durables avec chaque détaillant et partenaire.",
    "about.cta": "Contactez-nous",
    "contact.title": "Contactez-nous",
    "contact.subtitle": "Une question sur un produit, une commande, ou vous souhaitez devenir partenaire détaillant? Écrivez-nous en tout temps.",
    "contact.phone": "Téléphone",
    "contact.email": "Courriel",
    "contact.address": "Adresse",
    "contact.form.title": "Envoyez-nous un message",
    "contact.form.name": "Nom complet",
    "contact.form.email": "Adresse courriel",
    "contact.form.phone": "Numéro de téléphone",
    "contact.form.subject": "Sujet",
    "contact.form.message": "Message",
    "contact.form.submit": "Envoyer le message",
    "footer.tagline": "Distribution en gros Santé, Beauté et Alimentation partout au Canada.",
    "footer.links": "Liens rapides",
    "footer.contact": "Contact",
    "footer.rights": "Tous droits réservés.",
    "footer.original": "Visitez notre site principal",
  }
};

const LANG_KEY = "pharmaline_lang";

function getLang() {
  return localStorage.getItem(LANG_KEY) || "en";
}

function setLang(lang) {
  localStorage.setItem(LANG_KEY, lang);
  applyLang(lang);
}

function t(key) {
  const lang = getLang();
  return (DICT[lang] && DICT[lang][key]) || (DICT.en[key]) || key;
}

function applyLang(lang) {
  document.documentElement.setAttribute("lang", lang);

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    el.setAttribute("placeholder", t(key));
  });

  document.querySelectorAll(".lang-toggle button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === lang);
  });

  // Let page-specific scripts know language changed, so they can
  // re-render dynamic content (product names/descriptions, etc.)
  document.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
}

function initLangToggle() {
  document.querySelectorAll(".lang-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });
  applyLang(getLang());
}

document.addEventListener("DOMContentLoaded", initLangToggle);