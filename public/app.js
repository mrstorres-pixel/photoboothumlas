const screens = {
  packages: document.querySelector("#packages-screen"),
  payment: document.querySelector("#payment-screen"),
  ready: document.querySelector("#ready-screen"),
  capture: document.querySelector("#capture-screen"),
  review: document.querySelector("#review-screen")
};

const packageGrid = document.querySelector("#package-grid");
const paymentStatus = document.querySelector("#payment-status");
const qrFrame = document.querySelector("#qr-frame");
const testLink = document.querySelector("#test-link");
const backButton = document.querySelector("#back-button");
const startOverButton = document.querySelector("#start-over-button");
const beginCaptureButton = document.querySelector("#begin-capture-button");
const cameraPreview = document.querySelector("#camera-preview");
const cameraOverlay = document.querySelector("#camera-overlay");
const cameraStatus = document.querySelector("#camera-status");
const shotCountdown = document.querySelector("#shot-countdown");
const captureProgress = document.querySelector("#capture-progress");
const capturePackage = document.querySelector("#capture-package");
const captureTitle = document.querySelector("#capture-title");
const sessionCopy = document.querySelector("#session-copy");
const thumbnailGrid = document.querySelector("#thumbnail-grid");
const reviewCount = document.querySelector("#review-count");
const reviewGrid = document.querySelector("#review-grid");
const stripCanvas = document.querySelector("#strip-canvas");
const downloadButton = document.querySelector("#download-button");
const retakeButton = document.querySelector("#retake-button");

let activeOrder = null;
let boothConfig = null;
let pollTimer = null;
let sessionLaunchTimer = null;
let sessionLaunching = false;
let cameraStream = null;
let capturedPhotos = [];
let retakeIndex = null;
let isCapturing = false;

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
      launchPaidSession(900);
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
      setPaymentStatus("Payment confirmed.");
      launchPaidSession();
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

function launchPaidSession(delay = 0) {
  if (sessionLaunching) {
    return;
  }

  sessionLaunching = true;
  stopPolling();
  window.clearTimeout(sessionLaunchTimer);
  sessionLaunchTimer = window.setTimeout(showReadyScreen, delay);
}

function showReadyScreen() {
  showScreen("ready");
  window.clearTimeout(sessionLaunchTimer);
  setTimeout(showCaptureScreen, 700);
}

async function showCaptureScreen() {
  showScreen("capture");
  capturedPhotos = [];
  retakeIndex = null;
  isCapturing = false;
  capturePackage.textContent = activeOrder?.packageName || "Photobooth";
  captureTitle.textContent = "Own the frame";
  sessionCopy.textContent = "Camera first, masterpiece second.";
  beginCaptureButton.disabled = false;
  beginCaptureButton.textContent = "Start shoot";
  renderThumbnails();
  updateCaptureProgress();
  await startCamera();
}

async function startCamera() {
  cameraOverlay.textContent = "Starting camera...";
  cameraOverlay.classList.remove("hidden");
  cameraStatus.textContent = "Warming up";

  try {
    stopCamera();
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        facingMode: "user"
      },
      audio: false
    });
    cameraPreview.srcObject = cameraStream;
    await cameraPreview.play();
    cameraOverlay.classList.add("hidden");
    cameraStatus.textContent = "Ready";
    sessionCopy.textContent = "Tap start, then follow the countdown. Big energy encouraged.";
  } catch (error) {
    cameraStatus.textContent = "Blocked";
    cameraOverlay.textContent = "Allow camera access to start the session.";
    sessionCopy.textContent = "Camera permission is needed before the fun part can start.";
  }
}

async function runPhotoSession() {
  if (isCapturing || !cameraStream) {
    return;
  }

  isCapturing = true;
  beginCaptureButton.disabled = true;
  beginCaptureButton.textContent = "Shooting";

  while (capturedPhotos.length < Number(activeOrder.shots)) {
    updateCaptureProgress();
    updateShotPrompt();
    await runShotCountdown();
    capturedPhotos.push(captureFrame());
    renderThumbnails();
    flashStage();
    await wait(700);
  }

  isCapturing = false;
  stopCamera();
  showReviewScreen();
}

function runShotCountdown() {
  return new Promise((resolve) => {
    let seconds = 4;
    shotCountdown.textContent = seconds;
    shotCountdown.classList.remove("hidden");

    const timer = window.setInterval(() => {
      seconds -= 1;

      if (seconds <= 0) {
        window.clearInterval(timer);
        shotCountdown.textContent = "SMILE";
        setTimeout(() => {
          shotCountdown.classList.add("hidden");
          resolve();
        }, 260);
        return;
      }

      shotCountdown.textContent = seconds;
    }, 900);
  });
}

