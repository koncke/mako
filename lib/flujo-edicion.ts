// =============================================================================
// flujo-edicion — LA PUERTA de toda edición de flechas del lienzo de /chatbot (sexta tanda)
// =============================================================================
// Módulo SIN `server-only` y PURO, con test (tests/flujo-edicion.test.ts). Entra el flujo de una
// automatización (`pasos`, lib/flujo-grafo.ts) y sale el flujo editado, o un motivo corto de por qué
// no. No guarda nada: quien llama (app/chatbot/FlujoLienzo.tsx) lo sube por `onPasos`, que es lo que
// lo vuelve deshacible y lo deja para Publicar.
//
// ⚠️ UNA SOLA PUERTA (segunda pasada de la sexta tanda, 09/10/2026). Hasta acá había DOS
// implementaciones de lo mismo: ésta (enchufada a la pantalla) y otra en lib/flujo-grafo.ts
// (`conectar`, `desconectar`, `crearSuelta`, `destinosConectables`, sin un solo call site). Cada una
// tenía una mitad buena: la del modelo FIJABA LA RAÍZ antes de editar y separaba guardar de publicar;
// ésta tenía los gestos que la pantalla usa y sus motivos cortos. Con dos, la primera que se tocara
// dejaba de decir lo mismo que la otra. Quedó ésta, construida sobre las piezas del modelo:
//   · `fijarRaiz` ANTES de toda edición (el CRON como dato: ver abajo);
//   · la red es `validarParaGuardar` (lo que rompe el DATO). Hasta acá era `validarGrafo` con un
//     filtro de TEXTOS (/tarjetas sueltas/, / cuelga de N lugares/) que se rompía en cuanto el modelo
//     cambiaba una palabra —y la segunda regla ya no existía—;
//   · «dos caminos en paralelo no se juntan» y «un círculo necesita una espera» son las reglas de
//     PUBLICAR del modelo (`cruces`, `ciclosSinEspera`), preguntadas antes y después: la regla vive
//     UNA vez, y vale igual para Crear con IA, la API de MaKo y un flujo viejo (todos publican por
//     `setSecuenciaPasos` → `validarGrafo`). Hasta acá había una copia propia (`tarjetasDondeSeJuntan`).
//
// Los pedidos de Martín (09/10/2026, sexta tanda), textuales:
//   · 5  «si apreto y mantengo el click en el "+" debería poder arrastrar esa flecha a otra tarjeta» → `conectar`.
//   · 6  «Al lado del "+" en cada tarjeta, pon el icono de basura, así se puede eliminar esa flecha» → `desconectar`.
//   · 7  «Que se elimine una flecha no significa que se elimine la tarjeta posterior, sino que queda
//        "flotando"... también puedo crear pasos sueltos en cualquier momento y lugar del tablero» →
//        `crearSuelta`, y `eliminar` deja SUELTO lo que colgaba de la tarjeta (nunca lo borra).
//   · 2  «si hago click derecho en una tarjeta, opciones, como eliminar, duplicar...» → `duplicar` (la
//        copia sale suelta), `eliminar` y `soltar` («Desconectar»: le quita las flechas que le llegan).
//   · 13 «Aún no funciona poner o sacar más de una flecha a una tarjeta» → una tarjeta puede tener
//        VARIOS PADRES (`validarGrafo` ya no lo rechaza).
//
// ── LA FLECHA ES EL DATO ─────────────────────────────────────────────────────────
// Nada de esto dibuja: escribe `siguiente`, las ramas, `si_no`, los casos y los `paralelos`, y el
// lienzo los vuelve a dibujar (lib/flujo-conversacion.ts). Conectar desde una salida que YA tiene su
// flecha agrega una flecha EN PARALELO (lo que en el motor es un hilo que corre a la vez), con las
// mismas reglas que el ＋ en paralelo: sólo donde se admiten y debajo de los topes.
//
// ── EL CRON COMO DATO ────────────────────────────────────────────────────────────
// Un flujo sin nodo de inicio arranca en la PRIMERA tarjeta que nadie apunta (`raizSalida`). Con
// sueltas eso deja de alcanzar: conectar una suelta a la primera la dejaba como entrada (el CRON le
// escribía al lead lo que la persona dejó a un costado), y borrar la primera hacía que la de después
// pasara SOLA a colgar del CRON. Por eso toda edición de acá arranca con `fijarRaiz` (el inicio al
// FINAL del array, apuntando a la raíz de hoy: no corre el `paso_actual` de nadie).

