// =============================================================================
// La octava tanda de Automations (10/10/2026): lo que se EJECUTA de lo que pidió Martín
// =============================================================================
//   · Copiar y pegar flujos y tarjetas (lib/flujo-copia.ts): «copiar flujo» en el «⋯», pegar con Ctrl+V,
//     entre flujos propios y entre negocios; lo que no existe en el que pega queda vacío («Pegar y
//     marcar en rojo») y un audio pasa a texto con su guion.
//   · «Si responde» como una condición normal: su flecha se borra (la deja SUELTA) y se reconecta desde
//     el CRON (lib/flujo-edicion.ts, lib/flujo-grafo.ts `suelta`).
//   · Sacar una flecha no mueve las tarjetas (`congelarPosiciones`, lib/lienzo-posiciones.ts).
//   · Lo que falta, en rojo al cerrar (`tarjetasIncompletas`, lib/flujo-conversacion.ts).
//   · Minutos entre dos mensajes: la tarjeta se parte con una espera (`partirConEspera`).
//   · El horario de oficina de media en media hora (lib/horario-envio.ts).
//   · El desplegable abre parado en lo elegido (`caminoDe`, app/components/Dropdown.tsx).
//
// ROTURAS (10/10/2026), restaurando de memoria, base 11 / 0 (medido: cada una dio 10 / 1):
//   R1. `raizRespuesta` sin saltear la suelta                         → 10 / 1 (la de «Si responde»)
//   R2. `pegarTarjetas` sin reescribir las flechas con el mapa       → 10 / 1 (la de pegar)
//   R3. `dentroDelHorario` comparando sólo la hora (sin minutos)      → 10 / 1 (la de medias horas)
//   R4. `congelarPosiciones` sin fijar nada                           → 10 / 1 (la de congelar)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  textoDeCopia, leerCopia, copiaDeTarjetas, copiaDeFlujo, pegarTarjetas, limpiarReferencias, firmaDeCopia, type PasoCopiado, type Existentes,
} from '../lib/flujo-copia';
import { desconectar, conectar, partirConEspera } from '../lib/flujo-edicion';
import { raizRespuesta, tarjetasSueltas, type PasoGrafo } from '../lib/flujo-grafo';
import { grafoDeSecuencia, tarjetasIncompletas, altoDeMensaje, ALTO_PALOMITAS, ID_ENTRADA, type PasoParaGrafo } from '../lib/flujo-conversacion';
import { congelarPosiciones, conPosiciones } from '../lib/lienzo-posiciones';
import { dentroDelHorario, acabaDeAbrir, horaTexto, horaCorta, sanearHorario } from '../lib/horario-envio';
import { caminoDe } from '../app/components/Dropdown';

const msg = (id: string, siguiente: string | null, extra: Record<string, unknown> = {}): PasoCopiado =>
  ({ id, canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, template_wa: null, tipo: 'texto', cuerpo: `hola ${id}`, siguiente, ...extra }) as unknown as PasoCopiado;
const ini = (siguiente: string): PasoCopiado => ({ id: 'entrada', nodo: 'inicio', siguiente, canal: 'whatsapp', delay_horas: 0, cuerpo: '' }) as unknown as PasoCopiado;
const resp = (siNo: string | null, extra: Record<string, unknown> = {}): PasoCopiado =>
  ({ id: 'r', nodo: 'respuesta', casos: [], si_no: siNo, canal: 'whatsapp', delay_horas: 0, cuerpo: '', ...extra }) as unknown as PasoCopiado;

