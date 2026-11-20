// LOS CHATS DEL TELÉFONO Y DEL SUPERADMIN BAJAN HASTA LO ÚLTIMO (20/11/2026, la auditoría de los chats con escéptico, tanda 3:
// movil-1 a 5 y admin-1 a 6). Martín, para TODOS los chats: «que siempre bajen hasta el último mensaje». La entrada general está en
// docs/hallazgos-chat.md («El chat que no baja…»); las piezas, en app/_chat (useBajarAlUltimo, useColaDeSalida).
//   · /m/chats y /m/crm/[id]/chat escrolean la PÁGINA: `useSeguirLaPagina` (app/m/_chat/SeguirLaPagina.tsx) con `bajarAlCrecer`
//     sobre document.documentElement. Son chats con clientes: como WhatsApp, a quien lee arriba no lo arrastra («N mensajes nuevos»).
//   · El Centro (Conversacion.tsx, ChatsMovil.tsx): la clave de la última línea DIBUJADA, no `lineas.length`, y los turnos que llegan
//     juntos salen de a uno con puntitos (useTurnosDeAUno.ts).
//   · La bandeja (app/chats): la caja con `seguir`, y lo que crece en el hilo lo sigue `bajarAlCrecer`.
//
// PROBADO ROMPIÉNDOLO (20/11/2026), cada rotura por separado y vuelta atrás:
//   M1 lo suyo vuelve a bajar con un setTimeout, no cuando aparece   → falla «el teléfono»
//   M2 el foco en la caja vuelve a frenar el sondeo                   → falla «el teléfono»
//   M3 lo que crece no se sigue (sin bajarAlCrecer)                   → falla «el teléfono»
//   M4 el chat del lead sin sondeo                                    → falla «el teléfono»
//   M5 lo que llega baja aunque esté leyendo arriba                   → falla «WhatsApp»
//   A1 la clave cuenta lo que el hilo no dibuja                       → falla «la clave»
//   A2 el cierre de un trabajo no cambia la clave                     → falla «la clave»
//   A3 Conversacion vuelve a bajar con lineas.length                  → falla «el Centro»
//   A4 en el teléfono, el bloque de lo que espera no entra a la clave → falla «el Centro»
//   A5 un turno nuevo no espera su turno en la cola                   → falla «de a uno»
//   A6 el hilo no muestra los puntitos de la cola                     → falla «el Centro»
//   A7 la caja de la bandeja sin `seguir`                             → falla «la bandeja»
//   A8 el hilo de la bandeja no sigue lo que crece                    → falla «la bandeja»
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuantosLlegaron, queHacerAlLlegar, rotuloNuevos } from '../app/m/_chat/seguir-la-pagina';
import { claveDelHilo, filasDeLaCola, idDeFila, lineasALaVista } from '../app/admin/operaciones/hilo-a-la-vista';
import type { LineaChat, TrabajoP } from '../lib/centro-chats';
import type { TurnoChat } from '../lib/operaciones-reglas';
import { fuenteSinComentarios } from './_fuente-sin-comentarios';

const t0 = Date.parse('2026-11-20T15:00:00Z');
const trabajo = (id: string, i: number, x: Partial<TrabajoP> = {}): LineaChat => ({
  tipo: 'trabajo', instante: t0 + i, trabajo: { id, destino: 'pc', destino_titulo: null, destino_cuenta: null, created_at: new Date(t0 + i).toISOString(), texto: 'Haz esto', ...x },
});
const turno = (uuid: string, i: number, rol: TurnoChat['rol'], x: Partial<TurnoChat> = {}): LineaChat => ({
  tipo: 'turno', instante: t0 + i, turno: { local: 'pc', uuid, rol, de: null, texto: `Texto de ${uuid}`, at: new Date(t0 + i).toISOString(), trabajo: null, ...x },
});
const pedido = (i: number): LineaChat => ({ tipo: 'pedido', instante: t0 + i, pedido: { id: 'p1' } as never, pasos: [], desde: null });

test('WhatsApp en el teléfono: lo que llega baja a quien está abajo o a lo suyo; a quien lee arriba se le cuenta', () => {
  assert.equal(queHacerAlLlegar({ abajo: true, esperaLoSuyo: false }), 'bajar');
  assert.equal(queHacerAlLlegar({ abajo: false, esperaLoSuyo: true }), 'bajar', 'lo que mandó ella baja siempre');
  assert.equal(queHacerAlLlegar({ abajo: false, esperaLoSuyo: false }), 'contar', 'leyendo arriba no la arrastra');
  assert.equal(cuantosLlegaron(10, 13), 3);
  assert.equal(cuantosLlegaron(10, 10), 1, 'cambió el último: al menos uno');
  assert.equal(rotuloNuevos(1), '1 mensaje nuevo');
  assert.equal(rotuloNuevos(3), '3 mensajes nuevos');
});

