// LA SEGUNDA VERIFICACIÓN DEL 20/11 (tarde), LO DEL CHAT DEL RETO: los 12 puntos que quedaban sobre producción (5993355b5), con lo que
// decidió el Cerebro en la memoria (onboarding-16-11-decisiones, «20/11, tarde»). El detalle, en docs/hallazgos-onboarding.md.
//
// PROBADO ROMPIÉNDOLO (20/11/2026), cada rotura por separado y vuelta atrás:
//   L1 `lugarVisible` sin el recorte del hilo (sólo la ventana)               → falla «el video en su mensaje»
//   L2 el video de la esquina sin avisar al terminar (`if (s.tipo === 'video') return;`) → falla «la esquina avisa»
//   A1 `cuandoSeAbrio` con el adelanto vigente desde el inicio               → falla «cuándo se abrió»
//   P1 la marca de la foto vuelve a «Haz clic en tu foto»                    → falla «el perfil, después de la hora»
//   P2 el perfil vuelve a tener la sección Perfil en el medio                → falla «el perfil, después de la hora»
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { DIAS_RETO, RETO_MANANA, cuandoSeAbrio, leerEstado, rotuloDelDia, type EstadoReto } from '../lib/reto/dias';
import { lugarVisible } from '../app/_ui/tutorial/lugarDelVideo';

/** El código de un archivo, con los finales de línea de GitHub (LF). */
const fuente = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const h = (iso: string) => Date.parse(iso);
const MIN = 60_000;

test('V4 y R57-21: el video del día corre en su mensaje (el motor lo dibuja encima mientras se ve) y baja a la esquina al scrollear o navegar', async () => {
  // La cuenta pura: entero a la vista, sin recorte; tapado arriba por el hilo, recortado; casi nada a la vista, a la esquina.
  const caja = { x: 100, y: 300, ancho: 400, alto: 270 };
  const ventana = { x: 0, y: 0, ancho: 1440, alto: 900 };
  assert.deepEqual(lugarVisible(caja, [ventana])?.recorte, { arriba: 0, derecha: 0, abajo: 0, izquierda: 0 });
  const hilo = { x: 80, y: 400, ancho: 700, alto: 500 };
  assert.deepEqual(lugarVisible(caja, [ventana, hilo])?.recorte, { arriba: 100, derecha: 0, abajo: 0, izquierda: 0 }, 'recortado a lo que se ve del hilo');
  assert.equal(lugarVisible({ ...caja, y: 900 - 40 }, [ventana]), null, 'con menos de un cuarto a la vista, a la esquina');
  assert.equal(lugarVisible({ ...caja, ancho: 0 }, [ventana]), null, 'escondido');
  // El chat: su lugar en el mensaje, y el video del día con ese lugar (nunca más el botón al video chico de 300 px).
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes('<div ref={raiz} className="mk-vmom rt-vlugar" data-video-lugar={dia.video}'), 'el lugar del video, en el mensaje');
  assert.ok(chat.includes("mostrarTutorial(tutorialDelDia(dia), { video: dia.video, directo: true, lugar: lugarDelDia(dia),"), 'el motor lo pasa ahí');
  assert.ok(!chat.includes('Ver el video del día {dia.n}: te marco dónde tocar'), 'sin el botón que lo mandaba a la esquina');
  const motor = fuente('../app/_ui/tutorial/MotorTutorial.tsx');
  assert.ok(motor.includes('const enLugar = useLugarALaVista(lugar && video ? lugar : null);'), 'el video del motor sigue su lugar');
  assert.ok(motor.includes('lugar={senal.lugar}'), 'con el lugar de la señal');
  // El mismo <video> en el mensaje y en la esquina: un solo elemento en esa rama (no se vuelve a montar al pasar de uno a otro).
  const rama = motor.slice(motor.indexOf('if (lugar && video) {'), motor.indexOf('\n  return (\n', motor.indexOf('if (lugar && video) {')));
  assert.equal((rama.match(/<video /g) ?? []).length, 1);
  assert.ok(rama.includes('<BarraDelVideo vidRef={vidRef}'), 'con la barra del reproductor de la maqueta');
  // La señal lleva el lugar.
  const store = await import('../app/_ui/tutorial/store');
  store.mostrarTutorial({ pestana: 'x', nombre: 'X', ruta: '/x', intro: '', pasos: [] } as never, { video: 'reto-dia-2', lugar: '[data-video-lugar="reto-dia-2"]' });
  const s = store.senalAhora();
  assert.ok(s && s.tipo === 'tutorial' && s.lugar === '[data-video-lugar="reto-dia-2"]');
  store.cerrarTutorial();
});

