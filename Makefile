.DEFAULT_GOAL := build

.NOTPARALLEL:

.PHONY: all build test compile chrome-build chrome-zip zip clean

all: build

# Chạy toàn bộ quy trình trong 1 lệnh duy nhất: test -> compile -> build (Chrome) -> zip (Chrome)
build: test compile chrome-build chrome-zip

test:
	pnpm test

compile:
	pnpm compile

chrome-build:
	pnpm build

chrome-zip:
	pnpm zip

zip: chrome-zip

clean:
	node -e "fs.rmSync('.output', { recursive: true, force: true })"
