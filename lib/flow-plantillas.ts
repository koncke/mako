// =============================================================================
// Las plantillas del espejo, guardadas del lado del servidor
// =============================================================================
// EL PROBLEMA QUE RESUELVE, en palabras del dueño: «¿por qué me pides
// constantemente generar imágenes o videos? ¿no te basta la data de todas las
// veces que lo hemos generado?».
//
// Tenía razón y era un defecto, no una limitación. El puente funciona COPIANDO el
// pedido que hace la propia página de Flow —esa es la decisión que lo hizo
// funcionar, porque reconstruirlo a mano falló cinco veces—, pero esa copia vivía
// en dos lugares y los dos son del navegador: la memoria de la pestaña, que se
// borra con cada F5, y `chrome.storage.local`, que se va con el perfil. Del lado
// nuestro no quedaba NADA.
//
// Consecuencia: cada vez que el navegador olvidaba, la app volvía a pedir «genera
// UNA imagen a mano», «genera UN video a mano», «anima UNA imagen a mano»,
// «espera a que Flow lea tu saldo» — cuatro pedidos distintos, todos por lo mismo,
// sobre cosas que el cliente ya había hecho decenas de veces.
//
// Es exactamente la lección que el repo ya había aplicado a UN dato: el `mediaId`
// de la cara se guarda desde que se aprende, «un dato que se descubre una vez y no
// cambia no puede depender de que una pestaña siga abierta». Faltaba aplicarla a
// lo que produce ese dato.
//
// SIN `server-only`: el saneo decide qué se persiste de un pedido autenticado, y
// una decisión así necesita test.

import { ENDPOINTS } from './flow-protocolo';
import { OPERACIONES } from './flow-operaciones';
import { comoViajo } from './flow-boq-patch';

/** Dónde vive, por workspace. */
export const KEY_PLANTILLAS = 'flow.plantillas';

/**
 * Lo último que el saneador DESCARTÓ de un latido, y por qué.
 *
 * ⚠️ EXISTE PORQUE EL RESPALDO DE UN WORKSPACE TENÍA CERO PLANTILLAS DE BOQ y nada
 * lo decía. El navegador las mandaba en cada latido, el saneador las tiraba, y las
 * cinco del protocolo viejo seguían ahí como si el respaldo funcionara. Una
 * política que rechaza sin dejar rastro hace indistinguibles «no llegó» de «lo
 * tiramos nosotros» — es la regla que este archivo ya tenía escrita para `ajenas`,
 * y el saneador, que descarta por CUATRO motivos distintos, no la cumplía.
 */
export const KEY_PLANTILLAS_DESCARTES = 'flow.plantillas_descartes';

/**
 * La clase de un pedido: el último tramo del path.
 *
 * ⚠️ La misma fórmula que `claseDe()` en `extension/injected.js` y que el cálculo
 * de `background.js`. Es lo que hace que una plantilla guardada acá se encuentre
 * allá; si las tres se separan, el respaldo deja de matchear y no falla: pide
 * generar a mano, otra vez.
 */
export function claseDePath(path: string): string {
  return String(path || '').split('?')[0].split('/').filter(Boolean).pop() || '';
}

/**
 * Qué clases se guardan. DERIVADA de `ENDPOINTS`, no escrita a mano.
 *
 * Una lista a mano se queda vieja el día que se agrega un endpoint, y el síntoma
 * sería justamente el que esto viene a sacar: «genera uno a mano». El `'x'` del
 * projectId es de mentira y no importa — la clase es el último tramo, que en ese
 * endpoint es `flowMedia:batchGenerateImages` con cualquier proyecto.
 *
 * Es un allowlist POSITIVO a propósito: se guarda lo que sirve, no «todo menos».
 * Flow hace decenas de pedidos por sesión (telemetría, recomendaciones, applets) y
 * ninguno de ésos tiene por qué terminar en nuestra base.
 */
