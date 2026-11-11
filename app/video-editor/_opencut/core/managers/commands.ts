import type { EditorCore } from "@/app/video-editor/_opencut/core";
import type { Command, CommandResult } from "@/app/video-editor/_opencut/commands";
import type { EditorSelectionSnapshot } from "@/app/video-editor/_opencut/selection/editor-selection";
import type { SceneTracks } from "@/app/video-editor/_opencut/timeline/types";

interface CommandHistoryEntry {
	command: Command;
	previousSelection: EditorSelectionSnapshot;
	selectionOverride?: EditorSelectionSnapshot;
}

/**
 * Cuántos pasos se pueden deshacer. Antes no había tope: cada paso guarda una versión de las pistas, y subtítulos, emojis,
 * B-roll y el chat rehacen pistas enteras (docs/editor-video/memoria-del-editor.md §5). Pasado el tope se olvida el más
 * viejo.
 */
export const MAX_PASOS_DESHACER = 200;

export class CommandManager {
	public isRippleEnabled = false;
	private history: CommandHistoryEntry[] = [];
	/** Los pasos que se olvidaron por el tope: `profundidad()` los sigue contando (ver ahí). */
	private olvidados = 0;
	private redoStack: CommandHistoryEntry[] = [];
	private reactors: Array<() => void> = [];

	constructor(private editor: EditorCore) {}

	execute({ command }: { command: Command }): Command {
		const beforeTracks = this.isRippleEnabled
			? (this.editor.scenes.getActiveSceneOrNull()?.tracks ?? null)
			: null;
		const previousSelection = this.getSelectionSnapshot();
		const result = command.execute();
		this.applyRippleIfEnabled({ beforeTracks });
		const selectionOverride = this.applySelectionOverride(result);
		this.runReactors();
		this.history.push({
			command,
			previousSelection,
			selectionOverride,
		});
		this.recortar();
		this.redoStack = [];
		return command;
	}

	push({ command }: { command: Command }): void {
		this.history.push({
			command,
			previousSelection: this.getSelectionSnapshot(),
		});
		this.recortar();
		this.redoStack = [];
	}

	private recortar(): void {
		while (this.history.length > MAX_PASOS_DESHACER) {
			this.history.shift();
			this.olvidados++;
		}
	}

	registerReactor(reactor: () => void): void {
		this.reactors.push(reactor);
	}

	undo(): void {
		if (this.history.length === 0) return;
		const entry = this.history.pop();
		entry?.command.undo();
		if (entry) {
			// Only restore selection for commands that explicitly changed it.
			// Commands without selection intent leave selection untouched,
			// preserving any UI-driven selection changes (clicks, box select)
			// that happened between commands. Commands that remove editor-owned
			// selection targets must declare a selection override to clear stale refs.
			if (entry.selectionOverride !== undefined) {
				this.editor.selection.restoreSnapshot({
					snapshot: entry.previousSelection,
				});
			}
			this.redoStack.push(entry);
		}
	}

	redo(): void {
		if (this.redoStack.length === 0) return;
		const entry = this.redoStack.pop();
		if (!entry) {
			return;
		}

		const beforeTracks = this.isRippleEnabled
			? (this.editor.scenes.getActiveSceneOrNull()?.tracks ?? null)
			: null;
		const previousSelection = this.getSelectionSnapshot();
		const result = entry.command.redo();
		this.applyRippleIfEnabled({ beforeTracks });
		const selectionOverride = this.applySelectionOverride(result);
		this.runReactors();

		this.history.push({
			command: entry.command,
			previousSelection,
			selectionOverride,
		});
		this.recortar();
	}

	canUndo(): boolean {
		return this.history.length > 0;
	}

	canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	/**
	 * Cuántos pasos hay para deshacer. La «Edición automática» (enjambre/correr.ts) los cuenta antes y después de
	 * correr: sus agentes dejan un paso cada uno (algunos, más), y «Deshacer todo» deshace exactamente ésos.
	 */
	profundidad(): number {
		// Con los olvidados por el tope: si no, con el historial lleno, correr 10 agentes dejaba la cuenta igual (entra uno,
		// sale el más viejo) y «Deshacer todo» no deshacía nada.
		return this.olvidados + this.history.length;
	}

	/**
	 * Vacía «Rehacer». La prueba de estilos de la «Edición automática» aplica un estilo, lo mide y lo deshace: sin esto,
	 * Ctrl+Y volvía a poner un estilo descartado.
	 */
	olvidarRehacer(): void {
		this.redoStack = [];
	}

	clear(): void {
		this.history = [];
		this.redoStack = [];
		this.olvidados = 0;
	}

	private getSelectionSnapshot(): EditorSelectionSnapshot {
		return this.editor.selection.getSnapshot();
	}

	private applySelectionOverride(
		result: CommandResult | undefined,
	): EditorSelectionSnapshot | undefined {
		if (!result?.selection) {
			return undefined;
		}
		return this.editor.selection.applySelectionPatch({
			patch: result.selection,
		});
	}

	private runReactors(): void {
		for (const reactor of this.reactors) {
			reactor();
		}
	}

	private applyRippleIfEnabled(_: { beforeTracks: SceneTracks | null }): void {
		// El ripple de OpenCut corría los clips de TODAS las pistas. En la copia
		// de CapCut lo reemplaza el imán de la pista principal + la vinculación,
		// que corre en `timeline.updateTracks` (ripple/iman.ts) para cubrir
		// también `commitPreview`, que no pasa por acá.
	}
}
