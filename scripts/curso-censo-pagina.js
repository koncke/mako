// Se evalúa DENTRO de la página, con su sesión ya resuelta. Ver la cabecera de
// curso-api-pagina.js: va en archivo propio porque un regex dentro de un template
// literal pierde sus escapes.
//
// Le pregunta a la API por TODOS los cursos de la cuenta de una sola vez: cuántas
// lecciones y cuántos recursos tiene cada uno. Es lo que permite responder «¿cuánto
// falta?» con un número en vez de con una impresión.
//
// ⚠️ NO SE CAPTURA: SE PREGUNTA. `curso-inventario.mjs` olfatea las respuestas que la
// página va pidiendo, y para dos cursos —«Instituto de Comunicación» y «Mateo Maffia»—
// eso nunca funcionó: la captura salía vacía y el inventario quedaba con
// `capturaFallida`, o sea sin poder afirmar nada sobre ellos. Preguntando no hay ventana
// que errar.
//
// Placeholders: __APIKEY__
(async () => {
  const BASE = 'https://wzdewdxwwkhtivichomf.supabase.co/rest/v1';
  const APIKEY = '__APIKEY__';

  let tok = '';
  for (const k of Object.keys(localStorage)) {
    if (k.indexOf('sb-') !== 0 || k.indexOf('auth-token') < 0) continue;
    try {
      const v = JSON.parse(localStorage.getItem(k));
      if (v && v.access_token) { tok = v.access_token; break; }
    } catch (e) { /* clave que no es JSON */ }
  }

  const h = { apikey: APIKEY, Authorization: 'Bearer ' + (tok || APIKEY) };
  const pedir = async (ruta) => {
    const r = await fetch(BASE + ruta, { headers: h });
    if (!r.ok) throw new Error(ruta.split('?')[0] + ' -> HTTP ' + r.status);
    return r.json();
  };

  // PostgREST topea las filas devueltas. Se pagina hasta que una página venga corta:
  // pedir "todo" y quedarse con lo que llegue es exactamente cómo se cuenta de menos.
  const todo = async (ruta, paso) => {
    const out = [];
    for (let desde = 0; ; desde += paso) {
      const r = await fetch(BASE + ruta + '&limit=' + paso + '&offset=' + desde, { headers: h });
      if (!r.ok) throw new Error(ruta.split('?')[0] + ' -> HTTP ' + r.status);
      const p = await r.json();
      out.push.apply(out, p);
      if (p.length < paso) break;
      if (desde > 100000) break;   // tope de seguridad, no de diseño
    }
    return out;
  };

  try {
    const cursos = await todo('/courses?select=id,slug,title,category&is_deleted=eq.false&order=id', 1000);
    const lecciones = await todo('/lessons?select=id,course_id,duration&is_deleted=eq.false&order=id', 1000);
    const recursos = await todo('/course_resources?select=id,course_id,title,file_size&order=id', 1000);

    const porCurso = {};
    for (const c of cursos) porCurso[c.id] = { slug: c.slug, titulo: c.title, categoria: c.category, lecciones: 0, segundos: 0, recursos: 0, junk: 0 };
    let sueltas = 0;
    for (const l of lecciones) {
      const c = porCurso[l.course_id];
      if (!c) { sueltas++; continue; }
      c.lecciones++;
      const d = String(l.duration || '');
      const p = d.split(':');
      if (p.length === 2) c.segundos += (+p[0]) * 60 + (+p[1]);
      else if (p.length === 3) c.segundos += (+p[0]) * 3600 + (+p[1]) * 60 + (+p[2]);
    }
    for (const r of recursos) {
      const c = porCurso[r.course_id];
      if (!c) continue;
      // Los `._` de macOS no son material: se cuentan aparte para no inflar el total.
      if (String(r.title || '').indexOf('._') === 0) c.junk++; else c.recursos++;
    }
    return JSON.stringify({
      ok: true, conToken: !!tok,
      totales: { cursos: cursos.length, lecciones: lecciones.length, recursos: recursos.length, leccionesSinCurso: sueltas },
      cursos: Object.keys(porCurso).map(function (k) { return porCurso[k]; }),
    });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e), conToken: !!tok });
  }
})()