function captureFrame() {
  const canvas = document.createElement("canvas");
  const width = cameraPreview.videoWidth || 1280;
  const height = cameraPreview.videoHeight || 720;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.translate(width, 0);
  context.scale(-1, 1);
  context.drawImage(cameraPreview, 0, 0, width, height);
  return {
    src: canvas.toDataURL("image/jpeg", 0.92),
    width,
    height
  };
}

function renderThumbnails() {
  const total = Number(activeOrder?.shots || 0);
  const slots = Array.from({ length: total }, (_, index) => capturedPhotos[index] || "");

  thumbnailGrid.innerHTML = slots
    .map((photo, index) => {
      if (photo) {
        return `<img src="${photo.src}" alt="Captured photo ${index + 1}">`;
      }

      return `<div class="thumb-placeholder">${index + 1}</div>`;
    })
    .join("");
}

function updateCaptureProgress() {
  const total = Number(activeOrder?.shots || 0);
  const next = Math.min(capturedPhotos.length + 1, total);
  captureProgress.textContent = capturedPhotos.length >= total ? "All shots captured" : `Shot ${next} of ${total}`;
}

function updateShotPrompt() {
  const prompts = [
    ["First look", "Set the tone. Relax your shoulders and look alive."],
    ["Switch it up", "New pose, same confidence."],
    ["Main character", "This is the one for the frame."],
    ["Final spark", "Make the last shot loud."]
  ];
  const prompt = prompts[capturedPhotos.length % prompts.length];
  captureTitle.textContent = prompt[0];
  sessionCopy.textContent = prompt[1];
}

function flashStage() {
  document.body.classList.add("flash");
  setTimeout(() => document.body.classList.remove("flash"), 120);
}

function showReviewScreen() {
  renderStrip();
  renderReviewGrid();
  showScreen("review");
}

function renderReviewGrid() {
  reviewGrid.innerHTML = capturedPhotos
    .map(
      (photo, index) => `
        <button class="review-thumb" type="button" data-index="${index}" aria-label="Retake photo ${index + 1}">
          <img src="${photo.src}" alt="Photo ${index + 1}">
          <span>Retake ${index + 1}</span>
        </button>
      `
    )
    .join("");

  reviewGrid.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => retakePhoto(Number(button.dataset.index)));
  });
}

async function retakePhoto(index) {
  retakeIndex = index;
  captureTitle.textContent = `Retake ${index + 1}`;
  sessionCopy.textContent = "One clean replacement, then we rebuild the strip.";
  captureProgress.textContent = `Retaking shot ${index + 1}`;
  showScreen("capture");
  renderThumbnails();
  beginCaptureButton.disabled = false;
  beginCaptureButton.textContent = "Retake photo";
  await startCamera();
}

async function runRetakePhoto() {
  if (isCapturing || !cameraStream || retakeIndex === null) {
    return;
  }

  isCapturing = true;
  beginCaptureButton.disabled = true;
  beginCaptureButton.textContent = "Shooting";
  await runShotCountdown();
  capturedPhotos[retakeIndex] = captureFrame();
  retakeIndex = null;
  isCapturing = false;
  stopCamera();
  showReviewScreen();
}

function renderStrip() {
  const context = stripCanvas.getContext("2d");
  const layout = getPrintLayout();
  stripCanvas.width = layout.width;
  stripCanvas.height = layout.height;
  const width = layout.width;
  const height = layout.height;
  const photoCount = capturedPhotos.length;
  const columns = layout.columns;
  const rows = Math.ceil(photoCount / columns);
  const frame = layout.frame;
  const gap = layout.gap;
  const header = layout.header;
  const footer = layout.footer;
  const photoWidth = (width - frame * 2 - gap * (columns - 1)) / columns;
  const photoHeight = (height - frame * 2 - header - footer - gap * (rows - 1)) / rows;

  drawPrintBackground(context, layout);
  drawPrintHeader(context, layout);

  let loaded = 0;

  capturedPhotos.forEach((photo, index) => {
    const image = new Image();
    image.onload = () => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = frame + column * (photoWidth + gap);
      const y = frame + header + row * (photoHeight + gap);
      drawPhotoSlot(context, image, x, y, photoWidth, photoHeight, layout);
      loaded += 1;

      if (loaded === photoCount) {
        drawPrintFooter(context, layout);
        reviewCount.textContent = `${photoCount} photos`;
      }
    };
    image.src = photo.src;
  });
}

