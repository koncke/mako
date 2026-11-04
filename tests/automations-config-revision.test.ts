// =============================================================================
// Configuraciones de cada automatización: lo que encontró la revisión adversarial del pedido B (20/10/2026)
// =============================================================================
// El Cerebro revisó b0ff4dc42 (motor de envíos + pantalla; el detalle en las notas de la sesión,
// revision-automations-b-20-10.md) y frenó la subida. Lo que fija, cada uno con su caso:
//   1. el HUSO de la tuerca es el del NEGOCIO: se ve, no se cambia (elegir Madrid en una dejaba a todas de madrugada);
//   2. «Duplicar» COPIA la configuración propia (vive fuera de la fila): la copia de una «Prospección fría» de 9 a 18
//      con 48 h mandaba a las 3 AM con 20 h; si no se puede copiar, la copia se borra;
//   3. las horas «misma persona» del NEGOCIO vuelven a tener pantalla (rotuladas «por defecto»); (23/10/2026: «Misma persona» se fue entera);
//   4. al entrar a /automations la sidebar es la LISTA (no el chat de la primera, que escondía «＋ Nueva» y el «?»);
//   5. Escape no corta, sin que se vea, un pedido en vuelo del chat escondido o con un modal abierto;
//   6. las «Evento de MaKo» esperan a que abra SU horario (el propio, si tiene), no sólo el del negocio;
//   y los menores: un horario sin `activo` booleano se rechaza, apagarlo con los días vacíos se guarda, «como el negocio»
//   borra la clave, la tarjeta dice «manda a cualquier hora», lo propio ilegible no frena el carril de todas, sin la zona
//   se cierran sólo las que tienen horario, el tick tolera y filtra su lectura, los clics rápidos no se pisan, la tuerca
//   es también del que no es admin, el aviso de Prospección no consulta dos veces y «contesta sola» lee el de la suya.
//
// PROBADO ROMPIÉNDOLO (20/10/2026, arnés `romper.py` + `roturas-config-revision.json`): ver el pie.
//
// Correr: node --import tsx --test tests/automations-config-revision.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { configParaGuardar, cerradasAhora, textoDeHorario, type ConfigAutomatizacion } from '../lib/config-automatizacion';
import { FILAS_LINEA } from '../lib/limites-envio';
import { duplicarSecuencia, type DbDuplicar, type FilaOriginal } from '../lib/secuencia-duplicar';
import { SimuladorWhatsApp } from '../app/automations/SimuladorWhatsApp';
import { SecuenciaPerfil } from '../app/automations/SecuenciaPerfil';
import type { SecuenciaDto } from '../app/automations/ChatAgentApp';
import { muelles } from '../lib/lienzo-grafo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const cuerpo = (src: string, firma: string, fin = '\n}\n'): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `falta «${firma}»`);
  return src.slice(i, src.indexOf(fin, i));
};

// ── 1. El huso ───────────────────────────────────────────────────────────────────────────────

