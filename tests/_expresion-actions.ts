// =============================================================================
// Un evaluador chico de las expresiones de GitHub Actions (`if:` de un paso), con SUS reglas de comparación
// =============================================================================
// Para qué (4/11/2026): `steps.veredicto.outputs.cuantos != '0'` se leía bien y salteaba los tests en cada punta sin veredicto. Una salida
// que no se escribió es null, y GitHub compara dos tipos distintos pasándolos a número: null → 0 y '0' → 0, así que «null != '0'» es FALSO.
// Así llegaron a main dash-cobranza (corrida 188) y spy-paginas-bloqueadas (corrida 189) sin correr un test. Un test que busca el texto de la
// condición no lo ve; uno que la EVALÚA con estas reglas, sí.
//
// Las reglas son las de la documentación de GitHub («Evaluate expressions in workflows and actions» → Operators), medidas contra esas dos
// corridas:
//   · Igualdad floja: con tipos distintos, los dos se pasan a número. null → 0; true → 1, false → 0; un string → el número que escribe
//     (JSON), '' → 0, cualquier otro → NaN; un objeto → NaN. NaN no es igual a nada. Dos strings se comparan sin mayúsculas.
//   · Una propiedad que no existe es null (lo de las corridas 188 y 189: con «vacío» la condición habría dado verdadero).
//   · Falsos: false, 0, -0, '', null y NaN. `!` da un booleano; `&&` y `||` devuelven uno de los dos operandos, como en JavaScript.
// Alcanza para las condiciones de este repo (strings, `steps.X.outputs.Y`, `github.event.inputs.Z`, y las funciones de estado del job, que
// se pasan como un booleano). Otra cosa (`contains(...)`, `>`) tira: un test no puede creer que evaluó algo que no sabe evaluar.
// =============================================================================

type Valor = string | number | boolean | null | Record<string, unknown>;

/** Las funciones de estado del job (`success()`, `failure()`, `cancelled()`, `always()`) y el contexto (`steps`, `github`). */
export type Contexto = { funciones: Record<string, boolean>; datos: Record<string, unknown> };

const aNumero = (v: Valor): number => {
  if (v === null) return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    if (v.trim() === '') return 0;
    return /^\s*-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?\s*$/.test(v) ? Number(v) : NaN;
  }
  return NaN;
};

export function igualFlojo(a: Valor, b: Valor): boolean {
  if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
  if (typeof a === typeof b && a !== null && b !== null && typeof a !== 'object') return a === b;
  if (a === null && b === null) return true;
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) return a === b;
  const x = aNumero(a);
  const y = aNumero(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return false;
  return x === y;
}

const verdadero = (v: Valor): boolean => !(v === false || v === null || v === '' || (typeof v === 'number' && (v === 0 || Number.isNaN(v))));

type Token = { t: 'str' | 'num' | 'id' | 'op' | '(' | ')' | '.'; v: string };

function tokens(s: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "'") {
      let v = '';
      i++;
      for (;;) {
        if (i >= s.length) throw new Error(`string sin cerrar en: ${s}`);
        if (s[i] === "'" && s[i + 1] === "'") { v += "'"; i += 2; continue; }
        if (s[i] === "'") { i++; break; }
        v += s[i++];
      }
      out.push({ t: 'str', v });
      continue;
    }
    const dos = s.slice(i, i + 2);
    if (['==', '!=', '&&', '||'].includes(dos)) { out.push({ t: 'op', v: dos }); i += 2; continue; }
    if (c === '!') { out.push({ t: 'op', v: '!' }); i++; continue; }
    if (c === '(' || c === ')' || c === '.') { out.push({ t: c, v: c }); i++; continue; }
    const num = /^-?\d+(\.\d+)?/.exec(s.slice(i));
    if (num) { out.push({ t: 'num', v: num[0] }); i += num[0].length; continue; }
    const id = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(s.slice(i));
    if (id) { out.push({ t: 'id', v: id[0] }); i += id[0].length; continue; }
    throw new Error(`no sé leer «${s.slice(i, i + 10)}» en: ${s}`);
  }
  return out;
}

