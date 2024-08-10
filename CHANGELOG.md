## 3.0.4 - 2024-08-10

- pass the missing item parameter to the `target` callback and fix its
  type signature
- build clean-up

## 3.0.3 - 2020-04-21

- clean up/optimize the storage wrapper (GMStore)
  - bump the schema version

## 3.0.2 - 2020-04-20

- remove unused parameter

## 3.0.1 - 2020-04-20

- fix options.cache: ensure the userscript cache isn't written to if
  options.cache is false

## 3.0.0 - 2020-04-20

**Breaking Changes**

- new required permission: `GM_listValues`
- rename options.debug (default: false) -> options.cache (default: true)
- remove `$.highlight.class` alias for `$.highlight.className`
- update code from ES5 -> ES6
- the `$.highlight` method is now async

**Features**

- all cached IDs are now encrypted for privacy
- add options.debug (default: false) to enable logging for some methods
- add changelog

## 2.1.0 - 2016-10-30

- add options.dedup

## 2.0.0 - 2016-10-30

- rename `$.highlight.class` -> `$.highlight.selector`

## 1.0.0 - 2016-10-02

- initial version
