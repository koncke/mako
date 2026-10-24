// =============================================================================
// oferta-modelo — la forma de una OFERTA y la regla de dónde sale cada campo
// =============================================================================
// SIN `server-only` A PROPÓSITO. Acá viven las dos reglas que hay que poder
// testear sin Supabase:
//
//   1. `resolverOfertaPrincipal(fila, answers)` — de dónde sale cada uno de los
//      5 campos del brief. Es el mecanismo `desde_brief` del modelo: la fila
//      existe con los 5 en NULL y el valor sigue viviendo en el blob de
//      app_settings. CERO copia, cero desincronización (AGENTS.md § Una cosa,
//      un lugar).
//   2. `urgenciaVigente(oferta, hoy)` — la segunda capa determinista del ángulo
//      «Oferta directa (urgencia)». El prompt de lib/guion-angulos.ts EXIGE «una
//      restricción REAL documentada» y PROHÍBE inventarla: hasta hoy ese era un
//      requisito de contrato sin ningún campo donde cumplirse ni ninguna línea
//      que lo mirara. Una regla que sólo vive en un prompt no es una regla.
//
// El resto del módulo son tipos y el saneo de `bonos` (jsonb).
// =============================================================================

/** Los 4 tipos de urgencia que el sistema sabe verificar. Cerrado a propósito:
 *  un textarea libre no se puede apagar en código cuando vence. */
export type UrgenciaTipo = 'fecha' | 'cupos' | 'capacidad' | 'inicio';

export const URGENCIAS: Array<{ id: UrgenciaTipo; label: string; ph: string }> = [
  { id: 'fecha', label: 'Cierra en una fecha', ph: 'Las inscripciones cierran el 12 de octubre' },
  { id: 'cupos', label: 'Hay cupos limitados', ph: '6 lugares' },
  { id: 'capacidad', label: 'No me da la capacidad', ph: 'Atiendo 8 clientes por vez' },
  { id: 'inicio', label: 'Arranca en una fecha', ph: 'El grupo empieza el 3 de noviembre' },
];

export const esUrgenciaTipo = (v: unknown): v is UrgenciaTipo =>
  typeof v === 'string' && URGENCIAS.some((u) => u.id === v);

/** Un bono de la oferta. `valor_usd` es lo que el bono VALE, no lo que cuesta. */
export type Bono = { nombre: string; valor_usd: number | null; porque: string };

/** Una fila de `ofertas` (mig 0169). Los nombres son los de las columnas. */
/** Cómo se cobra una oferta (mig 0272). El ticket es `precio_usd`; en una suscripción, el de cada mes. */
export type ModeloOferta = 'unico' | 'suscripcion';
export const MODELOS_OFERTA: ReadonlyArray<{ id: ModeloOferta; label: string }> = [
  { id: 'unico', label: 'Pago único' },
  { id: 'suscripcion', label: 'Suscripción' },
];
export const esModeloOferta = (v: unknown): v is ModeloOferta => v === 'unico' || v === 'suscripcion';

/** Una oferta como la ve la ficha del lead (y la API de MaKo, `oferta_del_lead`). */
export type OfertaParaLead = { id: number; nombre: string; precio_usd: number | null; modelo: ModeloOferta | null };

/** Lo mínimo de una oferta nueva, validado. Una sola regla para la ficha y la API. */
export function validarOfertaNueva(datos: { nombre?: unknown; modelo?: unknown; ticket?: unknown }):
  { ok: true; nombre: string; modelo: ModeloOferta; ticket: number | null } | { ok: false; error: string } {
  const nombre = String(datos?.nombre ?? '').trim().replace(/\s+/g, ' ');
  if (!nombre) return { ok: false, error: 'La oferta necesita un nombre.' };
  if (nombre.length > 80) return { ok: false, error: 'El nombre no puede pasar de 80 caracteres.' };
  const modelo = datos?.modelo;
  if (!esModeloOferta(modelo)) return { ok: false, error: 'Elige cómo se cobra.' };
  const ticket = datos?.ticket == null || datos.ticket === '' ? null : Number(datos.ticket);
  if (ticket != null && (!Number.isFinite(ticket) || ticket < 0)) return { ok: false, error: 'El ticket tiene que ser un número.' };
  return { ok: true, nombre, modelo, ticket };
}

