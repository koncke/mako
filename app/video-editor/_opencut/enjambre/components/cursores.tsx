"use client";

// =============================================================================
// Los cursores de los agentes, sobre el editor, mientras MaKo edita
// =============================================================================
// Copiado del reel (9/11/2026): una flecha del color del agente con su nombre al lado («broll-01», «caps-02»), que va
// a donde trabaja. Adónde va lo decide ../cursores.ts con el último renglón del agente (la hora del video, o su
// panel); acá se miden las cajas y se dibuja. TODOS se mueven a la vez y rápido (Martín, 11/11/2026: «que pasen los cursores
// todos juntos al mismo tiempo y mucho más rápido… se tiene que notar la automatización»): el que trabaja, encendido y adelante,
// va a lo suyo; los demás trabajan sus objetivos, un poco apagados. Cada uno AGARRA algo real del editor (un clip, el
// subtítulo, un control, un medio de la biblioteca) y lo marca con una caja de su color, como en el reel de referencia
// (`tareaDeAgente` en ../cursores.ts; los clips llevan `data-ce-clip` y su tipo en timeline-element.tsx).
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
import { PASEO_MS, SIN_OBJETIVOS, TRANSICION_CURSOR_MS, cajasDelCuadro, tareaDeAgente, type Caja, type LineaMedida, type Objetivos, type Punto, type Zona } from "../cursores";
import { agentesSueltos, useCursoresSueltos } from "../cursores-sueltos";
import { useEnjambre } from "../estado";

const ZONAS: Zona[] = ["biblioteca", "reproductor", "propiedades", "linea"];

/** Lo que tardan en desvanecerse al terminar (la transición de opacidad es de 200 ms). */
const SALIDA_MS = 300;

const cajaDe = (el: Element | null): Caja | null => {
	if (!el) return null;
	const r = el.getBoundingClientRect();
	return r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
};

/** Las cajas visibles de un selector, adentro de una zona (lo que se puede tocar), hasta `tope`. */
function cajasVisibles(selector: string, dentro: Caja | null | undefined, tope: number): Caja[] {
	if (!dentro) return [];
	const out: Caja[] = [];
	for (const el of document.querySelectorAll(selector)) {
		const c = cajaDe(el);
		if (!c || c.width < 8 || c.height < 8) continue;
		const cx = c.left + c.width / 2;
		const cy = c.top + c.height / 2;
		if (cx < dentro.left || cx > dentro.left + dentro.width || cy < dentro.top || cy > dentro.top + dentro.height) continue;
		out.push(c);
		if (out.length >= tope) break;
	}
	return out;
}

/** Las cajas de ahora: cada panel por su `data-ce-zona`, la línea de tiempo con su escala (`data-ce-pps`) y lo que hay para tocar. */
function medir(): { zonas: Partial<Record<Zona, Caja>>; linea: LineaMedida | null; objetivos: Objetivos } {
	const zonas: Partial<Record<Zona, Caja>> = {};
	for (const z of ZONAS) {
		const c = cajaDe(document.querySelector(`[data-ce-zona="${z}"]`));
		if (c) zonas[z] = c;
	}
	const scroll = document.querySelector<HTMLElement>("[data-ce-linea]");
	const caja = cajaDe(scroll);
	const pps = Number(scroll?.dataset.cePps ?? NaN);
	const linea = scroll && caja && Number.isFinite(pps) ? { caja, scrollLeft: scroll.scrollLeft, pps } : null;
	const clip = (tipo: string) => cajasVisibles(`[data-ce-linea] [data-ce-clip][data-ce-tipo="${tipo}"]`, caja, 12);
	const objetivos: Objetivos = {
		...SIN_OBJETIVOS,
		clips: [...clip("video"), ...clip("image")],
		textos: clip("text"),
		audios: clip("audio"),
		controles: cajasVisibles('[data-ce-zona="propiedades"] input, [data-ce-zona="propiedades"] [role="slider"], [data-ce-zona="propiedades"] [role="switch"]', zonas.propiedades, 14),
		medios: cajasVisibles('[data-ce-zona="biblioteca"] img, [data-ce-zona="biblioteca"] [draggable="true"]', zonas.biblioteca, 10),
		...cajasDelCuadro(cajaDe(document.querySelector('[data-ce-zona="reproductor"] canvas'))),
	};
	return { zonas, linea, objetivos };
}

