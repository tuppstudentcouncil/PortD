/* ============================================================
   app.js (High Performance & Progressive Cache Version)
   - Stale-While-Revalidate (Instant Load via LocalStorage)
   - Loading Modal & Skeleton UI
   - JSONP API Connector + Background Sync
   - Lightweight Thumbnail & Cover Optimization
   - Dynamic Filter & Pagination
   ============================================================ */

// ================= CONFIG =================
const API_URL =
  "https://script.google.com/macros/s/AKfycbyO2H4xvC6NvrS01gdtK4ed1o4CspiYocwQPD0Ndkz3U-BgZLm7doCHn22pMu9v_ky7-A/exec";
const LOCAL_DATA_URL = "data.json";
const ITEMS_PER_PAGE = 9; // ✅ แสดง 9 อันต่อหน้า
const CACHE_KEY = "tupp_portfolio_cache_data";
const CACHE_TIME_KEY = "tupp_portfolio_cache_time";

const MIN_LOADING_TIME = 5000; // ⏱️ ตั้งเวลาแสดงป๊อปอัพ 5 วินาที

// ================= STATE =================
let allData = [];
let filteredData = [];
let currentPage = 1;
let isResetting = false;

// ================= DOM =================
const grid = document.getElementById("grid");
const pageInfo = document.getElementById("pageInfo");
const loadingModal = document.getElementById("loadingModal");
const loadingStatusText = document.getElementById("loadingStatusText");
const syncBadge = document.getElementById("syncBadge");
const syncDot = document.getElementById("syncDot");
const syncText = document.getElementById("syncText");

const roundSelect = document.getElementById("roundFilter");
const universitySelect = document.getElementById("universityFilter");
const facultySelect = document.getElementById("facultyFilter");
const resetBtn = document.getElementById("resetFilter");

// ================= INIT =================
window.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();

  // 1. แสดง Skeleton และ Loading Modal ป๊อปอัพทันทีเมื่อเข้าเว็บ
  renderSkeleton(ITEMS_PER_PAGE);
  showLoadingModal("กำลังดาวน์โหลดข้อมูลพอร์ตโฟลิโอ... กรุณารอสักครู่");

  // 2. เริ่มจับเวลา 5 วินาที
  const timerPromise = new Promise((resolve) => setTimeout(resolve, MIN_LOADING_TIME));

  // 3. โหลดและเตรียมข้อมูลในเบื้องหลังไปพร้อมกัน
  const dataPromise = (async () => {
    // ลองโหลดจาก Cache หรือ data.json ก่อน
    const hasCache = loadFromCache();
    if (!hasCache) {
      try {
        await loadFromLocalData();
      } catch (e) {
        console.warn("Local data load error:", e);
      }
    }

    setSyncStatus("syncing", "กำลังซิงค์ข้อมูลล่าสุด...");
    await syncWithLiveApi();
  })();

  // 4. รอให้ครบ 5 วินาที และข้อมูลพร้อม
  await Promise.all([timerPromise, dataPromise]);

  // 5. ปิด Modal เผยแพร่ผลงานจริงอย่างนุ่มนวล
  hideLoadingModal();
});

// ================= CACHE & LOCAL DATA MANAGEMENT =================
function loadFromCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return false;

    const data = JSON.parse(cached);
    if (Array.isArray(data) && data.length > 0) {
      return processAndSaveData(data, false);
    }
  } catch (e) {
    console.warn("Error reading cache:", e);
  }
  return false;
}

async function loadFromLocalData() {
  try {
    const res = await fetch(LOCAL_DATA_URL);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return processAndSaveData(data, true);
      }
    }
  } catch (e) {
    console.warn("data.json not found, proceeding to live API");
  }
  return false;
}