// ⚠️ EL ID FALSO CON EL QUE SE DERIVA NO PUEDE QUEDAR COMO CLASE.
//
// La lista se arma llamando a cada endpoint con `'x'` de projectId. Para casi todos
// el ultimo tramo es un nombre fijo — pero `media: (id) => /v1/media/${id}` termina EN
// el parametro, asi que `'x'` entraba al allowlist como una clase valida.
//
// Medido: CLASES_UTILES traia [..., 'credits', 'x']. Una plantilla con `clase: 'x'`
// pasaba el filtro. Es la trampa de derivar un allowlist de datos: el andamio de la
// derivacion se cuela adentro del resultado.
const ID_FALSO = 'x';

export const CLASES_UTILES: readonly string[] = Object.freeze(
  [...new Set(
    Object.values(ENDPOINTS)
      .map((v) => (typeof v === 'function' ? v(ID_FALSO) : v))
      .map(claseDePath)
      .filter(Boolean)
      // Un endpoint que TERMINA en su parametro no aporta una clase: aporta el
      // andamio. Se saca por identidad con el id falso, no por una lista a mano.
      .filter((c) => c !== ID_FALSO),
  )],
);

export type PlantillaEspejo = {
  /**
   * true = no se midió, se asumió. La arma `lib/plantilla-fabrica.ts` cuando el
   * cliente todavía no generó nada a mano.
   *
   * ⚠️ Existe para que el que investigue pueda distinguir «esto lo vimos» de
   * «esto lo asumimos». Sin la marca, una plantilla de fábrica que quedó vieja
   * porque Google cambió el contrato es indistinguible de una medida — y el
   * diagnóstico arranca de una premisa falsa.
   */
  deFabrica?: boolean;
  clase: string;
  url: string;
  metodo: string;
  headers: Record<string, string>;
  cuerpo: string | null;
  credenciales?: string;
  /**
   * Qué operación del catálogo es este pedido (`generar_clip`, `subir_imagen`…).
   *
   * ⚠️ ES LA LLAVE REAL. La `clase` de BOQ es `boq:<rpcid>` y el rpcid es de un
   * bundle de Google: rota. El `op` no.
   */
  op?: string;
  /**
   * Con qué codificación aparece la frase de aprendizaje en este cuerpo.
   *
   * ⚠️ Es lo que dice que esta plantilla es la de GENERAR y no la de sondear. Sin
   * este campo el respaldo devuelve plantillas que el navegador no puede reconocer,
   * y el popup vuelve a pedir un clip pagado sobre algo que ya sabíamos.
   *
   * Faltaba en el tipo Y en el `out.push`. Es el MISMO defecto que ya se pagó hoy en
   * `extension/injected.js`, una capa más arriba: un objeto armado campo por campo
   * pierde en silencio todo lo que no esté nombrado.
   */
  sentinela?: string | null;
  cuando?: number;
};

/** Lo más grande que se guarda de UN cuerpo, y de todo junto. */
const TOPE_CUERPO = 20_000;
const TOPE_TOTAL = 150_000;

/**
 * Encabezados que NUNCA se persisten.
 *
 * ⚠️ `injected.js` ya saca el `authorization` antes de mandarlo, y aun así se
 * vuelve a sacar acá. No es desconfianza del código de al lado: es que el que
 * guarda es el único que puede garantizar qué quedó guardado, y una extensión vieja
 * —de las que hay, justamente— manda lo que mandaba su versión. El guard va donde
 * se escribe.
 *
 * La comparación es en minúsculas porque `delete o.authorization` NO borra
 * `Authorization`, que es como lo manda Flow. Ese error ya dejó un bearer guardado
 * en `chrome.storage.local` contra lo que prometía su propio comentario.
 */
const HEADERS_PROHIBIDOS = new Set(['authorization', 'cookie', 'set-cookie', 'x-goog-authuser']);