test('copiar: el texto viaja con un renglón para la persona y se vuelve a leer entero; lo que no es una copia es null', () => {
  const c = copiaDeFlujo({ nombre: 'Bienvenida', emoji: '👋', pasos: [ini('a'), msg('a', 'b'), msg('b', null)], guiones: { 9: 'hola' } });
  const t = textoDeCopia(c);
  assert.match(t.split('\n')[0], /«Bienvenida» — automatización de MaKo/);
  const l = leerCopia(t);
  assert.ok(l);
  assert.equal(l!.nombre, 'Bienvenida');
  assert.equal(l!.pasos.length, 3);
  assert.equal(l!.guiones, undefined, 'un guion de un audio que no se usa viajó igual');
  assert.equal(leerCopia('hola'), null);
  assert.equal(leerCopia('{"mako":"otra","v":1,"que":"flujo","pasos":[{}]}'), null);
  assert.equal(leerCopia('{"mako":"mako-flujo","v":1,"que":"flujo","pasos":[]}'), null, 'una copia vacía no es una copia');
  assert.equal(firmaDeCopia(t), firmaDeCopia(t));
  assert.notEqual(firmaDeCopia(t), firmaDeCopia(`${t} `));
});

test('copiar tarjetas: las flechas ENTRE ellas viajan; las que salen a otra se van', () => {
  const pasos = [ini('a'), msg('a', 'b'), msg('b', 'c'), msg('c', null)];
  const c = copiaDeTarjetas(pasos, ['a', 'b'])!;
  assert.deepEqual(c.pasos.map((p) => [p.id, p.siguiente]), [['a', 'b'], ['b', null]]);
  assert.equal(copiaDeTarjetas(pasos, ['entrada']), null, 'el CRON no es una tarjeta que se copie');
});

test('pegar: ids nuevos, las flechas reescritas, nada le llega (sueltas) y una «Si responde» pegada nace suelta', () => {
  const actuales = [ini('a'), msg('a', null), resp(null)] as unknown as PasoGrafo[];
  const copia = copiaDeTarjetas([ini('a'), msg('a', 'b'), msg('b', null), resp('a')], ['a', 'b', 'r'])!;
  let k = 0;
  const r = pegarTarjetas(actuales, copia, () => (k++ % 97) / 97);
  assert.equal(r.ids.length, 3);
  const nuevoA = r.mapa.get('a')!, nuevoB = r.mapa.get('b')!, nuevoR = r.mapa.get('r')!;
  assert.ok(![nuevoA, nuevoB, nuevoR].includes('a') && nuevoA !== nuevoB);
  const pa = r.pasos.find((p) => p.id === nuevoA)!;
  assert.equal(pa.siguiente, nuevoB, 'la flecha de adentro de lo copiado no se reescribió');
  const pr = r.pasos.find((p) => p.id === nuevoR)!;
  assert.equal(pr.suelta, true);
  assert.equal(pr.si_no, nuevoA);
  assert.deepEqual(tarjetasSueltas(r.pasos).sort(), [nuevoA, nuevoB, nuevoR].sort(), 'lo pegado tiene que nacer suelto');
  assert.equal(raizRespuesta(r.pasos), 'r', 'la «Si responde» de antes dejó de escuchar');
});

test('lo que no existe en el negocio que pega: vacío, y el audio pasa a texto con su guion', () => {
  const ex: Existentes = { audios: new Set([1]), adjuntos: new Set(), etiquetas: new Set([5]), secuencias: new Set(), lineas: new Set(['mia']), etapas: new Set(['3:agendado']) };
  const pasos = [
    msg('a', null, { tipo: 'audio', audio_id: 9 }),
    msg('b', null, { tipo: 'audio', audio_id: 8 }),
    msg('c', null, { tipo: 'media', media_id: 4, linea: 'ajena' }),
    { id: 'd', nodo: 'condicion', ramas: [{ id: 'd_si', modo: 'todas', filas: [{ campo: 'etiqueta', valor: 7 }, { campo: 'etapa', valor: 'agendado', funnel_id: 3 }, { campo: 'etapa', valor: 'cerrado', funnel_id: 3 }], siguiente: null }], si_no: null },
    { id: 'e', accion: { operacion: 'poner_etiqueta_lead', params: { etiquetaId: 7, etiquetaIds: [7, 5] } }, siguiente: null },
    { id: 'f', nodo: 'ir_a', destino: { secuencia_id: 44 } },
  ] as unknown as PasoCopiado[];
  const [a, b, c, d, e, f] = limpiarReferencias(pasos, ex, { 9: 'Hola, soy el audio' });
  assert.deepEqual([a.tipo, a.audio_id, a.cuerpo], ['texto', null, 'Hola, soy el audio']);
  assert.deepEqual([b.tipo, b.audio_id], ['audio', null], 'sin guion, el audio queda vacío (y lo frena Publicar)');
  assert.equal(c.media_id, null);
  assert.equal('linea' in c, false, 'la línea de otro negocio quedó puesta');
  const filas = (d.ramas ?? [])[0].filas ?? [];
  assert.equal(filas[0].valor, null, 'la etiqueta de otro negocio quedó elegida');
  assert.equal(filas[1].valor, 'agendado', 'una etapa que SÍ existe se borró');
  assert.equal(filas[2].valor, null);
  assert.deepEqual((e.accion as { params: Record<string, unknown> }).params, { etiquetaIds: [5], etiquetaId: 5 });
  assert.equal(f.destino, null);
});

