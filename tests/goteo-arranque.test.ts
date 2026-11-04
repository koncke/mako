// =============================================================================
// El arranque gradual y las otras formas de decirlo (Leila, llamada del 30/10/2026, punto 5.8)
// =============================================================================
// El número de Mauricio quedó bloqueado 24 h al pasar de unos 20 a 60 por día con mensajes idénticos. Leila arma Black November con su base entera.
//
// Correr: node --import tsx --test tests/goteo-arranque.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { arranqueLlega, diaDelTurno, diasQueMiraElArranque, frenoAlAprobar, frenoDeGoteo, goteoDeHoy, subidasDelArranque, textoDeGoteo, SIN_USO } from '../lib/goteo';
import { configParaGuardar, sanearConfigAutomatizacion } from '../lib/config-automatizacion';
import {
  alcanceDeMotivos, claveDeDifusion, demoraDelTurno, goteoConArranque, goteoValido, pasosDeDifusion, textoDeDuracion, textoDeDuracionPorCanal, ARRANQUE_DIFUSION_INICIAL,
} from '../lib/difusion-reglas';
import { avisoDeRitmo } from '../lib/ritmo-al-activar';

const leer = (r: string) => readFileSync(join(import.meta.dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
const G = { minutos: 3, dia: 60, arranque: { dia: 20, sube: 20 } };
const dias = (o: Record<string, number>) => new Map(Object.entries(o));

test('el tope de hoy: 20, 40, 60 y ahí se queda', () => {
  assert.deepEqual([0, 1, 2, 3, 30].map((k) => goteoDeHoy(G, k)?.dia), [20, 40, 60, 60, 60]);
  // Sin arranque, o sin tope, el que tiene: nada cambia para quien no lo prendió.
  assert.equal(goteoDeHoy({ minutos: 3, dia: 40 }, 5)?.dia, 40);
  assert.deepEqual(goteoDeHoy({ minutos: 3, arranque: { dia: 20, sube: 20 } }, 5), { minutos: 3, arranque: { dia: 20, sube: 20 } });
  assert.equal(goteoDeHoy(null, 3), undefined);
  // El freno mira el de hoy: con 20 ya salidos, hoy frena; con una subida, no.
  const uso = { enviados: 20, ultimoMs: 0, primeroMs: 0 };
  assert.equal(frenoDeGoteo(goteoDeHoy(G, 0), uso, 10 * 60_000).frena, true);
  assert.equal(frenoDeGoteo(goteoDeHoy(G, 1), uso, 10 * 60_000).frena, false);
  assert.match(frenoAlAprobar(goteoDeHoy(G, 0), uso, 10 * 60_000, 'X') ?? '', /ya mandó 20 en 24 horas/, 'dice el de hoy, no el tope final');
  assert.equal(frenoDeGoteo(goteoDeHoy(G, 0), SIN_USO, 0).frena, false);
});

test('⚠️ SUBE SÓLO EL DÍA QUE LLEGÓ A SU TOPE: un primer día corto no salta', () => {
  const hoy = '2026-11-10';
  // El caso de la revisión: lanzada a las 20:40, salen 5 antes de cerrar. Al otro día sigue en 20, no en 40.
  assert.equal(subidasDelArranque(dias({ '2026-11-09': 5 }), hoy, G), 0);
  // Y un día en que otra automatización se comió la línea tampoco.
  assert.equal(subidasDelArranque(dias({ '2026-11-08': 20, '2026-11-09': 1 }), hoy, G), 1);
  // Llegó a su tope: sube. Con 20 y 40, ya está en 60.
  assert.equal(subidasDelArranque(dias({ '2026-11-09': 20 }), hoy, G), 1);
  assert.equal(subidasDelArranque(dias({ '2026-11-08': 20, '2026-11-09': 40 }), hoy, G), 2);
  // Con 20 y otra vez 20: el segundo no llegó a su tope de 40.
  assert.equal(subidasDelArranque(dias({ '2026-11-08': 20, '2026-11-09': 20 }), hoy, G), 1);
  // Hoy no cuenta, ni un día futuro por un reloj corrido, ni un día sin nada.
  assert.equal(subidasDelArranque(dias({}), hoy, G), 0);
  assert.equal(subidasDelArranque(dias({ '2026-11-10': 500 }), hoy, G), 0);
  assert.equal(subidasDelArranque(dias({ '2026-11-20': 500 }), hoy, G), 0);
  assert.equal(subidasDelArranque(dias({ '2026-11-09': 0 }), hoy, G), 0);
  assert.equal(subidasDelArranque(dias({ '2026-11-04': 20, '2026-11-05': 40, '2026-11-08': 0 }), hoy, G), 0, 'un día en cero no tapa el hueco');
  // Pasarse de lo que tocaba (un tope que cambió) no sube de a dos.
  assert.equal(subidasDelArranque(dias({ '2026-11-09': 500 }), hoy, G), 1);
});

test('⚠️ por lo que mandó, no por fecha: una pausada que vuelve no salta al tope', () => {
  // El fin de semana no corta: con un horario de lunes a viernes, el lunes sigue subiendo.
  assert.equal(subidasDelArranque(dias({ '2026-11-05': 20, '2026-11-06': 40 }), '2026-11-09', G), 2);
  // Tres días o más sin mandar sí: el número ya no está acostumbrado.
  assert.equal(subidasDelArranque(dias({ '2026-11-04': 20, '2026-11-05': 40 }), '2026-11-09', G), 0);
  assert.equal(subidasDelArranque(dias({ '2026-11-04': 20, '2026-11-05': 40, '2026-11-09': 20 }), '2026-11-10', G), 1, 'lo de antes del hueco no cuenta');
  // Cuánto se lee: lo que tarda en llegar, más unos días por los huecos.
  assert.equal(diasQueMiraElArranque(G), 9);
  assert.equal(diasQueMiraElArranque({ dia: 20, arranque: { dia: 20, sube: 20 } }), 7);
  assert.equal(diasQueMiraElArranque({ dia: 500, arranque: { dia: 1, sube: 1 } }), 67, 'con techo: se lee en cada corrida');
  assert.equal(arranqueLlega(60, { dia: 20, sube: 20 }), true);
  assert.equal(arranqueLlega(500, { dia: 1, sube: 1 }), false);
});

test('en qué día le toca a cada uno, y cuánto tarda en palabras', () => {
  assert.deepEqual(diaDelTurno(0, G), { dia: 0, enElDia: 0 });
  assert.deepEqual(diaDelTurno(19, G), { dia: 0, enElDia: 19 });
  assert.deepEqual(diaDelTurno(20, G), { dia: 1, enElDia: 0 });
  assert.deepEqual(diaDelTurno(59, G), { dia: 1, enElDia: 39 });
  assert.deepEqual(diaDelTurno(60, G), { dia: 2, enElDia: 0 });
  assert.deepEqual(diaDelTurno(120, G), { dia: 3, enElDia: 0 }, 'ya en el tope, de a 60');
  assert.deepEqual(diaDelTurno(250, G), { dia: 5, enElDia: 10 });
  // Sin arranque, lo de siempre.
  assert.deepEqual(diaDelTurno(85, { dia: 40 }), { dia: 2, enElDia: 5 });
  assert.equal(demoraDelTurno(20, G), 86_400_000);
  assert.equal(demoraDelTurno(20, { minutos: 3, dia: 60 }), 60 * 60_000);
  assert.equal(textoDeDuracion(20, G), 'sale todo en 57 min');
  assert.equal(textoDeDuracion(200, G), 'tarda unos 5 días (arranca con 20 por día, hasta 60)');
  assert.equal(textoDeDuracion(200, { minutos: 3, dia: 40 }), 'tarda unos 5 días (hasta 40 por día)');
  assert.equal(textoDeGoteo(G), 'uno cada 3 min, hasta 60 por día, por WhatsApp arranca con 20 y sube 20 por día, dentro del tope de la línea');
});

test('⚠️ SÓLO WHATSAPP: ni frena el email ni deja a nadie afuera de su ventana de Instagram', () => {
  const g = { minutos: 3, dia: 40, arranque: { dia: 20, sube: 20 } };
  const AHORA = Date.parse('2026-11-10T12:00:00Z');
  const leads = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, motivos: { whatsapp: 'sin_telefono', email: 'sin_email', instagram: null } as never, instagramHastaMs: AHORA + 20 * 3_600_000 }));
  // Con 20 h de ventana entran 40, los del tope: el arranque no le quita a nadie.
  assert.equal(alcanceDeMotivos(leads, ['whatsapp', 'instagram'], { goteo: g, ahoraMs: AHORA }).porCanal.find((c) => c.canal === 'instagram')?.llegan, 40);
  // Cuánto tarda: el canal que más tarda, no el que tiene más gente.
  assert.equal(textoDeDuracionPorCanal([{ canal: 'email', llegan: 45 }, { canal: 'whatsapp', llegan: 30 }], g), 'tarda unos 2 días (arranca con 20 por día, hasta 40)');
  assert.equal(textoDeDuracionPorCanal([{ canal: 'email', llegan: 30 }], g), 'sale todo en unas 2 h', 'el email, de una: sin el arranque');
  assert.equal(textoDeDuracionPorCanal([], g), '');
  // El aviso al activar lo dice sólo de WhatsApp.
  const base = { topes: { wa: { dia: 40, hora: 6 }, email: { dia: 100 } }, personas: 200, goteo: g };
  assert.doesNotMatch(avisoDeRitmo({ ...base, canal: 'email' })!.texto, /Arranca/);
  const n = leer('lib/nutricion.ts');
  assert.match(n, /\(canalDelGoteo\(canal\) === 'whatsapp' \? goteoDeHoy\(goteos\.get\(secId\), subidas\.get\(secId\) \?\? 0\) : goteos\.get\(secId\)\);/, 'el motor tampoco');
});

