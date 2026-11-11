"use client";

// =============================================================================
// Biblioteca › Multimedia › «Outliers»: los reels que enseñan un patrón de edición, adentro del editor (11/11/2026)
// =============================================================================
// Martín, 11/11/2026: «ya no depender de "Encuentra tu siguiente outlier", sino que sea directamente todo el sistema de edición
// primero, y que en alguna parte, por ejemplo del lado de Importar, estén estos outliers». Las MISMAS tarjetas de la portada
// (app/video-editor/OutliersVideo.tsx: la plantilla de MaKo con su portada, cada reel con su «×», su familia y su patrón), en dos
// columnas, con el filtro por familia. Tocar una reproduce el reel ahí mismo con lo que enseña y su receta (../../../VerReel.tsx).
// Los datos, de /api/video-editor/outliers (lo mismo que leía la portada).
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { FAMILIAS_EDICION, type FamiliaEdicion, type PortadaOutliers } from "@/lib/video-outliers";
import { TarjetaPlantilla, TarjetaReel } from "@/app/video-editor/OutliersVideo";
import s from "@/app/image-editor/carruseles/explorar.module.css";
import o from "@/app/video-editor/outliers.module.css";

type Estado = { tipo: "cargando" } | { tipo: "error"; texto: string } | { tipo: "listo"; portada: PortadaOutliers };

export function OutliersView() {
	const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
	const [familia, setFamilia] = useState<FamiliaEdicion | null>(null);
	useEffect(() => {
		let vivo = true;
		fetch("/api/video-editor/outliers", { cache: "no-store" })
			.then(async (r) => {
				const j = (await r.json().catch(() => null)) as (PortadaOutliers & { error?: string }) | null;
				if (!vivo) return;
				if (!r.ok || !j || !Array.isArray(j.outliers)) setEstado({ tipo: "error", texto: j?.error ?? "No pude traer los outliers." });
				else setEstado({ tipo: "listo", portada: j });
			})
			.catch(() => vivo && setEstado({ tipo: "error", texto: "No pude traer los outliers: revisa tu conexión." }));
		return () => {
			vivo = false;
		};
	}, []);

	const familias = useMemo(() => {
		if (estado.tipo !== "listo") return [];
		const n = new Map<FamiliaEdicion, number>();
		for (const x of estado.portada.outliers) if (x.edicion) n.set(x.edicion.familia, (n.get(x.edicion.familia) ?? 0) + 1);
		return [...n].sort((a, b) => b[1] - a[1]);
	}, [estado]);

	if (estado.tipo === "cargando") return <p className={o.panelNota}>Buscando los reels que enseñan edición…</p>;
	if (estado.tipo === "error") return <p className={o.panelNota} role="alert">{estado.texto}</p>;
	const { portada } = estado;
	const r = portada.resumen;
	const ahora = Date.now();
	const visibles = familia ? portada.outliers.filter((x) => x.edicion?.familia === familia) : portada.outliers;
	return (
		<div className={o.panel}>
			{r && r.medidos > 0 ? (
				<p className={o.panelNota}>{r.conPatron} de {r.medidos} reels de tus cuentas enseñan un patrón de edición y le ganaron a su cuenta.</p>
			) : null}
			{familias.length > 1 ? (
				<div className={o.panelFiltros} role="group" aria-label="Patrones de edición">
					<button type="button" className={`${s.chip} ${!familia ? o.chipActivo : ""}`} aria-pressed={!familia} onClick={() => setFamilia(null)}>Todos</button>
					{familias.map(([f, n]) => (
						<button key={f} type="button" className={`${s.chip} ${familia === f ? o.chipActivo : ""}`} aria-pressed={familia === f} onClick={() => setFamilia(f)}>
							{FAMILIAS_EDICION[f]} · {n}
						</button>
					))}
				</div>
			) : null}
			<ul className={`${s.grilla} ${o.grillaPanel}`}>
				{visibles.map((x) => (x.plantilla ? <TarjetaPlantilla key={x.id} x={x} telefono={false} /> : <TarjetaReel key={x.id} x={x} ahora={ahora} />))}
			</ul>
			{portada.outliers.filter((x) => !x.plantilla).length === 0 ? (
				<p className={o.panelNota}>Sigue en Competitors Spy cuentas que editen sus reels y aquí aparecen los que enseñan un patrón.</p>
			) : null}
		</div>
	);
}
