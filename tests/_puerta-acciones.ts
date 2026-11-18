// =============================================================================
// El analizador de las puertas de las server actions — NO es un test (no termina en .test.ts)
// =============================================================================
// Lo usa tests/acciones-con-puerta.test.ts (F115, 18/11/2026). Lee con el compilador de TypeScript cada `export async
// function` de cada archivo 'use server' de app/ y contesta: ¿CORTA sin sesión antes de tocar nada?
//
// «Corta» no es un nombre: es una FORMA, resuelta hasta el fondo. Hasta el 6/11 el barrido se hacía con `grep exigirSesion` y
// daba 71 falsos «sin corte», porque cada tab corta con otro nombre (docs/hallazgos-seguridad.md, «Un grep del NOMBRE de un
// guard no mide si hay guard»). Acá el nombre no importa: una función es una PUERTA si su cuerpo arranca cortando, y eso se
// pregunta de nuevo para la función que llama, sea del mismo archivo o importada (se resuelve el import y se lee su fuente).
// El fondo de todo es UNA lectura de la sesión, `getUsuarioActual` (lib/auth.ts), más `exigirSesion` (lib/sesion-accion.ts),
// cuyo `try` no es una forma que valga la pena enseñarle al analizador: las dos se EJECUTAN sin sesión en el test
// (tests/_puerta-acciones-hijo.ts) y ahí se ve que devuelven null y tiran.
//
// Qué cuenta como «arranca cortando» (en positivo):
//   · antes de la puerta, sólo lo que no espera nada (`await`) ni llama a nada de frente: validar los argumentos, armar una
//     constante. Lo que no espera no puede leer ni escribir la base;
//   · y lo primero que espera es la puerta:
//       `await P()` / `const x = await P()` de una que TIRA (tira o redirige sin sesión);
//       `const x = await P()` de una que DEVUELVE algo sin sesión, seguido de un `if` que mira `x` del lado correcto y corta
//         (con `return`, `throw`, `redirect(…)` o `notFound()`);
//       `if (!(await P())) return …` (o `(await P()) !== 'admin'`, y lo mismo del lado correcto);
//       `return P(…)`: la función devuelve lo que dice la puerta (incluye los envoltorios, `conActor(async () => …)`);
//       un `try { <lo de arriba> } catch { return …|throw }`: si la puerta tira, el catch corta.
//   · «del lado correcto»: una puerta que sin sesión devuelve null/false se mira con `!x`, `x == null`, `x !== 'admin'`,
//     `!pred(x, …)`; una que devuelve el MOTIVO (un texto) se mira con `if (x)`; una que devuelve un objeto, con `!x.ok`,
//     `'error' in x` o `x.error`. Mirar `if (x)` sobre una que devuelve null es justo al revés, y no cuenta.
// =============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import ts from 'typescript';

export type Clase = 'tira' | 'falsy' | 'motivo' | 'objeto';
export type Veredicto = { corta: true; clase: Clase; via: string } | { corta: false; motivo: string };

/** El fondo: verificadas EJECUTÁNDOLAS sin sesión (tests/_puerta-acciones-hijo.ts). */
export const BASE: Readonly<Record<string, { archivo: string; clase: Clase }>> = {
  getUsuarioActual: { archivo: 'lib/auth.ts', clase: 'falsy' },
  exigirSesion: { archivo: 'lib/sesion-accion.ts', clase: 'tira' },
};

/**
 * Los predicados que valen como puerta cuando reciben lo que devolvió una: `!puedeOperar(admin, …)`, `return puedeOperar(await
 * getSesionAdmin(), …)`. Cada uno se EJECUTA en el test con la sesión vacía (null) y tiene que dar false.
 */
export const PREDICADOS: Readonly<Record<string, string>> = {
  puedeOperar: 'lib/operaciones-reglas.ts',
};

const LLAMADAS_QUE_CORTAN = new Set(['redirect', 'notFound', 'forbidden', 'unauthorized', 'permanentRedirect']);

/**
 * Lo único que se puede ESPERAR antes de la puerta: lecturas del contexto del pedido que no devuelven datos de un negocio
 * (qué workspace mira la pestaña, su capa, cuál es la plataforma, los headers). Sin sesión, `getWorkspaceActual` cae al ws1:
 * por eso NO es una puerta, pero leerlo tampoco muestra nada.
 */