test('D1-03: el video del día 1 que termina en la esquina (o se cierra ahí) avisa, y «Tu siguiente paso» marca la fila real', async () => {
  const store = await import('../app/_ui/tutorial/store');
  const avisos: string[] = [];
  store.reproducirFlotante('reto-dia-1', 'Día 1', 4, (m) => avisos.push(m));
  let s = store.senalAhora();
  assert.ok(s && s.tipo === 'video');
  store.terminar(s.id, 'fin');
  assert.deepEqual(avisos, ['fin'], 'terminó en la esquina');
  store.reproducirFlotante('reto-dia-1', 'Día 1', 4, (m) => avisos.push(m));
  s = store.senalAhora();
  store.terminar(s!.id, 'omitido');
  assert.deepEqual(avisos, ['fin', 'omitido'], 'la cerraron con su X');
  store.reproducirFlotante('reto-dia-1', 'Día 1', 4, (m) => avisos.push(m));
  assert.equal(store.volverAlChat('reto-dia-1'), 4);
  assert.deepEqual(avisos, ['fin', 'omitido'], 'volver a su mensaje no es terminar');
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes('onTermina={alFin} onTerminaFuera={alFin}'), 'en el chat o en la esquina');
  assert.ok(chat.includes('if (sigue.t && !senalAhora()) correr(sigue.t, sigue.n);'), 'sin su fila en el hilo, marca la tarea');
  assert.ok(chat.includes('if (primera && !document.querySelector(primera.sel)) return;'), 'nunca una marca esperando algo que no está');
  assert.ok(fuente('../app/_ui/tutorial/useVideoQueFlota.ts').includes('reproducirFlotante(clave, titulo, t, (m) => aviso.current?.(m));'));
});

test('OD-06 y V1: «Muéstrame» deja visto el tutorial de la pestaña; la Ticketera se abre con su botón del Ops Center', () => {
  const p = fuente('../app/second-brain/reto/enSuPestana.ts');
  const i = p.indexOf('anotarTutorialVisto(t);\n    mostrarTutorial(t, {');
  assert.ok(i > 0, 'al tocar la pestaña, visto antes de correr su video');
  assert.ok(p.includes("if (enEnsayo()) marcarVistoEnEnsayo(id); else anotarVisto(id);"), 'en el ensayo, en el navegador');
  assert.ok(fuente('../app/second-brain/reto/ChatDelReto.tsx').includes('if (t) { anotarTutorialVisto(t); mostrarTutorial(t, {'), 'también ahí mismo');
  const rec = fuente('../app/_ui/Recorrido.tsx');
  assert.ok(rec.includes('export function anotarVisto(id: string): void {') && rec.includes('if (quien) ultimoQuien = quien;'), 'la clave de la persona, la que lee useRecorrido');
  assert.ok(p.includes("const BOTON_DE_LA_CONSULTA: Readonly<Record<string, string>> = { ticketera: '[data-recorrido=\"sb-ticketera\"]' };"));
  assert.ok(p.includes("if (!t.ruta.includes('?')) return selDeLaBarra(t.ruta);"), 'una ruta con consulta no es una fila de la barra');
  assert.ok(p.includes('const sel = dondeSeAbre(t);\n  if (!sel || !seVe(sel)) return false;'));
});

test('OD-11: el perfil del día 2, después de la hora: arranca solo tras su mensaje, como la maqueta', () => {
  const perfil = DIAS_RETO[1].tareas.find((t) => t.id === 'perfil')!;
  assert.deepEqual(perfil.marcas.map((m) => m.haz), ['Pasa el mouse por tu foto', 'Haz clic en Settings', 'Entendido'], 'la foto, Settings y el botón de la foto');
  assert.equal(perfil.marcas[0].pasar, true, 'pasar el mouse ya cuenta');
  assert.ok(!perfil.marcas.some((m) => /tour-settings-info/.test(m.sel)), 'sin la sección Perfil en el medio');
  const integ = DIAS_RETO[1].tareas.find((t) => t.id === 'integraciones')!;
  assert.equal(integ.marcas[0].haz, 'Pasa el mouse por tu foto');
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes("const esperaLaHora = (x: TareaReto) => dia.n === 2 && x.id === 'perfil' && !e.horaWa && !tareaDespues(e, 2, 'hora');"), 'la cadena no salta a la hora');
  assert.ok(chat.includes("if (senalAhora() || yaMarcada('2:perfil') || !document.querySelector('[data-recorrido=\"sb-reto-dia-2-perfil\"]')) return;"), 'después de su mensaje');
  assert.ok(chat.includes('...(m.pasar ? { pasar: true } : {})'), 'marcarTarea le pasa «pasar» al motor');
  const motor = fuente('../app/_ui/tutorial/MotorTutorial.tsx');
  assert.ok(motor.includes("if (pasa) el.addEventListener('pointerenter', alPasar);"), 'el motor lo cuenta al pasar el mouse');
});

