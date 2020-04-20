// required:
//
//   - jQuery
//   - GM_deleteValue
//   - GM_getValue
//   - GM_listValues
//   - GM_registerMenuCommand
//   - GM_setValue

import { sha256 as encrypt } from 'crypto-hash'

const CLASS          = 'jquery-highlighter-highlighted'
const COMMAND_NAME   = GM_info.script.name + ': clear data'
const DEBUG          = { enabled: false }
const DEFAULT_COLOR  = '#FFFD66'
const DEFAULT_ID     = 'id'
const DEFAULT_TARGET = function () { return $(this) } // i.e. $item
const DEFAULT_TTL    = { days: 7 }
const SCRIPT_VERSION = GM_info.script.version

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
const SCHEMA_VERSION = 1
const DATA_VERSION = SCHEMA_VERSION + '/' + SCRIPT_VERSION.split('.')[0] // e.g. 1/3

// time-to-live: how long (in seconds) to cache IDs for
const TTL = (ttl => {
    ttl.second = ttl.seconds = 1
    ttl.minute = ttl.minutes = 60 * ttl.seconds
    ttl.hour   = ttl.hours   = 60 * ttl.minutes
    ttl.day    = ttl.days    = 24 * ttl.hours
    ttl.week   = ttl.weeks   = 7  * ttl.days
    return ttl
})({})

/**************************** helper functions ****************************/

// fetch the supplied ID from the cache. automatically handles encryption.
// returns true if the ID is found, false otherwise
async function cacheHas (id) {
    const key = await encrypt(id)
    return !!GM_getValue(key)
}

// add an { expires, version } value to the cache under the supplied ID
// (encrypted)
async function cacheSet (id, expires) {
    const date = new Date(expires).toLocaleString()
    const key = await encrypt(id)
    const value = { expires, version: DATA_VERSION }
    const json = JSON.stringify(value)

    debug(`caching ${id} (${key}) until ${date}`)
    GM_setValue(key, json)
}

// log a debug message to the console if debugging is enabled (via
// options.debug)
function debug (...args) {
    if (DEBUG.enabled) {
        console.warn(...args)
    }
}

// purge expired cache entries (encrypted IDs)
// borrowed from IMDb Tomatoes (see above)
function purgeCached (date) {
    for (const key of GM_listValues()) {
        const value = GM_getValue(key)
        const cached = JSON.parse(value)

        let $delete = true

        if (date === -1) {
            debug(`purging value (forced): ${key}`)
        } else if ((typeof cached.expires !== 'number') || (typeof cached.version !== 'string')) {
            debug(`purging invalid value: ${key}:`, cached)
        } else if (date > cached.expires) {
            const expired = new Date(cached.expires).toLocaleString()
            debug(`purging expired value: ${key} (${expired})`)
        } else if (cached.version !== DATA_VERSION) {
            debug(`purging obsolete value: ${key} (${cached.version})`)
        } else {
            $delete = false
        }

        if ($delete) {
            GM_deleteValue(key)
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
function select (name, selector, options = {}) {
    const context = options.context || document
    const type = typeof selector

    if (type === 'function') {
        return selector.apply(context, options.args || [])
    } else if (type === 'string') {
        return $(selector, context)
    } else {
        throw new TypeError(`invalid ${name} selector: expected string or function, got: ${type}`)
    }
}

// take a TTL spec (object) and convert it into a duration in milliseconds
function ttlToMilliseconds (ttl) {
    let seconds = 0

    for (const key in ttl) {
        seconds += ttl[key] * (TTL[key] || 0)
    }

    return seconds * 1000
}

/************************************ main ************************************/

const highlightFor = $ => async function highlight (options) {
    const NOW = Date.now()

    // if falsey, the cache is neither read from nor written to.
    // this allows highlighters to be modified and reloaded
    // without having to manually clear the cache every time
    const useCache = 'cache' in options ? !!options.cache : true

    // if set to a falsey value, don't deduplicate article IDs i.e. *do*
    // highlight duplicate links
    const highlightDuplicateLinks = 'dedup' in options ? !options.dedup : false

    // function which returns true if an article ID is cached, false
    // otherwise; handles ID encryption
    const seen = useCache ? cacheHas : () => false

    // time-to-live: how long (in milliseconds) to cache IDs for
    const ttl = ttlToMilliseconds(options.ttl || DEFAULT_TTL)

    // the background color of the target element(s)
    const color = options.color || DEFAULT_COLOR

    // selector (string or function) for the element to highlight
    const targetSelector = options.target || DEFAULT_TARGET

    // attribute name (string) or function to select a unique
    // identifier for each item
    const idSelector = options.id || DEFAULT_ID

    // selector (string or function) for the article/story
    const itemSelector = options.item

    // optional callback function called after the target has been highlighted
    const onHighlight = options.onHighlight || function () {}

    // enable/disable the debug function to log (some) diagnostic messages
    // to the console
    DEBUG.enabled = 'debug' in options ? !!options.debug : false

    // helper function which extracts an item's unique ID
    let getId

    if (typeof idSelector === 'function') {
        getId = (item, args) => select('id', idSelector, { context: item, args })
    } else if (typeof idSelector === 'string') {
        getId = item => $(item).attr(idSelector)
    } else {
        throw new TypeError(`invalid ID selector: expected string or function, got: ${idSelector}`)
    }

    if (typeof itemSelector !== 'string' && typeof itemSelector !== 'function') {
        throw new TypeError(`invalid item selector: expected string or function, got: ${itemSelector}`)
    }

    // highlight the selected articles/stories
    async function processItems ($items) {
        for (const item of $items) {
            const $target = select('target', targetSelector, { context: item })

            const id = getId(item, [$target])
            const cached = await seen(id)

            if (!cached || highlightDuplicateLinks) {
                $target.css('background-color', color)
                $target.addClass(CLASS)
                onHighlight.call(item, $target, { id: id, color: color })
            }

            if (!cached) {
                cacheSet(id, NOW + ttl)
            }
        }
    }

    // register this early so data can be cleared even if there's an error
    GM_registerMenuCommand(COMMAND_NAME, () => { purgeCached(-1) })

    // remove expired cache entries
    purgeCached(NOW)

    const $document = $(document)

    // if the jQuery-onMutate plugin is loaded
    if ($document.onCreate && (typeof itemSelector === 'string')) {
        // handle dynamically-created items (includes statically-defined items)
        $document.onCreate(itemSelector, processItems, true /* multi */)
    } else {
        // handle statically-defined items
        const $items = select('item', itemSelector)
        await processItems($items)
    }
}

jQuery.highlight = highlightFor(jQuery)
jQuery.highlight.className = CLASS
jQuery.highlight.selector = '.' + CLASS
