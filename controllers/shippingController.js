// controllers/shippingController.js
const fetch = require("node-fetch");

// ✅ Supported carriers
const SUPPORTED_CARRIERS = ["ไปรษณีย์ไทย", "Flash", "J&T", "Kerry", "Ninjavan"];

/**
 * Normalize carrier name to internal standard
 */
function normalizeCarrierName(name) {
  if (!name) return "";
  const n = String(name).toLowerCase();
  if (n.includes("flash")) return "Flash";
  if (n.includes("j&t") || n.includes("jnt")) return "J&T";
  if (n.includes("kerry")) return "Kerry";
  if (n.includes("ninjavan")) return "Ninjavan";
  if (n.includes("ไปรษณีย์") || n.includes("post")) return "ไปรษณีย์ไทย";
  return name;
}

/**
 * Main tracking controller
 */
async function track(req, res) {
  const { carrier, tracking } = req.body || {};
  if (!carrier || !tracking) {
    return res
      .status(400)
      .json({ message: "carrier and tracking are required" });
  }

  try {
    const provider = normalizeCarrierName(carrier);
    if (!SUPPORTED_CARRIERS.includes(provider)) {
      return res
        .status(400)
        .json({ message: "unsupported carrier", carrier: provider });
    }

    switch (provider) {
      case "ไปรษณีย์ไทย":
        return await trackThaiPost(tracking, res);
      case "Flash":
        return await trackFlash(tracking, res);
      case "J&T":
        return await trackJNT(tracking, res);
      default:
        return res
          .status(501)
          .json({ message: "provider integration not implemented" });
    }
  } catch (err) {
    console.error("track error", err);
    return res
      .status(500)
      .json({ message: "internal error", error: String(err) });
  }
}

/**
 * Thailand Post handler
 */
async function trackThaiPost(tracking, res) {
  const prefix = "THAI_POST";
  const extraHeaders = {};

  if (process.env.THAI_API_KEY) {
    extraHeaders["Authorization"] = `Bearer ${process.env.THAI_API_KEY}`;
  }

  const result = await performProviderRequest(prefix, tracking, extraHeaders);
  return handleProviderResult(result, res, "ไปรษณีย์ไทย", tracking);
}

/**
 * Flash handler
 */
async function trackFlash(tracking, res) {
  const prefix = "FLASH";
  const result = await performProviderRequest(prefix, tracking);
  return handleProviderResult(result, res, "Flash", tracking);
}

/**
 * J&T handler
 */
async function trackJNT(tracking, res) {
  const prefix = "JNT";
  const result = await performProviderRequest(prefix, tracking);
  return handleProviderResult(result, res, "J&T", tracking);
}

/**
 * Provider request handler
 */