test('se guarda, se limpia y se saca: sin tope no hay arranque, y se dice', () => {
  const ok = configParaGuardar({}, { goteo: { dia: 60, arranque: { dia: 20, sube: 20 } } });
  assert.ok(ok.ok);
  assert.deepEqual(ok.ok && ok.config.goteo, { dia: 60, arranque: { dia: 20, sube: 20 } });
  // Se relee igual: `sanearConfigAutomatizacion` no lo pierde.
  assert.deepEqual(sanearConfigAutomatizacion({ goteo: { dia: 60, arranque: { dia: 20, sube: 20 } } }).goteo, { dia: 60, arranque: { dia: 20, sube: 20 } });
  assert.deepEqual(sanearConfigAutomatizacion({ goteo: { dia: 60, arranque: { dia: 0, sube: 20 } } }).goteo, { dia: 60 }, 'uno roto no frena nada');
  assert.deepEqual(sanearConfigAutomatizacion({ goteo: { minutos: 3, arranque: { dia: 20, sube: 20 } } }).goteo, { minutos: 3 });
  // Fuera de rango se dice.
  assert.equal(configParaGuardar({}, { goteo: { dia: 60, arranque: { dia: 0, sube: 20 } } }).ok, false);
  assert.equal(configParaGuardar({}, { goteo: { dia: 60, arranque: 'x' } }).ok, false);
  // ⚠️ Pedido sin tope se dice: la API decía «quedó guardada» y lo había tirado. Con uno puesto de antes, vale.
  const sin = configParaGuardar({ goteo: { minutos: 5 } }, { goteo: { arranque: { dia: 20, sube: 20 } } });
  assert.equal(sin.ok, false);
  assert.match(!sin.ok ? sin.error : '', /pon primero el tope/);
  const conTope = configParaGuardar({ goteo: { dia: 40 } }, { goteo: { arranque: { dia: 20, sube: 20 } } });
  assert.deepEqual(conTope.ok && conTope.config.goteo, { dia: 40, arranque: { dia: 20, sube: 20 } });
  // Uno que no llegaría nunca.
  assert.equal(configParaGuardar({}, { goteo: { dia: 500, arranque: { dia: 1, sube: 1 } } }).ok, false);
  // Apagar el tope se lo lleva, y sacarlo deja el tope.
  const base = { goteo: { minutos: 3, dia: 60, arranque: { dia: 20, sube: 20 } } };
  const sinTope = configParaGuardar(base, { goteo: { dia: null } });
  assert.deepEqual(sinTope.ok && sinTope.config.goteo, { minutos: 3 });
  const sinArranque = configParaGuardar(base, { goteo: { arranque: null } });
  assert.deepEqual(sinArranque.ok && sinArranque.config.goteo, { minutos: 3, dia: 60 });
});

