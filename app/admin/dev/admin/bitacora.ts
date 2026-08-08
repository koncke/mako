// =============================================================================
// Admin (SuperAdmin) — registro de construcción
// =============================================================================
// Todo lo que se trabajó sobre el shell de la agencia: la barra, sus tabs, cómo
// se entra a un cliente y qué se puede hacer adentro.
//
// Nace con contenido porque el trabajo ya estaba hecho cuando se creó el área:
// arrancó como «rediseño» y a mitad de camino dejó de serlo. Eso mismo es lo
// primero que vale la pena tener anotado — el registro del rediseño no tenía por
// qué contar cómo funciona la impersonación.
//
// Qué va acá y qué no: el motivo y la trampa, no el changelog. Los tipos, en
// ../_registro/tipos.ts.

import type { Hito, Parte } from '../_registro/tipos';

const CH = 'Parte 3 · Gramática de MaKo';

export const BITACORA: Hito[] = [
  {
    fecha: '8 ago', hora: '12:10', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'La barra de super admin, y limpiar sus tabs',
    pedido: 'Por otro lado, corrige la sidebar de super admin, el diseño tiene que ser exactamente el mismo que en cualquier workspace.\nLas secciones no son así, son desplegables...\n\nTabs a modificar o eliminar en SuperAdmin porque no tienen sentido, revisalas igualmente para ver si hacen algo importante...\n\n1. Ruta /metodo tab "Integraciones". Ya existe una tab de integraciones, no tiene sentido ver eso... Eliminala directamente.\n2. La ruta de /admin/guiones la tab de "Guiones" debería estar dentro de la sección de "dev" con nombre de "Ads Writer" que así se llama la feature...\n3. Hay una tab llamada "MaKo" que me redirije a otra tab, a la de admin, "clientes". Eso no tiene sentido, elimina MaKo.\n4. Lleva a "Grafo" a dev, y ponlo primero.\n5. Quiero que traigas TODAS las secciones de cualquier workspace al super admin. Ya que vamos a salir a vender MaKo y vamos a utilizar todo. Con la particularidad de que en SuperAdmin existirá una sección de "Admin" y otra de "Dev".',
    puntos: [
      'El punto 5 cambia qué ES el shell de admin: dejaba de ser «sin tabs de marketing, solo gestión» —que es como estaba escrito en el código— para ser el producto entero MÁS dos secciones propias. La razón es de negocio: van a vender MaKo usándolo.',
    ],
  },
  {
    fecha: '8 ago', hora: '13:05', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'La barra de admin deja de ser otra barra',
    puntos: [
      '⚠️ **No era un problema de estilos: eran dos JSX distintos.** El shell de admin no usaba `<Familia>` — tenía su propia rama con un rótulo estático y una lista plana. Por eso las secciones no se desplegaban: ninguna cantidad de CSS lo iba a arreglar. `ADMIN_SECCIONES` (que era `{titulo, items}`) pasó a ser `ADMIN_FAMILIAS`: dos `NavFamilia` iguales a las otras cuatro, y quedó UNA sola rama de navegación.',
      '**La regla que queda: si dos cosas tienen que verse igual, tienen que ser el mismo componente.** Mientras sean dos ramas de JSX vuelven a divergir a la tercera edición — que es exactamente lo que había pasado.',
      'El super admin ve las CUATRO familias de producto además de Admin y Dev. Anda sin impersonar porque un admin que no impersona cae en su PROPIO workspace (`resolverDesdeCookies`). ⚠️ Si el usuario admin no tuviera workspace asignado, esas tabs darían 403.',
      '**«MaKo» no era una tab que redirigía: era la ÚNICA puerta a una feature.** Apuntaba a `/admin?tab=copy` y ahí vive el cerebro de copywriting; el tab bar de /admin solo mostraba Clientes y Super Admins. Y casi nunca funcionaba, porque el `?tab=` lo lee un efecto de MONTAJE: estando ya en /admin, la navegación del cliente no remonta nada y te deja donde estabas — eso es lo que se veía como «me redirige». Salió de la barra y recuperó su botón adentro de /admin.',
      '**«Integraciones» (/metodo) sí hace algo**: es el asistente guiado de credenciales. Salió de la barra porque duplica la tab de Integraciones, pero la ruta NO se borró: sigue colgando de Configuraciones → «Método».',
      '«Guiones» era el tercer nombre de la misma cosa (la feature es /ads-writer, el registro decía «Ads Generator»). Todo pasó a **Ads Writer**, con Ángulos y Estructuras como sub-tabs al lado de Roadmap. Las dos rutas viejas redirigen.',
      '«Plan» salió de Admin: ya estaba en Operate, y ahora Operate se ve.',
    ],
    commits: [{ sha: '2d7728a', msg: 'La barra de super admin deja de ser otra barra', lineas: 665, archivos: 16 }],
    archivos: [
      'app/_components/nav.ts — `ADMIN_FAMILIAS` reemplaza a `ADMIN_SECCIONES`',
      'app/_components/Sidebar.tsx — una sola rama de navegación',
      'app/admin/AdminView.tsx — vuelve el botón «Copywriting»',
      'app/admin/guiones/page.tsx — redirige a /admin/dev/ads-writer',
    ],
  },
  {
    fecha: '8 ago', hora: '14:20', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Sacar «Admin» del perfil y mover «Contexto de MaKo»',
    pedido: 'Elimina "Admin" del desplegable del perfil.\nY mueve "Contexto MaKo" dentro de la sección admin.',
    puntos: [
      'Los dos eran `adminOnly`, o sea que solo los veía el super admin — que ya tiene su familia Admin en la barra. Eran dos puertas a lo mismo.',
      '⚠️ De paso apareció que **había un test roto en `main`** desde el renombre de Guiones: esperaba `MaKo - Guiones`. El push había salido verde igual porque **el pre-push corre tipos y el contrato de las skills, NO los tests**. Quedó escrito en AGENTS.md.',
    ],
    commits: [{ sha: '8014aa5', msg: 'Detrás del avatar queda tu cuenta, no las herramientas de la agencia', lineas: 50, archivos: 4 }],
  },
  {
    fecha: '8 ago', hora: '15:40', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Un cliente por pestaña',
    pedido: 'Haz que cuando entre a la vista de un cliente como super admin, solo ESA tab entre a la vista. No toda la cuenta de super admin... Así puedo entrar a muchas tabs de clientes y también puedo seguir viendo la vista de super admin en otras tabs.',
    puntos: [
      'Es un cambio de arquitectura, no de UI: toca el aislamiento multi-inquilino, que es lo más delicado del repo.',
    ],
  },
  {
    fecha: '8 ago', hora: '16:30', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'El workspace viaja en `?ws=` y lo valida el proxy',
    puntos: [
      '⚠️ **Una cookie no puede ser por pestaña.** La impersonación era una cookie firmada (`mako_ws`) y las cookies son del NAVEGADOR: entrar a un cliente cambiaba el contexto en todas las pestañas abiertas.',
      '⚠️ **Y el diagnóstico obvio es el equivocado.** `sessionStorage` sí es por pestaña, pero **el server no lo puede leer cuando pinta la página**, y 61 de las 104 pantallas deciden qué mostrar con un gate server-side. Habría quedado media pantalla de un cliente y media del otro. Lo único que es distinto por pestaña Y llega en el request del documento es **la URL**.',
      '**Dónde está la seguridad:** `?ws=` lo escribe cualquiera, así que leerlo directo sería un IDOR. El único que lo mira es `proxy.ts`, que lo acepta solo si la sesión firmada dice `rol === admin` y que **borra el header interno en cada request** antes de decidir.',
      '⚠️ **El bug que costó el diagnóstico:** todo andaba salvo `/api/auth/me` — justo la ruta que le dice a la barra y al cartel a qué cliente mirás. `seguir()` recibía la sesión por parámetro, pero el proxy tiene CINCO salidas y la de rutas públicas es un early-return anterior a verificar la sesión; `/api/auth/me` cuelga de `/api/auth`, que está en PUBLICOS. **La regla: en un gate con varias salidas, lo que TODAS deben hacer va adentro del helper, no como argumento en cada return.**',
      'Las 340 llamadas a `/api` lo llevan por un parche de `window.fetch` (un choke point, no 340 ediciones) y los 85 links por un envoltorio de `next/link` (57 archivos con un codemod). ⚠️ El parche va al cargar el MÓDULO, no en un `useEffect`: los efectos corren de hijo a padre y llegaría tarde a las llamadas de la carga inicial.',
      'Verificado con la misma sesión y a la vez: `?ws=3` → «Cliente de Prueba», `?ws=1` → «Mauricio Bustos», header forjado a mano → ignorado. Y los datos también se separan: `datos-sin-marcar` devuelve 0 / 5 / 3.',
    ],
    commits: [
      { sha: '00cb95c', msg: 'Cada cliente en su pestaña: el workspace viaja en ?ws=', lineas: 621, archivos: 62 },
      { sha: '78c5383', msg: 'Entrar a un cliente se queda en la misma pestaña', lineas: 45, archivos: 1 },
    ],
    archivos: [
      'lib/ws-tab.ts — NUEVO. Constantes y helpers, isomórfico',
      'proxy.ts — `seguir()` reemplaza a NextResponse.next() en las cinco salidas',
      'lib/workspace.ts — la pestaña gana sobre la cookie, que queda de legado',
      'app/_components/WsFetch.tsx · app/_ui/Link.tsx — NUEVOS',
    ],
  },
  {
    fecha: '8 ago', hora: '17:05', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: '«El botón de Datos de Mauricio y RESET es MUY peligroso»',
    pedido: 'El botón de "Datos de Mauricio" y "RESET" es MUY peligroso, eso SOLO debe aparecer en el cliente de prueba.',
    puntos: [
      'Lo vio en la interfaz. El síntoma real era ninguno — hasta que alguien apretara.',
    ],
  },
  {
    fecha: '8 ago', hora: '17:40', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'correccion',
    titulo: 'El Reset se ofrecía en TODOS los clientes reales',
    puntos: [
      '⚠️ **El guard era una condición NEGATIVA**, en sus tres capas: `if (ws == null || ws === OWNER_WS) return null`. Eso protege a Mauricio y **a nadie más**: Leandro (10), Martín (9) y Leila (11) tenían disponible el botón de vaciar, y `resetearWorkspace` borra 50+ tablas y 4 buckets de storage sin vuelta atrás.',
      '**Lo más llamativo: la función se llamaba `wsDePrueba()`.** El nombre decía la intención y el código decía otra cosa, así que leerlo por encima no alcanzaba para verlo.',
      '**La regla: un guard sobre algo destructivo se escribe en POSITIVO** («solo ESTE»), nunca en negativo («cualquiera menos aquél»). La lista de lo que hay que proteger crece sola con cada cliente nuevo; la de lo que se puede tocar, no.',
      '⚠️ **La guarda más peligrosa de la app era la única sin test.** `lib/reset-workspace.ts` lleva `server-only`, así que ningún test lo puede importar — se descubrió al intentar escribirlo. Por eso la condición se mudó a `exigirClienteDePrueba` en `lib/auth-session.ts`, que no lo tiene.',
      '**Esconder el botón no habría sido el arreglo:** el que decide es el endpoint. Si solo se ocultara la UI, un POST a mano seguiría vaciando.',
      'Verificado: `?ws=3` → disponible; `?ws=10` (Leandro) y `?ws=9` (Martín) → no. El POST de reset NO se probó contra un cliente real: el `.env.local` apunta a producción y sería justo el accidente que esto viene a evitar.',
    ],
    commits: [{ sha: '50f0fa7', msg: 'El Reset y «Datos de Mauricio» solo en el cliente de prueba', lineas: 187, archivos: 7 }],
    archivos: [
      'lib/auth-session.ts — `WS_PRUEBA` + `exigirClienteDePrueba`',
      'tests/reset-workspace.test.ts — NUEVO. 4 casos, incluido el que el guard viejo dejaba pasar',
    ],
  },
];

