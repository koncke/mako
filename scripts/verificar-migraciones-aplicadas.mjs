#!/usr/bin/env node
// =============================================================================
// verificar-migraciones-aplicadas.mjs — ¿lo que crean las migraciones del repo EXISTE en la base? (sólo lectura)
// =============================================================================
// Uso:  node --env-file=C:/dev/mako-api/.env.local scripts/verificar-migraciones-aplicadas.mjs [--json salida.json] [--detalle] [--desde 0200]
//
// POR QUÉ (21/10/2026): la 0283 (`workspaces.mfa_obligatorio_desde`) NUNCA se había aplicado en producción —la REST daba 42703 «column does not exist»— y nadie lo sabía: el código la lee con
// tolerancia a que falte (a propósito, para que el orden de despliegue no importe), así que no se rompe, sólo NO RIGE lo que la columna habilita. `scripts/apply-migration.mjs` ejecuta el
// archivo y no deja registro de qué corrió: no hay una tabla de migraciones. Si faltó una, puede haber faltado OTRA. Esta es la comprobación de las demás.
//
// QUÉ HACE: lee TODAS las migraciones en orden y lleva el estado de lo que crean y borran —tablas, columnas, índices, funciones (por nombre y cantidad de argumentos), vistas, triggers, políticas
// (RLS), tipos, extensiones, secuencias, restricciones con nombre, esquemas, `enable row level security` y buckets de storage—: lo que una migración posterior borra o renombra ya no se espera. Después
// pregunta al catálogo de Postgres (pg_class, pg_attribute, pg_proc, pg_trigger, pg_policy, pg_type, pg_extension, pg_constraint, pg_namespace, storage.buckets) qué hay y lista, POR MIGRACIÓN,
// lo que falta. Una migración con TODO ausente es una migración que no se aplicó; con algo ausente, una aplicada a medias (o pisada por una posterior que no se leyó: se mira a mano).
//
// SÓLO LECTURA, por construcción: una transacción `read only` (Postgres rechaza cualquier escritura), con `statement_timeout` de 20 s. Sólo lee el CATÁLOGO (nombres de tablas, columnas, funciones…)
// y los ids de los buckets: no toca filas de clientes. No imprime la URL de conexión.
//
// LO QUE NO MIRA (y lo dice al final, no lo esconde): los datos que una migración inserta o actualiza (`insert into`, `update`), los `grant`/`revoke` (eso lo mide
// scripts/medir-funciones-publicas.mjs), los `comment on`, el DDL armado con `execute format(...)` y lo que está adentro de un `DO` (ahí es CONDICIONAL —un `if not exists`— y si falta se
// marca «dudoso», no «falta»). Una sentencia de DDL que no entiende va a la lista «sin entender», con su migración.
// =============================================================================

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ID, ident, partirPrimerNivel, QNAME, sentencias, sinComentarios } from './sql-migraciones.mjs';

const ESQUEMA = 'public';
const qn = (esq, nombre) => ({ esq: esq ? ident(esq) : ESQUEMA, nombre: ident(nombre) });
const k = (tipo, ...partes) => `${tipo}:${partes.join('.')}`;
/** La clave de una función: esquema.nombre/cantidad de argumentos (las sobrecargas con otra cantidad son otra función). */
const kf = (esq, nombre, n) => `funcion:${esq}.${nombre}/${n}`;
const RE = (fuente, flags = 'i') => new RegExp(fuente, flags);

/** Lo que una sentencia de DDL hace al estado esperado. Se aplica en el orden de las migraciones. */
class Estado {
  constructor() {
    /** @type {Map<string, { tipo: string, nombre: string, migracion: string, condicional: boolean, extra?: any }>} */
    this.vivos = new Map();
    /** @type {Map<string, { migracion: string }>} lo que alguna migración borró (y no se volvió a crear) */
    this.borrados = new Map();
    /** @type {Map<string, string[]>} migración → claves que crea (aunque después se borren) */
    this.creadasPor = new Map();
    this.migracion = '';
    this.condicional = false;
  }

