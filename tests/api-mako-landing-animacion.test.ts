// =============================================================================
// Las animaciones del Web Generator en la API de MaKo: cambiar_animacion_landing (15/10/2026)
// =============================================================================
// El panel «Animar» del editor (app/web-generator/editor/paneles/PanelAnimacion.tsx) tiene dos niveles: el interruptor y
// el ESTILO de toda la landing (`config.pagina.animaciones` y `config.pagina.estiloAnimacion`) y el EFECTO de una sección
// (`animacion` y `animacionDireccion` en los attrs de su tarjeta). El contrato es lib/editor-landing/animaciones.ts. Regla
// de AGENTS.md y de Martín: toda capacidad nueva va a la API de MaKo en el mismo trabajo. Lo que fija este archivo:
//   1. la FORMA, con el molde de cambiar_tema_landing: por chat, reversible (restaurar_version_landing), la puerta de la
//      página, por http con su fila REST, el catálogo EN los parámetros (sin lectura aparte), nunca por bloque y nunca el
//      video de fondo; corre por la MISMA fábrica de ediciones (versión de antes + compare-and-set);
//   2. lo puro (`planAnimacion`): cada valor fuera del catálogo se rechaza nombrando los válidos, la sección por id o por
//      número, la dirección que se conserva con la MISMA regla que el panel (`cambiosAlElegir`, comparado caso por caso),
//      «ya está así», y lo que arma pasa el saneo del server;
//   3. la LECTURA: ver_configuracion_landing cuenta el interruptor, el estilo y el efecto propio de cada sección;
//   4. WhatsApp con el turno que CORRE (clasificarIntencion + herramientasDelTurno, molde tests/agenda-whatsapp.test.ts).
//
// MEDIDO ANTES (15/10/2026, con el turno que corre y la operación ya declarada): «anima mi landing», «ponle la animación
// Deslizar a la sección 2» y «quita las animaciones de la landing» salían `capturar` dudosa, con 2 herramientas y ninguna
// de landing. Con la regla de editar sola («anima» como verbo y la animación como pieza), «puedes animar mi landing?» y
// «ponle el efecto barrido… a la sección de testimonios» llegaban SIN la herramienta: empataban en 4 puntos con una
// docena de operaciones declaradas antes y la de animar (2.490 caracteres entonces) no entraba en los 12.000. Y sumar la
// operación sacó a publicar_landing de «subí los cambios de mi landing» (la frase repetida de las ediciones decía
// «subirla»; ver VERSION en landing-editor.def.ts).
//
// PROBADO ROMPIÉNDOLO: los números al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { porId, raices, type Vista } from '../lib/api-mako/registro';
import { esAccion, type AccionDef } from '../lib/api-mako/tipos';
import { rutaRestDe } from '../lib/api-mako/rest';
import { NODO, type JsonNodo, type LandingContenido } from '../lib/editor-landing/doc';
import { CONFIG_DEFAULT, type ConfigLanding } from '../lib/editor-landing/api-tipos';
import { TEMAS } from '../lib/editor-landing/temas';
import { sanearContenido } from '../lib/editor-landing/validar';
import { EFECTOS, ESTILOS_PAGINA, IDS_EFECTO, IDS_ESTILO, DIRECCIONES, SIN_ANIMACION, type DefEfecto } from '../lib/editor-landing/animaciones';
import { cambiosAlElegir } from '../app/web-generator/editor/animacion-reglas';
import {
  planAnimacion, configuracionParaApi, ubicarSeccionPorIdONumero, descartesDe, esFallaPlan, EFECTOS_API, HEREDAR_ANIMACION,
  type FallaPlan, type PlanConfig, type PlanContenido,
} from '../lib/api-mako/areas/landing-contenido.helpers';
import { clasificarIntencion, esPedidoDeLanding } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const ID = 'cambiar_animacion_landing';

const accion = (id: string): AccionDef => {
  const d = porId(id);
  assert.ok(d && esAccion(d), `«${id}» no es una acción del registro`);
  return d;
};

