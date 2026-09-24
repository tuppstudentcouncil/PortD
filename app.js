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

const MIN_LOADING_TIME = 3000; // ⏱️ ล็อกเวลาแสดง Progress Bar ไว้ที่ 3 วินาทีเป๊ะ

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
  initCongratsMarquee();

  const isReturning = sessionStorage.getItem("is_returning_from_detail") === "true";
  const savedPage = parseInt(sessionStorage.getItem("portfolio_return_page")) || 1;
  const savedScroll = parseInt(sessionStorage.getItem("portfolio_scroll_pos")) || 0;

  // ⚡ กรณีที่กด Back กลับมาจากการดูพอร์ต: โหลดข้อมูลทันที 0 วินาที ไม่ต้องรอ
  if (isReturning) {
    if (savedPage > 1) {
      currentPage = savedPage;
    }
    if (loadFromCache()) {
      hideLoadingModal();
      sessionStorage.removeItem("is_returning_from_detail");

      if (savedScroll > 0) {
        setTimeout(() => window.scrollTo({ top: savedScroll, behavior: "instant" }), 30);
      }

      syncWithLiveApi();
      return;
    }
  }

  // 🚀 เมื่อเข้าเว็บ: ล็อก Progress Bar ไว้ที่ 3 วินาทีเป๊ะ แล้วจะหายไป
  renderSkeleton(ITEMS_PER_PAGE);
  showLoadingModal("กำลังดาวน์โหลดข้อมูลพอร์ตโฟลิโอ... กรุณารอสักครู่");

  // เริ่มจับเวลาล็อกไว้ที่ 3 วินาทีเป๊ะ (3000ms)
  const timerPromise = new Promise((resolve) => setTimeout(resolve, MIN_LOADING_TIME));

  // โหลดและเตรียมข้อมูลในเบื้องหลังไปพร้อมกัน
  const dataPromise = (async () => {
    let loaded = loadFromCache();
    if (!loaded) {
      try {
        loaded = await loadFromLocalData();
      } catch (e) {
        console.warn("Local data load error:", e);
      }
    }

    setSyncStatus("syncing", "กำลังซิงค์ข้อมูลล่าสุด...");
    await syncWithLiveApi();
  })();

  // รอให้ครบ 3 วินาทีเป๊ะ และข้อมูลพร้อม
  await Promise.all([timerPromise, dataPromise]);

  // หมด 3 วินาทีแล้วจะหายไป
  hideLoadingModal();
});

// ป้องกันกรณี Browser ฟื้นจาก Back/Forward Cache แล้ว Modal ค้าง
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    hideLoadingModal();
  }
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
  sessionStorage.setItem("portfolio_return_page", currentPage.toString());
  sessionStorage.setItem("portfolio_scroll_pos", window.scrollY.toString());
  sessionStorage.setItem("is_returning_from_detail", "true");
  window.location.href = "detail.html";
}

// ================= CONGRATULATIONS MARQUEE (ตัววิ่งรูปแสดงความยินดีรุ่นพี่) =================
const CONGRATS_FOLDER = "แสดงความยินดีรุ่นพี่";
const DEFAULT_CONGRATS_IMAGES = [
  "591267315_122274753752016866_2373698790350825813_n.jpg",
  "595656813_122245672634188923_7328283722582679697_n.jpg",
  "596807091_122245944200188923_2642992704649104565_n (1).jpg",
  "597695717_122245777778188923_2973628844636035936_n.jpg",
  "597940837_122246462198188923_3948329502340546458_n.jpg",
  "603776622_122247970190188923_4081339526253559394_n.jpg",
  "603870605_122275639136016866_6859125398777505704_n (1).jpg",
  "625292114_122280983636016866_6840717004554008161_n.jpg",
  "638629211_122283829586016866_1317906417716179574_n.jpg",
  "640437801_122284348670016866_1790566473561346995_n.jpg",
  "642872321_122284873862016866_8983792461975032359_n.jpg",
  "657161931_122293838360210527_401591906128745646_n.jpg",
  "657301377_122293830416210527_3449633575389147867_n.jpg",
  "657602511_122293830206210527_2247587614423339318_n.jpg",
  "658160835_122293829894210527_8025083199644802774_n.jpg",
  "721265961_1031639312537953_7375750807266230090_n.jpg",
  "722131842_1031639339204617_3317325031004180004_n.jpg",
  "722268092_1031639125871305_2611064864274648921_n.jpg",
  "722383980_1031639059204645_2253302437449699947_n.jpg",
  "722953875_1031639195871298_4413547494240316916_n.jpg",
  "723118329_1031639162537968_3642823699886208132_n.jpg",
  "723768166_1031639369204614_6867116174172558201_n.jpg"
];

