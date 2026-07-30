/**
 * qiqida.github.io 统计 Worker
 *
 * 提供接口：
 * - /api/stats: 返回 Google Analytics 和网站数据统计
 * - /api/feedback: 留言反馈（POST 提交，GET 查询）
 *
 * 环境变量（通过 Cloudflare Dashboard 配置）：
 * - GA_PROPERTY_ID: GA4 媒体资源 ID
 * - GA_SERVICE_ACCOUNT_KEY: Google 服务账号密钥（JSON 转字符串后 Base64 编码）
 * - ADMIN_KEY: 管理员密钥（用于查询留言）
 */

interface Env {
  GA_PROPERTY_ID: string;
  GA_SERVICE_ACCOUNT_KEY: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  CACHE_TTL: string;
  GA_ENABLED: string;
  ADMIN_KEY: string;
  DB: D1Database;
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

interface FeedbackMessage {
  id: number;
  name: string | null;
  content: string;
  created_at: string;
  status: string;
}

// ==================== 留言 API ====================

async function handleFeedbackSubmit(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as { name?: string; content?: string };
    
    const { name, content } = body;
    
    // 验证必填字段
    if (!content || content.trim().length === 0) {
      return new Response(JSON.stringify({ success: false, error: "留言内容不能为空" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // 限制内容长度为500字
    const trimmedContent = content.trim().slice(0, 500);
    const trimmedName = name?.trim().slice(0, 50) || null;
    
    // 获取用户信息（脱敏处理）
    const ipHash = request.headers.get("cf-connecting-ip") 
      ? await hashIP(request.headers.get("cf-connecting-ip")!) 
      : null;
    const userAgent = request.headers.get("user-agent")?.slice(0, 200) || null;
    
    // 插入数据库
    const result = await env.DB.prepare(`
      INSERT INTO messages (name, content, ip_hash, user_agent)
      VALUES (?, ?, ?, ?)
    `).bind(trimmedName, trimmedContent, ipHash, userAgent).run();
    
    return new Response(JSON.stringify({
      success: true,
      id: result.meta?.last_row_id,
      message: "留言提交成功"
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Feedback submit error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: "提交失败，请稍后重试" 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleFeedbackList(request: Request, env: Env): Promise<Response> {
  // 简单的管理员验证
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "未授权" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  
  const token = authHeader.slice(7);
  if (token !== env.ADMIN_KEY) {
    return new Response(JSON.stringify({ error: "密钥无效" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "pending";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    
    const messages = await env.DB.prepare(`
      SELECT id, name, content, created_at, status
      FROM messages
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(status, limit, offset).all() as { results: FeedbackMessage[] };
    
    const countResult = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM messages WHERE status = ?
    `).bind(status).first() as { total: number };
    
    return new Response(JSON.stringify({
      messages: messages.results || [],
      total: countResult?.total || 0,
      limit,
      offset
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Feedback list error:", error);
    return new Response(JSON.stringify({ error: "查询失败" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleFeedbackUpdate(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "未授权" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  
  const token = authHeader.slice(7);
  if (token !== env.ADMIN_KEY) {
    return new Response(JSON.stringify({ error: "密钥无效" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  
  try {
    const { id, status } = await request.json() as { id: number; status: string };
    
    if (!id || !["pending", "approved", "rejected"].includes(status)) {
      return new Response(JSON.stringify({ error: "参数错误" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    await env.DB.prepare(`
      UPDATE messages SET status = ? WHERE id = ?
    `).bind(status, id).run();
    
    return new Response(JSON.stringify({ success: true }));
  } catch (error) {
    console.error("Feedback update error:", error);
    return new Response(JSON.stringify({ error: "更新失败" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + "qiqida-salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// ==================== 统计 API ====================

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

  let serviceAccount: { client_email: string; private_key: string };
  try {
    serviceAccount = JSON.parse(atob(env.GA_SERVICE_ACCOUNT_KEY));
  } catch (e) {
    console.error("Failed to decode GA service account key:", e);
    return { total: 0, today: 0, week: 0, error: "Invalid service account key" };
  }

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
      return { total: 0, today: 0, week: 0, error: `OAuth: ${tokenData.error}` };
    }
    
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return { total: 0, today: 0, week: 0, error: "No access token" };
    }

    const propertyId = env.GA_PROPERTY_ID;

    const [totalResponse, todayResponse, weekResponse] = await Promise.all([
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
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          metrics: [{ name: "screenPageViews" }],
        }),
      }),
    ]);

    const parseReport = async (response: Response): Promise<number> => {
      if (!response.ok) return 0;
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

  const files = [
    { path: "downloads.json", key: "filesCount" },
    { path: "faq.json", key: "faqCount" },
    { path: "notices.json", key: "noticeCount" },
  ];
  let filesCount = 0;
  let faqCount = 0;
  let noticeCount = 0;

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

  for (const result of results) {
    if (!result) continue;
    if (result.key === "filesCount") {
      filesCount = result.count;
    } else if (result.key === "faqCount") {
      faqCount = result.count;
    } else if (result.key === "noticeCount") {
      noticeCount = result.count;
    }
  }

  return { filesCount, faqCount, noticeCount };
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

// ==================== 主入口 ====================

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // 处理 OPTIONS 预检请求
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 留言 API 路由
    if (url.pathname === "/api/feedback") {
      if (request.method === "POST") {
        return await handleFeedbackSubmit(request, env);
      } else if (request.method === "GET") {
        return await handleFeedbackList(request, env);
      }
    }

    // 留言状态更新路由
    if (url.pathname === "/api/feedback/update" && request.method === "POST") {
      return await handleFeedbackUpdate(request, env);
    }

    // 统计 API 路由
    if (url.pathname === "/api/stats") {
      const forceRefresh = url.searchParams.has("refresh");

      if (!forceRefresh) {
        try {
          const cacheKey = `https://stats.qiqida.github.io${url.pathname}`;
          const cache = caches.default;
          const cachedResponse = await cache.match(cacheKey);

          if (cachedResponse) {
            const cachedData = await cachedResponse.json() as StatsResponse;
            cachedData.cached = true;
            return new Response(JSON.stringify(cachedData), {
              headers: { "Content-Type": "application/json", ...corsHeaders },
            });
          }
        } catch (e) {
          console.error("Cache error:", e);
        }
      }

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

      try {
        const ttl = parseInt(env.CACHE_TTL || "300", 10);
        const cacheKey = `https://stats.qiqida.github.io/api/stats`;
        const cache = caches.default;
        
        ctx.waitUntil(
          cache.put(
            cacheKey,
            new Response(JSON.stringify(response), {
              headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${ttl}` },
            })
          )
        );
      } catch (e) {
        console.error("Cache put error:", e);
      }

      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