test('la difusión: las variantes llegan a la tarjeta, y el pedido cuenta el arranque', () => {
  const m = (pasos: unknown[], id: string) => (pasos as Array<{ id: string; variantes?: string[]; partes?: unknown[] }>).find((p) => p.id === id);
  const con = pasosDeDifusion(['whatsapp', 'email'], { whatsapp: { cuerpo: 'Hola', variantes: ['Buenas', '  ', 'Qué tal'] }, email: { asunto: 'A', cuerpo: 'B' } });
  assert.deepEqual(m(con, 'd_whatsapp')?.variantes, ['Buenas', 'Qué tal'], 'las vacías no entran al sorteo');
  assert.equal(m(con, 'd_email')?.variantes, undefined);
  assert.equal(m(pasosDeDifusion(['whatsapp'], { whatsapp: { cuerpo: 'Hola' } }), 'd_whatsapp')?.variantes, undefined);
  // Con varias partes no van: son de UN texto.
  assert.equal(m(pasosDeDifusion(['whatsapp'], { whatsapp: { cuerpo: 'Hola', partes: [{}, {}], variantes: ['x'] } }), 'd_whatsapp')?.variantes, undefined);
  // Validar.
  assert.deepEqual(goteoValido(G), G);
  assert.equal(goteoValido({ ...G, arranque: { dia: 0, sube: 20 } }), null);
  assert.equal(goteoValido({ ...G, arranque: { dia: 20, sube: 1.5 } }), null);
  assert.equal(goteoValido({ minutos: 3, dia: 500, arranque: { dia: 1, sube: 1 } }), null, 'no llegaría nunca');
  assert.deepEqual(goteoValido({ minutos: 3, dia: 20, arranque: { dia: 20, sube: 20 } }), { minutos: 3, dia: 20 }, 'ya empieza en el tope: no hay nada que suba');
  assert.deepEqual(goteoConArranque({ minutos: 3, dia: 40 }, null), { minutos: 3, dia: 40 });
  assert.deepEqual(goteoConArranque({ minutos: 3, dia: 40 }, ARRANQUE_DIFUSION_INICIAL), { minutos: 3, dia: 40, arranque: { dia: 20, sube: 20 } });
  // Otro arranque, u otras variantes, son otro pedido: si no, «retomaba» la que ya estaba.
  const p = { seleccion: { leadIds: [1] }, canales: ['whatsapp'] as Array<'whatsapp'>, mensajes: { whatsapp: { cuerpo: 'Hola' } }, goteo: { minutos: 3, dia: 40 } };
  const k = claveDeDifusion(p);
  assert.notEqual(claveDeDifusion({ ...p, goteo: { ...p.goteo, arranque: { dia: 20, sube: 20 } } }), k);
  assert.notEqual(claveDeDifusion({ ...p, mensajes: { whatsapp: { cuerpo: 'Hola', variantes: ['x'] } } }), k);
  assert.equal(claveDeDifusion({ ...p }), k, 'sin arranque, la misma clave de antes');
});