// ⚠️ CAMBIÓ EL 23/10/2026 (Martín: «en configuraciones de Automations, no hay opción para poner el huso horario»). Hasta ese
// día el huso iba de sólo lectura en el ⓘ (revisión del 20/10: elegir Madrid en UNA automatización dejaba a las demás de
// madrugada sin saberlo). Ahora se cambia en la fila de las horas, con el MISMO selector, y la línea dice que es del negocio.
test('1. en la tuerca el huso se ve y se cambia con el MISMO selector, y dice que vale para todo el negocio', () => {
  const panel = sinComentarios(leer('app/configuraciones/HorarioEnvioPanel.tsx'));
  // UN selector y UNA escritura (`cambiarZona` → `saveZonaHorarioAction` → `fijarZonaDelNegocio`), en las dos pantallas.
  assert.equal((panel.match(/onChange=\{cambiarZona\}/g) ?? []).length, 1, 'el huso se cambia por otro lado');
  assert.match(panel, /<Dropdown value=\{zona\} options=\{opcionesDeZona\(zona, navegador\)\}[^\n]*onChange=\{cambiarZona\} \/>/);
  assert.match(panel, /void saveZonaHorarioAction\(tz\)/);
  // En la tuerca, con el horario prendido, la línea de que es del negocio.
  assert.match(panel, /\{fuente\.zonaDelNegocio && h\.activo && \(\s*<span data-aviso-zona-negocio=""[^>]*>\{AVISO_ZONA_NEGOCIO\}<\/span>/);
  assert.match(leer('app/configuraciones/HorarioEnvioPanel.tsx'), /export const AVISO_ZONA_NEGOCIO = 'El huso vale para todo el negocio\.';/);
  assert.doesNotMatch(panel, /zonaSoloLectura/, 'volvió el huso de sólo lectura');
  // La del navegador va primera, marcada, y canónica.
  assert.match(panel, /zonaCanonica\(Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone\)/);
  assert.match(panel, /out\.unshift\(\{ \.\.\.sugerida, label: `\$\{sugerida\.label\} · \$\{ROTULO_ZONA_NAVEGADOR\}` \}\);/);
  const auto = sinComentarios(leer('app/automations/ConfigAutomatizacionPanel.tsx'));
  assert.match(auto, /const fuente: FuenteHorario = \{\s+zonaDelNegocio: true,/);
  // El del negocio (sin `fuente`) sigue igual.
  assert.match(panel, /const FUENTE_NEGOCIO: FuenteHorario = \{ leer: \(\) => getHorarioEnvioAction\(\), guardar: \(h\) => saveHorarioEnvioAction\(h\) \};/);
  // Y la acción escribe la zona del NEGOCIO, con su origen, sólo un admin.
  const acc = sinComentarios(leer('app/configuraciones/horario-actions.ts'));
  assert.match(acc, /if \(rol !== 'admin'\) return \{ ok: false, error: 'Solo un admin puede cambiar el huso\.' \};/);
  assert.match(acc, /await fijarZonaDelNegocio\(ws, z, 'persona', sesion\?\.email \|\| null\)/);
});
// Probado rompiéndolo (23/10/2026, el test 1 solo): sin la línea del negocio → 0/1; sin la zona del navegador → 0/1; la tuerca
// sin `zonaDelNegocio` → 0/1.

// ── 2. Duplicar ──────────────────────────────────────────────────────────────────────────────

const ORIGINAL: FilaOriginal = { id: 77, clave: 'prospeccion', nombre: 'Prospección fría', etapa: 'nuevo', trigger_tipo: 'etapa_actual', pasos: [{ id: 'a', canal: 'whatsapp', cuerpo: 'Hola' }], cron: null };
function base() {
  const llamadas: string[] = [];
  const db: DbDuplicar = {
    from: () => ({
      select: () => ({ eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: ORIGINAL, error: null }) }) }) }),
      insert: () => ({ select: () => ({ single: async () => { llamadas.push('insert'); return { data: { id: 900 }, error: null }; } }) }),
      delete: () => ({ eq: async (_c: string, v: number) => { llamadas.push(`delete:${v}`); return { data: null, error: null }; } }),
    }),
  };
  return { db, llamadas };
}

test('2. «Duplicar» copia la configuración propia de la original a la copia, y si no puede, borra la copia', async () => {
  const { db, llamadas } = base();
  const copias: Array<[number, number]> = [];
  const r = await duplicarSecuencia(77, { db, clave: () => 'k', setPasos: async () => {}, setCron: async () => {}, copiarConfig: async (de, a) => { copias.push([de, a]); } });
  assert.equal(r.id, 900);
  assert.deepEqual(copias, [[77, 900]], 'la copia nace sin el horario ni las horas de la original');
  assert.ok(!llamadas.some((l) => l.startsWith('delete')));
  // «No pude leer o escribir» = la copia se borra (una copia sin sus frenos dice ser la otra y no lo es).
  const b = base();
  await assert.rejects(
    duplicarSecuencia(77, { db: b.db, clave: () => 'k', setPasos: async () => {}, setCron: async () => {}, copiarConfig: async () => { throw new Error('No pude leer la configuración de la automatización'); } }),
    /configuración/,
  );
  assert.deepEqual(b.llamadas, ['insert', 'delete:900']);
  // La de verdad: estricta, y sólo si hay algo propio. Y las dos puertas de Duplicar la enchufan.
  const dbsrc = sinComentarios(leer('lib/config-automatizacion-db.ts'));
  assert.match(cuerpo(dbsrc, 'export async function copiarConfigAutomatizacion('), /const c = await leerConfigAutomatizacion\(de\);\n\s+if \(!tieneConfigPropia\(c\)\) return;\n\s+await setSetting\(claveConfigAutomatizacion\(a\), JSON\.stringify\(c\)\);/);
  for (const f of ['app/api/chat-agent/secuencias/route.ts', 'lib/api-mako/areas/chatbot.run.ts']) {
    assert.match(sinComentarios(leer(f)), /setCron: setCronSecuencia, copiarConfig: copiarConfigAutomatizacion \}\)/, f);
  }
});