// ── Una landing de prueba ──────────────────────────────────────────────────────

const txt = (t: string): JsonNodo => ({ type: 'text', text: t });
const p = (t: string): JsonNodo => ({ type: 'paragraph', content: [txt(t)] });
const h = (t: string, level = 2): JsonNodo => ({ type: 'heading', attrs: { level }, content: [txt(t)] });
const tarjeta = (id: string, content: JsonNodo[], attrs: Record<string, unknown> = {}): JsonNodo => ({ type: NODO.tarjeta, attrs: { id, ...attrs }, content });

function landing(): LandingContenido {
  return {
    v: 1,
    paginas: [
      {
        id: 'pInicio', titulo: 'Inicio', ruta: '',
        doc: {
          type: 'doc',
          content: [
            tarjeta('tHero', [h('Aprende a vender', 1), p('Agenda tu llamada gratis hoy')]),
            tarjeta('tBeneficios', [h('Beneficios'), p('Llamada gratis y sin compromiso')], { animacion: 'deslizar', animacionDireccion: 'abajo' }),
            tarjeta('tPrecios', [h('Precios'), p('Desde 10 USD')], { animacion: 'ninguna' }),
          ],
        },
      },
      { id: 'pGracias', titulo: 'Gracias', ruta: 'gracias', doc: { type: 'doc', content: [tarjeta('tGracias', [h('¡Gracias!', 1), p('Te escribimos pronto')])] } },
    ],
  };
}
const config = (): ConfigLanding => JSON.parse(JSON.stringify({ ...CONFIG_DEFAULT, tema: TEMAS[0].id })) as ConfigLanding;
const doc = () => ({ config: config(), contenido: landing() });
type Plan = PlanConfig | PlanContenido | FallaPlan;
const ok = (r: Plan): PlanConfig | PlanContenido => {
  assert.ok(!esFallaPlan(r), `el plan falló: ${(r as FallaPlan).error}`);
  return r as PlanConfig | PlanContenido;
};
const falla = (r: Plan): FallaPlan => {
  assert.ok(esFallaPlan(r), `se esperaba un rechazo y pasó: ${JSON.stringify(r).slice(0, 200)}`);
  return r as FallaPlan;
};
/** Los attrs de animación de la sección `id` en lo que arma el plan. */
const animDe = (c: LandingContenido, id: string) => {
  for (const pg of c.paginas) for (const t of pg.doc.content ?? []) {
    if (t.attrs?.id === id) return { animacion: t.attrs.animacion ?? null, animacionDireccion: t.attrs.animacionDireccion ?? null };
  }
  throw new Error(`no está la sección ${id}`);
};

// ── 1. La forma ─────────────────────────────────────────────────────────────────

test('la forma: el molde de cambiar_tema_landing (chat, reversible, la puerta de la página, http con su fila REST)', () => {
  const d = accion(ID);
  const tema = accion('cambiar_tema_landing');
  assert.equal(d.area, 'landing');
  assert.equal(d.confirmacion, 'chat');
  assert.equal(d.reversible, true);
  assert.equal(d.costo, 'gratis');
  assert.deepEqual(d.gating, tema.gating, 'la puerta de /web-generator: admin y la tab');
  assert.deepEqual([...d.canales].sort(), [...tema.canales].sort());
  assert.match(d.descripcion, /restaurar_version_landing/, 'dice cómo se vuelve atrás');
  assert.deepEqual(rutaRestDe(ID), { metodo: 'PATCH', ruta: '/landing/documentos/{id}/animaciones' });
  // El catálogo va EN los parámetros, del contrato: ni un efecto ni un estilo escritos a mano.
  const par = (n: string) => d.parametros.find((x) => x.nombre === n);
  assert.deepEqual(par('efecto')?.enum, [...IDS_EFECTO, SIN_ANIMACION, HEREDAR_ANIMACION]);
  assert.deepEqual(par('estilo')?.enum, [...IDS_ESTILO]);
  assert.deepEqual(par('direccion')?.enum, [...DIRECCIONES]);
  assert.equal(par('activas')?.tipo, 'boolean');
  for (const e of EFECTOS) assert.ok(par('efecto')!.descripcion.includes(e.id), `el efecto ${e.id} no está en la descripción`);
  for (const e of ESTILOS_PAGINA) assert.ok(par('estilo')!.descripcion.includes(e.id), `el estilo ${e.id} no está en la descripción`);
  assert.match(par('estilo')!.descripcion, /maquina \(Máquina de escribir\)/, 'el nombre cuando el id no lo dice');
  // Nunca por bloque y nunca el video de fondo.
  assert.ok(!d.parametros.some((x) => /bloque|video/i.test(x.nombre)), 'ni un bloque ni el video de fondo por la API');
  assert.doesNotMatch(d.descripcion, /video/i);
});

