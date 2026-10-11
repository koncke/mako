import { DefinitionRegistry } from "@/app/video-editor/_opencut/params/registry";
import type { EffectDefinition } from "@/app/video-editor/_opencut/effects/types";

export class EffectsRegistry extends DefinitionRegistry<string, EffectDefinition> {
	constructor() {
		super("effect");
	}
}

export const effectsRegistry = new EffectsRegistry();
