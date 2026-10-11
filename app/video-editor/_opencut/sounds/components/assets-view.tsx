"use client";

// =============================================================================
// La pestaña Audio de la biblioteca: Importar · Extraer audio · Música · Efectos de sonido
// =============================================================================
// Sólo audio PROPIO (decisión 7 de docs/diseno-editor-video.md): lo que el usuario
// importa o lo que saca de sus videos. Música y Efectos de sonido quedan con un
// estado vacío de una frase hasta tener una biblioteca con licencia comercial
// (Epidemic Connect o un pack CC0 propio): una pista sin licencia es un reclamo de
// copyright sobre la campaña del cliente. La API de Freesound que traía OpenCut
// (`/api/sounds/search`) se sacó: sus términos prohíben el uso «service bureau» y
// su filtro «solo comercial» dejaba pasar sonidos no comerciales.

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { MusicNote03Icon, PauseIcon, PlayIcon, Video01Icon } from "@hugeicons/core-free-icons";
import {
	BotonAgregar,
	useArrastreLinea,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/draggable-item";
import { useAssetsPanelStore } from "@/app/video-editor/_opencut/components/editor/panels/assets/assets-panel-store";
import {
	agregarMedioEnCabezal,
	idsMediosEnLinea,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/views/assets";
import {
	ContenidoBiblioteca,
	TituloGrupo,
	VacioBiblioteca,
	ZonaImportar,
	formatearDuracion,
} from "@/app/video-editor/_opencut/components/editor/panels/assets/views/biblioteca-ui";
import { useEditor } from "@/app/video-editor/_opencut/editor/use-editor";
import { importarArchivos, useImportarArchivos } from "@/app/video-editor/_opencut/media/importar";
import type { MediaAsset } from "@/app/video-editor/_opencut/media/types";
import { useFileUpload } from "@/app/video-editor/_opencut/media/use-file-upload";
import { cn } from "@/app/video-editor/_opencut/utils/ui";
import { SinAudioError, extraerAudio } from "./extraer-audio";

export const SECCION_AUDIO_IMPORTAR = "audio.importar";

// ── Previsualizar (un solo audio sonando a la vez) ───────────────────────────

function useEscuchar() {
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const [sonando, setSonando] = useState<string | null>(null);

	const detener = useCallback(() => {
		audioRef.current?.pause();
		setSonando(null);
	}, []);

	const alternar = useCallback(
		(id: string, url: string | undefined) => {
			if (!url) return;
			if (sonando === id) {
				detener();
				return;
			}
			if (!audioRef.current) {
				audioRef.current = new Audio();
				audioRef.current.addEventListener("ended", () => setSonando(null));
			}
			const audio = audioRef.current;
			audio.src = url;
			audio.currentTime = 0;
			void audio.play().catch(() => setSonando(null));
			setSonando(id);
		},
		[sonando, detener],
	);

	// Al cambiar de sección o cerrar el panel, se calla.
	useEffect(() => () => audioRef.current?.pause(), []);

	return { sonando, alternar, detener };
}

// ── Audio › Importar ─────────────────────────────────────────────────────────

export function AudioImportarView() {
	const assets = useEditor((e) => e.media.getAssets());
	const usados = useEditor(idsMediosEnLinea);
	const audios = useMemo(
		() => assets.filter((a) => a.type === "audio" && !a.ephemeral),
		[assets],
	);
	const usadosSet = useMemo(() => new Set(usados), [usados]);
	const { importar, procesando, progreso } = useImportarArchivos();
	const { isDragOver, dragProps, openFilePicker, fileInputProps } = useFileUpload({
		accept: "audio/*",
		multiple: true,
		onFilesSelected: (files) => void importar({ files, soloTipo: "audio" }),
	});
	const { sonando, alternar } = useEscuchar();

	return (
		<ContenidoBiblioteca {...dragProps}>
			<input {...fileInputProps} />
			<ZonaImportar
				texto="Arrastra y suelta los archivos de audio aquí"
				onClick={openFilePicker}
				procesando={procesando}
				progreso={progreso}
				resaltada={isDragOver}
				compacta={audios.length > 0}
			/>
			{audios.length > 0 && (
				<div className="mt-3 flex flex-col gap-0.5">
					{audios.map((asset) => (
						<RenglonAudio
							key={asset.id}
							asset={asset}
							agregado={usadosSet.has(asset.id)}
							sonando={sonando === asset.id}
							onEscuchar={() => alternar(asset.id, asset.url)}
						/>
					))}
				</div>
			)}
		</ContenidoBiblioteca>
	);
}

function RenglonAudio({
	asset,
	agregado,
	sonando,
	onEscuchar,
}: {
	asset: MediaAsset;
	agregado: boolean;
	sonando: boolean;
	onEscuchar: () => void;
}) {
	const editor = useEditor();
	const portada = (
		<div className="flex size-full items-center justify-center bg-[var(--cc-clip-audio)] text-[var(--cc-text)]">
			<HugeiconsIcon icon={MusicNote03Icon} className="size-5" />
		</div>
	);
	const { arrastrando, props, fantasma } = useArrastreLinea({
		dragData: { id: asset.id, type: "media", mediaType: "audio", name: asset.name },
		fantasma: portada,
	});

	return (
		<div
			className="group flex h-12 cursor-default items-center gap-2.5 rounded-[4px] px-1.5 hover:bg-[var(--cc-raised)]/50"
			{...props}
		>
			<button
				type="button"
				aria-label={sonando ? "Pausar" : "Reproducir"}
				title={sonando ? "Pausar" : "Reproducir"}
				onClick={onEscuchar}
				className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-[4px]"
			>
				{portada}
				<span
					className={cn(
						"absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity",
						sonando ? "opacity-100" : "opacity-0 group-hover:opacity-100",
					)}
				>
					<HugeiconsIcon icon={sonando ? PauseIcon : PlayIcon} className="size-4" />
				</span>
			</button>
			<div className="min-w-0 flex-1">
				<div className={cn("truncate text-[12px]", sonando ? "text-primary" : "text-[var(--cc-text)]")} title={asset.name}>
					{asset.name}
				</div>
				<div className="text-[11px] text-[var(--cc-text-3)] tabular-nums">
					{formatearDuracion(asset.duration)}
					{agregado && <span className="ml-2">Agregado</span>}
				</div>
			</div>
			{!arrastrando && (
				<BotonAgregar
					className="relative right-auto bottom-auto mr-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
					onClick={() =>
						agregarMedioEnCabezal({
							editor,
							asset,
							startTime: editor.playback.getCurrentTime(),
						})
					}
				/>
			)}
			{fantasma}
		</div>
	);
}

// ── Audio › Extraer audio ────────────────────────────────────────────────────

export function ExtraerAudioView() {
	const editor = useEditor();
	const assets = useEditor((e) => e.media.getAssets());
	const videos = useMemo(
		() => assets.filter((a) => a.type === "video" && !a.ephemeral && a.hasAudio !== false),
		[assets],
	);
	const irA = useAssetsPanelStore((s) => s.irA);
	const [extrayendo, setExtrayendo] = useState<string | null>(null);
	const [progreso, setProgreso] = useState(0);

	const extraer = useCallback(
		async ({ file, clave }: { file: File; clave: string }) => {
			if (extrayendo) return;
			setExtrayendo(clave);
			setProgreso(0);
			try {
				await toast
					.promise(
						(async () => {
							const audio = await extraerAudio({ file, onProgress: setProgreso });
							const creados = await importarArchivos({ editor, files: [audio] });
							if (creados.length === 0) throw new Error("no se guardó el audio");
							return creados;
						})(),
						{
							loading: "Extrayendo audio…",
							success: "Extraído",
							error: (error) =>
								error instanceof SinAudioError
									? "No se puede separar el audio"
									: "No se pudo importar",
						},
					)
					.unwrap();
				// Lo extraído se ve donde vive: Audio › Importar.
				irA({ categoria: "audio", seccion: SECCION_AUDIO_IMPORTAR });
			} catch (error) {
				if (!(error instanceof SinAudioError)) {
					console.error("[extraer audio]", error);
				}
			} finally {
				setExtrayendo(null);
				setProgreso(0);
			}
		},
		[editor, extrayendo, irA],
	);

	const { isDragOver, dragProps, openFilePicker, fileInputProps } = useFileUpload({
		accept: "video/*",
		multiple: false,
		onFilesSelected: (files) => {
			const file = files[0];
			if (file) void extraer({ file, clave: "archivo" });
		},
	});

	return (
		<ContenidoBiblioteca {...dragProps}>
			<input {...fileInputProps} />
			<ZonaImportar
				texto="Extraer audio de un video"
				onClick={openFilePicker}
				procesando={extrayendo === "archivo"}
				progreso={progreso}
				rotuloProcesando="Extrayendo audio…"
				resaltada={isDragOver}
				compacta={videos.length > 0}
			/>
			{videos.length > 0 && (
				<div className="mt-4">
					<TituloGrupo>Archivos multimedia importados</TituloGrupo>
					<div className="flex flex-col gap-0.5">
						{videos.map((video) => {
							const esteSale = extrayendo === video.id;
							return (
								<div
									key={video.id}
									className="flex h-12 items-center gap-2.5 rounded-[4px] px-1.5 hover:bg-[var(--cc-raised)]/50"
								>
									<div className="relative size-9 shrink-0 overflow-hidden rounded-[4px] bg-[var(--cc-sunken)]">
										{video.thumbnailUrl ? (
											<Image
												src={video.thumbnailUrl}
												alt=""
												fill
												sizes="36px"
												draggable={false}
												className="object-cover"
												unoptimized
											/>
										) : (
											<span className="flex size-full items-center justify-center text-[var(--cc-text-3)]">
												<HugeiconsIcon icon={Video01Icon} className="size-4" />
											</span>
										)}
									</div>
									<div className="min-w-0 flex-1">
										<div className="truncate text-[12px] text-[var(--cc-text)]" title={video.name}>
											{video.name}
										</div>
										<div className="text-[11px] text-[var(--cc-text-3)] tabular-nums">
											{esteSale
												? `Extrayendo audio… ${progreso} %`
												: formatearDuracion(video.duration)}
										</div>
									</div>
									<button
										type="button"
										disabled={extrayendo !== null}
										onClick={() => void extraer({ file: video.file, clave: video.id })}
										className="h-7 shrink-0 cursor-pointer rounded-[4px] bg-[var(--cc-raised)] px-2.5 text-[12px] text-[var(--cc-text)] hover:bg-[var(--cc-btn-2)] disabled:cursor-default disabled:opacity-50"
									>
										Extraer
									</button>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</ContenidoBiblioteca>
	);
}

// ── Audio › Música y Efectos de sonido: sin biblioteca con licencia todavía ──

function SinLicencia({ texto }: { texto: string }) {
	const irA = useAssetsPanelStore((s) => s.irA);
	return (
		<VacioBiblioteca texto={texto}>
			<button
				type="button"
				onClick={() => irA({ categoria: "audio", seccion: SECCION_AUDIO_IMPORTAR })}
				className="h-7 cursor-pointer rounded-[4px] bg-[var(--cc-raised)] px-3 text-[12px] text-[var(--cc-text)] hover:bg-[var(--cc-btn-2)]"
			>
				Importar
			</button>
		</VacioBiblioteca>
	);
}

export function MusicaView() {
	return <SinLicencia texto="Aún no hay música con licencia: importa la tuya." />;
}

export function EfectosDeSonidoView() {
	return <SinLicencia texto="Aún no hay efectos de sonido con licencia: importa los tuyos." />;
}
