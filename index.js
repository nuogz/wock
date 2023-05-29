import { dirname, resolve, posix } from 'path';
import { fileURLToPath } from 'url';

import { WebSocketServer, WebSocket } from 'ws';

import { loadI18NResource, TT } from '@nuogz/i18n';
import { injectBaseLogger } from '@nuogz/utility';



/**
 * @callback WockOpenEventHandle
 * @param {Wock} wock
 * @param {Wockman} wockman
 * @returns {void}
 */

/**
 * @callback WockErrorEventHandle
 * @param {Wock} wock
 * @param {Wockman} wockman
 * @param {Error} error
 * @returns {void}
 */

/**
 * @callback WockCloseEventHandle
 * @param {Wock} wock
 * @param {Wockman} wockman
 * @param {Buffer} reason
 * @param {Number} code
 * @returns {void}
 */


/**
 * @typedef {Object} WockEvent
 * @property {string} type
 * @property {any} [data]
 */

/**
 * @callback WockEventHandle
 * @param {Wock} wock
 * @param {...any} data
 * @returns {void|Promise<void>}
 */

/**
 * Wockman Option
 * @typedef {Object} WockmanOption
 * @property {string} [name]
 * @property {boolean} [isHeartbeat]
 * @property {number} [intervalPing]
 * @property {number} [intervalWait]
 * @property {LoggerOption} [logger]
 * - `undefined` for use `console` functions
 * - `false` for close output
 * - `Function` for output non-leveled logs
 * - `{LogFunctions}` for leveled logs. The function will be called in the format of where, what and result. **ATTENTION** The Error instance will be passed in as one of the result arguments, not stringified error text.
 */


/** @typedef {import('@nuogz/utility/src/inject-base-logger.pure.js').LoggerLike} LoggerLike */
/** @typedef {import('@nuogz/utility/src/inject-base-logger.pure.js').LoggerOption} LoggerOption */



loadI18NResource('@nuogz/wock-server', resolve(dirname(fileURLToPath(import.meta.url)), 'locale'));

const T = TT('@nuogz/wock-server');


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
			if(wockman.isHeartbeat) { this.checkHeartbeat(); }


			let event = {};
			try {
				event = JSON.parse(raw.toString());
			}
			catch(error) { return; }


			this.wockman.emitAll(event, this);
		});


		if(wockman.isHeartbeat) {
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
		if(!type) { throw TypeError(T('ArgumentError.invalidType', { value: type }, 'Wockman().add')); }


		try {
			this.websocket.send(JSON.stringify({ type, data }));
		}
		catch(error) {
			if(typeof error?.message == 'string' && ~error.message.indexOf('CLOSED')) { return; }


			this.logError(T('Error.cast'), error.message ?? error, error.stack ?? undefined);
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
					this.websocket.close(4001, T('heartbeatTimeout'));
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

	/** @type {string} */
	route;


	/** @type {string} */
	name = T('Wock');


	/** @type {boolean} */
	isHeartbeat = false;

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
			(wock, wockman) => wockman.logTrace(T('Occur.open', { address: wock?.websocket?._socket?.address?.()?.address }))
		],
		/** @type {WockErrorEventHandle[]} */
		$error: [
			(wock, wockman, error) => wockman.logError(
				T('Occur.error', {
					reason: error?.message
						?? error
						?? T('unknownReason'),
				}),
				error?.stack ?? undefined,
			)
		],
		/** @type {WockCloseEventHandle[]} */
		$close: [
			(wock, wockman, reason, code) => {
				wock.resetHeartbeat();


				wockman.logTrace(T('Occur.close', {
					reason: reason?.toString() || T('unknownReason'),
					code: code ?? T('unknownCode'),
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
		this.isHeartbeat = hasOption('isHeartbeat', option) ? !!option.isHeartbeat : this.isHeartbeat;
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
		if(!type) { throw TypeError(T('ArgumentError.invalidType', { value: type }, 'Wockman().castAll')); }


		this.wocks.forEach(wock => {
			try {
				wock.cast(type, ...data);
			}
			catch(error) { void 0; }
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
		const handles = mapHandles[type] ?? [];

		if(isOnce) {
			while(handles.length) {
				const handle = handles.shift();

				try {
					await handle(wock, this, ...data);
				}
				catch(error) {
					this.logError(T('Error.eventOnce', { type }), error.message, error.stack ?? undefined);
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
					this.logError(T('Error.event', { type }), error.message, error.stack ?? undefined);
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
		if(!type) { throw TypeError(T('ArgumentError.invalidType', { value: type }, 'Wockman().add')); }
		if(typeof handle != 'function') { throw TypeError(T('ArgumentError.invalidHandle', { value: handle }, 'Wockman().add')); }


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
		if(!type) { throw TypeError(T('ArgumentError.invalidType', { value: type }, 'Wockman().del')); }
		if(typeof handle != 'function') { throw TypeError(T('ArgumentError.invalidHandle', { value: handle }, 'Wockman().del')); }


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
		if(!type) { throw TypeError(T('ArgumentError.invalidType', { value: type }, 'Wockman().get')); }


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
		if(!type) { throw TypeError(T('ArgumentError.invalidType', { value: type }, 'Wockman().run')); }


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
		if(!type) { throw TypeError(T('ArgumentError.invalidType', { value: type }, 'Wockman().aun')); }


		this.add(type, handle);

		this.run(type, wock, false, ...data);
	}
}
