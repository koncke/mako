import type { RetimeConfig } from "@/app/video-editor/_opencut/timeline";
import { clampRetimeRate } from "@/app/video-editor/_opencut/retime/rate";

export function buildConstantRetime({
	rate,
	maintainPitch = false,
}: {
	rate: number;
	maintainPitch?: boolean;
}): RetimeConfig {
	return { rate: clampRetimeRate({ rate }), maintainPitch };
}