export type Oferta = {
  id: number;
  nombre: string;
  precio_usd: number | null;
  /** Cómo se cobra (mig 0272). Opcional: las ofertas viejas y las armadas en código no lo dicen. */
  modelo?: ModeloOferta | null;
  precio_nota: string | null;
  promesa: string | null;
  incluye: string | null;
  garantia: string | null;
  bonos: Bono[];
  urgencia_tipo: UrgenciaTipo | null;
  urgencia_dato: string | null;
  urgencia_razon: string | null;
  /** ISO `YYYY-MM-DD`. Sólo con `urgencia_tipo` de fecha se puede VERIFICAR. */
  urgencia_hasta: string | null;
  para_quien: string | null;
  objeciones: string | null;
  prueba: string | null;
  desde_brief: boolean;
  es_principal: boolean;
  activa: boolean;
  orden: number;
  origen: string;
};

/** Lo que se le manda a la base al crear o editar. Todo opcional menos el nombre. */
export type OfertaInput = Partial<Omit<Oferta, 'id'>> & { nombre: string };

// ── Los 5 campos del brief ───────────────────────────────────────────────────
// Clave del blob (`mako.onboarding.answers`) → columna de `ofertas` + el RÓTULO
// CORTO con el que sale a los prompts.
//
// ⚠️ El rótulo corto NO es cosmético. `perfilNegocioTexto()` emitía el `label` del
// esquema, que es una PREGUNTA, así que a ~20 features les llegaba literal
// «Oferta — ¿Cómo se llama tu oferta?: X · ¿Tienes garantía? ¿Cuál?: 30 días».
// El repo ya había resuelto exactamente esto para el grafo (lib/cerebro-grafo.ts)
// y no para los prompts.
export const CAMPOS_BRIEF = [
  { clave: 'oferta_nombre', columna: 'nombre', rotulo: 'Nombre' },
  { clave: 'oferta_ticket', columna: 'precio', rotulo: 'Precio' },
  { clave: 'oferta_promesa', columna: 'promesa', rotulo: 'Promesa' },
  { clave: 'oferta_incluye', columna: 'incluye', rotulo: 'Incluye' },
  { clave: 'oferta_garantia', columna: 'garantia', rotulo: 'Garantía' },
] as const;

export const ROTULO_BRIEF: Record<string, string> =
  Object.fromEntries(CAMPOS_BRIEF.map((c) => [c.clave, c.rotulo]));

/**
 * Los 5 campos ya resueltos, vengan de donde vengan.
 *
 * `precio` es TEXTO y no un número: medido en prod el 26/09, `oferta_ticket` es
 * texto libre en 4 de los 6 workspaces que lo tienen («Entre USD 5.000 y USD
 * 10.000», «800 MXN/mes», «2000 a 10000»). El `parseFloat` de
 * `seedProductosDesdeOferta` ya devuelve NaN ahí y el producto id=1 del ws1 quedó
 * con `monto_usd` NULL. Un número que se parsea de una frase es un número inventado.
 */
export type CamposOferta = {
  nombre: string;
  precio: string;
  promesa: string;
  incluye: string;
  garantia: string;
};

