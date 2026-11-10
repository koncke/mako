"use client";

// =============================================================================
// Biblioteca › Multimedia › «Edición automática»
// =============================================================================
// Copiado del reel que mandó Martín (9/11/2026, «PARA LA EDICIÓN EN MAKO, ESTO QUIERO»): el panel «SWARM ACTIVITY»
// y la columna «SWARM» del editor que se ve en el monitor.
//   · arriba, los agentes: su etiqueta con su color, qué hace, cómo va y una barra con cuánto hizo;
//   · en el medio, el registro: la hora del video donde actuó («02:18»), el agente con su barrita de color y lo que
//     hizo, en letra de máquina, y arriba a la derecha las operaciones por segundo en lima («52 ops/s»);
//   · abajo, «Editar con MaKo» (o «Detener»), y al terminar «Reproducir el corte final» y «Deshacer todo».
// El registro aparece de a un renglón con un pequeño delay (useRevelado de app/_ui/ArmadoEnVivo.tsx): la cadencia de
// la casa, sin progreso inventado, salteable con «Ver todo» y quieta con «reducir movimiento».
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import { Spinner } from "@/app/video-editor/_opencut/components/ui/spinner";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { mediaTimeFromSeconds } from "@/app/video-editor/_opencut/wasm";
import { useRevelado } from "@/app/_ui/ArmadoEnVivo";
import { ReportarASoporte } from "@/app/_ui/ReportarASoporte";
import { AGENTES, LIMA, agentePorId, opsPorAgente, opsPorSegundo, relojLinea, type LineaActividad } from "../plan";
import { useEnjambre, type EstadoAgente } from "../estado";
import { correrEnjambre, deshacerEnjambre, detenerEnjambre, reproducirCorteFinal, rotuloDePaso } from "../correr";

const ESTADO_AGENTE: Record<EstadoAgente, string> = {
	esperando: "espera",
	trabajando: "trabajando",
	listo: "listo",
	salteado: "nada que hacer",
	fallo: "avisa",
};

/** La etiqueta de un agente, con su color: «corte-01». */
export function EtiquetaAgente({ id, chica = false }: { id: LineaActividad["agente"]; chica?: boolean }) {
	const a = agentePorId(id);
	return (
		<span
			className={`inline-flex shrink-0 items-center gap-1 rounded-[3px] font-mono ${chica ? "px-1 text-[10px]" : "px-1.5 text-[11px]"}`}
			style={{ color: a.color, backgroundColor: `${a.color}1f`, boxShadow: `inset 2px 0 0 ${a.color}` }}
		>
			{a.id}
		</span>
	);
}

function FilaAgentes() {
	const agentes = useEnjambre((s) => s.agentes);
	const lineas = useEnjambre((s) => s.lineas);
	const porAgente = opsPorAgente(lineas);
	const maximo = Math.max(1, ...porAgente.values());
	return (
		<ul className="flex flex-col gap-1">
			{AGENTES.map((a) => {
				const estado = agentes[a.id];
				const n = porAgente.get(a.id) ?? 0;
				return (
					// La barra va DEBAJO de la fila, a lo ancho (10/11/2026, medido en producción): en el panel (212 px) la
					// etiqueta, una barra de 48 px y un estado de 86 px fijos le dejaban 8 px al rol, que se leía «S…», «E…».
					<li key={a.id} className="relative flex min-w-0 items-center gap-2 pb-1 text-[11px]">
						<EtiquetaAgente id={a.id} chica />
						<span className="min-w-0 flex-1 truncate text-(--cc-text-2)">{a.rol}</span>
						<span className="absolute inset-x-0 bottom-0 block h-0.5 overflow-hidden rounded-full bg-(--cc-raised)" aria-hidden>
							<span
								className="block h-full rounded-full transition-[width] duration-300"
								style={{ width: `${Math.round((n / maximo) * 100)}%`, backgroundColor: a.color }}
							/>
						</span>
						<span
							className={`max-w-[50%] shrink-0 truncate text-right ${estado === "trabajando" ? "text-(--cc-text)" : "text-(--cc-text-3)"}`}
						>
							{estado === "trabajando" ? (
								<span className="inline-flex items-center gap-1">
									<span className="size-1.5 animate-pulse rounded-full" style={{ backgroundColor: a.color }} />
									{ESTADO_AGENTE[estado]}
								</span>
							) : (
								ESTADO_AGENTE[estado]
							)}
						</span>
					</li>
				);
			})}
		</ul>
	);
}

