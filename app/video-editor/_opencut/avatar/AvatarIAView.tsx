"use client";

// =============================================================================
// Biblioteca › Avatar de IA › Biblioteca de avatares — la copia de CapCut
// =============================================================================
// Pedido de Martín (14/10/2026), con la captura de CapCut: «implementa lo que ya
// tenemos en MaKo para la generación de videos con esa tab que tiene Capcut de
// "Avatar de IA"».
//
// Lo que se copia de CapCut (captura + es-LA.po de la instalación 9.6):
//   ① «Elige el avatar» — ② «Agregar voz» (`pc_avatar_title_choose/_dub`), el grupo
//   «Avatar de IA ▴» con sus pastillas («Mis avatares», `pc_avatar_cat_diy`), la
//   tarjeta «Crear» (`pc_avatar_cat_diyadd`), «Siguiente»/«Anterior», «Guion»,
//   «Escribe lo que quieres que lea el avatar de IA» (`pc_avatar_read_enter`),
//   «Voz», «Generar» y los avisos («Selecciona un avatar de IA primero», «Es
//   posible que la aplicación de un avatar de IA tome un tiempo.», «Tu avatar de IA
//   está listo»).
//
// Lo que NO se copia, a propósito (relevamiento de CapCut, punto 6: «mostrar solo
// lo que MaKo tenga»): los avatares de stock de CapCut (Tendencias, Profesional,
// Casual… son de ByteDance), las otras entradas de la columna (De foto a avatar,
// De video a avatar, Video de modelo de ropa, Traductor de videos, Escena de
// diálogo de IA) y el diamante Pro. «Crear» lleva al Video Generator, que es donde
// MaKo arma un avatar (tu foto en un escenario).
//
// Lo que genera es el Video Generator (./generar.ts). Un avatar = un escenario
// confirmado de su historial (../../avatar/avatares.ts).

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp01Icon, UserAdd01Icon, UserSquareIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { useWs } from "@/app/_ui/Link";
import { conWs } from "@/lib/ws-tab";
import { Button } from "@/app/video-editor/_opencut/components/ui/button";
import { Spinner } from "@/app/video-editor/_opencut/components/ui/spinner";
import { Textarea } from "@/app/video-editor/_opencut/components/ui/textarea";
import {
	ContenidoBiblioteca,
	GrillaBiblioteca,
	VacioBiblioteca,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/views/biblioteca-ui";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { avataresAction, type AvatarParaElegir } from "@/app/video-editor/avatar/actions";
import { cancelarAvatar, generarAvatar, useAvatarIA, type EstadoAvatar } from "./generar";

type Carga =
	| { fase: "cargando" }
	| { fase: "error"; mensaje: string }
	| { fase: "listo"; avatares: AvatarParaElegir[]; voz: string };

/** El renglón de progreso: «Generando…», «Generando toma 1 de 3…», «Agregando toma 1 de 3… 40%». */
function textoProgreso(e: EstadoAvatar): string {
	if (e.fase === "planificando") return "Generando…";
	if (e.fase !== "filmando") return "";
	return e.bajando != null
		? `Agregando toma ${e.toma} de ${e.total}… ${e.bajando}%`
		: `Generando toma ${e.toma} de ${e.total}…`;
}

/** ① Elige el avatar —— ② Agregar voz */
function Pasos({ paso }: { paso: "elegir" | "voz" }) {
	const item = (n: number, rotulo: string, activo: boolean) => (
		<span className={cn("flex items-center gap-1.5 text-[12px]", activo ? "text-primary" : "text-(--cc-text-3)")}>
			<span
				className={cn(
					"flex size-4 items-center justify-center rounded-full text-[10px] font-medium",
					activo ? "bg-primary text-primary-foreground" : "bg-(--cc-btn-2) text-(--cc-text-2)",
				)}
			>
				{n}
			</span>
			{rotulo}
		</span>
	);
	return (
		<div className="flex items-center gap-3 border-b border-(--cc-line) pb-3">
			{item(1, "Elige el avatar", paso === "elegir")}
			<span className="h-px w-6 bg-(--cc-line)" />
			{item(2, "Agregar voz", paso === "voz")}
		</div>
	);
}

function TarjetaCrear() {
	const ws = useWs();
	return (
		<button
			type="button"
			className="group flex flex-col gap-1.5 text-left outline-none"
			onClick={() => window.open(conWs("/video-generator", ws), "_blank", "noopener")}
		>
			<span className="flex aspect-[3/4] w-full items-center justify-center rounded-[6px] bg-(--cc-raised) text-(--cc-text-2) group-hover:text-(--cc-text) group-focus-visible:ring-1 group-focus-visible:ring-primary">
				<HugeiconsIcon icon={UserAdd01Icon} className="size-6" strokeWidth={1.6} />
			</span>
			<span className="truncate text-center text-[11px] text-(--cc-text-2)">Crear</span>
		</button>
	);
}

function TarjetaAvatar({
	avatar,
	elegido,
	onElegir,
}: {
	avatar: AvatarParaElegir;
	elegido: boolean;
	onElegir: () => void;
}) {
	// ⚠️ La url de Flow vence a las ~6 h (escenario-reuso.ts). El avatar sigue
	// sirviendo para filmar —lo que anima es el id—, así que no se esconde: se
	// dibuja sin foto.
	const [rota, setRota] = useState(false);
	return (
		<button
			type="button"
			aria-pressed={elegido}
			title={`${avatar.lugar} · ${avatar.deAnuncio}`}
			className="group flex flex-col gap-1.5 text-left outline-none"
			onClick={onElegir}
		>
			<span
				className={cn(
					"relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-[6px] bg-(--cc-raised)",
					elegido ? "ring-2 ring-primary" : "group-hover:ring-1 group-hover:ring-(--cc-text-3)",
					"group-focus-visible:ring-1 group-focus-visible:ring-primary",
				)}
			>
				{rota ? (
					<HugeiconsIcon icon={UserSquareIcon} className="size-6 text-(--cc-text-3)" strokeWidth={1.6} />
				) : (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={avatar.url} alt="" className="size-full object-cover" onError={() => setRota(true)} />
				)}
			</span>
			<span className="truncate text-center text-[11px] text-(--cc-text-2)">{avatar.lugar}</span>
		</button>
	);
}

export function AvatarIAView() {
	const editor = useEditor();
	const paso = useAvatarIA((s) => s.paso);
	const avatarId = useAvatarIA((s) => s.avatarId);
	const guion = useAvatarIA((s) => s.guion);
	const estado = useAvatarIA((s) => s.estado);
	const { setPaso, setAvatar, setGuion } = useAvatarIA.getState();
	const [carga, setCarga] = useState<Carga>({ fase: "cargando" });
	const [abierto, setAbierto] = useState(true);

	useEffect(() => {
		let vivo = true;
		avataresAction()
			.then((r) => {
				if (!vivo) return;
				setCarga(r.ok ? { fase: "listo", avatares: r.avatares, voz: r.voz } : { fase: "error", mensaje: r.error });
			})
			.catch(() => vivo && setCarga({ fase: "error", mensaje: "No se pudieron leer los avatares" }));
		return () => {
			vivo = false;
		};
	}, []);

	const ocupado = estado.fase === "planificando" || estado.fase === "filmando";

	if (paso === "voz") {
		const voz = carga.fase === "listo" ? carga.voz : "";
		return (
			<ContenidoBiblioteca arriba={<Pasos paso="voz" />}>
				<div className="flex flex-col gap-4">
					<label className="flex flex-col gap-1.5">
						<span className="text-[12px] text-(--cc-text-2)">Guion</span>
						<Textarea
							value={guion}
							onChange={(e) => setGuion(e.target.value)}
							placeholder="Escribe lo que quieres que lea el avatar de IA"
							rows={8}
							disabled={ocupado}
							className="bg-(--cc-input) text-[12px]"
						/>
					</label>
					<div className="flex flex-col gap-1.5">
						<span className="text-[12px] text-(--cc-text-2)">Voz</span>
						<span className="rounded-[4px] bg-(--cc-input) px-3 py-2 text-[12px] text-(--cc-text)">
							{voz || "La de tu perfil"}
						</span>
					</div>

					{ocupado ? (
						<div className="flex flex-col gap-2 rounded-[6px] bg-(--cc-raised) p-3">
							<span className="flex items-center gap-2 text-[12px] text-(--cc-text)">
								<Spinner />
								{textoProgreso(estado)}
							</span>
							<span className="text-[11px] text-(--cc-text-3)">
								{estado.fase === "filmando" && estado.aCiegas
									? estado.aCiegas
									: "Es posible que la aplicación de un avatar de IA tome un tiempo."}
							</span>
							<Button variant="secondary" size="sm" className="self-start" onClick={cancelarAvatar}>
								Cancelar
							</Button>
						</div>
					) : (
						estado.fase === "error" && (
							<p className="text-[12px] text-destructive">{estado.mensaje}</p>
						)
					)}

					<div className="flex justify-end gap-2">
						<Button variant="secondary" disabled={ocupado} onClick={() => setPaso("elegir")}>
							Anterior
						</Button>
						<Button
							disabled={ocupado || !guion.trim()}
							onClick={() => void generarAvatar(editor)}
						>
							Generar
						</Button>
					</div>
				</div>
			</ContenidoBiblioteca>
		);
	}

	return (
		<ContenidoBiblioteca arriba={<Pasos paso="elegir" />}>
			<div className="flex min-h-full flex-col gap-3">
				<button
					type="button"
					className="flex items-center gap-1 self-start text-[12px] text-(--cc-text)"
					aria-expanded={abierto}
					onClick={() => setAbierto((v) => !v)}
				>
					Avatar de IA
					<HugeiconsIcon
						icon={ArrowUp01Icon}
						className={cn("size-3.5 transition-transform", !abierto && "rotate-180")}
						strokeWidth={1.8}
					/>
				</button>

				{abierto && (
					<>
						<div className="flex flex-wrap gap-2">
							<span className="rounded-full bg-(--cc-btn-2) px-3 py-1 text-[12px] text-(--cc-text)">Mis avatares</span>
						</div>

						{carga.fase === "cargando" ? (
							<div className="flex justify-center py-8">
								<Spinner className="size-6 text-muted-foreground" />
							</div>
						) : carga.fase === "error" ? (
							<VacioBiblioteca texto={carga.mensaje} />
						) : (
							<GrillaBiblioteca minimo={92}>
								<TarjetaCrear />
								{carga.avatares.map((a) => (
									<TarjetaAvatar
										key={a.id}
										avatar={a}
										elegido={a.id === avatarId}
										onElegir={() => setAvatar(a.id === avatarId ? null : a.id)}
									/>
								))}
							</GrillaBiblioteca>
						)}
						{carga.fase === "listo" && carga.avatares.length === 0 && (
							<p className="text-[11px] text-(--cc-text-3)">Todavía no tienes avatares</p>
						)}
					</>
				)}

				<div className="mt-auto flex justify-end pt-2">
					<Button
						onClick={() => {
							if (!avatarId) {
								toast.error("Selecciona un avatar de IA primero");
								return;
							}
							setPaso("voz");
						}}
					>
						Siguiente
					</Button>
				</div>
			</div>
		</ContenidoBiblioteca>
	);
}
