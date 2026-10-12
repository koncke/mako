// =============================================================================
// Duodécima tanda de Automations (12/10/2026): lo que quedó ENCHUFADO al cierre (los bloqueantes de los paquetes).
// Diseño: docs/diseno-duodecima-tanda.md §2.6, §3.1 y §3.4.
//
// Lo que se fija:
//   · `valorIADeDisparador` (lib/disparadores.ts), EJECUTADA: el valor de la IA de un CRON GUARDADO, el inverso de
//     `disparadorDeValorIA`. Un evento de Instagram da `instagram:dm` (el de `opcionesCronIA`), no `trigger:instagram`
//     (el de las columnas: el subtipo vive sólo en la lista de la 0241);
//   · la ruta de IA lo usa: el 409 de crear trae el CRON con su evento, y editar pone `ctx.disparadorActual` (sin él,
//     «cambia WhatsApp por Instagram» preguntaba «¿Cambio qué la dispara?» aunque el CRON ya fuera de Instagram, y las
//     condiciones valían con cualquier ámbito);
//   · Publicar MUESTRA el `aviso` del PATCH («Los avisos de Instagram no se activaron»): el server lo escribía y la
//     pantalla sólo decía «Publicado ✓» (AGENTS.md: escribir la salida no es ofrecerla);
//   · la tarjeta CRON se siembra con `disparadorDeValorIA` (lo que guardó el server), no con `disparoDeValor`.
//
// PROBADO ROMPIÉNDOLO: ver el pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  opcionesCronIA, disparadorDeValorIA, valorIADeDisparador, type CanalesConectadosIA, type EntradaCronIA, type Disparador,
} from '../lib/disparadores';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas primero y los bloques después (AGENTS.md: un `/*` adentro de un comentario de línea).
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const tramo = (src: string, desde: string, hasta: string, tope = 6_000): string => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no está «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no está el cierre «${hasta}»`);
  assert.ok(j - i <= tope, `el tramo de «${desde}» mide ${j - i} (> ${tope})`);
  return src.slice(i, j + hasta.length);
};

const TODOS: CanalesConectadosIA = { instagram: true, messenger: true, email: true, pagos: true };
const ENTRADA: EntradaCronIA = {
  productos: [
    { funnelId: 5, productoId: 39, nombre: 'Fiesta Music', etapas: [{ value: 'nuevo', label: 'Nuevo' }, { value: 'agendado', label: 'Agendado' }], etapasEntrega: [{ value: 'onboarding', label: 'Onboarding' }] },
    { funnelId: 6, productoId: 10, nombre: 'Service Delivery & Ops', etapas: [{ value: 'nuevo', label: 'Nuevo' }], etapasEntrega: [{ value: 'onboarding', label: 'Onboarding' }] },
  ],
  etiquetas: [{ id: 7, nombre: 'Cualificado' }],
  conectados: TODOS,
};

// ── valorIADeDisparador, ejecutada ──────────────────────────────────────────────────────────

test('valorIADeDisparador es el inverso de disparadorDeValorIA para TODO lo que ofrece el CRON a la IA', () => {
  const valores = opcionesCronIA(ENTRADA).flatMap((s) => s.options.map((o) => o.value));
  assert.ok(valores.length >= 12, `el caso trae kanbans, etiquetas y los cuatro canales (${valores.length})`);
  for (const clase of ['instagram:', 'messenger:', 'email_recibido:', 'pago:', 'etiqueta_agregada', 'venta:5:', 'entrega:39:', 'etiqueta:7']) {
    assert.ok(valores.some((v) => v.startsWith(clase)), `falta una opción ${clase}`);
  }
  for (const v of valores) {
    const d = disparadorDeValorIA(v)[0];
    assert.ok(d, `${v} no se guarda`);
    assert.equal(valorIADeDisparador(d), v, `${v} no vuelve igual`);
  }
});

test('valorIADeDisparador: un evento SIN subtipo (las columnas de antes) y «manual» dicen lo que son, sin inventar', () => {
  assert.equal(valorIADeDisparador({ id: 'd1', trigger_tipo: 'instagram' } as Disparador), 'trigger:instagram');
  assert.equal(valorIADeDisparador({ id: 'd1', trigger_tipo: 'manual' } as Disparador), 'trigger:manual');
  // Varias etapas del mismo kanban: el valor del desplegable, juntas.
  const varias = disparadorDeValorIA('venta:5:nuevo,agendado')[0];
  assert.ok(varias);
  assert.equal(valorIADeDisparador(varias), 'venta:5:nuevo,agendado');
});

// ── La ruta de IA ───────────────────────────────────────────────────────────────────────────

const RUTA = sinComentarios(leer('app/api/chat-agent/secuencias/ia/route.ts'));

test('la ruta lee el CRON de la LISTA (`disparadoresDeSecuencia`) y lo pasa a editar como `disparadorActual`', () => {
  const cron = tramo(RUTA, 'const cronGuardado = async ()', '\n  };');
  assert.match(cron, /const lista = await disparadoresDeSecuencia\(secuenciaId\);/);
  assert.match(cron, /return lista\[0\] \? valorIADeDisparador\(lista\[0\]\) : null;/);
  // Una lectura que falla no tumba el pedido: editar pregunta igual, el 409 cae a las columnas.
  assert.match(cron, /catch \(e\) \{[\s\S]*return null;/);
  const editar = tramo(RUTA, "const delCron = [...respuestas]", 'send({ t: \'fase\', fase: \'modelo\' });');
  assert.match(editar, /const \[leido, disparadorActual\] = await Promise\.all\(\[armarContexto\(ws, pedido\), cronGuardado\(\)\]\);/);
  assert.match(editar, /aplicarRespuestas\(\{ \.\.\.leido\.ctx, disparadorActual \}, pedido, respuestas\)/);
  // El MISMO ctx (con el CRON) llega al user, a deIAEdicion y a erroresEdicion.
  assert.match(editar, /userDeEditar\(ctx, /);
  assert.match(editar, /deIAEdicion\(obj, base, ctx\)/);
  assert.match(editar, /erroresEdicion\(base, r, ctx\)/);
});

// ── La pantalla ─────────────────────────────────────────────────────────────────────────────

const PERFIL = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));

test('Publicar muestra el `aviso` del PATCH después de «Publicado ✓»', () => {
  const pub = tramo(PERFIL, 'const publicar = async () => {', '\n  };');
  assert.match(pub, /let aviso: string \| null = null;/);
  assert.match(pub, /aviso = typeof rp\.aviso === 'string' && rp\.aviso \? rp\.aviso : null;/);
  assert.match(pub, /flashOk\('Publicado ✓'\); onCambio\(\);\n\s*if \(aviso\) setErr\(aviso\);/);
  // El server lo manda así (app/api/whatsapp/secuencias/route.ts).
  assert.match(leer('app/api/whatsapp/secuencias/route.ts'), /return Response\.json\(aviso \? \{ ok: true, aviso \} : \{ ok: true \}\);/);
});

test('la tarjeta CRON se siembra con lo que guardó el server (`disparadorDeValorIA`), entero', () => {
  assert.match(PERFIL, /const puesto = r\.disparador \? disparadorDeValorIA\(r\.disparador\)\[0\] : undefined;\n\s*if \(puesto\) crons\.sembrarPrimero\(puesto\);/);
  assert.doesNotMatch(PERFIL, /disparoDeValor\(/, 'disparoDeValor no entiende instagram:dm');
  const hook = sinComentarios(leer('app/automations/EditorDisparadores.tsx'));
  assert.match(hook, /const sembrarPrimero = \(d: Disparador\) => setLista\(\(l\) => \(l\.length \? \[\{ \.\.\.d, id: l\[0\]\.id \}, \.\.\.l\.slice\(1\)\] : \[d\]\)\);/);
});

// PROBADO ROMPIÉNDOLO (12/10/2026, enchufe-romper.mjs en el scratchpad de la tanda; una rotura por vez, restaurada con
// sha1 igual). Base: este archivo 5 / 0 (flujo-ia-arreglos 25 / 0, secuencia-disparo-resiembra 6 / 0, nutricion-etapa
// 27 / 0, crear-ia-preguntas 16 / 0).
//   R1 valorIADeDisparador sin el subtipo (`instagram:dm` → `trigger:instagram`) → 4 / 1 (el inverso);
//   R2 editar sin `disparadorActual` → 4 / 1 (la ruta);
//   R3 `cronGuardado` no lee la lista → 4 / 1 (la ruta);
//   R4 el 409 sólo con las columnas → flujo-ia-arreglos 24 / 1;
//   R5 Publicar se come el `aviso` → 4 / 1 (Publicar);
//   R6 la tarjeta CRON se siembra con `disparoDeValor` → los tres archivos 33 / 3 (uno en cada uno);
//   R7 `etapasDeCondicion` lista un producto sin embudo → nutricion-etapa 26 / 1;
//   R8 el lienzo vuelve a su copia del armado → nutricion-etapa 26 / 1;
//   R9 la ruta sin la llamada `armarContexto(ws, pedido)` → crear-ia-preguntas 15 / 1.
// Restaurado: todo igual que la base.
