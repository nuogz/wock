import { dirname, resolve, posix } from 'path';
import { fileURLToPath } from 'url';

import { WebSocketServer, WebSocket } from 'ws';

import { loadI18NResource, TT } from '@nuogz/i18n';
import { injectBaseLogger } from '@nuogz/utility';



/** @typedef {import('./bases.d.ts').WockOpenEventHandle} WockOpenEventHandle */
/** @typedef {import('./bases.d.ts').WockErrorEventHandle} WockErrorEventHandle */
/** @typedef {import('./bases.d.ts').WockCloseEventHandle} WockCloseEventHandle */
/** @typedef {import('./bases.d.ts').WockEvent} WockEvent */
/** @typedef {import('./bases.d.ts').WockEventHandle} WockEventHandle */
/** @typedef {import('./bases.d.ts').WockmanOption} WockmanOption */

/** @typedef {import('@nuogz/utility/src/inject-base-logger.pure.js').LoggerLike} LoggerLike */
/** @typedef {import('@nuogz/utility/src/inject-base-logger.pure.js').LoggerOption} LoggerOption */



loadI18NResource('@nuogz/wock-server', resolve(dirname(fileURLToPath(import.meta.url)), 'locale'));

const { T } = TT('@nuogz/wock-server');



const hasOption = (key, object) => key in object && object[key] !== undefined;


export class Wock {
	/** @type {WebSocket} */
	websocket;

	/** @type {Wockman} */
	wockman;


	/** @type {number|NodeJS.Timeout} */
	idPingout;
	/** @type {number|NodeJS.Timeout} */
	idWaitout;
	/** @type {number} */
	countWaitout = 0;



	/**
	 * @param {WebSocket} websocket
	 * @param {Wockman} wockman
	 * @param {import('http').IncomingMessage} request
	 * @param {import('stream').Duplex} socket
	 * @param {Buffer} head
	 */
	constructor(websocket, wockman, request, socket, head) {
		this.websocket = websocket;

		this.wockman = wockman;


		websocket.on('error', error => this.wockman.emitAll({ type: '$error', data: [error] }, this));
		websocket.on('close', (code, reason) => this.wockman.emitAll({ type: '$close', data: [reason, code] }, this));


		websocket.on('message', async raw => {
			if(wockman.heartbeating) { this.checkHeartbeat(); }


			let event = {};
			try {
				event = JSON.parse(raw.toString());
			}
			catch { return; }


			this.wockman.emitAll(event, this);
		});


		if(wockman.heartbeating) {
			this.resetHeartbeat();

			this.checkHeartbeat();
		}


		this.wockman.emitAll({ type: '$open' }, this);
	}


	/**
	 * send a event include type and data
	 * @param {string} type
	 * @param {...any} data
	 */
	cast(type, ...data) {
		if(!type) { throw TypeError(T('invalid-argument-type', { value: type }, 'Wockman().add')); }


		try {
			this.websocket.send(JSON.stringify({ type, data }));
		}
		catch(error) {
			if(typeof error?.message == 'string' && ~error.message.indexOf('CLOSED')) { return; }


			this.logError(T('cast-error'), error.message ?? error, error.stack ?? undefined);
		}
	}



	/**
	 * reset heartbeat timeout
	 * @param {boolean} [isResetWaitout=true]
	 */
	resetHeartbeat(isResetWaitout = true) {
		clearTimeout(this.idPingout);
		clearTimeout(this.idWaitout);

		this.idPingout = null;
		this.idWaitout = null;

		if(isResetWaitout) { this.countWaitout = 0; }
	}

	/**
	 * send heartbeat event regularly
	 * @param {boolean} [isResetWaitout=true]
	 */
	checkHeartbeat(isResetWaitout = true) {
		this.resetHeartbeat(isResetWaitout);


		this.idPingout = setTimeout(() => {
			this.cast('ping');


			this.idWaitout = setTimeout(() => {
				this.countWaitout++;

				if(this.countWaitout >= 4) {
					this.websocket.close(4001, T('heartbeat-timeout'));
				}
				else {
					this.checkHeartbeat(false);
				}
			}, this.wockman.intervalWait);
		}, this.wockman.intervalPing);
	}
}



