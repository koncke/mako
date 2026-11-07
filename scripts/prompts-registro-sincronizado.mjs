#!/usr/bin/env node
// =============================================================================
// prompts-registro-sincronizado — la guarda del registro de prompts (6/11/2026)
// =============================================================================
// «Todo prompt de MaKo es editable desde /configuraciones» no lo chequeaba NADIE:
// `lib/prompt-registry.ts` tiene 173 entradas, ninguna guarda del pre-push decía la
// palabra «prompt», y de los 2.307 archivos de tests/ cero recorrían el REGISTRY. El
// chequeo existía copiado A MANO y por feature —tests/offer-ia-cableado.test.ts lo hace
// bien para las 9 keys de `offer.*` listadas a mano, y closing-entrega, copywriter-ia,
// editor-landing-ia y closing-taxonomia hacen versiones parciales con su propia lista—,
// y una lista a mano no cubre lo que se agrega después: así entraron 29 prompts que la
// app usa y /configuraciones no muestra. El contexto completo, en docs/hallazgos-ia.md
// → «Ninguna guarda del pre-push mira el registro de prompts».
//
// Por qué el compilador no ve nada de esto:
//   · `getPromptText` hace `override ?? fallback`, así que una key FUERA del registro
//     funciona igual en runtime — sólo queda invisible en /configuraciones;
//   · `renderTemplate` reemplaza SÓLO los slots declarados (a propósito, anti-inyección:
//     lib/prompt-render-pure.ts), así que un `{{slot}}` que nadie llena viaja LITERAL al
//     modelo y una clave que el template no tiene se descarta sin decir nada.
//
// EJECUTA el registro en vez de regexearlo (AGENTS.md → «Un test nuevo ejecuta el
// código»): `lib/prompt-registry.ts` es `server-only`, y el marcador se neutraliza con el
// parche de `Module._load` (el molde es tests/alta-cliente.test.ts). Eso da `key`,
// `variables` y `default` como DATOS, no como texto, y por eso el cruce de slots es
// exacto y no una aproximación sobre el fuente.
//
// ⚠️ LA TRAMPA, y es por lo que un cruce ingenuo no sirve: muchas keys NO llegan como
// literal al call-site, sino por INDIRECCIÓN en tabla (`PROMPTS_CHAT_VIDEO.system.key`,
// `PROMPTS_EDITOR.esquemaUser.key`) o por constante (`CLAVE_PROMPT_EDITAR`). Cruzar el
// registro contra los literales del primer argumento da ~45 keys «sin call-site» que sí
// están cableadas, y una guarda así es ruido y se apaga. La salida NO es resolver el
// flujo de datos: es que **el literal está escrito en algún archivo de código igual**
// (en la tabla, en la constante, en un ternario), así que el cableado se mide buscando
// el literal en TODO el árbol. Medido el 6/11/2026: ese barrido deja 5 candidatos, no 45.
//
// Lo que BLOQUEA son las direcciones sin falsos positivos (hoy tres de ellas en 0).
// Lo único ruidoso —un slot que nadie llena— AVISA y deja pasar, porque `{{...}}` tiene
// DOS dueños: `renderTemplate` y los placeholders de lead/WhatsApp que el modelo tiene
// que copiar tal cual (`{{nombre}}`, `{{1}}`; lib/paso-ia.ts:31 lo dice al lado del
// prompt). Frenar por eso sería frenar por algo correcto. AGENTS.md → «Una guarda
// bloquea sólo lo que se arregla haciendo lo que ella pide».
//
// ⚠️ PROBADA ROMPIENDO LO QUE PERSIGUE (6/11/2026, arnés romper-todo.mjs en el scratchpad
// de la sesión, que restaura DE MEMORIA). La base en verde antes de cada rotura; **17
// roturas, las 17 cazadas**, y el árbol limpio después de cada una. Y un cambio SIN efecto
// (renombrar una variable local del call-site) la deja en verde, que es la otra mitad de la
// medición.
//
// Qué comprobó cada una: una key nueva fuera del registro · una Entry `override` que nadie
// nombra · una de las 29 ya registrada con la excepción sin sacar · una `campaign.*` cableada
// con la excepción sin sacar · un render que pasa una clave que el template no tiene · un
// slot declarado en `variables:` que no existe · un slot vivo con su `v()` borrada ·
// `setting.ensayo` declarando `escenario` con la excepción puesta · un primer argumento que
// no se puede seguir · un segundo argumento por variable y un spread en el objeto de vars
// (los dos se informan como NO medibles en vez de descontarse) · un `{{slot}}` nuevo que
// nadie llena y una excepción de LITERALES_CONOCIDOS vencida (los dos avisan sin bloquear) ·
// una `storeKey` que `MODOS` no tiene · un primer argumento con una COMA adentro
// (`renderPrompt(elegir(a, b), …)`: era un SILENCIO hasta que esta rotura lo encontró) · y
// una key nombrada en una bitácora, que no da opaca ni revive un prompt muerto.
//
// Uso:  node --import tsx scripts/prompts-registro-sincronizado.mjs [--listar]
//   (sin flags: silencio y exit 0 si está todo en orden; exit 1 con el detalle si no.
//    --listar imprime el estado completo sin juzgar nada, para ver qué hay.)
// =============================================================================