  crear(tipo, nombre, clave, extra) {
    this.vivos.set(clave, { tipo, nombre, migracion: this.migracion, condicional: this.condicional, extra });
    this.borrados.delete(clave);
    if (!this.creadasPor.has(this.migracion)) this.creadasPor.set(this.migracion, []);
    this.creadasPor.get(this.migracion)?.push(clave);
  }

  borrar(clave) {
    if (this.vivos.has(clave)) this.vivos.delete(clave);
    this.borrados.set(clave, { migracion: this.migracion });
  }

  /** Saca algo de lo esperado SIN decir que se borró (un renombre, un `disable row level security`): lo que no existe más no es un «sobra». */
  quitar(clave) { this.vivos.delete(clave); }

  renombrarClave(vieja, nueva) {
    const v = this.vivos.get(vieja);
    if (v) { this.vivos.delete(vieja); this.vivos.set(nueva, { ...v, nombre: nueva.slice(nueva.indexOf(':') + 1) }); }
    for (const claves of this.creadasPor.values()) { const i = claves.indexOf(vieja); if (i >= 0) claves[i] = nueva; }
  }

  /** Renombra una tabla y todo lo que cuelga de ella (columnas, triggers, políticas, restricciones, RLS, índices). */
  renombrarTabla(esq, viejo, nuevo) {
    const base = `${esq}.${viejo}`;
    for (const clave of [...this.vivos.keys()]) {
      const i = clave.indexOf(':');
      const tipo = clave.slice(0, i);
      const resto = clave.slice(i + 1);
      if (['tabla', 'columna', 'trigger', 'politica', 'restriccion', 'rls'].includes(tipo) && (resto === base || resto.startsWith(`${base}.`))) {
        this.renombrarClave(clave, `${tipo}:${esq}.${nuevo}${resto.slice(base.length)}`);
      }
      const v = this.vivos.get(clave);
      if (v?.tipo === 'indice' && v.extra?.tabla === base) v.extra = { ...v.extra, tabla: `${esq}.${nuevo}` };
    }
  }
}

/** Las acciones de un `alter table`: separadas por coma de primer nivel. */
function accionesDeAlterTable(cuerpo) { return partirPrimerNivel(cuerpo, ','); }