test('el aviso al activar lo dice, y no promete de menos', () => {
  const base = { canal: 'whatsapp' as const, topes: { wa: { dia: 40, hora: 6 }, email: { dia: 100 } } };
  const a = avisoDeRitmo({ ...base, personas: 200, goteo: { minutos: 3, dia: 40, arranque: { dia: 20, sube: 20 } } })!;
  assert.match(a.texto, /Arranca con 20 por día y sube 20 por día\./);
  // 20 el primero y de a 40 después: 180 / 40 son 4,5 días más. Sin arranque decía 4.
  assert.match(a.texto, /Tarda al menos 5 días/);
  assert.match(avisoDeRitmo({ ...base, personas: 200, goteo: { minutos: 3, dia: 40 } })!.texto, /Tarda al menos 4 días/);
  assert.doesNotMatch(avisoDeRitmo({ ...base, personas: 200, goteo: { minutos: 3, dia: 40 } })!.texto, /Arranca/);
  // Sin nadie que salga no hay nada que arrancar.
  assert.equal(avisoDeRitmo({ ...base, personas: 0, goteo: { minutos: 3, dia: 40, arranque: { dia: 20, sube: 20 } } }), null);
});

test('el cableado: el motor, aprobar, la hoja, Configuraciones, el editor y MaKo', () => {
  const n = leer('lib/nutricion.ts');
  assert.match(n, /frenoDeGoteo\(goteoDelCanal\(secId, canal\), usoGoteo\.get\(/, 'el freno del motor mira el tope de HOY');
  assert.match(n, /\[\.\.\.goteos\.values\(\)\]\.some\(\(g\) => g\.arranque && g\.dia != null\)/, 'sólo lee si alguna lo tiene');
  assert.match(n, /subidasPorAutomatizacion\(supabase, goteos, await zonaParaArranque\(\)\)\.catch\(/, 'si no puede leer, el del primer día: manda menos, no se cae la corrida');
  const b = leer('lib/borrador-camino.ts');
  assert.match(b, /return frenoAlAprobar\(goteoDeHoy\(g, yaMando\), uso, Date\.now\(\), nombre\);/, 'aprobar respeta el mismo tope');
  const d = leer('lib/goteo-db.ts');
  assert.match(d, /\.eq\('canal', 'whatsapp'\)\.eq\('estado', 'enviado'\)/, 'sólo lo que salió, y sólo WhatsApp: tres días de borradores sin aprobar no calientan un número');
  assert.match(d, /new Intl\.DateTimeFormat\('en-CA', \{ timeZone: zona \}\)/, 'el día es el del negocio: en UTC, una jornada de Cancún eran dos días');
  assert.match(d, /subidasDelArranque\(porSecuencia\.get\(id\) \?\? new Map\(\), hoy, g\)/);
  assert.doesNotMatch(d, /\.update\(|\.insert\(|\.upsert\(|\.delete\(/, 'sólo lee');

  const h = leer('app/automations/difusion/HojaDifusion.tsx');
  assert.match(h, /\.\.\.\(wa\.variantes\?\.length \? \{ variantes: wa\.variantes \} : \{\}\)/, 'lo que se escribe en la hoja llega');
  assert.match(h, /permiteAdjuntos=\{false\} conVersiones /, 'y se puede escribir');
  assert.match(h, /useState\(true\);/, 'de a poco, de entrada');
  assert.match(h, /const arrancaDePoco = conArranque && canales\.includes\('whatsapp'\) && !!vista\?\.whatsappQr;/, 'el arranque es por WhatsApp');
  assert.match(h, /vista\.lineaWaDia != null && goteo\.dia > vista\.lineaWaDia/, 'la línea manda: pedir 60 con una de 40 se dice');
  assert.match(h, /crearDifusionAction\(\{ seleccion: JSON\.parse\(clave\), canales, mensajes, goteo \}\)/);
  assert.match(h, /por WhatsApp arranca con \$\{goteo\.arranque\.dia\}/, 'la confirmación lo dice');
  assert.match(h, /textoDeDuracionPorCanal\(alcance\.porCanal, goteo\)/);

  const p = leer('app/automations/ConfigAutomatizacionPanel.tsx');
  assert.match(p, /if \(tope === undefined\) return null;/, 'sin tope no hay fila');
  assert.match(p, /onCambio=\{\(x\) => guardar\(\{ arranque: x \? \{ dia: Math\.min\(20, tope\), sube: 20 \} : null \}\)\}/);
  assert.match(p, /<FilaArranque key="arranque"/);

  const e = leer('app/automations/EditorMensajeWhatsApp.tsx');
  assert.match(e, /const agregaVersiones = !!conVersiones && unTexto && !vozMako && paso\.tipo !== 'ia' && !!\(paso\.cuerpo \?\? ''\)\.trim\(\);/, 'ni en el aviso al equipo, ni en la IA, ni sin texto');
  assert.match(e, /conVariantes && \(variantes\.length > 0 \|\| agregaVersiones\) &&/, 'sin ninguna, igual hay dónde tocar');
  assert.match(e, /onClick=\{\(\) => onChange\(\{ variantes: \[\.\.\.variantes, ''\] \}\)\}/);
  assert.match(e, /variantes\.length < TOPE_VERSIONES/);
  // Corregir el texto las suelta: se dice en los tres caminos, y «Deshacer» las devuelve a la vista.
  assert.match(e, /avisarSiSeVan\(r\.cuerpo\);/);
  assert.match(e, /if \(!devolver\?\.length\) avisarSiSeVan\(f\.cuerpo \?\? '', esUnTexto\(lista\)\);/, 'el lienzo pasa por acá');
  assert.match(e, /avisarSiSeVan\(cuerpo\);/);
  assert.match(e, /vivo\.current\.onChange\(\{ variantes: \[\.\.\.antes\] \}\);\s*setAbierto\('variantes'\);/);
  // Sólo donde el motor las sortea: en el oficial, el recordatorio o el aviso al grupo se guardaban y no salían.
  assert.match(leer('app/automations/FlujoLienzo.tsx'), /conVersiones=\{noOficial && !recordatorio\}/);

  const def = leer('lib/api-mako/areas/chatbot.def.ts');
  for (const x of ['variantes', 'arranqueDia', 'arranqueSube', 'goteoArranqueDia', 'goteoArranqueSube']) assert.match(def, new RegExp(`nombre: '${x}'`), x);
  const run = leer('lib/api-mako/areas/chatbot.run.ts');
  assert.match(run, /canales\.includes\('whatsapp'\) && input\.sinArranque !== true \? \{ arranque:/, 'MaKo arranca igual que la hoja');
  // Lo que cuida: el cambio se prueba contra lo GUARDADO (`leerConfigAutomatizacion(id)` es el previo). Desde el 4/11/2026 la
  // llamada lleva además las columnas del email.
  assert.match(run, /cambioDeConfigDelInput\(input, await leerConfigAutomatizacion\(id\)(, columnas)?\)/, 'el arranque se prueba contra lo que tiene: no dice «quedó» y lo tira');
  assert.match(run, /las otras: \$\{pedido\.mensajes\.whatsapp\.variantes\.map\(/, 'lo que se confirma se lee: la difusión no se deshace');
});
