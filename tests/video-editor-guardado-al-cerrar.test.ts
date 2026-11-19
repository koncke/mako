// =============================================================================
// Ticket 118: al salir de un proyecto, el guardado automático tiraba «No active project»
// =============================================================================
// Leila (19/11/2026, 15:58, en /video-editor?ver=…). La pila de producción (errores_app 14): `getActive` ← `saveNow` ← el
// temporizador del guardado. No se rompió el dibujo: fue una promesa que nadie esperó (app/_components/ReportarErrores.tsx la
// reporta como «la pantalla se rompió»).
//
// La secuencia, siempre igual, al salir de un proyecto («Volver», «volver-inicio», una plantilla nueva):
//   closeProject → `active = null` → `scenes.clearScenes()` avisa → el guardado lo toma como un cambio (`markDirty`) →
//   800 ms después `saveNow` llama a `getActive()`, que TIRA sin proyecto (el `if (!activeProject) return` de abajo nunca
//   llegaba: esperaba un null). Y quedaba «sucio» para siempre: el navegador preguntaba «¿salir sin guardar?» en la lista.
// Lo mismo con un `?ver=` de un proyecto que no existe: la carga falla, y al reanudar el guardado salta lo pendiente.
//
// Probado rompiéndolo (19/11/2026): con el save-manager de antes, fallan 1 y 2 (la promesa rechazada con «No active project»
// y el «sucio» que no se va); sin el flush de `prepareExit`, falla 4.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SaveManager } from '../app/video-editor/_opencut/core/managers/save-manager';

type Oyente = () => void;
const avisador = () => {
	const oyentes = new Set<Oyente>();
	return {
		subscribe: (f: Oyente) => { oyentes.add(f); return () => oyentes.delete(f); },
		notify: () => { for (const f of oyentes) f(); },
	};
};

/** El editor mínimo que mira el guardado, con el `getActive` y el `closeProject` del motor (project-manager.ts), en su orden. */
function editorDePrueba() {
	let active: { id: string } | null = null;
	let guardados = 0;
	const scenes = avisador();
	const timeline = avisador();
	const project = {
		getActive() { if (!active) throw new Error('No active project'); return active; },
		getActiveOrNull: () => active,
		getIsLoading: () => false,
		getMigrationState: () => ({ isMigrating: false }),
		async saveCurrentProject() { if (active) guardados += 1; },
	};
	const editor = { project, scenes, timeline };
	const save = new SaveManager({ editor: editor as never, debounceMs: 5 });
	return {
		save,
		abrir: () => { active = { id: 'p1' }; },
		/** Lo que hace `ProjectManager.closeProject`: suelta el proyecto y DESPUÉS limpia las escenas (que avisan). */
		cerrar: () => { active = null; scenes.notify(); },
		editar: () => timeline.notify(),
		avisarEscenas: () => scenes.notify(),
		guardados: () => guardados,
	};
}

/** Corre `f`, espera a que pase el guardado diferido y devuelve las promesas rechazadas que nadie esperó. */
async function rechazosDurante(f: () => void): Promise<unknown[]> {
	const rechazos: unknown[] = [];
	const atrapar = (e: unknown) => { rechazos.push(e); };
	process.on('unhandledRejection', atrapar);
	try {
		f();
		await new Promise((r) => setTimeout(r, 60));
	} finally {
		process.off('unhandledRejection', atrapar);
	}
	return rechazos;
}

test('1. ticket 118: salir del proyecto no deja un guardado que tire «No active project», ni la marca de «sin guardar»', async () => {
	const e = editorDePrueba();
	e.save.start();
	e.abrir();
	const rechazos = await rechazosDurante(() => e.cerrar());
	assert.deepEqual(rechazos.map(String), []);
	assert.equal(e.guardados(), 0, 'sin proyecto no hay nada que guardar');
	assert.equal(e.save.getIsDirty(), false, 'la lista de proyectos no pregunta «¿salir sin guardar?»');
	e.save.stop();
});

test('2. un ?ver= de un proyecto que no existe: la carga falla, y al reanudar el guardado no tira', async () => {
	const e = editorDePrueba();
	e.save.start();
	// Sin proyecto, algo avisa (las escenas se limpian al entrar); después `loadProject` pausa, falla y reanuda.
	const rechazos = await rechazosDurante(() => {
		e.avisarEscenas();
		e.save.pause();
		e.save.resume();
	});
	assert.deepEqual(rechazos.map(String), []);
	assert.equal(e.save.getIsDirty(), false);
	e.save.stop();
});

test('3. con el proyecto abierto, un cambio se sigue guardando solo', async () => {
	const e = editorDePrueba();
	e.save.start();
	e.abrir();
	const rechazos = await rechazosDurante(() => e.editar());
	assert.deepEqual(rechazos.map(String), []);
	assert.equal(e.guardados(), 1);
	assert.equal(e.save.getIsDirty(), false);
	e.save.stop();
});

test('4. el último cambio antes de salir se guarda ANTES de soltar el proyecto (prepareExit)', () => {
	// Sin esto, un cambio hecho menos de 800 ms antes de «Volver» se perdía: su guardado llegaba con el proyecto ya cerrado.
	const fuente = readFileSync(new URL('../app/video-editor/_opencut/core/managers/project-manager.ts', import.meta.url), 'utf8');
	// `\r?`: en la PC el archivo llega con CRLF; en GitHub, con LF.
	const salida = /async prepareExit\(\): Promise<void> \{[\s\S]*?\r?\n\t\}\r?\n/.exec(fuente)?.[0] ?? '';
	assert.ok(salida, 'prepareExit existe');
	assert.match(salida, /if \(didUpdateThumbnail \|\| this\.editor\.save\.getIsDirty\(\)\) \{\s*await this\.editor\.save\.flush\(\);/);
});
