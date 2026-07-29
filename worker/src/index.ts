/**
 * qiqida.github.io 统计 Worker
 *
 * 提供 /api/stats 接口，返回 Google Analytics 和网站数据统计
 *
 * 环境变量（通过 Cloudflare Dashboard 配置）：
 * - GA_PROPERTY_ID: GA4 媒体资源 ID
 * - GA_SERVICE_ACCOUNT_KEY: Google 服务账号密钥（JSON 转字符串后 Base64 编码）
 */

interface Env {
  GA_PROPERTY_ID: string;
  GA_SERVICE_ACCOUNT_KEY: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  CACHE_TTL: string;
  GA_ENABLED: string;
}

interface GAReportResponse {
  rows?: Array<{ metricValues: Array<{ value: string }> }>;
}

interface GitHubFileResponse {
  content?: string;
  encoding: string;
}

interface StatsResponse {
  totalViews: number;
  todayViews: number;
  weekViews: number;
  filesCount: number;
  faqCount: number;
  noticeCount: number;
  updateTime: string;
  cached: boolean;
  error?: string;
}

/**
 * 获取 Google Analytics 访问数据
 */
async function fetchGAData(env: Env): Promise<{ total: number; today: number; week: number; error?: string }> {
  if (env.GA_ENABLED !== "true") {
    return { total: 0, today: 0, week: 0 };
  }

  if (!env.GA_SERVICE_ACCOUNT_KEY || !env.GA_PROPERTY_ID) {
    return { total: 0, today: 0, week: 0, error: "Missing GA credentials" };
  }

  // 解码服务账号密钥
  let serviceAccount: { client_email: string; private_key: string };
  try {
    serviceAccount = JSON.parse(atob(env.GA_SERVICE_ACCOUNT_KEY));
  } catch (e) {
    console.error("Failed to decode GA service account key:", e);
    return { total: 0, today: 0, week: 0, error: "Invalid service account key" };
  }

  // 生成 JWT
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payload = btoa(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const signingInput = `${header}.${payload}`;
  const encoder = new TextEncoder();

  try {
    // 使用 Web Crypto API 签名
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      derFromPem(serviceAccount.private_key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      encoder.encode(signingInput)
    );

    const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;

    // 获取 Access Token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };
    
    if (tokenData.error) {
      console.error("OAuth error:", tokenData.error);
      return { total: 0, today: 0, week: 0, error: `OAuth: ${tokenData.error}` };
    }
    
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error("Failed to get access token");
      return { total: 0, today: 0, week: 0, error: "No access token" };
    }

    const propertyId = env.GA_PROPERTY_ID;

    // 并行请求三个指标
    const [totalResponse, todayResponse, weekResponse] = await Promise.all([
      // 总访问量（所有时间）
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: "2000-01-01", endDate: "today" }],
          metrics: [{ name: "screenPageViews" }],
        }),
      }),
      // 今日访问量
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: "today", endDate: "today" }],
          metrics: [{ name: "screenPageViews" }],
        }),
      }),
      // 本周访问量
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{
            startDate: "7daysAgo",
            endDate: "today"
          }],
          metrics: [{ name: "screenPageViews" }],
        }),
      }),
    ]);

    const parseReport = async (response: Response): Promise<number> => {
      if (!response.ok) {
        const errorText = await response.text();
        console.error("GA API error:", response.status, errorText);
        return 0;
      }
      const data = await response.json() as GAReportResponse;
      return data.rows?.[0]?.metricValues?.[0]?.value
        ? parseInt(data.rows[0].metricValues[0].value, 10)
        : 0;
    };

    const [total, today, week] = await Promise.all([
      parseReport(totalResponse),
      parseReport(todayResponse),
      parseReport(weekResponse),
    ]);

    return { total, today, week };
  } catch (e) {
    console.error("GA fetch error:", e);
    return { total: 0, today: 0, week: 0, error: `Fetch error: ${e}` };
  }
}

/**
 * 从 GitHub 获取 data 文件并统计数量
 */
