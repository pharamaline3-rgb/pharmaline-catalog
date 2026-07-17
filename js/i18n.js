/* ==========================================================================
   i18n — English / French dictionary + switching logic
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
    "hero.title": "Your one-stop wholesale supplier",
    "hero.subtitle": "Pharmaline supplies retailers across Canada with a wide range of trusted products, working closely with manufacturers to bring competitive pricing and reliable delivery.",
    "hero.cta.products": "Browse the Catalog",
    "hero.cta.about": "About Us",
    "home.categories.title": "Shop by Category",
    "home.categories.subtitle": "Explore our full product range.",
    "cat.baby.name": "Baby",
    "cat.baby.desc": "Diapers, training pants, and baby care essentials.",
    "cat.health_beauty.name": "Health & Beauty",
    "cat.health_beauty.desc": "Personal care, hair care, oral care, and wellness products.",
    "cat.grocery.name": "Grocery",
    "cat.grocery.desc": "Cereal, coffee, cooking oil, and pantry staples.",
    "cat.drinks.name": "Drinks",
    "cat.drinks.desc": "Soft drinks, sodas, and beverages.",
    "cat.cleaning.name": "Cleaning",
    "cat.cleaning.desc": "Dish soap, all-purpose cleaners, and specialty cleaning products.",
    "cat.household.name": "Household",
    "cat.household.desc": "Dishwasher detergent, hand soap, and household essentials.",
    "cat.laundry_fabric.name": "Laundry & Fabric Care",
    "cat.laundry_fabric.desc": "Detergents, fabric softeners, and dryer sheets.",
    "cat.paper.name": "Paper Products",
    "cat.paper.desc": "Toilet paper, paper towels, facial tissue, and napkins.",
    "cat.bags_wraps.name": "Bags & Wraps",
    "cat.bags_wraps.desc": "Garbage bags, cling wrap, and food storage bags.",
    "cat.air_freshener.name": "Air Freshener",
    "cat.air_freshener.desc": "Sprays and fabric refreshers.",
    "cat.view": "View Products",
    "home.why.title": "Why Retailers Work With Us",
    "home.why.1.title": "Wide Product Range",
    "home.why.1.desc": "Hundreds of products across every category, continually updated with new items.",
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
    "about.body1": "Pharmaline is a leading wholesale distributor, proudly serving retailers across Canada.",
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
    "footer.tagline": "Wholesale distribution across Canada.",
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
    "hero.title": "Votre fournisseur en gros tout-en-un",
    "hero.subtitle": "Pharmaline approvisionne des détaillants partout au Canada avec une vaste gamme de produits fiables, en collaborant étroitement avec les fabricants pour offrir des prix compétitifs et une livraison fiable.",
    "hero.cta.products": "Parcourir le catalogue",
    "hero.cta.about": "À propos",
    "home.categories.title": "Magasiner par catégorie",
    "home.categories.subtitle": "Découvrez notre gamme complète de produits.",
    "cat.baby.name": "Bébé",
    "cat.baby.desc": "Couches, culottes d'entraînement et essentiels pour bébé.",
    "cat.health_beauty.name": "Santé et beauté",
    "cat.health_beauty.desc": "Soins personnels, soins capillaires, soins buccaux et produits de bien-être.",
    "cat.grocery.name": "Épicerie",
    "cat.grocery.desc": "Céréales, café, huile de cuisson et produits de base.",
    "cat.drinks.name": "Boissons",
    "cat.drinks.desc": "Boissons gazeuses et autres breuvages.",
    "cat.cleaning.name": "Nettoyage",
    "cat.cleaning.desc": "Savon à vaisselle, nettoyants tout usage et produits de nettoyage spécialisés.",
    "cat.household.name": "Articles ménagers",
    "cat.household.desc": "Détergent à lave-vaisselle, savon à main et essentiels pour la maison.",
    "cat.laundry_fabric.name": "Lessive et soin des tissus",
    "cat.laundry_fabric.desc": "Détergents, assouplissants et feuilles pour sécheuse.",
    "cat.paper.name": "Produits en papier",
    "cat.paper.desc": "Papier hygiénique, essuie-tout, mouchoirs et serviettes de table.",
    "cat.bags_wraps.name": "Sacs et pellicules",
    "cat.bags_wraps.desc": "Sacs à ordures, pellicule plastique et sacs de conservation.",
    "cat.air_freshener.name": "Assainisseur d'air",
    "cat.air_freshener.desc": "Vaporisateurs et rafraîchisseurs de tissus.",
    "cat.view": "Voir les produits",
    "home.why.title": "Pourquoi les détaillants nous font confiance",
    "home.why.1.title": "Vaste gamme de produits",
    "home.why.1.desc": "Des centaines de produits dans toutes les catégories, mis à jour continuellement.",
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
    "about.body1": "Pharmaline est un chef de file de la distribution en gros, fièrement au service des détaillants partout au Canada.",
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
    "footer.tagline": "Distribution en gros partout au Canada.",
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

  document.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
}

function initLangToggle() {
  document.querySelectorAll(".lang-toggle button").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });
  applyLang(getLang());
}

document.addEventListener("DOMContentLoaded", initLangToggle);