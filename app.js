const ZAKAT_RATE = 0.025;
const NISAB_GRAMS = {
  gold: 87.48,
  silver: 612.36
};

const METAL_PRICE_DEFAULTS = {
  USD: { gold: 70, silver: 0.9 },
  EUR: { gold: 64, silver: 0.83 },
  GBP: { gold: 55, silver: 0.71 },
  PKR: { gold: 19500, silver: 250 }
};

const REGION_TO_CURRENCY = {
  US: "USD",
  GB: "GBP",
  PK: "PKR"
};

const EURO_REGION_CODES = new Set([
  "AT", "BE", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT",
  "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES", "HR"
]);

const els = {
  assetList: document.getElementById("asset-list"),
  liabilityList: document.getElementById("liability-list"),
  addAssetBtn: document.getElementById("add-asset"),
  addLiabilityBtn: document.getElementById("add-liability"),
  calculateBtn: document.getElementById("calculate"),
  template: document.getElementById("custom-field-template"),
  currency: document.getElementById("currency"),
  nisabBasis: document.getElementById("nisab-basis"),
  goldPrice: document.getElementById("gold-price"),
  silverPrice: document.getElementById("silver-price"),
  totalAssets: document.getElementById("total-assets"),
  totalLiabilities: document.getElementById("total-liabilities"),
  netAmount: document.getElementById("net-amount"),
  nisabThreshold: document.getElementById("nisab-threshold"),
  status: document.getElementById("status"),
  zakatPayable: document.getElementById("zakat-payable")
};

function safeNumber(value) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function sumGroup(selector) {
  return [...document.querySelectorAll(selector)].reduce(
    (total, input) => total + safeNumber(input.value),
    0
  );
}

function moneyFormatter() {
  const currency = els.currency.value;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  });
}

function setOutput(el, amount, formatter) {
  el.textContent = formatter.format(amount || 0);
}

function regionFromLocale(locale) {
  if (!locale) return null;
  try {
    if (typeof Intl.Locale === "function") {
      const region = new Intl.Locale(locale).maximize().region;
      if (region) return region.toUpperCase();
    }
  } catch (_) {}
  const matched = locale.match(/-([a-z]{2})\b/i);
  return matched ? matched[1].toUpperCase() : null;
}

function currencyFromTimeZone() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  if (zone === "Europe/London") return "GBP";
  if (zone === "Asia/Karachi") return "PKR";
  if (zone.startsWith("Europe/")) return "EUR";
  if (
    zone.startsWith("America/New_York") ||
    zone.startsWith("America/Chicago") ||
    zone.startsWith("America/Denver") ||
    zone.startsWith("America/Los_Angeles") ||
    zone.startsWith("America/Phoenix") ||
    zone.startsWith("America/Anchorage") ||
    zone.startsWith("America/Adak") ||
    zone.startsWith("Pacific/Honolulu")
  ) {
    return "USD";
  }
  return null;
}

function detectCurrencyFromBrowserCountry() {
  const localeCandidates = [...(navigator.languages || []), navigator.language];
  for (const locale of localeCandidates) {
    const region = regionFromLocale(locale);
    if (!region) continue;
    if (REGION_TO_CURRENCY[region]) return REGION_TO_CURRENCY[region];
    if (EURO_REGION_CODES.has(region)) return "EUR";
  }
  const fromTimeZone = currencyFromTimeZone();
  if (fromTimeZone) return fromTimeZone;
  return "USD";
}

function initializeCurrencyFromRegion() {
  const detected = detectCurrencyFromBrowserCountry();
  const supported = new Set(
    [...els.currency.options].map((option) => option.value)
  );
  els.currency.value = supported.has(detected) ? detected : "USD";
}

function applyCurrencyDefaults() {
  const defaults = METAL_PRICE_DEFAULTS[els.currency.value];
  if (!defaults) return;
  els.goldPrice.value = defaults.gold;
  els.silverPrice.value = defaults.silver;
}

function calculateZakat() {
  const totalAssets = sumGroup(".amount.asset");
  const totalLiabilities = sumGroup(".amount.liability");
  const netAmount = Math.max(totalAssets - totalLiabilities, 0);

  const goldPrice = safeNumber(els.goldPrice.value);
  const silverPrice = safeNumber(els.silverPrice.value);
  const basis = els.nisabBasis.value;
  const pricePerGram = basis === "gold" ? goldPrice : silverPrice;
  const nisabThreshold = NISAB_GRAMS[basis] * pricePerGram;

  const zakatDue = netAmount >= nisabThreshold && nisabThreshold > 0;
  const zakatAmount = zakatDue ? netAmount * ZAKAT_RATE : 0;

  const formatter = moneyFormatter();
  setOutput(els.totalAssets, totalAssets, formatter);
  setOutput(els.totalLiabilities, totalLiabilities, formatter);
  setOutput(els.netAmount, netAmount, formatter);
  setOutput(els.nisabThreshold, nisabThreshold, formatter);
  setOutput(els.zakatPayable, zakatAmount, formatter);

  if (zakatDue) {
    els.status.textContent = "Eligible for Zakat";
    els.status.classList.remove("no");
  } else {
    els.status.textContent = "Below Nisab";
    els.status.classList.add("no");
  }
}

function createCustomField(type) {
  const fragment = els.template.content.cloneNode(true);
  const row = fragment.querySelector(".custom-field-row");
  const amountInput = fragment.querySelector(".amount");
  const removeBtn = fragment.querySelector(".remove-btn");

  amountInput.classList.add(type);
  removeBtn.addEventListener("click", () => {
    row.remove();
    calculateZakat();
  });

  amountInput.addEventListener("input", calculateZakat);

  return fragment;
}

function registerRealtimeInputs() {
  document.addEventListener("input", (event) => {
    const target = event.target;
    if (
      target.matches(".amount") ||
      target.matches("#gold-price") ||
      target.matches("#silver-price")
    ) {
      calculateZakat();
    }
  });

  els.nisabBasis.addEventListener("change", calculateZakat);

  els.currency.addEventListener("change", () => {
    applyCurrencyDefaults();
    calculateZakat();
  });
}

els.addAssetBtn.addEventListener("click", () => {
  els.assetList.appendChild(createCustomField("asset"));
});

els.addLiabilityBtn.addEventListener("click", () => {
  els.liabilityList.appendChild(createCustomField("liability"));
});

els.calculateBtn.addEventListener("click", calculateZakat);

registerRealtimeInputs();
initializeCurrencyFromRegion();
applyCurrencyDefaults();
calculateZakat();