test('corre por la MISMA fábrica de ediciones (versión de antes + compare-and-set) y la lectura recibe el contenido', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/landing-editor.run.ts'));
  assert.match(run, /^ {2}cambiar_animacion_landing: \{ \.\.\.edicion\(\{ que: 'cambiar las animaciones', planear: \(i, d\) => planAnimacion\(d, i\) \}\) \},$/m);
  assert.match(run, /configuracionParaApi\(id, r\.doc\.config, await temasPropios\(\), r\.doc\.contenido\)/, 'ver_configuracion_landing cuenta las animaciones de cada sección');
});

test('la frase que se repite en las ediciones no lleva raíces de las intenciones de OTRAS operaciones (tanda 7)', () => {
  const tema = accion('cambiar_tema_landing').descripcion;
  const frase = tema.slice(tema.indexOf('Antes guarda una versión'));
  assert.ok(frase.length > 20 && accion(ID).descripcion.endsWith(frase), 'la misma frase en las dos');
  // publicar («publicá», «subí», «súbela») y despublicar («sacá de internet», «de línea»), y lo del id de la lista.
  const ajenas = ['publi', 'subi', 'sube', 'subel', 'subir', 'inter', 'linea', 'cread', 'lista'];
  assert.deepEqual(raices(frase).filter((r) => ajenas.some((a) => r.startsWith(a) || a.startsWith(r))), []);
});

// ── 2. Lo puro: planAnimacion ───────────────────────────────────────────────────

test('el interruptor y el estilo de la landing: cambian la config, «ya está así», y lo de afuera nombra lo que vale', () => {
  const apagar = ok(planAnimacion(doc(), { activas: false })) as PlanConfig;
  assert.equal(apagar.config.pagina.animaciones, false);
  assert.ok(!('contenido' in apagar) || !apagar.contenido, 'el interruptor no toca las secciones');
  assert.equal(falla(planAnimacion(doc(), { activas: true })).yaEstaba, true);
  const est = ok(planAnimacion(doc(), { estilo: 'maquina' })) as PlanConfig;
  assert.equal(est.config.pagina.estiloAnimacion, 'maquina');
  assert.match(est.resumen, /Subir → Máquina de escribir/);
  assert.equal(falla(planAnimacion(doc(), { estilo: 'subir' })).yaEstaba, true, 'subir es el de siempre');
  const mal = falla(planAnimacion(doc(), { estilo: 'explosion' }));
  for (const e of IDS_ESTILO) assert.ok(mal.error.includes(e), `el rechazo no nombra ${e}: ${mal.error}`);
  assert.match(falla(planAnimacion(doc(), { activas: 'si' })).error, /true o false/);
  assert.match(falla(planAnimacion(doc(), {})).error, /Falta qué cambiar/);
  // Con el interruptor apagado se guarda igual (como el panel), y se dice.
  const d = doc();
  d.config.pagina.animaciones = false;
  assert.match(ok(planAnimacion(d, { estilo: 'barrido' })).resumen, /apagadas.*activas:true/);
});

