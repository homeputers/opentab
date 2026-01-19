.PHONY: tools-install tools-build tools-test

tools-install:
	pnpm -C tools i

tools-build:
	pnpm -C tools -r build

tools-test:
	pnpm -C tools -r test
