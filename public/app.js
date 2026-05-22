const screens = {
  packages: document.querySelector("#packages-screen"),
  payment: document.querySelector("#payment-screen"),
  ready: document.querySelector("#ready-screen")
};

const packageGrid = document.querySelector("#package-grid");
const paymentStatus = document.querySelector("#payment-status");
const qrFrame = document.querySelector("#qr-frame");
const testLink = document.querySelector("#test-link");
const backButton = document.querySelector("#back-button");
const startOverButton = document.querySelector("#start-over-button");
const countdown = document.querySelector("#countdown");

let activeOrder = null;
let boothConfig = null;
let pollTimer = null;
let countdownTimer = null;

boot();

async function boot() {
  const boothId = new URLSearchParams(window.location.search).get("boothId") || localStorage.getItem("boothId") || "";
  const query = boothId ? `?boothId=${encodeURIComponent(boothId)}` : "";
  const response = await fetch(`/api/booth/config${query}`);
  const data = await response.json();

  if (!response.ok) {
    packageGrid.innerHTML = `<div class="empty-state">${escapeHtml(data.error || "Unable to load booth config.")}</div>`;
    return;
  }

  boothConfig = data.booth;
  localStorage.setItem("boothId", boothConfig.id);
  document.querySelector("#booth-location").textContent = `${boothConfig.displayName} / ${boothConfig.locationName}`;
  document.querySelector("#booth-status").textContent = boothConfig.status === "active" ? "Ready" : boothConfig.status;
  document.title = boothConfig.displayName;

  packageGrid.innerHTML = data.packages.map(renderPackage).join("");

  packageGrid.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => createOrder(button.dataset.packageId));
  });
}

function renderPackage(item) {
  return `
    <button class="package-card" type="button" data-package-id="${item.id}">
      <span>
        <p class="eyebrow">${item.shots} shots / ${item.prints} prints</p>
        <h2>${escapeHtml(item.name)}</h2>
        <p>${escapeHtml(item.description)}</p>
      </span>
      <span>
        <span class="price">${escapeHtml(item.amountLabel)}</span>
        <span class="meta-row">
          <span>${item.shots} poses</span>
          <span>${item.prints} prints</span>
        </span>
      </span>
    </button>
  `;
}

async function createOrder(packageId) {
  showScreen("payment");
  setPaymentStatus("Creating secure QR payment...");
  setQrPlaceholder();
  testLink.classList.add("hidden");

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ boothId: boothConfig.id, packageId })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to create order.");
    }

    activeOrder = data.order;
    renderOrder(activeOrder, data.demoMode);

    if (activeOrder.status === "paid") {
      setPaymentStatus("Demo payment confirmed.");
      setTimeout(showReadyScreen, 900);
      return;
    }

    setPaymentStatus("Waiting for payment confirmation...");
    startPolling(activeOrder.id);
  } catch (error) {
    setPaymentStatus(error.message);
  }
}

function renderOrder(order, demoMode = false) {
  document.querySelector("#summary-name").textContent = order.packageName;
  document.querySelector("#summary-booth").textContent = `${order.boothName} / ${order.locationName}`;
  document.querySelector("#summary-description").textContent = order.packageDescription;
  document.querySelector("#summary-amount").textContent = order.amountLabel;
  document.querySelector("#summary-shots").textContent = order.shots;
  document.querySelector("#summary-prints").textContent = order.prints;

  if (order.qrImage) {
    qrFrame.innerHTML = `<img src="${order.qrImage}" alt="QR Ph payment code">`;
  } else if (demoMode) {
    qrFrame.innerHTML = `<div class="qr-placeholder">PAID</div>`;
  } else {
    setQrPlaceholder();
  }

  if (order.testUrl) {
    testLink.href = order.testUrl;
    testLink.classList.remove("hidden");
  }
}

function startPolling(orderId) {
  stopPolling();

  pollTimer = window.setInterval(async () => {
    const response = await fetch(`/api/orders/${orderId}`);
    const data = await response.json();

    if (!response.ok) {
      setPaymentStatus(data.error || "Unable to check payment.");
      return;
    }

    activeOrder = data.order;

    if (activeOrder.status === "paid") {
      stopPolling();
      setPaymentStatus("Payment confirmed.");
      showReadyScreen();
      return;
    }

    if (activeOrder.status === "expired") {
      stopPolling();
      setPaymentStatus("QR expired. Please go back and create a new session.");
      return;
    }

    if (activeOrder.status === "failed") {
      stopPolling();
      setPaymentStatus("Payment failed. Please try again.");
    }
  }, 1800);
}

function showReadyScreen() {
  showScreen("ready");
  startCountdown();
}

function startCountdown() {
  window.clearInterval(countdownTimer);
  let seconds = 5;
  countdown.textContent = seconds;

  countdownTimer = window.setInterval(() => {
    seconds -= 1;
    countdown.textContent = Math.max(seconds, 0);

    if (seconds <= 0) {
      window.clearInterval(countdownTimer);
      countdown.textContent = "GO";
    }
  }, 1000);
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
}

function setPaymentStatus(message) {
  paymentStatus.textContent = message;
}

function setQrPlaceholder() {
  qrFrame.innerHTML = `<div class="qr-placeholder">QR</div>`;
}

function stopPolling() {
  window.clearInterval(pollTimer);
  pollTimer = null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

backButton.addEventListener("click", () => {
  stopPolling();
  showScreen("packages");
});

startOverButton.addEventListener("click", () => {
  stopPolling();
  window.clearInterval(countdownTimer);
  activeOrder = null;
  showScreen("packages");
});