/**
 * Las operaciones que vale la pena guardar, DERIVADAS del catálogo.
 *
 * ⚠️ Es la respuesta a un problema que el allowlist viejo no podía tener: en el
 * protocolo viejo cada operación tenía su propio path, así que enumerar paths
 * alcanzaba. En BOQ **todos** los pedidos van al mismo `/data/batchexecute` y lo
 * único que los distingue es un `rpcids` que ROTA con cada bundle de Google.
 *
 * O sea que no se pueden enumerar los ids, y «todo lo que empiece con boq:» sería
 * un allowlist por descarte —lo que este repo tiene prohibido— que además guardaría
 * la telemetría de Google en nuestra base.
 *
 * El criterio positivo que NO envejece es el ROL: útil es lo que el navegador pudo
 * ATAR a una de las operaciones que este sistema sabe repetir. La telemetría no
 * queda afuera por estar nombrada —imposible, comparte path— sino porque nunca gana
 * un rol: nadie la mide y nadie la enlaza a un trabajo.
 */
const OPS_UTILES: ReadonlySet<string> = Object.freeze(
  new Set(OPERACIONES.filter((o) => o.como !== 'ninguna').map((o) => o.op)),
) as ReadonlySet<string>;

/**
 * La FORMA de una clase de BOQ: `boq:` y hasta cinco rpcids separados por coma.
 *
 * Un batchexecute real puede traer varios (`boq:YhhmEf,ngNC2`), así que la coma es
 * parte del contrato. Y la clase termina siendo llave de un mapa: sin esta forma
 * entrarían cosas como `boq:` vacío o `boq:../x`.
 */
const FORMA_BOQ = /^boq:[A-Za-z0-9_-]{3,24}(?:,[A-Za-z0-9_-]{3,24}){0,4}$/;

/** La llave con la que se identifica una plantilla: el ROL si lo tiene, la clase si no. */
export function llaveDePlantilla(p: PlantillaEspejo): string {
  // ⚠️ EL ROL LE GANA A LA CLASE, y por eso el respaldo sobrevive a una rotación de
  // rpcids. Con la clase como llave, un respaldo guardado hoy re-sembraría mañana un
  // id muerto: el pedido sale, Google contesta 400, y el puente parece roto cuando
  // lo que está viejo es la copia. Un respaldo que devuelve basura es PEOR que no
  // tener respaldo, porque nadie sospecha de él.
  return p.op ? `op:${p.op}` : p.clase;
}

/**
 * Los origenes desde los que una plantilla puede venir.
 *
 * ⚠️ SE COMPARA `origin`, NUNCA UN PREFIJO DE LA URL. Un `startsWith` se ve igual de
 * seguro y no lo es: medido, `https://flow.google.com` como prefijo acepta
 * `https://flow.google.com.evil.tld`, `https://flow.google.comevil.tld`,
 * `https://flow.google.com:8443` y —el peor— `https://flow.google.com@evil.tld`, cuyo
 * origen REAL es `https://evil.tld`. O sea que un pedido nuestro saldria a un tercero,
 * con las credenciales del cliente, y la url se leeria bien en cualquier listado.
 *
 * La linea que habia (`aisandbox-pa.googleapis.com/`) no era explotable de milagro: la
 * salva la barra final. Eso es suerte del formato, no del metodo — y no sobrevive al
 * dia que alguien escriba la de al lado sin la barra, que es exactamente lo que este
 * archivo estaba por hacer.
 *
 * `labs.google` queda AFUERA a proposito: hoy no se persiste nada de ese origen. Un
 * origen se agrega el dia que algo de el se guarda, no antes.
 */
const ORIGENES_DE_FLOW: ReadonlySet<string> = Object.freeze(new Set([
  'https://aisandbox-pa.googleapis.com',  // el protocolo viejo, y el que arma plantilla-fabrica
  'https://flow.google.com',              // BOQ, el Flow nuevo
])) as ReadonlySet<string>;

/** Si esta url sale de un origen de Flow. Sin `server-only`: esto se testea. */
export function esOrigenDeFlow(url: string): boolean {
  try {
    const u = new URL(String(url || ""));
    if (u.protocol !== 'https:') return false;
    return ORIGENES_DE_FLOW.has(u.origin);
  } catch {
    // Una url que ni siquiera parsea no es de Flow. Abstenerse es lo correcto.
    return false;
  }
}

