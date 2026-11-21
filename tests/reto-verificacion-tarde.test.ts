// LA SEGUNDA VERIFICACIÓN DEL 20/11 (tarde), LO DEL CHAT DEL RETO: los 12 puntos que quedaban sobre producción (5993355b5), con lo que
// decidió el Cerebro en la memoria (onboarding-16-11-decisiones, «20/11, tarde»). El detalle, en docs/hallazgos-onboarding.md.
//
// PROBADO ROMPIÉNDOLO (20/11/2026), cada rotura por separado y vuelta atrás:
//   L1 `lugarVisible` sin el recorte del hilo (sólo la ventana)               → falla «el video en su mensaje»
//   L2 el video de la esquina sin avisar al terminar (`if (s.tipo === 'video') return;`) → falla «la esquina avisa»
//   A1 `cuandoSeAbrio` con el adelanto vigente desde el inicio               → falla «cuándo se abrió»
//   P1 la marca de la foto vuelve a «Haz clic en tu foto»                    → falla «el perfil, después de la hora»
//   P2 el perfil vuelve a tener la sección Perfil en el medio                → falla «el perfil, después de la hora»
//   N1-N4 el nombre sin la guarda del administrador, sin fijar el ámbito, lo visto sin ámbito, el nombre entero → «la entrada al reto»
//   H1-H2 la columna del hilo sin .rt-hilo, las acciones sin margin-left: auto → falla «la carga del reto y su cabecera»
//   I1 `intercalar` sin cortar la charla · I2 una pantalla sin la hora de su mensaje → falla «un solo hilo por hora»
//   M1 la marca de la tarea que toca sin esperar el video · C1 los puntitos de la carga siempre → falla «el scroll común, cada paso…»
//   (Sacar `abierto >= 7` de `proximaApertura` NO da rojo, y es correcto: la guarda siguiente ya devuelve null con los 7 abiertos.)
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

test('D1-03: el video del día 1 que termina en la esquina (o se cierra ahí) avisa, y al terminar siempre se marca lo que falta (la llamada con Leila)', async () => {
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
  assert.ok(chat.includes('if (primera && !document.querySelector(primera.sel)) return;'), 'nunca una marca esperando algo que no está');
  // 20/11, la llamada con Leila: al terminar el video, SIEMPRE se marca lo que falta (el día 1: Offer Coach en la barra), también con
  // el motor ocupado (espera a que se libere) y también en la misma pestaña; y sin la tarjeta «Tu siguiente paso» abajo.
  assert.ok(chat.includes('onFinVideo={() => setFinDelVideo(dia)}'), 'el fin del video queda anotado');
  assert.ok(chat.includes('if (!finDelVideo || senal) return;\n    setFinDelVideo(null);\n    marcarLoQueFalta(finDelVideo, [], true);'), 'con el motor ocupado no marcaba nada: espera a que se libere');
  assert.ok(chat.includes('if (!t || (!siempre && yaMarcada(`${dia.n}:${t.id}`))) return;'), 'en la misma pestaña no volvía a marcar');
  assert.ok(!chat.includes('rt-sigue') && !chat.includes('Tu siguiente paso: <b>'), 'sin la tarjeta «Tu siguiente paso» arriba de la caja');
  // Sin video en el manifiesto (D1-03: «Sin video, “abre Offer Coach” marca la fila real»; lo hacía la tarjeta): se marca igual, sin
  // anotarlo como visto (un manifiesto que no llegó también viene vacío y «listo»).
  assert.ok(chat.includes('const sinVideo = listo && !v && dalePlay;\n  useEffect(() => {\n    if (sinVideo) onFin?.();'), 'un día sin video no marcaba nunca');
  const vd = chat.slice(chat.indexOf('function VideoDelDia('), chat.indexOf('if (v && conMarcas) {'));
  assert.ok(vd.includes('if (sinVideo) onFin?.();') && !/sinVideo[^\n]*anotarVisto/.test(vd), 'antes de los `return`, y sin anotar visto');
  // (20/11: y se pausa sólo si pasó a la esquina, tests/video-en-el-chat.test.ts.)
  assert.ok(fuente('../app/_ui/tutorial/useVideoQueFlota.ts').includes('if (!reproducirFlotante(clave, titulo, t, (m) => aviso.current?.(m))) return;'));
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
  // Después de la hora arranca solo, como «cada paso con su marca» (reto-9): la tarea que toca hoy, con su fila ya en el hilo.
  assert.ok(chat.includes("const esperaLaHora = (x: TareaReto) => actual.n === 2 && x.id === 'perfil' && !e.horaWa && !tareaDespues(e, 2, 'hora');"), 'el perfil espera la hora');
  assert.ok(chat.includes('if (n > 1 && !document.querySelector(`[data-tarea="${claveToca}"]`)) return;'), 'después de su mensaje y su fila');
  assert.ok(chat.includes('...(m.pasar ? { pasar: true } : {})'), 'marcarTarea le pasa «pasar» al motor');
  const motor = fuente('../app/_ui/tutorial/MotorTutorial.tsx');
  assert.ok(motor.includes("if (pasa) el.addEventListener('pointerenter', alPasar);"), 'el motor lo cuenta al pasar el mouse');
});