test('el efecto de UNA sección: por id o por número, sólo esa sección, sin tocar sus bloques ni la config', () => {
  const r = ok(planAnimacion(doc(), { seccion: 'tHero', efecto: 'deslizar', direccion: 'derecha' }));
  assert.ok(!('config' in r), 'una sección sola no reescribe la config');
  const c = (r as PlanContenido).contenido;
  assert.deepEqual(animDe(c, 'tHero'), { animacion: 'deslizar', animacionDireccion: 'derecha' });
  assert.deepEqual(r.datos, { seccion: 'tHero' });
  // Las demás, igual; y los bloques de la sección, intactos.
  const antes = landing();
  assert.deepEqual(c.paginas[0].doc.content?.slice(1), antes.paginas[0].doc.content?.slice(1));
  assert.deepEqual(c.paginas[0].doc.content?.[0].content, antes.paginas[0].doc.content?.[0].content);
  assert.match(r.resumen, /«Aprende a vender»: la de la landing → Deslizar desde la derecha/);
  // Por número: «2» (también como número) es la segunda de la página de inicio; con `pagina`, la de esa página.
  for (const n of ['2', 2]) assert.equal(String((ubicarSeccionPorIdONumero(landing(), n) as { tarjeta: JsonNodo }).tarjeta.attrs?.id), 'tBeneficios');
  assert.equal(String((ubicarSeccionPorIdONumero(landing(), '1', 'pGracias') as { tarjeta: JsonNodo }).tarjeta.attrs?.id), 'tGracias');
  const tres = ok(planAnimacion(doc(), { seccion: '3', efecto: 'iris' })) as PlanContenido;
  assert.equal(animDe(tres.contenido, 'tPrecios').animacion, 'iris');
  assert.match(falla(planAnimacion(doc(), { seccion: '9', efecto: 'iris' })).error, /de 1 a 3/);
  assert.ok(Array.isArray(falla(planAnimacion(doc(), { seccion: 'tNoEsta', efecto: 'iris' })).disponibles));
  assert.match(falla(planAnimacion(doc(), { seccion: '1', pagina: 'pNo', efecto: 'iris' })).error, /página/);
  // Lo que falta, con `faltan`.
  assert.deepEqual(falla(planAnimacion(doc(), { efecto: 'iris' })).faltan, ['seccion']);
  assert.deepEqual(falla(planAnimacion(doc(), { seccion: 'tHero' })).faltan, ['efecto']);
});

test('«ninguna» la deja quieta y «heredar» le quita el suyo; lo de afuera del catálogo se rechaza nombrando lo que vale', () => {
  const quieta = ok(planAnimacion(doc(), { seccion: 'tBeneficios', efecto: 'ninguna' })) as PlanContenido;
  assert.deepEqual(animDe(quieta.contenido, 'tBeneficios'), { animacion: 'ninguna', animacionDireccion: null });
  const hereda = ok(planAnimacion(doc(), { seccion: 'tBeneficios', efecto: 'heredar' })) as PlanContenido;
  assert.deepEqual(animDe(hereda.contenido, 'tBeneficios'), { animacion: null, animacionDireccion: null });
  assert.equal(falla(planAnimacion(doc(), { seccion: 'tHero', efecto: 'heredar' })).yaEstaba, true);
  assert.equal(falla(planAnimacion(doc(), { seccion: 'tPrecios', efecto: 'ninguna' })).yaEstaba, true);
  const mal = falla(planAnimacion(doc(), { seccion: 'tHero', efecto: 'explosion' }));
  for (const e of EFECTOS_API) assert.ok(mal.error.includes(e), `el rechazo no nombra ${e}`);
  const dir = falla(planAnimacion(doc(), { seccion: 'tBeneficios', direccion: 'diagonal' }));
  for (const x of DIRECCIONES) assert.ok(dir.error.includes(x), `el rechazo no nombra ${x}`);
  // La dirección sólo con un efecto que la tiene (los nombres salen del catálogo).
  const sinDir = falla(planAnimacion(doc(), { seccion: 'tHero', efecto: 'aparecer', direccion: 'abajo' }));
  const conDir = (EFECTOS as readonly DefEfecto[]).filter((e) => e.direcciones?.length).map((e) => e.nombre);
  assert.match(sinDir.error, /«Aparecer» no tiene dirección/);
  for (const n of conDir) assert.ok(sinDir.error.includes(n), sinDir.error);
  assert.match(falla(planAnimacion(doc(), { seccion: 'tHero', direccion: 'abajo' })).error, /Sin un efecto propio/);
});