/**
 * Saca el `at` de un cuerpo `form-urlencoded`.
 *
 * ⚠️ ESTA REDACCION FALTABA ENTERA, y sin ella abrir el allowlist a BOQ habria
 * empezado a guardar una credencial del cliente en nuestra base.
 *
 * La redaccion que ya existia hace `JSON.parse(cuerpo)` y, si tira, deja el cuerpo
 * "como vino" — un default razonable para el protocolo viejo, donde todo era JSON.
 * El cuerpo de BOQ es `f.req=...&at=...`, o sea que NO parsea: caia en el `catch` y
 * pasaba intacto. Es la trampa de siempre: el camino de error de una capa se vuelve
 * el camino normal de la siguiente.
 *
 * `at` es el token anti-CSRF de la sesion de Google. `injected.js` ya lo redacta antes
 * de mandarlo, y aca se redacta OTRA VEZ, por la misma razon escrita arriba para los
 * headers: el que guarda es el unico que puede garantizar que quedo guardado, y hay
 * extensiones viejas dando vueltas que mandan lo que mandaba su version.
 */
export function sinAtDeBoq(cuerpo: string): string {
  return cuerpo.replace(/(^|&)at=[^&]*/g, (_m, pre: string) => pre + 'at=__MAKO_AT__');
}

/**
 * Deja una lista de plantillas lista para guardar, o la descarta.
 *
 * Devuelve solo lo de las clases útiles, sin credenciales, sin el token del
 * captcha —que se acuña en el momento y vencido no sirve para nada— y acotada.
 */
/**
 * El proyecto de Flow al que pertenece una plantilla. `''` = no se puede saber.
 *
 * Vive en dos lados según la clase: en el PATH de la url
 * (`/v1/projects/<uuid>/flowMedia:batchGenerateImages`) o en el
 * `clientContext.projectId` del cuerpo. Se miran los dos, y alcanza con uno.
 */
export function proyectoDePlantilla(p: PlantillaEspejo): string {
  const enUrl = /\/projects\/([0-9a-f-]{36})/i.exec(p.url || '');
  if (enUrl) return enUrl[1];
  // ⚠️ Y LA TERCERA LECTURA, que es la del Flow nuevo y faltaba entera.
  //
  // En BOQ el projectId no está en el path —todos los pedidos van al mismo
  // /data/batchexecute— sino en el query, como source-path=/project/<uuid>, en
  // SINGULAR. Y el cuerpo es form-urlencoded, así que el JSON.parse de abajo tira.
  //
  // O sea que para toda plantilla de BOQ esta función devolvía '' y soloDelProyecto
  // la dejaba pasar por abstención. Eso es lo correcto cuando no se sabe, pero deja
  // SIN GUARDA el caso que la función existe para cubrir: un navegador emparejado
  // antes con otro cliente manda plantillas con el projectId de aquél, y se guardarían
  // acá — con el cuerpo de su generación adentro.
  const enQuery = /[?&]source-path=%2Fproject%2F([0-9a-f-]{36})/i.exec(p.url || '')
    || /[?&]source-path=\/project\/([0-9a-f-]{36})/i.exec(p.url || '');
  if (enQuery) return enQuery[1];
  try {
    const o = JSON.parse(p.cuerpo || '{}') as { clientContext?: { projectId?: unknown } };
    const id = String(o?.clientContext?.projectId ?? '');
    return /^[0-9a-f-]{36}$/i.test(id) ? id : '';
  } catch {
    return '';
  }
}

