"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/app/video-editor/_opencut/utils/ui";

const Slider = React.forwardRef<
	React.ElementRef<typeof SliderPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
		className?: string;
	}
>(({ className, ...props }, ref) => (
	<SliderPrimitive.Root
		ref={ref}
		className={cn(
			"relative flex w-full touch-none items-center select-none",
			className,
		)}
		{...props}
	>
		<SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-(--cc-btn-2)">
			<SliderPrimitive.Range className="absolute h-full bg-(--cc-text)" />
		</SliderPrimitive.Track>
		<SliderPrimitive.Thumb className="block size-3 cursor-pointer rounded-full bg-white shadow-sm focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50" />
	</SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