/** Evalúa una condición `if:` (con o sin `${{ }}`) y devuelve si el paso CORRE. */
export function evaluar(expresion: string, ctx: Contexto): boolean {
  const limpia = expresion.trim().replace(/^\$\{\{\s*/, '').replace(/\s*\}\}$/, '');
  const ts = tokens(limpia);
  let p = 0;
  const ver = () => ts[p];
  const tomar = (t?: string, v?: string) => {
    const k = ts[p];
    if (!k || (t && k.t !== t) || (v && k.v !== v)) throw new Error(`esperaba ${v ?? t} en: ${limpia}`);
    p++;
    return k;
  };
  const primario = (): Valor => {
    const k = ver();
    if (!k) throw new Error(`expresión incompleta: ${limpia}`);
    if (k.t === 'op' && k.v === '!') { p++; return !verdadero(primario()); }
    if (k.t === '(') { p++; const v = o(); tomar(')'); return v; }
    if (k.t === 'str') { p++; return k.v; }
    if (k.t === 'num') { p++; return Number(k.v); }
    if (k.t === 'id') {
      p++;
      if (k.v === 'true') return true;
      if (k.v === 'false') return false;
      if (k.v === 'null') return null;
      if (ver()?.t === '(') {
        tomar('(');
        tomar(')');
        if (!(k.v in ctx.funciones)) throw new Error(`no sé evaluar la función ${k.v}() en: ${limpia}`);
        return ctx.funciones[k.v];
      }
      let v: unknown = ctx.datos[k.v] ?? null;
      while (ver()?.t === '.') {
        p++;
        const prop = tomar('id').v;
        v = v !== null && typeof v === 'object' && prop in (v as Record<string, unknown>) ? (v as Record<string, unknown>)[prop] : null;
      }
      return (v ?? null) as Valor;
    }
    throw new Error(`no sé evaluar «${k.v}» en: ${limpia}`);
  };
  const igualdad = (): Valor => {
    let a = primario();
    while (ver()?.t === 'op' && (ver().v === '==' || ver().v === '!=')) {
      const op = tomar().v;
      const b = primario();
      a = op === '==' ? igualFlojo(a, b) : !igualFlojo(a, b);
    }
    return a;
  };
  const y = (): Valor => {
    let a = igualdad();
    while (ver()?.t === 'op' && ver().v === '&&') { p++; const b = igualdad(); a = verdadero(a) ? b : a; }
    return a;
  };
  const o = (): Valor => {
    let a = y();
    while (ver()?.t === 'op' && ver().v === '||') { p++; const b = y(); a = verdadero(a) ? a : b; }
    return a;
  };
  const v = o();
  if (p !== ts.length) throw new Error(`sobró «${ts[p].v}» en: ${limpia}`);
  return verdadero(v);
}

/** La condición `if:` del paso que se llama `nombre`, tal como está en el workflow (sin comillas de YAML), o null si no tiene. */
export function condicionDe(yml: string, nombre: string): string | null {
  const texto = yml.replace(/\r\n/g, '\n');
  const i = texto.indexOf(`- name: ${nombre}\n`);
  if (i < 0) throw new Error(`no hay un paso «${nombre}»`);
  const resto = texto.slice(i + `- name: ${nombre}\n`.length);
  const fin = resto.search(/\n\s+- (name|uses): /);
  const paso = fin < 0 ? resto : resto.slice(0, fin);
  const m = /^\s+if: (.+)$/m.exec(paso);
  if (!m) return null;
  const v = m[1].trim();
  return v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v.startsWith("'") && v.endsWith("'") ? v.slice(1, -1).replace(/''/g, "'") : v;
}