import Module from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const LISTAR = process.argv.includes('--listar');

// ── Las excepciones. Cada una con su MOTIVO y su FECHA, y la guarda falla si la lista
// CRECE o si una entrada ya no corresponde: así es un contador que sólo puede bajar, y no
// un cajón. Una key nueva acá se escribe a mano, que es justo el momento de preguntarse
// por qué no está en el registro. ───────────────────────────────────────────────────────

// Keys que la app PIDE y el registro no tiene (no editables en /configuraciones).
// Las 29 del 6/11/2026: registrarlas es otro ítem (cada una pide `label`, `context`,
// `scope` y `sensitive`, que son decisiones de producto que el dueño lee en la pantalla),
// y la guarda entra hoy porque es lo que impide que nazca la número 30.
const HUERFANAS_CONOCIDAS = {
  'archivero.preguntas.system': 'El Archivero: las preguntas que le hace a un documento. Pendiente de registrar (6/11/2026).',
  'avatares.system': 'Generador de avatares. Pendiente de registrar (6/11/2026).',
  'avatares.user': 'Generador de avatares. Pendiente de registrar (6/11/2026).',
  'avatares.siguiente.system': 'Avatares: el siguiente del catálogo. Pendiente de registrar (6/11/2026).',
  'avatares.siguiente.user': 'Avatares: el siguiente del catálogo. Pendiente de registrar (6/11/2026).',
  'chatagent.handoff': 'Chat Agent: el traspaso a una persona. Pendiente de registrar (6/11/2026).',
  'checklist.batch.system': 'Checklist por lotes. Pendiente de registrar (6/11/2026).',
  'checklist.batch.user': 'Checklist por lotes. Pendiente de registrar (6/11/2026).',
  'entregable.system': 'Entregables del servicio. Pendiente de registrar (6/11/2026).',
  'entregable.user': 'Entregables del servicio. Pendiente de registrar (6/11/2026).',
  'entregable.siguiente.system': 'Entregables: el siguiente. Pendiente de registrar (6/11/2026).',
  'entregable.siguiente.user': 'Entregables: el siguiente. Pendiente de registrar (6/11/2026).',
  'guardian.audiencia.system': 'Perro Guardián: la audiencia de una tarea. Pendiente de registrar (6/11/2026).',
  'guardian.audiencia.user': 'Perro Guardián: la audiencia de una tarea. Pendiente de registrar (6/11/2026).',
  'guardian.fecha-debate.system': 'Perro Guardián: el debate de la fecha. Pendiente de registrar (6/11/2026).',
  'guardian.fecha-debate.user': 'Perro Guardián: el debate de la fecha. Pendiente de registrar (6/11/2026).',
  'guardian.nuevas.system': 'Perro Guardián: tareas nuevas. Pendiente de registrar (6/11/2026).',
  'guardian.nuevas.user': 'Perro Guardián: tareas nuevas. Pendiente de registrar (6/11/2026).',
  'guardian.proyectos.system': 'Perro Guardián: reparto por proyecto. Pendiente de registrar (6/11/2026).',
  'guardian.proyectos.user': 'Perro Guardián: reparto por proyecto. Pendiente de registrar (6/11/2026).',
  'guardian.proy-nuevos.system': 'Perro Guardián: proyectos nuevos. Pendiente de registrar (6/11/2026).',
  'guardian.proy-nuevos.user': 'Perro Guardián: proyectos nuevos. Pendiente de registrar (6/11/2026).',
  'plan.seed.system': 'Plan: el arranque generado. Pendiente de registrar (6/11/2026).',
  'plan.seed.user': 'Plan: el arranque generado. Pendiente de registrar (6/11/2026).',
  'razones.system': 'Razones de compra. Pendiente de registrar (6/11/2026).',
  'razones.user': 'Razones de compra. Pendiente de registrar (6/11/2026).',
  'razones.sugerir': 'Razones de compra: sugerencias. Pendiente de registrar (6/11/2026).',
  'razones.guion': 'Razones de compra: el guion. Pendiente de registrar (6/11/2026).',
  'setting.guion_audio': 'Chat Agent: el guion del audio de apertura. Pendiente de registrar (6/11/2026).',
};

