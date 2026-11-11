// =============================================================================
// AI Avatar: la galería no puede prometer lo que el motor no hace
// =============================================================================
// Las plantillas y las voces son DATOS, y cada uno alimenta algo que cobra o que
// se ve: el formato decide el plan del Video Generator, el prompt va a Flow con la
// cara de la persona, la voz se escucha en la tarjeta. Un dato roto no tira error:
// deja un botón que no hace nada o un video con otra cara.
//
// Probado rompiéndolo (17/10/2026), con el resultado de cada rotura:
//   · `puestaId: 'cocina'` en una plantilla → falla «todo formato existe»
//     (generarPlanAction contestaría «Elige una puesta en escena»).
//   · «realistic skin texture» en un prompt → falla «ningún prompt describe la
//     cara»: la cara la pone la foto, y describirla rompía el parecido.
//   · «Si tenés un negocio» en un guion → falla «sin voseo».
//   · borrar `const g = await puerta();` de `estadoLookAction` → falla «toda action
//     pasa por la puerta».
//   · `await guardarEnHistorial(...)` en `crearLookAction` → falla «los looks no van
//     al historial» (el tope de 10 empujaría afuera anuncios con clips pagados).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { PLANTILLAS_AVATAR, vozSugerida, CATEGORIAS } from '../lib/ai-avatar/plantillas';
import { VOCES_GALERIA, ACENTOS_GALERIA } from '../lib/ai-avatar/voces-galeria';
import { puestaPorId } from '../lib/puestas-data';
import { RUTA_SUBIDA, rutaDeSubida } from '../lib/flow-interfaz';
import { PROMPT_IMAGEN } from '../lib/prompts-imagen';
import { promptDelLook, limpiarDetalle, MAX_DETALLE } from '../lib/ai-avatar/prompt-look';
import { videosDelLook, haceCuanto, segundosDeGuion, mezclarPorId } from '../lib/ai-avatar/proyectos';
import { SIN_MOTOR, TONO_CATEGORIA } from '../lib/ai-avatar/estudio';
import { CREDITOS, RUTA_INSTALAR, requisitosAvatar, avisoDeCosto, resumenDeRequisitos, type PuenteVisto, type PasoRequisito, type IdPaso } from '../lib/ai-avatar/requisitos';
import { filtrarPresets, plantillaPorId } from '../lib/ai-avatar/plantillas';
import type { PlanGuardado } from '../app/video-generator/video-datos';

// Sin los \r de Windows: los cortes buscan '\n}\n', y un checkout con autocrlf no los tiene (17/10, chequeo del Cerebro).
const ACTIONS = readFileSync(join(process.cwd(), 'app/ai-avatar/actions.ts'), 'utf8').replace(/\r\n/g, '\n');

test('todo formato de una plantilla existe en el Video Generator', () => {
  for (const p of PLANTILLAS_AVATAR) assert.ok(puestaPorId(p.puestaId), `${p.id}: el formato «${p.puestaId}» no existe`);
});

test('ningún prompt describe la cara: la identidad la pone la foto', () => {
  const CARA = /\b(face|faces|facial|eyes?|eyebrows?|hair|beard|mustache|jaw|nose|lips?|skin|wrinkles?|freckles?|complexion)\b/i;
  for (const p of PLANTILLAS_AVATAR) assert.doesNotMatch(p.prompt, CARA, `${p.id}: el prompt describe la cara`);
});

test('el texto de la galería es de tú, sin voseo', () => {
  const VOS = /\b(tenés|contás|sentís|quedate|mostrás|hablás|anunciás|explicás|sabés|querés|podés|vos)\b/i;
  for (const p of PLANTILLAS_AVATAR) {
    for (const t of [p.nombre, p.resumen, p.lugar, p.guion]) assert.doesNotMatch(t, VOS, `${p.id}: «${t}»`);
  }
});

test('cada plantilla tiene categoría, voz que suena y, si dice tener video, el archivo', () => {
  for (const p of PLANTILLAS_AVATAR) {
    assert.ok((CATEGORIAS as readonly string[]).includes(p.categoria), p.id);
    assert.ok(vozSugerida(p.voz), `${p.id}: la voz «${p.voz}» no está en la galería`);
    if (p.ejemplo) {
      if (p.ejemplo.video) assert.ok(existsSync(join(process.cwd(), 'public', p.ejemplo.video)), `${p.id}: falta ${p.ejemplo.video}`);
      assert.ok(existsSync(join(process.cwd(), 'public', p.ejemplo.poster)), `${p.id}: falta ${p.ejemplo.poster}`);
    }
  }
  assert.equal(new Set(PLANTILLAS_AVATAR.map((p) => p.id)).size, PLANTILLAS_AVATAR.length, 'ids repetidos');
});