/** @param {Estado} e @param {string} s una sentencia sin comentarios */
function aplicarSentencia(e, s, sinEntender) {
  const t = s.replace(/\s+/g, ' ').trim();
  const baja = t.toLowerCase();
  let m;

  // ── create table ──────────────────────────────────────────────────────────
  if ((m = RE(`^create\\s+(?:(?:global\\s+|local\\s+)?(?:temp|temporary)\\s+|unlogged\\s+)?table\\s+(?:if\\s+not\\s+exists\\s+)?${QNAME}\\s*(\\(|as\\b|partition\\s+of\\b)`).exec(t))) {
    if (/^create\s+(?:global\s+|local\s+)?(?:temp|temporary)\b/i.test(t)) return;
    const { esq, nombre } = qn(m[1], m[2]);
    e.crear('tabla', `${esq}.${nombre}`, k('tabla', esq, nombre));
    if (m[3] === '(') {
      const ini = t.indexOf('(', m.index + m[0].length - 1);
      let prof = 0; let fin = -1;
      for (let i = ini; i < t.length; i++) { if (t[i] === '(') prof++; else if (t[i] === ')') { prof--; if (prof === 0) { fin = i; break; } } }
      if (fin > ini) {
        for (const item of partirPrimerNivel(t.slice(ini + 1, fin), ',')) {
          if (/^(constraint|primary|unique|check|foreign|exclude|like|period)\b/i.test(item)) {
            const c = RE(`^constraint\\s+(${ID})`).exec(item);
            if (c) e.crear('restriccion', `${esq}.${nombre}.${ident(c[1])}`, k('restriccion', esq, nombre, ident(c[1])));
            continue;
          }
          const col = RE(`^(${ID})\\s+\\S`).exec(item);
          if (col) e.crear('columna', `${esq}.${nombre}.${ident(col[1])}`, k('columna', esq, nombre, ident(col[1])));
        }
      }
    }
    return;
  }

  // ── alter table ───────────────────────────────────────────────────────────
  if ((m = RE(`^alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?${QNAME}\\s+(.*)$`).exec(t))) {
    const { esq, nombre } = qn(m[1], m[2]);
    const tabla = `${esq}.${nombre}`;
    for (const a of accionesDeAlterTable(m[3])) {
      let x;
      if ((x = RE(`^rename\\s+to\\s+(${ID})$`).exec(a))) { e.renombrarTabla(esq, nombre, ident(x[1])); continue; }
      if ((x = RE(`^rename\\s+(?:column\\s+)?(${ID})\\s+to\\s+(${ID})$`).exec(a))) {
        e.quitar(k('columna', esq, nombre, ident(x[1])));
        e.crear('columna', `${tabla}.${ident(x[2])}`, k('columna', esq, nombre, ident(x[2])));
        continue;
      }
      if ((x = RE(`^add\\s+constraint\\s+(${ID})`).exec(a))) { e.crear('restriccion', `${tabla}.${ident(x[1])}`, k('restriccion', esq, nombre, ident(x[1]))); continue; }
      if (/^add\s+(primary|unique|check|foreign|exclude)\b/i.test(a)) continue;
      if ((x = RE(`^add\\s+(?:column\\s+)?(?:if\\s+not\\s+exists\\s+)?(${ID})\\s+\\S`).exec(a))) { e.crear('columna', `${tabla}.${ident(x[1])}`, k('columna', esq, nombre, ident(x[1]))); continue; }
      if ((x = RE(`^drop\\s+constraint\\s+(?:if\\s+exists\\s+)?(${ID})`).exec(a))) { e.borrar(k('restriccion', esq, nombre, ident(x[1]))); continue; }
      if ((x = RE(`^drop\\s+(?:column\\s+)?(?:if\\s+exists\\s+)?(${ID})`).exec(a))) { e.borrar(k('columna', esq, nombre, ident(x[1]))); continue; }
      if (/^enable\s+row\s+level\s+security$/i.test(a)) { e.crear('rls', tabla, k('rls', esq, nombre)); continue; }
      if (/^disable\s+row\s+level\s+security$/i.test(a)) { e.quitar(k('rls', esq, nombre)); continue; }
      // alter column / set / owner / force rls / validate / replica identity / etc.: no cambian lo que existe.
    }
    return;
  }

  // ── drop table ────────────────────────────────────────────────────────────
  if ((m = RE(`^drop\\s+table\\s+(?:if\\s+exists\\s+)?(.*?)(?:\\s+(?:cascade|restrict))?$`).exec(t))) {
    for (const item of partirPrimerNivel(m[1], ',')) {
      const q = RE(`^${QNAME}$`).exec(item.trim());
      if (!q) { sinEntender.push([e.migracion, t]); continue; }
      const { esq, nombre } = qn(q[1], q[2]);
      for (const clave of [...e.vivos.keys()]) {
        const resto = clave.slice(clave.indexOf(':'));
        const v = e.vivos.get(clave);
        if (resto === `:${esq}.${nombre}` || resto.startsWith(`:${esq}.${nombre}.`) || (v?.tipo === 'indice' && v.extra?.tabla === `${esq}.${nombre}`)) { e.vivos.delete(clave); }
      }
      e.borrados.set(k('tabla', esq, nombre), { migracion: e.migracion });
    }
    return;
  }

  // ── índices ───────────────────────────────────────────────────────────────
  if ((m = RE(`^create\\s+(?:unique\\s+)?index\\s+(?:concurrently\\s+)?(?:if\\s+not\\s+exists\\s+)?(${ID})\\s+on\\s+(?:only\\s+)?${QNAME}`).exec(t))) {
    const tabla = qn(m[2], m[3]);
    e.crear('indice', `${tabla.esq}.${ident(m[1])}`, k('indice', tabla.esq, ident(m[1])), { tabla: `${tabla.esq}.${tabla.nombre}` });
    return;
  }
  if ((m = RE('^drop\\s+index\\s+(?:concurrently\\s+)?(?:if\\s+exists\\s+)?(.*?)(?:\\s+(?:cascade|restrict))?$').exec(t))) {
    for (const item of partirPrimerNivel(m[1], ',')) {
      const q = RE(`^${QNAME}$`).exec(item.trim());
      if (!q) { sinEntender.push([e.migracion, t]); continue; }
      const { esq, nombre } = qn(q[1], q[2]);
      e.borrar(k('indice', esq, nombre));
    }
    return;
  }

  // ── funciones y procedimientos ────────────────────────────────────────────
  if ((m = RE(`^create\\s+(?:or\\s+replace\\s+)?(?:function|procedure)\\s+${QNAME}\\s*\\(`).exec(t))) {
    const { esq, nombre } = qn(m[1], m[2]);
    const ini = t.indexOf('(', m.index + m[0].length - 1);
    let prof = 0; let fin = -1;
    for (let i = ini; i < t.length; i++) { if (t[i] === '(') prof++; else if (t[i] === ')') { prof--; if (prof === 0) { fin = i; break; } } }
    const args = fin > ini ? partirPrimerNivel(t.slice(ini + 1, fin), ',') : [];
    // `returns table (…)` y los argumentos OUT no cuentan en pronargs (sí los INOUT/IN): se descartan los OUT.
    const n = args.filter((a) => !/^out\s/i.test(a)).length;
    e.crear('funcion', `${esq}.${nombre}(${n})`, kf(esq, nombre, n), { nargs: n });
    return;
  }
  if ((m = RE('^drop\\s+(?:function|procedure|routine)\\s+(?:if\\s+exists\\s+)?(.*?)(?:\\s+(?:cascade|restrict))?$').exec(t))) {
    for (const item of partirPrimerNivel(m[1], ',')) {
      const q = RE(`^${QNAME}\\s*(?:\\((.*)\\))?$`).exec(item.trim());
      if (!q) { sinEntender.push([e.migracion, t]); continue; }
      const { esq, nombre } = qn(q[1], q[2]);
      if (q[3] === undefined) { for (const c of [...e.vivos.keys()]) if (c.startsWith(`funcion:${esq}.${nombre}/`)) e.borrar(c); continue; }
      const args = q[3].trim() ? partirPrimerNivel(q[3], ',').filter((a) => !/^out\s/i.test(a)) : [];
      e.borrar(kf(esq, nombre, args.length));
    }
    return;
  }

  // ── vistas ────────────────────────────────────────────────────────────────
  if ((m = RE(`^create\\s+(?:or\\s+replace\\s+)?(?:materialized\\s+|recursive\\s+)?view\\s+(?:if\\s+not\\s+exists\\s+)?${QNAME}`).exec(t))) {
    const { esq, nombre } = qn(m[1], m[2]);
    e.crear('vista', `${esq}.${nombre}`, k('vista', esq, nombre));
    return;
  }
  if ((m = RE('^drop\\s+(?:materialized\\s+)?view\\s+(?:if\\s+exists\\s+)?(.*?)(?:\\s+(?:cascade|restrict))?$').exec(t))) {
    for (const item of partirPrimerNivel(m[1], ',')) {
      const q = RE(`^${QNAME}$`).exec(item.trim());
      if (!q) { sinEntender.push([e.migracion, t]); continue; }
      const { esq, nombre } = qn(q[1], q[2]);
      e.borrar(k('vista', esq, nombre));
    }
    return;
  }

  // ── triggers ──────────────────────────────────────────────────────────────
  if ((m = RE(`^create\\s+(?:or\\s+replace\\s+)?(?:constraint\\s+)?trigger\\s+(${ID})\\b.*?\\son\\s+${QNAME}`).exec(t))) {
    const tabla = qn(m[2], m[3]);
    e.crear('trigger', `${tabla.esq}.${tabla.nombre}.${ident(m[1])}`, k('trigger', tabla.esq, tabla.nombre, ident(m[1])));
    return;
  }
  if ((m = RE(`^drop\\s+trigger\\s+(?:if\\s+exists\\s+)?(${ID})\\s+on\\s+${QNAME}`).exec(t))) {
    const tabla = qn(m[2], m[3]);
    e.borrar(k('trigger', tabla.esq, tabla.nombre, ident(m[1])));
    return;
  }

  // ── políticas (RLS) ───────────────────────────────────────────────────────
  if ((m = RE(`^create\\s+policy\\s+(${ID})\\s+on\\s+${QNAME}`).exec(t))) {
    const tabla = qn(m[2], m[3]);
    e.crear('politica', `${tabla.esq}.${tabla.nombre}.${ident(m[1])}`, k('politica', tabla.esq, tabla.nombre, ident(m[1])));
    return;
  }
  if ((m = RE(`^drop\\s+policy\\s+(?:if\\s+exists\\s+)?(${ID})\\s+on\\s+${QNAME}`).exec(t))) {
    const tabla = qn(m[2], m[3]);
    e.borrar(k('politica', tabla.esq, tabla.nombre, ident(m[1])));
    return;
  }

  // ── tipos, extensiones, secuencias, esquemas ──────────────────────────────
  if ((m = RE(`^create\\s+(?:type|domain)\\s+${QNAME}`).exec(t))) {
    const { esq, nombre } = qn(m[1], m[2]);
    e.crear('tipo', `${esq}.${nombre}`, k('tipo', esq, nombre));
    return;
  }
  if ((m = RE(`^drop\\s+(?:type|domain)\\s+(?:if\\s+exists\\s+)?${QNAME}`).exec(t))) {
    const { esq, nombre } = qn(m[1], m[2]);
    e.borrar(k('tipo', esq, nombre));
    return;
  }
  if ((m = RE(`^create\\s+extension\\s+(?:if\\s+not\\s+exists\\s+)?(${ID})`).exec(t))) { e.crear('extension', ident(m[1]), k('extension', ident(m[1]))); return; }
  if ((m = RE(`^drop\\s+extension\\s+(?:if\\s+exists\\s+)?(${ID})`).exec(t))) { e.borrar(k('extension', ident(m[1]))); return; }
  if ((m = RE(`^create\\s+sequence\\s+(?:if\\s+not\\s+exists\\s+)?${QNAME}`).exec(t))) {
    const { esq, nombre } = qn(m[1], m[2]);
    e.crear('secuencia', `${esq}.${nombre}`, k('secuencia', esq, nombre));
    return;
  }
  if ((m = RE(`^drop\\s+sequence\\s+(?:if\\s+exists\\s+)?${QNAME}`).exec(t))) {
    const { esq, nombre } = qn(m[1], m[2]);
    e.borrar(k('secuencia', esq, nombre));
    return;
  }
  if ((m = RE(`^create\\s+schema\\s+(?:if\\s+not\\s+exists\\s+)?(${ID})`).exec(t))) { e.crear('esquema', ident(m[1]), k('esquema', ident(m[1]))); return; }

  // ── buckets de storage (los ids) ──────────────────────────────────────────
  if ((m = RE("^insert\\s+into\\s+storage\\.buckets\\s*\\(([^)]*)\\)\\s*values\\s*\\(\\s*'([^']+)'").exec(t)) && /^\s*id\b/i.test(m[1])) {
    e.crear('bucket', m[2], k('bucket', m[2]));
    return;
  }

  // ── lo que no cambia lo que existe, o no se mira ──────────────────────────
  if (/^(comment|grant|revoke|notify|insert|update|delete|begin|commit|rollback|set|reset|select|alter\s+default\s+privileges|alter\s+(?:function|procedure|routine|view|materialized\s+view|sequence|type|schema|extension|policy|index|trigger|role|database|publication)\b|truncate|analyze|vacuum|create\s+(?:role|publication|subscription|cast|operator|collation|aggregate|rule|event\s+trigger)|drop\s+(?:role|schema|publication|rule|cast|operator|owned|aggregate)|with\b|do\b|execute\b|lock\b|cluster\b|reindex\b|refresh\b|declare\b|call\b|values\b)/i.test(t)) return;
  if (/^(create|alter|drop)\b/i.test(t)) sinEntender.push([e.migracion, t]);
}