/**
 * Se queda con las plantillas que son de ESTE proyecto de Flow.
 *
 * ⚠️ POR QUÉ EXISTE: el respaldo de plantillas de la extensión vive en
 * `chrome.storage.local` bajo UNA clave global (`plantillas`), sin token ni
 * workspace adentro. Emparejar el mismo navegador con otro cliente pisa el
 * `token` y NO toca ese respaldo, así que el latido siguiente sube al workspace
 * nuevo las plantillas aprendidas en el anterior — con el projectId de Flow del
 * otro cliente, el cuerpo de su generación y el mediaId de su cara.
 *
 * Es el caso normal del super-admin, que abre un cliente por pestaña. Nadie gana
 * un permiso que no tenía —el que empareja está autorizado en los dos, y el
 * Google que paga es siempre el del navegador que apretó Conectar—, pero los
 * datos de un cliente terminan PERSISTIDOS en la fila de otro, y de ahí bajan al
 * navegador real de ese otro en el latido siguiente.
 *
 * El arreglo de raíz es de la extensión (que la clave lleve el token). Éste es el
 * lado que NO depende de que el cliente actualice: el server ya recibe, en el
 * mismo request, el projectId que el navegador está mirando.
 *
 * ⚠️ Sólo se descarta lo que se puede PROBAR ajeno. Una plantilla sin projectId
 * —`credits`, `uploadImage`, las dos de video— pasa: no tenemos con qué
 * contradecirla, y tirarla sería castigar la falta de evidencia. Y si el puente
 * no reporta proyecto, no se filtra nada: sin la mitad de la comparación no hay
 * comparación.
 */
export function soloDelProyecto(
  ps: PlantillaEspejo[],
  projectId: string,
): { quedan: PlantillaEspejo[]; ajenas: PlantillaEspejo[] } {
  const mio = String(projectId || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(mio)) return { quedan: ps, ajenas: [] };

  const quedan: PlantillaEspejo[] = [];
  const ajenas: PlantillaEspejo[] = [];
  for (const p of ps) {
    const suyo = proyectoDePlantilla(p);
    if (suyo && suyo.toLowerCase() !== mio.toLowerCase()) ajenas.push(p);
    else quedan.push(p);
  }
  return { quedan, ajenas };
}

/**
 * @param descartes Si se pasa, recibe UNA línea por plantilla descartada, con el
 *   motivo. Ver `KEY_PLANTILLAS_DESCARTES`: un descarte sin rastro no se puede
 *   diagnosticar, y ya costó un respaldo entero vacío sin que nadie lo notara.
 */