test('la galería de voces: ids únicos, muestra https y los dos géneros en cada acento', () => {
  assert.equal(new Set(VOCES_GALERIA.map((v) => v.id)).size, VOCES_GALERIA.length);
  for (const v of VOCES_GALERIA) {
    assert.match(v.muestra, /^https:\/\//, v.nombre);
    assert.ok(v.dueno.length > 10, `${v.nombre}: sin dueño no se puede sumar a la cuenta`);
  }
  for (const a of ACENTOS_GALERIA) {
    for (const g of ['mujer', 'hombre'] as const) assert.ok(VOCES_GALERIA.some((v) => v.acento === a && v.genero === g), `${a} sin ${g}`);
  }
});

test('la ruta del look es una que el puente acepta firmar', () => {
  assert.ok(RUTA_SUBIDA.test(rutaDeSubida('ai-avatar', 'escena', 1, '0f8b3c2a-1111-2222-3333-444455556666')));
});

test('toda action de la tab pasa por la puerta antes de hacer nada', () => {
  const nombres = [...ACTIONS.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]);
  assert.ok(nombres.length >= 5, 'no encontré las actions');
  for (const n of nombres) {
    const i = ACTIONS.indexOf(`export async function ${n}(`);
    const cuerpo = ACTIONS.slice(i, ACTIONS.indexOf('\n}\n', i));
    assert.match(cuerpo, /const g = await puerta\(\);\s*\n\s*if \(!g\.ok\)/, `${n} no pasa por la puerta`);
  }
});

test('los looks no van al historial del Video Generator', () => {
  const i = ACTIONS.indexOf('export async function crearLookAction(');
  const cuerpo = ACTIONS.slice(i, ACTIONS.indexOf('\n}\n', i));
  assert.doesNotMatch(cuerpo, /guardarEnHistorial/, 'un look en el historial empuja afuera anuncios con clips pagados (tope de 10)');
});

// ═════════════════════════════════════════════════════════════════════════════
// El estudio de Higgsfield (29/10/2026): presets, el ajuste escrito, los proyectos y las piezas sin motor
// ═════════════════════════════════════════════════════════════════════════════
// Probado rompiéndolo (29/10/2026): cada rotura dio 18 verdes / 1 rojo, el test que la nombra:
//   · `puestaId: 'selfie-movimiento'` en «Selfie de iPhone» → «sólo el auto…» (ese prompt GANA ENTERO: saldría en un auto).
//   · lo escrito pegado a la escena (`promptFinal(prompt + detalle)`) → «lo escrito… AL FINAL» (en el auto se perdía).
//   · lo escrito como `propio` → «lo escrito… AL FINAL» (se iba la identidad: otra persona).
//   · `videosDelLook` comparando `item.id` → «los videos de un look».
//   · `normal()` sin sacar las tildes → «el filtro de presets».
//   · la pastilla de Formato sin `sinMotor('formato')` → «toda pieza… SE VE».
//   · (tras montarlo en PantallaCrear) el import de otra pantalla → «el diseño de Create» y crear-pantalla (24/2); usar un
//     preset que llama a `generar(` → «el diseño de Create» (25/1); la page sin ESTILO_PAGINA_CREAR → ídem (25/1).
//   · (para todos y el paso a paso, 29/10; cada rotura 38/1): «Conectar» dado por hecho → «antes de Generar… paso a paso»;
//     sin <Requisitos> en la barra del video, o el teléfono con el ComputadoraM de antes → «el paso a paso se ve ARRIBA…»;
//     'ai-avatar' otra vez en NAV_SOLO_PRO → «la puerta es la de toda tab, en los TRES planes»; la fila de /planes con
//     `soloPro` → el de planes-tres-bloques.
//   · (la apertura a Pro) `veAiAvatar` sin el chequeo del Esencial → «la puerta es la de Pro» (37/1); la capa de la plataforma
//     sin 'ai-avatar' → ídem (37/1); TABS_TODAVIA_CERRADAS con 'ai-avatar' otra vez → el de /planes (37/1).
//   · `quitarLook` sin chequear que el id estaba → «borrar… en POSITIVO».
//   · `mezclarPorId` devolviendo sólo lo del server → «refrescar no se traga…».
//   · `borrarLookAction` sin `puerta()` → «toda action… pasa por la puerta».


