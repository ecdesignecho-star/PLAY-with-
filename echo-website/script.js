/* EC workshop enrollment: edit pricing and coupon rules here. */
const COURSE_CONFIG = {
  classes: ["第一堂｜城市街景 01", "第二堂｜城市街景 02", "第三堂｜城市街景 03"],
  plans: {
    single: { label: "單堂體驗", detail: "挑一堂或多堂・每堂 NT$890", type: "perClass", unitPrice: 890 },
    series: { label: "三堂系列", detail: "三堂一起畫，系列方案", type: "fixed", price: 2400, requiresAllClasses: true },
    henry: { label: "Henry 老師專屬", detail: "每堂 NT$700・三堂 NT$2,100", type: "perClass", unitPrice: 700 },
    ec: { label: "EC 學員專屬", detail: "曾參加 EC 課程或活動・三堂 NT$2,100", type: "fixed", price: 2100, requiresAllClasses: true }
  },
  coupons: {
    HENRY20: { label: "Henry 粉絲優惠", plans: ["single", "series"], discount: "henry", eligibleMessage: "Henry 粉絲優惠已套用。" },
    ECPLAY: { label: "EC 學員優惠", plans: ["series"], discount: "fixed2100", eligibleMessage: "EC 學員優惠已套用。" },
    FRIEND10: { label: "朋友推薦 9 折", plans: ["single", "series"], discount: "percent10", eligibleMessage: "朋友推薦 9 折已套用。" }
  },
  capacity: { minimum: 6, maximum: 16, almostFullAt: 12 }
};

/*
 * Replace this adapter with a Supabase/Firebase/API implementation for real
 * registrations. The mock exists only in memory and resets on page reload.
 * Never expose a service-role key in this static frontend.
 */
const MockEnrollmentStore = (() => {
  const rows = [];
  return {
    async list() { return rows.map((row) => ({ ...row })); },
    async getPublicCount() { return rows.filter((row) => row.enrollment_status !== "waitlist").length; },
    async save(record) { rows.push({ ...record }); return { ok: true }; }
  };
})();
const enrollmentStore = window.ECWorkshopDataStore || MockEnrollmentStore;

const form = document.querySelector("#signup-form");
const formView = document.querySelector("#signup-form-view");
const successView = document.querySelector("#success-view");
const planChoices = document.querySelector("#plan-choices");
const classChoices = document.querySelector("#class-choices");
const formCoupon = document.querySelector("#form-coupon");
const priceCoupon = document.querySelector("#price-coupon");
const errorBox = document.querySelector("#form-error");
let appliedCoupon = "";
let currentRecords = [];
let currentEnrollmentCount = 0;
let registrationSource = "direct";

function money(value) {
  return `NT$${Math.max(0, Math.round(value)).toLocaleString("zh-TW")}`;
}

function getPlanKey() {
  return form.querySelector('input[name="course_plan"]:checked')?.value || "henry";
}

function selectedClassIndexes() {
  return [...form.querySelectorAll('input[name="class_selection"]:checked')].map((input) => Number(input.value));
}

function planTotal(planKey, classCount) {
  const plan = COURSE_CONFIG.plans[planKey];
  if (!plan) return 0;
  if (plan.type === "perClass") return plan.unitPrice * classCount;
  return plan.price;
}