export function sanearPlantillas(crudo: unknown, descartes?: string[]): PlantillaEspejo[] {
  if (!Array.isArray(crudo)) { descartes?.push('no_es_lista'); return []; }
  const out: PlantillaEspejo[] = [];
  let total = 0;
  const tirar = (motivo: string, clase: string, url = '') => {
    descartes?.push(`${motivo}(${clase || '?'})${url ? ' ' + url.slice(0, 90) : ''}`);
  };

  for (const it of crudo) {
    if (!it || typeof it !== 'object') { tirar('no_es_objeto', ''); continue; }
    const p = it as Record<string, unknown>;
    const clase = String(p.clase || '');
    const op = typeof p.op === 'string' ? p.op : '';
    // ⚠️ DOS RAMAS, LAS DOS POSITIVAS.
    //
    // (1) Protocolo viejo: la clase sale del path y se puede enumerar. Sin tocar.
    // (2) BOQ: todos comparten path, así que lo que decide es que el navegador haya
    //     podido ATAR el pedido a una operación del catálogo. Se exige la FORMA de la
    //     clase además del rol, porque la clase es llave de un mapa.
    const viejoOk = CLASES_UTILES.includes(clase);
    const boqOk = FORMA_BOQ.test(clase) && OPS_UTILES.has(op);
    if (!viejoOk && !boqOk) { tirar('sin_rol', clase); continue; }
    const url = String(p.url || '');
    // Sin url no hay nada que copiar, y el origen tiene que ser el de Flow: una
    // plantilla apuntando a otro lado sería un pedido nuestro a un tercero.
    // Ver `esOrigenDeFlow`: se compara `origin`, nunca un prefijo.
    // ⚠️ SE REGISTRA CON LA URL. Una url RELATIVA (`/_/AiSandbox…`) cae acá: `new URL`
    // tira, `esOrigenDeFlow` contesta false, y la plantilla —perfectamente útil para
    // el navegador, que la repite contra su propio origen— desaparece del respaldo.
    if (!esOrigenDeFlow(url)) { tirar('origen', clase, url); continue; }
    // Una clase de BOQ tiene que venir del endpoint de BOQ. Sin esto, cualquier
    // pedido de flow.google.com con un `op` puesto entraría como plantilla.
    if (boqOk) {
      try {
        if (!new URL(url).pathname.endsWith('/data/batchexecute')) { tirar('no_batchexecute', clase, url); continue; }
      } catch { tirar('url_no_parsea', clase, url); continue; }
    }

    const headers: Record<string, string> = {};
    const hs = (p.headers && typeof p.headers === 'object') ? p.headers as Record<string, unknown> : {};
    for (const [k, v] of Object.entries(hs)) {
      if (HEADERS_PROHIBIDOS.has(k.toLowerCase())) continue;
      if (typeof v === 'string') headers[k] = v.slice(0, 400);
    }

    let cuerpo: string | null = typeof p.cuerpo === 'string' ? p.cuerpo.slice(0, TOPE_CUERPO) : null;
    if (cuerpo) {
      // El TOKEN del captcha se borra; el `recaptchaContext` NO. Su
      // `applicationType` no es una credencial, es una constante del contrato, y
      // tirarlo entero ya produjo un «reCAPTCHA evaluation failed».
      try {
        const o = JSON.parse(cuerpo) as Record<string, unknown>;
        const ctx = o.clientContext as Record<string, unknown> | undefined;
        const rc = ctx?.recaptchaContext as Record<string, unknown> | undefined;
        if (rc && 'token' in rc) delete rc.token;
        cuerpo = JSON.stringify(o);
      } catch {
        // ⚠️ NO ERA JSON, Y ESO NO SIGNIFICA QUE NO TENGA CREDENCIALES.
        //
        // Acá caía el cuerpo de BOQ —`f.req=...&at=...`, form-urlencoded— y salía
        // intacto, con el `at` adentro. El comentario que había («va como vino») era
        // cierto y describía justamente el agujero.
        cuerpo = sinAtDeBoq(cuerpo);
      }
    }

    const tam = url.length + (cuerpo?.length ?? 0) + JSON.stringify(headers).length;
    if (total + tam > TOPE_TOTAL) { tirar('tope_total', clase); break; }
    total += tam;

    out.push({
      clase,
      url,
      metodo: String(p.metodo || 'POST').toUpperCase(),
      headers,
      cuerpo,
      ...(typeof p.credenciales === 'string' ? { credenciales: p.credenciales } : {}),
      // Se conserva la marca o se pierde en el primer ida y vuelta, y con ella la
      // única forma de saber que ese pedido nunca se midió.
      ...(p.deFabrica === true ? { deFabrica: true } : {}),
      // Ver el tipo: sin esto, el respaldo se lleva la plantilla y deja afuera lo
      // único que dice para qué sirve.
      ...(typeof p.sentinela === 'string' && p.sentinela ? { sentinela: p.sentinela.slice(0, 40) } : {}),
      // La llave real. Sin esto el respaldo vuelve keyeado por un rpcid que rota.
      ...(op ? { op } : {}),
      cuando: Number(p.cuando) || 0,
    });
  }
  return out;
}

/**
 * Funde lo que llega con lo que ya había: gana la que tenga CUERPO, y a igualdad
 * la más nueva.
 *
 * ⚠️ El criterio no es «la más nueva gana» a secas, y la diferencia es la que
 * costó el HTTP 400: una plantilla puede llegar SIN CUERPO —Flow llamó con un
 * `Request` y una extensión vieja no sabía leerlo— y esa cáscara no se distingue
 * de una sana en ningún punto del camino. Dejar que pise a una completa es
 * cambiar algo que funciona por algo que falla sin decirlo.
 */
