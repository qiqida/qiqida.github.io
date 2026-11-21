// 首页数据中心：从 Cloudflare Worker 获取真实统计数据
// 失败时使用本地 JSON 备用

// Cloudflare Worker API 地址
const STATS_API = "https://qiqida-stats-worker.dddhui-qi.workers.dev/api/stats";

// 本地备用值（API 失败时使用）
const FALLBACK_STATS = {
  week: 1000,
  files: 10,
  faq: 10,
  notices: 10
};

// loading 状态计数
let statsLoadingCount = 0;

function setLoading(loading) {
  const elements = [
    document.getElementById("stat-visits"),
    document.getElementById("stat-files"),
    document.getElementById("stat-faq"),
    document.getElementById("stat-notices")
  ];

  elements.forEach(el => {
    if (!el) return;
    if (loading) {
      el.classList.add("stats-loading");
      statsLoadingCount++;
    } else {
      statsLoadingCount = Math.max(0, statsLoadingCount - 1);
    }
  });

  // 所有元素都移除 loading 状态
  if (statsLoadingCount === 0) {
    elements.forEach(el => {
      if (el) el.classList.remove("stats-loading");
    });
  }
}

// 格式化数字显示
function formatNumber(num) {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + "万";
  }
  return num.toLocaleString();
}

async function loadStats() {
  const visitEl = document.getElementById("stat-visits");
  const filesEl = document.getElementById("stat-files");
  const faqEl = document.getElementById("stat-faq");
  const noticesEl = document.getElementById("stat-notices");

  if (!visitEl) return;

  // 开始 loading
  setLoading(true);

  // 备用值（从本地 JSON 加载）
  let fallbackData = { ...FALLBACK_STATS };

  try {
    // 尝试从本地 JSON 获取备用数据
    const [faqRes, noticesRes] = await Promise.all([
      fetch("data/faq.json").catch(() => null),
      fetch("data/notices.json").catch(() => null)
    ]);

    if (faqRes?.ok) {
      const faqData = await faqRes.json();
      fallbackData.faq = Array.isArray(faqData) ? faqData.length : 0;
    }

    if (noticesRes?.ok) {
      const noticesData = await noticesRes.json();
      fallbackData.notices = Array.isArray(noticesData) ? noticesData.length : 0;
    }
  } catch {
    // 忽略备用数据加载错误
  }

  try {
    // 从 Cloudflare Worker 获取真实数据
    const response = await fetch(STATS_API);

    if (response.ok) {
      const data = await response.json();

      // 优先使用本周访问量（GA 免费版最准确的数据）
      // totalViews 为 0 时使用 weekViews
      const weekViews = data.weekViews || 0;
      const totalViews = data.totalViews || 0;
      const displayViews = totalViews > 0 ? totalViews : weekViews;

      // 更新显示
      visitEl.textContent = formatNumber(displayViews);
      filesEl.textContent = formatNumber(data.filesCount || fallbackData.files);
      faqEl.textContent = formatNumber(data.faqCount || fallbackData.faq);
      noticesEl.textContent = formatNumber(data.noticeCount || fallbackData.notices);

      console.log("统计数据加载成功:", data);
    } else {
      throw new Error(`API 返回错误: ${response.status}`);
    }
  } catch (error) {
    console.warn("统计数据 API 加载失败，使用备用值:", error);

    // 使用备用值
    visitEl.textContent = formatNumber(fallbackData.week);
    filesEl.textContent = formatNumber(fallbackData.files);
    faqEl.textContent = formatNumber(fallbackData.faq);
    noticesEl.textContent = formatNumber(fallbackData.notices);
  } finally {
    // 结束 loading
    setLoading(false);
  }
}

loadStats();