import {
  type PasoGrafo,
  ID_INICIO, TOPE_PARALELOS, TOPE_HILOS,
  claseDe, idDe, normalizar, puertosDe, raizRespuesta, descendientes, puedeTenerParalelos,
  indicePorId, nuevoId, conectarPuerto, leerPuertoParalelo, puertoParalelo, paralelosDeResultado,
  contarParalelos, fijarRaiz, validarParaGuardar, cruces, ciclosSinEspera,
} from './flujo-grafo';
import { nodoNuevo, type QueAgregar } from './flujo-conversacion';

/** Lo que devuelve una edición: el flujo nuevo, o el MISMO flujo con un motivo corto (va a un aviso). */
export type Edicion<P> =
  | { ok: true; pasos: P[]; id?: string }
  | { ok: false; pasos: P[]; motivo: string };

/** Los motivos, cortos: se dibujan pegados a «Publicar» (AGENTS.md, el texto que se dibuja). */
export const MOTIVO = {
  consigo: 'Una tarjeta no se conecta consigo misma',
  alCron: 'Al CRON no le llegan flechas',
  aRespuesta: 'A «Si responde» no le llegan flechas',
  noExiste: 'Esa tarjeta ya no está',
  sinSalida: 'Esa tarjeta no tiene esa salida',
  yaEstan: 'Ya están conectadas',
  ocupada: 'Esa salida ya tiene su flecha',
  topeParalelos: `Esa salida ya saca ${TOPE_PARALELOS} flechas`,
  topeHilos: `Ya hay ${TOPE_HILOS} caminos a la vez`,
  circulo: 'Un círculo necesita una espera',
  juntaCaminos: 'Dos caminos en paralelo no se juntan',
  conRespuesta: '«Si responde» no se junta con la salida',
  noConectadas: 'No están conectadas',
  cronNo: 'El CRON no se elimina',
  noSeDuplica: 'Esta tarjeta no se duplica',
  sinFlechas: 'No le llega ninguna flecha',
} as const;

const listo = <P>(pasos: P[], id?: string): Edicion<P> => ({ ok: true, pasos, ...(id ? { id } : {}) });
const no = <P>(pasos: P[], motivo: string): Edicion<P> => ({ ok: false, pasos, motivo });

/** El flujo listo para editar: normalizado y con el CRON en el dato (ver la cabecera). */
function paraEditar<P extends PasoGrafo>(pasosIn: readonly P[]): { base: P[]; fijo: P[] } {
  const base = normalizar(pasosIn);
  return { base, fijo: normalizar(fijarRaiz(base)) };
}

/** La FILA de un puerto: `par:<id>` es de la salida de siempre ('sig'), `par:<id>@<r>` de su resultado. */
function filaDe(puerto: string): string {
  const pp = leerPuertoParalelo(puerto);
  return pp ? (pp.resultado ?? 'sig') : puerto;
}

/**
 * SACA LA FLECHA DE UN PUERTO. La de una flecha en paralelo se va sola; la PRINCIPAL de una fila deja
 * su lugar a la primera en paralelo de esa misma fila (lo que ya hacen `normalizar` con el inicio y
 * `borrarNodo` con un resultado): sin eso quedaba la fila diciendo «Siguiente paso» con una flecha
 * punteada saliendo de ella.
 */