test('«Si responde»: borrar su flecha la deja SUELTA (no escucha); conectarla desde el CRON la vuelve a enganchar', () => {
  const pasos = [ini('a'), msg('a', null), resp(null)] as unknown as PasoGrafo[];
  assert.equal(raizRespuesta(pasos), 'r');
  const sin = desconectar(pasos, ID_ENTRADA, 'sig', 'r');
  assert.ok(sin.ok);
  assert.equal(sin.pasos.find((p) => p.id === 'r')?.suelta, true);
  assert.equal(raizRespuesta(sin.pasos), null, 'suelta, sigue escuchando');
  assert.ok(tarjetasSueltas(sin.pasos).includes('r'), 'Publicar no la frena');
  const g = grafoDeSecuencia(sin.pasos as PasoParaGrafo[], { disparador: 'x' });
  assert.ok(!g.aristas.some((x) => x.hasta === 'r'), 'suelta, se sigue dibujando su flecha');
  // De otra tarjeta no: «Si responde» sólo cuelga del CRON.
  assert.equal(conectar(sin.pasos, 'a', 'sig', 'r').ok, false);
  const otra = conectar(sin.pasos, ID_ENTRADA, 'par', 'r');
  assert.ok(otra.ok);
  assert.equal(otra.pasos.find((p) => p.id === 'r')?.suelta, undefined);
  assert.equal(raizRespuesta(otra.pasos), 'r');
});

test('sacar una flecha no mueve nada: lo que el árbol nuevo correría queda donde se ve', () => {
  const pasos = [ini('a'), msg('a', 'b'), msg('b', 'c'), msg('c', null)] as unknown as PasoParaGrafo[];
  const antes = grafoDeSecuencia(pasos, { disparador: 'x' });
  const r = desconectar(pasos as unknown as PasoGrafo[], 'a', 'sig', 'b');
  assert.ok(r.ok);
  const despues = grafoDeSecuencia(r.pasos as unknown as PasoParaGrafo[], { disparador: 'x' });
  const pos = congelarPosiciones(antes, despues, {}, ID_ENTRADA);
  const visto = conPosiciones(despues, pos, ID_ENTRADA);
  for (const n of antes.nodos) {
    const d = visto.nodos.find((x) => x.id === n.id)!;
    assert.deepEqual([Math.round(d.x), Math.round(d.y)], [Math.round(n.x), Math.round(n.y)], `la tarjeta ${n.id} se movió`);
  }
});

test('lo que falta: una condición sin preguntar nada y un mensaje sin escribir; una suelta completa no', () => {
  const pasos = [
    ini('a'), msg('a', 'c'),
    { id: 'c', nodo: 'condicion', ramas: [{ id: 'c_si', modo: 'todas', filas: [], siguiente: null }], si_no: null },
    msg('v', null, { cuerpo: '' }), msg('s', null),
  ] as unknown as PasoGrafo[];
  const f = tarjetasIncompletas(pasos);
  assert.ok(f.has('c'), 'la condición vacía no se marca');
  assert.ok(f.has('v'), 'el mensaje sin escribir no se marca');
  assert.ok(!f.has('s'), 'estar suelta no es que le falte algo');
});

