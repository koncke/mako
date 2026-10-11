import { Diamond } from "lucide-react";
import { cn } from "@/app/video-editor/_opencut/utils/ui";

/** El ◇ «Fotograma clave» de CapCut: relleno en cian cuando hay uno en el cabezal. */
export function KeyframeToggle({
	isActive,
	isDisabled = false,
	title,
	onToggle,
}: {
	isActive: boolean;
	isDisabled?: boolean;
	title: string;
	onToggle: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={isActive}
			aria-label={title}
			disabled={isDisabled}
			title={title}
			onClick={onToggle}
			className="flex size-5 cursor-pointer items-center justify-center rounded-[3px] text-(--cc-icon) hover:bg-(--cc-raised) disabled:cursor-default disabled:text-(--cc-icon-off) disabled:hover:bg-transparent"
		>
			<Diamond className={cn("size-3.5", isActive && "fill-primary text-primary")} />
		</button>
	);
}
