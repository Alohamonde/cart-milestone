(() => {
  const PROXY_BASE = "/apps/cart-milestone/config";
  const TRACK_BASE = "/apps/cart-milestone/track";
  const MOUNT_SELECTOR = "#cm-milestone-root, [data-cm-mount]";
  const CART_PATHS = ["/cart/add", "/cart/change", "/cart/update", "/cart/clear"];

  let config = null;
  let reconcileTimer = null;
  let lastTierId = null;
  let impressionSent = false;

  function cartSubtotal(cart) {
    if (!cart) return 0;
    if (typeof cart.total_price === "number") {
      return cart.total_price / 100;
    }
    return 0;
  }

  async function fetchConfig() {
    const response = await fetch(PROXY_BASE);
    if (!response.ok) return null;
    return response.json();
  }

  async function trackEvent(eventType, ruleId) {
    const params = new URLSearchParams({ event: eventType });
    if (ruleId) params.set("ruleId", ruleId);
    await fetch(`${TRACK_BASE}?${params.toString()}`).catch(() => {});
  }

  function activeTiers(subtotal) {
    if (!config?.tiers) return [];
    return config.tiers
      .filter((tier) => tier.enabled !== false)
      .filter((tier) => subtotal >= Number(tier.thresholdAmount))
      .sort((a, b) => a.thresholdAmount - b.thresholdAmount);
  }

  function nextTier(subtotal) {
    if (!config?.tiers) return null;
    return config.tiers
      .filter((tier) => tier.enabled !== false)
      .filter((tier) => subtotal < Number(tier.thresholdAmount))
      .sort((a, b) => a.thresholdAmount - b.thresholdAmount)[0];
  }

  function progressPercent(subtotal) {
    const goal = Number(config?.freeShippingThreshold || 0);
    if (!goal) return 0;
    return Math.min(100, Math.round((subtotal / goal) * 100));
  }

  function buildMessage(subtotal) {
    const goal = Number(config?.freeShippingThreshold || 0);
    const remaining = Math.max(0, goal - subtotal);

    if (goal && remaining > 0) {
      return `再买 $${remaining.toFixed(2)} 即可免运费`;
    }
    if (goal && subtotal >= goal) {
      return "恭喜！您已达标免运费";
    }

    const next = nextTier(subtotal);
    if (next) {
      const gap = Number(next.thresholdAmount) - subtotal;
      return `再买 $${gap.toFixed(2)} 解锁：${next.rewardLabel}`;
    }

    const unlocked = activeTiers(subtotal);
    if (unlocked.length) {
      return unlocked[unlocked.length - 1].rewardLabel;
    }

    return "继续选购解锁更多奖励";
  }

  function renderBar(subtotal) {
    if (!config?.enabled) return;

    const mounts = document.querySelectorAll(MOUNT_SELECTOR);
    const percent = progressPercent(subtotal);
    const message = buildMessage(subtotal);
    const tiers = (config.tiers || []).filter((tier) => tier.enabled !== false);
    const unlocked = activeTiers(subtotal);
    const next = nextTier(subtotal);
    const showSuggestions =
      next &&
      config.suggestionCollectionId &&
      subtotal >= Number(next.thresholdAmount) * 0.7;

    const html = `
      <div class="cm-milestone" style="background:${config.barBgColor};color:${config.barTextColor}">
        <p class="cm-milestone__message">${message}</p>
        <div class="cm-milestone__track" style="background:${config.barTextColor}22">
          <div class="cm-milestone__fill" style="width:${percent}%;background:${config.barFillColor}"></div>
        </div>
        ${
          tiers.length
            ? `<div class="cm-milestone__tiers">${tiers
                .map((tier) => {
                  const active = subtotal >= Number(tier.thresholdAmount);
                  return `<span class="cm-milestone__tier${
                    active ? " cm-milestone__tier--active" : ""
                  }">$${tier.thresholdAmount} ${tier.rewardLabel}</span>`;
                })
                .join("")}</div>`
            : ""
        }
        ${
          showSuggestions
            ? `<div class="cm-milestone__suggestions">
                <a class="cm-milestone__suggestion-link" href="/collections/${encodeURIComponent(
                  config.suggestionCollectionHandle || "all",
                )}" data-cm-suggestion="1">
                  浏览凑单推荐 → ${config.suggestionCollectionTitle}
                </a>
              </div>`
            : ""
        }
        <p class="cm-milestone__sub">购物车小计 $${subtotal.toFixed(2)}</p>
      </div>
    `;

    const targets =
      mounts.length > 0
        ? mounts
        : [ensureDrawerMount()].filter(Boolean);

    targets.forEach((mount) => {
      mount.innerHTML = html;
      mount.querySelector("[data-cm-suggestion]")?.addEventListener(
        "click",
        () => trackEvent("suggestion_click", next?.id),
      );
    });

    if (!impressionSent) {
      impressionSent = true;
      trackEvent("impression");
    }

    const topTier = unlocked[unlocked.length - 1];
    if (topTier && topTier.id !== lastTierId) {
      lastTierId = topTier.id;
      trackEvent("tier_reached", topTier.id);
    }
  }

  function ensureDrawerMount() {
    const drawer =
      document.querySelector("cart-drawer") ||
      document.querySelector("#CartDrawer") ||
      document.querySelector(".cart-drawer");
    if (!drawer) return null;

    let mount = drawer.querySelector("[data-cm-mount='drawer']");
    if (!mount) {
      mount = document.createElement("div");
      mount.setAttribute("data-cm-mount", "drawer");
      const footer =
        drawer.querySelector(".drawer__footer") ||
        drawer.querySelector("[data-cart-footer]") ||
        drawer;
      footer.insertBefore(mount, footer.firstChild);
    }
    return mount;
  }

  async function reconcile() {
    const response = await fetch("/cart.js");
    if (!response.ok) return;
    const cart = await response.json();
    renderBar(cartSubtotal(cart));
  }

  function scheduleReconcile() {
    window.clearTimeout(reconcileTimer);
    reconcileTimer = window.setTimeout(reconcile, 400);
  }

  function patchFetch() {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      try {
        const url = String(args[0] || "");
        if (CART_PATHS.some((path) => url.includes(path))) {
          scheduleReconcile();
        }
      } catch {
        /* ignore */
      }
      return response;
    };
  }

  function patchXHR() {
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this.addEventListener("load", () => {
        if (CART_PATHS.some((path) => String(url).includes(path))) {
          scheduleReconcile();
        }
      });
      return open.call(this, method, url, ...rest);
    };
  }

  async function init() {
    config = await fetchConfig();
    if (!config?.enabled) return;

    patchFetch();
    patchXHR();
    await reconcile();

    document.addEventListener("cart:refresh", reconcile);
    document.addEventListener("cart:updated", reconcile);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