test('D1-06: «¿Adelantas el día N?» con el tema «Tu reto», la respuesta de la maqueta a «Mañana» y la elección como su mensaje', () => {
  assert.equal(RETO_MANANA('18:00', 2), 'Perfecto: mañana a las 18:00 te escribo con el día 2.');
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  const adel = chat.slice(chat.indexOf('export function AdelantarDia('));
  assert.ok(adel.indexOf('<span className="co-preg__tema">Tu reto</span>') > 0 && adel.indexOf('<span className="co-preg__tema">Tu reto</span>') < adel.indexOf('¿Adelantas el día {n}?</p>'));
  assert.ok(chat.includes('{mananaDia && sig && verFin(`yo-manana:${sig.n}`) && <DeLaPersona texto="Mañana" />}'), 'con el cierre de su día (reto-6), en su turno de la cola');
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
  // (20/11: y recién con el póster dibujado, tests/llegada-dale-play-dibujado.test.ts.)
  assert.ok(chat.includes('const titulo = v ? tituloDelVideo(v, dia.n) : `Día ${dia.n}`;\n'));
  assert.ok(chat.includes('useDalePlay(raiz, { clave: delReto(dia.video), titulo, activo: dalePlay && conMarcas && !visto && !corre && posterDibujado });'));
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
  assert.ok(chat.includes("const amb = e?.inicio ? `${e.inicio}|` : '';") && chat.includes('alMostrar: (id) => { if (amb) anotarVistoEnCola(amb + id); },'), 'cada mensaje con sus puntitos, en cada reto');
  assert.ok(chat.includes('localStorage.getItem(VISTO + ambito + k)'), 'lo visto, del reto');
  assert.ok(chat.includes('const fase = useEntrada(delReto(`reto-dia-${dia.n}`), hoy && nuevo);'), 'la entrada del día, del reto');
});

test('la carga del reto y su cabecera, como la maqueta (20/11, la captura de Martín): la burbuja a la izquierda, las acciones a la derecha', () => {
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  // La columna del hilo, a todo el ancho: con margin-inline: auto adentro de la del panel, se achicaba y centraba la burbuja de carga.
  assert.ok(chat.includes('<div className="co-hilo__col rt-hilo" data-recorrido="sb-reto-hilo">'));
  assert.ok(chat.includes('.rt-hilo { width: 100%; margin-inline: 0; }'));
  // A la derecha (la maqueta, .mq-arriba: margin-left: auto): el desplegable, los fijados y, LO ÚLTIMO, el ícono de videos (20/11, la
  // llamada con Leila, 00:31:46: «el icono de video siempre a la derecha»; gana sobre el orden de la maqueta, que lo ponía antes del pin).
  assert.ok(fuente('../app/second-brain/reto/CatalogoTutoriales.tsx').includes('.rt-acciones { margin-left: auto; flex: none;'));
  const acc = chat.slice(chat.indexOf('<span className="rt-acciones">'));
  const i = (s: string) => acc.indexOf(s);
  assert.ok(i('<DesplegableReto ') >= 0 && i('<DesplegableReto ') < i('<PinDelReto ') && i('<PinDelReto ') < i('<BotonTutoriales '), 'el ícono de videos, lo último a la derecha');
  assert.ok(chat.includes('.rt-menu { position: absolute; top: calc(100% + 8px); right: 0;'), 'el menú abre desde la derecha');
  assert.ok(chat.includes('@media (max-width: 480px) { .rt-btn__txt { position: absolute; width: 1px;'), 'a 375 entra: «Día N de 7», el catálogo y los fijados');
});

