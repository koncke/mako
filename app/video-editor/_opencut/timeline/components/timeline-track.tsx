"use client";

import { Clapperboard } from "lucide-react";
import { useElementSelection } from "@/app/video-editor/_opencut/timeline/hooks/element/use-element-selection";
import { TimelineElement } from "./timeline-element";
import type { TimelineTrack } from "@/app/video-editor/_opencut/timeline";
import type { TimelineElement as TimelineElementType } from "@/app/video-editor/_opencut/timeline";
import { TIMELINE_LAYERS } from "./layers";
import type { ElementDragView } from "@/app/video-editor/_opencut/timeline";
import { tipoDePista } from "./cabecera-pista";

interface TimelineTrackContentProps {
	track: TimelineTrack;
	isMain?: boolean;
	/** La línea entera está vacía: la principal muestra «Arrastra el material aquí…». */
	mostrarVacio?: boolean;
	zoomLevel: number;
	dragView: ElementDragView;
	onResizeStart: (params: {
		event: React.MouseEvent;
		element: TimelineElementType;
		track: TimelineTrack;
		side: "left" | "right";
	}) => void;
	onElementMouseDown: (params: {
		event: React.MouseEvent;
		element: TimelineElementType;
		track: TimelineTrack;
	}) => void;
	onElementClick: (params: {
		event: React.MouseEvent;
		element: TimelineElementType;
		track: TimelineTrack;
	}) => void;
	onTrackMouseDown?: (event: React.MouseEvent) => void;
	onTrackMouseUp?: (event: React.MouseEvent) => void;
	shouldIgnoreClick?: () => boolean;
	targetElementId?: string | null;
}

export function TimelineTrackContent({
	track,
	isMain = false,
	mostrarVacio = false,
	zoomLevel,
	dragView,
	onResizeStart,
	onElementMouseDown,
	onElementClick,
	onTrackMouseDown,
	onTrackMouseUp,
	shouldIgnoreClick,
	targetElementId = null,
}: TimelineTrackContentProps) {
	const { isElementSelected } = useElementSelection();
	const { nombre } = tipoDePista({ track, isMain });

	return (
		<div className="relative size-full">
			<button
				type="button"
				className="absolute inset-0 m-0 size-full appearance-none border-0 bg-transparent p-0"
				aria-label={nombre}
				onMouseUp={(event) => {
					if (shouldIgnoreClick?.()) return;
					onTrackMouseUp?.(event);
				}}
				onMouseDown={(event) => {
					event.preventDefault();
					onTrackMouseDown?.(event);
				}}
			/>
			{/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- spatial gesture surface; the wrapping <button> handles keyboard track selection, this <div> only forwards background clicks for box-select / deselect. */}
			<div
				className="relative h-full min-w-full"
				style={{ zIndex: TIMELINE_LAYERS.trackContent }}
				onMouseUp={(event) => {
					if (event.target !== event.currentTarget) return;
					if (shouldIgnoreClick?.()) return;
					onTrackMouseUp?.(event);
				}}
				onMouseDown={(event) => {
					if (event.target !== event.currentTarget) return;
					event.preventDefault();
					onTrackMouseDown?.(event);
				}}
			>
				{track.elements.length === 0 ? (
					mostrarVacio ? (
						<div className="pointer-events-none absolute inset-1 flex items-center justify-center gap-2 rounded-[6px] border border-dashed border-(--cc-text-3)/60 text-xs text-(--cc-text-3)">
							<Clapperboard className="size-4" />
							Arrastra el material aquí y empieza a crear
						</div>
					) : null
				) : (
					track.elements.map((element) => {
						const isSelected = isElementSelected({
							trackId: track.id,
							elementId: element.id,
						});

						return (
							<TimelineElement
								key={element.id}
								element={element}
								track={track}
								isMain={isMain}
								zoomLevel={zoomLevel}
								isSelected={isSelected}
								onResizeStart={({ event, element, side }) =>
									onResizeStart({ event, element, track, side })
								}
								onElementMouseDown={({ event, element }) =>
									onElementMouseDown({ event, element, track })
								}
								onElementClick={({ event, element }) =>
									onElementClick({ event, element, track })
								}
								dragView={dragView}
								isDropTarget={element.id === targetElementId}
							/>
						);
					})
				)}
			</div>
			{/* Pista bloqueada: rayado encima y los clips no reciben el mouse. */}
			{track.locked && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0"
					style={{
						zIndex: TIMELINE_LAYERS.trackContent + 1,
						backgroundImage:
							"repeating-linear-gradient(135deg, rgb(0 0 0 / 0.28) 0 6px, transparent 6px 12px)",
					}}
				/>
			)}
		</div>
	);
}