test('la dirección: sólo la dirección cambia la del efecto de ahora; al cambiar de efecto se conserva si el nuevo la tiene', () => {
  const sube = ok(planAnimacion(doc(), { seccion: 'tBeneficios', direccion: 'arriba' })) as PlanContenido;
  assert.deepEqual(animDe(sube.contenido, 'tBeneficios'), { animacion: 'deslizar', animacionDireccion: 'arriba' });
  const barrido = ok(planAnimacion(doc(), { seccion: 'tBeneficios', efecto: 'barrido' })) as PlanContenido;
  assert.deepEqual(animDe(barrido.contenido, 'tBeneficios'), { animacion: 'barrido', animacionDireccion: 'abajo' }, 'de Deslizar a Barrido sigue «desde abajo»');
  const aparecer = ok(planAnimacion(doc(), { seccion: 'tBeneficios', efecto: 'aparecer' })) as PlanContenido;
  assert.deepEqual(animDe(aparecer.contenido, 'tBeneficios'), { animacion: 'aparecer', animacionDireccion: null }, 'Aparecer no tiene dirección: se cae');
  // «Ya está así» mira lo que SE VE: la dirección de default dicha explícita no es un cambio.
  const d = doc();
  (d.contenido.paginas[0].doc.content![0].attrs as Record<string, unknown>).animacion = 'deslizar';
  assert.equal(falla(planAnimacion(d, { seccion: 'tHero', efecto: 'deslizar', direccion: 'izquierda' })).yaEstaba, true);
  assert.equal(falla(planAnimacion(doc(), { seccion: 'tBeneficios', efecto: 'deslizar', direccion: 'abajo' })).yaEstaba, true);
});

test('la MISMA regla que el panel: cada efecto, con cada dirección guardada, a cada efecto (cambiosAlElegir)', () => {
  const desde: (string | null)[] = [null, SIN_ANIMACION, ...IDS_EFECTO];
  const dirs: (string | null)[] = [null, ...DIRECCIONES];
  const hacia = EFECTOS_API;
  const distintos: string[] = [];
  let comparados = 0;
  for (const a of desde) for (const dAntes of dirs) for (const b of hacia) {
    const d = doc();
    const t = d.contenido.paginas[0].doc.content![0];
    t.attrs = { ...t.attrs, animacion: a, animacionDireccion: dAntes };
    const panel = cambiosAlElegir(b === HEREDAR_ANIMACION ? null : b, { animacionDireccion: dAntes });
    const r = planAnimacion(d, { seccion: 'tHero', efecto: b });
    if (esFallaPlan(r)) {
      // «Ya está así»: lo que escribiría el panel se ve igual que lo de ahora.
      assert.equal(r.yaEstaba, true, `${a}/${dAntes} → ${b}: ${r.error}`);
      continue;
    }
    comparados++;
    const api = animDe((r as PlanContenido).contenido, 'tHero');
    if (JSON.stringify(api) !== JSON.stringify(panel)) distintos.push(`${a}/${dAntes} → ${b}: api ${JSON.stringify(api)} panel ${JSON.stringify(panel)}`);
  }
  assert.ok(comparados > 1500, `comparó ${comparados}`);
  assert.deepEqual(distintos.slice(0, 5), []);
});

