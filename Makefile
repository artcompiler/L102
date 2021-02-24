SUBPROJ := ./mathcore ./latexsympy

default: init build start

init: .npm-install-done

.npm-install-done:
	npm install
	touch .npm-install-done

build:
	npm run build-dev

start:
	npm start

test:
	npm run test $(color)

debug:
	npm run debug

clean:
	rm -f .npm-install-done
	rm -rf node_modules
	rm -rf dist
	rm -rf build
	rm -rf pub

.PHONY: $(SUBPROJ) init clean test build