test('el teléfono: lo que llega, lo que crece y lo suyo, con la pieza compartida; el sondeo no lo frena el foco (movil-1 a 5)', () => {
  const s = fuenteSinComentarios('app/m/_chat/SeguirLaPagina.tsx');
  assert.ok(s.includes('const crece = bajarAlCrecer(raiz, () => abajo.current || esperaLoSuyo.current);'), 'lo que crece (una foto) la mantiene abajo (movil-4)');
  assert.ok(s.includes('const a = estaAbajo(raiz, CERCA_DE_ABAJO_PX);'));
  assert.ok(s.includes("if (queHacerAlLlegar({ abajo: abajo.current, esperaLoSuyo: esperaLoSuyo.current }) === 'bajar') { bajar(); return; }"));
  assert.ok(s.includes('}, [ultimo, total, bajar]);'), 'mira el ÚLTIMO mensaje, no una cuenta');
  // /m/chats
  const c = fuenteSinComentarios('app/m/chats/[clave]/ComposerChatsM.tsx');
  assert.ok(c.includes('const seguir = useSeguirLaPagina(ultimo, total);'));
  assert.doesNotMatch(c, /setTimeout\(alFinal/, 'lo suyo otra vez con un setTimeout (movil-2)');
  const salio = c.slice(c.indexOf('const salio = '), c.indexOf('const enviar = async'));
  assert.ok(salio.indexOf('seguir.esperarLoSuyo();') > 0 && salio.indexOf('seguir.esperarLoSuyo();') < salio.indexOf('router.refresh();'), 'espera lo suyo y recién pide el hilo');
  assert.ok(c.includes("if (document.visibilityState === 'visible' && !enviandoAhora.current) router.refresh();"));
  assert.ok(c.includes('const entra = () => setEnfocado(true);'), 'el foco ya no frena el sondeo (movil-3)');
  assert.doesNotMatch(c, /escribiendo\.current = true/);
  assert.ok(c.includes('<NuevosM n={seguir.nuevos} onBajar={seguir.bajar} />'));
  assert.ok(fuenteSinComentarios('app/m/chats/[clave]/page.tsx').includes('ultimo={String(h.mensajes[h.mensajes.length - 1]?.id ?? \'\')} total={h.mensajes.length}'));
  // /m/crm/[id]/chat: ahora con sondeo (movil-5).
  const l = fuenteSinComentarios('app/m/crm/[id]/chat/ComposerChat.tsx');
  assert.ok(l.includes("if (document.visibilityState === 'visible' && !enviandoAhora.current) router.refresh();") && l.includes('}, CADA_MS_HILO);'), 'lo que escribe el lead llega solo');
  assert.ok(l.includes('const seguir = useSeguirLaPagina(ultimo, total);'));
  assert.doesNotMatch(l, /setTimeout\(alFinal/);
  assert.ok(fuenteSinComentarios('app/m/crm/[id]/chat/page.tsx').includes('ultimo={String(h.mensajes[h.mensajes.length - 1]?.id ?? \'\')} total={h.mensajes.length}'));
});

test('la clave del hilo del Centro: la última línea DIBUJADA y su cierre, nunca la cuenta del historial (admin-1, 2 y 3)', () => {
  const base = [trabajo('w1', 1), turno('u1', 2, 'el')];
  const k = claveDelHilo(base);
  assert.equal(k, 't:u1');
  assert.equal(claveDelHilo([...base, pedido(3)]), k, 'un pedido de la bitácora no se dibuja: no baja (admin-1)');
  assert.equal(claveDelHilo([...base, turno('u2', 3, 'otro')]), k, 'un turno para otro chat no es para Martín');
  assert.equal(claveDelHilo([...base, turno('u3', 3, 'yo', { trabajo: 'w1' })]), k, 'el turno «yo» duplicado de un trabajo no se dibuja');
  assert.notEqual(claveDelHilo([...base, turno('u4', 3, 'el')]), k, 'lo nuevo que se dibuja, sí');
  // El cierre llega a la MISMA línea del trabajo (admin-3).
  const sinCierre = claveDelHilo([trabajo('w2', 1)]);
  assert.equal(sinCierre, 'w:w2');
  assert.equal(claveDelHilo([trabajo('w2', 1, { cierre: { texto: 'Listo' } as never })]), 'w:w2:cierre');
  // Lo que va debajo de la última línea (los puntitos, el bloque del teléfono) también cambia la clave.
  assert.notEqual(claveDelHilo(base, [true]), claveDelHilo(base, [false]));
  assert.notEqual(claveDelHilo(base, [false, 1]), claveDelHilo(base, [false, 0]));
});

test('de a uno: los turnos del chat esperan en la cola; lo de Martín y la historia salen ya (admin-5)', () => {
  const lineas = [trabajo('w1', 1), turno('u1', 2, 'el'), pedido(3), turno('u2', 4, 'el')];
  assert.deepEqual(filasDeLaCola(lineas).map((f) => [f.id, f.de]), [['w:w1', 'yo'], ['t:u1', 'mako'], ['t:u2', 'mako']]);
  assert.equal(filasDeLaCola(lineas)[1].texto, 'Texto de u1', 'el texto mide los puntitos');
  const historia = new Set(['w:w1', 't:u1']);
  const a = lineasALaVista(lineas, historia, new Set());
  assert.deepEqual(a.map(idDeFila), ['w:w1', 't:u1', 'pedido:' + (t0 + 3)], 'u2 espera su turno; el pedido (no se dibuja) sigue');
  assert.deepEqual(lineasALaVista(lineas, historia, new Set(['t:u2'])).map(idDeFila), lineas.map(idDeFila), 'cuando sale, se ve');
  assert.equal(lineasALaVista(lineas, new Set(lineas.map(idDeFila)), new Set()), lineas, 'nada esperando: las MISMAS líneas (el hilo está memorizado)');
  const h = fuenteSinComentarios('app/admin/operaciones/useTurnosDeAUno.ts');
  assert.ok(h.includes('const nuevas = useMemo(() => (h ? filasDeLaCola(lineas).filter((f) => !h.ids.has(f.id)) : []), [lineas, h]);'), 'la historia no entra a la cola');
  assert.ok(h.includes('const cola = useColaDeSalida(nuevas, { historial: SIN_HISTORIAL });'), 'la cola compartida');
  const u = fuenteSinComentarios('app/admin/operaciones/useCentro.ts');
  assert.ok(u.includes('const turnosListos = (c: ChatCentro): boolean => c.clave in turnos;'));
  assert.ok(fuenteSinComentarios('app/admin/operaciones/PiezasCentro.tsx').includes('turnosListos={k.turnosListos(chat)}'));
});

test('el Centro: el panel sigue la clave, el hilo dibuja lo que salió de la cola con sus puntitos (admin-1 a 5)', () => {
  const c = fuenteSinComentarios('app/admin/operaciones/Conversacion.tsx');
  assert.doesNotMatch(c, /lineas\.length\]\)/, 'otra vez el scroll con la cuenta del historial (admin-1)');
  assert.ok(c.includes('const vista = useTurnosDeAUno(chat.clave, lineas, turnosListos);'));
  assert.ok(c.includes('const seguir = { clave: claveDelHilo(vista.lineas, [vista.escribiendo || (vivo ? chatTrabajando(vivo.chat, lineas, ahora) : false)]) };'));
  assert.ok(c.includes('<PanelDeChat hilo={hilo} adjuntos={adjuntos} seguir={seguir}'), 'el seguimiento del panel compartido (admin-2, 3 y 4)');
  assert.ok(c.includes('<Hilo lineas={vista.lineas}') && c.includes('escribiendo={vista.escribiendo}'));
  const hilo = fuenteSinComentarios('app/admin/operaciones/Hilo.tsx');
  assert.ok(hilo.includes('{(trabaja || escribiendo) && <Trabajando'), 'los puntitos de un turno que espera');
  // El teléfono: la hoja, con la pieza compartida; el bloque de lo que espera a Martín va al pie del hilo (admin-2).
  const m = fuenteSinComentarios('app/m/operaciones/ChatsMovil.tsx');
  assert.doesNotMatch(m, /\[abierto, lineas\.length\]/);
  assert.ok(m.includes('useBajarAlUltimo(hojaDelHilo, claveDelHilo(vista.lineas, [vista.escribiendo, bloque.length + deLaApp.length + preguntas.length]));'));
  assert.ok(m.includes('<Hilo lineas={vista.lineas}') && m.includes('escribiendo={vista.escribiendo}'));
  assert.ok(m.indexOf('const [panelWA, setPanelWA]') < m.indexOf('const hojaAbierta = !!elegido && !eligiendo && !panelWA;'), 'panelWA existe antes de usarse');
});

test('la bandeja: la caja acompaña a la conversación y lo que crece arriba de la caja no tapa el último mensaje (admin-6)', () => {
  const v = fuenteSinComentarios('app/chats/VentanaChat.tsx');
  assert.ok(v.includes("const seguirHilo = useCallback(() => hiloCaja.current?.querySelector<HTMLElement>('.rio-hilo') ?? null, []);"));
  assert.ok(v.includes('seguir={seguirHilo}'));
  const c = fuenteSinComentarios('app/chats/Composer.tsx');
  assert.ok(c.includes('seguir={seguir}\n          altoMax={160}'), 'la caja única con `seguir`');
  const h = fuenteSinComentarios('app/chats/Hilo.tsx');
  assert.ok(h.includes('crece.current = bajarAlCrecer(el, () => pegado.current);'), 'lo que crece, mientras estaba abajo (como WhatsApp)');
  assert.ok(h.includes('useEffect(() => { crece.current?.mirarHijos(); }, [mensajes]);'));
});