async function performProviderRequest(prefix, tracking, extraHeaders = {}) {
  const urlTemplate = process.env[`${prefix}_TRACK_URL`];
  if (!urlTemplate) {
    return {
      mocked: true,
      warning: `Missing ${prefix}_TRACK_URL in environment`,
      events: [{ time: new Date().toISOString(), status: "Mocked" }],
    };
  }

  const url = urlTemplate.replace("{tracking}", encodeURIComponent(tracking));
  const method = (process.env[`${prefix}_TRACK_METHOD`] || "GET").toUpperCase();
  let headers = { Accept: "application/json" };

  if (process.env[`${prefix}_TRACK_HEADERS`]) {
    try {
      headers = {
        ...headers,
        ...(JSON.parse(process.env[`${prefix}_TRACK_HEADERS`]) || {}),
      };
    } catch {
      // ignore parse error
    }
  }

  headers = { ...headers, ...(extraHeaders || {}) };
  const bodyTemplate = process.env[`${prefix}_TRACK_BODY`];
  let opts = { method, headers };

  if (["POST", "PUT"].includes(method)) {
    opts.body = bodyTemplate
      ? bodyTemplate.replace("{tracking}", tracking)
      : JSON.stringify({ tracking });
    if (!opts.headers["Content-Type"])
      opts.headers["Content-Type"] = "application/json";
  }

  try {
    const resp = await fetchWithTimeout(url, opts, 10000);
    const data = await resp.json();
    return { url, data };
  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * Handle provider result (success, error, fallback, mock)
 */
function handleProviderResult(result, res, providerName, tracking) {
  if (result.mocked) {
    return res.json({
      provider: providerName,
      tracking,
      events: result.events || null,
      warning: result.warning,
    });
  }

  if (result.error) {
    if (process.env.FALLBACK_ON_PROVIDER_ERROR === "false") {
      return res.status(502).json({
        message: `${providerName} request failed`,
        error: result.error,
      });
    }
    return res.json({
      provider: providerName,
      tracking,
      events: result.events || [
        {
          time: new Date().toISOString(),
          status: "Provider unavailable - mocked",
        },
      ],
      warning: `Provider error: ${result.error}`,
    });
  }

  const events = extractEventsFromResponse(result.data) || null;
  return res.json({ provider: providerName, tracking, events });
}

/**
 * Utility: fetch with timeout
 */
async function fetchWithTimeout(url, opts = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(id);
    return resp;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Extract tracking events from provider response
 */
function extractEventsFromResponse(data) {
  if (!data) return null;
  if (Array.isArray(data.events)) return normalizeEvents(data.events);
  if (data.tracking && Array.isArray(data.tracking.events))
    return normalizeEvents(data.tracking.events);
  if (data.data && Array.isArray(data.data.history))
    return normalizeEvents(data.data.history);
  if (Array.isArray(data.tracking_history))
    return normalizeEvents(data.tracking_history);
  if (data.data && data.data.track && Array.isArray(data.data.track))
    return normalizeEvents(data.data.track);

  const arr = findFirstEventsArray(data);
  return arr ? normalizeEvents(arr) : null;
}

function normalizeEvents(arr) {
  return arr.map((e) => ({
    time:
      e.time ||
      e.datetime ||
      e.timestamp ||
      e.date ||
      e.status_time ||
      e.event_time,
    status:
      e.status || e.description || e.message || e.status_description || e.event,
    location: e.location || e.place || e.area || e.branch,
    raw: e,
  }));
}

function findFirstEventsArray(obj) {
  if (!obj || typeof obj !== "object") return null;
  for (const k of Object.keys(obj)) {
    if (
      Array.isArray(obj[k]) &&
      obj[k].length > 0 &&
      typeof obj[k][0] === "object"
    )
      return obj[k];
  }
  return null;
}

/**
 * Lookup order in DB by tracking code
 */
async function lookupOrderByTracking(req, res) {
  try {
    const tracking = (
      req.query.tracking ||
      req.query.trackingNumber ||
      ""
    ).trim();
    if (!tracking)
      return res.status(400).json({ message: "tracking query required" });

    const prisma = require("../config/prisma");
    const order = await prisma.order.findFirst({
      where: { trackingCode: tracking },
      include: {
        address: true,
        orderedBy: true,
        products: {
          include: {
            product: { include: { category: true } },
            variant: { include: {} },
          },
        },
      },
    });

    if (!order)
      return res
        .status(404)
        .json({ message: "ไม่พบคำสั่งซื้อสำหรับรหัสติดตามนี้" });

    // detect provider
    let providerGuess = null;
    const t = tracking.toUpperCase();
    if (t.endsWith("TH") || t.startsWith("EG") || /^TH/.test(t))
      providerGuess = "ไปรษณีย์ไทย";
    else if (/^JNT|^J&T/.test(t)) providerGuess = "J&T";
    else if (/^KERRY|^KRY|^KY/.test(t)) providerGuess = "Kerry";
    else if (t.length >= 10 && /[A-Z]{2}\d{9}[A-Z]{2}/.test(t))
      providerGuess = "ไปรษณีย์ไทย";

    let trackingEvents = null;
    if (providerGuess) {
      try {
        const prefixMap = {
          ไปรษณีย์ไทย: "THAI_POST",
          Flash: "FLASH",
          "J&T": "JNT",
          Kerry: "KERRY",
          Ninjavan: "NINJA",
        };
        const prefix = prefixMap[providerGuess];
        if (prefix) {
          const result = await performProviderRequest(prefix, tracking);
          if (result?.data)
            trackingEvents = extractEventsFromResponse(result.data) || null;
        }
      } catch (e) {
        console.warn("provider lookup failed", e?.message || e);
      }
    }

    // parse images stored as JSON on product/variant rows
    const parsedProducts = (order.products || []).map((p) => {
      const prod = p.product || null;
      const variant = p.variant || null;
      if (prod) {
        try {
          prod.images = Array.isArray(prod.images)
            ? prod.images
            : prod.images
            ? JSON.parse(prod.images)
            : [];
        } catch (e) {
          prod.images = [];
        }
      }
      if (variant) {
        try {
          variant.images = Array.isArray(variant.images)
            ? variant.images
            : variant.images
            ? JSON.parse(variant.images)
            : [];
        } catch (e) {
          variant.images = [];
        }
      }
      return { ...p, product: prod, variant };
    });

    const summary = {
      id: order.id,
      createdAt: order.createdAt,
      cartTotal: order.cartTotal,
      trackingCarrier: order.trackingCarrier || providerGuess,
      trackingCode: order.trackingCode,
      orderStatus: order.orderStatus,
      address: order.address || null,
      orderedBy: order.orderedBy || null,
      // include products (with included product & variant) so callers can render items
      products: parsedProducts,
    };

    return res.json({ ok: true, order: summary, events: trackingEvents });
  } catch (err) {
    console.error("lookupOrderByTracking error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = { track, lookupOrderByTracking };
