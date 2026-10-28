// =============================================================================
// PROBAR agendar y reprogramar desde el grupo contra una agenda de Google DE VERDAD, en el Cliente de Prueba (ws3) (27/10/2026, MK-06)
// =============================================================================
// Joan (grupo de Pablo, ws18): «quiso agendar un evento y no lo dejó». Los arreglos de agendar están en producción desde el
// 17/10 (618c79c45, 4569887d9, 8d90f8357), pero nunca se probaron contra una agenda real (docs/pendientes.md). Esto corre el
// MISMO camino que un turno del grupo: `runnerDelRegistro` con el contexto de WhatsApp, la propuesta, y el «sí» como un
// mensaje aparte (`confirmar_accion`, con el candado anti auto-confirm). Lee lo que la persona ve con `agenda_del_dia`.
//
//   node --env-file=<clon>/.env.local --conditions=react-server --import tsx scripts/probar-agendar-ws3.mts          (en seco: el plan, sin tocar nada)
//   … scripts/probar-agendar-ws3.mts --si     crea «[PRUEBA MaKo]…» mañana a las 10:00 en el Google de ws3, lo mueve a las
//                                            11:30, comprueba cada paso en la agenda y al final lo BORRA (sin avisar a nadie)
//
// ⚠️ ESCRIBE en producción (las pendientes de ws3 y su Google Calendar): sólo con el sí de Martín. SÓLO ws3, nunca un cliente.
// Sale con 0 si todo anduvo, 1 si un paso falló, 3 si ws3 no tiene Google conectado (eso se dice, no se inventa).
// =============================================================================

export {};

const WS = 3;
const GRUPO = 'mk06-prueba-agendar@g.us';
const TITULO = '[PRUEBA MaKo] agendar desde WhatsApp · se borra sola';
const si = process.argv.includes('--si');

if (!si) {
  console.log([
    `En seco. Con --si, en el ws${WS} (Cliente de Prueba) y por el camino del grupo:`,
    '  1. agenda_del_dia de mañana (si falta Google, sale con 3)',
    `  2. crear_evento_google «${TITULO}» mañana 10:00 (30 min) → «sí» aparte → confirmar_accion`,
    '  3. agenda_del_dia: tiene que estar a las 10:00',
    '  4. proponer_mover_reunion de 10:00 a 11:30 → «sí» aparte → confirmar_accion',
    '  5. agenda_del_dia: tiene que estar a las 11:30 (y no a las 10:00)',
    '  6. borra el evento de Google, sin avisar a nadie',
  ].join('\n'));
  process.exit(0);
}

const { runWithWorkspace } = await import('../lib/workspace');
const { runnerDelRegistro } = await import('../lib/api-mako/ejecutar');
const { hoyEnWorkspace } = await import('../lib/timezone');
const { borrarEventoGoogle } = await import('../lib/calendario-google');

const linea = (t: string, x?: unknown) => console.log(`· ${t}${x === undefined ? '' : ` ${typeof x === 'string' ? x : JSON.stringify(x)}`}`);
let fallo = false;
const fallar = (t: string) => { console.error(`✗ ${t}`); fallo = true; };
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const texto = (r: unknown): string => (typeof r === 'string' ? r : (r as { content?: string })?.content ?? JSON.stringify(r));

/** Un turno del grupo: su runner, con lo que la persona VE (`aPersona`) aparte de lo que recibe el modelo. */
function turno(mensaje: string) {
  const vio: string[] = [];
  const run = runnerDelRegistro({
    ws: WS, canal: 'whatsapp', canalKey: GRUPO, alcance: 'ejecutar', rol: 'admin', turnStart: Date.now(), mensajeUsuario: mensaje,
    aPersona: (t: string) => { vio.push(t); },
  } as Parameters<typeof runnerDelRegistro>[0]);
  return { run, vio };
}

