// =============================================================================
// El «clic en un anuncio» en Crear con IA, en Editar y en «¿Qué hace esta automatización?» (la revisión del Cerebro, 28/10/2026)
// =============================================================================
// 44daa5f2e prendió el CRON del anuncio (lo prometido a Teo) y lo puso en el catálogo de la IA sólo si el pedido lo nombra
// (`PIDE_ANUNCIO`, el techo de Groq). Tres huecos que sobrevivieron al refutador
// (C:/dev/revisiones/2810-verificacion-automations-anuncio.md):
//   · «Cuando alguien hace clic en mi anuncio…» preguntaba «¿Qué hace la persona?» SIN ofrecer el anuncio (no había palabra
//     para él en `PALABRAS_EVENTO`), y con «Otra cosa: cuando hacen clic en mi anuncio» el contexto seguía sin traerlo;
//   · Messenger perdió «enlace de referencia» en esa pregunta: el anuncio, primero de la lista, ocupaba uno de los 3 lugares
//     y después se filtraba;
//   · «¿Qué hace esta automatización?» sobre una con el CRON del anuncio: el contexto no lo traía y MaKo decía «no tiene CRON».
// Correr: node --import tsx --test tests/crear-ia-anuncio.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { opcionesCronIA, type CanalesConectadosIA } from '../lib/disparadores';
import { disparadoresParaIA, type CtxIA } from '../lib/flujo-ia';
import { preguntaAntes, diceQueHace, textosDeRespuestas } from '../lib/flujo-ia-preguntas';
import type { RespuestaMako } from '../lib/automatizacion-chat';

const leer = (p: string): string => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const NINGUNO: CanalesConectadosIA = { instagram: false, messenger: false, email: false, pagos: false };

function ctx(conectados: Partial<CanalesConectadosIA>, anuncio: boolean): CtxIA {
  return {
    etiquetas: [], audios: [], archivos: [], acciones: [], links: {}, pedido: '', productos: [],
    disparadores: disparadoresParaIA(opcionesCronIA({ productos: [], etiquetas: [], conectados: { ...NINGUNO, ...conectados }, anuncio })),
  };
}

test('crear: el pedido que nombra el anuncio ya dice qué hace la persona (no se pregunta sin ofrecerlo)', () => {
  const pedido = 'Cuando alguien hace clic en mi anuncio de Instagram, mandale el link del catálogo';
  assert.equal(diceQueHace(pedido, 'instagram'), true);
  const c = ctx({ instagram: true, messenger: true }, true);
  assert.ok(c.disparadores.some((d) => d.value === 'instagram:anuncio'), 'el catálogo lo trae (PIDE_ANUNCIO)');
  const p = preguntaAntes(pedido, c, []);
  assert.ok(p == null || p.sobre !== 'evento', `no pregunta el evento: ${JSON.stringify(p)}`);
  // Y sin nombrar el evento, la pregunta sigue como antes en Instagram (el anuncio es el cuarto).
  const q = preguntaAntes('Mandale el catálogo a los que llegan por Instagram', ctx({ instagram: true }, false), []);
  assert.equal(q?.sobre, 'evento');
  assert.deepEqual(q?.opciones.map((o) => o.valor), ['instagram:comentario', 'instagram:historia', 'instagram:dm']);
});

test('Messenger vuelve a ofrecer «enlace de referencia»: se filtra lo que no está ANTES de cortar en 3', () => {
  const q = preguntaAntes('Por Messenger, mandale el catálogo', ctx({ messenger: true }, false), []);
  assert.equal(q?.sobre, 'evento');
  assert.deepEqual(q?.opciones.map((o) => o.valor), ['messenger:comentario', 'messenger:dm', 'messenger:ref']);
});

test('«Otra cosa: … mi anuncio» trae el anuncio al contexto, y el CRON guardado del anuncio también (explicar y editar)', () => {
  const r: RespuestaMako[] = [{ preguntaId: 'pregunta-evento-instagram', sobre: 'evento', valor: null, texto: 'cuando hacen clic en mi anuncio' }];
  assert.equal(textosDeRespuestas(r), 'cuando hacen clic en mi anuncio');
  const core = sinComentarios(leer('lib/flujo-ia-crear-core.ts'));
  assert.match(core, /const textos = textosDeRespuestas\(sanearRespuestas\(o\.respuestas \?\? \[\]\)\);\s*const leido = await deps\.contexto\(o\.pedido, textos \? \{ textos \} : undefined\);/);
  const crear = sinComentarios(leer('lib/flujo-ia-crear.ts'));
  assert.match(crear, /anuncio: o\.anuncio === true \|\| PIDE_ANUNCIO\.test\(o\.textos \? `\$\{pedido\}\\n\$\{o\.textos\}` : pedido\),/);
  assert.match(crear, /contexto: \(pedido, x\) => armarContexto\(ws, pedido, x\),/);
  // La ruta de Editar / Discutir: con el CRON del anuncio guardado, el catálogo lo trae y su rótulo se encuentra.
  const ruta = sinComentarios(leer('app/api/chat-agent/secuencias/ia/route.ts'));
  // Con la MENCIÓN igual (10/11/2026): con su CRON guardado, el catálogo la trae para explicar o editar.
  assert.match(ruta, /const disparadorActual = await cronGuardado\(\);\s*const leido = await armarContexto\(ws, pedido, \{ anuncio: \/:anuncio\$\/\.test\(disparadorActual \?\? ''\), mencion: \/:mencion\$\/\.test\(disparadorActual \?\? ''\), textos: textosDeRespuestas\(respuestas\) \}\);/);
  assert.match(crear, /mencion: o\.mencion === true \|\| PIDE_MENCION\.test\(o\.textos \? `\$\{pedido\}\\n\$\{o\.textos\}` : pedido\),/);
  assert.ok(ctx({ instagram: true }, true).disparadores.some((d) => d.value === 'instagram:anuncio'));
});
