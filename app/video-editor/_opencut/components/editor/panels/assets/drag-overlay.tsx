// La capa «soltar archivos aquí» de OpenCut. La biblioteca ya no la usa (dibuja
// la zona punteada de CapCut, `ZonaImportar` en ./views/biblioteca-ui.tsx); se
// conserva la exportación para quien todavía la importe, dibujando lo mismo.

import { ZonaImportar } from "./views/biblioteca-ui";
import { TEXTO_ZONA_MEDIOS } from "./views/assets";

interface MediaDragOverlayProps {
	isVisible: boolean;
	isProcessing?: boolean;
	progress?: number;
	onClick?: () => void;
}

export function MediaDragOverlay({
	isVisible,
	isProcessing = false,
	progress = 0,
	onClick,
}: MediaDragOverlayProps) {
	if (!isVisible) return null;
	return (
		<ZonaImportar
			texto={TEXTO_ZONA_MEDIOS}
			onClick={() => onClick?.()}
			procesando={isProcessing}
			progreso={progress}
		/>
	);
}