// Keys del registro que NINGÚN archivo de código nombra: el override se guarda y nadie
// lo lee. La pantalla las muestra editables igual.
const MUERTAS_CONOCIDAS = {
  'campaign.suggest.system': 'MUERTA DE VERDAD: `lib/campaign-structurer.ts` exporta CAMPAIGN_SUGGEST_SYSTEM_TEMPLATE y el único que lo importa es el registro; la feature `campaign-suggest` del catálogo no la llama nadie. Se edita en /configuraciones y no cambia nada, y su `context` promete lo contrario (6/11/2026).',
  'campaign.suggest.user': 'MUERTA DE VERDAD: mismo caso que campaign.suggest.system (6/11/2026).',
  'campaign.adjust.system': 'MUERTA DE VERDAD: mismo caso que campaign.suggest.system (6/11/2026).',
  'campaign.adjust.user': 'MUERTA DE VERDAD: mismo caso que campaign.suggest.system (6/11/2026).',
};

// Slots que el call-site LLENA y el registro no declara: el que edita el prompt en
// /configuraciones no ve que ese `{{...}}` está vivo, y si lo borra pierde el dato sin
// aviso. Son 13 slots en 5 entradas; declararlos toca el registro y va con las 29.
const SIN_DECLARAR_CONOCIDOS = {
  'setting.ensayo': ['escenario'],
  'guardian.debate.system': ['escalera', 'impactoEsfuerzo', 'razon', 'rotoCliente'],
  'guardian.proj-debate.system': ['distribucion', 'escalera', 'impactoEsfuerzo', 'razon', 'rotoCliente', 'tamano'],
  'plan-fathom.extraer.system': ['molde'],
  'plan-fathom.extraer.user': ['rol'],
};

// Slots que NADIE llena: viajan tal cual al modelo. Son los placeholders de lead y de
// plantilla de WhatsApp, que el modelo tiene que copiar literales (lib/paso-ia.ts:31 lo
// explica al lado del prompt). No bloquean nunca; están acá para que el aviso salga sólo
// cuando aparece uno NUEVO: un aviso de ocho líneas en CADA push entrena a no leerlos.
const LITERALES_CONOCIDOS = {
  'template_validator.system': ['1', 'nombre'],
  'wa.advisor.template.system': ['1', 'nombre'],
  'wa.advisor.template.user': ['nombre'],
  'nutri.plantilla.system': ['nombre'],
  'nutri.plantilla.user': ['nombre'],
  'chatbot.paso-ia': ['lead_nombre', 'negocio'],
};

// Archivos que llaman a renderPrompt/getPromptText con un primer argumento que la guarda
// NO puede resolver a un literal. Cada uno dice de dónde salen sus keys, y un archivo
// nuevo así frena el push: o se declara acá, o se le pasa la key literal. Sin esto la
// indirección es la puerta por la que entra la próxima huérfana invisible.
const INDIRECTOS_DECLARADOS = {
  'lib/prompt-render.ts': 'Es la DEFINICIÓN de getPromptText/renderPrompt, no un call-site.',
  'lib/editor-landing/ia.ts': '`renderPrompt(p.key, …)` con `p` recorriendo PROMPTS_EDITOR (lib/editor-landing/ia-reglas.ts): la tabla aporta las keys.',
  'app/api/chat-agent/secuencias/route.ts': '`sugerir(tpl, key, …)` recibe la key del ternario de la línea de arriba, con los dos literales (`setting.gancho`, `setting.preguntas`) escritos en el mismo archivo.',
};

// ── Lectura ──────────────────────────────────────────────────────────────────────────

