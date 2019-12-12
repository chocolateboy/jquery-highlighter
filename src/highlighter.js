// required: jQuery, GM_deleteValue, GM_getValue, GM_registerMenuCommand, GM_setValue

jQuery.highlight = (function ($) {
    var CLASS          = 'github-com-chocolateboy-jquery-highlighter-highlighted';
    var DEFAULT_ID     = 'id';
    var DEFAULT_TARGET = function () { return $(this) }; // i.e. $item
    var DEFAULT_TTL    = { days: 7 };
    var DEFAULT_COLOR  = '#FFFD66';
    var KEY            = 'seen';

    // time-to-live: how long (in seconds) to cache IDs for
    var TTL = (function (ttl) {
        ttl.second = ttl.seconds = 1;
        ttl.minute = ttl.minutes = 60 * ttl.seconds;
        ttl.hour   = ttl.hours   = 60 * ttl.minutes;
        ttl.day    = ttl.days    = 24 * ttl.hours;
        ttl.week   = ttl.weeks   = 7  * ttl.days;
        return ttl;
    })({});

    // register this early so data can be cleared even if there's an error
    var commandName = GM_info.script.name + ': clear data';

    GM_registerMenuCommand(commandName, function () { GM_deleteValue(KEY) });

    function ttlToMilliseconds (ttl) {
        var seconds = 0, key;

        for (key in ttl) {
            seconds += ttl[key] * (TTL[key] || 0);
        }

        return seconds * 1000;
    }

    function select (name, selector, _context, args) {
        var context = _context || document;
        var type = typeof selector;

        if (type === 'function') {
            return selector.apply(context, args || []);
        } else if (type === 'string') {
            return $(selector, context);
        } else {
            throw new TypeError('invalid ' + name + ' selector: expected string or function, got: ' + type);
        }
    }

    function highlight (options) {
        // if truthy, the cache is neither read from nor written to.
        // this allows highlighters to be modified and reloaded
        // without having to manually clear the cache every time
        // FIXME rename this `debug = true` -> `cache = false`
        var debug = options.debug;

        // if set to a falsey value, don't deduplicate article IDs i.e.
        // highlight duplicate links
        var highlightDuplicateLinks = ('dedup' in options) ? !options.dedup : false;

        // article ID -> cache expiry timestamp (epoch milliseconds)
        var seen = debug ? {} : JSON.parse(GM_getValue(KEY, '{}'));

        // time-to-live: how long (in milliseconds) to cache IDs for
        var ttl = ttlToMilliseconds(options.ttl || DEFAULT_TTL);

        // the background color of the target element(s)
        var color = options.color || DEFAULT_COLOR;

        // selector (string or function) for the element to highlight
        var targetSelector = options.target || DEFAULT_TARGET;

        // attribute name (string) or function to select a unique
        // identifier for the item
        var idSelector = options.id || DEFAULT_ID;

        // selector (string or function) for the article/story &c.
        var itemSelector = options.item;

        // optional callback function called after the target has been highlighted
        var onHighlight = options.onHighlight || function () {};

        // helper function which extracts an item's unique ID
        var getId = (typeof idSelector === 'function') ?
            function (item, args) { return select('id', idSelector, item, args) } :
            function (item) { return $(item).attr(idSelector) };

        // the current date/time in epoch milliseconds
        var now = new Date().getTime();

        // highlight the selected articles/stories
        function processItems ($items) {
            $items.each(function () {
                var $target = select('target', targetSelector, this);
                var id = getId(this, [$target]);

                if (!seen[id] || highlightDuplicateLinks) {
                    $target.css('background-color', color);
                    $target.addClass(CLASS);
                    onHighlight.call(this, $target, { id: id, color: color });
                }

                if (!seen[id]) {
                    seen[id] = now + ttl;
                }
            });

            if (!debug) {
                GM_setValue(KEY, JSON.stringify(seen));
            }
        }

        // purge expired IDs
        for (var id in seen) {
            if (now > seen[id]) {
                delete seen[id];
            }
        }

        var $document = $(document);

        // if the jQuery-onMutate plugin is loaded
        if ($document.onCreate && (typeof itemSelector === 'string')) {
            // handle dynamically-created items (includes statically-defined items)
            $document.onCreate(itemSelector, processItems, true /* multi */);
        } else {
            // handle statically-defined items
            processItems(select('item', itemSelector));
        }
    }

    highlight.className = highlight['class'] = CLASS;
    highlight.selector = '.' + CLASS;

    return highlight;
}(jQuery));