/**
 * De dónde salió lo que estás leyendo:
 *
 *  · `declarado` — hay una fila de `ofertas` con sus campos propios.
 *  · `brief`     — hay fila, con `desde_brief`: el valor vive en el blob.
 *  · `sin-fila`  — todavía no se sembró la oferta (o se borró). Los campos SIGUEN
 *                  saliendo del blob: es exactamente lo que pasa hoy, y por eso
 *                  mientras nadie declare una oferta nada cambia de comportamiento.
 *
 * ⚠️ `sin-fila` NO significa «vacío». Es el mismo escalón que costó el `origen` de
 * los funnels: una fila con `data = '{}'` es truthy en JS y convertía a tres
 * workspaces de «no declaró nada» a «declaró el genérico», sin log.
 */
export type OrigenOferta = 'declarado' | 'brief' | 'sin-fila';

export type OfertaPrincipal = {
  origen: OrigenOferta;
  /** La fila, si existe. `null` con `sin-fila`. */
  oferta: Oferta | null;
  campos: CamposOferta;
};

const txt = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const nOrNull = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) { const n = Number(v); return Number.isFinite(n) ? n : null; }
  return null;
};

/** Sanea `bonos` (jsonb). Lo que no se nombre acá se pierde en la próxima escritura. */
export function parseBonos(v: unknown): Bono[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      return { nombre: txt(o.nombre), valor_usd: nOrNull(o.valor_usd), porque: txt(o.porque) };
    })
    .filter((b) => b.nombre)
    .slice(0, 8);
}

/** Fila cruda de Supabase → `Oferta`, con los jsonb y los enums saneados. */
export function filaAOferta(fila: Record<string, unknown>): Oferta {
  const ut = fila.urgencia_tipo;
  return {
    id: Number(fila.id),
    nombre: txt(fila.nombre),
    precio_usd: nOrNull(fila.precio_usd),
    modelo: esModeloOferta(fila.modelo) ? fila.modelo : null,
    precio_nota: txt(fila.precio_nota) || null,
    promesa: txt(fila.promesa) || null,
    incluye: txt(fila.incluye) || null,
    garantia: txt(fila.garantia) || null,
    bonos: parseBonos(fila.bonos),
    urgencia_tipo: esUrgenciaTipo(ut) ? ut : null,
    urgencia_dato: txt(fila.urgencia_dato) || null,
    urgencia_razon: txt(fila.urgencia_razon) || null,
    urgencia_hasta: txt(fila.urgencia_hasta).slice(0, 10) || null,
    para_quien: txt(fila.para_quien) || null,
    objeciones: txt(fila.objeciones) || null,
    prueba: txt(fila.prueba) || null,
    desde_brief: fila.desde_brief === true,
    es_principal: fila.es_principal === true,
    activa: fila.activa !== false,
    orden: Number(fila.orden ?? 0) || 0,
    origen: txt(fila.origen) || 'manual',
  };
}

/** El precio, como se PRESENTA. La nota gana: «2 pagos de 2.500» dice más que 5000. */
export function precioTexto(o: Oferta): string {
  if (o.precio_nota) return o.precio_nota;
  return o.precio_usd != null ? `USD ${o.precio_usd.toLocaleString('en-US')}` : '';
}

/**
 * LA REGLA: de dónde sale cada uno de los 5 campos.
 *
 * Con `desde_brief` el valor vive en el blob y la columna queda NULL — NUNCA se
 * copia. Sin `desde_brief`, un NULL significa «no lo cargaron» y NO cae al brief:
 * si cayera, una oferta nueva vacía heredaría la promesa de la principal y ningún
 * prompt podría distinguirlas.
 */
