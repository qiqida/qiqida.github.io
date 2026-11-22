// splash.js / theme.js 逻辑单元测试（不依赖浏览器，用最小 stub）
// 目的：验证跟手拖拽的各分支 + 主题开关的状态切换

const fs = require("fs");
const path = require("path");

const TOOLS = path.join(__dirname);
const SPLASH_SRC = path.join(TOOLS, "..", "assets", "js", "splash.js");
const THEME_SRC = path.join(TOOLS, "..", "assets", "js", "theme.js");

// ---- 最小 DOM stub ----
function makeEl(tag, opts = {}) {
    const el = {
        tagName: tag.toUpperCase(),
        className: opts.className || "",
        id: opts.id || "",
        isContentEditable: false,
        offsetHeight: opts.height || 0,
        _classes: new Set((opts.className || "").split(/\s+/).filter(Boolean)),
        _listeners: {},
        _children: [],
        _childMap: {},
        _attrs: {},
        _text: "",
        style: {},
        querySelector(sel) { return this._childMap[sel] || null; },
        querySelectorAll() { return []; },
        contains(node) { return node === this || this._children.includes(node); },
        addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
        removeEventListener(t, fn) {
            const arr = this._listeners[t] || [];
            const i = arr.indexOf(fn);
            if (i >= 0) arr.splice(i, 1);
        },
        dispatch(t, ev) { (this._listeners[t] || []).forEach(fn => fn(ev)); },
        setAttribute(k, v) { this._attrs[k] = v; },
        getAttribute(k) { return this._attrs[k] !== undefined ? this._attrs[k] : null; },
        removeAttribute(k) { delete this._attrs[k]; },
        appendChild(c) { this._children.push(c); },
        get textContent() { return this._text; },
        set textContent(v) { this._text = v; this._children = []; }
    };
    el.classList = {
        add(c) { el._classes.add(c); },
        remove(c) { el._classes.delete(c); },
        contains(c) { return el._classes.has(c); },
        toggle(c) { el._classes.has(c) ? el._classes.delete(c) : el._classes.add(c); }
    };
    return el;
}

function buildSplashEnv({ hasSplash = true, reduceMotion = false, height = 745 } = {}) {
    const splash = makeEl("section", { className: "splash", height });
    const hint = makeEl("button", { className: "scroll-hint" });
    splash._children = [hint];
    splash._childMap = { ".scroll-hint": hint };

    const body = makeEl("body", { className: "has-splash" });
    const skipLink = makeEl("a", { className: "skip-to-content" });
    const input = makeEl("input");

    const winListeners = {};
    let now = 1000;
    // 同步执行 setTimeout 会让「防抖计时器」在事件派发过程中就触发，
    // 测试就乱了。改成收集起来，由测试显式 flush。
    const timers = [];

    global.document = {
        getElementById: (id) => (id === "splash" && hasSplash ? splash : null),
        querySelector: (sel) => (sel === ".scroll-hint" ? hint : null),
        querySelectorAll: (sel) => (sel === ".skip-to-content" ? [skipLink] : []),
        body,
        fonts: null,
        addEventListener() { }
    };

    global.window = {
        matchMedia: (q) => ({ matches: reduceMotion, media: q }),
        innerHeight: 900,
        scrollY: 0,
        scrollTo() { },
        addEventListener: (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); },
        removeEventListener() { },
        dispatchEvent() { }
    };
    global.Date = class extends Date {
        constructor(...a) { if (a.length === 0) super(now); else super(...a); }
        static now() { return now; }
    };
    global.setTimeout = (fn, ms) => { timers.push({ fn, ms: ms || 0 }); return timers.length; };
    global.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1].cancelled = true; };

    eval(fs.readFileSync(SPLASH_SRC, "utf8"));

    return {
        splash, hint, body, input, skipLink,
        fire: (t, ev) => (winListeners[t] || []).forEach(fn => fn(ev)),
        classes: () => [...splash._classes].join(" "),
        offset: () => {
            const m = /translate3d\(0,\s*-([0-9.]+)px/.exec(splash.style.transform || "");
            return m ? parseFloat(m[1]) : 0;
        },
        advance: (ms) => { now += ms; },
        flush: () => {
            const due = timers.filter(t => !t.cancelled);
            timers.length = 0;
            due.forEach(t => t.fn());
        }
    };
}

let pass = 0, fail = 0;
function check(name, cond) {
    if (cond) { console.log("  PASS  " + name); pass++; }
    else { console.log("  FAIL  " + name); fail++; }
}

console.log("\n[拖拽 1] 手指上滑 -> 引导页跟手移动");
{
    const env = buildSplashEnv();
    env.fire("touchstart", { touches: [{ clientY: 600 }], target: env.splash });
    env.fire("touchmove", { touches: [{ clientY: 500 }], target: env.splash, preventDefault() { } });
    check("进入 is-dragging", env.classes().includes("is-dragging"));
    check("位移跟随手指 (100px)", Math.abs(env.offset() - 100) < 1);
}