const COLOR_TIPO: Partial<Record<LineaActividad["tipo"], string>> = {
	mira: "text-(--cc-text-3)",
	salta: "text-(--cc-text-3)",
	falla: "text-(--cc-text)",
	"qa-mal": "text-(--cc-text)",
	listo: "text-(--cc-text)",
};

function Registro() {
	const editor = useEditor();
	const lineas = useEnjambre((s) => s.lineas);
	const fase = useEnjambre((s) => s.fase);
	const { visibles, saltear, salteado } = useRevelado(lineas.length);
	const caja = useRef<HTMLOListElement>(null);
	const [ahora, setAhora] = useState(() => Date.now());

	// Las operaciones por segundo se miden con el reloj: mientras trabaja, cuatro veces por segundo.
	useEffect(() => {
		if (fase !== "corriendo") return;
		const t = setInterval(() => setAhora(Date.now()), 250);
		return () => clearInterval(t);
	}, [fase]);
	// El último renglón a la vista, como un registro que corre; salvo que la persona haya subido a leer lo de antes.
	const pegado = useRef(true);
	useEffect(() => {
		const el = caja.current;
		if (el && pegado.current) el.scrollTop = el.scrollHeight;
	}, [visibles]);

	// Terminado, no hay operaciones por segundo: el número no se queda congelado en el último.
	const ops = fase === "corriendo" ? opsPorSegundo(lineas, ahora) : 0;
	const vistas = lineas.slice(0, visibles);
	return (
		// Sin `min-h-0`: el cuerpo del panel se desplaza, y el registro no baja de su mínimo (los 120 px de la lista).
		<div className="flex flex-1 flex-col gap-1.5">
			<div className="flex items-center justify-between gap-2">
				<span className="font-mono text-[10px] tracking-[0.08em] text-(--cc-text-3) uppercase">Actividad de los agentes</span>
				<span className="font-mono text-[11px]" style={{ color: LIMA }} title="operaciones por segundo">
					{ops} ops/s
				</span>
			</div>
			<ol
				ref={caja}
				onScroll={(e) => {
					const el = e.currentTarget;
					pegado.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
				}}
				className="scrollbar-thin min-h-[120px] flex-1 overflow-y-auto rounded-[5px] bg-(--cc-app) px-2 py-1.5 font-mono text-[11px] leading-[1.6]"
			>
				{vistas.length === 0 && <li className="text-(--cc-text-3)">Todavía no trabajó ningún agente.</li>}
				{vistas.map((l) => (
					<li key={l.id} className="flex min-w-0 items-baseline gap-2">
						<button
							type="button"
							disabled={l.en === null}
							onClick={() => l.en !== null && editor.playback.seek({ time: mediaTimeFromSeconds({ seconds: l.en }) })}
							className="w-[38px] shrink-0 cursor-pointer text-left text-(--cc-text-3) tabular-nums enabled:hover:text-(--cc-text) disabled:cursor-default"
							aria-label={l.en === null ? undefined : `Ir a ${relojLinea(l.en)}`}
						>
							{relojLinea(l.en)}
						</button>
						<EtiquetaAgente id={l.agente} chica />
						<span className={`min-w-0 flex-1 break-words ${COLOR_TIPO[l.tipo] ?? "text-(--cc-text-2)"}`}>{l.texto}</span>
					</li>
				))}
			</ol>
			{visibles < lineas.length && !salteado && (
				<button type="button" onClick={saltear} className="self-end cursor-pointer text-[11px] text-(--cc-text-3) hover:text-(--cc-text-2)">
					Ver todo
				</button>
			)}
		</div>
	);
}