test('D1-06: «¿Adelantas el día N?» con el tema «Tu reto», la respuesta de la maqueta a «Mañana» y la elección como su mensaje', () => {
  assert.equal(RETO_MANANA('18:00', 2), 'Perfecto: mañana a las 18:00 te escribo con el día 2.');
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  const adel = chat.slice(chat.indexOf('export function AdelantarDia('));
  assert.ok(adel.indexOf('<span className="co-preg__tema">Tu reto</span>') > 0 && adel.indexOf('<span className="co-preg__tema">Tu reto</span>') < adel.indexOf('¿Adelantas el día {n}?</p>'));
  assert.ok(chat.includes('{termino && eligioManana && siguiente && <DeLaPersona texto="Mañana" />}'));
  assert.ok(chat.includes('{e.adelantados?.includes(dia.n) && <DeLaPersona texto={`Adelantar al día ${dia.n}`} />}'));
  assert.ok(fuente('../app/api/reto/route.ts').includes('adelantados: [...new Set([...(e.adelantados ?? []), dia])]'), 'se guarda qué días adelantó');
  const e = leerEstado(JSON.stringify({ inicio: '2026-11-18T15:00:00Z', adelantado: 3, hechas: {}, adelantados: [2, 3, 3, 9, 'x'] }))!;
  assert.deepEqual(e.adelantados, [2, 3], 'validados');
});

test('f24-03: la tarjeta del día lleva «Día N de 7» en su cabecera y no «Lo que te toca hoy»', () => {
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes('<p className="rt-tarjeta__cab"><span className="rt-tarjeta__n">Día {dia.n} de 7</span><span className="rt-tarjeta__t">{dia.titulo}</span></p>'));
  assert.ok(!chat.includes("'Lo que te toca hoy'") && !chat.includes('className="rt-tarjeta__sub"'));
});

test('R57-F3: cuándo se ABRIÓ cada día (no cuándo se vio), y la hora de las burbujas es la confirmada', () => {
  // Empezó el 18/11 a las 12:00 de Argentina, con el aviso a las 9:00: el 2 se abrió el 19 a las 9:00 y el 3 el 20 a las 9:00.
  const e: EstadoReto = { v: 1, inicio: '2026-11-18T15:00:00.000Z', adelantado: 1, hechas: {}, horaWa: '9:00' };
  const ahora = h('2026-11-20T18:00:00Z');
  assert.equal(cuandoSeAbrio(e, 1, ahora), h(e.inicio));
  assert.ok(Math.abs(cuandoSeAbrio(e, 2, ahora)! - h('2026-11-19T12:00:00Z')) <= MIN, 'el 2, el 19 a las 9:00');
  assert.ok(Math.abs(cuandoSeAbrio(e, 3, ahora)! - h('2026-11-20T12:00:00Z')) <= MIN, 'el 3, el 20 a las 9:00');
  assert.equal(cuandoSeAbrio(e, 4, ahora), null, 'el 4 todavía no');
  // Vuelve recién el 20: el 2 dice «Ayer» y el 3 «Hoy» (antes los dos quedaban del 20 y decían «Hoy»).
  assert.deepEqual([2, 3].map((n) => rotuloDelDia(cuandoSeAbrio(e, n, ahora)!, ahora)), ['Ayer', 'Hoy']);
  // Adelantado: desde cuando se adelantó, no desde el inicio; el que sigue, al otro día a su hora.
  const ad: EstadoReto = { ...e, adelantado: 2, adelantadoEn: '2026-11-18T20:00:00.000Z' };
  assert.ok(Math.abs(cuandoSeAbrio(ad, 2, ahora)! - h('2026-11-18T20:00:00Z')) <= MIN, 'el 2, cuando lo adelantó');
  assert.ok(Math.abs(cuandoSeAbrio(ad, 3, ahora)! - h('2026-11-19T12:00:00Z')) <= MIN, 'el 3, al otro día a las 9:00');
  // Lo guardado gana.
  assert.equal(cuandoSeAbrio({ ...e, abiertoEl: { 2: '2026-11-19T13:30:00.000Z' } }, 2, ahora), h('2026-11-19T13:30:00Z'));
  const ruta = fuente('../app/api/reto/route.ts');
  assert.ok(ruta.includes('new Date(cuandoSeAbrio(x, Number(n), Date.parse(cuando)) ?? Date.parse(cuando)).toISOString()'), 'el server guarda cuándo se abrió');
  assert.ok(ruta.includes("abiertoEl: { ...(e.abiertoEl ?? {}), [String(dia)]: new Date(ahora).toISOString() },"), 'el adelantado, en el momento');
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes("const horaWa = e?.horaWa ?? '9:00';\n  const horaElegida = hora ?? horaWa;"), 'la confirmada; la elegida, aparte');
  assert.ok(chat.includes('<TarjetaHora p={p} guardada={e.horaWa ?? null} linea={linea} hora={horaElegida ?? hora}'), 'la elegida, sólo en su tarjeta');
});