console.log("\n[拖拽 2] 位移太小不触发拖拽");
{
    const env = buildSplashEnv();
    env.fire("touchstart", { touches: [{ clientY: 600 }], target: env.splash });
    env.fire("touchmove", { touches: [{ clientY: 596 }], target: env.splash, preventDefault() { } });
    check("未进入 is-dragging", !env.classes().includes("is-dragging"));
    check("位移为 0", env.offset() === 0);
}

console.log("\n[拖拽 3] 手指下滑（方向反了）-> 不响应");
{
    const env = buildSplashEnv();
    env.fire("touchstart", { touches: [{ clientY: 500 }], target: env.splash });
    env.fire("touchmove", { touches: [{ clientY: 600 }], target: env.splash, preventDefault() { } });
    check("未进入 is-dragging", !env.classes().includes("is-dragging"));
    check("位移为 0", env.offset() === 0);
}

console.log("\n[拖拽 4] 触摸发生在导航栏/搜索框 -> 不拦截");
{
    const env = buildSplashEnv();
    env.fire("touchstart", { touches: [{ clientY: 600 }], target: env.input });
    env.fire("touchmove", { touches: [{ clientY: 400 }], target: env.input, preventDefault() { } });
    check("未进入 is-dragging", !env.classes().includes("is-dragging"));
}

console.log("\n[拖拽 5] 松手且位移过阈值 -> 完成转场");
{
    const env = buildSplashEnv();  // 阈值 = 745 * 0.45 = 335px
    env.fire("touchstart", { touches: [{ clientY: 700 }], target: env.splash });
    env.fire("touchmove", { touches: [{ clientY: 300 }], target: env.splash, preventDefault() { } });
    env.fire("touchend", {});
    check("进入 is-leaving", env.classes().includes("is-leaving"));
    check("body 移除 has-splash", !env.body.classList.contains("has-splash"));
}

console.log("\n[拖拽 5b] 位移不足阈值 -> 回弹（45% 更难触发）");
{
    const env = buildSplashEnv();
    env.fire("touchstart", { touches: [{ clientY: 700 }], target: env.splash });
    env.fire("touchmove", { touches: [{ clientY: 400 }], target: env.splash, preventDefault() { } });
    env.fire("touchend", {});
    check("进入 is-springing（300px < 335px 阈值）", env.classes().includes("is-springing"));
    check("没有进入 is-leaving", !env.classes().includes("is-leaving"));
}

console.log("\n[拖拽 5c] 转场中的残余手势被吞掉（内容页不跟着滑）");
{
    const env = buildSplashEnv();
    env.fire("touchstart", { touches: [{ clientY: 700 }], target: env.splash });
    env.fire("touchmove", { touches: [{ clientY: 300 }], target: env.splash, preventDefault() { } });
    env.fire("touchend", {});
    // 手指还没抬起，继续滑 —— 这一帧必须被 preventDefault
    let prevented = false;
    env.fire("touchmove", {
        touches: [{ clientY: 250 }], target: env.splash,
        preventDefault() { prevented = true; }
    });
    check("残余手势被 preventDefault 吞掉", prevented);
}

console.log("\n[拖拽 5d] 转场完成且手指已抬起 -> 手势交还浏览器");
{
    const env = buildSplashEnv();
    env.fire("touchstart", { touches: [{ clientY: 700 }], target: env.splash });
    env.fire("touchmove", { touches: [{ clientY: 300 }], target: env.splash, preventDefault() { } });
    env.fire("touchend", {});
    env.flush();   // 转场动画播完
    let prevented = false;
    env.fire("touchmove", {
        touches: [{ clientY: 250 }], target: env.splash,
        preventDefault() { prevented = true; }
    });
    check("不再拦截（内容页可以正常滚了）", !prevented);
}

console.log("\n[回归] 进入内容区后触摸内容区 -> 不应吞掉手势");
{
    // 这是「移动端内容页滑不动」的 bug：
    // touchstart 无条件把 touchActive 置 true，
    // 导致进入内容区后 touchmove 一直被吃掉。
    const env = buildSplashEnv();
    env.fire("touchstart", { touches: [{ clientY: 700 }], target: env.splash });
    env.fire("touchmove", { touches: [{ clientY: 300 }], target: env.splash, preventDefault() { } });
    env.fire("touchend", {});
    env.flush();   // state -> done

    // 现在在内容区正常滑动（触摸目标不在 splash 内）
    env.fire("touchstart", { touches: [{ clientY: 600 }], target: env.body });
    let prevented = false;
    env.fire("touchmove", {
        touches: [{ clientY: 500 }], target: env.body,
        preventDefault() { prevented = true; }
    });
    check("内容区手势没有被拦截", !prevented);
    env.fire("touchend", {});
}