/** Proponer en un turno y confirmar con un «sí» en otro, como en el grupo. Devuelve lo que contestó la confirmación. */
async function proponerYConfirmar(nombre: string, input: Record<string, unknown>, pedido: string): Promise<string | null> {
  const p = texto(await turno(pedido).run(nombre, input));
  const id = Number(/"pendiente_id":\s*(\d+)/.exec(p)?.[1] ?? /#(\d+)/.exec(p)?.[1]);
  linea(`${nombre} propuso`, p.slice(0, 300));
  if (!Number.isInteger(id) || id <= 0) { fallar(`${nombre}: no dejó una pendiente`); return null; }
  await espera(2500); // el «sí» es OTRO mensaje: el candado anti auto-confirm mira 1,5 s
  const c = texto(await turno('sí').run('confirmar_accion', { id }));
  linea(`confirmar_accion #${id}`, c.slice(0, 400));
  if (/"ok":\s*false|"error"/.test(c)) fallar(`${nombre}: la confirmación no anduvo`);
  return c;
}

async function agenda(fecha: string): Promise<string> {
  const t = turno('¿qué tengo mañana?');
  const r = texto(await t.run('agenda_del_dia', { fecha }));
  return `${t.vio.join('\n')}\n${r}`;
}

await runWithWorkspace(WS, async () => {
  const hoy = await hoyEnWorkspace();
  const manana = new Date(Date.parse(`${hoy}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  linea(`ws${WS}, mañana es`, manana);

  const antes = await agenda(manana);
  // ⚠️ SIN GOOGLE, agenda_del_dia NO DICE «falta» (28/10/2026, la primera corrida con --si): contesta ok con el estado
  // `eventos_sin_verificar` (lib/agenda-sin-ia.ts, `salidaDelDia`), y a la persona «No hay una agenda de Google conectada a este
  // espacio» (lib/google-calendar.ts). Ese chequeo no lo veía, y la prueba siguió hasta dejar una pendiente (#498) que no podía
  // crear nada. Ahora: sin Google, 3; la agenda ilegible por otra cosa, 1. En los dos casos, antes de proponer nada.
  if (/"falta"|no est[aá] conectad|No hay una agenda de Google conectada/i.test(antes)) {
    console.error(`ws${WS} no tiene Google conectado: hay que conectarle una cuenta de prueba antes de probar.\n${antes.slice(0, 400)}`);
    process.exit(3);
  }
  if (/"estado":\s*"eventos_sin_verificar"/.test(antes)) {
    console.error(`✗ la agenda de ws${WS} no se pudo leer: sin eso no se puede comprobar nada, así que no se propone nada.\n${antes.slice(0, 400)}`);
    process.exit(1);
  }
  linea('agenda antes', antes.slice(0, 400));

  const creado = await proponerYConfirmar('crear_evento_google', { titulo: TITULO, fecha: manana, hora: '10:00', duracionMin: 30 }, `agendame «${TITULO}» mañana a las 10`);
  const eventoId = /"eventoId":\s*"([^"]+)"/.exec(creado ?? '')?.[1] ?? null;
  linea('eventoId', eventoId ?? '(no vino)');

  const con10 = await agenda(manana);
  if (!con10.includes('PRUEBA MaKo') || !/10:00/.test(con10)) fallar('la agenda no muestra el evento a las 10:00');

  await proponerYConfirmar('proponer_mover_reunion', { fecha_actual: manana, hora_actual: '10:00', fecha: manana, hora: '11:30' }, 'reprogramame la de mañana a las 10 para las 11:30');
  const con1130 = await agenda(manana);
  const lineaDelEvento = con1130.split('\n').find((l) => l.includes('PRUEBA MaKo')) ?? '';
  if (!/11:30/.test(lineaDelEvento)) fallar(`la agenda no muestra el evento a las 11:30: «${lineaDelEvento}»`);

  if (eventoId) {
    const b = await borrarEventoGoogle('primary', eventoId, false);
    linea('borrado', b);
    if (!b.ok) fallar('no se pudo borrar el evento de prueba: borrarlo a mano en el Google de ws3');
  } else fallar('sin eventoId no se puede borrar: borrar «[PRUEBA MaKo]…» a mano en el Google de ws3');
});

console.log(fallo ? '✗ falló un paso (arriba)' : '✓ agendar y reprogramar andan contra la agenda real de ws3');
process.exit(fallo ? 1 : 0);