test('lo que arma pasa el saneo del server (validar.ts) sin descartes y con la animación puesta', () => {
  const r = ok(planAnimacion(doc(), { activas: true, estilo: 'deslizar', seccion: 'tHero', efecto: 'barrido', direccion: 'arriba' })) as PlanConfig;
  assert.equal(r.config.pagina.estiloAnimacion, 'deslizar');
  assert.ok(r.contenido, 'el estilo y la sección en un solo cambio');
  assert.deepEqual(descartesDe(r.contenido!.paginas[0].doc.content!), []);
  const saneado = sanearContenido(r.contenido);
  assert.deepEqual(saneado.descartes, []);
  assert.deepEqual(animDe(saneado.contenido, 'tHero'), { animacion: 'barrido', animacionDireccion: 'arriba' });
});

// ── 3. La lectura ───────────────────────────────────────────────────────────────

test('ver_configuracion_landing cuenta el interruptor, el estilo y el efecto PROPIO de cada sección (con su dirección)', () => {
  const c = landing();
  (c.paginas[1].doc.content![0].attrs as Record<string, unknown>).animacion = 'barrido';
  const cfg = config();
  cfg.pagina.estiloAnimacion = 'palabras';
  const r = configuracionParaApi(7, cfg, [], c);
  assert.equal(r.animaciones, true);
  assert.deepEqual(r.estilo_animacion, { id: 'palabras', nombre: 'Palabras' });
  assert.deepEqual(r.animacion_por_seccion, [
    { pagina: 'pInicio', seccion: 'tBeneficios', n: 2, titulo: 'Beneficios', efecto: 'deslizar', nombre: 'Deslizar', direccion: 'abajo' },
    { pagina: 'pInicio', seccion: 'tPrecios', n: 3, titulo: 'Precios', efecto: 'ninguna', nombre: 'Ninguna', direccion: null },
    { pagina: 'pGracias', seccion: 'tGracias', n: 1, titulo: '¡Gracias!', efecto: 'barrido', nombre: 'Barrido', direccion: 'izquierda' },
  ], 'las que heredan no se listan; la dirección es la que se ve');
  assert.match(r.nota, /cambiar_animacion_landing/);
  // Lo de antes de este catálogo (sin estilo guardado) se lee con el de siempre.
  const viejo = config() as unknown as { pagina: Record<string, unknown> };
  delete viejo.pagina.estiloAnimacion;
  assert.deepEqual(configuracionParaApi(7, viejo as unknown as ConfigLanding, []).estilo_animacion, { id: 'subir', nombre: 'Subir' });
});

// ── 4. WhatsApp, con el turno que CORRE ──────────────────────────────────────────

/** Los NOMBRES de las herramientas de siempre (server-only), pedidos a un node aparte con la condición del server. */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const vista: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };
const turno = (mensaje: string): string[] => {
  const veredicto = clasificarIntencion(mensaje, {});
  return herramientasDelTurno({ veredicto, texto: mensaje, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista, hayPendientes: false }).tools.map((t) => t.name);
};

test('por WhatsApp: los pedidos de animar llegan con cambiar_animacion_landing y con la lista (de dónde sale el id)', () => {
  const frases = [
    // Las tres del pedido.
    'anima mi landing',
    'ponle la animación Deslizar a la sección 2',
    'quita las animaciones de la landing',
    // Con y sin voseo, con pronombre, con modal, con el efecto en vez de la animación.
    'animá la landing del webinar',
    'anímala, la landing del curso',
    'puedes animar mi landing?',
    'necesito que le pongas animaciones a mi página de gracias',
    'apaga las animaciones de mi landing',
    'prende las animaciones de la landing',
    'cambia la animación de mi landing a Palabras',
    'ponle el efecto barrido desde abajo a la sección de testimonios',
    'quítale la animación a la sección 2',
    // «de la web» no es sacarla de internet.
    'quita las animaciones de la web',
  ];
  const sin: string[] = [];
  for (const f of frases) {
    const n = turno(f);
    if (!n.includes(ID) || !n.includes('listar_landings_creadas')) sin.push(`«${f}» → ${clasificarIntencion(f, {}).porque} (${n.includes(ID) ? 'sin la lista' : 'sin la herramienta'})`);
  }
  assert.deepEqual(sin, [], `\n${sin.join('\n')}`);
  for (const f of frases) assert.equal(esPedidoDeLanding(f)?.tipo, 'animar', f);
});