async function fetchDataStats(env: Env): Promise<{ filesCount: number; faqCount: number; noticeCount: number }> {
  const repo = env.GITHUB_REPO || "qiqida/qiqida.github.io";
  const branch = env.GITHUB_BRANCH || "main";
  const baseUrl = `https://api.github.com/repos/${repo}/contents`;

  // 需要的文件
  const files = [
    { path: "downloads.json", key: "filesCount" },
    { path: "faq.json", key: "faqCount" },
    { path: "graduation-faq.json", key: "faqPart" },
    { path: "freshman-faq.json", key: "faqPart" },
    { path: "notices.json", key: "noticeCount" },
  ];

  // 用于累积 FAQ 数量
  let faqTotal = 0;
  let filesCount = 0;
  let noticeCount = 0;

  // 并行请求所有文件
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const response = await fetch(`${baseUrl}/data/${file.path}?ref=${branch}`, {
          headers: {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "qiqida-stats-worker",
          },
        });

        if (!response.ok) return null;

        const data = await response.json() as GitHubFileResponse;

        if (data.encoding === "base64" && data.content) {
          const content = atob(data.content.replace(/\n/g, ""));
          const parsed = JSON.parse(content);
          const count = Array.isArray(parsed) ? parsed.length : 0;
          return { key: file.key, count };
        }
        return null;
      } catch {
        return null;
      }
    })
  );

  // 统计结果
  for (const result of results) {
    if (!result) continue;
    if (result.key === "filesCount") {
      filesCount = result.count;
    } else if (result.key === "faqPart") {
      faqTotal += result.count;
    } else if (result.key === "noticeCount") {
      noticeCount = result.count;
    }
  }

  return { filesCount, faqCount: faqTotal, noticeCount };
}

/**
 * 将 PEM 格式的私钥转换为 DER 格式（pkcs8）
 */
function derFromPem(pem: string): ArrayBuffer {
  const pemContents = pem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, "")
    .replace(/-----END (RSA )?PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 主请求处理
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 只处理 /api/stats 路由
    if (url.pathname !== "/api/stats") {
      return new Response("Not Found", { status: 404 });
    }

    // CORS 头
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // 处理 OPTIONS 预检请求
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 检查是否强制刷新（通过 query 参数）
    const forceRefresh = url.searchParams.has("refresh");

    // 尝试从缓存获取（如果没有强制刷新）
    if (!forceRefresh) {
      try {
        const cacheKey = `https://stats.qiqida.github.io${url.pathname}`;
        const cache = caches.default;
        const cachedResponse = await cache.match(cacheKey);

        if (cachedResponse) {
          const cachedData = await cachedResponse.json() as StatsResponse;
          cachedData.cached = true;
          return new Response(JSON.stringify(cachedData), {
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          });
        }
      } catch (e) {
        console.error("Cache error:", e);
        // 缓存出错继续执行
      }
    }

    // 并行获取 GA 统计和本地数据统计
    const [gaData, dataStats] = await Promise.all([
      fetchGAData(env),
      fetchDataStats(env),
    ]);

    const response: StatsResponse = {
      totalViews: gaData.total,
      todayViews: gaData.today,
      weekViews: gaData.week,
      filesCount: dataStats.filesCount,
      faqCount: dataStats.faqCount,
      noticeCount: dataStats.noticeCount,
      updateTime: new Date().toISOString(),
      cached: false,
    };

    // 如果有错误，添加到响应中（但不显示给用户）
    if (gaData.error) {
      console.error("GA Error:", gaData.error);
    }

    // 缓存响应
    try {
      const ttl = parseInt(env.CACHE_TTL || "300", 10);
      const cacheKey = `https://stats.qiqida.github.io/api/stats`;
      const cache = caches.default;
      
      ctx.waitUntil(
        cache.put(
          cacheKey,
          new Response(JSON.stringify(response), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": `public, max-age=${ttl}`,
            },
          })
        )
      );
    } catch (e) {
      console.error("Cache put error:", e);
    }

    return new Response(JSON.stringify(response), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  },
};