function processAndSaveData(data, shouldSaveCache = true) {
  const validData = Array.isArray(data)
    ? data.filter((i) => i && i["ชื่อ - นามสกุล"])
    : [];

  if (validData.length === 0) return false;

  const isDifferent = JSON.stringify(validData) !== JSON.stringify(allData);

  if (isDifferent || allData.length === 0) {
    allData = validData;
    filteredData = [...allData];
    if (shouldSaveCache) {
      saveToCache(allData);
    }
    populateFilters();
    render();
    return true;
  }
  return false;
}

function saveToCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
  } catch (e) {
    console.warn("Error saving to cache:", e);
  }
}

// ================= SYNC WITH LIVE API =================
async function syncWithLiveApi() {
  try {
    const isUpdated = await fetchFromLiveApi();
    if (isUpdated) {
      populateFilters();
      render();
    }
    setSyncStatus("done", "ข้อมูลล่าสุด");
    setTimeout(() => setSyncStatus("hidden"), 3500);
  } catch (err) {
    console.warn("Live API sync failed, using available data:", err);
    if (!allData || allData.length === 0) {
      if (grid) {
        grid.innerHTML = `<p style="text-align:center;width:100%;color:#ef4444;padding:2rem;">ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง</p>`;
      }
    } else {
      setSyncStatus("done", "โหมดออฟไลน์ / ข้อมูลแคช");
      setTimeout(() => setSyncStatus("hidden"), 3500);
    }
  }
}

// ================= FETCH FROM LIVE API (DUAL STRATEGY: FETCH + JSONP) =================
async function fetchFromLiveApi() {
  // กลยุทธ์ที่ 1: Modern fetch()
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        return processAndSaveData(json, true);
      }
    }
  } catch (fetchErr) {
    console.warn("Direct fetch failed, trying JSONP fallback:", fetchErr);
  }

  // กลยุทธ์ที่ 2: JSONP Fallback
  return new Promise((resolve, reject) => {
    const scriptId = "api-jsonp-script";
    document.getElementById(scriptId)?.remove();

    const timeout = setTimeout(() => {
      document.getElementById(scriptId)?.remove();
      reject(new Error("การเชื่อมต่อหมดเวลา (Timeout)"));
    }, 12000);

    window.handleApiResponse = function (data) {
      clearTimeout(timeout);
      document.getElementById(scriptId)?.remove();
      if (Array.isArray(data) && data.length > 0) {
        const isUpdated = processAndSaveData(data, true);
        resolve(isUpdated);
      } else {
        reject(new Error("ข้อมูลที่ได้รับไม่ถูกต้อง"));
      }
    };

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `${API_URL}?callback=handleApiResponse`;
    script.onerror = () => {
      clearTimeout(timeout);
      script.remove();
      reject(new Error("โหลดข้อมูลจาก Google Sheets ไม่สำเร็จ"));
    };

    document.body.appendChild(script);
  });
}


// ================= LOADING & SKELETON UI =================
function showLoadingModal(message = "กำลังโหลดข้อมูล...") {
  if (loadingStatusText) loadingStatusText.innerText = message;
  if (loadingModal) {
    loadingModal.classList.remove("hidden");
    loadingModal.style.display = "flex";
  }
}

function hideLoadingModal() {
  if (loadingModal) {
    loadingModal.classList.add("hidden");
    setTimeout(() => {
      if (loadingModal.classList.contains("hidden")) {
        loadingModal.style.display = "none";
      }
    }, 400);
  }
}

