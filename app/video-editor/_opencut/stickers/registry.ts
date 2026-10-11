import type { StickerProvider } from "@/app/video-editor/_opencut/stickers/types";
import { DefinitionRegistry } from "@/app/video-editor/_opencut/params/registry";

export class StickersRegistry extends DefinitionRegistry<string, StickerProvider> {
	constructor() {
		super("sticker provider");
	}
}

export const stickersRegistry = new StickersRegistry();