// `lib/prompt-registry.ts` es server-only: se neutraliza el marcador para poder EJECUTARLO.
const cargar = Module._load;
Module._load = (p, ...r) => (p === 'server-only' ? {} : Reflect.apply(cargar, Module, [p, ...r]));
const { REGISTRY } = await import(pathToFileURL(join(RAIZ, 'lib/prompt-registry.ts')).href);
const { MODOS } = await import(pathToFileURL(join(RAIZ, 'lib/mako-prompts.ts')).href);
const ENTRADAS = REGISTRY.flatMap((g) => g.entries.map((e) => ({ ...e, grupo: g.group })));
const DEL_REGISTRO = new Set(ENTRADAS.map((e) => e.key));
const PORKEY = new Map(ENTRADAS.map((e) => [e.key, e]));

const REGISTRO_REL = 'lib/prompt-registry.ts';
// ⚠️ Y SE EXCLUYE A SÍ MISMA. Vive en `scripts/`, o sea dentro de lo que barre, y sus
// listas de excepciones NOMBRAN las keys que persigue: en la primera corrida se contó sus
// propias `campaign.*` como cableadas («excepción vencida» ×4) y leyó el `renderPrompt(p.key…)`
// escrito dentro de un string de INDIRECTOS_DECLARADOS como un call-site opaco. Ninguna
// guarda que barra el repo puede juzgar su propio archivo: su texto habla justo de lo que caza.
// Derivado del propio archivo y no escrito a mano: una ruta hardcodeada deja de excluir
// nada el día que el script se renombra, y la guarda vuelve a acusarse sin que se vea por qué.
const YO_REL = import.meta.filename.slice(RAIZ.length + 1).replace(/\\/g, '/');
const archivos = execFileSync('git', ['ls-files', 'lib', 'app', 'scripts'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\n')
  .filter((f) => /\.(ts|tsx|mjs|cjs)$/.test(f) && f !== REGISTRO_REL && f !== YO_REL);

// A LF y sin comentarios: en un worktree los fuentes llegan en CRLF, y un comentario que
// nombra una key haría pasar por cableado a un prompt que nadie llama (AGENTS.md).
const fuentes = new Map();
for (const f of archivos) {
  try {
    fuentes.set(f, readFileSync(join(RAIZ, f), 'utf8')
      .replace(/\r\n/g, '\n')
      .replace(/^[ \t]*\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, ''));
  } catch { /* un archivo listado y borrado en el medio */ }
}

const slotsDe = (s) => [...new Set([...String(s ?? '').matchAll(/\{\{(\w+)\}\}/g)].map((x) => x[1]))].sort();
const nombraLiteral = (src, key) => src.includes(`'${key}'`) || src.includes(`"${key}"`) || src.includes(`\`${key}\``);

// ── El primer argumento de cada llamada, resuelto ────────────────────────────────────

/** Corta el objeto literal que empieza en `i` balanceando llaves. */
function objetoEn(src, i) {
  let d = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) return src.slice(i, j + 1); }
  }
  return null;
}

/**
 * Las claves de NIVEL 1 del objeto de vars. Acepta `k: v` Y el shorthand `{ titulo,
 * contexto }` — un parser que sólo busca `k:` no ve el shorthand, lee "no pasa ninguna
 * clave" y deja pasar todo en silencio (así di 0 en la primera medición del 6/11/2026).
 * Un spread o una clave computada devuelve '…': el objeto no es medible.
 */