const sinMovimiento = (): boolean => {
	try {
		return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	} catch {
		return false;
	}
};

type Dibujo = { id: AgenteId; color: string; p: Punto; caja: Caja | null; opacidad: number; adelante: boolean };

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
	// La vuelta de los que NO trabajan: no vuelve a 0 con cada renglón (si no, todos saltaban juntos a su lugar).
	const [paso, setPaso] = useState(1);
	const [quieto, setQuieto] = useState(false);
	useEffect(() => setQuieto(sinMovimiento()), []);
	useEffect(() => {
		if (!enMarcha) return;
		const volver = () => setMedida(medir());
		volver();
		setVuelta(0);
		window.addEventListener("resize", volver);
		const t = setInterval(volver, 500);
		const paseo = quieto ? null : setInterval(() => { setVuelta((v) => v + 1); setPaso((v) => v + 1); }, PASEO_MS);
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
					// TODOS trabajan a la vez (Martín, 11/11/2026: «que pasen los cursores todos juntos al mismo tiempo… que estén
					// trabajando, hagan cosas, no moverse random»): cada uno en SUS objetivos (../cursores.ts → `tareaDeAgente`), con
					// su caja de selección. El que tiene un renglón con hora va a ESE segundo de la línea de tiempo.
					const en = trabajando ? (ultimo.get(a.id) ?? null) : null;
					const t = tareaDeAgente({ agente: a.id, en, vuelta: trabajando ? vuelta : paso, ...medida });
					const opacidad = trabajando ? 1 : agentes[a.id] === "esperando" ? 0.85 : 0.6;
					return t ? [{ id: a.id, color: a.color, p: t.punto, caja: t.caja, opacidad, adelante: trabajando }] : [];
				})
			: sueltos.flatMap((id) => {
					const t = tareaDeAgente({ agente: id, en: null, vuelta, ...medida });
					return t ? [{ id, color: agentePorId(id).color, p: t.punto, caja: t.caja, opacidad: 1, adelante: true }] : [];
				});
		ultimos.current = dibujo;
	} else if (saliendo) {
		dibujo = ultimos.current.map((d) => ({ ...d, opacidad: 0 }));
	} else return null;

	return createPortal(
		<div aria-hidden className="pointer-events-none fixed inset-0 z-[58]">
			{/* La caja de lo que trabaja cada uno, con su color y debajo de los cursores: como en el reel, se ve QUÉ agarró. */}
			{dibujo.map(({ id, color, caja, opacidad }) =>
				caja ? (
					<div
						key={`caja-${id}`}
						className="absolute top-0 left-0 rounded-[4px]"
						style={{
							transform: `translate3d(${Math.round(caja.left)}px, ${Math.round(caja.top)}px, 0)`,
							width: Math.round(caja.width),
							height: Math.round(caja.height),
							border: `1.5px solid ${color}`,
							backgroundColor: `${color}1f`,
							// La caja NO viaja: aparece en lo que se agarra (como en el reel). Deslizándose, una caja grande cruzaba el
							// reproductor y la línea de tiempo cambiando de tamaño (mirado cuadro por cuadro el 11/11/2026). Viaja el cursor.
							transition: "opacity 200ms",
							opacity: opacidad * 0.9,
						}}
					/>
				) : null,
			)}
			{dibujo.map(({ id, color, p, opacidad, adelante }) => (
				<div
					key={id}
					className="absolute top-0 left-0 flex items-start gap-0.5"
					style={{
						transform: `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)`,
						transition: quieto ? "opacity 200ms" : `transform ${TRANSICION_CURSOR_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms`,
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
