# jquery-highlighter

A jQuery plugin to highlight new items on news sites

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [INSTALL](#install)
- [SYNOPSIS](#synopsis)
- [DESCRIPTION](#description)
  - [Permissions](#permissions)
- [STATIC PROPERTIES](#static-properties)
  - [highlight](#highlight)
    - [Options](#options)
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
- [AUTHOR](#author)
- [COPYRIGHT AND LICENSE](#copyright-and-license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# INSTALL

Save the minified file in the `dist` directory or use a CDN e.g.:

* [RawGit](https://cdn.rawgit.com/chocolateboy/jquery-highlighter/v2.1.0/dist/highlighter.min.js)
* [Git CDN](https://gitcdn.xyz/repo/chocolateboy/jquery-highlighter/v2.1.0/dist/highlighter.min.js)

# SYNOPSIS

```javascript
// ==UserScript==
// @name          Example.com Highlighter
// @description   Highlight new stories on Example.com
// @include       https://www.example.com/stories
// @require       https://code.jquery.com/jquery-3.3.1.min.js
// @require       https://cdn.rawgit.com/chocolateboy/jquery-highlighter/v2.1.0/dist/highlighter.min.js
// @grant         GM_deleteValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @grant         GM_setValue
// ==/UserScript==

$.highlight({
    item:   'div.story',
    target: 'a.title',
    id:     'data-story-id'
})
```

# DESCRIPTION

jQuery Highlighter is a [jQuery](https://jquery.com/) plugin which can be used to highlight new items (e.g. articles, stories, comments)
on news sites, blogs, forums and other sites where old content is replaced by new content.

For some examples of this plugin in action, see [here](https://github.com/chocolateboy/userscripts#highlighters):

<a href="https://github.com/chocolateboy/userscripts#highlighters"><img src="https://i.imgur.com/y0goAMH.png" alt="Hacker News Highlighter"/></a>

The plugin's functionality is exposed as a method on the jQuery factory object, which hides the implementation details behind
a declarative API with defaults that cover most use cases. In most cases, only two or three parameters are needed to create a
new highlighter, only one of which is mandatory:

* [`item`](#item): a selector for each article/story &c. (required)
* [`target`](#target): selects the element(s) within the item element(s) that should be highlighted (defaults to the item itself if not specified)
* [`id`](#id): a way to uniquely identify each item (defaults to the item's `id` attribute if not specified)

With these settings, and a few optional extras, the following behavior is enabled:

* the first time a news page/site is visited, all of its items are highlighted in yellow (by default)
* on subsequent visits, only new content (i.e. content that has been added since the last visit) is highlighted
* eventually, after a period of time (14 days by default), the cache entries for seen items are purged to save space

## Permissions

In order for highlighting to work in userscripts, the following permissions must be granted:

* `GM_deleteValue` - used to clear cached IDs after they've expired
* `GM_getValue` - used to retrieve the cache entry (if any) for an item
* `GM_registerMenuCommand` - used to add a userscript menu command to clear the cache
* `GM_setValue` - used to add a new entry to the cache of seen item IDs

# STATIC PROPERTIES

## highlight

**Signature**: `(options: Object) ⇒ void`

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

#### color

**Type**: `string`, default: `"#FFFD66"`

```javascript
$.highlight({
    item: 'div.story',
    color: '#FFFFAB',
})
```

The background color to use as a HTML color string. The background of the target element(s) of new items is set to this color.

#### debug

**Type**: `boolean`, default: `false`

```javascript
$.highlight({
    item: 'div.story',
    debug: true,
})
```

If true, the cache is neither read from nor written to. This allows highlighters to be modified and reloaded without having to manually
clear the cache every time.

#### dedup

**Type**: `boolean`, default: `true`

```javascript
$.highlight({
    item: 'div.story',
    debug: true,
    dedup: false,
})
```

If false, items are highlighted even if their IDs have already been seen. If true (the default), items are deduplicated
i.e. items with IDs that have already been highlighted are skipped (not highlighted) if they appear again on the same page.
Turning off the cache (with [`debug`](#debug)) and deduplication can be useful when developing highlighters and troubleshooting selectors.

#### id

**Type**: `string | (this: HTMLElement, target: JQuery) ⇒ string`

```javascript
$.highlight({
    item: 'div.story',
    id:   'data-story-id',
})
```

A unique identifier for the item. If it's a string, the ID is the value of the attribute of that name in the item. If it's a function,
it's passed the DOM element of each item as its `this` parameter and the selected target element(s) as a parameter and returns
a unique ID for the item.

If not supplied, it defaults to a function which returns the value of the item's `id` attribute. If the ID is not defined, a TypeError is raised.

#### item

**Type**: `string | () ⇒ JQuery`, required

```javascript
$.highlight({
    item: 'div.story'
})
```

A selector for items. An item is a piece of updatable content e.g. a news story, article, or comment. The selector can either be a
jQuery selector string, or a function which returns the items as a jQuery collection.

If the item selector is a string and the [jQuery-onMutate](https://github.com/eclecto/jQuery-onMutate) plugin is loaded, it is used to detect items that are loaded dynamically
i.e. to highlight items loaded or displayed after the initial page load.

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

A callback called after the target has been highlighted. Passed the item element as its `this` parameter,
the target element(s) as a jQuery collection, and a second argument containing the item ID and background color.
Can be used e.g. to customize or override a target's foreground or background color.

#### target

**Type**: `string | (this: JQuery, item: JQuery) ⇒ JQuery`

```javascript
$.highlight({
    item:   'div.story',
    target: 'a#title',
})
```

The target element(s) to highlight. Can be a jQuery selector string, which is evaluated relative to the item, or a function, which is passed the
item as its `this` parameter and first parameter, and which returns a jQuery collection containing the target element(s).

If not supplied, it defaults to a function which returns the item.

Highlighted target elements have a class attached to them which allows them to be styled separately.
The class name is available via [`$.highlight.className`](#classname).
It can also be accessed as a selector string (i.e. with a leading `.`) via [`$.highlight.selector`](#selector).

#### ttl

**Type**: `Object`, default: `{ days: 14 }`

```javascript
$.highlight({
    item: 'div.story',
    ttl: { days: 28 },
})
```

The "time to live" for cache entries i.e. how long each item ID should be remembered for. If an entry expires, it is removed from the cache,
and an item with the same ID will be considered new and highlighted again.

The `ttl` object is a sort of mini-DSL in data form for specifying the duration: the value is the sum of each unit * value product where
each unit denotes the corresponding number of seconds:

| unit           | seconds          |
|----------------|-----------------:|
| second/seconds |                1 |
| minute/minutes |               60 |
| hour/hours     |          60 * 60 |
| day/days       |     24 * 60 * 60 |
| week/weeks     | 7 * 24 * 60 * 60 |

These pairs can be combined e.g.:

```javascript
{
    days: 28,
    hours: 6,
    minutes: 42,
    seconds: 12,
}
```

The singular and plural versions of each unit are equivalent e.g. `{ minute: 10 }` and `{ minutes: 10 }` both represent 600 seconds.

If not supplied, it defaults to 14 days.

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

A CSS selector string which matches highlighted elements i.e. the highlighted [class name](#classname) with a dot (`.`) prepended.
See [`target`](#target) for more details.

# COMPATIBILITY

* This plugin should work in any browser with ES5 support.
* It has been tested with jQuery 3.x, and may not work with earlier versions.
* It has been tested on Greasemonkey 3, but should work in all current userscript engines.

# SEE ALSO

* [Highlighter Userscripts](https://github.com/chocolateboy/userscripts#highlighters)

# AUTHOR

[chocolateboy](mailto:chocolate@cpan.org)

# COPYRIGHT AND LICENSE

Copyright © 2013-2018 by chocolateboy

jquery-highlighter is free software; you can redistribute it and/or modify it under the terms
of the [Artistic License 2.0](http://www.opensource.org/licenses/artistic-license-2.0.php).
