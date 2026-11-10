// =============================================================================
// El worker de «Reducir el ruido»: RNNoise y su ganancia, fuera del hilo de la pantalla
// =============================================================================
// Todo lo que hace está en ./protocolo.ts (puro, con test): acá sólo se engancha al alcance del worker. El motor es el
// mismo de la pantalla (dsp/rnnoise.ts: baja public/ve/wasm/rnnoise-0.2-jitsi-0.2.1.wasm del mismo origen y lo
// instancia con su pegamento propio, que no usa nada del navegador que un worker no tenga).

import { motorRnnoise } from "../dsp/rnnoise";
import { crearAtendedor, soltarConMensajes, type MensajeAlHilo, type MensajeDelHilo } from "./protocolo";

/** Lo que se usa del alcance de un worker dedicado (el proyecto compila con la librería del DOM). */
interface AlcanceDelWorker {
	postMessage(mensaje: MensajeDelHilo, transferir?: Transferable[]): void;
	onmessage: ((evento: MessageEvent<MensajeAlHilo>) => void) | null;
}
const alcance = self as unknown as AlcanceDelWorker;

const atender = crearAtendedor({
	cargarMotor: motorRnnoise,
	enviar: (mensaje, transferir) => alcance.postMessage(mensaje, transferir ?? []),
	soltar: soltarConMensajes(),
});

alcance.onmessage = (evento) => {
	void atender(evento.data);
};