/** Dentro de un `DO $$ … $$`: el DDL que aparece (condicional: depende de un `if`). El `execute format(...)` no se lee. */
function ddlDeUnDo(cuerpoDo) {
  const m = /^do\s+(?:language\s+\w+\s+)?(\$[a-zA-Z_]*\$)([\s\S]*)\1\s*(?:language\s+\w+)?$/i.exec(cuerpoDo.trim());
  if (!m) return [];
  const sub = sentencias(m[2].replace(/\bend\s+if\b/gi, ';').replace(/\bthen\b/gi, ';').replace(/\belse\b/gi, ';').replace(/\bloop\b/gi, ';').replace(/\bbegin\b/gi, ';').replace(/\bend\b/gi, ';'));
  return sub.filter((x) => /^(create|alter|drop)\s/i.test(x.trim()));
}

/**
 * Lee las migraciones EN ORDEN y devuelve lo que se espera que exista, lo que se borró, qué crea cada migración y qué DDL no entendió.
 * @param {{ nombre: string, sql: string }[]} migraciones
 */
export function analizarMigraciones(migraciones) {
  const e = new Estado();
  /** @type {[string, string][]} */
  const sinEntender = [];
  /** @type {Map<string, number>} */
  const sinMirar = new Map();
  for (const mig of [...migraciones].sort((a, b) => (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0))) {
    e.migracion = mig.nombre;
    for (const s of sentencias(sinComentarios(mig.sql))) {
      e.condicional = false;
      if (/^do\b/i.test(s.trim())) {
        e.condicional = true;
        for (const interno of ddlDeUnDo(s)) aplicarSentencia(e, interno, sinEntender);
        e.condicional = false;
        sinMirar.set(mig.nombre, (sinMirar.get(mig.nombre) ?? 0) + 1);
        continue;
      }
      if (/^(insert|update|delete)\b/i.test(s.trim()) && !/^insert\s+into\s+storage\.buckets/i.test(s.trim())) sinMirar.set(mig.nombre, (sinMirar.get(mig.nombre) ?? 0) + 1);
      aplicarSentencia(e, s, sinEntender);
    }
  }
  return { vivos: e.vivos, borrados: e.borrados, creadasPor: e.creadasPor, sinEntender, sinMirar };
}

