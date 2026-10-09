// =============================================================================
// flujo-edicion — lo que el lienzo de /chatbot le HACE al grafo con el mouse (sexta tanda)
// =============================================================================
// Módulo SIN `server-only` y PURO, con test (tests/flujo-edicion.test.ts). Entra el flujo de una
// automatización (`pasos`, lib/flujo-grafo.ts) y sale el flujo editado, o un motivo corto de por qué
// no. No guarda nada: quien llama (app/chatbot/FlujoLienzo.tsx) lo sube por `onPasos`, que es lo que
// lo vuelve deshacible y lo deja para Publicar.
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
//        VARIOS PADRES (la regla que lo prohibía en `validarGrafo` la saca la parte del modelo).
//
// ── LA FLECHA ES EL DATO ─────────────────────────────────────────────────────────
// Nada de esto dibuja: escribe `siguiente`, las ramas, `si_no`, los casos y los `paralelos`, y el
// lienzo los vuelve a dibujar (lib/flujo-conversacion.ts). Conectar desde una salida que YA tiene su
// flecha agrega una flecha EN PARALELO (lo que en el motor es un hilo que corre a la vez), con las
// mismas reglas que el ＋ en paralelo: sólo donde se admiten y debajo de los topes.
//
// ── EL CRON IMPLÍCITO ────────────────────────────────────────────────────────────
// Un flujo sin nodo de inicio arranca en la PRIMERA tarjeta que nadie apunta (`raizSalida`). Eso es
// cómodo mientras nada se desconecta y es una trampa en cuanto algo se suelta: borrar la primera
// tarjeta hacía que la de después pasara SOLA a colgar del CRON, que es justo lo contrario de «queda
// flotando». Por eso toda edición que puede cambiar quién es la primera deja la flecha del CRON
// EXPLÍCITA (`conRaiz`: el nodo de inicio, `'entrada'`, con la raíz de antes) — sólo cuando hace
// falta, para que un flujo que nadie desconectó quede igual byte a byte.

import {
  type PasoGrafo,
  ID_INICIO, TOPE_PARALELOS, TOPE_HILOS,
  claseDe, idDe, normalizar, puertosDe, raizSalida, raizRespuesta, descendientes, puedeTenerParalelos,
  indicePorId, nuevoId, conectarPuerto, validarGrafo, leerPuertoParalelo, puertoParalelo, paralelosDeResultado,
  contarParalelos,
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
  circulo: 'Así se arma un círculo',
  juntaCaminos: 'Dos caminos en paralelo no se juntan',
  noConectadas: 'No están conectadas',
  cronNo: 'El CRON no se elimina',
  noSeDuplica: 'Esta tarjeta no se duplica',
  sinFlechas: 'No le llega ninguna flecha',
} as const;

const listo = <P>(pasos: P[], id?: string): Edicion<P> => ({ ok: true, pasos, ...(id ? { id } : {}) });
const no = <P>(pasos: P[], motivo: string): Edicion<P> => ({ ok: false, pasos, motivo });

const indiceInicio = (pasos: readonly PasoGrafo[]): number => pasos.findIndex((p) => claseDe(p) === 'inicio');

/** La FILA de un puerto: `par:<id>` es de la salida de siempre ('sig'), `par:<id>@<r>` de su resultado. */
function filaDe(puerto: string): string {
  const pp = leerPuertoParalelo(puerto);
  return pp ? (pp.resultado ?? 'sig') : puerto;
}

/**
 * LA FLECHA DEL CRON, EXPLÍCITA SI HACE FALTA (ver la cabecera): si el flujo no tiene nodo de inicio
 * y su primera tarjeta ya no es `raiz`, se agrega el inicio apuntando a `raiz` (o a nada). Con
 * inicio, o si la raíz no cambió, el MISMO array.
 */