console.log("\n[回归] 抬手事件丢失时也不该永久卡住内容页");
{
    // 模拟 touchend 没送达（被系统手势接管）的情况
    const env = buildSplashEnv();
    env.fire("touchstart", { touches: [{ clientY: 700 }], target: env.splash });
    env.fire("touchmove", { touches: [{ clientY: 300 }], target: env.splash, preventDefault() { } });
    env.fire("touchend", {});
    env.flush();   // 转场结束

    // 再次触摸内容区
    env.fire("touchstart", { touches: [{ clientY: 600 }], target: env.body });
    let prevented = false;
    env.fire("touchmove", {
        touches: [{ clientY: 500 }], target: env.body,
        preventDefault() { prevented = true; }
    });
    check("内容区手势没有被拦截", !prevented);
}

console.log("\n[回归] 转场期间的新触摸不应污染后续手势");
{
    // 转场动画期间用户又按了一下屏幕。
    // 如果这时把 touchActive 置 true，转场结束后
    // 内容页的第一下滑动还会被吞掉。
    const env = buildSplashEnv();
    env.fire("touchstart", { touches: [{ clientY: 700 }], target: env.splash });
    env.fire("touchmove", { touches: [{ clientY: 300 }], target: env.splash, preventDefault() { } });
    env.fire("touchend", {});
    // 转场中（state = leaving）用户又按下
    env.fire("touchstart", { touches: [{ clientY: 600 }], target: env.body });
    env.flush();   // 转场结束，state -> done

    // 内容区滑动
    let prevented = false;
    env.fire("touchmove", {
        touches: [{ clientY: 500 }], target: env.body,
        preventDefault() { prevented = true; }
    });
    check("内容区手势没有被拦截", !prevented);
}

console.log("\n[拖拽 6] 松手但位移不足 -> 回弹");
{
    const env = buildSplashEnv();
    env.fire("touchstart", { touches: [{ clientY: 700 }], target: env.splash });
    env.fire("touchmove", { touches: [{ clientY: 650 }], target: env.splash, preventDefault() { } });
    env.fire("touchend", {});
    check("进入 is-springing", env.classes().includes("is-springing"));
    check("没有进入 is-leaving", !env.classes().includes("is-leaving"));
}

console.log("\n[拖拽 7] 甩得够快（位移小但速度高）-> 直接完成");
{
    const env = buildSplashEnv();
    env.fire("touchstart", { touches: [{ clientY: 700 }], target: env.splash });
    env.advance(16);
    env.fire("touchmove", { touches: [{ clientY: 680 }], target: env.splash, preventDefault() { } });
    env.advance(16);
    env.fire("touchmove", { touches: [{ clientY: 660 }], target: env.splash, preventDefault() { } });
    env.advance(16);
    env.fire("touchmove", { touches: [{ clientY: 640 }], target: env.splash, preventDefault() { } });
    env.fire("touchend", {});
    check("进入 is-leaving（甩动直接完成）", env.classes().includes("is-leaving"));
}

console.log("\n[滚轮 1] 滚轮下拉 -> 跟手累积位移");
{
    const env = buildSplashEnv();
    env.fire("wheel", { deltaY: 50, preventDefault() { } });
    check("进入 is-dragging", env.classes().includes("is-dragging"));
    check("位移已累积 (50*1.6=80px)", Math.abs(env.offset() - 80) < 1);
}

console.log("\n[滚轮 2] 滚轮累积过阈值 -> 完成转场");
{
    const env = buildSplashEnv();
    env.fire("wheel", { deltaY: 250, preventDefault() { } });  // 250*1.6=400px > 335px
    check("进入 is-leaving", env.classes().includes("is-leaving"));
}

console.log("\n[滚轮 2b] 滚轮累积不足阈值 -> 不转场（回弹）");
{
    const env = buildSplashEnv();
    env.fire("wheel", { deltaY: 100, preventDefault() { } });  // 160px < 335px
    check("未进入 is-leaving", !env.classes().includes("is-leaving"));
    check("仍在 is-dragging", env.classes().includes("is-dragging"));
}

console.log("\n[滚轮 3] 滚轮上滚（向上）-> 不响应");
{
    const env = buildSplashEnv();
    env.fire("wheel", { deltaY: -100, preventDefault() { } });
    check("未进入 is-dragging", !env.classes().includes("is-dragging"));
}

console.log("\n[滚轮 4] 转场后不再劫持");
{
    const env = buildSplashEnv();
    env.fire("wheel", { deltaY: 250, preventDefault() { } });
    const after = env.classes();
    env.fire("wheel", { deltaY: 200, preventDefault() { } });
    check("状态没有重复变化", env.classes() === after);
}