/**
 * Lo que dice el catálogo, como conjuntos de claves (las mismas del analizador). `consulta(texto)` devuelve las filas: con `postgres`, `tx.unsafe`; con PGlite, `db.query`.
 * Las funciones van por nombre y cantidad de argumentos (sin los OUT); los buckets son opcionales (si `storage.buckets` no se puede leer, no se verifican).
 * @param {(texto: string) => Promise<any[]>} consulta
 */
export async function leerCatalogo(consulta) {
  const noSistema = "n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast') and n.nspname not like 'pg\\_temp\\_%' and n.nspname not like 'pg\\_toast\\_temp\\_%'";
  const claves = new Set();
  const poner = (c) => claves.add(c);
  for (const r of await consulta(`select n.nspname as e, c.relname as n, c.relkind as t, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid = c.relnamespace where ${noSistema} and c.relkind in ('r','p','v','m','S','i','I')`)) {
    if (r.t === 'r' || r.t === 'p') poner(k('tabla', r.e, r.n));
    if (r.t === 'v' || r.t === 'm') poner(k('vista', r.e, r.n));
    if (r.t === 'S') poner(k('secuencia', r.e, r.n));
    if (r.t === 'i' || r.t === 'I') poner(k('indice', r.e, r.n));
    if (r.rls) poner(k('rls', r.e, r.n));
  }
  for (const r of await consulta(`select n.nspname as e, c.relname as t, a.attname as c from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace where ${noSistema} and a.attnum > 0 and not a.attisdropped and c.relkind in ('r','p','v','m')`)) poner(k('columna', r.e, r.t, r.c));
  for (const r of await consulta(`select n.nspname as e, p.proname as n, p.pronargs::int as a, p.proargmodes::text as m from pg_proc p join pg_namespace n on n.oid = p.pronamespace where ${noSistema}`)) {
    // pronargs cuenta IN, INOUT y VARIADIC; los OUT y TABLE no entran: el analizador tampoco los cuenta.
    poner(kf(r.e, r.n, r.a));
  }
  for (const r of await consulta(`select n.nspname as e, c.relname as t, g.tgname as n from pg_trigger g join pg_class c on c.oid = g.tgrelid join pg_namespace n on n.oid = c.relnamespace where not g.tgisinternal and ${noSistema}`)) poner(k('trigger', r.e, r.t, r.n));
  for (const r of await consulta('select schemaname as e, tablename as t, policyname as n from pg_policies')) poner(k('politica', r.e, r.t, r.n));
  for (const r of await consulta(`select n.nspname as e, t.typname as n from pg_type t join pg_namespace n on n.oid = t.typnamespace where ${noSistema} and t.typtype in ('e','c','d','b','r')`)) poner(k('tipo', r.e, r.n));
  for (const r of await consulta('select extname as n from pg_extension')) poner(k('extension', r.n));
  for (const r of await consulta(`select n.nspname as e, c.relname as t, o.conname as n from pg_constraint o join pg_class c on c.oid = o.conrelid join pg_namespace n on n.oid = c.relnamespace where ${noSistema}`)) poner(k('restriccion', r.e, r.t, r.n));
  for (const r of await consulta("select nspname as n from pg_namespace where nspname not like 'pg\\_%' and nspname <> 'information_schema'")) poner(k('esquema', r.n));
  let buckets = false;
  try { for (const r of await consulta('select id from storage.buckets')) { poner(k('bucket', r.id)); buckets = true; } } catch { /* sin storage */ }
  return { claves, buckets };
}

