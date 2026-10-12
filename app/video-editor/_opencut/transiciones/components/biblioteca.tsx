"use client";

// =============================================================================
// Biblioteca › Transiciones (panel izquierdo)
// =============================================================================
// La grilla de tarjetas a la derecha de la columna (las secciones las registra
// ../registro.ts), con las piezas comunes de la biblioteca (buscador, grilla,
// títulos, vacío) para que se vea como UNA biblioteca. Cada tarjeta, como en
// CapCut:
//   · arrastrada sobre la línea de tiempo, cae en el corte más cercano del clip
//     donde se suelta (timeline/controllers/drag-drop-controller.ts → soltarTransicion);
//   · un clic (o el ⊕) la pone en el corte DERECHO del clip elegido; sin clip
//     elegido, en el corte del clip que está bajo el cabezal.

import { useState } from "react";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { DraggableItem } from "@/app/video-editor/_opencut/components/editor/panels/assets/draggable-item";
import {
	BuscadorBiblioteca,
	ContenidoBiblioteca,
	GrillaBiblioteca,
	TituloGrupo,
	VacioBiblioteca,
	normalizarBusqueda,
	useBusqueda,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/views/biblioteca-ui";
import {
	CATEGORIAS_TRANSICION,
	TRANSICIONES,
	type CategoriaTransicion,
	type DefinicionTransicion,
} from "../catalogo";
import { aplicarDesdeBiblioteca } from "../acciones";
import { MiniaturaTransicion } from "./miniatura";

function coincide(def: DefinicionTransicion, consulta: string): boolean {
	if (!consulta) return true;
	return normalizarBusqueda([def.nombre, def.categoria, ...(def.claves ?? [])].join(" ")).includes(consulta);
}

function TarjetaTransicion({ definicion }: { definicion: DefinicionTransicion }) {
	const editor = useEditor();
	const [encima, setEncima] = useState(false);
	const aplicar = () => aplicarDesdeBiblioteca(editor, definicion.id);
	return (
		<div onMouseEnter={() => setEncima(true)} onMouseLeave={() => setEncima(false)}>
			<DraggableItem
				name={definicion.nombre}
				preview={<MiniaturaTransicion id={definicion.id} animar={encima} />}
				dragData={{
					id: definicion.id,
					name: definicion.nombre,
					type: "transicion",
					transicionId: definicion.id,
				}}
				onAddToTimeline={aplicar}
				onClick={aplicar}
				aspectRatio={1}
				containerClassName="w-full"
			/>
		</div>
	);
}

function Grilla({ defs }: { defs: readonly DefinicionTransicion[] }) {
	return (
		<GrillaBiblioteca>
			{defs.map((d) => (
				<TarjetaTransicion key={d.id} definicion={d} />
			))}
		</GrillaBiblioteca>
	);
}

function Catalogo({ categoria }: { categoria?: CategoriaTransicion }) {
	const busqueda = useBusqueda();

	let cuerpo: React.ReactNode;
	if (busqueda.normalizado) {
		const resultado = TRANSICIONES.filter((d) => coincide(d, busqueda.normalizado));
		cuerpo =
			resultado.length > 0 ? <Grilla defs={resultado} /> : <VacioBiblioteca texto="No se encontraron resultados" />;
	} else if (categoria) {
		cuerpo = <Grilla defs={TRANSICIONES.filter((d) => d.categoria === categoria)} />;
	} else {
		cuerpo = (
			<div className="flex flex-col gap-4">
				{CATEGORIAS_TRANSICION.map((cat) => (
					<section key={cat}>
						<TituloGrupo>{cat}</TituloGrupo>
						<Grilla defs={TRANSICIONES.filter((d) => d.categoria === cat)} />
					</section>
				))}
			</div>
		);
	}

	return (
		<ContenidoBiblioteca
			arriba={
				<BuscadorBiblioteca
					valor={busqueda.valor}
					onCambio={busqueda.setValor}
					placeholder="Buscar transiciones"
				/>
			}
		>
			{cuerpo}
		</ContenidoBiblioteca>
	);
}

/** La vista de una sección: todas agrupadas (sin categoría) o las de una. */
export function vistaTransiciones(categoria?: CategoriaTransicion) {
	return function Transiciones() {
		return <Catalogo categoria={categoria} />;
	};
}