// ── 3. Las horas del negocio ─────────────────────────────────────────────────────────────────

// ⚠️ 23/10/2026 (Martín): primero «Hay DOS "Misma persona": queda UNA» y más tarde en el día «elimina "Misma persona"». Hoy no
// queda NINGUNA: ni la del negocio ni la de la automatización tienen fila en la pantalla, y el motor no la aplica.
test('3. «Misma persona» no tiene fila: ni la de la línea ni la de la automatización', () => {
  const auto = sinComentarios(leer('app/automations/ConfigAutomatizacionPanel.tsx'));
  assert.doesNotMatch(auto, /Misma persona|personaNegocio|PERSONA_SIN_ESPERA|personaHoras/, 'volvió «Misma persona» a la pantalla');
  const lim = sinComentarios(leer('lib/limites-envio.ts'));
  // Lo que cuida: ninguna fila de la línea es «Misma persona». Se mira la lista que sale (`FILAS_LINEA`), no la línea del filtro:
  // el 4/11/2026 el filtro sumó la rampa del email y la línea literal dejó de coincidir con el código correcto.
  assert.ok(lim.includes("f.campo !== 'personaHoras'"), 'la fila de la línea volvió a la pantalla');
  assert.ok(!FILAS_LINEA.some((f) => f.campo === 'personaHoras'), 'la fila de la línea volvió a la pantalla');
  assert.doesNotMatch(sinComentarios(leer('app/automations/LimitesEnvioPanel.tsx')), /ROTULO_PERSONA_DEFECTO|personaPorDefecto/);
  assert.doesNotMatch(sinComentarios(leer('app/automations/config-automatizacion-actions.ts')), /personaNegocio/);
});

// ── 4. La lista al entrar ────────────────────────────────────────────────────────────────────

const sec = (id: number, nombre: string) => ({
  id, clave: `s${id}`, nombre, etapa: 'nuevo', trigger_tipo: 'manual', activa: false, pasos: [], inscriptos: 0, enviados: 0, estrategia: null, metricas: {},
}) as unknown as SecuenciaDto;

test('4. al entrar con automatizaciones, la sidebar es la LISTA (con «＋ Nueva»), no el chat de la primera', () => {
  const html = renderToStaticMarkup(createElement(SimuladorWhatsApp, {
    secuencias: [sec(1, 'Bienvenida'), sec(2, 'Reactivación')], objetivos: [], etiquetaEtapa: (k: string) => k, negocio: 'Mi negocio',
    rolAdmin: true, audios: [], canalCaido: false, onAudioNuevo: () => {}, onNueva: () => {}, onReload: () => {}, productos: [], disparadores: [], tz: null,
  } as Parameters<typeof SimuladorWhatsApp>[0]));
  assert.match(html, /<aside aria-label="Tus automatizaciones" data-panel-automations="lista"/, 'la sidebar arranca siendo el chat de la primera');
  assert.ok(html.includes('chb-nueva'));
  // Elegir una (un clic, `?sec=`, la recién creada) sigue llevando al chat.
  const lista = sinComentarios(leer('app/automations/SimuladorWhatsApp.tsx'));
  assert.match(lista, /const \[enLaLista, setEnLaLista\] = useState\(true\);/);
  assert.match(cuerpo(lista, 'const cambiarA = (id: number) => {', '\n  };'), /setEnLaLista\(false\);/);
  assert.match(cuerpo(lista, 'const elegir = (id: number) => {', '\n  };'), /if \(id === selId\) \{ setEnLaLista\(false\); return; \}/);
});

// ── 5. Escape ────────────────────────────────────────────────────────────────────────────────