/**
 * Cruza lo esperado con lo que hay. `falta` = esperado y ausente (una migración posterior pudo reemplazarlo: se mira a mano); `dudoso` = esperado sólo por un `DO` condicional;
 * `sobra` = una migración lo borró y sigue ahí (la que lo borra no se aplicó).
 * @param {ReturnType<typeof analizarMigraciones>} an
 * @param {{ claves: Set<string>, buckets: boolean }} catalogo
 * @param {{ desde?: string }} [o]
 */
export function verificar(an, catalogo, { desde = '' } = {}) {
  const hay = (clave) => catalogo.claves.has(clave);
  const falta = [];
  const dudoso = [];
  for (const [clave, v] of an.vivos) {
    if (v.migracion < desde) continue;
    if (v.tipo === 'bucket' && !catalogo.buckets) continue;
    if (hay(clave)) continue;
    (v.condicional ? dudoso : falta).push({ clave, migracion: v.migracion, tipo: v.tipo, nombre: v.nombre });
  }
  const sobra = [];
  for (const [clave, v] of an.borrados) {
    if (v.migracion < desde) continue;
    if (/^(rls):/.test(clave)) continue;
    if (hay(clave)) sobra.push({ clave, migracion: v.migracion });
  }
  /** @type {{ nombre: string, estado: 'aplicada' | 'a-medias' | 'ausente' | 'sin-objetos', esperadas: number, faltan: string[] }[]} */
  const porMigracion = [];
  for (const [nombre, claves] of an.creadasPor) {
    if (nombre < desde) continue;
    // lo que ESA migración creó y sigue esperándose (no lo borró una posterior) y lo que falta de eso
    const vivas = [...new Set(claves)].filter((c) => an.vivos.get(c)?.migracion === nombre && !(an.vivos.get(c)?.condicional) && !(an.vivos.get(c)?.tipo === 'bucket' && !catalogo.buckets));
    const faltan = vivas.filter((c) => !hay(c));
    const estado = vivas.length === 0 ? 'sin-objetos' : faltan.length === 0 ? 'aplicada' : faltan.length === vivas.length ? 'ausente' : 'a-medias';
    porMigracion.push({ nombre, estado, esperadas: vivas.length, faltan });
  }
  porMigracion.sort((a, b) => (a.nombre < b.nombre ? -1 : 1));
  return { falta, dudoso, sobra, porMigracion };
}