function quitarPuerto<P extends PasoGrafo>(pasos: P[], id: string, puerto: string): P[] {
  if (leerPuertoParalelo(puerto)) return conectarPuerto(pasos, id, puerto, null);
  let out = conectarPuerto(pasos, id, puerto, null);
  const i = indicePorId(out, id);
  if (i < 0) return out;
  const p = out[i];
  const res = claseDe(p) === 'condicion' ? puerto : null;
  const par = res
    ? paralelosDeResultado(p, res)
    : (puerto === 'sig' && puedeTenerParalelos(p) && Array.isArray(p.paralelos) ? p.paralelos.filter((d) => typeof d === 'string' && d) : []);
  if (par.length) {
    out = conectarPuerto(out, id, puertoParalelo(par[0], res), null);
    out = conectarPuerto(out, id, puerto, par[0]);
  }
  return out;
}

/** Le quita a `id` TODAS las flechas que le llegan (de cualquier padre, también del CRON). */
function soltarDe<P extends PasoGrafo>(pasos: P[], id: string): P[] {
  let out = pasos;
  // Una por vuelta: sacar una puede promover otra flecha de la misma fila, y hay que volver a mirar.
  for (let guarda = 0; guarda < 400; guarda++) {
    let hallado: { de: string; puerto: string } | null = null;
    for (let i = 0; i < out.length && !hallado; i++) {
      const pt = puertosDe(out, i).find((x) => x.destino === id);
      if (pt) hallado = { de: idDe(out[i], i), puerto: pt.puerto };
    }
    if (!hallado) break;
    out = quitarPuerto(out, hallado.de, hallado.puerto);
  }
  return out;
}

/**
 * CONECTAR: una flecha de la salida `puerto` de `desde` a `hacia` (sexta tanda, punto 5: el ＋
 * arrastrado hasta otra tarjeta). `desde` puede ser el CRON (`ID_INICIO`) y `puerto` la FILA de la
 * tarjeta ('sig', el id de una rama o de un caso, 'si_no'; también un `par`/`par@<fila>` del lienzo).
 *
 *   · Si esa salida está vacía, la flecha pasa a ser su salida.
 *   · Si ya tiene su flecha, la nueva va EN PARALELO —donde se admiten, debajo de los topes—; donde no
 *     (un caso de «Si responde», adentro de «Si responde»), no se conecta.
 *   · Nunca a sí misma, al CRON ni a «Si responde» (es un evento: no tiene padre).
 *   · Nunca armando un círculo SIN una espera en el medio (`ciclosSinEspera`, la regla de Publicar): con
 *     una espera, «volver al principio» es un flujo que se publica (y el que deja `quitarIrA`).
 *   · Nunca juntando dos caminos que corren a la vez (`cruces`, la regla de Publicar): al lead le
 *     llegaría lo mismo dos veces. Las ramas de una condición SÍ se juntan: corre una sola.
 *   · Y la red: el flujo conectado no puede romper el DATO (`validarParaGuardar`). Lo INCOMPLETO
 *     —una tarjeta que queda suelta, una espera adentro de «Si responde»— sí se conecta: es un
 *     borrador, y Publicar lo dice. El motivo de la red trae ids (quien lo muestra lo pasa por
 *     `errorLegible`).
 */