const LECTURAS_DE_CONTEXTO = new Set(['getWorkspaceActual', 'getCapaActual', 'wsSuperAdmin', 'headers', 'cookies']);

type Fuente = { archivo: string; sf: ts.SourceFile };

export class Analizador {
  private fuentes = new Map<string, Fuente>();
  private memo = new Map<string, Veredicto>();
  private enCurso = new Set<string>();
  constructor(private raiz: string) {}

  fuente(archivo: string): Fuente | null {
    const ya = this.fuentes.get(archivo);
    if (ya) return ya;
    const ruta = join(this.raiz, archivo);
    if (!existsSync(ruta)) return null;
    const src = readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n');
    const sf = ts.createSourceFile(archivo, src, ts.ScriptTarget.Latest, true, archivo.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const f = { archivo, sf };
    this.fuentes.set(archivo, f);
    return f;
  }

  /** El cuerpo de la función `nombre` DECLARADA en el archivo (exportada o no): `function`, o `const x = async (…) => {…}`, o envuelta en `cache(…)`. */
  cuerpo(f: Fuente, nombre: string): ts.Statement[] | null {
    for (const st of f.sf.statements) {
      if (ts.isFunctionDeclaration(st) && st.name?.text === nombre && st.body) return [...st.body.statements];
      if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) {
          if (!ts.isIdentifier(d.name) || d.name.text !== nombre || !d.initializer) continue;
          let ini: ts.Expression = d.initializer;
          // `const puerta = puertaNewsletter;`: un alias. Se sigue al nombre de verdad.
          if (ts.isIdentifier(ini)) return [ts.factory.createReturnStatement(ts.factory.createCallExpression(ini, undefined, []))];
          if (ts.isCallExpression(ini) && ts.isIdentifier(ini.expression) && ini.expression.text === 'cache' && ini.arguments[0]) ini = ini.arguments[0];
          if ((ts.isArrowFunction(ini) || ts.isFunctionExpression(ini)) && ini.body) {
            if (ts.isBlock(ini.body)) return [...ini.body.statements];
            return [ts.factory.createReturnStatement(ini.body)];
          }
        }
      }
    }
    return null;
  }

  /** De dónde viene `nombre` en el archivo: la ruta del módulo (resuelta a un archivo del repo) y el nombre exportado. */
  importado(f: Fuente, nombre: string): { archivo: string; nombre: string } | null {
    for (const st of f.sf.statements) {
      // `export { x } from './y'`: un módulo que re-exporta.
      if (ts.isExportDeclaration(st) && st.moduleSpecifier && st.exportClause && ts.isNamedExports(st.exportClause)) {
        for (const el of st.exportClause.elements) {
          if (el.name.text !== nombre) continue;
          const archivo = this.resolver(f.archivo, (st.moduleSpecifier as ts.StringLiteral).text);
          return archivo ? { archivo, nombre: el.propertyName?.text ?? el.name.text } : null;
        }
      }
      if (!ts.isImportDeclaration(st) || !st.importClause?.namedBindings || !ts.isNamedImports(st.importClause.namedBindings)) continue;
      for (const el of st.importClause.namedBindings.elements) {
        if (el.name.text !== nombre) continue;
        const esp = (st.moduleSpecifier as ts.StringLiteral).text;
        const archivo = this.resolver(f.archivo, esp);
        return archivo ? { archivo, nombre: el.propertyName?.text ?? el.name.text } : null;
      }
    }
    return null;
  }

  private resolver(desde: string, esp: string): string | null {
    let base: string;
    if (esp.startsWith('@/')) base = esp.slice(2);
    else if (esp.startsWith('.')) base = join(dirname(desde), esp);
    else return null;
    for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
      if (/\.(tsx?)$/.test(c) && existsSync(join(this.raiz, c))) return c.replace(/\\/g, '/');
    }
    return null;
  }

  /** ¿La función `nombre` (vista desde el archivo `f`) es una puerta? */
  puerta(f: Fuente, nombre: string): Veredicto {
    // El fondo vale por su ARCHIVO, no por su nombre: una función local que se llame `getUsuarioActual` se lee como cualquier otra.
    const b = BASE[nombre];
    if (b && f.archivo === b.archivo) return { corta: true, clase: b.clase, via: nombre };
    const clave = `${f.archivo}#${nombre}`;
    const ya = this.memo.get(clave);
    if (ya) return ya;
    if (this.enCurso.has(clave)) return { corta: false, motivo: `${nombre}: se llama a sí misma` };
    this.enCurso.add(clave);
    let v: Veredicto;
    const cuerpo = this.cuerpo(f, nombre);
    if (cuerpo) v = this.analizar(f, cuerpo);
    else {
      const imp = this.importado(f, nombre);
      const otra = imp ? this.fuente(imp.archivo) : null;
      if (imp && imp.nombre in BASE && BASE[imp.nombre].archivo === imp.archivo) v = { corta: true, clase: BASE[imp.nombre].clase, via: imp.nombre };
      else v = otra && imp ? this.puerta(otra, imp.nombre) : { corta: false, motivo: `${nombre}: no encontré dónde está declarada` };
    }
    this.enCurso.delete(clave);
    if (v.corta) v = { ...v, via: v.via === nombre ? nombre : `${nombre} → ${v.via}` };
    this.memo.set(clave, v);
    return v;
  }

  /** Si la expresión es una llamada a una función con nombre (`await P()`, `P().catch(…)`, `await P(…)`), su nombre. */
  private llamado(e: ts.Expression | undefined): { nombre: string; call: ts.CallExpression } | null {
    let x = e;
    while (x && (ts.isAwaitExpression(x) || ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isNonNullExpression(x))) x = x.expression;
    if (!x || !ts.isCallExpression(x)) return null;
    // `P().catch(() => null)` y `P().then(…)`: la llamada que importa es la de adentro.
    if (ts.isPropertyAccessExpression(x.expression) && ['catch', 'then', 'finally'].includes(x.expression.name.text)) {
      return this.llamado(x.expression.expression);
    }
    if (ts.isIdentifier(x.expression)) return { nombre: x.expression.text, call: x };
    return null;
  }

  /** `f(await P(), …)` (sin `await` delante de f) con P una puerta que tira: el veredicto de P. */
  private primerArgumentoQueTira(f: Fuente, e: ts.Expression | undefined): Veredicto | null {
    if (!e || !ts.isCallExpression(e) || !e.arguments[0]) return null;
    let a: ts.Expression = e.arguments[0];
    while (ts.isParenthesizedExpression(a)) a = a.expression;
    if (!ts.isAwaitExpression(a)) return null;
    // Nada del callee puede esperar antes que el argumento.
    if (this.contieneAwait(e.expression)) return null;
    const ll = this.llamado(a);
    if (!ll) return null;
    const v = this.puerta(f, ll.nombre);
    return v.corta && v.clase === 'tira' ? v : null;
  }

  /** Los elementos de `await Promise.all([…])`, o null. */
  private promiseAll(e: ts.Expression | undefined): ts.Expression[] | null {
    let x = e;
    while (x && (ts.isAwaitExpression(x) || ts.isParenthesizedExpression(x))) x = x.expression;
    if (!x || !ts.isCallExpression(x) || !ts.isPropertyAccessExpression(x.expression)) return null;
    if (!ts.isIdentifier(x.expression.expression) || x.expression.expression.text !== 'Promise' || x.expression.name.text !== 'all') return null;
    const arr = x.arguments[0];
    return arr && ts.isArrayLiteralExpression(arr) ? [...arr.elements] : null;
  }

  private contieneAwait(n: ts.Node): boolean {
    let hay = false;
    const ver = (m: ts.Node): void => {
      if (hay) return;
      if (ts.isAwaitExpression(m) || ts.isYieldExpression(m)) { hay = true; return; }
      // Lo de adentro de una función anidada no corre ahora.
      if (ts.isArrowFunction(m) || ts.isFunctionExpression(m) || ts.isFunctionDeclaration(m)) return;
      ts.forEachChild(m, ver);
    };
    ver(n);
    return hay;
  }

  /** Una sentencia que NO espera nada ni devuelve una llamada: validar argumentos, armar constantes. */
  private pura(s: ts.Statement): boolean {
    if (this.contieneAwait(s)) return false;
    if (ts.isReturnStatement(s) && s.expression && this.llamado(s.expression)) return false;
    if (ts.isExpressionStatement(s) && ts.isCallExpression(s.expression)) return false;
    if (ts.isExpressionStatement(s) && ts.isVoidExpression(s.expression)) return false;
    return true;
  }

  /** ¿La rama corta? `return`, `throw`, o una llamada que tira (`redirect`, `notFound`). Y con qué clase. */
  private ramaCorta(s: ts.Statement): Clase | null {
    const ultima = ts.isBlock(s) ? s.statements[s.statements.length - 1] : s;
    if (!ultima) return null;
    if (ts.isThrowStatement(ultima)) return 'tira';
    if (ts.isExpressionStatement(ultima) && ts.isCallExpression(ultima.expression) && ts.isIdentifier(ultima.expression.expression)
      && LLAMADAS_QUE_CORTAN.has(ultima.expression.expression.text)) return 'tira';
    if (ts.isReturnStatement(ultima)) return this.claseDeValor(ultima.expression);
    return null;
  }

  /** Lo que se devuelve al cortar dice cómo lo tiene que mirar quien llama. */
  private claseDeValor(valor: ts.Expression | undefined): Clase {
    let e = valor;
    while (e && (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e))) e = e.expression;
    if (!e) return 'falsy';
    if (e.kind === ts.SyntaxKind.NullKeyword || e.kind === ts.SyntaxKind.FalseKeyword || (ts.isIdentifier(e) && e.text === 'undefined')) return 'falsy';
    if (ts.isArrayLiteralExpression(e) && e.elements.length === 0) return 'falsy';
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e)) return 'motivo';
    if (ts.isIdentifier(e) && /^[A-Z][A-Z0-9_]+$/.test(e.text)) return 'motivo';
    if (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && LLAMADAS_QUE_CORTAN.has(e.expression.text)) return 'tira';
    return 'objeto';
  }

  /**
   * Un `return` que DEVUELVE la puerta pasada por algo: `return Boolean(await P())`, `return !!(await P())`,
   * `return (await P()) != null`, o `return (await P()) ? <con sesión> : <sin sesión>` (y al revés, con `!`).
   * Sólo para una puerta que sin sesión devuelve null/false.
   */
  private returnDePuerta(f: Fuente, e: ts.Expression | undefined): { clase: Clase; via: string } | null {
    if (!e) return null;
    let x = e;
    while (ts.isParenthesizedExpression(x)) x = x.expression;
    const espera = (n: ts.Expression): { clase: Clase; via: string } | null => {
      let y = n;
      while (ts.isParenthesizedExpression(y)) y = y.expression;
      if (!ts.isAwaitExpression(y)) return null;
      const ll = this.llamado(y);
      if (!ll) return null;
      const v = this.puerta(f, ll.nombre);
      return v.corta && v.clase === 'falsy' ? { clase: v.clase, via: v.via } : null;
    };
    // Boolean(await P()) · !!(await P())
    if (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && x.expression.text === 'Boolean' && x.arguments[0]) {
      const p = espera(x.arguments[0]);
      return p ? { clase: 'falsy', via: p.via } : null;
    }
    if (ts.isPrefixUnaryExpression(x) && x.operator === ts.SyntaxKind.ExclamationToken && ts.isPrefixUnaryExpression(x.operand)
      && x.operand.operator === ts.SyntaxKind.ExclamationToken) {
      const p = espera(x.operand.operand);
      return p ? { clase: 'falsy', via: p.via } : null;
    }
    // (await P()) != null · (await P()) !== null
    if (ts.isBinaryExpression(x) && [ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(x.operatorToken.kind)
      && x.right.kind === ts.SyntaxKind.NullKeyword) {
      const p = espera(x.left);
      return p ? { clase: 'falsy', via: p.via } : null;
    }
    // pred(await P(), …) con un predicado verificado: sin sesión da false.
    if (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && x.expression.text in PREDICADOS) {
      for (const a of x.arguments) { const p = espera(a); if (p) return { clase: 'falsy', via: `${x.expression.text}(${p.via})` }; }
      return null;
    }
    // (await P()) ? A : B  ·  !(await P()) ? A : B  ·  (await P()) === 'admin' ? A : B
    if (ts.isConditionalExpression(x)) {
      let c = x.condition;
      while (ts.isParenthesizedExpression(c)) c = c.expression;
      // La espera de la puerta adentro de la condición.
      let nodo: ts.AwaitExpression | null = null;
      const buscar = (n: ts.Node): void => { if (!nodo) { if (ts.isAwaitExpression(n) && espera(n)) nodo = n; else ts.forEachChild(n, buscar); } };
      buscar(c);
      const aw = nodo as ts.AwaitExpression | null;
      const p = aw ? espera(aw) : null;
      if (!aw || !p) return null;
      const esLa = (m: ts.Node) => m === aw;
      // ¿La condición es VERDAD sin sesión? Entonces lo de sin sesión es la rama verdadera. ¿Es FALSA sin sesión? La otra.
      let sinSesion: ts.Expression;
      if (this.miraBien(c, esLa, 'falsy')) sinSesion = x.whenTrue;
      else if (this.esPositiva(c, esLa)) sinSesion = x.whenFalse;
      else return null;
      // Lo que se devuelve SIN sesión no puede leer ni escribir nada.
      if (this.contieneAwait(sinSesion) || this.llamado(sinSesion)) return null;
      return { clase: this.claseDeValor(sinSesion), via: p.via };
    }
    return null;
  }

  /** ¿La condición es FALSA cuando la puerta (que devuelve null sin sesión) devolvió null? `x`, `x != null`, `x === 'admin'`. */
  private esPositiva(cond: ts.Expression, esElNodo: (m: ts.Node) => boolean): boolean {
    let c = cond;
    while (ts.isParenthesizedExpression(c)) c = c.expression;
    const esV = (e: ts.Expression) => { let y = e; while (ts.isParenthesizedExpression(y)) y = y.expression; return esElNodo(y); };
    if (esV(c)) return true;
    if (ts.isBinaryExpression(c)) {
      const k = c.operatorToken.kind;
      if ([ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken].includes(k)
        && ((esV(c.left) && ts.isStringLiteral(c.right)) || (esV(c.right) && ts.isStringLiteral(c.left)))) return true;
      if ([ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(k)
        && esV(c.left) && c.right.kind === ts.SyntaxKind.NullKeyword) return true;
      if (k === ts.SyntaxKind.AmpersandAmpersandToken) return this.esPositiva(c.left, esElNodo) || this.esPositiva(c.right, esElNodo);
    }
    return false;
  }

  /** ¿La condición, sobre la variable `v` de una puerta de clase `clase`, es verdadera cuando NO hay sesión? */
  private miraBien(cond: ts.Expression, v: string | ((e: ts.Node) => boolean), clase: Clase): boolean {
    let c = cond;
    while (ts.isParenthesizedExpression(c)) c = c.expression;
    if (ts.isBinaryExpression(c) && c.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      return this.miraBien(c.left, v, clase) || this.miraBien(c.right, v, clase);
    }
    const esElNodo = typeof v === 'string' ? (m: ts.Node) => ts.isIdentifier(m) && m.text === v : v;
    const esV = (e: ts.Expression) => {
      let x: ts.Expression = e;
      while (ts.isParenthesizedExpression(x) || ts.isNonNullExpression(x)) x = x.expression;
      return esElNodo(x);
    };
    const usaV = (e: ts.Node): boolean => {
      let hay = false;
      const ver = (m: ts.Node): void => { if (!hay) { if (esElNodo(m)) hay = true; else ts.forEachChild(m, ver); } };
      ver(e);
      return hay;
    };
    if (clase === 'motivo') {
      if (esV(c)) return true;
      // typeof x === 'string'
      if (ts.isBinaryExpression(c) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(c.operatorToken.kind)
        && ts.isTypeOfExpression(c.left) && esV(c.left.expression) && ts.isStringLiteral(c.right) && c.right.text === 'string') return true;
      if (ts.isBinaryExpression(c) && [ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(c.operatorToken.kind)
        && esV(c.left) && (c.right.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(c.right) && c.right.text === 'undefined'))) return true;
      return false;
    }
    if (clase === 'objeto') {
      // `!x.ok`, `x.ok === false`, `'error' in x`, `x.error`.
      if (ts.isPrefixUnaryExpression(c) && c.operator === ts.SyntaxKind.ExclamationToken && ts.isPropertyAccessExpression(c.operand) && esV(c.operand.expression)) return true;
      if (ts.isBinaryExpression(c) && c.operatorToken.kind === ts.SyntaxKind.InKeyword && esV(c.right)) return true;
      // x instanceof Response: la puerta devuelve la respuesta de error.
      if (ts.isBinaryExpression(c) && c.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword && esV(c.left)) return true;
      if (ts.isPropertyAccessExpression(c) && esV(c.expression) && ['error', 'fallo', 'motivo'].includes(c.name.text)) return true;
      if (ts.isBinaryExpression(c) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(c.operatorToken.kind)
        && ts.isPropertyAccessExpression(c.left) && esV(c.left.expression) && c.right.kind === ts.SyntaxKind.FalseKeyword) return true;
      return false;
    }
    // falsy: `!x`, `x == null`, `x === null`, `x !== 'algo'`, `!pred(…x…)`.
    if (ts.isPrefixUnaryExpression(c) && c.operator === ts.SyntaxKind.ExclamationToken) {
      const o = c.operand;
      if (esV(o)) return true;
      // `!pred(x, …)`: sólo un predicado que se EJECUTÓ en el test con la sesión vacía y dio false (PREDICADOS).
      if (ts.isCallExpression(o) && ts.isIdentifier(o.expression) && o.expression.text in PREDICADOS && o.arguments.some((a) => usaV(a))) return true;
      if (ts.isPropertyAccessExpression(o) && esV(o.expression)) return true;   // con x null, `x.algo` tira: corta igual
      return false;
    }
    if (ts.isBinaryExpression(c)) {
      const k = c.operatorToken.kind;
      const nulo = (e: ts.Expression) => e.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(e) && e.text === 'undefined') || e.kind === ts.SyntaxKind.FalseKeyword;
      if ([ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken].includes(k) && ((esV(c.left) && nulo(c.right)) || (esV(c.right) && nulo(c.left)))) return true;
      if ([ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(k)
        && ((esV(c.left) && ts.isStringLiteral(c.right)) || (esV(c.right) && ts.isStringLiteral(c.left)))) return true;
    }
    return false;
  }

  /** ¿La condición es verdad sin sesión, mirando las variables de las puertas de arriba? Con `||` alcanza un lado; con `&&`, los dos. */
  private verdadSinSesion(cond: ts.Expression, pendientes: ReadonlyMap<string, { clase: Clase }>): boolean {
    let c = cond;
    while (ts.isParenthesizedExpression(c)) c = c.expression;
    if (ts.isBinaryExpression(c) && c.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      return this.verdadSinSesion(c.left, pendientes) || this.verdadSinSesion(c.right, pendientes);
    }
    if (ts.isBinaryExpression(c) && c.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return this.verdadSinSesion(c.left, pendientes) && this.verdadSinSesion(c.right, pendientes);
    }
    for (const [v, p] of pendientes) if (this.miraBien(c, v, p.clase)) return true;
    return false;
  }

  /** Lo mismo que `miraBien`, pero con la puerta ADENTRO de la condición: `if (!(await P())) return`. */
  private condicionConPuerta(f: Fuente, cond: ts.Expression): { clase: Clase; via: string } | null {
    // La primera ESPERA de una puerta adentro de la condición hace de variable: se pregunta como si fuera `const x = await P()`.
    type Hallada = { nodo: ts.Node; clase: Clase; via: string };
    let hallada: Hallada | null = null;
    const buscar = (n: ts.Node): void => {
      if (hallada) return;
      if (ts.isAwaitExpression(n)) {
        const ll = this.llamado(n);
        if (ll) { const v = this.puerta(f, ll.nombre); if (v.corta) { hallada = { nodo: n, clase: v.clase, via: v.via }; return; } }
      }
      ts.forEachChild(n, buscar);
    };
    buscar(cond);
    const h = hallada as Hallada | null;
    if (!h) return null;
    const esLaEspera = (m: ts.Node) => m === h.nodo;
    return this.miraBien(cond, esLaEspera, h.clase) ? { clase: h.clase, via: h.via } : null;
  }

  /** El veredicto de un cuerpo. */
  analizar(f: Fuente, cuerpo: readonly ts.Statement[], esUltimoDeAfuera = true): Veredicto {
    const pendientes = new Map<string, { clase: Clase; via: string }>();
    for (let i = 0; i < cuerpo.length && i < 12; i++) {
      const s = cuerpo[i];
      const txt = () => { try { return s.getText(f.sf).replace(/\s+/g, ' ').slice(0, 140); } catch { return '(un alias)'; } };
      // 1. Una variable de una puerta que devuelve algo: este `if` la tiene que mirar.
      if (pendientes.size && ts.isIfStatement(s)) {
        let corte = this.ramaCorta(s.thenStatement);
        // `if (no) return no;`: devuelve lo mismo que dijo la puerta, con su clase.
        const ult = ts.isBlock(s.thenStatement) ? s.thenStatement.statements[s.thenStatement.statements.length - 1] : s.thenStatement;
        if (ult && ts.isReturnStatement(ult) && ult.expression && ts.isIdentifier(ult.expression) && pendientes.has(ult.expression.text)) {
          corte = pendientes.get(ult.expression.text)!.clase;
        }
        if (corte && this.verdadSinSesion(s.expression, pendientes)) {
          const via = [...pendientes.values()].map((p) => p.via).join(' + ');
          return { corta: true, clase: corte, via };
        }
      }
      if (this.pura(s)) continue;
      // 2. Lo primero que espera tiene que ser la puerta.
      if (ts.isExpressionStatement(s)) {
        const ll = this.llamado(s.expression);
        if (ll) { const v = this.puerta(f, ll.nombre); if (v.corta && v.clase === 'tira') return v; }
        return { corta: false, motivo: txt() };
      }
      if (ts.isReturnStatement(s)) {
        const rp = this.returnDePuerta(f, s.expression);
        if (rp) return { corta: true, clase: rp.clase, via: rp.via };
        const ll = this.llamado(s.expression);
        if (ll) { const v = this.puerta(f, ll.nombre); if (v.corta) return v; }
        return { corta: false, motivo: txt() };
      }
      if (ts.isVariableStatement(s)) {
        const decls = s.declarationList.declarations;
        let alguna = false;
        let deContexto = true;
        for (const d of decls) {
          // `const [a, b] = await Promise.all([P(), Q()])`: cada elemento, con su variable.
          const todos = this.promiseAll(d.initializer);
          if (todos && ts.isArrayBindingPattern(d.name)) {
            const nombres = d.name.elements.map((el) => (ts.isBindingElement(el) && ts.isIdentifier(el.name) ? el.name.text : null));
            for (let k = 0; k < todos.length; k++) {
              const ll = this.llamado(todos[k]);
              if (!ll) { if (this.contieneAwait(todos[k])) return { corta: false, motivo: txt() }; continue; }
              if (LECTURAS_DE_CONTEXTO.has(ll.nombre)) continue;
              const v = this.puerta(f, ll.nombre);
              if (!v.corta) return { corta: false, motivo: `${txt()} (${ll.nombre} corre junto con la puerta)` };
              deContexto = false;
              if (v.clase === 'tira') return v;      // Promise.all rechaza sin sesión
              const n = nombres[k];
              if (!n) return { corta: false, motivo: `${txt()} (la puerta no queda en una variable)` };
              pendientes.set(n, { clase: v.clase, via: v.via });
              alguna = true;
            }
            continue;
          }
          const ll0 = this.llamado(d.initializer);
          if (ll0 && LECTURAS_DE_CONTEXTO.has(ll0.nombre)) continue;
          deContexto = false;
          // `const x = f(await P(), …)`: los argumentos se evalúan antes que la llamada; si el primero espera una puerta que
          // tira, sin sesión no se llega a `f`.
          const pa = this.primerArgumentoQueTira(f, d.initializer);
          if (pa) return pa;
          // `const puede = (await P()) != null`, `Boolean(await P())`, `pred(await P())`: una variable que sin sesión es false.
          const rp = ts.isIdentifier(d.name) ? this.returnDePuerta(f, d.initializer) : null;
          if (rp && ts.isIdentifier(d.name)) { pendientes.set(d.name.text, rp); alguna = true; continue; }
          // `const b = a ? null : await P()` con `a` una de arriba que sin sesión es false: sin sesión vale lo de P.
          if (ts.isIdentifier(d.name) && d.initializer && ts.isConditionalExpression(d.initializer)) {
            const ce = d.initializer;
            let cc = ce.condition; while (ts.isParenthesizedExpression(cc)) cc = cc.expression;
            const p0 = ts.isIdentifier(cc) ? pendientes.get(cc.text) : undefined;
            const otra = this.llamado(ce.whenFalse);
            const vOtra = otra && ts.isAwaitExpression(ce.whenFalse) ? this.puerta(f, otra.nombre) : null;
            if (p0?.clase === 'falsy' && vOtra?.corta && vOtra.clase === 'falsy' && !this.contieneAwait(ce.whenTrue)) {
              pendientes.set(d.name.text, { clase: 'falsy', via: vOtra.via });
              alguna = true;
              continue;
            }
          }
          const ll = ll0;
          if (!ll) { if (d.initializer && this.contieneAwait(d.initializer)) return { corta: false, motivo: txt() }; continue; }
          const v = this.puerta(f, ll.nombre);
          if (!v.corta) {
            if (this.contieneAwait(d.initializer as ts.Expression)) return { corta: false, motivo: txt() };
            continue;
          }
          if (v.clase === 'tira') return v;
          if (!ts.isIdentifier(d.name)) return { corta: false, motivo: `${txt()} (la puerta desarmada en partes no se puede seguir)` };
          pendientes.set(d.name.text, { clase: v.clase, via: v.via });
          alguna = true;
        }
        if (alguna || deContexto) continue;
        return { corta: false, motivo: txt() };
      }
      if (ts.isIfStatement(s)) {
        const corte = this.ramaCorta(s.thenStatement);
        const p = corte ? this.condicionConPuerta(f, s.expression) : null;
        if (corte && p) return { corta: true, clase: corte, via: p.via };
        return { corta: false, motivo: txt() };
      }
      if (ts.isTryStatement(s)) {
        const adentro = this.analizar(f, s.tryBlock.statements, false);
        if (!adentro.corta) return adentro;
        // Si la puerta tira adentro del try, el catch se lo come: tiene que cortar él, o ser lo último de la función.
        const c = s.catchClause?.block;
        const catchCorta = c ? this.ramaCorta(c) != null : false;
        const ultimo = i === cuerpo.length - 1 && esUltimoDeAfuera;
        if (catchCorta || ultimo || adentro.clase !== 'tira') return adentro;
        return { corta: false, motivo: `${txt()} (la puerta tira adentro de un try cuyo catch no corta)` };
      }
      return { corta: false, motivo: txt() };
    }
    return { corta: false, motivo: 'no encontré la puerta en las primeras sentencias' };
  }

  /** Las `export async function` de un archivo 'use server', o null si no lo es. */
  acciones(archivo: string): Array<{ nombre: string; cuerpo: ts.Statement[] }> | null {
    const f = this.fuente(archivo);
    if (!f) return null;
    const p = f.sf.statements[0];
    if (!p || !ts.isExpressionStatement(p) || !ts.isStringLiteral(p.expression) || p.expression.text !== 'use server') return null;
    const out: Array<{ nombre: string; cuerpo: ts.Statement[] }> = [];
    for (const st of f.sf.statements) {
      if (!ts.isFunctionDeclaration(st) || !st.body || !st.name) continue;
      if (!st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
      out.push({ nombre: st.name.text, cuerpo: [...st.body.statements] });
    }
    return out;
  }

  veredictoDeAccion(archivo: string, nombre: string): Veredicto {
    const f = this.fuente(archivo)!;
    return this.puerta(f, nombre);
  }
}
