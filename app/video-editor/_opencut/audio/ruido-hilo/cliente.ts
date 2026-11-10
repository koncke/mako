// =============================================================================
// «Reducir el ruido» desde la pantalla: se lo pide al worker, y si el worker no anda lo hace acá
// =============================================================================
// Lo usan la cadena de un clip (audio/cadena.ts: la vista previa y el export) y «Borrar silencios»
// (audio/borrar-silencios.ts, que busca las pausas en el audio sin ruido). Las dos piden con `reducirRuidoEnSegundoPlano`;
// ninguna llama a `reducirRuido` con el motor del navegador por su cuenta (lo fija tests/video-editor-ruido-hilo.test.ts).
//
// UN worker para toda la pestaña, que se crea con el primer pedido y queda: cargar RNNoise (1,4 MB) cuesta una vez.
// Varios pedidos se intercalan adentro, como se intercalaban en la pantalla.
//
// El RESPALDO es el camino de antes (la cuenta en este hilo), y se usa cuando:
//   · no se puede crear el worker (un navegador sin workers de módulo): desde ahí, todo acá;
//   · el worker no cargó o se cayó (el evento `error`: el chunk no llegó, una política lo frenó): lo que estaba en
//     él se rehace acá, y desde ahí, todo acá;
//   · el worker no pudo bajar o instanciar RNNoise: ese pedido se rehace acá (el próximo vuelve a probar el worker).
// Un error de la CUENTA no se repite acá: fallaría igual.
//
// Cancelar (un `AbortSignal`) rechaza enseguida con el motivo del signal y le avisa al worker, que corta en su próxima
// pausa (~28 ms de trabajo). Sin worker, la cuenta de acá corta en su próxima pausa.
//
// LOS TOPES (revisión del 10/11/2026): un worker colgado (la bajada del .wasm que no contesta, un worker trabado) dejaba
// el clip mudo y el export esperando para siempre. Ahora:
//   · un pedido sin NINGÚN mensaje del worker en `TOPE_SILENCIO_HILO_MS` (el worker manda un avance cada 1 %) da al
//     worker por colgado: se termina, y lo que estaba en él se rehace acá (como un worker caído);
//   · acá, el motor que no termina de cargar en `TOPE_CARGA_MOTOR_MS` rechaza con un error que se dice
//     (`TEXTO_SIN_MOTOR`): el export lo cuenta, y la vista previa lo vuelve a probar con el próximo cambio.

import { ceder } from "../dsp/fft";
import { motorRnnoise, type MotorRnnoise } from "../dsp/rnnoise";
import { reducirRuido } from "../dsp/ruido";
import {
	canalesParaMandar,
	transferibles,
	type MensajeAlHilo,
	type MensajeDelHilo,
	type PedidoRuido,
} from "./protocolo";

export type { PedidoRuido } from "./protocolo";

/** Sin un mensaje del worker en este tiempo, el worker está colgado (un avance sale cada 1 % del clip). */
export const TOPE_SILENCIO_HILO_MS = 45_000;
/** Lo que se espera a que el motor cargue en este hilo (1,4 MB del mismo origen). */
export const TOPE_CARGA_MOTOR_MS = 60_000;
export const TEXTO_SIN_MOTOR = "La reducción de ruido no terminó de cargar. Revisa tu conexión y vuelve a intentar.";

export type OpcionesReduccion = {
	/** Lo hecho, de 0 a 1 (el 1, al terminar). */
	alAvanzar?: (hecho: number) => void;
	signal?: AbortSignal;
};

/** Quien reduce el ruido de un clip: en un worker (`reducirRuidoEnSegundoPlano`) o en este hilo (`reductorEnEsteHilo`). */
export type ReductorRuido = (pedido: PedidoRuido, opciones?: OpcionesReduccion) => Promise<Float32Array[]>;

/** Lo que el cliente usa de un Worker (los tests le pasan uno que atiende en el mismo proceso). */
export type HiloRuido = {
	postMessage(mensaje: MensajeAlHilo, transferir: Transferable[]): void;
	addEventListener(tipo: "message", escuchar: (evento: MessageEvent<MensajeDelHilo>) => void): void;
	addEventListener(tipo: "error" | "messageerror", escuchar: (evento: Event) => void): void;
	terminate(): void;
};

function motivoDeCancelar(signal: AbortSignal | undefined): unknown {
	return signal?.reason ?? new DOMException("Se canceló la reducción de ruido", "AbortError");
}

/** El motor, o el error que se dice si no carga en `topeMs` (una bajada que nunca contesta). */
function conTope<T>(promesa: Promise<T>, topeMs: number): Promise<T> {
	let vencer: ReturnType<typeof setTimeout> | undefined;
	const tope = new Promise<never>((_, rechazar) => {
		vencer = setTimeout(() => rechazar(new Error(TEXTO_SIN_MOTOR)), topeMs);
	});
	return Promise.race([promesa, tope]).finally(() => clearTimeout(vencer));
}

/** La cuenta en este hilo, con un motor ya cargado o por cargar: el respaldo, y lo que usan los tests. */
export function reductorEnEsteHilo(
	cargarMotor: () => Promise<MotorRnnoise>,
	{ topeCargaMs = TOPE_CARGA_MOTOR_MS }: { topeCargaMs?: number } = {},
): ReductorRuido {
	return async (pedido, { alAvanzar, signal } = {}) => {
		if (signal?.aborted) throw motivoDeCancelar(signal);
		const motor = await conTope(cargarMotor(), topeCargaMs);
		if (signal?.aborted) throw motivoDeCancelar(signal);
		return reducirRuido({
			canales: pedido.canales,
			sampleRate: pedido.sampleRate,
			intensidad: pedido.intensidad,
			motor,
			alAvanzar,
			ceder: async () => {
				await ceder();
				if (signal?.aborted) throw motivoDeCancelar(signal);
			},
		});
	};
}

