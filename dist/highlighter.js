"use strict";
(() => {
  // node_modules/.pnpm/crypto-hash@3.0.0/node_modules/crypto-hash/browser.js
  var bufferToHex = (buffer) => {
    const view = new DataView(buffer);
    let hexCodes = "";
    for (let index = 0; index < view.byteLength; index += 4) {
      hexCodes += view.getUint32(index).toString(16).padStart(8, "0");
    }
    return hexCodes;
  };
  var create = (algorithm) => async (buffer, { outputFormat = "hex" } = {}) => {
    if (typeof buffer === "string") {
      buffer = new globalThis.TextEncoder().encode(buffer);
    }
    const hash = await globalThis.crypto.subtle.digest(algorithm, buffer);
    return outputFormat === "hex" ? bufferToHex(hash) : hash;
  };
  var sha1 = create("SHA-1");
  var sha256 = create("SHA-256");
  var sha384 = create("SHA-384");
  var sha512 = create("SHA-512");

  // src/highlighter.js
  var CLASS = "jquery-highlighter-highlighted";
  var COMMAND_NAME = GM_info.script.name + ": clear data";
  var DEBUG = { enabled: false };
  var DEFAULT_COLOR = "#FFFD66";
  var DEFAULT_ID = "id";
  var DEFAULT_TARGET = function() {
    return $(this);
  };
  var DEFAULT_TTL = { days: 7 };
  var SCRIPT_VERSION = GM_info.script.version;
  var SCHEMA_VERSION = 2;
  var DATA_VERSION = SCHEMA_VERSION + "/" + SCRIPT_VERSION.split(".")[0];
  var TTL = ((ttl) => {
    ttl.second = ttl.seconds = 1;
    ttl.minute = ttl.minutes = 60 * ttl.seconds;
    ttl.hour = ttl.hours = 60 * ttl.minutes;
    ttl.day = ttl.days = 24 * ttl.hours;
    ttl.week = ttl.weeks = 7 * ttl.days;
    return ttl;
  })({});
  var NOT_FOUND = Symbol();
  var GMStore = class {
    delete(key) {
      const deleted = this.has(key);
      GM_deleteValue(key);
      return deleted;
    }
    get(key) {
      const value = GM_getValue(key, NOT_FOUND);
      return value === NOT_FOUND ? void 0 : value;
    }
    has(key) {
      return GM_getValue(key, NOT_FOUND) !== NOT_FOUND;
    }
    keys() {
      return GM_listValues();
    }
    set(key, value) {
      GM_setValue(key, value);
      return this;
    }
  };
  function debug(...args) {
    if (DEBUG.enabled) {
      console.warn(...args);
    }
  }
  function purgeCached(cache, date) {
    for (const key of cache.keys()) {
      const cached = cache.get(key);
      let $delete = true;
      if (date === -1) {
        debug(`purging value (forced): ${key}`);
      } else if (typeof cached.expires !== "number" || typeof cached.version !== "string") {
        debug(`purging invalid value: ${key}:`, cached);
      } else if (date > cached.expires) {
        const expired = new Date(cached.expires).toLocaleString();
        debug(`purging expired value: ${key} (${expired})`);
      } else if (cached.version !== DATA_VERSION) {
        debug(`purging obsolete value: ${key} (${cached.version})`);
      } else {
        $delete = false;
      }
      if ($delete) {
        cache.delete(key);
      }
    }
  }
  function select(name, selector, options = {}) {
    const context = options.context || document;
    const type = typeof selector;
    if (type === "function") {
      return selector.apply(context, options.args || []);
    } else if (type === "string") {
      return $(selector, context);
    } else {
      throw new TypeError(`invalid ${name} selector: expected string or function, got: ${type}`);
    }
  }
  function ttlToMilliseconds(ttl) {
    let seconds = 0;
    for (const key in ttl) {
      seconds += ttl[key] * (TTL[key] || 0);
    }
    return seconds * 1e3;
  }
  var highlightFor = ($2) => async function highlight(options) {
    const NOW = Date.now();
    const useCache = "cache" in options ? !!options.cache : true;
    const cache = useCache ? new GMStore() : /* @__PURE__ */ new Map();
    const highlightDuplicateLinks = "dedup" in options ? !options.dedup : false;
    const ttl = ttlToMilliseconds(options.ttl || DEFAULT_TTL);
    const color = options.color || DEFAULT_COLOR;
    const targetSelector = options.target || DEFAULT_TARGET;
    const idSelector = options.id || DEFAULT_ID;
    const itemSelector = options.item;
    const onHighlight = options.onHighlight || function() {
    };
    DEBUG.enabled = "debug" in options ? !!options.debug : false;
    let getId;
    if (typeof idSelector === "function") {
      getId = (item, args) => select("id", idSelector, { context: item, args });
    } else if (typeof idSelector === "string") {
      getId = (item) => $2(item).attr(idSelector);
    } else {
      throw new TypeError(`invalid ID selector: expected string or function, got: ${idSelector}`);
    }
    if (typeof itemSelector !== "string" && typeof itemSelector !== "function") {
      throw new TypeError(`invalid item selector: expected string or function, got: ${itemSelector}`);
    }
    async function processItems($items) {
      for (const item of $items) {
        const $target = select("target", targetSelector, { context: item, args: [item] });
        const id = getId(item, [$target]);
        const key = await sha256(id);
        const cached = cache.has(key);
        if (!cached || highlightDuplicateLinks) {
          $target.css("background-color", color);
          $target.addClass(CLASS);
          onHighlight.call(item, $target, { id, color });
        }
        if (!cached) {
          const expires = NOW + ttl;
          const value = { expires, version: DATA_VERSION };
          const date = new Date(expires).toLocaleString();
          debug(`caching ${id} (${key}) until ${date}`);
          cache.set(key, value);
        }
      }
    }
    GM_registerMenuCommand(COMMAND_NAME, () => {
      purgeCached(cache, -1);
    });
    purgeCached(cache, NOW);
    const $document = $2(document);
    if ($document.onCreate && typeof itemSelector === "string") {
      $document.onCreate(
        itemSelector,
        processItems,
        true
        /* multi */
      );
    } else {
      const $items = select("item", itemSelector);
      await processItems($items);
    }
  };
  jQuery.highlight = highlightFor(jQuery);
  jQuery.highlight.className = CLASS;
  jQuery.highlight.selector = "." + CLASS;
})();