function normalizeCoupon(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function calculatePrice(planKey = getPlanKey(), classCount = selectedClassIndexes().length, couponCode = appliedCoupon) {
  const original = planTotal(planKey, classCount);
  const code = normalizeCoupon(couponCode);
  let final = original;
  let discount = 0;
  let error = "";
  const coupon = COURSE_CONFIG.coupons[code];
  if (code) {
    if (!coupon) error = "找不到這組優惠碼，請確認拼寫。";
    else if (!coupon.plans.includes(planKey)) error = "此優惠碼不適用於目前選擇的方案。";
    else if (classCount === 0) error = "請先選擇堂次，再套用優惠碼。";
    else {
      if (coupon.discount === "henry") final = classCount * 700;
      if (coupon.discount === "fixed2100") final = 2100;
      if (coupon.discount === "percent10") final = Math.round(original * 0.9);
      discount = Math.max(0, original - final);
    }
  }
  return { original, discount, final, couponCode: error ? "" : code, error, coupon };
}

function renderPriceCards() {
  const cards = [
    { plan: "single", title: "一般單堂", price: 890, unit: "／堂", note: "適合想先體驗一堂工作坊的你。", detail: "彈性選擇堂次" },
    { plan: "series", title: "三堂系列", price: 2400, unit: "／3 堂", note: "平均 NT$800／堂，從觀察一路畫到完成。", detail: "推薦方案", featured: true },
    { plan: "henry", title: "Henry 老師專屬", price: 700, unit: "／堂", old: 890, note: "三堂一起報名 NT$2,100。", detail: "Henry 粉絲專屬價" },
    { plan: "ec", title: "EC 學員專屬", price: 2100, unit: "／3 堂", note: "曾參加 EC 課程或活動的學員專屬。", detail: "EC 舊學員優惠價" }
  ];
  const root = document.querySelector("#price-cards");
  root.replaceChildren(...cards.map((card) => {
    const article = document.createElement("article");
    article.className = `price-card${card.featured ? " featured" : ""}`;
    article.innerHTML = `${card.featured ? '<span class="badge">推薦方案</span>' : ""}<h3>${card.title}</h3><div class="price-number">${money(card.price)}<small>${card.unit}</small></div><p class="price-was">${card.old ? `原價 ${money(card.old)}／堂` : ""}</p><p class="price-sub">${card.note}</p><span class="price-meta">${card.detail}</span><button class="price-select" type="button" data-plan="${card.plan}">選這個方案 ↓</button>`;
    article.querySelector("button").addEventListener("click", () => {
      selectPlan(card.plan);
      document.querySelector("#signup").scrollIntoView({ behavior: "smooth" });
    });
    return article;
  }));
}

function renderPlans() {
  planChoices.replaceChildren(...Object.entries(COURSE_CONFIG.plans).map(([key, plan]) => {
    const label = document.createElement("label");
    label.className = "plan-choice";
    const displayedPrice = plan.type === "fixed" ? money(plan.price) : `${money(plan.unitPrice)}／堂`;
    label.innerHTML = `<input type="radio" name="course_plan" value="${key}" ${key === "henry" ? "checked" : ""}><span><b>${plan.label}</b><small>${plan.detail}</small></span><span class="plan-price">${displayedPrice}</span>`;
    label.querySelector("input").addEventListener("change", () => {
      if (plan.requiresAllClasses) setAllClasses(true);
      else setAllClasses(false);
      syncCouponFields();
      updatePriceSummary();
    });
    return label;
  }));
}

function renderClassChoices() {
  classChoices.replaceChildren(...COURSE_CONFIG.classes.map((title, index) => {
    const label = document.createElement("label");
    label.className = "class-choice";
    label.innerHTML = `<input type="checkbox" name="class_selection" value="${index}"><span>${title}</span>`;
    label.querySelector("input").addEventListener("change", () => {
      if (COURSE_CONFIG.plans[getPlanKey()].requiresAllClasses) setAllClasses(true);
      updatePriceSummary();
    });
    return label;
  }));
}

function setAllClasses(checked) {
  classChoices.querySelectorAll('input[name="class_selection"]').forEach((input) => {
    if (checked) input.checked = true;
    input.disabled = checked;
  });
  document.querySelector("#class-selection-hint").textContent = checked ? "此方案包含三堂，已為你選好全部堂次。" : "單堂體驗與 Henry 專屬方案可選一堂或多堂。";
}

function selectPlan(planKey) {
  const radio = form.querySelector(`input[name="course_plan"][value="${planKey}"]`);
  if (!radio) return;
  radio.checked = true;
  if (COURSE_CONFIG.plans[planKey].requiresAllClasses) setAllClasses(true);
  else setAllClasses(false);
  syncCouponFields();
  updatePriceSummary();
}

function syncCouponFields() {
  formCoupon.value = appliedCoupon;
  priceCoupon.value = appliedCoupon;
}

function updatePriceSummary() {
  const planKey = getPlanKey();
  const count = selectedClassIndexes().length;
  const price = calculatePrice(planKey, count);
  document.querySelector("#summary-original").textContent = money(price.original);
  document.querySelector("#summary-discount").textContent = `−${money(price.discount)}`;
  document.querySelector("#summary-total").textContent = money(price.final);
  document.querySelector("#sticky-price").textContent = planKey === "henry" ? `${money(COURSE_CONFIG.plans.henry.unitPrice)}／堂` : `${money(price.final)} 起`;
  const feedback = document.querySelector("#coupon-feedback");
  if (appliedCoupon) {
    const evaluated = calculatePrice(planKey, count, appliedCoupon);
    if (evaluated.error) {
      feedback.textContent = evaluated.error;
      feedback.classList.add("error-text");
    } else {
      feedback.textContent = `${evaluated.coupon.eligibleMessage} 折抵 ${money(evaluated.discount)}。`;
      feedback.classList.remove("error-text");
    }
  } else {
    feedback.textContent = "優惠碼不可併用，每人限用一組。";
    feedback.classList.remove("error-text");
  }
}

function applyCoupon(rawValue) {
  const raw = String(rawValue || "");
  const code = normalizeCoupon(raw);
  const result = calculatePrice(getPlanKey(), selectedClassIndexes().length, code);
  const inline = document.querySelector("#coupon-inline-feedback");
  const formFeedback = document.querySelector("#coupon-feedback");
  if (!code) {
    appliedCoupon = "";
    inline.textContent = "已清除優惠碼。";
    inline.classList.remove("error-text");
  } else if (result.error) {
    appliedCoupon = "";
    inline.textContent = result.error;
    inline.classList.add("error-text");
  } else {
    appliedCoupon = code;
    inline.textContent = `${result.coupon.eligibleMessage} 折抵 ${money(result.discount)}。`;
    inline.classList.remove("error-text");
  }
  if (result.error) {
    formCoupon.value = raw;
    priceCoupon.value = raw;
  } else {
    syncCouponFields();
  }
  updatePriceSummary();
  if (formFeedback && !result.error && code) formFeedback.textContent = `${result.coupon.eligibleMessage} 折抵 ${money(result.discount)}。`;
}

function handleCouponTyping(input, peer) {
  const raw = input.value;
  const code = normalizeCoupon(raw);
  peer.value = raw;
  if (!code) {
    appliedCoupon = "";
    document.querySelector("#coupon-inline-feedback").textContent = "";
    document.querySelector("#coupon-inline-feedback").classList.remove("error-text");
    updatePriceSummary();
    return;
  }
  if (Object.hasOwn(COURSE_CONFIG.coupons, code)) {
    applyCoupon(code);
    return;
  }
  appliedCoupon = "";
  updatePriceSummary();
  const message = code.length >= 4 ? "找不到這組優惠碼，請確認拼寫。" : "輸入優惠碼中…";
  const inline = document.querySelector("#coupon-inline-feedback");
  inline.textContent = message;
  inline.classList.toggle("error-text", code.length >= 4);
  document.querySelector("#coupon-feedback").textContent = message;
  document.querySelector("#coupon-feedback").classList.toggle("error-text", code.length >= 4);
}

function sourceFromUrl() {
  const querySource = new URLSearchParams(window.location.search).get("source");
  registrationSource = (querySource || "direct").trim().slice(0, 80) || "direct";
}

function classStatus(count) {
  const { minimum, maximum, almostFullAt } = COURSE_CONFIG.capacity;
  if (count >= maximum) return "已滿班";
  if (count >= almostFullAt) return "即將滿班";
  if (count >= minimum) return "已達成班門檻";
  return "招生中";
}

async function refreshAdmin() {
  try { currentRecords = await enrollmentStore.list(); }
  catch { currentRecords = []; }
  const enrolled = currentRecords.filter((record) => record.enrollment_status !== "waitlist");
  const paid = enrolled.filter((record) => record.payment_status === "paid");
  const pending = enrolled.filter((record) => record.payment_status === "pending");
  let seatCount = enrolled.length;
  if (typeof enrollmentStore.getPublicCount === "function") {
    try { seatCount = Math.max(0, Number(await enrollmentStore.getPublicCount()) || 0); }
    catch { /* Public capacity summary is optional; fall back to authorized records. */ }
  }
  const revenue = paid.reduce((sum, record) => sum + (Number(record.final_price) || 0), 0);
  const usedCoupons = currentRecords.filter((record) => record.coupon_code && record.enrollment_status !== "waitlist").length;
  const newCount = enrolled.filter((record) => record.previous_ec_customer === "沒有，這是我第一次來 EC").length;
  const returningCount = enrolled.length - newCount;
  const stats = [
    ["總報名人數", enrolled.length], ["已付款人數", paid.length], ["待付款人數", pending.length],
    ["目前班級人數", seatCount], ["距 6 人成班", Math.max(0, COURSE_CONFIG.capacity.minimum - seatCount)],
    ["距 16 人滿班", Math.max(0, COURSE_CONFIG.capacity.maximum - seatCount)], ["已收營收", money(revenue)],
    ["優惠碼使用次數", usedCoupons], ["新客比例", `${enrolled.length ? Math.round(newCount / enrolled.length * 100) : 0}%`],
    ["EC 舊客比例", `${enrolled.length ? Math.round(returningCount / enrolled.length * 100) : 0}%`]
  ];
  document.querySelector("#admin-stats").replaceChildren(...stats.map(([label, value]) => {
    const item = document.createElement("div"); item.className = "admin-stat";
    const name = document.createElement("span"); name.textContent = label;
    const number = document.createElement("b"); number.textContent = value;
    item.append(name, number); return item;
  }));
  fillBreakdown("#source-breakdown", enrolled, "source", "direct");
  fillBreakdown("#coupon-breakdown", currentRecords, "coupon_code", "（無優惠碼）");
  updateCapacity(seatCount);
}

function fillBreakdown(target, rows, key, emptyLabel = "direct") {
  const counts = new Map();
  rows.forEach((row) => {
    const value = row[key] || emptyLabel;
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  const list = document.querySelector(target);
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!entries.length) entries.push(["目前沒有報名資料", 0]);
  list.replaceChildren(...entries.map(([label, count]) => {
    const li = document.createElement("li");
    const name = document.createElement("span"); name.textContent = label;
    const number = document.createElement("b"); number.textContent = count;
    li.append(name, number); return li;
  }));
}

function updateCapacity(count) {
  currentEnrollmentCount = count;
  document.querySelector("#seat-count").textContent = count;
  document.querySelector("#class-status").textContent = classStatus(count);
  document.querySelector("#seat-progress").style.width = `${Math.min(100, count / COURSE_CONFIG.capacity.maximum * 100)}%`;
  const full = count >= COURSE_CONFIG.capacity.maximum;
  document.querySelector("#seat-full-note").hidden = !full;
  document.querySelector("#payment-fieldset").hidden = full;
  document.querySelector("#submit-button").innerHTML = full ? "加入候補名單 <span>↗</span>" : "送出報名 <span>↗</span>";
  if (full) form.querySelectorAll('input[name="payment_method"]').forEach((input) => input.required = false);
  else form.querySelectorAll('input[name="payment_method"]').forEach((input) => input.required = true);
}

function clearErrors() {
  errorBox.textContent = "";
  form.querySelectorAll(".invalid").forEach((element) => element.classList.remove("invalid"));
}

function validateForm(waitlist) {
  clearErrors();
  const invalid = [];
  form.querySelectorAll("[required]").forEach((field) => {
    if (field.type === "radio") {
      if (!form.querySelector(`input[name="${field.name}"]:checked`)) invalid.push(field);
    } else if (!field.value.trim()) invalid.push(field);
  });
  const email = form.elements.email;
  if (email.value && !email.validity.valid) invalid.push(email);
  const phone = form.elements.phone;
  if (phone.value && !/^[+0-9()\-\s]{8,20}$/.test(phone.value.trim())) invalid.push(phone);
  const paymentLast5 = form.elements.payment_last5;
  if (!waitlist && paymentLast5.value && !/^\d{5}$/.test(paymentLast5.value.trim())) invalid.push(paymentLast5);
  if (!selectedClassIndexes().length) invalid.push(classChoices);
  if (invalid.length) {
    invalid.forEach((field) => field.classList?.add("invalid"));
    errorBox.textContent = "還有必填欄位未完成，請檢查標示欄位與報名堂次。";
    const first = invalid[0].nodeType === 1 ? invalid[0] : classChoices;
    first.scrollIntoView({ behavior: "smooth", block: "center" });
    if (first.focus) first.focus({ preventScroll: true });
    return false;
  }
  if (!waitlist && !form.querySelector('input[name="payment_method"]:checked')) {
    errorBox.textContent = "請選擇付款方式。";
    document.querySelector("#payment-fieldset").scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }
  return true;
}

function collectRegistration(waitlist) {
  const planKey = getPlanKey();
  const selected = selectedClassIndexes().map((index) => COURSE_CONFIG.classes[index]);
  const price = calculatePrice(planKey, selected.length, appliedCoupon);
  const data = new FormData(form);
  const timestamp = new Date().toISOString();
  return {
    timestamp,
    name: data.get("name").trim(),
    email: data.get("email").trim(),
    phone: data.get("phone").trim(),
    instagram: data.get("instagram").trim(),
    course_plan: planKey,
    class_selection: selected,
    coupon_code: price.couponCode,
    original_price: price.original,
    discount_amount: price.discount,
    final_price: price.final,
    acquisition_source: data.get("acquisition_source"),
    source: registrationSource,
    previous_ec_customer: data.get("previous_ec_customer"),
    creative_experience: data.get("creative_experience"),
    payment_method: waitlist ? "not_applicable" : data.get("payment_method"),
    payer_name: waitlist ? "" : data.get("payer_name").trim(),
    payment_last5: waitlist ? "" : data.get("payment_last5").trim(),
    payment_status: waitlist ? "not_applicable" : "pending",
    enrollment_status: waitlist ? "waitlist" : "pending"
  };
}

async function handleSubmit(event) {
  event.preventDefault();
  const enrolledCount = currentEnrollmentCount;
  const waitlist = enrolledCount >= COURSE_CONFIG.capacity.maximum;
  if (!validateForm(waitlist)) return;
  const record = collectRegistration(waitlist);
  const submitButton = document.querySelector("#submit-button");
  submitButton.disabled = true;
  try {
    await enrollmentStore.save(record);
    formView.hidden = true;
    successView.hidden = false;
    document.querySelector(".mobile-sticky").hidden = true;
    if (waitlist) {
      successView.querySelector("h3").textContent = "你已加入候補名單。";
      const paragraphs = successView.querySelectorAll("p:not(.eyebrow):not(.demo-warning)");
      paragraphs[0].textContent = "謝謝你想加入 Henry 老師的城市街景速寫。";
      paragraphs[1].textContent = "本梯次目前已滿班。若有名額釋出，EC 會再與你聯繫。";
    }
    document.querySelector("#demo-warning").textContent = enrollmentStore === MockEnrollmentStore
      ? "此為瀏覽器內示範：資料僅暫存於目前分頁，關閉或重新整理後會清除。正式報名資料尚未傳送至 EC。"
      : "已收到報名資料。";
    await refreshAdmin();
    successView.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    errorBox.textContent = "目前無法送出，請稍後再試或聯絡 EC。";
    submitButton.disabled = false;
    console.error("Enrollment adapter error", error);
  }
}

document.querySelector("#apply-price-coupon").addEventListener("click", () => applyCoupon(priceCoupon.value));
document.querySelector("#apply-form-coupon").addEventListener("click", () => applyCoupon(formCoupon.value));
priceCoupon.addEventListener("input", () => handleCouponTyping(priceCoupon, formCoupon));
formCoupon.addEventListener("input", () => handleCouponTyping(formCoupon, priceCoupon));
priceCoupon.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); applyCoupon(priceCoupon.value); } });
formCoupon.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); applyCoupon(formCoupon.value); } });
form.addEventListener("change", (event) => {
  if (event.target.name === "course_plan" || event.target.name === "class_selection") updatePriceSummary();
  event.target.classList.remove("invalid");
  if (event.target.name === "class_selection") classChoices.classList.remove("invalid");
});
form.addEventListener("input", (event) => event.target.classList.remove("invalid"));
form.addEventListener("submit", handleSubmit);

async function initialize() {
  sourceFromUrl();
  renderPriceCards();
  renderPlans();
  renderClassChoices();
  setAllClasses(false);
  classChoices.querySelector('input[name="class_selection"]')?.click();
  selectPlan("henry");
  await refreshAdmin();
}

initialize();