export function resolverOfertaPrincipal(
  fila: Oferta | null,
  answers: Record<string, string>,
): OfertaPrincipal {
  const delBrief = (clave: string) => (answers[clave] ?? '').trim();
  const camposDelBrief = (): CamposOferta => ({
    nombre: delBrief('oferta_nombre'),
    precio: delBrief('oferta_ticket'),
    promesa: delBrief('oferta_promesa'),
    incluye: delBrief('oferta_incluye'),
    garantia: delBrief('oferta_garantia'),
  });

  if (!fila) return { origen: 'sin-fila', oferta: null, campos: camposDelBrief() };

  if (fila.desde_brief) {
    // El NOMBRE es la excepción, y no por capricho: es NOT NULL en la tabla y es la
    // llave del índice único por workspace, así que la fila siempre lo tiene. Si el
    // dueño lo renombró en la fila, ese es el nombre; si no, el del brief.
    const b = camposDelBrief();
    return { origen: 'brief', oferta: fila, campos: { ...b, nombre: fila.nombre || b.nombre } };
  }

  return {
    origen: 'declarado',
    oferta: fila,
    campos: {
      nombre: fila.nombre,
      precio: precioTexto(fila),
      promesa: fila.promesa ?? '',
      incluye: fila.incluye ?? '',
      garantia: fila.garantia ?? '',
    },
  };
}

/**
 * El grupo `oferta` para los prompts, con RÓTULOS y no con las preguntas del
 * formulario. Devuelve '' si no hay nada: un campo vacío no se inyecta (la regla
 * aditiva del brief).
 */
export function ofertaTextoCorto(campos: CamposOferta): string {
  const partes = CAMPOS_BRIEF
    .map(({ clave, rotulo }) => {
      const v = campos[({
        oferta_nombre: 'nombre', oferta_ticket: 'precio', oferta_promesa: 'promesa',
        oferta_incluye: 'incluye', oferta_garantia: 'garantia',
      } as const)[clave]];
      return v ? `${rotulo}: ${v}` : '';
    })
    .filter(Boolean);
  return partes.join(' · ');
}

/**
 * ¿La urgencia de esta oferta sigue siendo verdad HOY?
 *
 * Sólo se puede contestar con `urgencia_hasta`. Las otras tres formas (cupos,
 * capacidad, inicio sin fecha) las declara una persona y el sistema no las puede
 * verificar: ahí devuelve `null`, que NO es `false`. «No puedo comprobarlo» y
 * «venció» son dos cosas distintas, y confundirlas apagaría un ángulo legítimo.
 *
 * `hoy` entra por parámetro para que el test no dependa del reloj.
 *
 * ⚠️ LIMITACIÓN CONOCIDA: la comparación es en UTC (`toISOString`), y hoy el único
 * call-site pasa un `new Date()` del NAVEGADOR. Para un cliente en México
 * (UTC-6), desde las 18:00 locales el día UTC ya es el siguiente, así que una
 * urgencia que vence hoy se rotula «vencida» unas horas antes. No se arregla
 * pasando la fecha local del navegador —el negocio puede estar en otra zona que
 * quien mira— sino con `hoyDelWorkspace(ws)` (lib/api-mako/areas/crm.helpers.ts),
 * que es de dónde sale «hoy» en el resto del repo. Se deja anotado y no hecho
 * porque ese «hoy» es async y por-workspace, y este módulo es PURO a propósito:
 * la fecha tiene que seguir entrando por parámetro, resuelta por el llamador.
 */
export function urgenciaVigente(o: Pick<Oferta, 'urgencia_tipo' | 'urgencia_hasta'>, hoy: Date): boolean | null {
  if (!o.urgencia_tipo) return null;
  if (!o.urgencia_hasta) return null;
  const iso = hoy.toISOString().slice(0, 10);
  return o.urgencia_hasta >= iso;
}

/**
 * ¿Se le puede pedir a un writer que use la urgencia de esta oferta?
 *
 * Sí cuando está declarada Y no se pudo probar que venció. Es la condición que
 * el ángulo «Oferta directa (urgencia)» necesitaba y no tenía.
 */
export function urgenciaUsable(o: Pick<Oferta, 'urgencia_tipo' | 'urgencia_dato' | 'urgencia_hasta'>, hoy: Date): boolean {
  if (!o.urgencia_tipo || !(o.urgencia_dato ?? '').trim()) return false;
  return urgenciaVigente(o, hoy) !== false;
}