/** El informe en texto: lo importante primero (las ausentes y las a medias), y lo que no se mira, dicho. */
export function formatear(an, r, { detalle = false } = {}) {
  const l = [];
  const ausentes = r.porMigracion.filter((m) => m.estado === 'ausente');
  const medias = r.porMigracion.filter((m) => m.estado === 'a-medias');
  const ok = r.porMigracion.filter((m) => m.estado === 'aplicada');
  l.push(`[verificar-migraciones] ${r.porMigracion.length} migraciones con objetos verificables: ${ok.length} aplicadas · ${medias.length} A MEDIAS · ${ausentes.length} AUSENTES (nada de lo que crean existe)`);
  if (ausentes.length) {
    l.push('', '== AUSENTES: no se aplicaron (o su efecto se borró) ==');
    for (const m of ausentes) l.push(`  ${m.nombre} — ${m.esperadas} objeto(s): ${m.faltan.slice(0, 6).join(', ')}${m.faltan.length > 6 ? '…' : ''}`);
  }
  if (medias.length) {
    l.push('', '== A MEDIAS: algo de lo que crean no está ==');
    for (const m of medias) l.push(`  ${m.nombre} — faltan ${m.faltan.length} de ${m.esperadas}: ${m.faltan.slice(0, 8).join(', ')}${m.faltan.length > 8 ? '…' : ''}`);
  }
  if (r.sobra.length) {
    l.push('', '== SOBRAN: una migración los borra y siguen ahí (esa migración no se aplicó) ==');
    for (const s of r.sobra) l.push(`  ${s.clave} — lo borra ${s.migracion}`);
  }
  if (r.dudoso.length) {
    l.push('', '== DUDOSOS: sólo los crea un DO condicional (un `if not exists`); su ausencia puede ser correcta ==');
    for (const d of r.dudoso.slice(0, detalle ? 999 : 15)) l.push(`  ${d.clave} — ${d.migracion}`);
    if (!detalle && r.dudoso.length > 15) l.push(`  …y ${r.dudoso.length - 15} más (--detalle)`);
  }
  l.push('', '== LO QUE NO SE MIRA ==');
  const datos = [...an.sinMirar.values()].reduce((a, n) => a + n, 0);
  l.push(`  ${datos} sentencias de datos (insert/update/delete) o bloques DO en ${an.sinMirar.size} migraciones: lo que una migración siembra (planes, plantillas, filas) no se verifica.`);
  l.push('  grant/revoke (lo mide scripts/medir-funciones-publicas.mjs), comment on, y el DDL armado con execute format().');
  if (an.sinEntender.length) {
    l.push('', `== DDL SIN ENTENDER (${an.sinEntender.length}): el analizador no sabe qué esperar de estas sentencias ==`);
    for (const [mig, s] of an.sinEntender.slice(0, detalle ? 999 : 20)) l.push(`  ${mig}: ${s.slice(0, 110)}`);
    if (!detalle && an.sinEntender.length > 20) l.push(`  …y ${an.sinEntender.length - 20} más (--detalle)`);
  }
  if (detalle) {
    l.push('', '== POR MIGRACIÓN ==');
    for (const m of r.porMigracion) l.push(`  ${m.estado.padEnd(11)} ${m.nombre} (${m.esperadas})`);
  }
  return l.join('\n');
}