/**
 * ¿Este cuerpo todavía lleva la frase de aprendizaje de SU operación?
 *
 * Es lo que hace a una plantilla REPETIBLE: `reemplazarEnCuerpo` busca esa frase
 * para poner el prompt real en su lugar. Sin ella, la plantilla existe, está
 * completa, tiene `op` y `sentinela`… y no sirve para nada.
 */
export function tieneAncla(p: Pick<PlantillaEspejo, 'op' | 'cuerpo'>): boolean {
  const cat = OPERACIONES.find((o) => o.op === p.op);
  if (!cat || !cat.frase || !p.cuerpo) return false;
  return comoViajo(p.cuerpo, cat.frase) != null;
}

export function fundirPlantillas(
  previas: PlantillaEspejo[],
  nuevas: PlantillaEspejo[],
): PlantillaEspejo[] {
  const mapa = new Map<string, PlantillaEspejo>();
  for (const p of previas) mapa.set(llaveDePlantilla(p), p);
  for (const n of nuevas) {
    const k = llaveDePlantilla(n);
    const vieja = mapa.get(k);
    if (!vieja) { mapa.set(k, n); continue; }
    const nSirve = n.cuerpo != null || n.metodo === 'GET' || n.metodo === 'HEAD';
    const vSirve = vieja.cuerpo != null || vieja.metodo === 'GET' || vieja.metodo === 'HEAD';
    // ⚠️ GANE QUIEN GANE, `op` y `sentinela` NO SE PIERDEN.
    //
    // Se descubren UNA vez y no cambian, así que un pedido posterior que no los trae
    // no puede borrarlos. Es el mismo defecto que ya se pagó en el navegador: ahí un
    // `{ ...p }` pisaba con `null` lo que había costado un clip pagado. Fundir el
    // objeto entero y confiar en que el ganador los traiga es repetirlo acá.
    const conservar = (g: PlantillaEspejo): PlantillaEspejo => ({
      ...g,
      op: g.op || vieja.op || n.op,
      sentinela: g.sentinela || vieja.sentinela || n.sentinela || null,
    });
    if (nSirve && !vSirve) { mapa.set(k, conservar(n)); continue; }
    if (!nSirve && vSirve) { mapa.set(k, conservar(vieja)); continue; }
    // ⚠️ UN CUERPO CON ANCLA NO LO PISA UNO SIN ANCLA, POR NUEVO QUE SEA.
    //
    // «La más nueva gana» conservaba `op` y `sentinela` —los campos que dicen que
    // esta clase ALGUNA VEZ llevó la frase— y tiraba el CUERPO que la llevaba. La
    // siguiente generación de la misma clase (un video cualquiera del cliente) traía
    // un cuerpo sin la frase, ganaba por fecha, y el respaldo quedaba con una
    // plantilla que declara saber generar y no se puede parchear. Medido en
    // producción: `SIN_ANCLA(generar_clip)` con la sentinela intacta al lado.
    //
    // La frase se enseña UNA vez y cuesta un crédito: el cuerpo que la trae es el
    // dato caro, y se protege igual que la sentinela.
    const aV = tieneAncla(vieja);
    const aN = tieneAncla(n);
    if (aV && !aN) { mapa.set(k, conservar(vieja)); continue; }
    if (aN && !aV) { mapa.set(k, conservar(n)); continue; }
    mapa.set(k, conservar((n.cuando ?? 0) >= (vieja.cuando ?? 0) ? n : vieja));
  }
  return [...mapa.values()];
}

/**
 * ¿La plantilla de imagen ya trae el array donde vive la cara?
 *
 * ⚠️ ES UNA GUARDA, NO UNA CURIOSIDAD, y sale de una trampa concreta: `parchar()`
 * INVENTA los tramos que faltan. Sobre una plantilla sin `imageInputs`, un parche
 * a `requests.0.imageInputs.0.name` crearía `[{ name }]` **sin su
 * `imageInputType`**, devolvería éxito, y saldría un cuerpo mal formado armado por
 * nosotros — sin `PARCHE_FALLO`, sin error, y con una imagen de resultado. El modo
 * de falla más caro: no se lee como un fallo, se lee como una imagen.
 *
 * Devuelve `null` cuando no se puede saber —cuerpo ausente, o truncado y por eso
 * ilegible—, que NO es lo mismo que «no lo tiene». Con `null` no se parchea: no
 * poder comprobar algo no autoriza a asumirlo.
 */
