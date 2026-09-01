// Se evalúa DENTRO de la página del curso, con su sesión ya resuelta.
//
// ⚠️ VA EN UN ARCHIVO PROPIO, NO EN UN TEMPLATE LITERAL. Meter este código en un
// `${...}` de JS se come los escapes de cualquier regex (`\.` → `.`) y la página recibe
// una expresión rota — el síntoma es «Invalid regular expression flags», que no dice
// nada sobre la causa. Con el código en un archivo y un placeholder que se reemplaza
// con `split/join`, no hay escapado que valga.
//
// Placeholders que reemplaza el que lo inyecta:
//   __SLUG__    el slug del curso
//   __APIKEY__  la anon key, sacada de los HEADERS de una request real (no del bundle:
//               scrapearlo fue el camino que no funcionó)
(async () => {
  const BASE = 'https://wzdewdxwwkhtivichomf.supabase.co/rest/v1';
  const SLUG = '__SLUG__';
  const APIKEY = '__APIKEY__';

  // El token de sesión vive en localStorage con una clave `sb-<ref>-auth-token`.
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
    if (!r.ok) throw new Error(ruta.split('?')[0] + ' → HTTP ' + r.status);
    return r.json();
  };

  try {
    // ⚠️ EL SITIO TIENE DOS AREAS Y DOS JUEGOS DE TABLAS. /curso/ usa `courses`,
    //    `modules` y `course_resources`; el /vip/ usa `vip_courses`, `vip_modules` y
    //    `vip_course_resources`. Preguntar solo por las primeras contesta «no existe el
    //    curso» sobre uno que existe y se esta viendo en pantalla — que es de los peores
    //    mensajes posibles, porque manda a dudar del slug en vez de del lugar.
    //
    //    Se prueba /curso/ primero porque es donde esta el 84% del catalogo, y se cae al
    //    VIP. El que consume esto ya lee los dos nombres de campo
    //    (`r.vip_module_id ?? r.module_id`), asi que de aca para abajo no cambia nada.
    let cur = await pedir('/courses?select=id,slug,title&slug=eq.' + SLUG + '&is_deleted=eq.false');
    let area = 'curso';
    if (!cur[0]) {
      cur = await pedir('/vip_courses?select=id,slug,title&slug=eq.' + SLUG);
      area = 'vip';
    }
    if (!cur[0]) return JSON.stringify({ error: 'no existe el curso ' + SLUG + ' (ni en /curso/ ni en /vip/)', conToken: !!tok });
    const id = cur[0].id;

    const [mods, recs] = area === 'vip'
      ? await Promise.all([
        pedir('/vip_modules?select=id,title,parent_module_id,sort_order&vip_course_id=eq.' + id),
        pedir('/vip_course_resources?select=id,title,description,file_type,file_size,vip_module_id,sort_order&vip_course_id=eq.' + id),
      ])
      : await Promise.all([
        pedir('/modules?select=id,title,parent_module_id,legacy_parent_module_id&course_id=eq.' + id + '&is_deleted=eq.false'),
        pedir('/course_resources?select=id,title,description,file_type,file_size,module_id,is_free&course_id=eq.' + id),
      ]);

    return JSON.stringify({
      curso: cur[0].title, slug: cur[0].slug, id, area,
      conToken: !!tok,
      modulos: mods,
      recursos: recs,
    });
  } catch (e) {
    return JSON.stringify({ error: String(e && e.message ? e.message : e), conToken: !!tok });
  }
})()