test('auditoría de chats (reto-2, reto-6 y reto-7): un solo hilo por hora, el cierre de cada día y el día que se abre con el chat abierto', async () => {
  const { intercalar, horasDeLaCharla } = await import('../app/second-brain/reto/hilo-por-hora');
  const msg = (id: string, at: string | null) => ({ k: 'msg', id, role: 'user', texto: id, at }) as never;
  const charla = [msg('a', '2026-11-19T13:00:00Z'), { k: 'pantalla', id: 'p', p: {} } as never, msg('b', '2026-11-20T15:00:00Z'), msg('c', null)];
  assert.deepEqual(horasDeLaCharla(charla), [h('2026-11-19T13:00:00Z'), h('2026-11-19T13:00:00Z'), h('2026-11-20T15:00:00Z'), Infinity], 'la pantalla, con su mensaje; sin hora, al final');
  const piezas = [{ t: h('2026-11-20T12:00:00Z'), key: 'dia:2' }, { t: h('2026-11-18T15:00:00Z'), key: 'dia:1' }];
  const hilo = intercalar(piezas, charla).map((x) => ('pieza' in x ? x.pieza.key : x.tramo.map((y) => (y as { id: string }).id).join('')));
  // El día 1, la charla del 19, el día 2 (abierto el 20 a las 9:00) DEBAJO de esa charla, y lo de después (y lo que sale ahora) al final.
  assert.deepEqual(hilo, ['dia:1', 'ap', 'dia:2', 'bc']);
  assert.deepEqual(intercalar([], charla).length, 1, 'sin días, la charla entera');
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  assert.ok(chat.includes('const hiloPorHora = intercalar(piezas, k.items);'), 'el chat del reto, por hora');
  assert.ok(!chat.includes('<HiloDelCliente k={k} />'), 'nunca más la charla entera debajo de todo');
  assert.ok(chat.includes('k={{ ...k, items: x.tramo, enCurso: i === ultimoTramo && k.enCurso }}'), 'un tramo de la charla; los puntitos, sólo en el último');
  // reto-6: el cierre de cada día que terminó, debajo de ese día (no sólo el del último).
  assert.ok(chat.includes("piezas.push({ t: tFin, key: `fin:${dia.n}`, nodo: ("), 'cada día con su cierre');
  assert.ok(chat.includes('const verFin = (k2: string) => !esHoy || ver(k2);'), 'los de antes, ya vistos, como están');
  // reto-7: a la hora en que se abre el que sigue, se relee.
  const { proximaApertura } = await import('../lib/reto/dias');
  const e: EstadoReto = { v: 1, inicio: '2026-11-18T15:00:00.000Z', adelantado: 1, hechas: {}, horaWa: '9:00' };
  const p = proximaApertura(e, h('2026-11-18T20:00:00Z'));
  assert.ok(p != null && Math.abs(p - h('2026-11-19T12:00:00Z')) <= MIN, 'el 2, el 19 a las 9:00');
  assert.equal(proximaApertura({ ...e, adelantado: 7 }, h('2026-11-18T20:00:00Z')), null, 'con los 7 abiertos, ninguna');
  assert.ok(chat.includes('const t = window.setTimeout(() => { void leer(); }, Math.min(Math.max(proxima - Date.now() + 3000, 1000), 2_000_000_000));'));
});

