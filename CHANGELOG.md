# CHANGELOG

## v3.3.1 - 2024.08.26 16
* docs: fix docs


## v3.3.0 - 2024.08.26 16
* refactor: renew codes to adapt to latest `@nuogz/i18n`
* refactor: raname some varbiables
* docs: renew locale with latest `@nuogz/i18n`
* deps: bump up dependencies


## v3.2.3 - 2023.12.07 10
* fix `d.ts` finally


## v3.2.2 - 2023.12.07 10
* fix `d.ts`


## v3.2.1 - 2023.12.07 10
* fix `d.ts`
* tweak enviroment


## v3.2.0 - 2023.12.07 09
* tweak enviroment
* bump up dependencies


## v3.1.3 - 2023.07.11 10
* fix using unfixed arrays in loops when wockman emitting
* bump up dependencies
* update environments


## v3.1.2 - 2023.05.29 16
* bump up dependencies
* fix little typo
* bump up dependencies
	* update `typescript` to `v5.x`, and renew jsdoc
* use eslint flat config, and related config udpate
	* use `eslint.config.js` instead `eslintrc.cjs`


## v3.1.1 - 2023.04.10 19
* fix `d.ts`


## v3.1.0 - 2023.04.07 14
* change `emitAll` into async function
* bump up `@nuogz/i18n` to `v3.1.0` and renew related code
* renew locales


## v3.0.0 - 2023.02.09 03
* reorganize all code
* improve interfaces
* improve locales
* add `d.ts`
* bump up dependencies
* use `@nuogz/utility`.`injectBaseLogger` instead `@nuogz/class-inject-leveled-log`
* fix `.npmrc` to hoist `i18next` to emit `d.ts` correctly
* fix bug on heartbeat timeout


## v2.0.0 - 2022.10.13 09
* split client and server code from `wock@1.x` for better fucking import


## v1.2.0 - 2022.10.11 19
* update `package.json` to better export browser-side codes


## v1.1.0 - 2022.10.07 03
* export node.js side `WebSocket` form `ws`
* support `wock` on node.js side by pass node.js side `WebSocket`
* pump up dependencies


## v1.0.0 - 2022.08.26 15
* independent from many projects
* tweak all files for publishing to npm
* start use `CHANGLOG.md` since version `v1.0.0`
