# jquery-highlighter

A jQuery plugin which highlights new items since the last time a site was visited

<!-- TOC -->

- [SYNOPSIS](#synopsis)
- [INSTALLATION](#installation)
  - [Dependencies](#dependencies)
    - [Required](#required)
    - [Optional](#optional)
  - [Permissions](#permissions)
- [DESCRIPTION](#description)
- [STATIC PROPERTIES](#static-properties)
  - [highlight](#highlight)
    - [Options](#options)
      - [cache](#cache)
      - [color](#color)
      - [debug](#debug)
      - [dedup](#dedup)
      - [id](#id)
      - [item](#item)
      - [onHighlight](#onhighlight)
      - [target](#target)
      - [ttl](#ttl)
    - [Properties](#properties)
      - [className](#classname)
      - [selector](#selector)
- [COMPATIBILITY](#compatibility)
- [SEE ALSO](#see-also)
- [VERSION](#version)
- [AUTHOR](#author)
- [COPYRIGHT AND LICENSE](#copyright-and-license)

<!-- TOC END -->

# SYNOPSIS

<a href="https://github.com/chocolateboy/userscripts#highlighters"><img src="https://i.imgur.com/y0goAMH.png" alt="Hacker News Highlighter"/></a>

```javascript
// ==UserScript==
// @name          Example.com Highlighter
// @description   Highlight new articles on Example.com
// @include       https://www.example.com/news
// @require       https://code.jquery.com/jquery-3.7.1.min.js
// @require       https://cdn.jsdelivr.net/gh/chocolateboy/jquery-highlighter@v3.0.4/dist/highlighter.min.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_listValues
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

$.highlight({
    item:   'div.story',
    target: 'a.title',
    id:     'data-story-id',
})
```

# INSTALLATION

Grab a file from the [`dist`](dist) directory or use a CDN, e.g.:

- [jsDelivr](https://cdn.jsdelivr.net/gh/chocolateboy/jquery-highlighter@v3.0.4/dist/highlighter.min.js)
- [Git CDN](https://gitcdn.xyz/repo/chocolateboy/jquery-highlighter/v3.0.4/dist/highlighter.min.js)

## Dependencies

jQuery Highlighter has the following prerequisites:

### Required

- [jQuery](https://jquery.com/) (see [compatibility](#compatibility))

### Optional

- [jQuery-onMutate](https://github.com/eclecto/jQuery-onMutate) (for dynamic items - see [`item`](#item))

## Permissions

In order for highlighting to work in userscripts, the following permissions must be granted:

- `GM_deleteValue` - used to clear seen IDs after they've expired
- `GM_getValue` - used to retrieve seen IDs
- `GM_listValues` - used to enumerate seen IDs
- `GM_registerMenuCommand` - used to add a userscript menu command to clear all seen IDs
- `GM_setValue` - used to store seen IDs

# DESCRIPTION

jQuery Highlighter is a [jQuery](https://jquery.com/) plugin which can be used
to highlight new items (e.g. articles, stories, comments) on news sites, blogs,
forums and other sites where old content is replaced by new content.

For some examples of this plugin in action, see
[here](https://github.com/chocolateboy/userscripts#highlighters).

Highlighting is enabled by calling a method on the jQuery factory object. This
method hides the implementation details behind a declarative API with defaults
suitable for typical blog/news/aggregator sites. In most cases, only two or
three parameters are needed to configure highlighting, only one of which is
mandatory:

- [`item`](#item): a selector for each article/story etc. (required)
- [`target`](#target): selects the element(s) within each item that should be highlighted (defaults to the item itself if not specified)
- [`id`](#id): a way to uniquely identify each item (defaults to the value of the item's `id` attribute if not specified)

With these settings, and a few optional extras, the following behavior is enabled:

- the first time a news page/site is visited, all of its items are highlighted in yellow (by default)
- on subsequent visits, only new content (i.e. content that has been added since the last visit) is highlighted
- eventually, after a period of time (7 days by default), the cached entries for seen items are purged to save space

# STATIC PROPERTIES

## highlight

**Signature**: `(options: Object) ⇒ Promise<void>`

```javascript
$.highlight({
    item:   'div.story',
    target: 'a.title',
    id:     'data-story-id',
    ttl:    { days: 28 },
})
```

Highlight new items on the current page. Takes an object with the following options.

### Options

#### cache

**Type**: `boolean`, default: `true`

```javascript
$.highlight({
    item: 'div.story',
    cache: false,
})
```

If false, the cache is neither read from nor written to. This allows
highlighters to be modified and reloaded without having to manually clear the
cache every time.

#### color

**Type**: `string`, default: `"#FFFD66"`

```javascript
$.highlight({
    item: 'div.story',
    color: '#FFFFAB',
})
```

The background color to use as a HTML color string. The background of the
target element(s) of new items is set to this color.

#### debug

**Type**: `boolean`, default: `false`

```javascript
$.highlight({
    item: 'div.article',
    debug: true,
})
```

If true, debug/diagnostic messages for some methods are logged to the console.
Note that this logs **unencrypted** IDs (as well as their encrypted values),
and so should only be used temporarily, for troubleshooting, to avoid exposing
sensitive data.

#### dedup

**Type**: `boolean`, default: `true`

```javascript
$.highlight({
    item: 'div.story',
    cache: false,
    dedup: false,
})
```

If false, items are highlighted even if their IDs have already been seen. If
true (the default), items are deduplicated, i.e. items with IDs that have
already been seen/highlighted are skipped (not highlighted) if they appear
again on the same page. Turning off the cache (with [`cache`](#cache)) and
deduplication can be useful when developing highlighters and troubleshooting
selectors.

#### id

**Type**: `string | (this: HTMLElement, target: JQuery) ⇒ string`

```javascript
$.highlight({
    item: 'div.story',
    id:   'data-story-id',
})
```

A unique identifier for the item. If it's a string, the ID is the value of the
attribute of that name in the item. If it's a function, it's passed the DOM
element of each item as its `this` parameter and the jQuery wrapper for the
selected target element(s) as a parameter and returns a unique ID for the item.

If not supplied, it defaults to a function which returns the value of the
item's `id` attribute. If the ID is not defined, a TypeError is raised.

All IDs are encrypted before being written to the cache to avoid exposing
private information.

#### item

**Type**: `string | () ⇒ JQuery`, required

```javascript
$.highlight({
    item: 'div.story'
})
```

A selector for items. An item is a piece of updatable content, e.g. a news
story, article, or comment. The selector can either be a jQuery selector
string, or a function which returns the items as a jQuery collection.

If the item selector is a string and the
[jQuery-onMutate](https://github.com/eclecto/jQuery-onMutate) plugin is loaded,
it is used to (also) detect items that are loaded dynamically, i.e. to
highlight items loaded or displayed after the initial page load.

#### onHighlight

**Type**: `(this: HTMLElement, target: JQuery, { id: string, color: string }) ⇒ void`

```javascript
// if the text is inverted (white on black), make it dark so that it remains
// legible on a yellow background
function onHighlight ($target) {
    if ($target.css('color') === 'rgb(255, 255, 255)') {
        $target.css('color', 'rgb(34, 34, 34)')
    }
}

$.highlight({ item: 'div.story', onHighlight })
```

A callback called after the target has been highlighted. Passed the item
element as its `this` parameter, the target element(s) as a jQuery collection,
and a second argument containing the item ID and background color. Can be used
e.g. to customize or override a target's foreground or background color.

#### target

**Type**: `string | (this: HTMLElement, item: HTMLElement) ⇒ JQuery`

```javascript
$.highlight({
    item:   'div.story',
    target: 'a.title',
})
```

The target element(s) to highlight. Can be a jQuery selector string, which is
evaluated relative to the item, or a function, which is passed the item element
as its `this` parameter and first parameter, and which returns a jQuery
collection containing the target element(s).

If not supplied, it defaults to a function which returns the item.

Highlighted target elements have a class attached to them which allows them to
be styled separately. The class name is available via
[`$.highlight.className`](#classname). It can also be accessed as a selector
string (i.e. with a leading `.`) via [`$.highlight.selector`](#selector).

#### ttl

**Type**: `Object`, default: `{ days: 7 }`

```javascript
$.highlight({
    item: 'div.story',
    ttl: { days: 28 },
})
```

The "time to live" for cached entries, i.e. how long each item ID should be
remembered for. If an entry expires, it is removed from the cache, and an item
with the same ID will be considered new and highlighted again.

The `ttl` object is a sort of mini-DSL in data form for specifying the
duration: the value is the sum of each `unit * value` product where each unit
denotes the corresponding number of seconds:

| unit           | seconds          |
|----------------|-----------------:|
| second/seconds |                1 |
| minute/minutes |               60 |
| hour/hours     |          60 * 60 |
| day/days       |     24 * 60 * 60 |
| week/weeks     | 7 * 24 * 60 * 60 |

These pairs can be combined, e.g.:

```javascript
{
    days: 28,
    hours: 6,
    minutes: 42,
    seconds: 12,
}
```

The singular and plural versions of each unit are equivalent, e.g. `{ minute: 10
}` and `{ minutes: 10 }` both represent 600 seconds.

If not supplied, it defaults to 7 days.

### Properties

The following properties are defined on the [`highlight`](#highlight) method.

#### className

**Type**: `string`

```javascript
function isHighlighted (el) {
    return el.classList.contains($.highlight.className)
}
```

The name of the CSS class added to highlighted elements. See [`target`](#target) for more details.

#### selector

**Type**: `string`

```javascript
const $highlighted = $($.highlight.selector)
```

A CSS selector string which matches highlighted elements, i.e. the highlighted
[class name](#classname) with a dot (`.`) prepended. See [`target`](#target)
for more details.

# COMPATIBILITY

- This plugin should work in any browser with ES6 support.
- It has been tested with jQuery 3.x, and may not work with earlier versions.
- It has been tested on Greasemonkey 3 and Violentmonkey, but should work in all userscript engines which support the Greasemonkey 3 API.

# SEE ALSO

- [chocolateboy/userscripts](https://github.com/chocolateboy/userscripts#highlighters) - highlighter userscripts which use this plugin
- [theoky/HistoryOfTheSeen](https://github.com/theoky/HistoryOfTheSeen) - a userscript which greys out seen links on several sites

# VERSION

3.0.4

# AUTHOR

[chocolateboy](mailto:chocolate@cpan.org)

# COPYRIGHT AND LICENSE

Copyright © 2013-2024 by chocolateboy.

This is free software; you can redistribute it and/or modify it under the terms
of the [Artistic License 2.0](http://www.opensource.org/licenses/artistic-license-2.0.php).