test('auditoría de chats (reto-1, reto-5, reto-9, reto-10 y reto-11): el scroll común, cada paso con su marca, la X del «dale play» y la carga', () => {
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  // reto-1 y reto-10: el gancho común, con la clave de la ÚLTIMA fila (nunca una cuenta): los puntitos, la última pieza o mensaje, el catálogo.
  assert.ok(chat.includes('useBajarAlUltimo(seguirHilo, claveUltimaFila);'));
  assert.ok(chat.includes("const claveUltimaFila = catalogo ? 'catalogo' : !d || !e ? 'carga' : ["), 'el catálogo y la carga también');
  assert.ok(!/useBajarAlUltimo\(seguirHilo, `[^`]*\.length/.test(chat), 'sin cuentas en la clave');
  assert.ok(!chat.includes('el.scrollTop = el.scrollHeight; }, [d?.abierto, d?.hechos, ap.escribiendo]);'), 'sin el scroll de antes');
  // reto-9: la tarea que toca hoy se marca sola, después del video, con su fila en el hilo.
  assert.ok(chat.includes('if (!t || !n || yaMarcada(claveToca) || !yaVisto(`video:${n}`)) return;'));
  assert.ok(chat.includes('if (n > 1 && !document.querySelector(`[data-tarea="${claveToca}"]`)) return;'));
  assert.ok(chat.includes("useDalePlay(boton, { clave: delReto(`muestra-${m.pestana}`), titulo: m.nombre, activo: !!v && posterDibujado });"), 'la muestra con su «dale play»');
  // reto-5 (a): cerrar el «dale play» del día 1 con su X marca Offer Coach.
  assert.ok(chat.includes("if (!arranco.current && dalePlayCerrado(dia.video)) { anotarVisto(`video:${dia.n}`); onFin?.(); }"));
  // reto-11: los puntitos de la carga, sólo la primera vez.
  assert.ok(chat.includes('!d || !e ? (primeraVez ? <Burbuja>'));
});

test('la entrada y la cola de salida (auditoría de chats, reto-3, reto-4 y reto-8; la memoria, «20/11, ~13:00»)', () => {
  const chat = fuente('../app/second-brain/reto/ChatDelReto.tsx');
  // La llegada (el video del recorrido) primero; lo del reto, recién con el recorrido visto (terminado u omitido).
  const iLlegada = chat.indexOf('<LlegadaAlReto nombre={nombre} listo={listo} onMostrada={() => setLlegadaMostrada(true)} />');
  assert.ok(iLlegada > 0 && iLlegada < chat.indexOf("{ver('hola') && <Burbuja>"), 'la llegada, arriba de todo');
  assert.ok(chat.includes('const puerta = llegadaMostrada && recorridoVisto;') && chat.includes('retenido: (id) => historia !== amb || !amb || !puerta || esperaSuDia(id),'), 'retenido hasta la llegada y el recorrido');
  // Cada mensaje con su texto (los puntitos según el largo); el recuadro y la muestra, como filas de la cola.
  assert.ok(chat.includes("{ id: 'hola', de: 'mako', texto: RETO_HOLA(nombre) },"));
  assert.ok(chat.includes('...(muestraPendiente ? [{ id: `muestra:${muestraPendiente.pestana}`, de: \'mako\', texto: RETO_MUESTRA(muestraPendiente) }] : []),'), 'la muestra pedida, con su clave desde el clic');
  assert.ok(chat.includes("{ id: 'piloto', de: 'mako', texto: RETO_PILOTO(d.funnel), pieza: !!x.whatsapp }"), 'la tarjeta del audio, después del piloto');
  assert.ok(chat.includes("dia.whatsapp && cola.conPieza('piloto') && <TarjetaPrueba"));
  // reto-3: la tarjeta del día (y el QR del día 2) después del mensaje, con su pausa.
  assert.ok(chat.includes('const t = window.setTimeout(() => setConPieza(true), MS_PAUSA_PIEZA);'));
  assert.ok(chat.indexOf('{conPieza && <>') < chat.indexOf('{esperaApp && qrApp && <TarjetaQrApp'), 'el QR, después del mensaje');
  // reto-8: el mensaje de vuelta al reto, con los puntitos según su largo.
  const vuelta = fuente('../app/second-brain/reto/MensajeVueltaAlReto.tsx');
  assert.ok(vuelta.includes('msEscribiendo(RETO_LISTO)') && !vuelta.includes('MS_ESCRIBE)'));
});