const fuenteDe = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n');

test('sólo el auto usa el formato con prompt validado: ese prompt GANA ENTERO sobre la escena del preset', () => {
  const conValidado = PLANTILLAS_AVATAR.filter((p) => typeof PROMPT_IMAGEN[p.puestaId] === 'string').map((p) => p.id);
  assert.deepEqual(conValidado, ['auto-testimonio'], 'un preset con el formato del auto saldría en el auto');
});

test('el catálogo: cada categoría tiene presets, hay «Nuevos», y las ocho de HeyGen siguen', () => {
  for (const c of CATEGORIAS) assert.ok(PLANTILLAS_AVATAR.some((p) => p.categoria === c), `${c} vacía`);
  assert.ok(PLANTILLAS_AVATAR.some((p) => p.nuevo), 'sin «Nuevos» el filtro queda vacío');
  assert.ok(PLANTILLAS_AVATAR.length >= 20, 'la galería de Higgsfield no son ocho temas');
  for (const c of CATEGORIAS) assert.ok(TONO_CATEGORIA[c], `${c} sin su degradado`);
  // Un `?plantilla=` viejo tiene que seguir abriendo.
  for (const id of ['auto-testimonio', 'oficina-presentador', 'cocina-producto', 'espejo-resultado', 'podcast-experto', 'escritorio-demo', 'calle-promo', 'cafe-un-dia']) {
    assert.ok(plantillaPorId(id), `${id} desapareció`);
  }
});

test('lo escrito en la barra va AL FINAL: sobrevive al prompt validado y no reemplaza la identidad', () => {
  const auto = plantillaPorId('auto-testimonio')!;
  const conAuto = promptDelLook(auto, 'con una campera roja');
  assert.ok(conAuto.startsWith(PROMPT_IMAGEN['selfie-movimiento'].slice(0, 60)), 'el prompt validado del auto se perdió');
  assert.match(conAuto, /con una campera roja$/, 'lo escrito se perdió en el preset con prompt validado');
  const oficina = plantillaPorId('oficina-presentador')!;
  const conOficina = promptDelLook(oficina, 'de noche');
  assert.ok(conOficina.includes(oficina.prompt), 'la escena del preset se perdió');
  assert.match(conOficina, /de noche$/);
  // La identidad sigue: el bloque de la cara viaja igual con y sin lo escrito.
  const sin = promptDelLook(oficina, '');
  assert.ok(conOficina.startsWith(sin), 'lo escrito cambió el prompt de base (¿entró como `propio`?)');
  assert.ok(sin.length > oficina.prompt.length + 50, 'sin el bloque de identidad, luz y realismo');
});

test('limpiar lo escrito: sin saltos, sin espacios de más, con tope', () => {
  assert.equal(limpiarDetalle('  hola\n\n  mundo  '), 'hola mundo');
  assert.equal(limpiarDetalle(undefined), '');
  assert.equal(limpiarDetalle('x'.repeat(MAX_DETALLE + 50)).length, MAX_DETALLE);
});

test('los videos de un look: se cruzan por el mediaId de la imagen, del más nuevo al más viejo', () => {
  const plan = (id: string, elegidaId: string, at: string, urls: string[]): PlanGuardado => ({
    id, pedido: `guion ${id}`, at,
    plan: { clips: urls.map((_, i) => ({ n: i + 1 })) } as unknown as PlanGuardado['plan'],
    imagenes: { '1': { elegida: 'u', elegidaId, confirmada: true } } as unknown as PlanGuardado['imagenes'],
    video: Object.fromEntries(urls.map((u, i) => [String(i + 1), u ? { url: u } : {}])) as unknown as PlanGuardado['video'],
  } as PlanGuardado);
  const h = [plan('a', 'med-1', '2026-10-28T10:00:00Z', ['v1', '']), plan('b', 'med-2', '2026-10-29T10:00:00Z', ['x']), plan('c', 'med-1', '2026-10-29T12:00:00Z', ['', ''])];
  const v = videosDelLook(h, 'med-1');
  assert.deepEqual(v.map((x) => x.planId), ['c', 'a']);
  assert.deepEqual([v[1].tomas, v[1].listas, v[1].url], [2, 1, 'v1']);
  assert.deepEqual(videosDelLook(h, ''), [], 'un look sin mediaId no tiene videos');
});

