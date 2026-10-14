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
