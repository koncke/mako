// El marco que usaban las vistas de OpenCut (título + acciones arriba, contenido
// desplazable). En CapCut el contenido de la biblioteca NO lleva título: lo dice
// la columna de subcategorías. Se conserva la API para las vistas que todavía lo
// usan (effects/, subtitles/), pero la cabecera sólo aparece si trae acciones, y
// con las medidas y colores de CapCut. Lo nuevo va con ContenidoBiblioteca
// (./biblioteca-ui.tsx).

import { cn } from "@/app/video-editor/_opencut/utils/ui";

interface PanelViewProps extends React.HTMLAttributes<HTMLDivElement> {
	title?: string;
	actions?: React.ReactNode;
	children: React.ReactNode;
	contentClassName?: string;
	scrollClassName?: string;
	hideHeader?: boolean;
	ref?: React.Ref<HTMLDivElement>;
	onScroll?: React.UIEventHandler<HTMLDivElement>;
	scrollRef?: React.Ref<HTMLDivElement>;
}

export function PanelView({
	title,
	actions,
	children,
	className,
	contentClassName,
	scrollClassName,
	hideHeader = false,
	ref,
	onScroll,
	scrollRef,
	...rest
}: PanelViewProps) {
	const conCabecera = !hideHeader && Boolean(actions);
	return (
		<div
			className={cn("relative flex h-full flex-col", className)}
			ref={ref}
			aria-label={title}
			{...rest}
		>
			{conCabecera && (
				<div className="flex h-10 shrink-0 items-center justify-between gap-2 pr-2 pl-3">
					{title && (
						<span className="truncate text-[12px] text-[var(--cc-text-2)]">{title}</span>
					)}
					{actions}
				</div>
			)}
			<div
				className={cn(
					"scrollbar-thin size-full overflow-y-auto",
					conCabecera ? "pt-1" : "pt-3",
					scrollClassName,
				)}
				ref={scrollRef}
				onScroll={onScroll}
			>
				<div className={cn("w-full flex-1 px-3 pt-0 pb-3", contentClassName)}>
					{children}
				</div>
			</div>
		</div>
	);
}
