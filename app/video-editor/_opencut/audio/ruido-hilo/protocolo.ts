// =============================================================================
// «Reducir el ruido» fuera del hilo de la pantalla: lo que se dicen la pantalla y el worker
// =============================================================================
// RNNoise cuesta ~6 s por minuto de audio y canal (audio/dsp/ruido.ts). En el hilo de la pantalla, aunque soltara el
// hilo cada 40 cuadros, un estéreo de 10 minutos dejaba el editor respondiendo a saltos unos 2 minutos
// (docs/editor-video/pendientes-video-editor.md §7.2). Desde el 10/11/2026 la cuenta corre en un worker
// (./worker.ts); la pantalla le habla por ./cliente.ts, que si el worker no anda la hace acá, como antes.
//
// Este módulo es PURO (sin `self` ni `Worker`) para que los tests lo corran en node con el RNNoise de verdad:
//   · qué mensajes van y vienen, con un `id` por pedido (varios clips pueden estar procesándose a la vez);
//   · cada canal viaja en su PROPIO búfer, TRANSFERIDO: no se copia de un hilo al otro, y no se desprende nada del
//     que llama (el `getChannelData` de un AudioBuffer, una vista sobre otro búfer);
//   · el atendedor del worker: carga el motor, corre `reducirRuido` (la MISMA función que en este hilo: el resultado
//     es el mismo byte a byte), cuenta el avance y corta en la próxima pausa si le cancelan el pedido.

import type { MotorRnnoise } from "../dsp/rnnoise";
import { reducirRuido } from "../dsp/ruido";

/** Lo que se le pide a quien reduce el ruido: los canales de UN clip, a su tasa. */
export type PedidoRuido = {
	canales: readonly Float32Array[];
	sampleRate: number;
	intensidad: number;
};

export type MensajeAlHilo =
	| { tipo: "reducir"; id: number; canales: Float32Array[]; sampleRate: number; intensidad: number }
	| { tipo: "cancelar"; id: number };

export type MensajeDelHilo =
	/** Lo hecho, de 0 a 1 (sin el 1: ése es «listo»). */
	| { tipo: "avance"; id: number; hecho: number }
	| { tipo: "listo"; id: number; canales: Float32Array[] }
	| { tipo: "cancelado"; id: number }
	/**
	 * `carga`: el worker no pudo bajar o instanciar RNNoise (la pantalla lo vuelve a intentar en su hilo);
	 * `calculo`: falló la cuenta (en la pantalla fallaría igual: no se repite).
	 */
	| { tipo: "error"; id: number; donde: "carga" | "calculo"; error: string };

/** Cada canal en un búfer propio y del largo justo: lo que se transfiere no es del que llama, y nunca va dos veces. */
export function canalesParaMandar(canales: readonly Float32Array[]): Float32Array[] {
	return canales.map((c) => c.slice());
}

/** Los búferes a transferir, sin repetir (transferir dos veces el mismo es un DataCloneError). */
export function transferibles(canales: readonly Float32Array[]): ArrayBuffer[] {
	return [...new Set(canales.map((c) => c.buffer as ArrayBuffer))];
}

/** Lo que tira la pausa de un pedido cancelado: corta `reducirRuido` ahí (el estado de RNNoise se libera en su `finally`). */
export class PedidoCancelado extends Error {
	constructor() {
		super("Se canceló la reducción de ruido");
		this.name = "PedidoCancelado";
	}
}

/** Un mensaje de avance cada 1 % como mucho: un clip largo suelta el hilo miles de veces. */
const AVANCE_MINIMO = 0.01;

function texto(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * El que atiende los pedidos en el worker. `soltar` es la pausa entre tandas de cuadros (en el worker,
 * `soltarConMensajes`): ahí se lee un «cancelar» que llegó mientras se calculaba. Devuelve la promesa del pedido
 * para que los tests puedan esperarlo; el worker no la espera (los pedidos se intercalan, como en la pantalla).
 */
export function crearAtendedor({
	cargarMotor,
	enviar,
	soltar,
}: {
	cargarMotor: () => Promise<MotorRnnoise>;
	enviar: (mensaje: MensajeDelHilo, transferir?: ArrayBuffer[]) => void;
	soltar: () => Promise<void>;
}): (mensaje: MensajeAlHilo) => Promise<void> {
	const enCurso = new Set<number>();
	const cancelados = new Set<number>();
	return async (mensaje) => {
		if (mensaje.tipo === "cancelar") {
			// Uno que ya terminó no queda anotado para siempre.
			if (enCurso.has(mensaje.id)) cancelados.add(mensaje.id);
			return;
		}
		const { id } = mensaje;
		enCurso.add(id);
		try {
			let motor: MotorRnnoise;
			try {
				motor = await cargarMotor();
			} catch (error) {
				enviar({ tipo: "error", id, donde: "carga", error: texto(error) });
				return;
			}
			if (cancelados.has(id)) {
				enviar({ tipo: "cancelado", id });
				return;
			}
			let ultimo = 0;
			const salida = await reducirRuido({
				canales: mensaje.canales,
				sampleRate: mensaje.sampleRate,
				intensidad: mensaje.intensidad,
				motor,
				alAvanzar: (hecho) => {
					if (hecho >= 1 || hecho - ultimo < AVANCE_MINIMO) return;
					ultimo = hecho;
					enviar({ tipo: "avance", id, hecho });
				},
				ceder: async () => {
					await soltar();
					if (cancelados.has(id)) throw new PedidoCancelado();
				},
			});
			enviar({ tipo: "listo", id, canales: salida }, transferibles(salida));
		} catch (error) {
			if (error instanceof PedidoCancelado) enviar({ tipo: "cancelado", id });
			else enviar({ tipo: "error", id, donde: "calculo", error: texto(error) });
		} finally {
			enCurso.delete(id);
			cancelados.delete(id);
		}
	};
}

/**
 * Soltar el hilo sin esperar. Un `setTimeout(0)` encadenado espera al menos 4 ms desde la quinta vuelta (la regla de
 * HTML para los timers anidados, que también rige en un worker) y la red suelta el hilo cada ~28 ms de trabajo. Un
 * mensaje a uno mismo por un MessageChannel vuelve enseguida, y alcanza para que entre un «cancelar» en el medio.
 */
export function soltarConMensajes(): () => Promise<void> {
	if (typeof MessageChannel === "undefined") return () => new Promise<void>((r) => setTimeout(r, 0));
	const canal = new MessageChannel();
	const esperando: Array<() => void> = [];
	canal.port1.onmessage = () => esperando.shift()?.();
	// En node (los tests), un puerto escuchando no deja terminar el proceso; en el navegador no existe.
	(canal.port1 as MessagePort & { unref?: () => void }).unref?.();
	return () =>
		new Promise<void>((r) => {
			esperando.push(r);
			canal.port2.postMessage(0);
		});
}
