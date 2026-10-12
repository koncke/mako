// El pegamento de wasm-bindgen de opencut-wasm no trae tipos propios: son los
// mismos de la entrada del paquete, más el setter que conecta la instancia.
// Lo usa app/video-editor/_opencut/wasm/opencut.ts.
declare module "opencut-wasm/opencut_wasm_bg.js" {
	export * from "opencut-wasm";
	export function __wbg_set_wasm(val: WebAssembly.Exports): void;
}
