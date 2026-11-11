"use client";

// =============================================================================
// Los cursores de los agentes, sobre el editor, mientras MaKo edita
// =============================================================================
// Copiado del reel (9/11/2026): una flecha del color del agente con su nombre al lado («broll-01», «caps-02»), que va
// a donde trabaja. Adónde va lo decide ../cursores.ts con el último renglón del agente (la hora del video, o su
// panel); acá se miden las cajas y se dibuja. El que espera, quieto en su panel y apagado; el que trabaja, encendido,
// adelante y SIN quedarse quieto (`puntoTrabajando`: cada `PASEO_MS` se corre un poco, Martín 11/11/2026).
//
// Cuándo: con la «Edición automática» (todos, cada uno con su estado) y, fuera de ella, cada vez que MaKo edita
// (../cursores-sueltos.ts): lo que aplica el chat, los subtítulos, el B-roll y los clips mágicos, sólo el agente que
// trabaja. Al terminar se desvanecen (`SALIDA_MS`) en vez de desaparecer de golpe.
//
// Va por portal al `body`, sin tokens (sólo los colores de cada agente, en hex): no depende del tema del editor. No
// recibe el mouse (`pointer-events: none`): la persona puede seguir tocando el editor. Con «reducir movimiento» del
// sistema, los cursores saltan en lugar de deslizarse, y no pasean.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTrabajoBroll } from "@/app/video-editor/_opencut/broll/estado";
import { useTrabajoClips } from "@/app/video-editor/_opencut/clips/estado";
import { useTrabajoSubtitulos } from "@/app/video-editor/_opencut/subtitles/estado";
import { AGENTES, agentePorId, type AgenteId } from "../plan";
import { PASEO_MS, puntoDeCursor, puntoTrabajando, type Caja, type LineaMedida, type Punto, type Zona } from "../cursores";
import { agentesSueltos, useCursoresSueltos } from "../cursores-sueltos";
import { useEnjambre } from "../estado";

const ZONAS: Zona[] = ["biblioteca", "reproductor", "propiedades", "linea"];

/** Lo que tardan en desvanecerse al terminar (la transición de opacidad es de 300 ms). */
const SALIDA_MS = 450;

const cajaDe = (el: Element | null): Caja | null => {
	if (!el) return null;
	const r = el.getBoundingClientRect();
	return r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
};

/** Las cajas de ahora: cada panel por su `data-ce-zona`, y la línea de tiempo con su escala (`data-ce-pps`). */
function medir(): { zonas: Partial<Record<Zona, Caja>>; linea: LineaMedida | null } {
	const zonas: Partial<Record<Zona, Caja>> = {};
	for (const z of ZONAS) {
		const c = cajaDe(document.querySelector(`[data-ce-zona="${z}"]`));
		if (c) zonas[z] = c;
	}
	const scroll = document.querySelector<HTMLElement>("[data-ce-linea]");
	const caja = cajaDe(scroll);
	const pps = Number(scroll?.dataset.cePps ?? NaN);
	const linea = scroll && caja && Number.isFinite(pps) ? { caja, scrollLeft: scroll.scrollLeft, pps } : null;
	return { zonas, linea };
}

const sinMovimiento = (): boolean => {
	try {
		return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	} catch {
		return false;
	}
};

type Dibujo = { id: AgenteId; color: string; p: Punto; opacidad: number; adelante: boolean };

function Flecha({ color }: { color: string }) {
	return (
		<svg width="16" height="18" viewBox="0 0 16 18" aria-hidden className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
			<path d="M1.5 1.5 L14 10 L8.2 10.9 L5.3 16.5 Z" fill={color} stroke="#0b0b0f" strokeWidth="1.4" strokeLinejoin="round" />
		</svg>
	);
}

