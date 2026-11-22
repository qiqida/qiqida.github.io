// splash.js 逻辑单元测试（不依赖浏览器，用最小 stub）
// 目的：验证弱劫持的三个关键分支

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "assets", "js", "splash.js");

// ---- 最小 DOM stub ----
function makeEl(tag, opts = {}) {
    return {
        tagName: tag.toUpperCase(),
        className: opts.className || "",
        id: opts.id || "",
        isContentEditable: false,
        offsetHeight: opts.height || 0,
        _classes: new Set((opts.className || "").split(/\s+/).filter(Boolean)),
        _listeners: {},
        querySelector(sel) { return this._childMap && this._childMap[sel] ? this._childMap[sel] : null; },
        contains(node) { return node === this || (this._children || []).includes(node); },
        addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
        dispatch(t, ev) { (this._listeners[t] || []).forEach(fn => fn(ev)); },
        classList: {
            add(c) { this._owner._classes.add(c); },
            remove(c) { this._owner._classes.delete(c); },
            contains(c) { return this._owner._classes.has(c); },
            _owner: null
        }
    };
}

function buildEnv({ hasSplash = true, reduceMotion = false } = {}) {
    const splash = makeEl("section", { className: "splash", height: 745 });
    splash.classList._owner = splash;
    const hint = makeEl("button", { className: "scroll-hint" });
    hint.classList._owner = hint;
    splash._children = [hint];
    splash._childMap = { ".scroll-hint": hint };

    const body = makeEl("body", { className: "has-splash" });
    body.classList._owner = body;

    const skipLink = makeEl("a", { className: "skip-to-content" });

    const docListeners = {};
    const winListeners = {};

    const input = makeEl("input");
    input.tagName = "INPUT";

    global.document = {
        getElementById: (id) => (id === "splash" && hasSplash ? splash : null),
        querySelector: (sel) => (sel === ".scroll-hint" ? hint : null),
        querySelectorAll: (sel) => (sel === ".skip-to-content" ? [skipLink] : []),
        body,
        addEventListener: (t, fn) => { (docListeners[t] = docListeners[t] || []).push(fn); },
        documentElement: { setAttribute() { } }
    };

    global.window = {
        matchMedia: (q) => ({ matches: reduceMotion, media: q }),
        scrollY: 0,
        scrollTo: function (top) { this.scrollY = (typeof top === "object" ? top.top : top); },
        addEventListener: (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); },
        requestAnimationFrame: (fn) => setTimeout(fn, 0)
    };
    global.setTimeout = setTimeout;
    global.clearTimeout = clearTimeout;

    // 加载脚本
    const code = fs.readFileSync(SRC, "utf8");
    eval(code);

    return {
        splash, hint, body, input, winListeners, skipLink,
        fire: (t, ev) => (winListeners[t] || []).forEach(fn => fn(ev)),
        classes: () => [...splash._classes].join(" ")
    };
}

let pass = 0, fail = 0;
function check(name, cond) {
    if (cond) { console.log("  PASS  " + name); pass++; }
    else { console.log("  FAIL  " + name); fail++; }
}

console.log("\n[1] 滚轮向下 -> 触发转场");
{
    const env = buildEnv();
    env.fire("wheel", { deltaY: 120, preventDefault() { this.prevented = true; }, prevented: false });
    check("引导页加了 is-leaving", env.classes().includes("is-leaving"));
    check("body 移除了 has-splash", !env.body.classList.contains("has-splash"));
}

console.log("\n[2] 滚轮向上 -> 不触发转场");
{
    const env = buildEnv();
    env.fire("wheel", { deltaY: -120, preventDefault() { } });
    check("引导页未转场", !env.classes().includes("is-leaving"));
}

console.log("\n[3] 触摸上滑超 30px -> 触发转场");
{
    const env = buildEnv();
    env.fire("touchstart", { touches: [{ clientY: 600 }], target: env.splash });
    env.fire("touchmove", { touches: [{ clientY: 540 }], preventDefault() { } });
    check("引导页加了 is-leaving", env.classes().includes("is-leaving"));
}

console.log("\n[4] 触摸滑动不足 30px -> 不触发");
{
    const env = buildEnv();
    env.fire("touchstart", { touches: [{ clientY: 600 }], target: env.splash });
    env.fire("touchmove", { touches: [{ clientY: 590 }], preventDefault() { } });
    check("引导页未转场", !env.classes().includes("is-leaving"));
}

console.log("\n[5] 触摸发生在导航栏/搜索框 -> 不拦截");
{
    const env = buildEnv();
    env.fire("touchstart", { touches: [{ clientY: 600 }], target: env.input });  // 不在 splash 内
    env.fire("touchmove", { touches: [{ clientY: 500 }], preventDefault() { } });
    check("引导页未转场", !env.classes().includes("is-leaving"));
}

console.log("\n[6] 键盘空格 -> 触发转场");
{
    const env = buildEnv();
    env.fire("keydown", { key: " ", target: { tagName: "BODY" }, preventDefault() { } });
    check("引导页加了 is-leaving", env.classes().includes("is-leaving"));
}

console.log("\n[7] 在搜索框里按空格 -> 不抢键盘");
{
    const env = buildEnv();
    env.fire("keydown", { key: " ", target: env.input, preventDefault() { } });
    check("引导页未转场", !env.classes().includes("is-leaving"));
}

console.log("\n[8] 点击滚动指示器 -> 触发转场");
{
    const env = buildEnv();
    env.hint.dispatch("click", { preventDefault() { } });
    check("引导页加了 is-leaving", env.classes().includes("is-leaving"));
}

console.log("\n[9] 转场后重复滚轮 -> 不再触发新转场（弱劫持只吃一次）");
{
    const env = buildEnv();
    env.fire("wheel", { deltaY: 120, preventDefault() { } });
    const after = env.classes();
    env.fire("wheel", { deltaY: 120, preventDefault() { } });
    check("转场状态没有重复变化", env.classes() === after);
    check("只出现一次 is-leaving", (env.classes().match(/is-leaving/g) || []).length === 1);
}

console.log("\n[10] 减弱动效 -> 不播转场动画，直接隐藏");
{
    const env = buildEnv({ reduceMotion: true });
    env.fire("wheel", { deltaY: 120, preventDefault() { } });
    check("直接加了 is-hidden", env.classes().includes("is-hidden"));
}

console.log("\n[11] 子页面没有 #splash -> 直接返回，不报错");
{
    let threw = false;
    try { buildEnv({ hasSplash: false }); } catch (e) { threw = true; console.log("    " + e.message); }
    check("没有抛异常", !threw);
}

console.log("\n[12] 「跳到正文」-> 直接跳过引导页");
{
    const env = buildEnv();
    env.skipLink.dispatch("click", {});
    check("引导页直接隐藏", env.classes().includes("is-hidden"));
    check("body 移除 has-splash", !env.body.classList.contains("has-splash"));
}

console.log("\n--------------------------------------");
console.log("通过 " + pass + " 项，失败 " + fail + " 项");
process.exit(fail > 0 ? 1 : 0);
