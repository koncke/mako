// =============================================================================
// El motor de OpenCut (opencut-wasm) cargado a mano, desde public/ve/wasm/
// =============================================================================
// `opencut-wasm` es un paquete de wasm-bindgen con target «bundler»: su entrada
// hace `import * as wasm from "./opencut_wasm_bg.wasm"` y le deja al bundler la
// carga. Turbopack la resuelve con su cargador de wasm, y EN VERCEL ese cargador
// rompe: la protección de versiones (skew protection) le pega `?dpl=<deploy>` a
// cada asset, y el cargador lo codifica ADENTRO del nombre del archivo
// (`…/0eyfu43addsuz.wasm%3Fdpl%3Ddpl_…?dpl=…` → 404). El editor entero cae con
// «Failed to execute 'compile' on 'WebAssembly': HTTP status code is not ok».
// En local no hay deploy id, así que en dev y en `next start` anda: medido en
// producción el 12/10/2026 desde el Chrome de Martín.
//
// Acá se hace lo mismo que la entrada del paquete, sin el bundler en el medio:
// se baja el .wasm de una ruta fija (exenta del proxy por `ve/`), se instancia
// con el pegamento JS del propio paquete (`opencut_wasm_bg.js`, que es el módulo
// de imports que el .wasm declara) y se arranca. La copia de public/ve/wasm/ la
// cuida tests/video-editor-wasm.test.ts: tiene que ser byte a byte la del paquete
// instalado, o el pegamento y el binario no se hablan.
//
// Es un módulo con await de nivel superior: quien lo importa espera a que el
// motor esté listo, igual que con la entrada original (que el bundler también
// volvía asíncrona).

import * as pegamento from "opencut-wasm/opencut_wasm_bg.js";

/** Versionada en el nombre: un deploy nuevo no puede servir un binario viejo de caché. */
export const URL_WASM_OPENCUT = "/ve/wasm/opencut-wasm-0.2.10.wasm";

async function instanciar(): Promise<WebAssembly.Instance> {
	const imports = { "./opencut_wasm_bg.js": pegamento as unknown as WebAssembly.ModuleImports };
	const respuesta = await fetch(URL_WASM_OPENCUT);
	if (!respuesta.ok) {
		throw new Error(`No se pudo bajar el motor del editor (${respuesta.status} en ${URL_WASM_OPENCUT})`);
	}
	// `instantiateStreaming` exige `application/wasm`; si el server manda otro
	// tipo, se cae al camino del ArrayBuffer en vez de fallar.
	if (respuesta.headers.get("content-type")?.includes("application/wasm")) {
		const { instance } = await WebAssembly.instantiateStreaming(respuesta, imports);
		return instance;
	}
	const { instance } = await WebAssembly.instantiate(await respuesta.arrayBuffer(), imports);
	return instance;
}

const instancia = await instanciar();
pegamento.__wbg_set_wasm(instancia.exports);
(instancia.exports as { __wbindgen_start: () => void }).__wbindgen_start();

export * from "opencut-wasm/opencut_wasm_bg.js";
