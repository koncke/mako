"use client";

// Los tiradores del elemento elegido, como CapCut: marco blanco, un tirador
// redondo en cada esquina (escala uniforme: CapCut no estira desde el
// reproductor; el ancho y alto por separado van en «Escala» del panel) y el
// control de rotación ⟳ DEBAJO del marco. OpenCut lo tenía arriba y con
// tiradores en los lados; el controlador de rotación mide el ángulo contra el
// centro, así que la posición del control no cambia la cuenta.

import { usePreviewViewport } from "@/app/video-editor/_opencut/preview/components/preview-viewport";
import { useTransformHandles } from "@/app/video-editor/_opencut/preview/hooks/use-transform-handles";
import { isVisualElement } from "@/app/video-editor/_opencut/timeline/element-utils";
import {
	getCornerPosition,
	getEdgeHandlePosition,
	ROTATION_HANDLE_OFFSET,
	type Corner,
	type Edge,
} from "@/app/video-editor/_opencut/preview/element-bounds";
import type { OnSnapLinesChange } from "@/app/video-editor/_opencut/preview/hooks/use-preview-interaction";
import {
	BoundingBoxOutline,
	CornerHandle,
	EdgeHandle,
	IconHandle,
	getResizeCursor,
} from "./handle-primitives";
import { RotateClockwiseIcon } from "@hugeicons/core-free-icons";

const CORNERS: Corner[] = [
	"top-left",
	"top-right",
	"bottom-left",
	"bottom-right",
];
// Sin tiradores de lado (ver arriba). El controlador los sigue soportando.
const EDGES: Edge[] = [];

export function TransformHandles({
	onSnapLinesChange,
}: {
	onSnapLinesChange?: OnSnapLinesChange;
}) {
	const viewport = usePreviewViewport();
	const {
		selectedWithBounds,
		hasVisualSelection,
		handleCornerPointerDown,
		handleEdgePointerDown,
		handleRotationPointerDown,
		handlePointerMove,
		handlePointerUp,
	} = useTransformHandles({ onSnapLinesChange });

	if (!hasVisualSelection || !selectedWithBounds) return null;

	const { bounds, element } = selectedWithBounds;
	if (!isVisualElement(element)) return null;

	const displayScale = viewport.getDisplayScale();

	const toOverlay = ({
		canvasX,
		canvasY,
	}: {
		canvasX: number;
		canvasY: number;
	}) =>
		viewport.canvasToOverlay({
			canvasX,
			canvasY,
		});

	const center = toOverlay({ canvasX: bounds.cx, canvasY: bounds.cy });
	const outlineWidth = Math.abs(bounds.width) * displayScale.x;
	const outlineHeight = Math.abs(bounds.height) * displayScale.y;

	// El centro del borde de ABAJO (rotado con el elemento) y, desde ahí, el
	// control de rotación a ROTATION_HANDLE_OFFSET px de pantalla hacia afuera.
	// Con escala negativa (reflejado) el «abajo» del marco sigue siendo abajo.
	const rotationAngleRad = (bounds.rotation * Math.PI) / 180;
	const bottomCenterLocalY = Math.abs(bounds.height) / 2;
	const bottomCenterScreen = toOverlay({
		canvasX: bounds.cx - bottomCenterLocalY * Math.sin(rotationAngleRad),
		canvasY: bounds.cy + bottomCenterLocalY * Math.cos(rotationAngleRad),
	});
	const rotationHandleScreen = {
		x: bottomCenterScreen.x - Math.sin(rotationAngleRad) * ROTATION_HANDLE_OFFSET,
		y: bottomCenterScreen.y + Math.cos(rotationAngleRad) * ROTATION_HANDLE_OFFSET,
	};

	const onPointerMove = (event: React.PointerEvent) =>
		handlePointerMove({ event });
	const onPointerUp = () => handlePointerUp();

	return (
		<div
			className="pointer-events-none absolute inset-0 overflow-hidden"
			aria-hidden
		>
			<BoundingBoxOutline
				center={center}
				outlineWidth={outlineWidth}
				outlineHeight={outlineHeight}
				rotation={bounds.rotation}
			/>
			{CORNERS.map((corner) => {
				const cornerPosition = getCornerPosition({ bounds, corner });
				const screen = toOverlay({
					canvasX: cornerPosition.x,
					canvasY: cornerPosition.y,
				});
				const angleDeg =
					Math.atan2(screen.y - center.y, screen.x - center.x) *
					(180 / Math.PI);
				return (
					<CornerHandle
						key={corner}
						cursor={getResizeCursor({ angleDeg })}
						screen={screen}
						onPointerDown={(event) =>
							handleCornerPointerDown({ event, corner })
						}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
					/>
				);
			})}
			{EDGES.map((edge) => {
				const edgePosition = getEdgeHandlePosition({ bounds, edge });
				const screen = toOverlay({
					canvasX: edgePosition.x,
					canvasY: edgePosition.y,
				});
				return (
					<EdgeHandle
						key={edge}
						edge={edge}
						screen={screen}
						rotation={bounds.rotation}
						onPointerDown={(event) => handleEdgePointerDown({ event, edge })}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
					/>
				);
			})}
			<IconHandle
				icon={RotateClockwiseIcon}
				screen={rotationHandleScreen}
				onPointerDown={(event) => handleRotationPointerDown({ event })}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
			/>
		</div>
	);
}
