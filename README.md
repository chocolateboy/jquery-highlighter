# jquery-highlighter

A jQuery plugin to highlight new contents on news sites

- [INSTALL](#install)
- [SYNOPSIS](#synopsis)
- [DESCRIPTION](#description)
- [DEPENDENCIES](#dependencies)
  - [Required](#required)
  - [Optional](#optional)
- [STATIC METHODS](#static-methods)
  - [highlight](#highlight)
    - [item](#item)
    - [target](#target)
    - [id](#id)
- [COMPATIBILITY](#compatibility)
- [SEE ALSO](#see-also)
- [AUTHOR](#author)
- [COPYRIGHT AND LICENSE](#copyright-and-license)

## INSTALL

Save the minified file in the `dist` directory or use a CDN e.g.:

* [RawGit](https://cdn.rawgit.com/chocolateboy/jquery-highlighter/v2.1.0/dist/highlighter.min.js)
* [Git CDN](https://gitcdn.xyz/repo/chocolateboy/jquery-highlighter/v2.1.0/dist/highlighter.min.js)

## SYNOPSIS

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
    item:   'div#story',
    target: 'a.title',
    id:     'data-story-id'
})
```

## DESCRIPTION

jQuery Highlighter is a [jQuery](https://jquery.com/) plugin which can be used to highlight new items (e.g. articles, stories, comments)
on news sites, blogs, forums and other sites with lists of content that are updated, with newer items replacing older items.

For an example of this plugin in use, highlighters for BBC News, Hacker News, Reddit and other sites can be found
[here](https://github.com/chocolateboy/userscripts#highlighters).

The plugin's functionality is exposed as a method on the jQuery factory object, which hides the implementation details behind
a simple declarative API with sensible defaults. In most cases, only two or three options need to be supplied to create a new highlighter,
only one of which is mandatory:

* `item`: a selector for each article/story &c. (required)
* `target`: selects the node within the item element(s) that should be highlighted (defaults to the whole item if not specified)
* `id`: a way to uniquely identify each item (defaults to the item's `id` attribute if not specified)

With these settings, and a few optional extras, the following behavior is enabled:

* the first time a news page/site is visited, all of its items are highlighted in yellow (by default)
* on subsequent visits, only new content (i.e. content that has been added since the last visit) is highlighted
* eventually, after a period of time (14 days by default), the cached records for seen items are purged to save space

In order for highlighting to work in userscripts, the following permissions must be granted:

* `GM_deleteValue` - used to clear cached records after they've expired
* `GM_getValue` - used to retrieve the cached record (if any) for an item
* `GM_registerMenuCommand` - used to add a userscript menu command which allows the cache to be cleared
* `GM_setValue` - used to add a new record to the cache of seen content

## DEPENDENCIES

### Required

* jQuery - jQuery is required and must be loaded before the plugin. See the [compatibility](#compatibility) section below for more details.

### Optional

* [jQuery-onMutate](https://github.com/eclecto/jQuery-onMutate) - if this jQuery plugin is loaded (before [`highlight`](#highlight) is called),
additional functionality is enabled, as described [below](#item).

## STATIC METHODS

### highlight

**Signature**: `(options: Object) ⇒ void`

Set up highlighting for the current page. Takes an object with the following options:

#### item

**Type**: `string | Function`, required

```javascript
$.highlight({
    item: 'div#story'
})
```

A selector for items. An item is a piece of updatable content e.g. a news story, article, or comment. The selector can either be a
jQuery selector string, or a function which returns the items as a jQuery collection.

If the item selector is a string and the jQuery-onMutate plugin is loaded, it is used to detect items that are loaded dynamically
i.e. to highlight items loaded or displayed after the initial page load.

#### target

**Type**: `string | (this: JQuery, item: JQuery) ⇒ JQuery`, default: the selected item

```javascript
$.highlight({
    item:   'div#story',
    target: 'a#title',
})
```

The target element(s) to highlight. Can be a jQuery selector string, which is evaluated relative to the item, or a function, which is passed the
item as its `this` parameter and its sole explicit parameter, and which returns a jQuery collection containing the target element(s).

If not supplied, it defaults to the selected item.

#### id

**Type**: `string | (this: HTMLElement, target: JQuery) ⇒ string`, default: a function which returns the value of the item's `id` attribute

```javascript
$.highlight({
    item: 'div#story',
    id:   'data-story-id'
})
```

A unique identifier for the item. If it's a string, the ID is the value of the attribute of that name in the item. If it's a function,
it's passed the DOM element of each item (as its `this` parameter) and the selected target element(s) as a paremeter and returns
a unique ID for the item.

If not supplied, it defaults to a function which returns the value of the item's `id` attribute. If the ID is not defined, a TypeError is raised.

## COMPATIBILITY

* This plugin should work in any browser with ES5 support.
* It has been tested with jQuery 3.x, and may not work with earlier versions.
* It has been tested on Greasemonkey 3, but should work in all current userscript engines.

## SEE ALSO

* [Highlighter Userscripts](https://github.com/chocolateboy/userscripts#highlighters)

## AUTHOR

[chocolateboy](mailto:chocolate@cpan.org)

## COPYRIGHT AND LICENSE

Copyright © 2013-2018 by chocolateboy

jquery-highlighter is free software; you can redistribute it and/or modify it under the terms
of the [Artistic License 2.0](http://www.opensource.org/licenses/artistic-license-2.0.php).