export function tieneCaraParcheable(cuerpo: string | null): boolean | null {
  if (!cuerpo) return null;
  let o: Record<string, unknown>;
  try { o = JSON.parse(cuerpo) as Record<string, unknown>; } catch { return null; }
  const req = Array.isArray(o.requests) ? o.requests[0] : null;
  if (!req || typeof req !== 'object') return false;
  const inputs = (req as Record<string, unknown>).imageInputs;
  if (!Array.isArray(inputs) || !inputs.length) return false;
  const primero = inputs[0] as Record<string, unknown> | undefined;
  // Tiene que traer las DOS: el nombre que vamos a pisar y el tipo que hay que
  // conservar. Con una sola, parchear deja el pedido a medias.
  return !!primero && typeof primero.name === 'string' && typeof primero.imageInputType === 'string';
}

/** Las que el navegador NO tiene y nosotros sí. Es lo único que hace falta devolver. */
export function faltantes(
  guardadas: PlantillaEspejo[],
  clasesQueTiene: readonly string[],
  opsQueTiene: readonly string[] = [],
): PlantillaEspejo[] {
  const tiene = new Set(clasesQueTiene.map(String));
  const tieneOp = new Set(opsQueTiene.map(String).filter(Boolean));
  // ⚠️ SE MIRA LA CLASE **O** EL ROL, y el rol es el que importa en BOQ.
  //
  // Mirando sólo la clase, un navegador que ya aprendió `generar_clip` bajo el rpcid
  // de HOY recibiría de vuelta la plantilla del rpcid de AYER, guardada con otra
  // clase. Sembrarla no es inocuo: `sembrarPlantillas` no pisa las locales, así que
  // queda una segunda entrada muerta para la misma operación y el conteo de «N de M»
  // empieza a mentir.
  return guardadas.filter((p) => {
    if (tiene.has(p.clase)) return false;
    if (p.op && tieneOp.has(p.op)) return false;
    return true;
  });
}

/**
 * Qué respuestas de Flow se guardan. Allowlist POSITIVO.
 *
 * ⚠️ SE GUARDABA TODO LO QUE MANDARA EL NAVEGADOR. Medido en producción el
 * 01/09/2026, lo que había en la fila de dos clientes incluía `userSettings`,
 * `likeness:listUserLikenesses` —los parecidos faciales que la persona tiene
 * cargados en Google—, `appConfig`, `sessions`, `savedSharedApplets` y dos claves
 * que eran UUID sueltos. Nada de eso lo pide ni lo lee nadie de este lado: es
 * respuesta de Google a pedidos de Google, guardada en nuestra base porque el
 * espejo la vio pasar.
 *
 * Y hay una segunda razón, más urgente: el storage del navegador es UNO SOLO para
 * todos los clientes que se abren desde él. Si el anterior dejó algo ahí, el
 * latido del siguiente lo sube a SU fila. La limpieza al cambiar de cliente vive
 * en `mako-puente.js`, pero eso sólo alcanza a los navegadores actualizados: esta
 * lista es la mitad que protege contra la extensión vieja, que es la que sigue
 * instalada mientras la gente actualiza.
 *
 * Lo que entra: las clases del protocolo —las que de verdad usamos— y las cuatro
 * de diagnóstico propio, que empiezan con `__` y las escribimos nosotros.
 */
const CLAVES_RESPUESTA = new Set<string>([
  ...CLASES_UTILES,
  '__fuentes', '__sonda', '__sondaSW', '__redirect',
]);

/** ¿Esta clave de respuesta se guarda? Es el allowlist, en una función. */
export function seGuardaLaRespuesta(clave: string): boolean {
  return CLAVES_RESPUESTA.has(clave);
}