/** Cómo se lee una urgencia en pantalla. Vacío = no hay. */
export function urgenciaTexto(o: Pick<Oferta, 'urgencia_tipo' | 'urgencia_dato' | 'urgencia_hasta'>, hoy: Date): string {
  if (!o.urgencia_tipo) return '';
  const label = URGENCIAS.find((u) => u.id === o.urgencia_tipo)?.label ?? o.urgencia_tipo;
  const dato = (o.urgencia_dato ?? '').trim();
  const venc = urgenciaVigente(o, hoy) === false ? ' · vencida' : '';
  return `${label}${dato ? `: ${dato}` : ''}${venc}`;
}

// ── El saneo de lo que se guarda (la pantalla y la API de MaKo) ──────────────

/** Un número escrito por una persona. Mismo criterio que tenía la ruta: «5000 USD» → 5000. */
const numeroDeTexto = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) { const n = Number(v.replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : null; }
  return null;
};

/**
 * Una oferta escrita por una persona o por un agente, saneada. La MISMA para la pantalla (POST 'guardar' de
 * /api/onboarding/ofertas) y para la API de MaKo (`guardar_oferta`): vivía adentro de la ruta, y con dos copias la
 * API habría guardado una urgencia sin dato o una fecha que nadie puede comparar.
 *
 * Devuelve también lo que DESCARTÓ, con su motivo. La pantalla lo ignora (es lo que hacía la ruta); la API lo
 * rechaza: un agente que manda una fecha mal escrita tiene que enterarse, no verla desaparecer.
 *
 * `modelo` sólo se escribe si viene uno válido. La pantalla manda la oferta entera, con el modelo que tenía al cargar:
 * la ruta se lo saca antes (`ofertaDeLaPantalla`), así no pisa el que puso la ficha del lead o la API.
 */
export function sanearOfertaInput(o: Record<string, unknown>):
  { ok: true; input: OfertaInput; descartado: string[] } | { ok: false; error: string } {
  const nombre = txt(o.nombre);
  if (!nombre) return { ok: false, error: 'La oferta necesita un nombre.' };
  const descartado: string[] = [];
  const ut = esUrgenciaTipo(o.urgencia_tipo) ? o.urgencia_tipo : null;
  // Sin dato concreto no hay urgencia: un tipo suelto pinta una restricción que no dice nada y nadie puede verificar.
  const udato = ut ? txt(o.urgencia_dato) : '';
  if (ut && !udato) descartado.push('la urgencia sin su dato concreto (urgencia_dato)');
  const hastaCrudo = txt(o.urgencia_hasta);
  // `YYYY-MM-DD` o nada: una fecha mal formada es un dato que después nadie puede comparar.
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(hastaCrudo) ? hastaCrudo : null;
  if (udato && hastaCrudo && !hasta) descartado.push(`la fecha «${hastaCrudo}» (va como AAAA-MM-DD)`);
  return {
    ok: true,
    descartado,
    input: {
      nombre,
      precio_usd: numeroDeTexto(o.precio_usd),
      ...(esModeloOferta(o.modelo) ? { modelo: o.modelo } : {}),
      precio_nota: txt(o.precio_nota) || null,
      promesa: txt(o.promesa) || null,
      incluye: txt(o.incluye) || null,
      garantia: txt(o.garantia) || null,
      para_quien: txt(o.para_quien) || null,
      objeciones: txt(o.objeciones) || null,
      prueba: txt(o.prueba) || null,
      bonos: parseBonos(o.bonos),
      urgencia_tipo: udato ? ut : null,
      urgencia_dato: udato || null,
      urgencia_razon: udato ? (txt(o.urgencia_razon) || null) : null,
      urgencia_hasta: udato ? hasta : null,
      activa: o.activa === false ? false : true,
    },
  };
}

