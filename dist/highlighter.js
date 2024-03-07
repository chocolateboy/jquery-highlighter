(function () {
	'use strict';

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	// Ponyfill for `globalThis`
	const _globalThis = (() => {
		if (typeof globalThis !== 'undefined') {
			return globalThis;
		}

		if (typeof self !== 'undefined') {
			return self;
		}

		/* istanbul ignore next */
		if (typeof window !== 'undefined') {
			return window;
		}

		/* istanbul ignore next */
		if (typeof commonjsGlobal !== 'undefined') {
			return commonjsGlobal;
		}
	})();

	const bufferToHex = buffer => {
		const view = new DataView(buffer);

		let hexCodes = '';
		for (let i = 0; i < view.byteLength; i += 4) {
			hexCodes += view.getUint32(i).toString(16).padStart(8, '0');
		}

		return hexCodes;
	};

	const create = algorithm => async (buffer, options) => {
		if (typeof buffer === 'string') {
			buffer = new _globalThis.TextEncoder().encode(buffer);
		}

		options = {
			outputFormat: 'hex',
			...options
		};

		const hash = await _globalThis.crypto.subtle.digest(algorithm, buffer);

		return options.outputFormat === 'hex' ? bufferToHex(hash) : hash;
	};
	var sha256 = create('SHA-256');

	// required:
	const CLASS = 'jquery-highlighter-highlighted';
	const COMMAND_NAME = GM_info.script.name + ': clear data';
	const DEBUG = {
	  enabled: false
	};
	const DEFAULT_COLOR = '#FFFD66';
	const DEFAULT_ID = 'id';
	const DEFAULT_TARGET = function () {
	  return $(this);
	}; // i.e. $item
	const DEFAULT_TTL = {
	  days: 7
	};
	const SCRIPT_VERSION = GM_info.script.version;

	// XXX copied (with adjustments) from IMDb Tomatoes [1]
	//
	// the version of each cached record is a combination of the schema version
	// and the <major> part of the script's (SemVer) version e.g. 1 (schema
	// version) + 3.0.0 (script version) gives a version of "1/3"
	//
	// this means cached records are invalidated either a) when the schema
	// changes or b) when the major version (i.e. not the minor or patch
	// version) of the script changes
	//
	// [1] https://greasyfork.org/en/scripts/15222-imdb-tomatoes
	const SCHEMA_VERSION = 2;
	const DATA_VERSION = SCHEMA_VERSION + '/' + SCRIPT_VERSION.split('.')[0]; // e.g. 1/3

	// time-to-live: how long (in seconds) to cache IDs for
	const TTL = (ttl => {
	  ttl.second = ttl.seconds = 1;
	  ttl.minute = ttl.minutes = 60 * ttl.seconds;
	  ttl.hour = ttl.hours = 60 * ttl.minutes;
	  ttl.day = ttl.days = 24 * ttl.hours;
	  ttl.week = ttl.weeks = 7 * ttl.days;
	  return ttl;
	})({});

	/**************************** helper classes ****************************/

	// expose the userscript storage backend via the standard ES6 Map API.
	//
	// XXX this should be packaged as a module, e.g. as a backend for keyv [1]
	//
	// [1] https://github.com/lukechilds/keyv

	const NOT_FOUND = Symbol();
	class GMStore {
	  delete(key) {
	    const deleted = this.has(key);
	    GM_deleteValue(key);
	    return deleted;
	  }
	  get(key) {
	    const value = GM_getValue(key, NOT_FOUND);
	    return value === NOT_FOUND ? undefined : value;
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
	}

	/**************************** helper functions ****************************/
	// log a debug message to the console if debugging is enabled (via
	// options.debug)
	function debug(...args) {
	  if (DEBUG.enabled) {
	    console.warn(...args);
	  }
	}

	// purge expired cache entries (encrypted IDs)
	// borrowed from IMDb Tomatoes (see above)
	function purgeCached(cache, date) {
	  for (const key of cache.keys()) {
	    const cached = cache.get(key);
	    let $delete = true;
	    if (date === -1) {
	      debug(`purging value (forced): ${key}`);
	    } else if (typeof cached.expires !== 'number' || typeof cached.version !== 'string') {
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

	// a uniform way to jQuery-select an element/elements. allows a selector to be
	// defined as a string (jQuery selector) or a function which returns a jQuery
	// collection
	//
	// - name: the name (string) of the thing being selected (e.g. item or ID);
	//   used for diagnostics
	// - selector: a string (jQuery.Selector) or a function which is called
	//   with the supplied `this` value (context) and arguments
	// - context (optional): the `this` value to assign when calling the
	//   function, or the second argument to pass to $(selector, context);
	//   defaults to window.document if not supplied
	// - args (optional): an array of additional arguments to pass when the
	//   selector is a function
	function select(name, selector, options = {}) {
	  const context = options.context || document;
	  const type = typeof selector;
	  if (type === 'function') {
	    return selector.apply(context, options.args || []);
	  } else if (type === 'string') {
	    return $(selector, context);
	  } else {
	    throw new TypeError(`invalid ${name} selector: expected string or function, got: ${type}`);
	  }
	}

	// take a TTL spec (object) and convert it into a duration in milliseconds
	function ttlToMilliseconds(ttl) {
	  let seconds = 0;
	  for (const key in ttl) {
	    seconds += ttl[key] * (TTL[key] || 0);
	  }
	  return seconds * 1000;
	}

	/************************************ main ************************************/

	const highlightFor = $ => async function highlight(options) {
	  const NOW = Date.now();

	  // if falsey, the cache is neither read from nor written to.
	  // this allows highlighters to be modified and reloaded
	  // without having to manually clear the cache every time
	  const useCache = 'cache' in options ? !!options.cache : true;

	  // uniform access to the cache backend which respects options.cache. if true,
	  // the userscript store is read from and written to; otherwise a transient Map
	  // is used instead
	  const cache = useCache ? new GMStore() : new Map();

	  // if set to a falsey value, don't deduplicate article IDs i.e. *do*
	  // highlight duplicate links
	  const highlightDuplicateLinks = 'dedup' in options ? !options.dedup : false;

	  // time-to-live: how long (in milliseconds) to cache IDs for
	  const ttl = ttlToMilliseconds(options.ttl || DEFAULT_TTL);

	  // the background color of the target element(s)
	  const color = options.color || DEFAULT_COLOR;

	  // selector (string or function) for the element to highlight
	  const targetSelector = options.target || DEFAULT_TARGET;

	  // attribute name (string) or function to select a unique
	  // identifier for each item
	  const idSelector = options.id || DEFAULT_ID;

	  // selector (string or function) for the article/story
	  const itemSelector = options.item;

	  // optional callback function called after the target has been highlighted
	  const onHighlight = options.onHighlight || function () {};

	  // enable/disable the debug function to log (some) diagnostic messages
	  // to the console
	  DEBUG.enabled = 'debug' in options ? !!options.debug : false;

	  // helper function which extracts an item's unique ID
	  let getId;
	  if (typeof idSelector === 'function') {
	    getId = (item, args) => select('id', idSelector, {
	      context: item,
	      args
	    });
	  } else if (typeof idSelector === 'string') {
	    getId = item => $(item).attr(idSelector);
	  } else {
	    throw new TypeError(`invalid ID selector: expected string or function, got: ${idSelector}`);
	  }
	  if (typeof itemSelector !== 'string' && typeof itemSelector !== 'function') {
	    throw new TypeError(`invalid item selector: expected string or function, got: ${itemSelector}`);
	  }

	  // highlight the selected articles/stories
	  async function processItems($items) {
	    for (const item of $items) {
	      const $target = select('target', targetSelector, {
	        context: item,
	        args: [item]
	      });
	      const id = getId(item, [$target]);
	      const key = await sha256(id);
	      const cached = cache.has(key);
	      if (!cached || highlightDuplicateLinks) {
	        $target.css('background-color', color);
	        $target.addClass(CLASS);
	        onHighlight.call(item, $target, {
	          id: id,
	          color: color
	        });
	      }
	      if (!cached) {
	        const expires = NOW + ttl;
	        const value = {
	          expires,
	          version: DATA_VERSION
	        };
	        const date = new Date(expires).toLocaleString();
	        debug(`caching ${id} (${key}) until ${date}`);
	        cache.set(key, value);
	      }
	    }
	  }

	  // register this early so data can be cleared even if there's an error
	  GM_registerMenuCommand(COMMAND_NAME, () => {
	    purgeCached(cache, -1);
	  });

	  // remove expired cache entries
	  purgeCached(cache, NOW);
	  const $document = $(document);

	  // if the jQuery-onMutate plugin is loaded
	  if ($document.onCreate && typeof itemSelector === 'string') {
	    // handle dynamically-created items (includes statically-defined items)
	    $document.onCreate(itemSelector, processItems, true /* multi */);
	  } else {
	    // handle statically-defined items
	    const $items = select('item', itemSelector);
	    await processItems($items);
	  }
	};
	jQuery.highlight = highlightFor(jQuery);
	jQuery.highlight.className = CLASS;
	jQuery.highlight.selector = '.' + CLASS;

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGlnaGxpZ2h0ZXIuanMiLCJzb3VyY2VzIjpbIi4uL25vZGVfbW9kdWxlcy8ucG5wbS9jcnlwdG8taGFzaEAxLjMuMC9ub2RlX21vZHVsZXMvY3J5cHRvLWhhc2gvYnJvd3Nlci5qcyIsIi4uL3NyYy9oaWdobGlnaHRlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiBlc2xpbnQtZW52IGJyb3dzZXIgKi9cbi8qIGdsb2JhbCBnbG9iYWxUaGlzOnJlYWRvbmx5ICovXG4ndXNlIHN0cmljdCc7XG5cbi8vIFBvbnlmaWxsIGZvciBgZ2xvYmFsVGhpc2BcbmNvbnN0IF9nbG9iYWxUaGlzID0gKCgpID0+IHtcblx0aWYgKHR5cGVvZiBnbG9iYWxUaGlzICE9PSAndW5kZWZpbmVkJykge1xuXHRcdHJldHVybiBnbG9iYWxUaGlzO1xuXHR9XG5cblx0aWYgKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJykge1xuXHRcdHJldHVybiBzZWxmO1xuXHR9XG5cblx0LyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cblx0aWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0cmV0dXJuIHdpbmRvdztcblx0fVxuXG5cdC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG5cdGlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xuXHRcdHJldHVybiBnbG9iYWw7XG5cdH1cbn0pKCk7XG5cbmNvbnN0IGJ1ZmZlclRvSGV4ID0gYnVmZmVyID0+IHtcblx0Y29uc3QgdmlldyA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xuXG5cdGxldCBoZXhDb2RlcyA9ICcnO1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IHZpZXcuYnl0ZUxlbmd0aDsgaSArPSA0KSB7XG5cdFx0aGV4Q29kZXMgKz0gdmlldy5nZXRVaW50MzIoaSkudG9TdHJpbmcoMTYpLnBhZFN0YXJ0KDgsICcwJyk7XG5cdH1cblxuXHRyZXR1cm4gaGV4Q29kZXM7XG59O1xuXG5jb25zdCBjcmVhdGUgPSBhbGdvcml0aG0gPT4gYXN5bmMgKGJ1ZmZlciwgb3B0aW9ucykgPT4ge1xuXHRpZiAodHlwZW9mIGJ1ZmZlciA9PT0gJ3N0cmluZycpIHtcblx0XHRidWZmZXIgPSBuZXcgX2dsb2JhbFRoaXMuVGV4dEVuY29kZXIoKS5lbmNvZGUoYnVmZmVyKTtcblx0fVxuXG5cdG9wdGlvbnMgPSB7XG5cdFx0b3V0cHV0Rm9ybWF0OiAnaGV4Jyxcblx0XHQuLi5vcHRpb25zXG5cdH07XG5cblx0Y29uc3QgaGFzaCA9IGF3YWl0IF9nbG9iYWxUaGlzLmNyeXB0by5zdWJ0bGUuZGlnZXN0KGFsZ29yaXRobSwgYnVmZmVyKTtcblxuXHRyZXR1cm4gb3B0aW9ucy5vdXRwdXRGb3JtYXQgPT09ICdoZXgnID8gYnVmZmVyVG9IZXgoaGFzaCkgOiBoYXNoO1xufTtcblxuZXhwb3J0cy5zaGExID0gY3JlYXRlKCdTSEEtMScpO1xuZXhwb3J0cy5zaGEyNTYgPSBjcmVhdGUoJ1NIQS0yNTYnKTtcbmV4cG9ydHMuc2hhMzg0ID0gY3JlYXRlKCdTSEEtMzg0Jyk7XG5leHBvcnRzLnNoYTUxMiA9IGNyZWF0ZSgnU0hBLTUxMicpO1xuIiwiLy8gcmVxdWlyZWQ6XG4vL1xuLy8gICAtIGpRdWVyeVxuLy8gICAtIEdNX2RlbGV0ZVZhbHVlXG4vLyAgIC0gR01fZ2V0VmFsdWVcbi8vICAgLSBHTV9saXN0VmFsdWVzXG4vLyAgIC0gR01fcmVnaXN0ZXJNZW51Q29tbWFuZFxuLy8gICAtIEdNX3NldFZhbHVlXG5cbmltcG9ydCB7IHNoYTI1NiBhcyBlbmNyeXB0IH0gZnJvbSAnY3J5cHRvLWhhc2gnXG5cbmNvbnN0IENMQVNTICAgICAgICAgID0gJ2pxdWVyeS1oaWdobGlnaHRlci1oaWdobGlnaHRlZCdcbmNvbnN0IENPTU1BTkRfTkFNRSAgID0gR01faW5mby5zY3JpcHQubmFtZSArICc6IGNsZWFyIGRhdGEnXG5jb25zdCBERUJVRyAgICAgICAgICA9IHsgZW5hYmxlZDogZmFsc2UgfVxuY29uc3QgREVGQVVMVF9DT0xPUiAgPSAnI0ZGRkQ2NidcbmNvbnN0IERFRkFVTFRfSUQgICAgID0gJ2lkJ1xuY29uc3QgREVGQVVMVF9UQVJHRVQgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAkKHRoaXMpIH0gLy8gaS5lLiAkaXRlbVxuY29uc3QgREVGQVVMVF9UVEwgICAgPSB7IGRheXM6IDcgfVxuY29uc3QgU0NSSVBUX1ZFUlNJT04gPSBHTV9pbmZvLnNjcmlwdC52ZXJzaW9uXG5cbi8vIFhYWCBjb3BpZWQgKHdpdGggYWRqdXN0bWVudHMpIGZyb20gSU1EYiBUb21hdG9lcyBbMV1cbi8vXG4vLyB0aGUgdmVyc2lvbiBvZiBlYWNoIGNhY2hlZCByZWNvcmQgaXMgYSBjb21iaW5hdGlvbiBvZiB0aGUgc2NoZW1hIHZlcnNpb25cbi8vIGFuZCB0aGUgPG1ham9yPiBwYXJ0IG9mIHRoZSBzY3JpcHQncyAoU2VtVmVyKSB2ZXJzaW9uIGUuZy4gMSAoc2NoZW1hXG4vLyB2ZXJzaW9uKSArIDMuMC4wIChzY3JpcHQgdmVyc2lvbikgZ2l2ZXMgYSB2ZXJzaW9uIG9mIFwiMS8zXCJcbi8vXG4vLyB0aGlzIG1lYW5zIGNhY2hlZCByZWNvcmRzIGFyZSBpbnZhbGlkYXRlZCBlaXRoZXIgYSkgd2hlbiB0aGUgc2NoZW1hXG4vLyBjaGFuZ2VzIG9yIGIpIHdoZW4gdGhlIG1ham9yIHZlcnNpb24gKGkuZS4gbm90IHRoZSBtaW5vciBvciBwYXRjaFxuLy8gdmVyc2lvbikgb2YgdGhlIHNjcmlwdCBjaGFuZ2VzXG4vL1xuLy8gWzFdIGh0dHBzOi8vZ3JlYXN5Zm9yay5vcmcvZW4vc2NyaXB0cy8xNTIyMi1pbWRiLXRvbWF0b2VzXG5jb25zdCBTQ0hFTUFfVkVSU0lPTiA9IDJcbmNvbnN0IERBVEFfVkVSU0lPTiA9IFNDSEVNQV9WRVJTSU9OICsgJy8nICsgU0NSSVBUX1ZFUlNJT04uc3BsaXQoJy4nKVswXSAvLyBlLmcuIDEvM1xuXG4vLyB0aW1lLXRvLWxpdmU6IGhvdyBsb25nIChpbiBzZWNvbmRzKSB0byBjYWNoZSBJRHMgZm9yXG5jb25zdCBUVEwgPSAodHRsID0+IHtcbiAgICB0dGwuc2Vjb25kID0gdHRsLnNlY29uZHMgPSAxXG4gICAgdHRsLm1pbnV0ZSA9IHR0bC5taW51dGVzID0gNjAgKiB0dGwuc2Vjb25kc1xuICAgIHR0bC5ob3VyICAgPSB0dGwuaG91cnMgICA9IDYwICogdHRsLm1pbnV0ZXNcbiAgICB0dGwuZGF5ICAgID0gdHRsLmRheXMgICAgPSAyNCAqIHR0bC5ob3Vyc1xuICAgIHR0bC53ZWVrICAgPSB0dGwud2Vla3MgICA9IDcgICogdHRsLmRheXNcbiAgICByZXR1cm4gdHRsXG59KSh7fSlcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKiogaGVscGVyIGNsYXNzZXMgKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLy8gZXhwb3NlIHRoZSB1c2Vyc2NyaXB0IHN0b3JhZ2UgYmFja2VuZCB2aWEgdGhlIHN0YW5kYXJkIEVTNiBNYXAgQVBJLlxuLy9cbi8vIFhYWCB0aGlzIHNob3VsZCBiZSBwYWNrYWdlZCBhcyBhIG1vZHVsZSwgZS5nLiBhcyBhIGJhY2tlbmQgZm9yIGtleXYgWzFdXG4vL1xuLy8gWzFdIGh0dHBzOi8vZ2l0aHViLmNvbS9sdWtlY2hpbGRzL2tleXZcblxuY29uc3QgTk9UX0ZPVU5EID0gU3ltYm9sKClcblxuY2xhc3MgR01TdG9yZSB7XG4gICAgZGVsZXRlIChrZXkpIHtcbiAgICAgICAgY29uc3QgZGVsZXRlZCA9IHRoaXMuaGFzKGtleSlcbiAgICAgICAgR01fZGVsZXRlVmFsdWUoa2V5KVxuICAgICAgICByZXR1cm4gZGVsZXRlZFxuICAgIH1cblxuICAgIGdldCAoa2V5KSB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gR01fZ2V0VmFsdWUoa2V5LCBOT1RfRk9VTkQpXG4gICAgICAgIHJldHVybiB2YWx1ZSA9PT0gTk9UX0ZPVU5EID8gdW5kZWZpbmVkIDogdmFsdWVcbiAgICB9XG5cbiAgICBoYXMgKGtleSkge1xuICAgICAgICByZXR1cm4gR01fZ2V0VmFsdWUoa2V5LCBOT1RfRk9VTkQpICE9PSBOT1RfRk9VTkRcbiAgICB9XG5cbiAgICBrZXlzICgpIHtcbiAgICAgICAgcmV0dXJuIEdNX2xpc3RWYWx1ZXMoKVxuICAgIH1cblxuICAgIHNldCAoa2V5LCB2YWx1ZSkge1xuICAgICAgICBHTV9zZXRWYWx1ZShrZXksIHZhbHVlKVxuICAgICAgICByZXR1cm4gdGhpc1xuICAgIH1cbn1cblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKiogaGVscGVyIGZ1bmN0aW9ucyAqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLy8gbG9nIGEgZGVidWcgbWVzc2FnZSB0byB0aGUgY29uc29sZSBpZiBkZWJ1Z2dpbmcgaXMgZW5hYmxlZCAodmlhXG4vLyBvcHRpb25zLmRlYnVnKVxuZnVuY3Rpb24gZGVidWcgKC4uLmFyZ3MpIHtcbiAgICBpZiAoREVCVUcuZW5hYmxlZCkge1xuICAgICAgICBjb25zb2xlLndhcm4oLi4uYXJncylcbiAgICB9XG59XG5cbi8vIHB1cmdlIGV4cGlyZWQgY2FjaGUgZW50cmllcyAoZW5jcnlwdGVkIElEcylcbi8vIGJvcnJvd2VkIGZyb20gSU1EYiBUb21hdG9lcyAoc2VlIGFib3ZlKVxuZnVuY3Rpb24gcHVyZ2VDYWNoZWQgKGNhY2hlLCBkYXRlKSB7XG4gICAgZm9yIChjb25zdCBrZXkgb2YgY2FjaGUua2V5cygpKSB7XG4gICAgICAgIGNvbnN0IGNhY2hlZCA9IGNhY2hlLmdldChrZXkpXG5cbiAgICAgICAgbGV0ICRkZWxldGUgPSB0cnVlXG5cbiAgICAgICAgaWYgKGRhdGUgPT09IC0xKSB7XG4gICAgICAgICAgICBkZWJ1ZyhgcHVyZ2luZyB2YWx1ZSAoZm9yY2VkKTogJHtrZXl9YClcbiAgICAgICAgfSBlbHNlIGlmICgodHlwZW9mIGNhY2hlZC5leHBpcmVzICE9PSAnbnVtYmVyJykgfHwgKHR5cGVvZiBjYWNoZWQudmVyc2lvbiAhPT0gJ3N0cmluZycpKSB7XG4gICAgICAgICAgICBkZWJ1ZyhgcHVyZ2luZyBpbnZhbGlkIHZhbHVlOiAke2tleX06YCwgY2FjaGVkKVxuICAgICAgICB9IGVsc2UgaWYgKGRhdGUgPiBjYWNoZWQuZXhwaXJlcykge1xuICAgICAgICAgICAgY29uc3QgZXhwaXJlZCA9IG5ldyBEYXRlKGNhY2hlZC5leHBpcmVzKS50b0xvY2FsZVN0cmluZygpXG4gICAgICAgICAgICBkZWJ1ZyhgcHVyZ2luZyBleHBpcmVkIHZhbHVlOiAke2tleX0gKCR7ZXhwaXJlZH0pYClcbiAgICAgICAgfSBlbHNlIGlmIChjYWNoZWQudmVyc2lvbiAhPT0gREFUQV9WRVJTSU9OKSB7XG4gICAgICAgICAgICBkZWJ1ZyhgcHVyZ2luZyBvYnNvbGV0ZSB2YWx1ZTogJHtrZXl9ICgke2NhY2hlZC52ZXJzaW9ufSlgKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgJGRlbGV0ZSA9IGZhbHNlXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoJGRlbGV0ZSkge1xuICAgICAgICAgICAgY2FjaGUuZGVsZXRlKGtleSlcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLy8gYSB1bmlmb3JtIHdheSB0byBqUXVlcnktc2VsZWN0IGFuIGVsZW1lbnQvZWxlbWVudHMuIGFsbG93cyBhIHNlbGVjdG9yIHRvIGJlXG4vLyBkZWZpbmVkIGFzIGEgc3RyaW5nIChqUXVlcnkgc2VsZWN0b3IpIG9yIGEgZnVuY3Rpb24gd2hpY2ggcmV0dXJucyBhIGpRdWVyeVxuLy8gY29sbGVjdGlvblxuLy9cbi8vIC0gbmFtZTogdGhlIG5hbWUgKHN0cmluZykgb2YgdGhlIHRoaW5nIGJlaW5nIHNlbGVjdGVkIChlLmcuIGl0ZW0gb3IgSUQpO1xuLy8gICB1c2VkIGZvciBkaWFnbm9zdGljc1xuLy8gLSBzZWxlY3RvcjogYSBzdHJpbmcgKGpRdWVyeS5TZWxlY3Rvcikgb3IgYSBmdW5jdGlvbiB3aGljaCBpcyBjYWxsZWRcbi8vICAgd2l0aCB0aGUgc3VwcGxpZWQgYHRoaXNgIHZhbHVlIChjb250ZXh0KSBhbmQgYXJndW1lbnRzXG4vLyAtIGNvbnRleHQgKG9wdGlvbmFsKTogdGhlIGB0aGlzYCB2YWx1ZSB0byBhc3NpZ24gd2hlbiBjYWxsaW5nIHRoZVxuLy8gICBmdW5jdGlvbiwgb3IgdGhlIHNlY29uZCBhcmd1bWVudCB0byBwYXNzIHRvICQoc2VsZWN0b3IsIGNvbnRleHQpO1xuLy8gICBkZWZhdWx0cyB0byB3aW5kb3cuZG9jdW1lbnQgaWYgbm90IHN1cHBsaWVkXG4vLyAtIGFyZ3MgKG9wdGlvbmFsKTogYW4gYXJyYXkgb2YgYWRkaXRpb25hbCBhcmd1bWVudHMgdG8gcGFzcyB3aGVuIHRoZVxuLy8gICBzZWxlY3RvciBpcyBhIGZ1bmN0aW9uXG5mdW5jdGlvbiBzZWxlY3QgKG5hbWUsIHNlbGVjdG9yLCBvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCBjb250ZXh0ID0gb3B0aW9ucy5jb250ZXh0IHx8IGRvY3VtZW50XG4gICAgY29uc3QgdHlwZSA9IHR5cGVvZiBzZWxlY3RvclxuXG4gICAgaWYgKHR5cGUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcmV0dXJuIHNlbGVjdG9yLmFwcGx5KGNvbnRleHQsIG9wdGlvbnMuYXJncyB8fCBbXSlcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiAkKHNlbGVjdG9yLCBjb250ZXh0KVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYGludmFsaWQgJHtuYW1lfSBzZWxlY3RvcjogZXhwZWN0ZWQgc3RyaW5nIG9yIGZ1bmN0aW9uLCBnb3Q6ICR7dHlwZX1gKVxuICAgIH1cbn1cblxuLy8gdGFrZSBhIFRUTCBzcGVjIChvYmplY3QpIGFuZCBjb252ZXJ0IGl0IGludG8gYSBkdXJhdGlvbiBpbiBtaWxsaXNlY29uZHNcbmZ1bmN0aW9uIHR0bFRvTWlsbGlzZWNvbmRzICh0dGwpIHtcbiAgICBsZXQgc2Vjb25kcyA9IDBcblxuICAgIGZvciAoY29uc3Qga2V5IGluIHR0bCkge1xuICAgICAgICBzZWNvbmRzICs9IHR0bFtrZXldICogKFRUTFtrZXldIHx8IDApXG4gICAgfVxuXG4gICAgcmV0dXJuIHNlY29uZHMgKiAxMDAwXG59XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogbWFpbiAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbmNvbnN0IGhpZ2hsaWdodEZvciA9ICQgPT4gYXN5bmMgZnVuY3Rpb24gaGlnaGxpZ2h0IChvcHRpb25zKSB7XG4gICAgY29uc3QgTk9XID0gRGF0ZS5ub3coKVxuXG4gICAgLy8gaWYgZmFsc2V5LCB0aGUgY2FjaGUgaXMgbmVpdGhlciByZWFkIGZyb20gbm9yIHdyaXR0ZW4gdG8uXG4gICAgLy8gdGhpcyBhbGxvd3MgaGlnaGxpZ2h0ZXJzIHRvIGJlIG1vZGlmaWVkIGFuZCByZWxvYWRlZFxuICAgIC8vIHdpdGhvdXQgaGF2aW5nIHRvIG1hbnVhbGx5IGNsZWFyIHRoZSBjYWNoZSBldmVyeSB0aW1lXG4gICAgY29uc3QgdXNlQ2FjaGUgPSAnY2FjaGUnIGluIG9wdGlvbnMgPyAhIW9wdGlvbnMuY2FjaGUgOiB0cnVlXG5cbiAgICAvLyB1bmlmb3JtIGFjY2VzcyB0byB0aGUgY2FjaGUgYmFja2VuZCB3aGljaCByZXNwZWN0cyBvcHRpb25zLmNhY2hlLiBpZiB0cnVlLFxuICAgIC8vIHRoZSB1c2Vyc2NyaXB0IHN0b3JlIGlzIHJlYWQgZnJvbSBhbmQgd3JpdHRlbiB0bzsgb3RoZXJ3aXNlIGEgdHJhbnNpZW50IE1hcFxuICAgIC8vIGlzIHVzZWQgaW5zdGVhZFxuICAgIGNvbnN0IGNhY2hlID0gdXNlQ2FjaGUgPyBuZXcgR01TdG9yZSgpIDogbmV3IE1hcCgpXG5cbiAgICAvLyBpZiBzZXQgdG8gYSBmYWxzZXkgdmFsdWUsIGRvbid0IGRlZHVwbGljYXRlIGFydGljbGUgSURzIGkuZS4gKmRvKlxuICAgIC8vIGhpZ2hsaWdodCBkdXBsaWNhdGUgbGlua3NcbiAgICBjb25zdCBoaWdobGlnaHREdXBsaWNhdGVMaW5rcyA9ICdkZWR1cCcgaW4gb3B0aW9ucyA/ICFvcHRpb25zLmRlZHVwIDogZmFsc2VcblxuICAgIC8vIHRpbWUtdG8tbGl2ZTogaG93IGxvbmcgKGluIG1pbGxpc2Vjb25kcykgdG8gY2FjaGUgSURzIGZvclxuICAgIGNvbnN0IHR0bCA9IHR0bFRvTWlsbGlzZWNvbmRzKG9wdGlvbnMudHRsIHx8IERFRkFVTFRfVFRMKVxuXG4gICAgLy8gdGhlIGJhY2tncm91bmQgY29sb3Igb2YgdGhlIHRhcmdldCBlbGVtZW50KHMpXG4gICAgY29uc3QgY29sb3IgPSBvcHRpb25zLmNvbG9yIHx8IERFRkFVTFRfQ09MT1JcblxuICAgIC8vIHNlbGVjdG9yIChzdHJpbmcgb3IgZnVuY3Rpb24pIGZvciB0aGUgZWxlbWVudCB0byBoaWdobGlnaHRcbiAgICBjb25zdCB0YXJnZXRTZWxlY3RvciA9IG9wdGlvbnMudGFyZ2V0IHx8IERFRkFVTFRfVEFSR0VUXG5cbiAgICAvLyBhdHRyaWJ1dGUgbmFtZSAoc3RyaW5nKSBvciBmdW5jdGlvbiB0byBzZWxlY3QgYSB1bmlxdWVcbiAgICAvLyBpZGVudGlmaWVyIGZvciBlYWNoIGl0ZW1cbiAgICBjb25zdCBpZFNlbGVjdG9yID0gb3B0aW9ucy5pZCB8fCBERUZBVUxUX0lEXG5cbiAgICAvLyBzZWxlY3RvciAoc3RyaW5nIG9yIGZ1bmN0aW9uKSBmb3IgdGhlIGFydGljbGUvc3RvcnlcbiAgICBjb25zdCBpdGVtU2VsZWN0b3IgPSBvcHRpb25zLml0ZW1cblxuICAgIC8vIG9wdGlvbmFsIGNhbGxiYWNrIGZ1bmN0aW9uIGNhbGxlZCBhZnRlciB0aGUgdGFyZ2V0IGhhcyBiZWVuIGhpZ2hsaWdodGVkXG4gICAgY29uc3Qgb25IaWdobGlnaHQgPSBvcHRpb25zLm9uSGlnaGxpZ2h0IHx8IGZ1bmN0aW9uICgpIHt9XG5cbiAgICAvLyBlbmFibGUvZGlzYWJsZSB0aGUgZGVidWcgZnVuY3Rpb24gdG8gbG9nIChzb21lKSBkaWFnbm9zdGljIG1lc3NhZ2VzXG4gICAgLy8gdG8gdGhlIGNvbnNvbGVcbiAgICBERUJVRy5lbmFibGVkID0gJ2RlYnVnJyBpbiBvcHRpb25zID8gISFvcHRpb25zLmRlYnVnIDogZmFsc2VcblxuICAgIC8vIGhlbHBlciBmdW5jdGlvbiB3aGljaCBleHRyYWN0cyBhbiBpdGVtJ3MgdW5pcXVlIElEXG4gICAgbGV0IGdldElkXG5cbiAgICBpZiAodHlwZW9mIGlkU2VsZWN0b3IgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZ2V0SWQgPSAoaXRlbSwgYXJncykgPT4gc2VsZWN0KCdpZCcsIGlkU2VsZWN0b3IsIHsgY29udGV4dDogaXRlbSwgYXJncyB9KVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGlkU2VsZWN0b3IgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGdldElkID0gaXRlbSA9PiAkKGl0ZW0pLmF0dHIoaWRTZWxlY3RvcilcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBpbnZhbGlkIElEIHNlbGVjdG9yOiBleHBlY3RlZCBzdHJpbmcgb3IgZnVuY3Rpb24sIGdvdDogJHtpZFNlbGVjdG9yfWApXG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBpdGVtU2VsZWN0b3IgIT09ICdzdHJpbmcnICYmIHR5cGVvZiBpdGVtU2VsZWN0b3IgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgaW52YWxpZCBpdGVtIHNlbGVjdG9yOiBleHBlY3RlZCBzdHJpbmcgb3IgZnVuY3Rpb24sIGdvdDogJHtpdGVtU2VsZWN0b3J9YClcbiAgICB9XG5cbiAgICAvLyBoaWdobGlnaHQgdGhlIHNlbGVjdGVkIGFydGljbGVzL3N0b3JpZXNcbiAgICBhc3luYyBmdW5jdGlvbiBwcm9jZXNzSXRlbXMgKCRpdGVtcykge1xuICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgJGl0ZW1zKSB7XG4gICAgICAgICAgICBjb25zdCAkdGFyZ2V0ID0gc2VsZWN0KCd0YXJnZXQnLCB0YXJnZXRTZWxlY3RvciwgeyBjb250ZXh0OiBpdGVtLCBhcmdzOiBbaXRlbV0gfSlcbiAgICAgICAgICAgIGNvbnN0IGlkID0gZ2V0SWQoaXRlbSwgWyR0YXJnZXRdKVxuICAgICAgICAgICAgY29uc3Qga2V5ID0gYXdhaXQgZW5jcnlwdChpZClcbiAgICAgICAgICAgIGNvbnN0IGNhY2hlZCA9IGNhY2hlLmhhcyhrZXkpXG5cbiAgICAgICAgICAgIGlmICghY2FjaGVkIHx8IGhpZ2hsaWdodER1cGxpY2F0ZUxpbmtzKSB7XG4gICAgICAgICAgICAgICAgJHRhcmdldC5jc3MoJ2JhY2tncm91bmQtY29sb3InLCBjb2xvcilcbiAgICAgICAgICAgICAgICAkdGFyZ2V0LmFkZENsYXNzKENMQVNTKVxuICAgICAgICAgICAgICAgIG9uSGlnaGxpZ2h0LmNhbGwoaXRlbSwgJHRhcmdldCwgeyBpZDogaWQsIGNvbG9yOiBjb2xvciB9KVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWNhY2hlZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGV4cGlyZXMgPSBOT1cgKyB0dGxcbiAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IHsgZXhwaXJlcywgdmVyc2lvbjogREFUQV9WRVJTSU9OIH1cbiAgICAgICAgICAgICAgICBjb25zdCBkYXRlID0gbmV3IERhdGUoZXhwaXJlcykudG9Mb2NhbGVTdHJpbmcoKVxuXG4gICAgICAgICAgICAgICAgZGVidWcoYGNhY2hpbmcgJHtpZH0gKCR7a2V5fSkgdW50aWwgJHtkYXRlfWApXG4gICAgICAgICAgICAgICAgY2FjaGUuc2V0KGtleSwgdmFsdWUpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZWdpc3RlciB0aGlzIGVhcmx5IHNvIGRhdGEgY2FuIGJlIGNsZWFyZWQgZXZlbiBpZiB0aGVyZSdzIGFuIGVycm9yXG4gICAgR01fcmVnaXN0ZXJNZW51Q29tbWFuZChDT01NQU5EX05BTUUsICgpID0+IHsgcHVyZ2VDYWNoZWQoY2FjaGUsIC0xKSB9KVxuXG4gICAgLy8gcmVtb3ZlIGV4cGlyZWQgY2FjaGUgZW50cmllc1xuICAgIHB1cmdlQ2FjaGVkKGNhY2hlLCBOT1cpXG5cbiAgICBjb25zdCAkZG9jdW1lbnQgPSAkKGRvY3VtZW50KVxuXG4gICAgLy8gaWYgdGhlIGpRdWVyeS1vbk11dGF0ZSBwbHVnaW4gaXMgbG9hZGVkXG4gICAgaWYgKCRkb2N1bWVudC5vbkNyZWF0ZSAmJiAodHlwZW9mIGl0ZW1TZWxlY3RvciA9PT0gJ3N0cmluZycpKSB7XG4gICAgICAgIC8vIGhhbmRsZSBkeW5hbWljYWxseS1jcmVhdGVkIGl0ZW1zIChpbmNsdWRlcyBzdGF0aWNhbGx5LWRlZmluZWQgaXRlbXMpXG4gICAgICAgICRkb2N1bWVudC5vbkNyZWF0ZShpdGVtU2VsZWN0b3IsIHByb2Nlc3NJdGVtcywgdHJ1ZSAvKiBtdWx0aSAqLylcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBoYW5kbGUgc3RhdGljYWxseS1kZWZpbmVkIGl0ZW1zXG4gICAgICAgIGNvbnN0ICRpdGVtcyA9IHNlbGVjdCgnaXRlbScsIGl0ZW1TZWxlY3RvcilcbiAgICAgICAgYXdhaXQgcHJvY2Vzc0l0ZW1zKCRpdGVtcylcbiAgICB9XG59XG5cbmpRdWVyeS5oaWdobGlnaHQgPSBoaWdobGlnaHRGb3IoalF1ZXJ5KVxualF1ZXJ5LmhpZ2hsaWdodC5jbGFzc05hbWUgPSBDTEFTU1xualF1ZXJ5LmhpZ2hsaWdodC5zZWxlY3RvciA9ICcuJyArIENMQVNTXG4iXSwibmFtZXMiOlsiZ2xvYmFsIiwiQ0xBU1MiLCJDT01NQU5EX05BTUUiLCJHTV9pbmZvIiwic2NyaXB0IiwibmFtZSIsIkRFQlVHIiwiZW5hYmxlZCIsIkRFRkFVTFRfQ09MT1IiLCJERUZBVUxUX0lEIiwiREVGQVVMVF9UQVJHRVQiLCIkIiwiREVGQVVMVF9UVEwiLCJkYXlzIiwiU0NSSVBUX1ZFUlNJT04iLCJ2ZXJzaW9uIiwiU0NIRU1BX1ZFUlNJT04iLCJEQVRBX1ZFUlNJT04iLCJzcGxpdCIsIlRUTCIsInR0bCIsInNlY29uZCIsInNlY29uZHMiLCJtaW51dGUiLCJtaW51dGVzIiwiaG91ciIsImhvdXJzIiwiZGF5Iiwid2VlayIsIndlZWtzIiwiTk9UX0ZPVU5EIiwiU3ltYm9sIiwiR01TdG9yZSIsImRlbGV0ZSIsImtleSIsImRlbGV0ZWQiLCJoYXMiLCJHTV9kZWxldGVWYWx1ZSIsImdldCIsInZhbHVlIiwiR01fZ2V0VmFsdWUiLCJ1bmRlZmluZWQiLCJrZXlzIiwiR01fbGlzdFZhbHVlcyIsInNldCIsIkdNX3NldFZhbHVlIiwiZGVidWciLCJhcmdzIiwiY29uc29sZSIsIndhcm4iLCJwdXJnZUNhY2hlZCIsImNhY2hlIiwiZGF0ZSIsImNhY2hlZCIsIiRkZWxldGUiLCJleHBpcmVzIiwiZXhwaXJlZCIsIkRhdGUiLCJ0b0xvY2FsZVN0cmluZyIsInNlbGVjdCIsInNlbGVjdG9yIiwib3B0aW9ucyIsImNvbnRleHQiLCJkb2N1bWVudCIsInR5cGUiLCJhcHBseSIsIlR5cGVFcnJvciIsInR0bFRvTWlsbGlzZWNvbmRzIiwiaGlnaGxpZ2h0Rm9yIiwiaGlnaGxpZ2h0IiwiTk9XIiwibm93IiwidXNlQ2FjaGUiLCJNYXAiLCJoaWdobGlnaHREdXBsaWNhdGVMaW5rcyIsImRlZHVwIiwiY29sb3IiLCJ0YXJnZXRTZWxlY3RvciIsInRhcmdldCIsImlkU2VsZWN0b3IiLCJpZCIsIml0ZW1TZWxlY3RvciIsIml0ZW0iLCJvbkhpZ2hsaWdodCIsImdldElkIiwiYXR0ciIsInByb2Nlc3NJdGVtcyIsIiRpdGVtcyIsIiR0YXJnZXQiLCJlbmNyeXB0IiwiY3NzIiwiYWRkQ2xhc3MiLCJjYWxsIiwiR01fcmVnaXN0ZXJNZW51Q29tbWFuZCIsIiRkb2N1bWVudCIsIm9uQ3JlYXRlIiwialF1ZXJ5IiwiY2xhc3NOYW1lIl0sIm1hcHBpbmdzIjoiOzs7OztDQUlBO0NBQ0EsTUFBTSxXQUFXLEdBQUcsQ0FBQyxNQUFNO0NBQzNCLENBQUMsSUFBSSxPQUFPLFVBQVUsS0FBSyxXQUFXLEVBQUU7Q0FDeEMsRUFBRSxPQUFPLFVBQVUsQ0FBQztDQUNwQixFQUFFO0FBQ0Y7Q0FD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