export function conectar<P extends PasoGrafo>(pasosIn: readonly P[], desde: string, puerto: string, hacia: string): Edicion<P> {
  const { base, fijo } = paraEditar(pasosIn);
  if (hacia === desde) return no(base, MOTIVO.consigo);
  if (hacia === ID_INICIO) return no(base, MOTIVO.alCron);
  const j = indicePorId(fijo, hacia);
  if (j < 0) return no(base, MOTIVO.noExiste);
  if (claseDe(fijo[j]) === 'inicio') return no(base, MOTIVO.alCron);
  if (claseDe(fijo[j]) === 'respuesta') return no(base, MOTIVO.aRespuesta);
  const i = indicePorId(fijo, desde);
  if (i < 0) return no(base, MOTIVO.noExiste);
  const p = fijo[i];
  const c = claseDe(p);
  const fila = filaDe(puerto);
  const pts = puertosDe(fijo, i);
  const principal = pts.find((pt) => !leerPuertoParalelo(pt.puerto) && pt.puerto === fila);
  if (!principal) return no(base, MOTIVO.sinSalida);
  if (pts.some((pt) => pt.destino === hacia && filaDe(pt.puerto) === fila)) return no(base, MOTIVO.yaEstan);
  let out: P[];
  if (!principal.destino) {
    out = conectarPuerto(fijo, desde, fila, hacia);
  } else {
    const res = c === 'condicion' ? fila : null;
    const resp = raizRespuesta(fijo);
    const enResp = resp != null && (desde === resp || descendientes(fijo, resp).has(desde));
    if (c === 'respuesta' || enResp || !(c === 'condicion' || puedeTenerParalelos(p))) return no(base, MOTIVO.ocupada);
    const yaSalen = res ? paralelosDeResultado(p, res).length : (Array.isArray(p.paralelos) ? p.paralelos.length : 0);
    if (yaSalen >= TOPE_PARALELOS) return no(base, MOTIVO.topeParalelos);
    if (1 + contarParalelos(fijo) >= TOPE_HILOS) return no(base, MOTIVO.topeHilos);
    out = conectarPuerto(fijo, desde, puertoParalelo(null, res), hacia);
  }
  out = normalizar(out);
  if (!puertosDe(out, indicePorId(out, desde)).some((pt) => pt.destino === hacia)) return no(base, MOTIVO.sinSalida);
  // Las reglas de Publicar que una flecha nueva puede ROMPER, preguntadas antes y después: lo que ya
  // estaba mal por otro lado no frena esta flecha.
  const ciclosAntes = ciclosSinEspera(fijo);
  if ([...ciclosSinEspera(out)].some((x) => !ciclosAntes.has(x))) return no(base, MOTIVO.circulo);
  const crucesAntes = new Set(cruces(fijo).map((x) => x.id));
  const cruce = cruces(out).find((x) => !crucesAntes.has(x.id));
  if (cruce) return no(base, cruce.conRespuesta ? MOTIVO.conRespuesta : MOTIVO.juntaCaminos);
  const rotoAntes = new Set(validarParaGuardar(fijo));
  const roto = validarParaGuardar(out).find((e) => !rotoAntes.has(e));
  if (roto) return no(base, roto);
  return listo(out);
}

/**
 * DESCONECTAR: saca la flecha de la salida `puerto` de `desde` que llega a `hacia` (sexta tanda,
 * punto 6: la papelera al lado del círculo). `hacia` queda SUELTA si no le llega otra flecha; nunca
 * se borra (punto 7). `puerto` puede ser el de la arista (`par:<id>`) o la fila del círculo ('sig',
 * una rama): se busca la flecha de esa fila que va a `hacia`. Desde el CRON (`ID_INICIO`) también.
 */
export function desconectar<P extends PasoGrafo>(pasosIn: readonly P[], desde: string, puerto: string, hacia: string): Edicion<P> {
  const { base, fijo } = paraEditar(pasosIn);
  const i = indicePorId(fijo, desde);
  if (i < 0) return no(base, MOTIVO.noConectadas);
  const pt = puertosDe(fijo, i).find((x) => x.destino === hacia && (x.puerto === puerto || filaDe(x.puerto) === filaDe(puerto)));
  if (!pt) return no(base, MOTIVO.noConectadas);
  return listo(quitarPuerto(fijo, desde, pt.puerto));
}

/**
 * «DESCONECTAR» UNA TARJETA (el click derecho): le quita todas las flechas que le LLEGAN y queda
 * suelta, con lo suyo colgando de ella. Los «Ir a» que saltan a ella no son flechas: se quedan.
 */
export function soltar<P extends PasoGrafo>(pasosIn: readonly P[], id: string): Edicion<P> {
  const { base, fijo } = paraEditar(pasosIn);
  const i = indicePorId(fijo, id);
  if (id === ID_INICIO || i < 0 || claseDe(fijo[i]) === 'inicio') return no(base, i < 0 ? MOTIVO.noExiste : MOTIVO.sinFlechas);
  const out = soltarDe(fijo, id);
  if (out === fijo || JSON.stringify(out) === JSON.stringify(fijo)) return no(base, MOTIVO.sinFlechas);
  return listo(out);
}

