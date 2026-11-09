"use client";

// =============================================================================
// Los cursores de los agentes, sobre el editor, mientras trabaja la «Edición automática»
// =============================================================================
// Copiado del reel (9/11/2026): una flecha del color del agente con su nombre al lado («broll-01», «caps-02»), que va
// a donde trabaja. Adónde va lo decide ../cursores.ts con el último renglón del agente (la hora del video, o su
// panel); acá se miden las cajas y se dibuja. El que espera, quieto en su panel y apagado; el que trabaja, encendido
// y adelante.
//
// Va por portal al `body`, sin tokens (sólo los colores de cada agente, en hex): no depende del tema del editor. No
// recibe el mouse (`pointer-events: none`): la persona puede seguir tocando el editor. Con «reducir movimiento» del
// sistema, los cursores saltan en lugar de deslizarse.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AGENTES, type AgenteId } from "../plan";
import { puntoDeCursor, type Caja, type LineaMedida, type Punto, type Zona } from "../cursores";
import { useEnjambre } from "../estado";

const ZONAS: Zona[] = ["biblioteca", "reproductor", "propiedades", "linea"];

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
	// Se re-mide con cada renglón y al cambiar el tamaño de la ventana.
	const [medida, setMedida] = useState<ReturnType<typeof medir> | null>(null);
	const [quieto, setQuieto] = useState(false);
	useEffect(() => setQuieto(sinMovimiento()), []);
	useEffect(() => {
		if (fase !== "corriendo") return;
		const volver = () => setMedida(medir());
		volver();
		window.addEventListener("resize", volver);
		return () => window.removeEventListener("resize", volver);
	}, [fase, lineas.length]);

	/** El último renglón de cada agente: de ahí sale adónde va su cursor. */
	const ultimo = useMemo(() => {
		const m = new Map<AgenteId, number | null>();
		for (const l of lineas) m.set(l.agente, l.en);
		return m;
	}, [lineas]);

	if (fase !== "corriendo" || !medida || typeof document === "undefined") return null;
	const puntos = AGENTES.map((a) => {
		const trabajando = agentes[a.id] === "trabajando";
		// El que no trabaja vuelve a su panel (no se queda donde dejó su último renglón).
		const p: Punto | null = puntoDeCursor({ agente: a.id, en: trabajando ? (ultimo.get(a.id) ?? null) : null, ...medida });
		return { a, p, trabajando };
	});

	return createPortal(
		<div aria-hidden className="pointer-events-none fixed inset-0 z-[58]">
			{puntos.map(({ a, p, trabajando }) =>
				p ? (
					<div
						key={a.id}
						className="absolute top-0 left-0 flex items-start gap-0.5"
						style={{
							transform: `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)`,
							transition: quieto ? "none" : "transform 520ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms",
							opacity: trabajando ? 1 : agentes[a.id] === "esperando" ? 0.5 : 0.3,
							zIndex: trabajando ? 2 : 1,
						}}
					>
						<Flecha color={a.color} />
						<span
							className="mt-3 rounded-[4px] px-1.5 py-[1px] font-mono text-[10px] leading-[14px] whitespace-nowrap shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
							style={{ backgroundColor: a.color, color: "#0b0b0f" }}
						>
							{a.id}
						</span>
					</div>
				) : null,
			)}
		</div>,
		document.body,
	);
}