async function main(argv) {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  const migraciones = readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => ({ nombre: f, sql: readFileSync(join(dir, f), 'utf8') }));
  const an = analizarMigraciones(migraciones);
  const iDesde = argv.indexOf('--desde');
  const desde = iDesde > 0 ? String(argv[iDesde + 1] ?? '') : '';
  const conn = process.env.DATABASE_URL;
  if (!conn) { console.error('Falta DATABASE_URL (corré con: node --env-file=C:/dev/mako-api/.env.local scripts/verificar-migraciones-aplicadas.mjs)'); return 1; }
  const { default: postgres } = await import('postgres');
  const sql = postgres(conn, { ssl: 'require', connect_timeout: 60, max: 1 });
  try {
    const catalogo = await sql.begin('read only', async (tx) => {
      await tx`set local statement_timeout = '20s'`;
      return leerCatalogo(async (texto) => [...(await tx.unsafe(texto))]);
    });
    const r = verificar(an, catalogo, { desde });
    console.log(`[verificar-migraciones] conexión OK · transacción de sólo lectura · ${catalogo.claves.size} objetos en el catálogo`);
    console.log(formatear(an, r, { detalle: argv.includes('--detalle') }));
    const iJson = argv.indexOf('--json');
    if (iJson > 0) writeFileSync(String(argv[iJson + 1]), JSON.stringify({ ...r, sinEntender: an.sinEntender }, null, 2));
    return r.porMigracion.some((m) => m.estado === 'ausente' || m.estado === 'a-medias') || r.sobra.length ? 2 : 0;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(`[verificar-migraciones] ${e?.stack ?? e}`); process.exit(3); });
}
