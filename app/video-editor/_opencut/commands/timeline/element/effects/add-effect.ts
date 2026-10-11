import { Command, type CommandResult } from "@/app/video-editor/_opencut/commands/base-command";
import { EditorCore } from "@/app/video-editor/_opencut/core";
import { isVisualElement, updateElementInSceneTracks } from "@/app/video-editor/_opencut/timeline";
import type { SceneTracks, VisualElement } from "@/app/video-editor/_opencut/timeline";
import type { ParamValues } from "@/app/video-editor/_opencut/params";
import { buildDefaultEffectInstance, effectsRegistry } from "@/app/video-editor/_opencut/effects";

function grupoDe(effectType: string): string | undefined {
	return effectsRegistry.has(effectType) ? effectsRegistry.get(effectType).grupoUnico : undefined;
}

function addEffectToElement({
	element,
	effectType,
	params,
}: {
	element: VisualElement;
	effectType: string;
	params?: ParamValues;
}): VisualElement {
	const base = buildDefaultEffectInstance({ effectType });
	// Una tarjeta con params propios (una LUT, un predefinido) entra ya cargada.
	const instance = params ? { ...base, params: { ...base.params, ...params } } : base;
	const currentEffects = element.effects ?? [];
	// Como CapCut: un clip tiene un solo filtro (o un ajuste, o un croma); el
	// nuevo reemplaza al anterior en su lugar («Se reemplazó el filtro»).
	const grupo = grupoDe(effectType);
	const previo = grupo ? currentEffects.findIndex((e) => grupoDe(e.type) === grupo) : -1;
	if (previo >= 0) {
		const effects = currentEffects.slice();
		effects[previo] = instance;
		return { ...element, effects };
	}
	return { ...element, effects: [...currentEffects, instance] };
}

export class AddClipEffectCommand extends Command {
	private savedState: SceneTracks | null = null;
	private effectId: string | null = null;
	private readonly trackId: string;
	private readonly elementId: string;
	private readonly effectType: string;
	private readonly params: ParamValues | undefined;

	constructor({
		trackId,
		elementId,
		effectType,
		params,
	}: {
		trackId: string;
		elementId: string;
		effectType: string;
		params?: ParamValues;
	}) {
		super();
		this.trackId = trackId;
		this.elementId = elementId;
		this.effectType = effectType;
		this.params = params;
	}

	execute(): CommandResult | undefined {
		const editor = EditorCore.getInstance();
		this.savedState = editor.scenes.getActiveScene().tracks;

		const updatedTracks = updateElementInSceneTracks({
			tracks: this.savedState,
			trackId: this.trackId,
			elementId: this.elementId,
			elementPredicate: isVisualElement,
		update: (element) => {
			const updated = addEffectToElement({
				element: element as VisualElement,
				effectType: this.effectType,
				params: this.params,
			});
				// El agregado puede haber reemplazado a otro en su lugar: es el que no estaba.
				const antes = new Set(((element as VisualElement).effects ?? []).map((e) => e.id));
				this.effectId = (updated.effects ?? []).find((e) => !antes.has(e.id))?.id ?? null;
				return updated;
			},
		});

		editor.timeline.updateTracks(updatedTracks);
		return undefined;
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}

	getEffectId(): string | null {
		return this.effectId;
	}
}
