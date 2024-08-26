export class Wock {
    /**
     * @param {WebSocket} websocket
     * @param {Wockman} wockman
     * @param {import('http').IncomingMessage} request
     * @param {import('stream').Duplex} socket
     * @param {Buffer} head
     */
    constructor(websocket: WebSocket, wockman: Wockman, request: import("http").IncomingMessage, socket: import("stream").Duplex, head: Buffer);
    /** @type {WebSocket} */
    websocket: WebSocket;
    /** @type {Wockman} */
    wockman: Wockman;
    /** @type {number|NodeJS.Timeout} */
    idPingout: number | NodeJS.Timeout;
    /** @type {number|NodeJS.Timeout} */
    idWaitout: number | NodeJS.Timeout;
    /** @type {number} */
    countWaitout: number;
    /**
     * send a event include type and data
     * @param {string} type
     * @param {...any} data
     */
    cast(type: string, ...data: any[]): void;
    /**
     * reset heartbeat timeout
     * @param {boolean} [isResetWaitout=true]
     */
    resetHeartbeat(isResetWaitout?: boolean | undefined): void;
    /**
     * send heartbeat event regularly
     * @param {boolean} [isResetWaitout=true]
     */
    checkHeartbeat(isResetWaitout?: boolean | undefined): void;
}
export default class Wockman {
    /** @type {WebSocket} */
    static WebSocket: WebSocket;
    /**
     * @param {import('http').Server} serverHTTP
     * @param {string} route the prefix of route
     * @param {WockmanOption} [option={}]
     */
    constructor(serverHTTP: import("http").Server, route: string, option?: import("./bases.d.ts").WockmanOption | undefined);
    /** @type {import('http').Server} */
    serverHTTP: import("http").Server;
    /** @type {import('ws').WebSocketServer} */
    serverWebSocket: import("ws").WebSocketServer;
    /** @type {string} */
    route: string;
    /** @type {string} */
    name: string;
    /** @type {boolean} */
    heartbeating: boolean;
    /** @type {number} */
    intervalPing: number;
    /** @type {number} */
    intervalWait: number;
    /** @type {LoggerLike} */
    logTrace: LoggerLike;
    /** @type {LoggerLike} */
    logDebug: LoggerLike;
    /** @type {LoggerLike} */
    logInfo: LoggerLike;
    /** @type {LoggerLike} */
    logError: LoggerLike;
    /** @type {LoggerLike} */
    logWarn: LoggerLike;
    /** @type {LoggerLike} */
    logFatal: LoggerLike;
    /** @type {LoggerLike} */
    logMark: LoggerLike;
    /** @type {Object<string, WockEventHandle[]>} */
    mapHandles: {
        [x: string]: WockEventHandle[];
    };
    /** @type {Object<string, WockEventHandle[]>} */
    mapHandlesOnce: {
        [x: string]: WockEventHandle[];
    };
    /** @type {Set<Wock>} */
    wocks: Set<Wock>;
    /**
     * send event to all connected websocket
     * @param {string} type
     * @param {...any} data
     */
    castAll(type: string, ...data: any[]): void;
    /**
     * @param {WockEvent} event
     * @param {Wock} wock
     * @param {boolean} [isOnce=false]
     * @returns {Promise<void>}
     */
    emit(event: WockEvent | undefined, wock: Wock, isOnce?: boolean | undefined): Promise<void>;
    /**
     * @param {WockEvent} event
     * @param {Wock} wock
     * @returns {Promise<void>}
     */
    emitAll(event: WockEvent, wock: Wock): Promise<void>;
    /**
     * add a handle of event
     * @param {string} type
     * @param {WockEventHandle} handle
     * @param {boolean} [isOnce=false]
     * @returns {void}
     */
    add(type: string, handle: WockEventHandle, isOnce?: boolean | undefined): void;
    /**
     * delete a handle of event
     * @param {string} type
     * @param {WockEventHandle} handle
     * @param {boolean} [isOnce=false]
     * @returns {void}
     */
    del(type: string, handle: WockEventHandle, isOnce?: boolean | undefined): void;
    /**
     * get the handles of event
     * @param {string} type
     * @param {boolean} [isOnce=false]
     * @returns {WockEventHandle[]}
     */
    get(type: string, isOnce?: boolean | undefined): WockEventHandle[];
    /**
     * run the handles of event
     * @param {string} type
     * @param {Wock} [wock]
     * @param {boolean} [isOnce=false]
     * @param {...any} data
     */
    run(type: string, wock?: Wock | undefined, isOnce?: boolean | undefined, ...data: any[]): void;
    /**
     * add a handle of event, and run it
     * @param {string} type
     * @param {WockEventHandle} handle
     * @param {Wock} [wock]
     * @param {...any} data
     */
    aun(type: string, handle: WockEventHandle, wock?: Wock | undefined, ...data: any[]): void;
}
export type WockOpenEventHandle = import("./bases.d.ts").WockOpenEventHandle;
export type WockErrorEventHandle = import("./bases.d.ts").WockErrorEventHandle;
export type WockCloseEventHandle = import("./bases.d.ts").WockCloseEventHandle;
export type WockEvent = import("./bases.d.ts").WockEvent;
export type WockEventHandle = import("./bases.d.ts").WockEventHandle;
export type WockmanOption = import("./bases.d.ts").WockmanOption;
export type LoggerLike = any;
export type LoggerOption = any;
import { WebSocket } from 'ws';