export function EnjambreView() {
	const editor = useEditor();
	const fase = useEnjambre((s) => s.fase);
	const paso = useEnjambre((s) => s.paso);
	const resumen = useEnjambre((s) => s.resumen);
	const error = useEnjambre((s) => s.error);
	const detener = useEnjambre((s) => s.detener);
	const deshacer = useEnjambre((s) => s.deshacer);
	const corrida = useEnjambre((s) => s.corrida);
	const desdeElChat = useEnjambre((s) => s.desdeElChat);
	const fallas = useEnjambre((s) => s.lineas.filter((l) => l.tipo === "falla").map((l) => `${l.agente}: ${l.texto}`).join(" · "));
	const hayLinea = useEditor((e) => e.timeline.getTotalDuration() > 0);
	const corriendo = fase === "corriendo";

	const editar = async () => {
		const r = await correrEnjambre(editor);
		if (!r.ok) toast.error(r.texto);
	};
	const deshacerTodo = () => {
		if (!deshacerEnjambre(editor)) toast.error("Cambiaste la línea de tiempo después: usa Ctrl+Z para volver atrás.");
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Con la ventana baja (674 px de alto, medido el 10/11/2026), el texto, los diez agentes y el registro (120 px
			    como mínimo) no entraban y se desbordaban DEBAJO del pie: «Editar con MaKo» tapaba el registro. Se desplaza. */}
			<div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pt-3 pb-3">
				<p className="text-[12px] text-(--cc-text-2)">Un equipo de agentes edita tu video a la vista: cortes, subtítulos, B-roll y sonido.</p>
				<FilaAgentes />
				{/* Una corrida nueva arranca su registro de cero (también lo que se reveló con «Ver todo»). */}
				<Registro key={corrida} />
			</div>
			<div className="shrink-0 border-t border-(--cc-line-2) px-3 pt-2.5 pb-3">
				<div className="flex flex-col gap-2">
					{corriendo ? (
						<div className="flex items-center gap-2">
							<span className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] text-(--cc-text-2)">
								<Spinner className="size-3.5 shrink-0" />
								{/* Lo que se le lee a un lector de pantalla: el paso de ahora, no cada renglón del registro. */}
								<span className="truncate" aria-live="polite">
									{detener ? "Termina este paso y para…" : paso ? rotuloDePaso(paso) : "Arrancando…"}
								</span>
							</span>
							<button
								type="button"
								disabled={detener}
								onClick={detenerEnjambre}
								className="shrink-0 cursor-pointer rounded px-2 py-1 text-[11px] text-(--cc-text-2) hover:bg-(--cc-raised) hover:text-(--cc-text) disabled:cursor-default disabled:opacity-50"
							>
								Detener
							</button>
						</div>
					) : (
						<Button type="button" className="w-full" disabled={!hayLinea} onClick={() => void editar()}>
							{fase === "terminado" ? "Editar de nuevo con MaKo" : "Editar con MaKo"}
						</Button>
					)}
					{fase === "terminado" && (
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => reproducirCorteFinal(editor)}
								className="flex-1 cursor-pointer rounded-md bg-(--cc-raised) px-3 py-1.5 text-[12px] text-(--cc-text) hover:opacity-90"
							>
								Reproducir el corte final
							</button>
							{deshacer && !desdeElChat && (
								<button
									type="button"
									onClick={deshacerTodo}
									className="shrink-0 cursor-pointer rounded-md px-3 py-1.5 text-[12px] text-(--cc-text-2) hover:bg-(--cc-raised) hover:text-(--cc-text)"
								>
									Deshacer todo
								</button>
							)}
						</div>
					)}
					{!corriendo && resumen && !error && (
						<p className="text-[11px] text-(--cc-text-3)" role="status">
							{resumen}
						</p>
					)}
					{!corriendo && resumen && error && (
						<p className="text-[11px] text-(--cc-text-2)" role="alert">
							{resumen}
							<ReportarASoporte error={`Edición automática: ${fallas || resumen}`} />
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