test('minutos entre dos mensajes: la tarjeta se parte con una espera, y lo de después se muda a la última', () => {
  const partes = [{ tipo: 'texto', cuerpo: 'uno' }, { tipo: 'texto', cuerpo: 'dos', pausa_s: 3 }, { tipo: 'texto', cuerpo: 'tres' }];
  const pasos = [ini('a'), msg('a', 'z', { partes, cuerpo: 'uno', paralelos: ['p'] }), msg('z', null), msg('p', null)] as unknown as PasoGrafo[];
  const r = partirConEspera(pasos, 'a', 1, 15, () => 0.42);
  assert.ok(r.ok && r.id);
  const a = r.pasos.find((p) => p.id === 'a') as unknown as { partes?: unknown[]; siguiente: string; paralelos?: string[] };
  const esp = r.pasos.find((p) => p.id === r.id)!;
  assert.equal(a.siguiente, r.id);
  assert.equal(a.paralelos, undefined, 'los paralelos arrancaban al terminar TODA la tarjeta');
  assert.deepEqual([esp.nodo, esp.espera?.minutos], ['esperar', 15]);
  const resto = r.pasos.find((p) => p.id === esp.siguiente) as unknown as { partes?: Array<{ cuerpo: string; pausa_s?: number }>; siguiente: string; paralelos?: string[] };
  assert.deepEqual(resto.partes?.map((x) => x.cuerpo), ['dos', 'tres']);
  assert.equal(resto.partes?.[0].pausa_s, undefined, 'la pausa de segundos quedó sumada a la espera');
  assert.equal(resto.siguiente, 'z');
  assert.deepEqual(resto.paralelos, ['p']);
  assert.equal(partirConEspera(pasos, 'a', 0, 15).ok, false, 'antes del primero no hay nada que partir');
});

test('el horario de oficina, de media en media hora: «desde las 9:30» no manda a las 9:10, y abre a las 9:30', () => {
  const h = sanearHorario({ activo: true, desde: 9.5, hasta: 18, dias: [0, 1, 2, 3, 4, 5, 6] })!;
  // 15:10 UTC = 9:10 en Ciudad de México (UTC-6).
  assert.equal(dentroDelHorario(Date.parse('2026-10-09T15:10:00Z'), 'America/Mexico_City', h), false);
  assert.equal(dentroDelHorario(Date.parse('2026-10-09T15:31:00Z'), 'America/Mexico_City', h), true);
  assert.equal(acabaDeAbrir(Date.parse('2026-10-09T15:31:00Z'), 'America/Mexico_City', h, 2), true);
  assert.equal(acabaDeAbrir(Date.parse('2026-10-09T15:40:00Z'), 'America/Mexico_City', h, 2), false);
  assert.equal(horaTexto(9.5), '09:30');
  assert.equal(horaTexto(24), '24:00');
  assert.equal(horaCorta(9.5), '9:30');
  assert.equal(horaCorta(21), '21');
});

test('el desplegable abre parado en lo elegido: el camino de secciones hasta su renglón', () => {
  const gs = [
    { title: 'Producto', options: [], grupos: [{ title: 'Ventas', options: [{ value: 'v:1', label: 'Agendado' }] }] },
    { title: 'Otro', options: [{ value: 'x', label: 'X' }] },
  ];
  assert.deepEqual(caminoDe(gs, 'v:1'), ['Producto', 'Ventas']);
  assert.deepEqual(caminoDe(gs, 'x'), ['Otro']);
  assert.equal(caminoDe(gs, 'nada'), null);
  assert.equal(caminoDe(gs, ''), null);
});

test('la tarjeta de WhatsApp suma la fila de sus palomitas; la de un email no', () => {
  const wa = msg('a', null) as unknown as PasoParaGrafo;
  const em = { ...wa, canal: 'email', asunto: 'Hola' } as unknown as PasoParaGrafo;
  const sinPalomitas = { ...wa, canal: 'instagram' } as unknown as PasoParaGrafo;
  assert.equal(altoDeMensaje(wa) - altoDeMensaje(sinPalomitas), ALTO_PALOMITAS);
  assert.ok(altoDeMensaje(em) > 0);
});