async function initCongratsMarquee() {
  const track = document.getElementById("marqueeTrack");
  if (!track) return;

  let images = DEFAULT_CONGRATS_IMAGES;

  // โหลดรูปภาพจาก congratulations.json แบบไดนามิก เพื่อรองรับกรณีมีรูปใหม่เพิ่มเข้ามาในอนาคต
  try {
    const res = await fetch("congratulations.json");
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        images = json;
      }
    }
  } catch (err) {
    console.log("Using default congratulations images");
  }

  // วนลูปเบิ้ล 2 ชุดเพื่อให้ Scroll ได้แบบ Seamless Infinite Loop 100%
  const loopList = [...images, ...images];

  track.innerHTML = loopList
    .map((img) => {
      const src = `${encodeURIComponent(CONGRATS_FOLDER)}/${encodeURIComponent(img)}`;
      return `
        <div class="marquee-item" onclick="openImageLightbox('${src}')" title="คลิกเพื่อดูภาพขยาย">
          <img src="${src}" alt="แสดงความยินดีรุ่นพี่" loading="lazy" decoding="async" width="290" height="220">
        </div>
      `;
    })
    .join("");

  // ปรับความเร็วตัววิ่งให้นุ่มนวล พอดี ไม่เร็วเกินไป (ประมาณ 3.5 วินาทีต่อภาพ)
  const duration = Math.max(35, images.length * 3.5);
  track.style.animationDuration = `${duration}s`;

  // ⚡ ประหยัดทรัพยากร: หยุดเล่นอนิเมชัน Marquee เมื่อเลื่อนจอพ้นสายตา (IntersectionObserver)
  const marqueeWrapper = document.getElementById("marqueeWrapper");
  if (marqueeWrapper && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          track.style.animationPlayState = entry.isIntersecting ? "running" : "paused";
        });
      },
      { threshold: 0.05 }
    );
    observer.observe(marqueeWrapper);
  }

  // ⚡ ประหยัดแบตเตอรี่ & CPU: หยุด Marquee เมื่อผู้ใช้สลับแท็บหรือพับเบราว์เซอร์
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      track.style.animationPlayState = "paused";
    } else {
      if (!marqueeWrapper || marqueeWrapper.getBoundingClientRect().bottom > 0) {
        track.style.animationPlayState = "running";
      }
    }
  });
}

// Lightbox Modal functions
function openImageLightbox(src) {
  const modal = document.getElementById("imageLightboxModal");
  const img = document.getElementById("lightboxImg");
  if (!modal || !img) return;
  img.src = src;
  modal.classList.remove("closing");
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeImageLightbox() {
  const modal = document.getElementById("imageLightboxModal");
  if (!modal || !modal.classList.contains("active")) return;
  modal.classList.add("closing");
  setTimeout(() => {
    modal.classList.remove("active");
    modal.classList.remove("closing");
    document.body.style.overflow = "";
  }, 220);
}

// ปิด Lightbox เมื่อกดปุ่ม Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeImageLightbox();
  }
});