console.log("\n[点击] 点击指示器 -> 完成转场");
{
    const env = buildSplashEnv();
    env.hint.dispatch("click", { preventDefault() { } });
    check("进入 is-leaving", env.classes().includes("is-leaving"));
}

console.log("\n[键盘] 空格 -> 完成转场");
{
    const env = buildSplashEnv();
    env.fire("keydown", { key: " ", target: { tagName: "BODY" }, preventDefault() { } });
    check("进入 is-leaving", env.classes().includes("is-leaving"));
}

console.log("\n[键盘] 在搜索框里按空格 -> 不抢键盘");
{
    const env = buildSplashEnv();
    env.fire("keydown", { key: " ", target: env.input, preventDefault() { } });
    check("未转场", !env.classes().includes("is-leaving"));
}

console.log("\n[减弱动效] 直接隐藏，不播动画");
{
    const env = buildSplashEnv({ reduceMotion: true });
    env.fire("wheel", { deltaY: 250, preventDefault() { } });
    check("直接 is-hidden", env.classes().includes("is-hidden"));
}

console.log("\n[无障碍] 「跳到正文」-> 直接跳过引导页");
{
    const env = buildSplashEnv();
    env.skipLink.dispatch("click", {});
    check("引导页直接隐藏", env.classes().includes("is-hidden"));
    check("body 移除 has-splash", !env.body.classList.contains("has-splash"));
}

console.log("\n[子页面] 没有 #splash -> 直接返回，不报错");
{
    let threw = false;
    try { buildSplashEnv({ hasSplash: false }); } catch (e) { threw = true; console.log("    " + e.message); }
    check("没有抛异常", !threw);
}

// ==========================================================
// 主题开关
// ==========================================================
function buildThemeEnv({ initialTheme = null } = {}) {
    const btn = makeEl("button", { className: "theme-switch", id: "theme-toggle" });
    btn.setAttribute("aria-checked", "false");

    const htmlEl = makeEl("html");
    if (initialTheme === "dark") htmlEl.setAttribute("data-theme", "dark");

    const store = {};
    global.localStorage = {
        getItem: (k) => (store[k] !== undefined ? store[k] : null),
        setItem: (k, v) => { store[k] = v; },
        removeItem: (k) => { delete store[k]; }
    };

    global.document = {
        getElementById: (id) => (id === "theme-toggle" ? btn : null),
        documentElement: htmlEl,
        body: makeEl("body"),
        createElement: (tag) => makeEl(tag),
        addEventListener() { }
    };
    global.window = {
        dispatchEvent() { },
        scrollY: 0,
        addEventListener() { }
    };
    global.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };

    eval(fs.readFileSync(THEME_SRC, "utf8"));

    return { btn, htmlEl, store };
}

console.log("\n[主题 1] 初始：aria-checked=false，无 data-theme");
{
    const env = buildThemeEnv();
    check("aria-checked 为 false", env.btn.getAttribute("aria-checked") === "false");
    check("html 无 data-theme", env.htmlEl.getAttribute("data-theme") === null);
}

console.log("\n[主题 2] 点击 -> 切换到夜间");
{
    const env = buildThemeEnv();
    env.btn.dispatch("click", {});
    check("html[data-theme] = dark", env.htmlEl.getAttribute("data-theme") === "dark");
    check("aria-checked = true", env.btn.getAttribute("aria-checked") === "true");
    check("localStorage 已保存", env.store["gsh-theme"] === "dark");
}

console.log("\n[主题 3] 再点一次 -> 切回白天");
{
    const env = buildThemeEnv();
    env.btn.dispatch("click", {});
    env.btn.dispatch("click", {});
    check("html 无 data-theme", env.htmlEl.getAttribute("data-theme") === null);
    check("aria-checked = false", env.btn.getAttribute("aria-checked") === "false");
    check("localStorage 已清除", env.store["gsh-theme"] === undefined);
}

console.log("\n[主题 4] 读取已保存的夜间模式");
{
    const env = buildThemeEnv();
    env.store["gsh-theme"] = "dark";
    const env2 = buildThemeEnv();
    env2.store["gsh-theme"] = "dark";
    eval(fs.readFileSync(THEME_SRC, "utf8"));
    check("恢复为夜间", env2.htmlEl.getAttribute("data-theme") === "dark");
}

console.log("\n[主题 5] 切换不会清空按钮内的 SVG 结构");
{
    const env = buildThemeEnv();
    const before = env.btn._children.length;
    env.btn.dispatch("click", {});
    check("子节点数量不变 (未用 textContent 覆盖)", env.btn._children.length === before);
}

console.log("\n--------------------------------------");
console.log("通过 " + pass + " 项，失败 " + fail + " 项");
process.exit(fail > 0 ? 1 : 0);
