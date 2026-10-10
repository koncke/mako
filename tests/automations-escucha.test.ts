// La CONDITION que escucha la respuesta («Si responde», nodo 'respuesta') cuelga del CRON en el dibujo,
// como en el motor. Martín, 10/10/2026, sobre la 198 del ws1: «hay una condición suelta que no esta
// conectado a nada... me deja probarlo y guardarlo». No estaba suelta en el dato —una respuesta del lead
// pausa la salida y corre esto—: la segunda pasada de la sexta tanda le había sacado la flecha al sacar la
// fila «Si responde» del CRON. Y sin casos, su única fila decía «Si no», que se lee como que falta algo.
//
// Y la otra mitad de la queja: «me deja probarlo». El botón «▶ Probar» ya frenaba con `frenoDelFlujo`,
// pero con el panel ABIERTO, ↻, «Cambió · ↻» y «Probar en WhatsApp» rearrancaban sobre lo que se edita
// sin mirar nada: desconectar una tarjeta y apretar ↻ corría —y mandaba de verdad— un flujo con una suelta.
//
// ROTURAS (10/10/2026), restaurando de memoria, base 7 / 0:
//   E1. sin la flecha del CRON a la que escucha                                  → 6 / 1
//   E2. la flecha sin `sinMas` (el ＋ del medio y la papelera la tocarían)          → 6 / 1
//   E3. la única fila vuelve a decir «Si no»                                     → 6 / 1
//   E4. `validarGrafo` deja pasar una tarjeta suelta de verdad                   → 6 / 1
//   E5. ↻ (`reiniciar`) rearranca sin mirar el freno                             → 6 / 1
//   E6. «Probar en WhatsApp» a un destino (`probarA`) sin mirar el freno          → 6 / 1
//   E7. el lienzo no le pasa el freno al panel (`EdicionLocal.freno`)            → 6 / 1
//   E8. «Desconectar» vuelve a contar la flecha del CRON a la que escucha        → 6 / 1
//   E9. el editor de la que escucha vuelve a decir «Si no» a secas               → 6 / 1
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { grafoDeSecuencia } from '../lib/flujo-conversacion';
import { validarGrafo, rotuloSiNoDeRespuesta } from '../lib/flujo-grafo';

const base = { canal: 'whatsapp', delay_horas: 0, asunto: null, template_wa: null } as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Paso = any;
const conEscucha = (casos: Paso[] = []): Paso[] => [
  { ...base, id: 'm1', orden: 1, cuerpo: 'Hola', siguiente: null },
  { ...base, id: 'r', orden: 2, nodo: 'respuesta', cuerpo: '', casos, si_no: 'k', siguiente: null },
  { ...base, id: 'k', orden: 3, cuerpo: 'Aviso al equipo', siguiente: null },
];

/** El fuente sin comentarios (las líneas primero) y con LF: los guards preguntan por el código. */
const fuente = (ruta: string) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de `const <nombre> = (…) => {` hasta la siguiente declaración del mismo nivel. */
const cuerpo = (src: string, nombre: string) => {
  const ini = src.indexOf(`const ${nombre} = (`);
  assert.ok(ini >= 0, `no está ${nombre}`);
  const fin = src.indexOf('\n  const ', ini + 10);
  return src.slice(ini, fin < 0 ? undefined : fin);
};

// ⚠️ DESDE EL 10/10/2026 LA FLECHA ES NORMAL: sin rótulo, sin punteado y con su papelera (`quitable`). Martín:
// «aparece luego del cron una flecha punteada que dice "Si responde"... La flecha no se puede eliminar, no se
// puede editar, nada de eso tiene sentido. De por sí no debería haber un chip en el medio»; y eligió «Una
// condición normal». Sin ＋ en el medio sigue (`sinMas`): insertar ahí escribiría lo que el dato no admite.
test('la CONDITION que escucha cuelga del CRON con una flecha NORMAL: sin rótulo, sin ＋ y con papelera', () => {
  const g = grafoDeSecuencia(conEscucha(), { disparador: 'Dejó el formulario' });
  const a = g.aristas.filter((x) => x.hasta === 'r');
  assert.equal(a.length, 1, 'la CONDITION que escucha quedó sin flecha de entrada (se lee suelta)');
  assert.equal(a[0].desde, 'entrada');
  assert.equal(a[0].etiqueta, undefined, 'volvió el chip «Si responde» en el medio de la flecha');
  assert.equal(a[0].tono, 'normal', 'volvió la flecha punteada');
  assert.equal(a[0].sinMas, true, 'insertar en el medio escribiría una flecha que el dato no admite');
  assert.equal(a[0].quitable, true, 'la flecha volvió a no poder borrarse');
});

