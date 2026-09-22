/**
 * The indexer provider imports `WebSocket` from `isomorphic-ws`, whose browser
 * build exports only a default. Without this the named import resolves to
 * undefined and every subscription fails at runtime — quietly, because the
 * bundler only warns.
 *
 * In a browser the platform already has the right implementation.
 */
const NativeWebSocket = globalThis.WebSocket;

export { NativeWebSocket as WebSocket };
export default NativeWebSocket;
