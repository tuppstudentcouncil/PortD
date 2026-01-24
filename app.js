/* ============================================================
   app.js (Unified Version)
   - JSONP แก้ CORS
   - PDF Preview + Thumbnail
   - Performance Tuned + Pagination (Large Buttons)
   ============================================================ */

// ================= CONFIG =================
const API_URL =
  "https://script.google.com/macros/s/AKfycbyO2H4xvC6NvrS01gdtK4ed1o4CspiYocwQPD0Ndkz3U-BgZLm7doCHn22pMu9v_ky7-A/exec";
const ITEMS_PER_PAGE = 9; // ✅ แสดง 9 อันต่อหน้า

// ================= STATE =================
let allData = [];
let filteredData = [];
let currentPage = 1;
let isResetting = false;

// ================= DOM =================
const grid = document.getElementById("grid");
const pageInfo = document.getElementById("pageInfo");

const roundSelect = document.getElementById("roundFilter");
const universitySelect = document.getElementById("universityFilter");
const facultySelect = document.getElementById("facultyFilter");
const resetBtn = document.getElementById("resetFilter");

// ================= INIT =================
window.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  populateFilters();
  render();
  setupEventListeners();
});

// ================= LOAD DATA (JSONP) =================
function loadData() {
  return new Promise((resolve, reject) => {
    window.handleApiResponse = function (data) {
      allData = data.filter((i) => i["ชื่อ - นามสกุล"]);
      filteredData = [...allData];

      document.getElementById("api-script")?.remove();
      resolve();
    };

    const script = document.createElement("script");
    script.id = "api-script";
    script.src = API_URL + "?callback=handleApiResponse";
    script.onerror = () => reject("โหลดข้อมูลไม่สำเร็จ");

    document.body.appendChild(script);
  });
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
  universitySelect.innerHTML = `<option value="">ทุกมหาวิทยาลัย</option>`;
  facultySelect.innerHTML = `<option value="">ทุกคณะ</option>`;

  [...new Set(allData.map((i) => i["มหาวิทยาลัยที่ผ่านการคัดเลือก / เข้าศึกษา"]).filter(Boolean))]
    .sort()
    .forEach(
      (u) =>
        (universitySelect.innerHTML += `<option value="${u}">${u}</option>`)
    );

  [...new Set(allData.map((i) => i["คณะ"]).filter(Boolean))]
    .sort()
    .forEach(
      (f) => (facultySelect.innerHTML += `<option value="${f}">${f}</option>`)
    );
}

// ================= EVENTS =================
function setupEventListeners() {
  roundSelect.addEventListener("change", applyFilters);
  universitySelect.addEventListener("change", applyFilters);
  facultySelect.addEventListener("change", applyFilters);
  resetBtn.addEventListener("click", resetFilters);
}

// ================= FILTER LOGIC =================
function applyFilters() {
  if (isResetting) return;

  filteredData = allData.filter(
    (i) =>
      (!roundSelect.value || i["เข้าศึกษาในรอบไหน"] === roundSelect.value) &&
      (!universitySelect.value ||
        i["มหาวิทยาลัยที่ผ่านการคัดเลือก / เข้าศึกษา"] ===
          universitySelect.value) &&
      (!facultySelect.value || i["คณะ"] === facultySelect.value)
  );

  currentPage = 1;
  render();
}

function resetFilters() {
  isResetting = true;
  roundSelect.value = universitySelect.value = facultySelect.value = "";
  filteredData = [...allData];
  currentPage = 1;
  render();
  isResetting = false;
}

// ================= RENDER =================
function render() {
  grid.innerHTML = "";

  if (!filteredData.length) {
    grid.innerHTML = `<p style="text-align:center;width:100%">ไม่พบข้อมูล</p>`;
    document.getElementById("pagination").innerHTML = "";
    return;
  }

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filteredData.slice(start, start + ITEMS_PER_PAGE);

  let html = "";

  pageItems.forEach((item) => {
    const realIndex = allData.indexOf(item);
    let cover = "";

    if (item["อัปโหลดตัวอย่างพอร์ตโฟลิโอ (PDF)"]) {
      const id = extractFileId(item["อัปโหลดตัวอย่างพอร์ตโฟลิโอ (PDF)"]);
      cover = `
        <img src="${getPdfThumbnail(
          item["อัปโหลดตัวอย่างพอร์ตโฟลิโอ (PDF)"]
        )}"
             class="cover-img"
             loading="lazy"
             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <iframe src="https://drive.google.com/file/d/${id}/preview"
                class="pdf-preview-iframe"
                style="display:none"></iframe>
      `;
    } else if (item["วิดีโอแนะนำรอบ Admission (ถ้ามี)"]) {
      cover = `<img src="${getYoutubeThumbnail(
        item["วิดีโอแนะนำรอบ Admission (ถ้ามี)"]
      )}" class="cover-img">`;
    } else {
      cover = `<div class="placeholder-cover">📄</div>`;
    }

    html += `
      <div class="card" onclick="goDetail(${realIndex})">
        <div class="card-cover">${cover}</div>
        <div class="card-body">
          <h3>${item["ชื่อ - นามสกุล"]}</h3>
          <p>${item["คณะ"] || ""} ${
      item["สาขา"] ? `(${item["สาขา"]})` : ""
    }</p>
          <p class="university-tag">🎓 ${
            item["มหาวิทยาลัยที่ผ่านการคัดเลือก / เข้าศึกษา"] || ""
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

  let html = `<div class="pagination-wrapper">`;

  html += `
    <button class="page-btn nav"
      onclick="changePage(${currentPage - 1})"
      ${currentPage === 1 ? "disabled" : ""}>
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
      ${currentPage === totalPages ? "disabled" : ""}>
      ❯
    </button>
  `;

  html += `</div>`;

  pagination.innerHTML = html;
  pageInfo.innerText = `หน้า ${currentPage} / ${totalPages}`;
}

function createPaginationContainer() {
  const div = document.createElement("div");
  div.id = "pagination";
  grid.after(div);
  return div;
}

function changePage(p) {
  if (p < 1) return;
  currentPage = p;
  render();
  grid.scrollIntoView({ behavior: "smooth" });
}

// ================= DETAIL =================
function goDetail(index) {
  localStorage.setItem("portfolio_list", JSON.stringify(allData));
  localStorage.setItem("portfolio_index", index);
  window.location.href = "detail.html";
}