/**
 * ELIMINAR UNA TARJETA (el click derecho y la papelera del panel; sexta tanda, punto 7): se va ELLA, y
 * lo que colgaba de ella queda SUELTO —nunca se borra—: «Que se elimine una flecha no significa que se
 * elimine la tarjeta posterior». Una condición o «Si responde» tampoco se llevan sus ramas (era lo de
 * `borrarNodo`, que sigue para la espera que va en una flecha: ahí sí se reconecta).
 *
 * Los «Ir a» que saltaban a ella se quedan sin destino: siguen dibujados con su marca y Publicar los
 * frena hasta que se elija otro. Borrarlos sería borrar otra tarjeta sin que nadie lo pidiera.
 */
export function eliminar<P extends PasoGrafo>(pasosIn: readonly P[], id: string): Edicion<P> {
  const { base, fijo } = paraEditar(pasosIn);
  if (id === ID_INICIO) return no(base, MOTIVO.cronNo);
  const i = indicePorId(fijo, id);
  if (i < 0) return no(base, MOTIVO.noExiste);
  if (claseDe(fijo[i]) === 'inicio') return no(base, MOTIVO.cronNo);
  const out = soltarDe(fijo, id).filter((q, k) => idDe(q, k) !== id);
  return listo(out.map((q) => (claseDe(q) === 'ir_a' && q.destino && 'nodo' in q.destino && q.destino.nodo === id ? { ...q, destino: null } : q)));
}

/**
 * UNA TARJETA SUELTA NUEVA (el click derecho en el lienzo: «crear una tarjeta» en ese punto). Nace
 * sin flechas —ni le llega ni sale nada— y al final del array. Devuelve su id para que quien la crea
 * la ponga donde se hizo el click (`fijarPosicion`, lib/lienzo-posiciones.ts) y abra su editor.
 */
export function crearSuelta<P extends PasoGrafo>(pasosIn: readonly P[], que: QueAgregar, rnd: () => number = Math.random): { pasos: P[]; id: string } {
  const { fijo } = paraEditar(pasosIn);
  const n = { ...nodoNuevo(que, fijo, rnd), siguiente: null } as unknown as P;
  const id = n.id!;
  return { pasos: normalizar([...fijo, n]), id };
}

/**
 * DUPLICAR UNA TARJETA (el click derecho): una copia con id nuevo, justo después de la original en el
 * array y SUELTA —sin flechas que le lleguen ni que salgan—, para conectarla donde haga falta. Lo de
 * adentro va entero (el texto, las partes, el audio, la acción, las filas de una condición, con ids de
 * rama nuevos). «Si responde» no se duplica (hay una sola) y el CRON tampoco.
 */
export function duplicar<P extends PasoGrafo>(pasosIn: readonly P[], id: string, rnd: () => number = Math.random): Edicion<P> {
  const { base, fijo } = paraEditar(pasosIn);
  const i = indicePorId(fijo, id);
  if (i < 0) return no(base, MOTIVO.noExiste);
  const c = claseDe(fijo[i]);
  if (c === 'inicio' || c === 'respuesta') return no(base, MOTIVO.noSeDuplica);
  const copia = JSON.parse(JSON.stringify(fijo[i])) as P;
  const nid = nuevoId(fijo, rnd);
  copia.id = nid;
  delete copia.paralelos;
  delete copia.paralelos_si_no;
  if (c === 'condicion') {
    const usados: PasoGrafo[] = [...fijo, { id: nid }];
    copia.ramas = (copia.ramas ?? []).map((r) => {
      const rid = nuevoId(usados, rnd);
      usados.push({ id: rid });
      const rama = { ...r, id: rid, siguiente: null };
      delete rama.paralelos;
      return rama;
    });
    copia.si_no = null;
  } else if (c !== 'ir_a') {
    copia.siguiente = null;
  }
  return listo([...fijo.slice(0, i + 1), copia, ...fijo.slice(i + 1)], nid);
}
