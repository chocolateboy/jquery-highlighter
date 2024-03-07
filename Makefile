#####################################################
# strict mode: https://tech.davis-hansson.com/p/make/

SHELL := bash
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules

.DELETE_ON_ERROR:
.SHELLFLAGS := -eu -o pipefail -c

#####################################################

BIN     := ./node_modules/.bin
ESBUILD := esbuild --bundle --charset=utf8 --format=iife --legal-comments=inline --log-level=warning

.PHONY: build
build: dist/highlighter.js dist/highlighter.min.js

.PHONY: build-doc
build-doc: README.md
	$(BIN)/toc-md README.md

dist/highlighter.js: src/highlighter.js
	$(ESBUILD) --outfile=$@ $<

dist/highlighter.min.js: src/highlighter.js
	$(ESBUILD) --minify --outfile=$@ $<

.PHONY: clean
clean:
	rm -rf ./dist

.PHONY: rebuild
rebuild: clean build

# http://blog.melski.net/2010/11/30/makefile-hacks-print-the-value-of-any-variable/
print-%:
	@echo '$*=$($*)'