/** Una oferta guardada, en la forma que recibe `sanearOfertaInput` (para editar una parte sin borrar el resto). */
export function cuerpoDeOferta(o: Oferta): Record<string, unknown> {
  return {
    nombre: o.nombre, precio_usd: o.precio_usd, modelo: o.modelo ?? null, precio_nota: o.precio_nota,
    promesa: o.promesa, incluye: o.incluye, garantia: o.garantia, para_quien: o.para_quien,
    objeciones: o.objeciones, prueba: o.prueba, bonos: o.bonos,
    urgencia_tipo: o.urgencia_tipo, urgencia_dato: o.urgencia_dato, urgencia_razon: o.urgencia_razon,
    urgencia_hasta: o.urgencia_hasta, activa: o.activa,
  };
}

/**
 * Lo que queda de una oferta después de un cambio PARCIAL: lo que no viene en `cambios` conserva su valor, y el
 * resultado pasa por el mismo saneo. Sin oferta (`null`), es una nueva. Lo usa la API de MaKo al proponer Y al
 * confirmar: entre los dos momentos alguien pudo editar la oferta en la pantalla, y lo suyo no se pisa con una foto.
 */
export function ofertaConCambios(actual: Oferta | null, cambios: Record<string, unknown>):
  ReturnType<typeof sanearOfertaInput> {
  return sanearOfertaInput({ ...(actual ? cuerpoDeOferta(actual) : {}), ...cambios });
}

/** El nombre como lo compara el índice único de `ofertas` (`lower(btrim(nombre))`, mig 0169). */
export const nombreDeOfertaComparable = (v: string): string => v.trim().toLowerCase();

/**
 * Lo que guarda la PANTALLA de ofertas (POST 'guardar' de /api/onboarding/ofertas), sin `modelo`. La pantalla manda la
 * oferta ENTERA con el modelo que tenía al cargarla (`guardarCampo` en app/onboarding/OfertasView.tsx hace
 * `{ ...o, ...patch }`): sin esto, cada campo que se guardaba ahí volvía a escribir ese modelo y pisaba el que la ficha
 * del lead o la API habían cambiado con la pestaña abierta. Antes de que el saneo se mudara a este módulo, la ruta no lo
 * escribía nunca (revisión del 23/10/2026).
 */
export function ofertaDeLaPantalla(o: Record<string, unknown>): Record<string, unknown> {
  const resto = { ...o };
  delete resto.modelo;
  return resto;
}

/** Los campos de una oferta que se cambian desde afuera (la API de MaKo, `guardar_oferta`): los de su def. */
export const CAMPOS_OFERTA_EDITABLES = [
  'nombre', 'modelo', 'precio_usd', 'precio_nota', 'promesa', 'incluye', 'garantia', 'para_quien', 'objeciones',
  'prueba', 'bonos', 'urgencia_tipo', 'urgencia_dato', 'urgencia_razon', 'urgencia_hasta', 'activa',
] as const;

/** Los datos de una urgencia que no valen sin su tipo. */
const URGENCIA_SIN_TIPO = ['urgencia_dato', 'urgencia_razon', 'urgencia_hasta'] as const;

export type PlanDeOferta =
  | { error: string; faltan?: string[]; yaEstaba?: true }
  | { actual: Oferta | null; resultado: OfertaInput; cambios: Record<string, unknown> };

/**
 * Qué oferta toca un pedido de AFUERA (la API de MaKo) y cómo queda. Corre al proponer Y al confirmar: entre los dos
 * momentos alguien pudo crear o editar ofertas en la pantalla. Las reglas, todas medidas en la revisión del 23/10/2026:
 *   · con id, ésa. Se le puede cambiar el nombre si no lo usa otra.
 *   · SIN id, SIEMPRE una nueva, y un nombre que ya existe contesta su id. Antes el nombre era la llave: en
 *     /mako/revisar el nombre se puede editar, así que corregirlo cambiaba QUÉ oferta se tocaba (una propuesta que
 *     decía «Crear» pisaba otra que ya existía, y una que decía «Editar» creaba una nueva).
 *   · lo que no viene conserva su valor (`ofertaConCambios`); «ninguna» quita la urgencia entera.
 *   · un dato de la urgencia sin su tipo se rechaza: el saneo lo descartaba sin decirlo y la respuesta era «actualizada».
 *   · se rechaza sólo lo que descarta el CAMBIO: una fila vieja con una urgencia incompleta no frena un cambio de precio.
 *   · igual a lo que ya hay → `yaEstaba` (por HTTP, un 200 sin cambios; por chat, «ya está así»).
 */
