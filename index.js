import { posix } from 'path';

import { WebSocketServer } from 'ws';

import LoggerInjecter from '@nuogz/class-inject-leveled-log';

import { TT } from './lib/i18n.js';

import Wock from './src/index.js';



export { Wock };

export { WebSocket } from 'ws';


export class WockConnection {
	/**
	 * @param {import('ws').WebSocket} websocket
	 * @param {Wockman} wockman
	 * @param {Function[]} maresClose
	 */
	constructor(websocket, wockman, maresClose) {
		this.wock = websocket;
		this.wockman = wockman;

		this.maresClose = maresClose;


		this.logTrace = wockman.logTrace;
		this.logDebug = wockman.logDebug;
		this.logInfo = wockman.logInfo;
		this.logError = wockman.logError;
		this.logWarn = wockman.logWarn;
		this.logFatal = wockman.logFatal;
		this.logMark = wockman.logMark;


		this.onceOff = false;
		websocket.on('error', error => this.handleClose(error));
		websocket.on('close', (code, reason) => this.handleClose(wockman.TT('handleClose', { code: code ?? 0, reason: reason.toString() ?? '' })));

		websocket.on('message', async raw => {
			if(wockman.ping) { this.checkHeartbeat(); }

			let event = {};
			try {
				event = JSON.parse(raw.toString());
			}
			catch(error) { return; }

			const handle = this.wockman.handles[event.type];
			if(handle) {
				if(event.data instanceof Array) {
					handle(this, ...event.data);
				}
				else {
					handle(this, event.data);
				}
			}
		});

		if(wockman.ping) {
			this.clearHeartbeat();
			this.checkHeartbeat();
		}
	}


	/** send event */
	cast(type, ...data) {
		try {
			this.wock.send(JSON.stringify({ type, data }));
		}
		catch(error) {
			if(error.message.indexOf('CLOSED') == -1) {
				this.logError(this.wockman.TT('castEvent', { type }), error);
			}
		}
	}

	/** wock close handle */
	handleClose(reason) {
		if(this.onceOff) { return; }
		this.onceOff = true;

		for(const func of this.maresClose) {
			if(typeof func == 'function') {
				func(reason, this);
			}
		}

		if(reason instanceof Error) {
			this.logError(this.wockman.TT('closeConnection'), reason);
		}
		else {
			this.logTrace(this.wockman.TT('closeConnection'), reason);
		}

		this.clearHeartbeat();
	}

	/** init heartbeat */
	checkHeartbeat(clearCount = true) {
		this.clearHeartbeat(clearCount);

		this.timeoutPing = setTimeout(() => {
			this.cast('ping');

			this.timeoutWait = setTimeout(() => {
				this.timeoutCount++;

				if(this.timeoutCount >= 4) {
					this.wock.close(4001, this.wockman.TT('heartbeatTimeout'));
				}
				else {
					this.checkHeartbeat(false);
				}
			}, 24000);
		}, 10000);
	}

	clearHeartbeat(clearCount = true) {
		clearTimeout(this.timeoutPing);
		clearTimeout(this.timeOutWait);

		this.timeoutPing = null;
		this.timeOutWait = null;

		if(clearCount) { this.timeoutCount = 0; }
	}
}


export default class Wockman {
	/**
	 * Database Option
	 * @typedef {Object} WockmanOption
	 * @property {string} [name]
	 * @property {string} [locale]
	 * @property {boolean} [ping]
	 * @property {Function[]} [maresUpgrade=[]]
	 * @property {Function[]} [maresClose=[]]
	 * @property {import('@nuogz/class-inject-leveled-log').LogOption} [logger]
	 * - `undefined` for use `console` functions
	 * - `false` for close output
	 * - `Function` for output non-leveled logs
	 * - `{LogFunctions}` for leveled logs. The function will be called in the format of where, what and result. **ATTENTION** The Error instance will be passed in as one of the result arguments, not stringified error text.
	 */

	/**
	 * @param {import('net').Server} server
	 * @param {string} route the prefix of route
	 * @param {WockmanOption} option
	 */
	constructor(server, route, option = {}) {
		this.name = option.name;


		this.locale = option.locale;
		this.TT = TT(this.locale);


		LoggerInjecter(this, Object.assign({ name: this.TT('Wockman') }, option.logger));


		this.ping = ~~option.ping;
		this.route = posix.join('/', route ?? '/');


		const { maresUpgrade = [], maresClose = [] } = option;


		const serverWock = this.server = new WebSocketServer({
			noServer: true,
			perMessageDeflate: {
				zlibDeflateOptions: {
					chunkSize: 1024,
					memLevel: 7,
					level: 4,
				},
				zlibInflateOptions: {
					chunkSize: 10 * 1024
				},
				clientNoContextTakeover: true,
				serverNoContextTakeover: true,
				serverMaxWindowBits: 10,
				concurrencyLimit: 10,
				threshold: 1024,
			},
		});


		// mount under HTTP
		server.on('upgrade', async (request, socket, head) => {
			if(request.url.includes(this.route)) {
				for(const mare of maresUpgrade) {
					await mare(request, socket, head, this);
				}

				serverWock.handleUpgrade(request, socket, head, ws => serverWock.emit('connection', ws, request));
			}
		});

		/** @type {Set<WockConnection>} */
		this.wockConnections = new Set();
		const maresCloseAll = maresClose.concat([() => (reason, wock) => this.wockConnections.delete(wock)]);


		serverWock.on('connection', websocket => this.wockConnections.add(
			new WockConnection(websocket, this, maresCloseAll)
		));


		// events
		this.handles = { ping(wock) { wock.cast('pong'); } };
	}


	/** boardcast */
	cast(type, ...data) {
		this.wockConnections.forEach(wockConnection => {
			try {
				wockConnection.cast(type, ...data);
			}
			catch(error) { void 0; }
		});
	}


	/** add wock event */
	add(name, handle) {
		if(!name && !(typeof handle == 'function')) { return false; }

		this.handles[name] = handle;
	}
	/** delete wock event */
	del(name) {
		if(!name) { return false; }

		delete this.handles[name];
	}
	/** get wock event */
	get(name) {
		return this.handles[name];
	}
	/** run a wock event */
	run(name, ...data) {
		this.handles[name](...data);
	}
}