test('el filtro de presets: categoría, «Nuevos» y buscar sin tildes', () => {
  assert.ok(filtrarPresets('Cámara', '').every((p) => p.categoria === 'Cámara'));
  assert.ok(filtrarPresets('Nuevos', '').every((p) => p.nuevo));
  assert.ok(filtrarPresets(null, 'camara').some((p) => p.categoria === 'Cámara'), 'buscar sin tildes');
  assert.ok(filtrarPresets(null, 'LLUVIA').some((p) => p.id === 'dia-lluvia'));
  assert.equal(filtrarPresets(null, '').length, PLANTILLAS_AVATAR.length);
});

test('los rótulos de los proyectos: hace cuánto y cuánto dura un guion', () => {
  const ahora = Date.parse('2026-10-29T12:00:00Z');
  assert.equal(haceCuanto('2026-10-29T11:55:00Z', ahora), 'hace 5 min');
  assert.equal(haceCuanto('2026-10-29T09:00:00Z', ahora), 'hace 3 h');
  assert.equal(haceCuanto('2026-10-28T10:00:00Z', ahora), 'ayer');
  assert.equal(haceCuanto('basura', ahora), '');
  assert.equal(segundosDeGuion('uno dos tres cuatro'), 2);
  assert.equal(segundosDeGuion('   '), 0);
});

test('toda pieza de Higgsfield sin motor SE VE y dice en una línea que no está', () => {
  for (const [k, t] of Object.entries(SIN_MOTOR)) assert.match(t, /no disponible todavía/, `${k}: «${t}»`);
  const escritorio = fuenteDe('app/ai-avatar/Estudio.tsx');
  for (const k of Object.keys(SIN_MOTOR)) {
    assert.ok(escritorio.includes(`sinMotor('${k}')`) || escritorio.includes(`SIN_MOTOR.${k}`), `escritorio no muestra «${k}»`);
  }
  const telefono = fuenteDe('app/m/ai-avatar/EstudioM.tsx');
  for (const k of ['modelo', 'formato', 'cantidad', 'voz', 'movimiento', 'personaje']) {
    assert.ok(telefono.includes(`SIN_MOTOR.${k}`) || telefono.includes(`['${k}',`), `el teléfono no muestra «${k}»`);
  }
});