export default class Wockman {
	/** @type {WebSocket} */
	static WebSocket = WebSocket;



	/** @type {import('http').Server} */
	serverHTTP;
	/** @type {import('ws').WebSocketServer} */
	serverWebSocket;

	/** @type {string} */
	route;


	/** @type {string} */
	name = T('Wock');


	/** @type {boolean} */
	heartbeating = false;

	/** @type {number} */
	intervalPing = 10000;
	/** @type {number} */
	intervalWait = 24000;



	/** @type {LoggerLike} */
	logTrace;
	/** @type {LoggerLike} */
	logDebug;
	/** @type {LoggerLike} */
	logInfo;
	/** @type {LoggerLike} */
	logError;
	/** @type {LoggerLike} */
	logWarn;
	/** @type {LoggerLike} */
	logFatal;
	/** @type {LoggerLike} */
	logMark;



	/** @type {Object<string, WockEventHandle[]>} */
	mapHandles = {
		/** @type {WockOpenEventHandle[]} */
		$open: [
			(wock, wockman) => wockman.logTrace(T('open-occur', { address: wock?.websocket?._socket?.address?.()?.address }))
		],
		/** @type {WockErrorEventHandle[]} */
		$error: [
			(wock, wockman, error) => wockman.logError(
				T('error-occur', {
					reason: error?.message
						?? error
						?? T('unknown-reason'),
				}),
				error?.stack ?? undefined,
			)
		],
		/** @type {WockCloseEventHandle[]} */
		$close: [
			(wock, wockman, reason, code) => {
				wock.resetHeartbeat();


				wockman.logTrace(T('close-occur', {
					reason: reason?.toString() || T('unknown-reason'),
					code: code ?? T('unknown-code'),
				}));
			},
			(wock, wockman, reason, code) => wockman.wocks.delete(wock)
		],
		ping: [
			wock => wock.cast('pong'),
		],
	};
	/** @type {Object<string, WockEventHandle[]>} */
	mapHandlesOnce = {};


	/** @type {Set<Wock>} */
	wocks = new Set();



	/**
	 * @param {import('http').Server} serverHTTP
	 * @param {string} route the prefix of route
	 * @param {WockmanOption} [option={}]
	 */
	constructor(serverHTTP, route, option = {}) {
		this.serverHTTP = serverHTTP;
		this.route = posix.join('/', route ?? '/');


		this.name = hasOption('name', option) ? option.name : this.name;
		this.heartbeating = hasOption('willHeartbeat', option) ? !!option.willHeartbeat : this.heartbeating;
		this.intervalPing = hasOption('intervalPing', option) ? Number(option.intervalPing) : this.intervalPing;
		this.intervalWait = hasOption('intervalWait', option) ? Number(option.intervalWait) : this.intervalWait;



		injectBaseLogger(this, Object.assign({ name: this.name }, option.logger));



		const serverWebSocket = this.serverWebSocket = new WebSocketServer({
			noServer: true,
			perMessageDeflate: {
				zlibDeflateOptions: {
					chunkSize: 1024,
					memLevel: 7,
					level: 4,
				},
				zlibInflateOptions: {
					chunkSize: 10 * 1024,
				},
				clientNoContextTakeover: true,
				serverNoContextTakeover: true,
				serverMaxWindowBits: 10,
				concurrencyLimit: 10,
				threshold: 1024,
			},
		});


		// mount under HTTP
		serverHTTP.on('upgrade', async (request, socket, head) => {
			if(request.url.includes(this.route)) {
				serverWebSocket.handleUpgrade(request, socket, head, websocket =>
					this.wocks.add(
						new Wock(websocket, this, request, socket, head)
					)
				);
			}
		});
	}