test('5. Escape no cancela el pedido de un chat escondido, ni el de un chat con un modal o menú abierto afuera', () => {
  const chat = sinComentarios(leer('app/automations/ChatMako.tsx'));
  const t = cuerpo(chat, 'const alTeclado = (e: KeyboardEvent) => {', '\n    };');
  assert.match(t, /const oculto = !raiz \|\| raiz\.getClientRects\(\)\.length === 0;/);
  assert.match(t, /const otroAbierto = !adentro && \[\.\.\.document\.querySelectorAll\('\[role="dialog"\], \[role="menu"\], \[role="listbox"\]'\)\]\.some\(\(n\) => !raiz\?\.contains\(n\)\);/);
  const corte = t.indexOf("if (e.key === 'Escape' && (oculto || otroAbierto)) return;");
  assert.ok(corte > 0 && corte < t.indexOf('cancelar();'), 'el Escape de la lista corta el pedido escondido');
});

// ── 6. Evento de MaKo ────────────────────────────────────────────────────────────────────────

test('6. una «Evento de MaKo» espera a que abra SU horario (el propio, leído donde vive la fila), no sólo el del negocio', () => {
  const f = sinComentarios(leer('lib/flujos.ts'));
  assert.match(f, /apertura = await aperturaDelNegocio\(ctx\.negocioWs \?\? ws, \{ flujoId, ws \}\);/);
  const a = cuerpo(f, 'async function aperturaDelNegocio(');
  assert.match(a, /const filaId = fila \? filaDeIdCorrida\(fila\.flujoId\) : null;/);
  assert.match(a, /runWithWorkspace\(fila\.ws, \(\) => getSettingEstricto\(cfg\.claveConfigAutomatizacion\(filaId\)\)\)/);
  assert.match(a, /const h = cfg\.horarioDeLaAutomatizacion\(cfg\.sanearConfigAutomatizacion\(rawConfig\), horarioVigente\(rawHorario\)\);/);
  // Estricto: «no pude leer» es 'ilegible' (vuelve a mirar en un rato), nunca «sin horario».
  assert.match(a, /catch \(e\) \{[\s\S]*return 'ilegible';/);
});

// ── Menores ──────────────────────────────────────────────────────────────────────────────────

test('m. un horario sin `activo` booleano se rechaza; apagado con días vacíos o al revés se guarda apagado', () => {
  for (const h of [{ desde: 9, hasta: 18, dias: [1] }, { activo: 'true', desde: 9, hasta: 18, dias: [1] }, { activo: 1, desde: 9, hasta: 18, dias: [1] }]) {
    const r = configParaGuardar({}, { horario: h });
    assert.equal(r.ok, false, `${JSON.stringify(h)} quedaba «sin horario»: a las 3 AM`);
  }
  for (const h of [{ activo: false, desde: 9, hasta: 18, dias: [] }, { activo: false, desde: 18, hasta: 9, dias: [1] }]) {
    const r = configParaGuardar({ horario: { activo: true, desde: 10, hasta: 12, dias: [1] } }, { horario: h });
    assert.ok(r.ok, `apagarlo ${JSON.stringify(h)} se rechazaba y seguía el último horario prendido`);
    assert.equal(r.ok && r.config.horario?.activo, false);
  }
  // Prendido, lo de siempre.
  assert.equal(configParaGuardar({}, { horario: { activo: true, desde: 18, hasta: 9, dias: [1] } }).ok, false);
  // «Como el negocio» en todo = vacía: quien guarda BORRA la clave.
  const v = configParaGuardar({ horario: null, goteo: { minutos: 3 } }, { horario: null, goteo: null });
  assert.ok(v.ok && v.vacia);
  const lleno = configParaGuardar({}, { goteo: { minutos: 3 } });
  assert.ok(lleno.ok && !lleno.vacia);
  const db = sinComentarios(leer('lib/config-automatizacion-db.ts'));
  assert.match(db, /if \(r\.vacia\) await borrarConfig\(ws, secuenciaId\);\n\s+else await setSetting\(claveConfigAutomatizacion\(secuenciaId\), r\.valor\);/);
});

// 22/10/2026 (Martín: «Elimina todo el texto innecesario... Lo mismo en «Horario»»): sin la línea «Como el negocio: …» ni
// «Sólo para esta automatización: sin horario…». «Horario propio» es una fila con su interruptor; lo del negocio, en su ⓘ.
// Propio y «Horario de oficina» apagado (manda a cualquier hora) lo dice el interruptor de «Horario de oficina».
// 23/10/2026 («"propio" se dice "Horario de oficina"»): sin la fila «Horario propio»; el panel «Horario de oficina» con el
// horario que vale (el suyo o el del negocio), guardando en la automatización.
test('m. el horario de la automatización es «Horario de oficina», con el que vale para ella, y sin texto suelto', () => {
  const p = sinComentarios(leer('app/automations/ConfigAutomatizacionPanel.tsx'));
  assert.match(p, /leer: async \(\) => \(\{ horario: d\.config\.horario \?\? d\.horarioNegocio \?\? \{ \.\.\.HORARIO_SUGERIDO, activo: false \}, zona: d\.zona, puedeEditar: d\.puedeEditar \}\),/);
  assert.match(p, /return <HorarioEnvioPanel fuente=\{fuente\} onSucio=\{onSucio\} \/>;/);
  assert.doesNotMatch(p, /Horario propio|Como el negocio|Sólo para esta automatización|data-sin-horario/, 'volvió el texto suelto');
  assert.equal(textoDeHorario(null), 'sin horario: manda a cualquier hora');
});

test('m. sin la zona se cierran SÓLO las que tienen horario; lo propio ilegible no frena el carril de todas', () => {
  const configs = new Map<number, ConfigAutomatizacion>([[1, { horario: { activo: true, desde: 10, hasta: 12, dias: [1, 2, 3, 4, 5] } }]]);
  // El negocio sin horario: la 1 (con el suyo) cerrada, la 2 (de anuncios, sin nada) sigue.
  assert.deepEqual([...cerradasAhora([1, 2], configs, null, Date.now(), null)], [1]);
  const m = sinComentarios(leer('lib/nutricion.ts'));
  const pe = cuerpo(m, 'export async function procesarEnvios(');
  assert.match(pe, /if \(conHorario && tz === ZONA_ILEGIBLE\) \{\n\s+cerradas = cerradasAhora\(ids, configs, horario, Date\.now\(\), null\);\n\s+if \(!ids\.length \|\| cerradas\.size === ids\.length\) fueraDeHorario = 'zona-ilegible';/);
  // Revisión del 20/10/2026, noche (tests/automations-aviso-todos-caminos.test.ts): con `ignorar_ventana` (sin corte del horario) lo propio ilegible corta.
  assert.match(pe, /if \(limites === 'ilegible' \|\| \(configs === 'ilegible' && fueraDeHorario == null\)\) return \{ \.\.\.res, saltado: 'limites-ilegibles' \};/);
  assert.doesNotMatch(pe, /\|\| configs === 'ilegible'\) return/, 'lo propio ilegible vuelve a cortar el carril de todas');
  // Y sin lo propio, la prospección sigue cerrada (el horario «no pude leer»).
  assert.match(pe, /if \(horario === 'ilegible' \|\| configs === 'ilegible'\) fueraDeHorario = 'horario-ilegible';/);
});

test('m. el tick: la lectura de los horarios propios trae sólo los prendidos, con tope, y si falla sigue', () => {
  const ruta = sinComentarios(leer('app/api/cron/nutricion-tick/route.ts'));
  assert.match(ruta, /\.like\('key', `\$\{CLAVE_PREFIJO\}%`\)\.like\('value', '%"activo":true%'\)\.limit\(1000\);/);
  assert.match(ruta, /if \(eProp\) console\.error\(`\[cron:nutricion-tick\] horarios propios: \$\{eProp\.message\}`\);/);
  assert.doesNotMatch(ruta, /throw new Error\(`horarios propios/);
  // El filtro de texto encuentra lo que escribe `configParaGuardar` (JSON sin espacios).
  const r = configParaGuardar({}, { horario: { activo: true, desde: 9, hasta: 18, dias: [1] } });
  assert.ok(r.ok && r.valor.includes('"activo":true'));
});

// 22/10/2026: el goteo (23/10/2026: de WhatsApp y de Email; sin «Misma persona») en UN componente (`AntibanDeLaAutomatizacion`) y UN guardado por respiro.
test('m. el anti-ban de esta automatización: lo tocado se ve ya y los cambios del respiro se juntan (los dos campos)', () => {
  const p = sinComentarios(leer('app/automations/ConfigAutomatizacionPanel.tsx'));
  // Desde el 24/10/2026 (f21) es UN goteo para todos los canales: los campos van sueltos y se guardan en `goteo`.
  const g = cuerpo(p, "const guardar = (cambio: CambioGoteo) => {", '\n  };');
  assert.match(g, /pendiente\.current = \{ \.\.\.pendiente\.current, \.\.\.cambio \};/);
  assert.match(g, /setLocal\(\(p\) => \(\{ \.\.\.p, \.\.\.cambio \}\)\);/);
  assert.match(g, /const envio = pendiente\.current;\n\s+pendiente\.current = \{\};[\s\S]*saveConfigAutomatizacionAction\(secuenciaId, \{ goteo: envio \}\)/);
  assert.match(p, /const leido = \(campo: 'minutos' \| 'dia'\): number \| undefined => \(campo in local \? \(local\[campo\] as number \| null\) \?\? undefined : d\?\.config\.goteo\?\.\[campo\]\);/);
});

test('m. la tuerca la ve también quien no es admin (el modal entra en sólo lectura)', () => {
  const s = sec(5, 'Bienvenida');
  const html = renderToStaticMarkup(createElement(SecuenciaPerfil, {
    secuencia: s, secuencias: [s], productos: [], disparadores: [], onAbrirClave: () => {}, objetivos: [],
    etiquetaEtapa: (k: string) => k, rolAdmin: false, audios: [], negocio: 'Mi negocio', canalCaido: false, tz: null,
    onAudioNuevo: () => {}, onCambio: () => {}, Configuraciones: () => null,
    muelles: muelles({ w: 1440, h: 900 }, { listaAbierta: true, probarAbierto: false, editorAbierto: false }),
  } as Parameters<typeof SecuenciaPerfil>[0]));
  assert.ok(html.includes('data-boton-tuerca'), 'el setter perdió la vista del horario y los límites');
});

test('m. el aviso de Prospección: una consulta a la vez, y la que ya tiene lo suyo queda avisada', () => {
  const p = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
  const c = cuerpo(p, 'const conAvisoProspeccion = (seguir: () => void) => {', '\n  };');
  assert.match(c, /if \(consultandoProspeccion\.current\) return;\n\s+consultandoProspeccion\.current = true;/);
  assert.match(c, /\.finally\(\(\) => \{ consultandoProspeccion\.current = false; \}\);/);
  assert.match(c, /if \(propia\) \{ avisadaProspeccion\.add\(secuencia\.id\); seguir\(\); \}/);
});

test('m. «contesta sola» del AI Step mira el horario de SU automatización, estricto', () => {
  const m = sinComentarios(leer('lib/nutricion.ts'));
  const h = cuerpo(m, 'async function horarioDeEnvioDe(');
  assert.match(h, /leerConfigAutomatizacion\(secuenciaId\)\.catch\(\(\) => 'ilegible' as const\)/);
  assert.match(h, /if \(h === 'ilegible' \|\| c === 'ilegible'\) return 'ilegible';\n\s+return horarioDeLaAutomatizacion\(c, h\);/);
  assert.equal((m.match(/horarioDeEnvioDe\(secuencia\.id\)/g) ?? []).length, 2, 'las dos puertas de «Sola» (WhatsApp y redes)');
});

// PROBADO ROMPIÉNDOLO (20/10/2026, arnés `romper.py` + `roturas-config-revision.json`, una rotura por vez y restaurada
// con md5 igual). Base 14 / 0. Cada una → 13 / 1:
//    1. la tuerca vuelve a cambiar el huso                  15. guardar no borra la clave
//    2. «Duplicar» sin copiar la configuración              16. la tarjeta no dice «manda a cualquier hora»
//    3. la copia de la configuración, afuera              17. sin la zona se corta todo
//    4. copiar también sin nada propio                      18. lo propio ilegible corta el carril
//    5. la ruta de «Duplicar» sin copiar                    19. el tick sin el filtro de los prendidos
//    6. las horas del negocio escondidas otra vez           20. el tick tira si falla esa lectura
//    7. al entrar, el chat de la primera                    21. el respiro no junta los cambios
//    8. Escape corta el pedido escondido                    22. sin el valor optimista
//    9. Escape con un modal abierto corta                   23. la tuerca sólo para el admin
//   10. la «Evento de MaKo» sin su fila                     24. Prospección consulta dos veces
//   11. la «Evento de MaKo» sin su configuración            25. la que tiene lo suyo no queda avisada
//   12. un `activo` no booleano pasa                        26. «contesta sola» con el horario del negocio
//   13. apagar con los días vacíos se rechaza               27. «contesta sola»: lo propio ilegible = el del negocio
//   14. nunca vacía
// Restaurado: 14 / 0.