test('lo que NO es animar una landing no se lee como eso, y publicar, crear y despublicar siguen siendo lo suyo', () => {
  const nada = [
    'ponle una animación al diseño',
    'anima a tu equipo',
    'vendo comida para animales, mira mi landing',
    'ponle animación al video del reel',
    'cambia la animación del anuncio',
    '¿cómo animo mi landing?',
    'mi socio anima la landing el lunes',
    'al plan: quita las animaciones de la landing',
    'ponle efectos a la foto de perfil de mi página de facebook',
  ];
  for (const f of nada) {
    assert.notEqual(esPedidoDeLanding(f)?.tipo, 'animar', f);
    assert.ok(!turno(f).includes(ID), `«${f}» trajo ${ID}`);
  }
  const otros: Array<[string, string]> = [
    ['sube la landing con animaciones', 'publicar'],
    ['publica la landing animada', 'publicar'],
    ['crea una landing con animaciones', 'crear'],
    ['despublicá la landing de las animaciones', 'despublicar'],
  ];
  for (const [f, tipo] of otros) assert.equal(esPedidoDeLanding(f)?.tipo, tipo, f);
  // Sumar la operación (con «cambi» en su id) no le quita su herramienta a «subí los cambios»: la frase repetida de las
  // ediciones ya no dice «subirla».
  assert.ok(turno('subí los cambios de mi landing').includes('publicar_landing'));
});

// =============================================================================
// ROTURAS (15/10/2026). Arnés del scratchpad (romper.mjs): reemplaza UNA ocurrencia exacta, corre este archivo, lo
// restaura DE MEMORIA y verifica el sha256 (las 16, restauradas). Base: 12 pasan / 0 fallan. pasan / fallan:
//   R1  sin conservar la dirección al cambiar de efecto ................ 10 / 2 (la dirección; la regla del panel)
//   R2  la sección por número corrida en uno ............................ 11 / 1 (el efecto de UNA sección)
//   R3  un efecto fuera del catálogo se acepta .......................... 11 / 1 («ninguna» y «heredar»)
//   R4  «ya está así» mira lo guardado y no lo que se ve ................ 11 / 1 (la dirección)
//   R5  sin avisar que las animaciones están apagadas ................... 11 / 1 (el interruptor y el estilo)
//   R6  la lectura lista también las secciones que heredan .............. 11 / 1 (ver_configuracion_landing)
//   R7  ver_configuracion_landing sin el contenido ...................... 11 / 1 (la misma fábrica)
//   R8  en pantalla y no por chat ....................................... 11 / 1 (la forma)
//   R9  el enum sin «heredar» ........................................... 11 / 1 (la forma)
//   R10 la frase repetida vuelve a decir «subirla» ...................... 10 / 2 (las raíces; «subí los cambios»)
//   R11 sin la regla de animar en esPedidoDeLanding ..................... 11 / 1 (WhatsApp)
//   R12 animar DESPUÉS de despublicar («… de la web») .................... 11 / 1 (WhatsApp)
//   R13 la relevancia de animar = la de editar («landings creadas») ..... 11 / 1 (WhatsApp)
//   R14 «anima» con le/les («animales» pasa a ser un pedido) ............ 11 / 1 (lo que NO es animar)
//   R15 sin aceptar la sección en vez de la landing ..................... 11 / 1 (WhatsApp)
//   R16 la animación no es una pieza («quita las animaciones de…») ...... 11 / 1 (WhatsApp)
// Restaurado: 12 / 0.
// =============================================================================