	/**
	 * send event to all connected websocket
	 * @param {string} type
	 * @param {...any} data
	 */
	castAll(type, ...data) {
		if(!type) { throw TypeError(T('invalid-argument-type', { value: type }, 'Wockman().castAll')); }


		this.wocks.forEach(wock => {
			try {
				wock.cast(type, ...data);
			}
			catch { void 0; }
		});
	}


	/**
	 * @param {WockEvent} event
	 * @param {Wock} wock
	 * @param {boolean} [isOnce=false]
	 * @returns {Promise<void>}
	 */
	async emit(event = {}, wock, isOnce = false) {
		const { type, data = [] } = event;
		if(!type) { return; }


		const mapHandles = isOnce ? this.mapHandlesOnce : this.mapHandles;
		const handles = [...(mapHandles[type] ?? [])];

		if(isOnce) {
			while(handles.length) {
				const handle = handles.shift();

				try {
					await handle(wock, this, ...data);
				}
				catch(error) {
					this.logError(T('event-once-error', { type }), error.message, error.stack ?? undefined);
				}
			}
		}
		else {
			for(const handle of handles) {
				if(!handle) { continue; }

				try {
					await handle(wock, this, ...data);
				}
				catch(error) {
					this.logError(T('event-error', { type }), error.message, error.stack ?? undefined);
				}
			}
		}
	}
	/**
	 * @param {WockEvent} event
	 * @param {Wock} wock
	 * @returns {Promise<void>}
	 */
	async emitAll(event, wock) {
		await this.emit(event, wock, true);

		await this.emit(event, wock);
	}


	/**
	 * add a handle of event
	 * @param {string} type
	 * @param {WockEventHandle} handle
	 * @param {boolean} [isOnce=false]
	 * @returns {void}
	 */
	add(type, handle, isOnce = false) {
		if(!type) { throw TypeError(T('invalid-argument-type', { value: type }, 'Wockman().add')); }
		if(typeof handle != 'function') { throw TypeError(T('invalid-argument-handle', { value: handle }, 'Wockman().add')); }


		const mapHandles = isOnce ? this.mapHandlesOnce : this.mapHandles;

		(mapHandles[type] ?? (mapHandles[type] = [])).push(handle);
	}
	/**
	 * delete a handle of event
	 * @param {string} type
	 * @param {WockEventHandle} handle
	 * @param {boolean} [isOnce=false]
	 * @returns {void}
	 */
	del(type, handle, isOnce = false) {
		if(!type) { throw TypeError(T('invalid-argument-type', { value: type }, 'Wockman().del')); }
		if(typeof handle != 'function') { throw TypeError(T('invalid-argument-handle', { value: handle }, 'Wockman().del')); }


		const mapHandles = isOnce ? this.mapHandlesOnce : this.mapHandles;

		const handles = mapHandles[type];
		if(!handles) { return; }

		const index = handles.indexOf(handle);
		if(!~index) { return; }

		handles.splice(index, 1);
	}
	/**
	 * get the handles of event
	 * @param {string} type
	 * @param {boolean} [isOnce=false]
	 * @returns {WockEventHandle[]}
	 */
	get(type, isOnce = false) {
		if(!type) { throw TypeError(T('invalid-argument-type', { value: type }, 'Wockman().get')); }


		const mapHandles = isOnce ? this.mapHandlesOnce : this.mapHandles;

		return mapHandles[type];
	}
	/**
	 * run the handles of event
	 * @param {string} type
	 * @param {Wock} [wock]
	 * @param {boolean} [isOnce=false]
	 * @param {...any} data
	 */
	run(type, wock, isOnce = false, ...data) {
		if(!type) { throw TypeError(T('invalid-argument-type', { value: type }, 'Wockman().run')); }


		this.emit({ type, data }, wock, isOnce);
	}
	/**
	 * add a handle of event, and run it
	 * @param {string} type
	 * @param {WockEventHandle} handle
	 * @param {Wock} [wock]
	 * @param {...any} data
	 */
	aun(type, handle, wock, ...data) {
		if(!type) { throw TypeError(T('invalid-argument-type', { value: type }, 'Wockman().aun')); }


		this.add(type, handle);

		this.run(type, wock, false, ...data);
	}
}