function getPrintLayout() {
  const isClassic = Number(activeOrder?.shots || 0) <= 4;

  if (isClassic) {
    return {
      width: 720,
      height: 2160,
      columns: 1,
      frame: 48,
      gap: 26,
      header: 210,
      footer: 170,
      accent: "#0f766e",
      coral: "#e45a3c",
      bg: "#fff8ec",
      pattern: "strip"
    };
  }

  return {
    width: 1800,
    height: 1200,
    columns: 3,
    frame: 70,
    gap: 28,
    header: 150,
    footer: 120,
    accent: "#0f766e",
    coral: "#e45a3c",
    bg: "#fff8ec",
    pattern: "grid"
  };
}

function drawPrintBackground(context, layout) {
  context.fillStyle = layout.bg;
  context.fillRect(0, 0, layout.width, layout.height);
  context.fillStyle = layout.accent;
  context.fillRect(0, 0, layout.width, 18);
  context.fillRect(0, layout.height - 18, layout.width, 18);
  context.fillStyle = layout.coral;
  context.fillRect(18, 0, 18, layout.height);
  context.fillRect(layout.width - 36, 0, 18, layout.height);

  context.save();
  context.globalAlpha = 0.16;
  for (let y = 70; y < layout.height; y += 110) {
    for (let x = 56; x < layout.width; x += 150) {
      context.fillStyle = (x + y) % 300 === 0 ? layout.coral : layout.accent;
      context.beginPath();
      context.arc(x, y, 11, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
}

function drawPrintHeader(context, layout) {
  context.fillStyle = "#171717";
  context.font = layout.pattern === "strip" ? "900 52px Segoe UI, Arial" : "900 58px Segoe UI, Arial";
  context.fillText(boothConfig?.displayName || "Photobooth", layout.frame, layout.frame + 56);
  context.fillStyle = "#64605a";
  context.font = layout.pattern === "strip" ? "700 28px Segoe UI, Arial" : "700 32px Segoe UI, Arial";
  context.fillText(activeOrder?.packageName || "Session", layout.frame, layout.frame + 96);

  context.fillStyle = layout.coral;
  context.fillRect(layout.frame, layout.frame + 126, Math.min(220, layout.width - layout.frame * 2), 10);
}

function drawPhotoSlot(context, image, x, y, width, height, layout) {
  const border = layout.pattern === "strip" ? 12 : 10;
  context.save();
  context.fillStyle = "#ffffff";
  roundRect(context, x - border, y - border, width + border * 2, height + border * 2, 18);
  context.fill();
  context.shadowColor = "rgba(22, 18, 10, 0.24)";
  context.shadowBlur = 18;
  context.shadowOffsetY = 10;
  drawImageCover(context, image, x, y, width, height);
  context.shadowColor = "transparent";
  context.strokeStyle = layout.accent;
  context.lineWidth = 5;
  context.strokeRect(x, y, width, height);
  context.restore();
}

function drawPrintFooter(context, layout) {
  const y = layout.height - layout.frame - 34;
  context.fillStyle = layout.accent;
  context.font = layout.pattern === "strip" ? "900 28px Segoe UI, Arial" : "900 30px Segoe UI, Arial";
  context.fillText(new Date().toLocaleDateString("en-PH"), layout.frame, y);
  context.fillStyle = "#171717";
  context.textAlign = "right";
  context.fillText("UMLAS", layout.width - layout.frame, y);
  context.textAlign = "left";
}

function drawImageCover(context, image, x, y, width, height) {
  const portraitBias = height > width ? 0.42 : 0.5;
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = Math.max(0, Math.min(image.height - sourceHeight, (image.height - sourceHeight) * portraitBias));
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function downloadStrip() {
  const link = document.createElement("a");
  link.href = stripCanvas.toDataURL("image/png");
  link.download = `photobooth-${Date.now()}.png`;
  link.click();
}

function resetSession() {
  stopPolling();
  stopCamera();
  window.clearTimeout(sessionLaunchTimer);
  sessionLaunching = false;
  activeOrder = null;
  capturedPhotos = [];
  retakeIndex = null;
  showScreen("packages");
}

function stopCamera() {
  if (!cameraStream) {
    return;
  }

  cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  cameraPreview.srcObject = null;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  resetSession();
});

beginCaptureButton.addEventListener("click", () => {
  if (retakeIndex !== null) {
    runRetakePhoto();
    return;
  }

  runPhotoSession();
});
downloadButton.addEventListener("click", downloadStrip);
retakeButton.addEventListener("click", () => {
  capturedPhotos = [];
  showCaptureScreen();
});