type Pendiente = {
	alAvanzar?: (hecho: number) => void;
	resolver: (canales: Float32Array[]) => void;
	rechazar: (error: unknown) => void;
	/** Rehacerlo en este hilo, con los canales del que llamó (al worker le fue una copia). */
	respaldo: () => void;
	/** Lo vuelve a armar cada mensaje del worker; si vence, el worker está colgado. */
	vigia?: ReturnType<typeof setTimeout>;
};

export function crearReductorEnHilo({
	crearHilo,
	enEsteHilo,
	topeSilencioMs = TOPE_SILENCIO_HILO_MS,
}: {
	crearHilo: () => HiloRuido;
	enEsteHilo: ReductorRuido;
	topeSilencioMs?: number;
}): ReductorRuido {
	let hilo: HiloRuido | null = null;
	let sinHilo = false;
	let siguienteId = 1;
	const pendientes = new Map<number, Pendiente>();

	/** El worker no anda (se cayó o no contesta): se termina, y lo que estaba en él se rehace acá. Desde ahí, todo acá. */
	const dejarElHilo = (cual: HiloRuido, porque: string, detalle?: unknown) => {
		if (hilo !== cual) return;
		console.warn(`[ruido] ${porque}; sigo en este hilo`, detalle ?? "");
		sinHilo = true;
		hilo = null;
		cual.terminate();
		const enElAire = [...pendientes.values()];
		pendientes.clear();
		for (const p of enElAire) p.respaldo();
	};

	const vigilar = (p: Pendiente, cual: HiloRuido) => {
		clearTimeout(p.vigia);
		p.vigia = setTimeout(() => dejarElHilo(cual, `el worker no contestó en ${Math.round(topeSilencioMs / 1000)} s`), topeSilencioMs);
	};

	const atender = (mensaje: MensajeDelHilo) => {
		const p = pendientes.get(mensaje.id);
		if (!p) return; // cancelado (ya se rechazó) o pasado al respaldo
		if (hilo) vigilar(p, hilo);
		switch (mensaje.tipo) {
			case "avance":
				p.alAvanzar?.(mensaje.hecho);
				return;
			case "listo":
				pendientes.delete(mensaje.id);
				p.alAvanzar?.(1);
				p.resolver(mensaje.canales);
				return;
			case "cancelado":
				pendientes.delete(mensaje.id);
				p.rechazar(new DOMException("Se canceló la reducción de ruido", "AbortError"));
				return;
			case "error":
				pendientes.delete(mensaje.id);
				if (mensaje.donde === "carga") {
					console.warn("[ruido] el worker no pudo cargar RNNoise; sigo en este hilo", mensaje.error);
					p.respaldo();
				} else p.rechazar(new Error(mensaje.error));
				return;
		}
	};

	const asegurarHilo = (): HiloRuido | null => {
		if (sinHilo) return null;
		if (hilo) return hilo;
		let nuevo: HiloRuido;
		try {
			nuevo = crearHilo();
		} catch (error) {
			console.warn("[ruido] no se pudo crear el worker; sigo en este hilo", error);
			sinHilo = true;
			return null;
		}
		const caer = (evento: Event) => dejarElHilo(nuevo, "el worker no anda", evento);
		nuevo.addEventListener("message", (evento) => atender(evento.data));
		nuevo.addEventListener("error", caer);
		nuevo.addEventListener("messageerror", caer);
		hilo = nuevo;
		return nuevo;
	};

	return (pedido, opciones = {}) => {
		const { alAvanzar, signal } = opciones;
		if (signal?.aborted) return Promise.reject(motivoDeCancelar(signal));
		const h = asegurarHilo();
		if (!h) return enEsteHilo(pedido, opciones);
		return new Promise<Float32Array[]>((resolver, rechazar) => {
			const id = siguienteId++;
			const alCancelar = () => {
				if (!pendientes.delete(id)) return;
				clearTimeout(pendiente.vigia);
				h.postMessage({ tipo: "cancelar", id }, []);
				rechazar(motivoDeCancelar(signal));
			};
			const soltarSignal = () => {
				signal?.removeEventListener("abort", alCancelar);
				clearTimeout(pendiente.vigia);
			};
			const pendiente: Pendiente = {
				alAvanzar,
				resolver: (canales) => {
					soltarSignal();
					resolver(canales);
				},
				rechazar: (error) => {
					soltarSignal();
					rechazar(error);
				},
				respaldo: () => {
					soltarSignal();
					enEsteHilo(pedido, opciones).then(resolver, rechazar);
				},
			};
			pendientes.set(id, pendiente);
			vigilar(pendiente, h);
			signal?.addEventListener("abort", alCancelar, { once: true });
			const canales = canalesParaMandar(pedido.canales);
			try {
				h.postMessage(
					{ tipo: "reducir", id, canales, sampleRate: pedido.sampleRate, intensidad: pedido.intensidad },
					transferibles(canales),
				);
			} catch (error) {
				// No se pudo mandar (un DataCloneError): este pedido, acá.
				console.warn("[ruido] no se pudo mandar el pedido al worker; sigo en este hilo", error);
				const p = pendientes.get(id);
				pendientes.delete(id);
				p?.respaldo();
			}
		});
	};
}

/** El de la pestaña: el worker de ./worker.ts, y el motor del navegador como respaldo. */
export const reducirRuidoEnSegundoPlano: ReductorRuido = crearReductorEnHilo({
	crearHilo: () => new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }) as unknown as HiloRuido,
	enEsteHilo: reductorEnEsteHilo(motorRnnoise),
});