function renderSkeleton(count = 9) {
  if (!grid) return;
  let html = "";
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-card">
        <div class="skeleton-cover skeleton-shimmer"></div>
        <div class="skeleton-body">
          <div class="skeleton-line title skeleton-shimmer"></div>
          <div class="skeleton-line sub skeleton-shimmer"></div>
          <div class="skeleton-line tag skeleton-shimmer"></div>
        </div>
      </div>
    `;
  }
  grid.innerHTML = html;
}

function setSyncStatus(status, text = "") {
  if (!syncBadge) return;

  if (status === "hidden") {
    syncBadge.style.display = "none";
    return;
  }

  syncBadge.style.display = "inline-flex";
  if (text && syncText) syncText.innerText = text;

  if (status === "syncing") {
    syncDot?.classList.add("syncing");
  } else {
    syncDot?.classList.remove("syncing");
  }
}

// ================= HELPERS =================
function extractFileId(url) {
  if (!url) return null;
  if (url.includes("open?id=")) return url.split("open?id=")[1].split("&")[0];
  if (url.includes("/file/d/")) return url.split("/file/d/")[1].split("/")[0];
  if (url.includes("id=")) return url.split("id=")[1].split("&")[0];
  return null;
}

function getPdfThumbnail(url) {
  const id = extractFileId(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w600` : "";
}

function getYoutubeThumbnail(url) {
  const match = url?.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
  return match
    ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`
    : "";
}

// ================= FILTER OPTIONS =================
function populateFilters() {
  if (!universitySelect || !facultySelect) return;

  const currentUni = universitySelect.value;
  const currentFaculty = facultySelect.value;

  universitySelect.innerHTML = `<option value="">ทั้งหมด</option>`;
  facultySelect.innerHTML = `<option value="">ทั้งหมด</option>`;

  const universities = [
    ...new Set(
      allData
        .map((i) => i["มหาวิทยาลัยที่ผ่านการคัดเลือก / เข้าศึกษา"])
        .filter(Boolean)
    ),
  ].sort();

  universities.forEach((u) => {
    universitySelect.innerHTML += `<option value="${u}" ${
      u === currentUni ? "selected" : ""
    }>${u}</option>`;
  });

  const faculties = [
    ...new Set(allData.map((i) => i["คณะ"]).filter(Boolean)),
  ].sort();

  faculties.forEach((f) => {
    facultySelect.innerHTML += `<option value="${f}" ${
      f === currentFaculty ? "selected" : ""
    }>${f}</option>`;
  });
}

// ================= EVENTS =================
function setupEventListeners() {
  roundSelect?.addEventListener("change", applyFilters);
  universitySelect?.addEventListener("change", applyFilters);
  facultySelect?.addEventListener("change", applyFilters);
  resetBtn?.addEventListener("click", resetFilters);
}

// ================= FILTER LOGIC =================
function applyFilters() {
  if (isResetting) return;

  const selectedRound = roundSelect?.value || "";
  const selectedUni = universitySelect?.value || "";
  const selectedFaculty = facultySelect?.value || "";

  filteredData = allData.filter((i) => {
    const matchRound = !selectedRound || i["เข้าศึกษาในรอบไหน"] === selectedRound;
    const matchUni =
      !selectedUni ||
      i["มหาวิทยาลัยที่ผ่านการคัดเลือก / เข้าศึกษา"] === selectedUni;
    const matchFaculty = !selectedFaculty || i["คณะ"] === selectedFaculty;
    return matchRound && matchUni && matchFaculty;
  });

  currentPage = 1;
  render();
}

function resetFilters() {
  isResetting = true;
  if (roundSelect) roundSelect.value = "";
  if (universitySelect) universitySelect.value = "";
  if (facultySelect) facultySelect.value = "";

  filteredData = [...allData];
  currentPage = 1;
  render();
  isResetting = false;
}

// ================= RENDER =================
function render() {
  if (!grid) return;
  grid.innerHTML = "";

  if (!filteredData.length) {
    grid.innerHTML = `<p style="text-align:center;width:100%;padding:3rem 0;color:var(--text-light);font-size:1.1rem;">ไม่พบข้อมูลผลงานที่ค้นหา</p>`;
    const pagination = document.getElementById("pagination");
    if (pagination) pagination.innerHTML = "";
    if (pageInfo) pageInfo.innerText = "";
    return;
  }

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filteredData.slice(start, start + ITEMS_PER_PAGE);

  let html = "";

  pageItems.forEach((item) => {
    const realIndex = allData.indexOf(item);
    let cover = "";

    const pdfUrl = item["อัปโหลดตัวอย่างพอร์ตโฟลิโอ (PDF)"];
    const videoUrl =
      item["วิดีโอแนะนำรอบ Admission (ถ้ามี)"] ||
      item["วิดีโอแนะนำพอร์ต (ถ้ามี)"] ||
      item["วิดีโอแนะนำ (ถ้ามี)"];

    const fileId = extractFileId(pdfUrl);
    const youtubeThumb = videoUrl ? getYoutubeThumbnail(videoUrl) : "";

    if (fileId) {
      cover = `
        <iframe src="https://drive.google.com/file/d/${fileId}/preview"
                class="pdf-preview-iframe"
                loading="lazy"
                title="ตัวอย่างพอร์ต ${item["ชื่อ - นามสกุล"] || ""}"></iframe>
      `;
    } else if (youtubeThumb) {
      cover = `
        <img src="${youtubeThumb}" 
             alt="${item["ชื่อ - นามสกุล"] || "Video"}" 
             class="cover-img" 
             loading="lazy"
             decoding="async">
      `;
    } else {
      cover = `
        <div class="placeholder-cover">
          <span>📄</span>
          <small>ไม่มีไฟล์ตัวอย่างแนบ</small>
        </div>
      `;
    }

    html += `
      <div class="card" onclick="goDetail(${realIndex})" role="button" tabindex="0">
        <div class="card-cover">${cover}</div>
        <div class="card-body">
          <h3>${item["ชื่อ - นามสกุล"] || "ไม่ระบุชื่อ"}</h3>
          <p>${item["คณะ"] || ""} ${
      item["สาขา"] ? `(${item["สาขา"]})` : ""
    }</p>
          <p class="university-tag">🎓 ${
            item["มหาวิทยาลัยที่ผ่านการคัดเลือก / เข้าศึกษา"] || "-"
          }</p>
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
  renderPagination(totalPages);
}