test('sin casos, su única fila dice «Respondió»; con casos, la última sigue siendo «Si no»', () => {
  const sola = grafoDeSecuencia(conEscucha(), { disparador: 'x' }).nodos.find((n) => n.id === 'r')!;
  assert.deepEqual(sola.puertos?.map((p) => p.rotulo), ['Respondió']);
  const conCaso = grafoDeSecuencia(conEscucha([{ id: 'c1', titulo: 'Precio', siguiente: null }]), { disparador: 'x' }).nodos.find((n) => n.id === 'r')!;
  assert.equal(conCaso.puertos?.at(-1)?.rotulo, 'Si no');
  assert.equal(rotuloSiNoDeRespuesta({ casos: [] }), 'Respondió');
  assert.equal(rotuloSiNoDeRespuesta({ casos: [{}] }), 'Si no');
});

test('el editor de la que escucha dice lo mismo que la tarjeta (la misma función)', () => {
  const src = fuente('app/automations/EditorCondicion.tsx');
  const editor = src.slice(src.indexOf('export function EditorCondicionDeRespuesta'));
  assert.match(editor, /rotuloSiNoDeRespuesta\(\{ casos \}\)/, 'el editor escribe su propio «Si no»');
  assert.doesNotMatch(editor, />Si no</, 'volvió el «Si no» a secas en el editor');
});

test('Publicar y Probar (validarGrafo) frenan una tarjeta suelta de verdad, y no la que escucha', () => {
  assert.deepEqual(validarGrafo(conEscucha()), [], 'la que escucha no es una tarjeta suelta');
  const conSuelta = [...conEscucha(), { ...base, id: 'x', orden: 4, cuerpo: 'Nadie me llama', siguiente: null }];
  assert.ok(validarGrafo(conSuelta).some((e) => /tarjetas sueltas: x/.test(e)), 'una tarjeta sin flecha pasa Publicar y Probar');
});

test('la única flecha nueva del CRON es la de la escucha (no se dibuja sin una que escuche)', () => {
  const sin = conEscucha().filter((p: Paso) => p.id !== 'r');
  const g = grafoDeSecuencia(sin, { disparador: 'x' });
  assert.ok(!g.aristas.some((a) => a.etiqueta === 'Si responde'));
});

test('⚠️ con «Probar» abierto, cada rearranque mira el MISMO freno que Publicar', () => {
  const panel = fuente('app/automations/PanelProbar.tsx');
  // El freno es el de lo que se ve (el lienzo lo manda) o, sin edición, el del flujo guardado.
  assert.match(panel, /const freno = useMemo\(\(\) => \(propia \? propia\.freno : frenoDelFlujo\(flujoVivo, null\)\)/);
  // ↻ y «Cambió · ↻» (los dos llaman a `reiniciar`), «Probar en WhatsApp» a un destino, a uno nuevo, y al abrir.
  assert.match(cuerpo(panel, 'reiniciar'), /^[^]*?\{\s*if \(frenado\(\)\) return;/, '↻ rearranca sin mirar el freno');
  const probarA = cuerpo(panel, 'probarA');
  assert.ok(probarA.indexOf('if (frenado()) return;') >= 0 && probarA.indexOf('if (frenado()) return;') < probarA.indexOf('setDestino('), '«Probar en WhatsApp» manda sin mirar el freno');
  assert.match(cuerpo(panel, 'probarNuevo'), /if \(frenado\(\)\) \{ cerrarMenu\(\); return; \}/, 'un número nuevo prueba sin mirar el freno');
  assert.match(panel, /if \(!frenado\(\)\) arrancarRefs\(\);/, 'al abrir arranca sin mirar el freno');
  // Y el lienzo le pasa el freno al panel, calculado con la misma función que Publicar.
  const perfil = fuente('app/automations/SecuenciaPerfil.tsx');
  assert.match(perfil, /const frenoLocal = useMemo\(\(\) => frenoDeEsta\(pasos\), \[pasos, frenoDeEsta\]\);/);
  assert.match(perfil, /freno: frenoLocal, frenar: frenarDesdeProbar,/, 'el lienzo no le pasa el freno al panel');
});

test('«Desconectar» SÍ cuenta la flecha del CRON a la que escucha (10/10/2026: la deja suelta)', () => {
  const lienzo = fuente('app/automations/FlujoLienzo.tsx');
  assert.match(lienzo, /const leLlega = grafo\.aristas\.some\(\(a\) => a\.hasta === id && !\(a\.sinMas && !a\.quitable\) && /);
});