test('el diseño de Create: monta la pantalla única (chat de MaKo fijo y proyectos), sin secciones y sin onboarding', () => {
  const escritorio = fuenteDe('app/ai-avatar/Estudio.tsx');
  // El marco es el de todas las tabs de Create (app/_crear/PantallaCrear.tsx): no uno propio, ni la estrella que se cierra.
  assert.match(escritorio, /import \{ PantallaCrear, type PlantillaCrear, type ProyectoCrear \} from '@\/app\/_crear\/PantallaCrear';/);
  assert.match(escritorio, /<PantallaCrear tab="AI Avatar" nuevo="Nuevo avatar" proyectos=\{proyectos\}/, 'sin la pantalla de Create');
  assert.doesNotMatch(escritorio, /MakoEnLaTab/, 'un chat propio en vez de la tarjeta de Create');
  assert.ok(escritorio.includes('¿Qué vas a crear hoy?'), 'el estudio sin su título');
  // Usar un preset de «Nuevo avatar» lo pone en la barra: NO genera solo (falta la foto, y generar es con el botón).
  const usar = escritorio.slice(escritorio.indexOf('onPlantilla={'), escritorio.indexOf('ejemplos={EJEMPLOS}'));
  assert.doesNotMatch(usar, /generar\(|crearLookAction/, 'usar un preset genera sin que nadie apriete Generar');
  assert.match(fuenteDe('app/ai-avatar/page.tsx'), /style=\{ESTILO_PAGINA_CREAR\}/, 'la página sin el alto de Create');
  assert.ok(!fuenteDe('app/m/ai-avatar/page.tsx').includes('SeccionesTabM'), 'el teléfono con la barra de secciones');
  for (const sub of ['avatares', 'voces', 'plantillas']) {
    assert.match(fuenteDe(`app/ai-avatar/${sub}/page.tsx`), /redirect\(await rutaConWs\(/, `/ai-avatar/${sub} no redirige`);
  }
});

test('antes de «Generar», lo que es de la persona va paso a paso y en orden: extensión, conectar, Flow, foto', () => {
  const puente = (estado: PuenteVisto['estado'], vivo = true, actualizada = true): PuenteVisto => ({ estado, vivo, actualizada });
  const r = (pu: PuenteVisto, instalada: string | false | null, fotos = 1, para: 'avatar' | 'video' = 'avatar', enTelefono = false) =>
    requisitosAvatar({ puente: pu, instalada, enTelefono, fotos, para });
  const ids = (x: ReturnType<typeof r>) => x.pasos.map((p) => `${p.id}:${p.hecho ? 'si' : 'no'}`);
  // Nada hecho: falta lo primero, instalarla, con el link a los pasos.
  const nada = r(puente('sin_conectar'), false, 0);
  assert.deepEqual(ids(nada), ['extension:no', 'conectar:no', 'flow:no', 'foto:no']);
  assert.equal(nada.falta?.id, 'extension');
  assert.equal(nada.falta?.enlace?.href, RUTA_INSTALAR);
  // Instalada en este Chrome pero sin conectar: falta conectar.
  assert.equal(r(puente('sin_conectar'), '0.74.3').falta?.id, 'conectar');
  // Conectada con una versión vieja: aparece «Actualiza» y es lo que falta (no sabe poner la cara).
  assert.equal(r(puente('listo', true, false), null).falta?.id, 'actualizar');
  // Sin sesión de Google Flow: falta abrir Flow; marcada: lo dice; lista pero sin latir: lo dice.
  assert.equal(r(puente('sin_sesion'), null).falta?.id, 'flow');
  assert.match(r(puente('marcada'), null).falta!.ayuda, /Google pausó tu sesión de Flow/);
  assert.match(r(puente('listo', false), null).falta!.ayuda, /dejó de responder/);
  // Todo listo menos la foto: falta la foto. Todo listo: nada falta.
  assert.equal(r(puente('listo'), null, 0).falta?.id, 'foto');
  const listo = r(puente('listo'), null, 2);
  assert.deepEqual([listo.listo, listo.falta], [true, null]);
  // Para el video, la foto ya está en el avatar: no se pide. En el teléfono, se dice que es en la computadora.
  assert.ok(!r(puente('listo'), null, 0, 'video').pasos.some((p) => p.id === 'foto'));
  assert.match(r(puente('sin_conectar'), null, 0, 'avatar', true).pasos[0].titulo, /^En tu computadora/);
  // Lo que cuesta, dicho antes: el avatar gratis, cada toma con créditos de SU Flow.
  assert.match(CREDITOS, /no gasta créditos[\s\S]*créditos de tu cuenta de Google Flow/);
});

test('el paso a paso se ve ARRIBA de las dos barras (avatar y video), en la computadora y en el teléfono', () => {
  const escritorio = fuenteDe('app/ai-avatar/Estudio.tsx');
  assert.match(escritorio, /\{!req\.listo && <Requisitos pasos=\{req\.pasos\} \/>\}/, 'la barra del avatar sin el paso a paso');
  assert.match(escritorio, /\{p\.estado === 'listo' && !req\.listo && <Requisitos pasos=\{req\.pasos\} \/>\}/, 'la barra del video sin el paso a paso');
  assert.match(escritorio, /`Antes de generar: \$\{req\.falta\.titulo\}\.`/, 'la línea de la barra no dice qué falta');
  assert.match(escritorio, /requisitosAvatar\(\{ puente, instalada, enTelefono: false/, 'sin mirar si la extensión está en este Chrome');
  const telefono = fuenteDe('app/m/ai-avatar/EstudioM.tsx');
  assert.equal((telefono.match(/<RequisitosM pasos=/g) ?? []).length, 2, 'el teléfono sin el paso a paso en las dos pantallas');
  assert.doesNotMatch(telefono, /ComputadoraM/, 'el teléfono volvió al aviso suelto');
  // El servidor le da a la pantalla lo que necesita para decidir los pasos.
  assert.match(fuenteDe('app/ai-avatar/actions.ts'), /export type EstadoPuenteAvatar = PuenteVisto & \{ puede: boolean; motivo: string \};/);
});

test('la puerta es la de toda tab, en los TRES planes: admin y la tab en su capa; la plataforma la conserva', () => {
  const acceso = fuenteDe('app/ai-avatar/acceso.ts');
  assert.doesNotMatch(acceso, /getSesionAdmin/, 'sigue cerrada al super admin');
  // Martín, 29/10/2026: «haz que AI-Avatar esté disponible para todos». Ni en la lista de Pro ni con su candado.
  assert.doesNotMatch(acceso, /esEsencialDeLaSesion|esNavSoloPro/, 'AI Avatar volvió a tener el candado de Pro');
  assert.doesNotMatch(fuenteDe('lib/plan-esencial-reglas.ts'), /'ai-avatar'/, 'AI Avatar volvió a NAV_SOLO_PRO');
  assert.doesNotMatch(fuenteDe('lib/topes-plan.ts').match(/export const TABS_SOLO_PRO = \[[^\]]*\]/)![0], /ai-avatar/, 'AI Avatar volvió a TABS_SOLO_PRO');
  assert.match(acceso, /await requireRolWs\(\[\], \{ nav: 'ai-avatar' \}\);/, 'las pantallas sin la puerta de toda tab');
  assert.match(acceso, /\(await getRolWsEfectivo\(\)\) !== 'admin'\) return false;/, 'las actions dejan pasar a quien no es admin');
  // La capa de la plataforma tiene keys explícitas: sin la de AI Avatar, el super admin la perdía en su propio workspace.
  assert.match(fuenteDe('lib/capas.ts'), /navKeys: \[[^\]]*'ai-avatar'[^\]]*\]/, 'la capa de la plataforma sin AI Avatar');
});

test('borrar un proyecto es en POSITIVO: se escribe la lista sin ESE id, y sólo si estaba', () => {
  const looks = fuenteDe('app/ai-avatar/looks.ts');
  const i = looks.indexOf('export async function quitarLook(');
  const cuerpo = looks.slice(i, looks.indexOf('\n}\n', i));
  assert.match(cuerpo, /getSettingEstricto\(KEY_LOOKS\)/, 'lee sin estricto: un error de lectura borraría todo');
  assert.match(cuerpo, /if \(!id \|\| !actual\.some\(\(l\) => l\.id === id\)\) return false;/, 'escribe sin chequear que el id estaba');
  assert.match(cuerpo, /actual\.filter\(\(l\) => l\.id !== id\)/);
});

test('refrescar no se traga lo recién creado: el server gana en cada id y lo nuevo local queda arriba', () => {
  const r = mezclarPorId([{ id: 'nuevo', v: 1 }, { id: 'a', v: 1 }], [{ id: 'a', v: 2 }, { id: 'b', v: 2 }]);
  assert.deepEqual(r, [{ id: 'nuevo', v: 1 }, { id: 'a', v: 2 }, { id: 'b', v: 2 }]);
});

// =============================================================================
// Las DOS ramas de AI Avatar: la de Flow y la de MaKo (7/11/2026)
// =============================================================================
// Martín, 7/11: «que ahí se pueda elegir tanto la rama de Flow como la rama de APIs directamente, es decir,
// los créditos de MaKo en este caso». Lo que sigue prueba que elegir una rama CAMBIA lo que se le pide a la
// persona — que es lo único que hace que la elección signifique algo.

/** Un puente roto a propósito: por la rama de MaKo no tiene que importar nada de esto. */
const PUENTE_ROTO: PuenteVisto = { estado: 'sin_conectar', vivo: false, actualizada: false };

test('por la rama de MaKo no se le pide NI UNA cosa de Flow', () => {
  // ⚠️ ES EL TEST QUE IMPORTA. Pedirle a alguien que eligió MaKo que instale una extensión, conecte un
  // navegador y abra una cuenta de Google es mandarlo a hacer cuatro cosas que no va a usar — y un aviso
  // falso no confunde sólo sobre ese punto: hace desconfiar de todos los demás.
  const r = requisitosAvatar({
    motor: 'mako', puente: PUENTE_ROTO, instalada: false, enTelefono: false,
    fotos: 1, para: 'avatar', saldoMt: 10_000, cuestaMt: 1_200,
  });
  const ids = r.pasos.map((x) => x.id);
  for (const deFlow of ['extension', 'conectar', 'actualizar', 'flow'] as const) {
    assert.ok(!ids.includes(deFlow), `la rama de MaKo pide «${deFlow}», que es de Flow`);
  }
  assert.equal(r.listo, true, 'con foto y saldo, la rama de MaKo tendría que estar lista');
});

test('la rama de Flow sigue intacta: sin motor, el camino es el de siempre', () => {
  // La guarda de que no rompí a nadie que ya estaba generando.
  const sinMotor = requisitosAvatar({ puente: PUENTE_ROTO, instalada: false, enTelefono: false, fotos: 1, para: 'avatar' });
  const conFlow = requisitosAvatar({ motor: 'flow', puente: PUENTE_ROTO, instalada: false, enTelefono: false, fotos: 1, para: 'avatar' });
  assert.deepEqual(sinMotor.pasos.map((x) => x.id), conFlow.pasos.map((x) => x.id));
  assert.ok(sinMotor.pasos.some((x) => x.id === 'extension'), 'la rama de Flow dejó de pedir la extensión');
  assert.equal(sinMotor.listo, false, 'con el puente sin conectar, Flow no puede estar listo');
});

test('sin saldo no se genera, y el motivo NO manda a instalar nada', () => {
  const r = requisitosAvatar({
    motor: 'mako', puente: PUENTE_ROTO, instalada: false, enTelefono: false,
    fotos: 1, para: 'avatar', saldoMt: 10, cuestaMt: 1_200,
  });
  assert.equal(r.listo, false, 'con 10 MT y un costo de 1.200 se dejó generar');
  assert.equal(r.falta?.id, 'saldo');
  assert.ok(!/extensi|chrome|google|flow/i.test(r.falta?.ayuda ?? ''),
    `el motivo manda a Flow cuando el problema es el saldo: «${r.falta?.ayuda}»`);
});

test('el saldo de la rama de MaKo falla CERRADO, igual que el del medidor', () => {
  // Un saldo que no se pudo leer no habilita. Si acá dijera que sí y el server frenara, la persona ve el
  // paso en verde y un error al apretar — que es el aviso que se contradice con el de al lado.
  for (const saldo of [null, undefined]) {
    const r = requisitosAvatar({
      motor: 'mako', puente: PUENTE_ROTO, instalada: false, enTelefono: false,
      fotos: 1, para: 'avatar', saldoMt: saldo, cuestaMt: 1_200,
    });
    assert.equal(r.listo, false, `un saldo ${String(saldo)} dejó generar`);
  }
});

test('para el VIDEO no se vuelve a pedir la foto: el avatar ya la tiene', () => {
  const r = requisitosAvatar({
    motor: 'mako', puente: PUENTE_ROTO, instalada: false, enTelefono: false,
    fotos: 0, para: 'video', saldoMt: 10_000, cuestaMt: 1_200,
  });
  assert.ok(!r.pasos.some((x) => x.id === 'foto'), 'se pidió la foto otra vez para el video');
  assert.equal(r.listo, true);
});

test('lo que se le dice que va a gastar cambia con la rama, y ninguna de las dos miente', () => {
  const flow = avisoDeCosto('flow');
  const mako = avisoDeCosto('mako');
  assert.notEqual(flow, mako, 'las dos ramas avisan lo mismo y una de las dos está mintiendo');
  assert.ok(/Flow/.test(flow), 'la rama de Flow no nombra de dónde salen los créditos');
  assert.ok(/MaKo Tokens/.test(mako), 'la rama de MaKo no nombra los MaKo Tokens');
  assert.ok(!/Google Flow/.test(mako), 'la rama de MaKo le dice que gasta créditos de Google Flow: es falso');
  assert.equal(avisoDeCosto(), flow, 'sin motor, el aviso tiene que ser el de siempre');
});

test('la rama de MaKo pide una foto DE VERDAD, no una imagen generada', () => {
  // Medido el 7/11 y pagado cuatro veces: una generación usada como referencia de identidad da una cara que
  // no es la de la persona, y no lo arregla ningún prompt. Si el texto no lo dice, nadie lo sabe.
  const r = requisitosAvatar({
    motor: 'mako', puente: PUENTE_ROTO, instalada: false, enTelefono: false,
    fotos: 0, para: 'avatar', saldoMt: 10_000, cuestaMt: 1_200,
  });
  const foto = r.pasos.find((x) => x.id === 'foto');
  assert.ok(foto, 'no hay paso de foto');
  assert.ok(/IA|generad/i.test(foto.ayuda), `el paso de la foto no avisa que no sirve una imagen de IA: «${foto.ayuda}»`);
});

// =============================================================================
// «Antes de generar» plegado: cuánto falta y qué sigue (7/11/2026, plan.md T15)
// =============================================================================
// El plan pedía que la tarjeta se plegara a «Te falta 1 de 4». El número que lo justifica es una medición: a
// 1024 × 820 el bloque pegado al pie ocupaba 452 px de 820 —el 55 % de la pantalla— con 240 de esta tarjeta, y
// quedaba desplegada TODO el tiempo que faltara un paso, que es justo cuando la persona mira los 33 presets.
//
// Al plegar, lo único que no se puede perder son las dos cosas por las que alguien la miraría: **cuánto falta
// y qué sigue**. Eso es lo que esto fija.

const PASO = (id: IdPaso, hecho: boolean, titulo = `paso ${id}`): PasoRequisito => ({ id, titulo, hecho, ayuda: '' });

test('el resumen dice cuánto falta Y qué sigue, no sólo un número', () => {
  const r = resumenDeRequisitos([PASO('extension', true), PASO('conectar', false, 'conéctala a tu negocio'), PASO('flow', false), PASO('foto', false)]);
  assert.equal(r.faltan, 3);
  assert.equal(r.total, 4);
  assert.equal(r.siguiente?.id, 'conectar', 'el siguiente tiene que ser el PRIMERO sin hacer, no cualquiera');
  assert.match(r.linea, /3 de 4/, `la línea no dice cuánto falta: «${r.linea}»`);
  assert.match(r.linea, /conéctala a tu negocio/, `la línea no dice qué sigue: «${r.linea}»`);
});

test('el plural está bien escrito: lo lee un cliente', () => {
  // «Te falta 2 de 4» está mal y se ve. Es el texto más corto de la pantalla y el que más se mira.
  const uno = resumenDeRequisitos([PASO('extension', true), PASO('conectar', true), PASO('flow', true), PASO('foto', false)]);
  const dos = resumenDeRequisitos([PASO('extension', true), PASO('conectar', true), PASO('flow', false), PASO('foto', false)]);
  assert.match(uno.linea, /Te falta 1 de 4/, `singular mal: «${uno.linea}»`);
  assert.match(dos.linea, /Te faltan 2 de 4/, `plural mal: «${dos.linea}»`);
});

test('con todo hecho no dice que falta algo', () => {
  const r = resumenDeRequisitos([PASO('extension', true), PASO('foto', true)]);
  assert.equal(r.faltan, 0);
  assert.equal(r.siguiente, null);
  assert.ok(!/falta/i.test(r.linea), `con todo listo la línea igual dice que falta algo: «${r.linea}»`);
});

test('el total es el de ESTA rama, no un 4 fijo', () => {
  // ⚠️ Por la rama de MaKo son DOS pasos, no cuatro. Un «de 4» hardcodeado le mentiría a quien eligió esa
  // rama — le diría que le faltan cosas que su camino no pide.
  const flow = requisitosAvatar({ puente: { estado: 'sin_conectar', vivo: false, actualizada: false }, instalada: false, enTelefono: false, fotos: 0, para: 'avatar' });
  const mako = requisitosAvatar({ motor: 'mako', puente: { estado: 'sin_conectar', vivo: false, actualizada: false }, instalada: false, enTelefono: false, fotos: 0, para: 'avatar', saldoMt: 0, cuestaMt: 100 });
  const rf = resumenDeRequisitos(flow.pasos);
  const rm = resumenDeRequisitos(mako.pasos);
  assert.ok(rf.total > rm.total, `Flow pide ${rf.total} pasos y MaKo ${rm.total}: la rama de MaKo tendría que pedir menos`);
  assert.match(rm.linea, new RegExp(`de ${rm.total}`), `la rama de MaKo dice un total que no es el suyo: «${rm.linea}»`);
  assert.ok(!/extensi|chrome/i.test(rm.linea), `la rama de MaKo nombra algo de Flow en su resumen: «${rm.linea}»`);
});

test('la tarjeta arranca PLEGADA: ése era el punto', () => {
  // Si alguien la deja abierta por defecto, vuelve a comerse el 55 % de la pantalla y ningún otro test lo nota.
  const src = readFileSync(join(import.meta.dirname, '..', 'app/ai-avatar/Estudio.tsx'), 'utf8');
  assert.match(src, /const \[abierta, setAbierta\] = useState\(false\)/,
    'la tarjeta de «Antes de generar» dejó de arrancar plegada');
  assert.match(src, /aria-expanded=\{abierta\}/, 'la cabecera no declara si está abierta: un lector de pantalla no lo sabe');
});