test('R57-F5: en el teléfono el reto SIEMPRE dice «Sigamos en tu computadora», con el MISMO componente del onboarding', () => {
  assert.ok(!existsSync(new URL('../app/second-brain/reto/SeguirEnPcReto.tsx', import.meta.url)), 'sin la copia aparte');
  const seguir = fuente('../app/onboarding/SeguirEnPc.tsx');
  assert.ok(seguir.includes('export function SeguirEnPc(') && !/from '\.\/ChatArranque'/.test(seguir), 'en su archivo, sin traer el chat del onboarding (tests/d6b-rutas.test.ts)');
  const arr = fuente('../app/onboarding/ChatArranque.tsx');
  assert.ok(arr.includes("import { SeguirEnPc } from './SeguirEnPc';\nexport { SeguirEnPc };") && !arr.includes('export function SeguirEnPc('), 'el onboarding usa el mismo');
  assert.ok(fuente('../app/m/second-brain/page.tsx').includes('<SeguirEnPc nombre={await nombreDelReto(yo.nombre)} email={email} para="reto" maqueta />'));
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes('const telefono = useSyncExternalStore(sinSuscribir, () => esTelefono(navigator.userAgent), () => false);\n  if (telefono) return <RetoEnElTelefono nombre={nombre} />;'), 'el chat del reto con su freno de teléfono');
  assert.ok(chat.includes('<SeguirEnPc nombre={(nombre ?? \'\').trim().split(/\\s+/)[0] ?? \'\'} email={email} para="reto" maqueta />'));
});

test('V5: el «dale play» del día dice el título del video («Día 2: conecta todo»)', () => {
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes('const titulo = v ? tituloDelVideo(v, dia.n) : `Día ${dia.n}`;\n  useDalePlay(raiz, { clave: delReto(dia.video), titulo, activo: dalePlay && conMarcas && !visto && !corre });'));
  assert.ok(chat.includes('<VideoDelMomento clave={dia.video} titulo={titulo}'), 'también el del día 1');
});

test('la entrada al reto (20/11, ~13:00): el nombre del onboarding del negocio, y lo visto es de ESTE reto', async () => {
  const { nombreDelArranque, primerNombreDe } = await import('../lib/reto/nombre-reglas');
  assert.equal(nombreDelArranque(JSON.stringify({ nombre: 'Lala Pérez', negocio: 'Lalaland' })), 'Lala');
  assert.equal(nombreDelArranque(JSON.stringify({ negocio: 'x' })), null, 'sin nombre, ninguno');
  assert.equal(nombreDelArranque('basura'), null);
  assert.equal(primerNombreDe('  Martin  Koncke '), 'Martin');
  const nombre = fuente('../lib/reto/nombre.ts');
  assert.ok(nombre.includes("if (await estaImpersonando().catch(() => true)) return '';"), 'mirando a un cliente, nunca el del administrador');
  assert.ok(!/from '[^']*onboarding-arranque-server'/.test(nombre), 'liviano: sin el servidor del onboarding (tests/d6b-rutas.test.ts)');
  assert.ok(fuente('../app/second-brain/page.tsx').includes('const nombrePersona = retoV2 ? await nombreDelReto(sesion?.nombre) :'), 'el Ops Center');
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes('const e = d?.estado ?? null;\n  fijarAmbitoDelReto(e?.inicio);'), 'el chat fija de qué reto es lo visto');
  assert.ok(chat.includes("const ap = useAparicion(claves, e?.inicio ? `${e.inicio}|` : '');"), 'cada mensaje con sus puntitos, en cada reto');
  assert.ok(chat.includes('localStorage.getItem(VISTO + ambito + k)'), 'lo visto, del reto');
  assert.ok(chat.includes('const fase = useEntrada(delReto(`reto-dia-${dia.n}`), hoy && nuevo);'), 'la entrada del día, del reto');
});