// ================= PAGINATION =================
function renderPagination(totalPages) {
  const pagination =
    document.getElementById("pagination") || createPaginationContainer();

  if (totalPages <= 1) {
    pagination.innerHTML = "";
    if (pageInfo) pageInfo.innerText = `แสดงทั้งหมด ${filteredData.length} รายการ`;
    return;
  }

  let html = `<div class="pagination-wrapper">`;

  html += `
    <button class="page-btn nav"
      onclick="changePage(${currentPage - 1})"
      ${currentPage === 1 ? "disabled" : ""}
      aria-label="หน้าก่อนหน้า">
      ❮
    </button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
      html += `
        <button
          class="page-btn ${i === currentPage ? "active" : ""}"
          onclick="changePage(${i})">
          ${i}
        </button>
      `;
    } else if (Math.abs(i - currentPage) === 3) {
      html += `<span class="page-dots">…</span>`;
    }
  }

  html += `
    <button class="page-btn nav"
      onclick="changePage(${currentPage + 1})"
      ${currentPage === totalPages ? "disabled" : ""}
      aria-label="หน้าถัดไป">
      ❯
    </button>
  `;

  html += `</div>`;

  pagination.innerHTML = html;
  if (pageInfo) {
    pageInfo.innerText = `หน้า ${currentPage} / ${totalPages} (ทั้งหมด ${filteredData.length} รายการ)`;
  }
}

function createPaginationContainer() {
  const div = document.createElement("div");
  div.id = "pagination";
  grid.after(div);
  return div;
}

function changePage(p) {
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  if (p < 1 || p > totalPages) return;
  currentPage = p;
  render();
  grid.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ================= DETAIL =================
function goDetail(index) {
  localStorage.setItem("portfolio_list", JSON.stringify(allData));
  localStorage.setItem("portfolio_index", index.toString());
  window.location.href = "detail.html";
}