function clavesDeVars(obj) {
  const out = [];
  let d = 0, buf = '';
  const cerrar = () => {
    const t = buf.trim(); buf = '';
    if (!t) return;
    if (t.startsWith('...') || t.startsWith('[')) { out.push('…'); return; }
    const c = t.match(/^['"`]?([A-Za-z_$][\w$]*)['"`]?\s*(?::|$)/);
    out.push(c ? c[1] : '…');
  };
  for (const ch of obj.slice(1, -1)) {
    if ('{[('.includes(ch)) d++;
    else if ('}])'.includes(ch)) d--;
    if (ch === ',' && d === 0) { cerrar(); continue; }
    buf += ch;
  }
  cerrar();
  return [...new Set(out)];
}

// Las dos formas de indirección del repo, y las dos dejan el literal escrito:
//   · tabla:     `export const PROMPTS_X = { campo: { key: '…' } }` → `PROMPTS_X.campo.key`
//   · constante: `export const CLAVE_X = '…'`                       → `CLAVE_X`
// Se resuelve SÓLO lo que aparece de verdad como primer argumento, buscando su
// declaración. Barrer a ciegas todas las constantes de nombre parecido traía keys de
// OTROS dominios (`app_settings`: `recorridos`, `resend_reply_to`, `vigia.paneles`…) y
// las contaba como prompts huérfanos: 60 falsos positivos (6/11/2026).
function resolverIndirecto(arg) {
  const tabla = arg.match(/^(PROMPTS_[A-Za-z_]+)\.(\w+)\.key$/);
  if (tabla) {
    for (const [, src] of fuentes) {
      const i = src.search(new RegExp(`\\bconst ${tabla[1]}\\s*=\\s*\\{`));
      if (i < 0) continue;
      const obj = objetoEn(src, src.indexOf('{', i));
      const campo = obj?.match(new RegExp(`\\b${tabla[2]}:\\s*\\{[^}]*?\\bkey:\\s*['"]([\\w.\\-]+)['"]`));
      if (campo) return campo[1];
    }
    return null;
  }
  if (!/^[A-Z][A-Z0-9_]*$/.test(arg)) return null;
  for (const [, src] of fuentes) {
    const c = src.match(new RegExp(`\\bconst ${arg}\\s*(?::\\s*\\w+\\s*)?=\\s*['"]([\\w.\\-]+)['"]`));
    if (c) return c[1];
  }
  return null;
}

const pedidas = new Set();
const opacos = [];
const llenadas = new Map();   // key → claves que algún call-site le pasa
const medibles = new Set();   // keys con al menos un call-site de objeto legible
const nomedibles = [];        // el TERCER ESTADO: un call-site que no se pudo leer
const descartadas = [];

/**
 * Los argumentos de NIVEL 1 de la llamada que abre en `i`, balanceando `( [ {`. Un regex
 * con `[^,]*?` no sirve: un argumento que contenga una coma (`renderPrompt(elegir(a, b),
 * …)`, o un objeto de vars con dos claves) hace que la llamada no matchee y no se vea EN
 * ABSOLUTO — un silencio, que es peor que un aviso.
 */
function argumentosDe(src, i) {
  const out = [];
  let d = 0, desde = i + 1;
  for (let j = i; j < src.length; j++) {
    const ch = src[j];
    if ('([{'.includes(ch)) d++;
    else if (')]}'.includes(ch)) {
      d--;
      if (d === 0) { out.push(src.slice(desde, j).trim()); return out; }
    } else if (ch === ',' && d === 1) { out.push(src.slice(desde, j).trim()); desde = j + 1; }
  }
  return null;   // la llamada no cierra
}

// Las bitácoras de /admin/dev son DOCUMENTACIÓN escrita en `.ts`, y varias nombran
// `renderPrompt(…)` dentro de un string: leídas como call-sites dan una key opaca que no
// existe. Se saltean sólo acá, no en el barrido de literales de más abajo — medido el
// 6/11/2026: entradas del registro que sólo una bitácora nombra, 0, así que no tapan nada.
const esBitacora = (f) => /(^|\/)bitacora\.ts$/.test(f);

for (const [f, src] of fuentes) {
  if (esBitacora(f)) continue;
  for (const m of src.matchAll(/\b(renderPrompt|getPromptText)\(/g)) {
    const args = argumentosDe(src, m.index + m[0].length - 1);
    if (!args) continue;                               // la llamada no cierra: fuente partido
    const arg = args[0] ?? '';
    const lit = arg.match(/^['"`]([\w.\-]+)['"`]$/);
    if (!lit) {
      // Todo lo que no resuelve a un literal es OPACO, incluida una LLAMADA de función
      // (`renderPrompt(elegir(a, b), …)`). Hasta el 6/11/2026 esto exigía que el argumento
      // pareciera un identificador para no tragarse la prosa de las bitácoras, y así una
      // llamada se descartaba en silencio: lo cazó la rotura 15 del arnés. Con las
      // bitácoras afuera, no hace falta adivinar qué es código.
      const resuelta = resolverIndirecto(arg);
      if (resuelta) pedidas.add(resuelta);
      else if (!(f in INDIRECTOS_DECLARADOS)) opacos.push({ archivo: f, arg: arg.slice(0, 60) || '(vacío)' });
      continue;
    }
    const key = lit[1];
    pedidas.add(key);
    if (m[1] !== 'renderPrompt') continue;

    const e = PORKEY.get(key);
    if (!e) continue;                                  // huérfana: se reporta aparte
    // «No pude leer» es un TERCER ESTADO y confundirlo con «no pasa nada» deja pasar todo
    // en silencio (AGENTS.md). Lo que no se puede leer se INFORMA en vez de descontarse
    // de la medición sin decir nada.
    const obj = args[2];
    if (obj === undefined) continue;                   // renderPrompt sin objeto de vars: no hay nada que cruzar
    if (!obj.startsWith('{')) { nomedibles.push({ key, archivo: f, por: `las vars no son un objeto literal (\`${obj.slice(0, 40)}\`)` }); continue; }
    const pasa = clavesDeVars(obj);
    if (pasa.includes('…')) { nomedibles.push({ key, archivo: f, por: 'spread o clave computada' }); continue; }
    medibles.add(key);
    llenadas.set(key, [...new Set([...(llenadas.get(key) ?? []), ...pasa])]);
    const tpl = slotsDe(e.default);
    const sobran = pasa.filter((k) => !tpl.includes(k));
    if (sobran.length) descartadas.push({ key, sobran, tpl, archivo: f });
  }
}

// ── Los seis modos de falla ──────────────────────────────────────────────────────────

const huerfanas = [...pedidas].filter((k) => !DEL_REGISTRO.has(k)).sort();

// ⚠️ SÓLO los `override`. La `key` del registro es el identificador con el que se LEE el
// prompt únicamente en esa fuente (`overrides[e.key]`, lib/prompt-registry.ts): para
// `persona`, `modo` y `fase` la pantalla resuelve por **`storeKey`**
// (`modoByKey.get(e.storeKey)`, `fases[e.storeKey]`), y `lib/mako-fases.ts:21` arma la
// clave de `app_settings` como `mako.fase.${storeKey}`. Pedirle un literal en el código a
// la `key` de esas 167 entradas no mide nada, y es lo que hacía caer `mako.fase.experimentos`
// como «muerta» siendo que NINGUNA fase se pide por su key (6/11/2026).
const muertas = ENTRADAS
  .filter((e) => e.source === 'override')
  .filter((e) => ![...fuentes.values()].some((s) => nombraLiteral(s, e.key)))
  .map((e) => e.key);

// La red equivalente para las otras fuentes: su `storeKey` tiene que existir en el store
// que la pantalla lee. Si no, `modoByKey.get()` da `undefined`, /configuraciones muestra el
// default como si fuera el valor vigente y guardar escribe en una clave que nadie lee —
// la misma falla silenciosa, por el otro lado. Las `fase` se GENERAN desde `FASES` con un
// `.map()`, así que ahí no puede haber deriva y no hace falta chequearlas.
const DE_MODOS = new Set(MODOS.map((m) => m.key));
const storeKeyRota = ENTRADAS
  .filter((e) => (e.source === 'persona' || e.source === 'modo') && !DE_MODOS.has(e.storeKey ?? ''))
  .map((e) => ({ key: e.key, storeKey: e.storeKey ?? '(sin storeKey)' }));

const fantasmas = [], sinDeclarar = [], literales = [];
for (const e of ENTRADAS) {
  const tpl = slotsDe(e.default);
  const dec = [...new Set((e.variables ?? []).map((v) => v.name))];
  const llena = llenadas.get(e.key) ?? [];
  const fant = dec.filter((x) => !tpl.includes(x) && !llena.includes(x));
  if (fant.length) fantasmas.push({ key: e.key, fant });
  if (!medibles.has(e.key)) continue;                  // sin call-site legible no se afirma nada
  const viv = llena.filter((x) => !dec.includes(x));
  if (viv.length) sinDeclarar.push({ key: e.key, viv: viv.sort() });
  const lit = tpl.filter((x) => !llena.includes(x));
  if (lit.length) literales.push({ key: e.key, lit });
}

// ── Veredicto ────────────────────────────────────────────────────────────────────────

if (LISTAR) {
  const linea = (t, xs) => console.log(`\n${t}: ${xs.length}\n` + (xs.length ? xs.map((x) => '   · ' + x).join('\n') : '   (ninguna)'));
  console.log(`registro: ${ENTRADAS.length} entradas en ${REGISTRY.length} grupos · keys que el código pide: ${pedidas.size} · call-sites medibles: ${medibles.size}`);
  linea('HUÉRFANAS (el código la pide, el registro no la tiene)', huerfanas);
  linea('MUERTAS (`override` del registro que ningún archivo nombra)', muertas);
  linea('STOREKEY ROTA (`persona`/`modo` con una storeKey que MODOS no tiene)', storeKeyRota.map((s) => `${s.key} → ${s.storeKey}`));
  linea('DESCARTADAS (el call-site pasa una clave que el template no tiene)', descartadas.map((d) => `${d.key}: pasa [${d.sobran}], el template tiene [${d.tpl}] — ${d.archivo}`));
  linea('FANTASMAS (el registro declara una variable que nadie tiene ni llena)', fantasmas.map((f) => `${f.key}: [${f.fant}]`));
  linea('SIN DECLARAR (el call-site llena un slot que el registro no declara)', sinDeclarar.map((s) => `${s.key}: [${s.viv}]`));
  linea('OPACAS (primer argumento sin resolver y sin declarar)', opacos.map((o) => `${o.archivo}: ${o.arg}`));
  linea('NO MEDIBLES (el call-site existe y no se pudo leer su objeto de vars)', nomedibles.map((n) => `${n.key}: ${n.por} — ${n.archivo}`));
  linea('LITERALES — sólo aviso (slot que nadie llena: viaja tal cual al modelo)', literales.map((l) => `${l.key}: [${l.lit}]`));
  process.exit(0);
}

const fallas = [];
const nuevas = (xs, conocidas) => xs.filter((k) => !(k in conocidas));
const vencidas = (conocidas, xs) => Object.keys(conocidas).filter((k) => !xs.includes(k));

for (const k of nuevas(huerfanas, HUERFANAS_CONOCIDAS)) {
  fallas.push([`PROMPT NO EDITABLE: la app pide '${k}' y lib/prompt-registry.ts no la tiene.`,
    'Funciona igual en runtime (getPromptText cae al fallback), así que nada más lo iba a avisar: el prompt',
    'simplemente no aparece en /configuraciones y nadie puede tocarlo. Agregá su Entry al REGISTRY.']);
}
for (const k of vencidas(HUERFANAS_CONOCIDAS, huerfanas)) {
  fallas.push([`EXCEPCIÓN VENCIDA: '${k}' ya está en el registro y sigue en HUERFANAS_CONOCIDAS.`,
    'Sacala de la lista de esta guarda (scripts/prompts-registro-sincronizado.mjs): la lista sólo puede bajar.']);
}
for (const k of nuevas(muertas, MUERTAS_CONOCIDAS)) {
  fallas.push([`PROMPT MUERTO: '${k}' está en el registro y NINGÚN archivo de lib/, app/ ni scripts/ lo nombra.`,
    'El override se guarda y nadie lo lee: /configuraciones lo muestra editable y editarlo no cambia nada.',
    'Cableá el call-site, o sacá la Entry, o decí en su `context` que todavía no está cableada (como mako.modo.*).']);
}
for (const s of storeKeyRota) {
  fallas.push([`STOREKEY ROTA: '${s.key}' resuelve por la storeKey '${s.storeKey}', que no está en MODOS (lib/mako-prompts.ts).`,
    '/configuraciones lo lee con `modoByKey.get(storeKey)`: sin esa fila muestra el default como si fuera el valor',
    'vigente, y guardar escribe en una clave que nadie lee. Agregá la fila a MODOS o corregí la storeKey.']);
}
for (const k of vencidas(MUERTAS_CONOCIDAS, muertas)) {
  fallas.push([`EXCEPCIÓN VENCIDA: '${k}' ya está cableada y sigue en MUERTAS_CONOCIDAS.`,
    'Sacala de la lista de esta guarda (scripts/prompts-registro-sincronizado.mjs).']);
}
for (const d of descartadas) {
  fallas.push([`VALOR DESCARTADO: el call-site de '${d.key}' pasa [${d.sobran}] y el template no tiene ese slot.`,
    `El template declara [${d.tpl}]. renderTemplate reemplaza SÓLO los slots que existen, así que ese dato`,
    `se tira sin error ni log. Agregá el slot al template o sacá la clave del render. — ${d.archivo}`]);
}
for (const f of fantasmas) {
  fallas.push([`VARIABLE FANTASMA: '${f.key}' declara [${f.fant}] en \`variables:\` y ni su template la tiene ni el call-site la llena.`,
    'La pantalla de /configuraciones le promete al que edita un slot que no existe. Sacala de `variables:`.']);
}
for (const s of sinDeclarar) {
  const ok = SIN_DECLARAR_CONOCIDOS[s.key] ?? [];
  const extra = s.viv.filter((x) => !ok.includes(x));
  if (extra.length) fallas.push([`SLOT VIVO SIN DECLARAR: el call-site de '${s.key}' llena [${extra}] y el registro no lo declara en \`variables:\`.`,
    'El que edita ese prompt no ve que ese {{...}} está vivo: si lo borra, el dato desaparece sin aviso.',
    'Agregalo a `variables:` con su descripción.']);
}
for (const [k, v] of Object.entries(SIN_DECLARAR_CONOCIDOS)) {
  const hoy = sinDeclarar.find((s) => s.key === k)?.viv ?? [];
  const ya = v.filter((x) => !hoy.includes(x));
  if (ya.length) fallas.push([`EXCEPCIÓN VENCIDA: '${k}' ya declara [${ya}] y sigue en SIN_DECLARAR_CONOCIDOS.`,
    'Sacá esos slots de la lista de esta guarda (scripts/prompts-registro-sincronizado.mjs).']);
}
for (const o of opacos) {
  fallas.push([`KEY QUE NO SE PUEDE SEGUIR: ${o.archivo} llama con \`${o.arg}\` y la guarda no sabe a qué key resuelve.`,
    'Por ahí entra una huérfana sin que nada la vea. Pasá la key literal, usá una tabla PROMPTS_* o una',
    'constante CLAVE_*/KEY_*, o declará el archivo en INDIRECTOS_DECLARADOS diciendo de dónde salen sus keys.']);
}
for (const f of Object.keys(INDIRECTOS_DECLARADOS)) {
  if (!fuentes.has(f)) fallas.push([`EXCEPCIÓN VENCIDA: ${f} está en INDIRECTOS_DECLARADOS y ya no existe.`,
    'Sacalo de la lista de esta guarda (scripts/prompts-registro-sincronizado.mjs).']);
}

// El aviso: un slot que nadie llena viaja literal al modelo. A veces es exactamente lo
// que se quiere (los placeholders de lead y de WhatsApp los copia el modelo tal cual), así
// que informa y no toma a nadie de rehén. Sólo los NUEVOS: el aviso completo sale con
// --listar, y repetir seis líneas en cada push sería enseñar a saltearlas.
const literalesNuevos = literales
  .map((l) => ({ key: l.key, lit: l.lit.filter((x) => !(LITERALES_CONOCIDOS[l.key] ?? []).includes(x)) }))
  .filter((l) => l.lit.length);
if (literalesNuevos.length) {
  console.log(`[prompts] aviso: ${literalesNuevos.length} prompt(s) con un {{slot}} NUEVO que nadie llena — viaja tal cual al modelo.`);
  console.log('  Si es un placeholder de lead o de WhatsApp (p. ej. {{nombre}}, {{1}}), está bien así. Si no, el dato no llega:');
  for (const l of literalesNuevos) console.log(`    · ${l.key}: [${l.lit}]`);
}
if (nomedibles.length) {
  console.log(`[prompts] aviso: ${nomedibles.length} call-site(s) de renderPrompt que la guarda no pudo leer — sus slots quedaron SIN chequear:`);
  for (const n of nomedibles) console.log(`    · ${n.key}: ${n.por} — ${n.archivo}`);
}
// LITERALES_CONOCIDOS también se podre: un slot que ya se llena y sigue en la lista
// esconde al siguiente. Avisa y no bloquea, porque la lista entera es de avisos.
for (const [k, v] of Object.entries(LITERALES_CONOCIDOS)) {
  const hoy = literales.find((l) => l.key === k)?.lit ?? [];
  const ya = v.filter((x) => !hoy.includes(x));
  if (ya.length) console.log(`[prompts] aviso: '${k}' ya llena [${ya}] y sigue en LITERALES_CONOCIDOS de scripts/prompts-registro-sincronizado.mjs: sacalo.`);
}

if (!fallas.length) process.exit(0);

console.error('');
console.error(`  ✖ El registro de prompts quedó desincronizado (${fallas.length}):`);
for (const [titulo, ...resto] of fallas) {
  console.error('');
  console.error('  · ' + titulo);
  for (const r of resto) console.error('    ' + r);
}
console.error('');
console.error('  Para ver el estado completo sin juzgar nada:');
console.error('      node --import tsx scripts/prompts-registro-sincronizado.mjs --listar');
console.error('');
process.exit(1);