function conRaiz<P extends PasoGrafo>(pasos: P[], raiz: string | null): P[] {
  if (indiceInicio(pasos) >= 0 || raizSalida(pasos) === raiz) return pasos;
  return [...pasos, { id: ID_INICIO, nodo: 'inicio', siguiente: raiz } as unknown as P];
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

/** Le quita a `id` TODAS las flechas que le llegan (de cualquier padre, también del inicio). */
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
 * LAS TARJETAS A LAS QUE LLEGAN DOS CAMINOS EN PARALELO. Cada camino (hilo) arranca en la salida
 * principal o en el destino de una flecha en paralelo y sigue por las flechas de siempre. Una tarjeta
 * que alcanzan DOS caminos le llega dos veces al lead: el motor corre cada hilo por su cuenta
 * (`aplicarAHilo`), así que el mensaje sale dos veces. Lo de «Si responde» no cuenta: la respuesta
 * pausa todo y retoma UN hilo (es lo que hace un «Ir a» desde ahí).
 */
export function tarjetasDondeSeJuntan(pasos: readonly PasoGrafo[]): Set<string> {
  const llegan = new Map<string, Set<string>>();
  const arranques: Array<[string, string]> = [];
  const principal = raizSalida(pasos);
  if (principal) arranques.push([principal, 'p']);
  pasos.forEach((_, i) => {
    for (const pt of puertosDe(pasos, i)) if (pt.destino && leerPuertoParalelo(pt.puerto)) arranques.push([pt.destino, `h:${pt.destino}`]);
  });
  const resp = raizRespuesta(pasos);
  const enResp = new Set(resp ? [resp, ...descendientes(pasos, resp)] : []);
  for (const [desde, h] of arranques) {
    const pila = [desde];
    const vistos = new Set<string>();
    while (pila.length) {
      const cur = pila.pop()!;
      if (vistos.has(cur)) continue;
      vistos.add(cur);
      if (!llegan.has(cur)) llegan.set(cur, new Set());
      llegan.get(cur)!.add(h);
      const i = indicePorId(pasos, cur);
      if (i < 0) continue;
      // Las flechas en paralelo arrancan OTRO camino (ya está en `arranques`): no se siguen acá.
      for (const pt of puertosDe(pasos, i)) if (pt.destino && !leerPuertoParalelo(pt.puerto)) pila.push(pt.destino);
    }
  }
  return new Set([...llegan].filter(([id, hs]) => hs.size > 1 && !enResp.has(id)).map(([id]) => id));
}

/** Los errores de forma que conectar NO puede producir… salvo éstos, que son lo que se viene a hacer. */
const errorPropio = (e: string): boolean =>
  // Soltar o enganchar tarjetas cambia la lista de sueltas (es lo esperado), y DOS PADRES es justo lo
  // que se pide en el punto 13 (la regla la saca la parte del modelo de `validarGrafo`).
  e.startsWith('tarjetas sueltas') || / cuelga de \d+ lugares/.test(e);

/**
 * CONECTAR: una flecha de la salida `puerto` de `desde` a `hacia` (sexta tanda, punto 5: el ＋
 * arrastrado hasta otra tarjeta). `desde` puede ser el CRON (`ID_INICIO`) y `puerto` la FILA de la
 * tarjeta ('sig', el id de una rama o de un caso, 'si_no'; también un `par`/`par@<fila>` del lienzo).
 *
 *   · Si esa salida está vacía, la flecha pasa a ser su salida.
 *   · Si ya tiene su flecha, la nueva va EN PARALELO —donde se admiten, debajo de los topes—; donde no
 *     (un caso de «Si responde», adentro de «Si responde»), no se conecta.
 *   · Nunca a sí misma, al CRON, a «Si responde», ni armando un círculo de flechas.
 *   · Nunca juntando dos caminos en paralelo (`tarjetasDondeSeJuntan`): le llegaría lo mismo dos veces.
 *   · Y una red: el flujo conectado no puede tener un error de forma que el de antes no tenía
 *     (`validarGrafo`); el motivo es ese error, con ids (quien lo muestra lo pasa por `errorLegible`).
 */
export function conectar<P extends PasoGrafo>(pasosIn: readonly P[], desde: string, puerto: string, hacia: string): Edicion<P> {
  const base = normalizar(pasosIn);
  if (hacia === desde) return no(base, MOTIVO.consigo);
  if (hacia === ID_INICIO) return no(base, MOTIVO.alCron);
  const j = indicePorId(base, hacia);
  if (j < 0) return no(base, MOTIVO.noExiste);
  if (claseDe(base[j]) === 'inicio') return no(base, MOTIVO.alCron);
  if (claseDe(base[j]) === 'respuesta') return no(base, MOTIVO.aRespuesta);
  const raizAntes = raizSalida(base);
  const fila = filaDe(puerto);
  let out: P[];
  if (desde === ID_INICIO && indiceInicio(base) < 0) {
    // Del CRON sin nodo de inicio: la salida implícita es la primera tarjeta. Sin ella, la nueva ES la
    // salida; con ella, la nueva va en paralelo (y el inicio se crea, como lo hace el ＋ en paralelo).
    if (fila !== 'sig') return no(base, MOTIVO.sinSalida);
    if (raizAntes === hacia) return no(base, MOTIVO.yaEstan);
    if (raizAntes && 1 + contarParalelos(base) >= TOPE_HILOS) return no(base, MOTIVO.topeHilos);
    out = [...base, { id: ID_INICIO, nodo: 'inicio', siguiente: raizAntes ?? hacia, ...(raizAntes ? { paralelos: [hacia] } : {}) } as unknown as P];
  } else {
    const i = indicePorId(base, desde);
    if (i < 0) return no(base, MOTIVO.noExiste);
    const p = base[i];
    const c = claseDe(p);
    const pts = puertosDe(base, i);
    const principal = pts.find((pt) => !leerPuertoParalelo(pt.puerto) && pt.puerto === fila);
    if (!principal) return no(base, MOTIVO.sinSalida);
    if (pts.some((pt) => pt.destino === hacia && filaDe(pt.puerto) === fila)) return no(base, MOTIVO.yaEstan);
    if (descendientes(base, hacia).has(desde)) return no(base, MOTIVO.circulo);
    if (!principal.destino) {
      out = conectarPuerto(base, desde, fila, hacia);
    } else {
      const res = c === 'condicion' ? fila : null;
      const resp = raizRespuesta(base);
      const enResp = resp != null && (desde === resp || descendientes(base, resp).has(desde));
      if (c === 'respuesta' || enResp || !(c === 'condicion' || puedeTenerParalelos(p))) return no(base, MOTIVO.ocupada);
      const yaSalen = res ? paralelosDeResultado(p, res).length : (Array.isArray(p.paralelos) ? p.paralelos.length : 0);
      if (yaSalen >= TOPE_PARALELOS) return no(base, MOTIVO.topeParalelos);
      if (1 + contarParalelos(base) >= TOPE_HILOS) return no(base, MOTIVO.topeHilos);
      out = conectarPuerto(base, desde, puertoParalelo(null, res), hacia);
    }
    if (!puertosDe(out, i).some((pt) => pt.destino === hacia)) return no(base, MOTIVO.sinSalida);
  }
  // Si el CRON era implícito y `hacia` era su primera tarjeta, ahora la apunta otra: el CRON queda
  // explícito con la de antes (ver la cabecera).
  out = conRaiz(out, raizAntes ?? (desde === ID_INICIO ? hacia : null));
  const juntasAntes = tarjetasDondeSeJuntan(base);
  if ([...tarjetasDondeSeJuntan(out)].some((x) => !juntasAntes.has(x))) return no(base, MOTIVO.juntaCaminos);
  const antes = new Set(validarGrafo(base).filter((e) => !errorPropio(e)));
  const nuevo = validarGrafo(out).filter((e) => !errorPropio(e) && !antes.has(e));
  if (nuevo.length) return no(base, nuevo[0]);
  return listo(out);
}

/**
 * DESCONECTAR: saca la flecha de la salida `puerto` de `desde` que llega a `hacia` (sexta tanda,
 * punto 6: la papelera al lado del círculo). `hacia` queda SUELTA si no le llega otra flecha; nunca
 * se borra (punto 7). `puerto` puede ser el de la arista (`par:<id>`) o la fila del círculo ('sig',
 * una rama): se busca la flecha de esa fila que va a `hacia`.
 */
export function desconectar<P extends PasoGrafo>(pasosIn: readonly P[], desde: string, puerto: string, hacia: string): Edicion<P> {
  const base = normalizar(pasosIn);
  const raizAntes = raizSalida(base);
  if (desde === ID_INICIO && indiceInicio(base) < 0) {
    // La única flecha del CRON implícito es la de su primera tarjeta.
    if (filaDe(puerto) !== 'sig' || raizAntes !== hacia) return no(base, MOTIVO.noConectadas);
    return listo(conRaiz(base, null));
  }
  const i = indicePorId(base, desde);
  if (i < 0) return no(base, MOTIVO.noConectadas);
  const pt = puertosDe(base, i).find((x) => x.destino === hacia && (x.puerto === puerto || filaDe(x.puerto) === filaDe(puerto)));
  if (!pt) return no(base, MOTIVO.noConectadas);
  // Sin nodo de inicio, `hacia` queda sin padre y puede pasar a ser «la primera»: el CRON queda
  // explícito con la de antes (con inicio, `conRaiz` no cambia nada).
  return listo(conRaiz(quitarPuerto(base, desde, pt.puerto), raizAntes));
}

/**
 * «DESCONECTAR» UNA TARJETA (el click derecho): le quita todas las flechas que le LLEGAN y queda
 * suelta, con lo suyo colgando de ella. Los «Ir a» que saltan a ella no son flechas: se quedan.
 */
export function soltar<P extends PasoGrafo>(pasosIn: readonly P[], id: string): Edicion<P> {
  const base = normalizar(pasosIn);
  const i = indicePorId(base, id);
  if (id === ID_INICIO || i < 0 || claseDe(base[i]) === 'inicio') return no(base, i < 0 ? MOTIVO.noExiste : MOTIVO.sinFlechas);
  const raizAntes = raizSalida(base);
  const out = conRaiz(soltarDe(base, id), raizAntes === id ? null : raizAntes);
  if (out === base || JSON.stringify(out) === JSON.stringify(base)) return no(base, MOTIVO.sinFlechas);
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
  const base = normalizar(pasosIn);
  if (id === ID_INICIO) return no(base, MOTIVO.cronNo);
  const i = indicePorId(base, id);
  if (i < 0) return no(base, MOTIVO.noExiste);
  if (claseDe(base[i]) === 'inicio') return no(base, MOTIVO.cronNo);
  const raizAntes = raizSalida(base);
  let out = soltarDe(base, id).filter((q, k) => idDe(q, k) !== id);
  out = out.map((q) => (claseDe(q) === 'ir_a' && q.destino && 'nodo' in q.destino && q.destino.nodo === id ? { ...q, destino: null } : q));
  return listo(conRaiz(out, raizAntes === id ? null : raizAntes));
}

/**
 * UNA TARJETA SUELTA NUEVA (el click derecho en el lienzo: «crear una tarjeta» en ese punto). Nace
 * sin flechas —ni le llega ni sale nada— y al final del array. Devuelve su id para que quien la crea
 * la ponga donde se hizo el click (`fijarPosicion`, lib/lienzo-posiciones.ts) y abra su editor.
 */
export function crearSuelta<P extends PasoGrafo>(pasosIn: readonly P[], que: QueAgregar, rnd: () => number = Math.random): { pasos: P[]; id: string } {
  const base = normalizar(pasosIn);
  const raizAntes = raizSalida(base);
  const n = { ...nodoNuevo(que, base, rnd), siguiente: null } as unknown as P;
  const id = n.id!;
  return { pasos: conRaiz(normalizar([...base, n]), raizAntes), id };
}

/**
 * DUPLICAR UNA TARJETA (el click derecho): una copia con id nuevo, justo después de la original en el
 * array y SUELTA —sin flechas que le lleguen ni que salgan—, para conectarla donde haga falta. Lo de
 * adentro va entero (el texto, las partes, el audio, la acción, las filas de una condición, con ids de
 * rama nuevos). «Si responde» no se duplica (hay una sola) y el CRON tampoco.
 */
export function duplicar<P extends PasoGrafo>(pasosIn: readonly P[], id: string, rnd: () => number = Math.random): Edicion<P> {
  const base = normalizar(pasosIn);
  const i = indicePorId(base, id);
  if (i < 0) return no(base, MOTIVO.noExiste);
  const c = claseDe(base[i]);
  if (c === 'inicio' || c === 'respuesta') return no(base, MOTIVO.noSeDuplica);
  const raizAntes = raizSalida(base);
  const copia = JSON.parse(JSON.stringify(base[i])) as P;
  const nid = nuevoId(base, rnd);
  copia.id = nid;
  delete copia.paralelos;
  delete copia.paralelos_si_no;
  if (c === 'condicion') {
    const usados: PasoGrafo[] = [...base, { id: nid }];
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
  const out = [...base.slice(0, i + 1), copia, ...base.slice(i + 1)];
  return listo(conRaiz(out, raizAntes), nid);
}
