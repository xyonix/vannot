default: build

ASSETS_SRC = $(shell find src/assets -type f | sort)
ASSETS_LIB = $(ASSETS_SRC:src/assets/%=lib/assets/%)

node_modules:
	npm install

lib:
	mkdir lib/

lib/app.js: src/app.js lib node_modules
	node node_modules/browserify/bin/cmd.js -e $< -o $@ --im

lib/styles.css: src/styles.sass lib node_modules
	node node_modules/node-sass/bin/node-sass --output-style compressed $< > $@

lib/index.html: src/index.html lib
	cp $< $@

lib/assets: lib
	mkdir lib/assets

lib/assets/%: src/assets/% lib/assets
	cp $< $@

build: lib/app.js lib/styles.css lib/index.html $(ASSETS_LIB)

clean:
	rm -rf lib/