export const PARTES: Parte[] = [
  { titulo: 'La barra, igual que en un workspace', detalle: 'Admin y Dev son `NavFamilia` como las otras cuatro y las pinta `<Familia>`: desplegables, chevron, caja y rail', estado: 'hecha' },
  { titulo: 'Todo el producto en el super admin', detalle: 'Las cuatro familias de producto además de Admin y Dev, para poder vender MaKo usándolo', estado: 'hecha' },
  { titulo: 'Las tabs que no tenían sentido', detalle: '/metodo y «MaKo» fuera de la barra (sin perder sus features), Guiones → Ads Writer en Dev, Grafo primero, «Administración» → «Admin»', estado: 'hecha' },
  { titulo: 'Un cliente por pestaña', detalle: 'El workspace viaja en `?ws=` y lo valida el proxy contra la sesión firmada. Varios clientes abiertos a la vez, y el panel de admin vivo en su pestaña', estado: 'hecha' },
  { titulo: 'Lo destructivo, solo en el cliente de prueba', detalle: '`WS_PRUEBA` + `exigirClienteDePrueba` en las tres capas, con test', estado: 'hecha' },
  {
    titulo: 'Jubilar la cookie de impersonación',
    detalle: 'La UI ya no escribe `mako_ws`, pero `lib/workspace.ts` la sigue leyendo por las sesiones que la tienen puesta, y `/api/admin/impersonate` sigue en pie. Sacarla cuando no quede ninguna viva — mientras esté, hay dos fuentes para el mismo dato',
    estado: 'sigue',
  },
  {
    titulo: 'El admin sin workspace propio',
    detalle: 'Si el usuario admin no tiene workspace asignado, las tabs de producto le dan 403. El flag `entrarComoDueno` existe y está enchufado en `<Familia>`, pero hoy ningún item lo usa: hay que decidir si esa es la salida o si el admin siempre debe tener su espacio',
    estado: 'cola',
  },
  {
    titulo: 'Lo que el Reset no puede limpiar',
    detalle: '`notificaciones` y `meta_campaign_drafts` no tienen `workspace_id`, así que la campanita del cliente de prueba muestra la de Mauricio. Hace falta una migración que les agregue la columna',
    estado: 'cola',
  },
];