export function planDeOferta(ofertas: readonly Oferta[], input: Record<string, unknown>): PlanDeOferta {
  const cambios: Record<string, unknown> = {};
  for (const k of CAMPOS_OFERTA_EDITABLES) if (input[k] !== undefined) cambios[k] = input[k];
  const mismo = (a: string, b: string) => nombreDeOfertaComparable(a) === nombreDeOfertaComparable(b);
  const id = typeof input.id === 'number' && Number.isInteger(input.id) && input.id > 0 ? input.id : null;
  let actual: Oferta | null = null;
  if (id != null) {
    actual = ofertas.find((o) => o.id === id) ?? null;
    if (!actual) return { error: `No existe la oferta #${id} en este negocio. Pide la lista con listar_ofertas.` };
    const nuevo = typeof cambios.nombre === 'string' ? cambios.nombre : null;
    if (nuevo != null && mismo(nuevo, actual.nombre)) delete cambios.nombre;
    else if (nuevo != null) {
      const otra = ofertas.find((o) => o.id !== id && mismo(o.nombre, nuevo));
      if (otra) return { error: `Ya hay otra oferta que se llama «${otra.nombre}» (#${otra.id}). Elige otro nombre o edita esa.` };
    }
    if (!Object.keys(cambios).length) return { error: `No viene ningún dato para cambiar en «${actual.nombre}».`, faltan: [...CAMPOS_OFERTA_EDITABLES] };
  } else {
    const nombre = typeof cambios.nombre === 'string' ? cambios.nombre.trim() : '';
    if (!nombre) return { error: 'Sin id se crea una oferta nueva, y hace falta su nombre.', faltan: ['nombre'] };
    const ya = ofertas.find((o) => mismo(o.nombre, nombre));
    if (ya) return { error: `Ya existe la oferta «${ya.nombre}» (#${ya.id}). Para editarla, pasa id ${ya.id}.` };
  }
  if (cambios.urgencia_tipo !== undefined && !esUrgenciaTipo(cambios.urgencia_tipo)) {
    for (const k of URGENCIA_SIN_TIPO) delete cambios[k]; // «ninguna»: lo que venga con ella no tiene a qué pegarse
  }
  const r = ofertaConCambios(actual, cambios);
  if (!r.ok) return { error: r.error };
  const sueltos = URGENCIA_SIN_TIPO.filter((k) => (typeof cambios[k] === 'string' ? (cambios[k] as string).trim() !== '' : cambios[k] != null));
  if (sueltos.length && !r.input.urgencia_tipo) {
    return { error: `Sin el tipo de urgencia (urgencia_tipo) no se guarda ${sueltos.join(', ')}.` };
  }
  const antes = actual ? ofertaConCambios(actual, {}) : null;
  const yaDescartado = antes?.ok ? antes.descartado : [];
  const nuevos = r.descartado.filter((d) => !yaDescartado.includes(d));
  if (nuevos.length) return { error: `Así no se puede guardar: ${nuevos.join('; ')}.` };
  // Sobre una fila vieja que el saneo arregla (una urgencia sin su dato), escribir SÍ cambia algo: no es «ya está así».
  if (actual && antes?.ok && !antes.descartado.length && JSON.stringify(antes.input) === JSON.stringify(r.input)) {
    return { error: `«${actual.nombre}» ya está así.`, yaEstaba: true };
  }
  return { actual, resultado: r.input, cambios };
}
