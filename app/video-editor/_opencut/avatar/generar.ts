// =============================================================================
// «Avatar de IA»: generar con lo del Video Generator y poner cada toma en la línea
// =============================================================================
// Pedido de Martín (14/10/2026): «implementa lo que ya tenemos en MaKo para la
// generación de videos con esa tab que tiene Capcut de "Avatar de IA"».
//
// Nada de esto genera por su cuenta. El orden es el del Video Generator:
//   1. `crearAvatarAction` arma el plan (su `generarPlanAction`, guion literal);
//   2. cada toma se manda con SU `generarTomaAction` y se sigue con SU
//      `estadoTomaAction`, cada 6 s y avisándole al puente, como WizardAnuncio;
//   3. la toma que llega se baja (../../desde/bajar.ts), se importa a Multimedia y
//      va a la línea con el ⊕ de Multimedia (`agregarMedioEnCabezal`), una detrás
//      de la otra desde donde estaba el cabezal al apretar «Generar».
//
// ⚠️ EN SERIE Y SIN REINTENTO, por plata. Cada toma es un clip que se paga: se
// manda la siguiente cuando la anterior llegó, y si una falla la cadena para ahí.
// No se reintenta sola (memoria «default: NO reintentar»): volver a apretar
// «Generar» es una decisión de la persona. Y `generarTomaAction` tiene su propio
// freno: no filma de nuevo una toma que ya está en vuelo.
//
// El estado vive en un store y no en la pestaña: cambiar de pestaña de la
// biblioteca desmonta la vista, y la generación tiene que seguir.

import { create } from "zustand";
import { toast } from "sonner";
import type { EditorCore } from "@/app/video-editor/_opencut/core";
import { crearAvatarAction } from "@/app/video-editor/avatar/actions";
import { estadoTomaAction, generarTomaAction } from "@/app/video-generator/video-action";
import { avisarPuente } from "@/app/video-generator/avisar-puente";
import { bajarVideo } from "@/app/video-editor/desde/bajar";
import { importarArchivos } from "@/app/video-editor/_opencut/media/importar";
import { agregarMedioEnCabezal } from "@/app/video-editor/_opencut/components/editor/panels/assets/views/assets";
import { roundMediaTime, TICKS_PER_SECOND } from "@/app/video-editor/_opencut/wasm";

/** Cada cuánto se pregunta por una toma: el del sondeo de WizardAnuncio. */
export const SONDEO_MS = 6000;

export type EstadoAvatar =
	| { fase: "inactivo" }
	| { fase: "planificando" }
	| {
			fase: "filmando";
			planId: string;
			toma: number;
			total: number;
			hechas: number;
			/** La toma corre en Google y no se puede leer cómo va (no es un error). */
			aCiegas?: string;
			bajando?: number;
	  }
	| { fase: "error"; mensaje: string };

type Paso = "elegir" | "voz";

type Store = {
	paso: Paso;
	avatarId: string | null;
	guion: string;
	estado: EstadoAvatar;
	setPaso: (paso: Paso) => void;
	setAvatar: (id: string | null) => void;
	setGuion: (guion: string) => void;
	setEstado: (estado: EstadoAvatar) => void;
};

export const useAvatarIA = create<Store>()((set) => ({
	paso: "elegir",
	avatarId: null,
	guion: "",
	estado: { fase: "inactivo" },
	setPaso: (paso) => set({ paso }),
	setAvatar: (avatarId) => set({ avatarId }),
	setGuion: (guion) => set({ guion }),
	setEstado: (estado) => set({ estado }),
}));

let cancelado = false;

/** Corta la cadena: no se manda la toma siguiente. La que ya salió, Google la termina igual. */
export function cancelarAvatar(): void {
	cancelado = true;
	useAvatarIA.getState().setEstado({ fase: "inactivo" });
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Espera a que la toma llegue. Devuelve su url, o un error ya escrito para la persona. */
async function esperarToma(
	planId: string,
	n: number,
	alCambiar: (aCiegas?: string) => void,
): Promise<{ url: string } | { error: string } | null> {
	for (;;) {
		if (cancelado) return null;
		const r = await estadoTomaAction(planId, n).catch(() => null);
		avisarPuente();
		if (r?.ok) {
			const e = r.estado;
			if (e.fase === "listo") return { url: e.url };
			if (e.fase === "error") return { error: e.error };
			alCambiar(e.fase === "a_ciegas" ? e.error : undefined);
		}
		await dormir(SONDEO_MS);
	}
}

export async function generarAvatar(editor: EditorCore): Promise<void> {
	const { avatarId, guion, estado, setEstado } = useAvatarIA.getState();
	if (estado.fase === "planificando" || estado.fase === "filmando") return;
	if (!avatarId) {
		toast.error("Selecciona un avatar de IA primero");
		return;
	}
	const proyecto = editor.project.getActiveOrNull()?.metadata.id;
	if (!proyecto) return;
	cancelado = false;

	// Desde dónde van las tomas: el cabezal al apretar «Generar» (en ticks).
	let cursor = editor.playback.getCurrentTime() as number;

	setEstado({ fase: "planificando" });
	const plan = await crearAvatarAction({ avatarId, guion }).catch(() => null);
	if (cancelado) return;
	if (!plan || !plan.ok) {
		const mensaje = plan ? plan.error : "No se pudo aplicar el avatar";
		setEstado({ fase: "error", mensaje });
		toast.error(mensaje);
		return;
	}

	const total = plan.tomas.length;
	let hechas = 0;
	for (const n of plan.tomas) {
		if (cancelado) return;
		const base = { fase: "filmando" as const, planId: plan.planId, toma: n, total, hechas };
		setEstado(base);

		const mandada = await generarTomaAction(plan.planId, n).catch(() => null);
		avisarPuente();
		if (!mandada || !mandada.ok) {
			const mensaje = mandada ? mandada.error : "No se pudo aplicar el avatar";
			setEstado({ fase: "error", mensaje });
			toast.error(mensaje);
			return;
		}

		const llegada = await esperarToma(plan.planId, n, (aCiegas) => setEstado({ ...base, aCiegas }));
		if (!llegada) return;
		if ("error" in llegada) {
			setEstado({ fase: "error", mensaje: llegada.error });
			toast.error(llegada.error);
			return;
		}

		// ⚠️ La toma va al proyecto donde se pidió. Si la persona abrió otro en el
		// medio, no se la pega a ese: queda en el Video Generator, que es donde vive.
		if (editor.project.getActiveOrNull()?.metadata.id !== proyecto) {
			setEstado({ fase: "error", mensaje: "Cambiaste de proyecto: el avatar quedó en el Video Generator" });
			return;
		}
		try {
			const blob = await bajarVideo(llegada.url, (pct) => setEstado({ ...base, bajando: pct }));
			const archivo = new File([blob], `Avatar de IA - toma ${n}.mp4`, { type: blob.type || "video/mp4" });
			const [medio] = await importarArchivos({ editor, files: [archivo] });
			if (!medio) throw new Error("importar");
			agregarMedioEnCabezal({ editor, asset: medio, startTime: roundMediaTime({ time: cursor }) });
			cursor += Math.round((medio.duration ?? 0) * TICKS_PER_SECOND);
		} catch {
			const mensaje = "La toma se generó pero no se pudo agregar. Está en el Video Generator.";
			setEstado({ fase: "error", mensaje });
			toast.error(mensaje);
			return;
		}
		hechas++;
	}

	setEstado({ fase: "inactivo" });
	toast.success("Tu avatar de IA está listo");
}