export function CursoresAgentes() {
	const fase = useEnjambre((s) => s.fase);
	const agentes = useEnjambre((s) => s.agentes);
	const lineas = useEnjambre((s) => s.lineas);
	const delChat = useCursoresSueltos((s) => s.delChat);
	const subtitulando = useTrabajoSubtitulos((s) => s.fase !== "inactivo");
	const brolleando = useTrabajoBroll((s) => s.fase !== "inactivo" || s.cambiando !== null);
	const recortando = useTrabajoClips((s) => s.fase !== "inactivo");
	const enjambre = fase === "corriendo";
	const sueltos = useMemo(
		() => (enjambre ? [] : agentesSueltos({ delChat, subtitulando, brolleando, recortando })),
		[enjambre, delChat, subtitulando, brolleando, recortando],
	);
	const enMarcha = enjambre || sueltos.length > 0;

	// Se re-mide con cada renglón, al cambiar el tamaño de la ventana y dos veces por segundo mientras trabajan (la línea
	// de tiempo se desplaza o cambia de zoom sin avisar: su escala está en `data-ce-pps`). La vuelta del paseo vuelve a 0
	// con cada renglón: el cursor va primero al punto exacto de lo que dice, y después pasea.
	const [medida, setMedida] = useState<ReturnType<typeof medir> | null>(null);
	const [vuelta, setVuelta] = useState(0);
	const [quieto, setQuieto] = useState(false);
	useEffect(() => setQuieto(sinMovimiento()), []);
	useEffect(() => {
		if (!enMarcha) return;
		const volver = () => setMedida(medir());
		volver();
		setVuelta(0);
		window.addEventListener("resize", volver);
		const t = setInterval(volver, 500);
		const paseo = quieto ? null : setInterval(() => setVuelta((v) => v + 1), PASEO_MS);
		return () => {
			window.removeEventListener("resize", volver);
			clearInterval(t);
			if (paseo) clearInterval(paseo);
		};
	}, [enMarcha, lineas.length, quieto]);

	// Al terminar, los últimos lugares un momento más, con opacidad 0: se desvanecen donde estaban.
	const ultimos = useRef<Dibujo[]>([]);
	const estaba = useRef(false);
	const [saliendo, setSaliendo] = useState(false);
	useEffect(() => {
		if (enMarcha) {
			estaba.current = true;
			setSaliendo(false);
			return;
		}
		if (!estaba.current) return;
		estaba.current = false;
		setSaliendo(true);
		const t = setTimeout(() => setSaliendo(false), SALIDA_MS);
		return () => clearTimeout(t);
	}, [enMarcha]);

	/** El último renglón de cada agente: de ahí sale adónde va su cursor. */
	const ultimo = useMemo(() => {
		const m = new Map<AgenteId, number | null>();
		for (const l of lineas) m.set(l.agente, l.en);
		return m;
	}, [lineas]);

	if (!enMarcha && !saliendo) return null;
	if (typeof document === "undefined") return null;
	let dibujo: Dibujo[];
	if (enMarcha && medida) {
		dibujo = enjambre
			? AGENTES.flatMap((a) => {
					const trabajando = agentes[a.id] === "trabajando";
					// El que no trabaja vuelve a su panel (no se queda donde dejó su último renglón).
					const p = trabajando
						? puntoTrabajando({ agente: a.id, en: ultimo.get(a.id) ?? null, ...medida, vuelta })
						: puntoDeCursor({ agente: a.id, en: null, ...medida });
					const opacidad = trabajando ? 1 : agentes[a.id] === "esperando" ? 0.5 : 0.3;
					return p ? [{ id: a.id, color: a.color, p, opacidad, adelante: trabajando }] : [];
				})
			: sueltos.flatMap((id) => {
					const p = puntoTrabajando({ agente: id, en: null, ...medida, vuelta });
					return p ? [{ id, color: agentePorId(id).color, p, opacidad: 1, adelante: true }] : [];
				});
		ultimos.current = dibujo;
	} else if (saliendo) {
		dibujo = ultimos.current.map((d) => ({ ...d, opacidad: 0 }));
	} else return null;

	return createPortal(
		<div aria-hidden className="pointer-events-none fixed inset-0 z-[58]">
			{dibujo.map(({ id, color, p, opacidad, adelante }) => (
				<div
					key={id}
					className="absolute top-0 left-0 flex items-start gap-0.5"
					style={{
						transform: `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)`,
						transition: quieto ? "opacity 300ms" : "transform 520ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms",
						opacity: opacidad,
						zIndex: adelante ? 2 : 1,
					}}
				>
					<Flecha color={color} />
					<span
						className="mt-3 rounded-[4px] px-1.5 py-[1px] font-mono text-[10px] leading-[14px] whitespace-nowrap shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
						style={{ backgroundColor: color, color: "#0b0b0f" }}
					>
						{id}
					</span>
				</div>
			))}
		</div>,
		document.body,
	);
}
