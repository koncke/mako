import { cn } from "@/app/video-editor/_opencut/utils/ui";

function Skeleton({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("bg-primary/10 animate-pulse rounded-md", className)}
			{...props}
		/>
	);
}

export { Skeleton };
