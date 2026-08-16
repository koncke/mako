# Migración de multiplicatusresultados.com: Lovable → Vercel

> Auditoría del **2026-08-16**, con los anuncios de la campaña 029 corriendo contra esa URL.
> 45 hallazgos sobrevivieron a un intento de refutación; 6 se cayeron.
> **La premisa con la que se arrancó era FALSA** y está desmentida acá abajo: se creía que
> Lovable inyectaba metadatos y pixeles al publicar, porque el HTML servido pesa ~36 KB y el
> del repo ~25,7 KB. No los inyecta — la diferencia es otra cosa, y el bundle es idéntico.
> Es el mejor ejemplo de por qué una diferencia de tamaño no es un diagnóstico.

## 1. Veredicto

**Sí conviene, y es mucho menos riesgoso de lo que se creía — pero no por el motivo que se pensaba.** La premisa de partida era falsa: Lovable no inyecta metadatos ni pixeles. El bundle que sirve producción hoy es **byte-idéntico** al que produce `vite build` sobre el repo (mismo md5 en JS, CSS y los 10 assets), y todo lo que mide plata (Meta Pixel, Clarity, pixel de MaKo, Calendly) vive inline en `index.html` del repo. Lo único que se pierde es el analytics interno de Lovable (`/~flock.js`, un contador de pageviews redundante) y el badge "Edit with Lovable" (ganancia). El trabajo real de la migración no es reconstruir nada: es **un `vercel.json` de 15 líneas, un certificado pre-generado y un orden de pasos que no deje un solo segundo sin TLS válido.**

---

## 2. Qué se rompe si se hace mal

### BLOQUEANTE — Certificado: sin pre-generar, la caída es dura y no salteable

Vercel **no presenta ningún certificado** cuando le llega un SNI que todavía no emitió. Medido contra 4 IPs de Vercel (216.150.1.1, 216.150.1.193, 66.33.60.35, 76.76.21.123): las 4 devuelven `no peer certificate available` + `error:0A000126:SSL routines::unexpected eof`. Control: la misma IP con `-servername vercel.com` sí entrega cert válido, o sea el fallo es específico del SNI desconocido.

Eso no es una pantalla roja clickeable: es `ERR_SSL_PROTOCOL_ERROR` / `ERR_CONNECTION_RESET`. Y aplica a **todo el tráfico, incluido el frío de los anuncios** — no hace falta HSTS para que falle, porque no hay certificado que aceptar. HSTS (`max-age=31536000; includeSubDomains`, verificado en apex y www) es el agravante: mata el escape por `http://` y arrastra a `www`.

Los docs de Vercel lo confirman: la emisión HTTP-01 "only work[s] once the certificate validation request is successful, which happens once DNS records are added and propagated" — o sea, el DNS tiene que apuntar a Vercel *antes* de que exista el cert. Por eso hay que forzar la emisión por DNS-01 antes del corte.

### BLOQUEANTE — `vercel.json`: el preset Vite de Vercel NO trae fallback SPA

Verificado en el código fuente de `@vercel/frameworks` (bajado y parseado, 73 presets): el preset `vite` **no tiene `defaultRoutes`**. Sí lo tienen create-react-app, vue, svelte, preact, angular, astro y 33 más. Y la doc oficial de Vite en Vercel lo dice textual: *"If your Vite app is configured to deploy as a SPA, deep linking won't work out of the box"*.

Consecuencia: `GET /privacidad` devuelve el **404 de Vercel**, no el `NotFound.tsx` de la app. Hoy Lovable devuelve 200 con el index para cualquier path (medido: `/`, `/privacidad`, `/politica-de-privacidad` y `/asdkjhasd` dan los cuatro 200 con el mismo md5).

Honestidad sobre el radio de impacto, porque se infló en la auditoría: **el tráfico pago no se ve afectado** (los anuncios pegan contra `/`, que funciona sin rewrite). Y el link del footer es `<Link>` de react-router (navegación client-side, nunca toca el server) — de hecho el bundle en vivo contiene `path:"/privacidad"` pero **no** contiene "derechos reservados", o sea el `Footer` quedó tree-shaken afuera: hoy no hay link visible que romper. Lo que rompe es el **golpe directo a la URL**: quien la tenga cargada en el ad account, un revisor de Meta, un bot, un bookmark. *La afirmación "Meta exige esa URL" no la pudo verificar nadie — no hubo acceso al ad account.* Igual el fix cuesta cero y va antes del corte.

### BLOQUEANTE — Son DOS registros A, no uno

Medido contra el autoritativo `ns53.domaincontrol.com`:
- `multiplicatusresultados.com` → A `185.158.133.1`, TTL **3600**
- `www.multiplicatusresultados.com` → A `185.158.133.1`, TTL **3600** (es A plano, **no** CNAME: la consulta CNAME devuelve solo SOA)

Los dos sirven la página con **200 y el mismo `x-deployment-id`** — www no redirige. Migrar solo el apex no deja www muerto: deja **dos sitios vivos y divergentes** bajo el mismo dominio, y el que audita mira el apex, lo ve en Vercel y canta victoria mientras www sigue sirviendo el build viejo. Falla silenciosa.

### ALTO — Rollback: no toques Lovable durante 48-72h

El ingress de Lovable (`185.158.133.1`, reverse `lovable-app-cd-1-4.p.l5e.io`, Cloudflare-for-SaaS) **rechaza el handshake de hosts que no conoce**: `tls alert handshake failure`, alert 40, `no peer certificate available`. Reproducido con dos SNI inventados distintos.

Si alguien "limpia" el dominio en Lovable el día del corte, se pierde la red de rollback **y** todo el que tenga el DNS viejo cacheado queda sin sitio.

### ALTO — Dos publicadores sobre `main`

Lovable publica **por push y por botón** (sync bidireccional confirmada: los commits del bot vienen en pares "Changes" + "Publicó X" con 12 segundos de diferencia). Verificado además que un push por API a `main` (sin abrir Lovable) llegó a producción en ~20–33 minutos, con `x-deployment-id` nuevo.

Si conectás Vercel a `main` y dejás el dominio vinculado en Lovable, cada edición dispara los dos. No es una "carrera" — el DNS es una configuración única, gana quien esté apuntado — pero sí quedan dos pipelines construyendo y una superficie de edición ambigua.

Y hay un dato de magnitud que importa: **1 merge = 1 push = 1 deploy**. Los "Changes" intermedios quedan squasheados y no despliegan. Pero una sesión de trabajo real en Lovable son muchos merges: el 2026-04-01 hubo **36 merges en 1h45** (títulos tipo "Reduce Solistica logo size" → "Ajuste tamaño Solistica" → "Reduce Solistica and Kotkoff logos"). Con Vercel enganchado sin freno, eso son 36 versiones intermedias en vivo sobre los anuncios pagos.

### ALTO — `bun.lockb` describe un árbol que nadie probó

El repo tiene **tres** lockfiles. `package-lock.json` y `bun.lock` describen el mismo árbol (441 pares nombre/versión idénticos resolviendo alias, 0 diferencias; solo cambia el hoisting de `postcss-selector-parser`). Pero **`bun.lockb` no**: decodificando los integrity sha512 y buscándolos en el binario, 35 entradas (33 paquetes) están en otra versión — `rollup 4.21.3` en vez de `4.24.0` más sus **16 binarios `@rollup/rollup-<plataforma>`**, `@babel/parser`, `tslib`, `semver`, `yaml`, los `@floating-ui/*`, etc.

La cascada de detección de Vercel (leída en `@vercel/build-utils`) es: `bunLock && yarnLock → bun`, `yarnLock → yarn`, `pnpm → pnpm`, `packageLock → npm`, `bunLock → bun`. Con `package-lock.json` presente y sin yarn/pnpm, **hoy cae en npm** — pero por el orden de la cascada, no por decisión de nadie.

### MEDIO — Los pixeles no tienen guard de hostname

`grep -i "hostname|location.host"` sobre `index.html` (repo y servido) y sobre todo `src/`: **cero coincidencias**. Consecuencias:
- Cada carga de cualquier preview de Vercel manda un `PageView` al pixel `2410876022700571` que está optimizando la campaña 029. Sin acción deliberada.
- `src/components/CalendlyWidget.tsx:86-93`: al recibir `calendly.event_scheduled` dispara `fbq('track','Schedule')` + `fbq('track','Lead')`. Una reserva de prueba desde un preview mete **dos conversiones falsas irreversibles** en Meta — y una reunión real en la agenda de Mauricio.
- El endpoint de MaKo rutea por token, no por dominio (`route.ts:52` lo dice textual: "NO hay allowlist de origins"), y `Access-Control-Allow-Origin: '*'`. Un preview escribe en el workspace real.

### BAJO pero real — Headers y caché que hoy pone Lovable y Vercel no

Toda respuesta del vivo trae `Strict-Transport-Security`, `Referrer-Policy: strict-origin-when-cross-origin` y `X-Content-Type-Options: nosniff`. **No salen de ningún archivo del repo** (no hay `vercel.json` ni `_headers`) — los pone el edge de Lovable, y ese edge desaparece entero cuando el A apunte a otro lado. Verificado empíricamente que Vercel no pone ninguno de los tres por default (probado contra swr.vercel.app, ui.shadcn.com, react-hook-form.com y un template Vite pelado).

Y el caché va **al revés** de lo que se asumió: hoy los `/assets/*` salen con `public, max-age=31536000, immutable`. Vercel solo aplica `immutable` a `/_next/static` (Next.js), no a `/assets` de Vite — medido en excalidraw.com (Vite en Vercel, sin regla de caché en su `vercel.json`) y en un template Vite: los dos devuelven `public, max-age=0, must-revalidate`. Sin regla explícita, cada visitante revalida 326 KB de JS + 65 KB de CSS en cada pageview.

### Bug preexistente, independiente de la migración: la `og:image` da 403

`og:image` y `twitter:image` apuntan al bucket `gpt-engineer-file-uploads` de Lovable, y ese objeto responde **403 AccessDenied** en las 4 variantes de encoding probadas, incluido con UA `facebookexternalhit/1.1`. El bucket entero es privado (403 hasta para el listado y para paths inexistentes → probablemente nunca fue público).

Corrección importante: **esto NO afecta a los anuncios**. Un anuncio pago renderiza el creativo que vive en la cuenta de Meta, no scrapea `og:image`. Lo que rompe es el preview cuando alguien comparte el link por WhatsApp / lo postea orgánico / Meta re-scrapea. En un funnel B2B mexicano donde el link se reenvía por WhatsApp no es trivial, pero es **gravedad media, no alta**. Y el arreglo es el mismo se migre o no: bajar la imagen a `public/og.png` y reapuntar los tags — con el bonus de que corta la dependencia del bucket del proveedor que se está abandonando. Verificado que el camino funciona: `multiplicatusresultados.com/logo.png` devuelve 200 desde `public/`.

---

## Estado: la Fase A está HECHA (2026-08-16)

En el repo de la landing, sin tocar producción:

- **`vercel.json`** (commit `c4f6a0a0`) — los rewrites de SPA, los tres headers de
  seguridad que hoy pone el edge de Lovable, y el caché inmutable de `/assets/`. Mientras
  el sitio se siga publicando desde Lovable, este archivo **no hace nada**.
- **Guard de dominio en el Meta Pixel** (commit `629d1989`) — lista positiva de los dos
  hosts reales. Sin él, cada carga de cualquier preview mandaba un PageView al pixel que
  está optimizando la campaña, y una reserva de prueba metía dos conversiones que Meta no
  deja borrar.

⚠️ **`bun.lockb` NO se borró**, aunque el plan de abajo lo pida. El motivo apareció al
ejecutarlo: producción todavía compila en **Lovable**, que usa bun, así que sacarle su
lockfile no es el cambio de riesgo cero que el plan asumía. El lockfile que use Vercel se
fija con `installCommand` cuando el proyecto de Vercel exista (Fase B) — eso es reversible
y no toca la producción de hoy. El paso 3 del plan se lee con esta corrección.

Falta de la Fase A: **arreglar la `og:image`** (paso 6), que es independiente de la
migración.

## Estado: la Fase B, la parte que no necesita a nadie (2026-08-16)

Se compiló el repo y se desplegó el resultado en Vercel para PROBARLO, sin dominio y sin
tocar producción. El proyecto de prueba se borró después (410 en su URL).

**Lo que quedó verificado, con evidencia:**

| Pregunta | Respuesta |
|---|---|
| ¿El repo compila solo? | Sí. `npm install` + `vite build` con Node 24.17: **48 s**, sin tocar nada. |
| ¿`lovable-tagger` rompe el build de producción? | No. El import es estático pero el plugin solo corre en `mode === "development"`. |
| ¿Funciona el rewrite de SPA? | Sí. `/privacidad`, `/politica-de-privacidad` y una ruta inventada devuelven **200** con el index. Sin `vercel.json` serían el 404 de Vercel. |
| ¿Salen los tres headers? | Sí, con los valores exactos: HSTS `max-age=31536000; includeSubDomains`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`. |
| ¿El caché de assets? | `public, max-age=31536000, immutable`, con el content-type correcto. |
| ¿Es la misma página? | Sí: mismo `<title>`, el guard del Meta Pixel, el Pixel de MaKo `SV = 12`, su token y el id de Clarity. |

**Y se cerró la duda de los ~9,5 KB de diferencia** que abrió esta migración. Producción
sirve 37.815 bytes y el build 28.311. La sospecha era que Lovable inyectaba el `og:image` al
publicar — **es falsa, medida línea por línea**: `og:image`, `twitter:image`, `og:title` y
`og:description` son **idénticos** en los dos. Los 9,5 KB son el **badge de Lovable** (su
`<style>`, su fuente de `cdn.gpteng.co`) y `/~flock.js`: 35 apariciones en producción, 0 en
el build. Migrar no pierde nada de eso — lo gana.

⚠️ **La verificación se hizo con `curl` a propósito, y no abriendo la página.** `curl` no
ejecuta JavaScript, así que no dispara ni el Meta Pixel ni el de MaKo. Abrir un preview en
un navegador SÍ los dispara: el guard de dominio (commit `629d1989`) tapa el de Meta, pero el
de MaKo rutea por token y escribiría eventos reales en el workspace con `landing_url` de
`*.vercel.app`. Si hay que mirarlo con los ojos, se abre con `?mko_test=<algo>` para poder
borrarlo después con precisión.

**Lo que falta de la Fase B necesita credenciales que no están acá:**

1. **Conectar Vercel con la cuenta `mauriciobustoseguia`** — hay que instalar la GitHub App
   de Vercel en ESA cuenta. Es un flujo de OAuth en el navegador; el PAT no alcanza.
2. **Paso 9-A: bajar el TTL a 600** en GoDaddy, en `@` y en `www`. Es aditivo y no mueve
   tráfico, y es lo que define la ventana de rollback. Confirmar contra ns53 **y** ns54 que
   ya devuelven 600 antes de empezar a contar la hora.
3. **Paso 9-B: pre-generar el certificado** con `vercel certs issue … --challenge-only` y
   cargar los dos TXT `_acme-challenge` en GoDaddy. También aditivo.

## 3. El plan, en orden

**Regla de oro: el DNS se toca en el PASO 9, y ni un minuto antes.** Todo lo de arriba es reversible y no toca producción.

### Fase A — Preparar el repo (cero riesgo, prod intacta)

**1. Fijá el commit de referencia.** Anotá el SHA de `main` y el `x-deployment-id` que sirve producción ahora. El repo se mueve solo: durante la auditoría `main` pasó de `3b9b5822` → `3d9193ea` en 40 minutos, y el vivo estuvo hasta ~20 min atrás del repo. Todo lo que sigue se verifica contra ese SHA.

**2. Crear `vercel.json`. Necesita TRES cosas, no una:**
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "X-Content-Type-Options", "value": "nosniff" }
    ]},
    { "source": "/assets/(.*)", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
    ]}
  ]
}
```

**3. Borrar `bun.lockb`** (o fijar `installCommand: "npm ci"` en el proyecto de Vercel; hacer las dos cosas es mejor). Ojo: Vercel corre `npm install --no-audit`, no `npm ci` — verificado en `@vercel/build-utils`. Que `npm ci` pase implica que `npm install` pasa, pero no es el comando real.

**4. No toques `lovable-tagger`.** `vite.config.ts:4` lo importa **estático**, fuera de todo condicional, aunque el plugin solo se ejecute en `mode === "development"`. Reproducido: sin el paquete instalado, `vite build` de producción muere con `Cannot find package 'lovable-tagger'` **antes de transformar un solo módulo**. Si se saca, se saca el import Y el uso en el array de plugins en el mismo commit. Y **no agregues `NODE_ENV=production`** al proyecto de Vercel (verificado: con npm 11, eso activa `omit=dev` y mata el build).

**5. Guard de hostname (recomendado, antes de que exista el primer preview).** Como **allowlist positiva de los dos hosts**, nunca como `hostname !== 'multiplicatusresultados.com'` — eso dejaría mudo todo lo que entre por `www`, que hoy sirve 200. Y ojo con la sintaxis: `fbq('init', ...)` en `index.html:35` es código de nivel superior, un `return` desnudo ahí es `Illegal return statement` y **apaga el pixel también en producción**. Va como `if (hostPermitido) { fbq('init', …); fbq('track','PageView'); }`. Los `Schedule`/`Lead` no viven en `index.html` sino en `CalendlyWidget.tsx:88-90`.

**6. Arreglar la `og:image`** (bajar a `public/og.png` ~1200×630 y reapuntar los dos tags). Independiente de la migración, pero es el momento.

### Fase B — Vercel en paralelo, sin dominio (prod intacta)

**7. Importá el repo, deployá, probá en la URL `*.vercel.app`.** Verificá que el build sale verde y que los hashes coinciden con producción. Node: el default de Vercel hoy es **24.x** (no 22.x) y el build está verificado en v24.17.0 — si pineás algo, pineá `24.x`.

En esa URL de preview, **no completes una reserva de Calendly** (paso 5 debería cubrirte, pero es la única acción irreversible de toda la migración). Si vas a probar el tracking end-to-end, abrí con `?mko_test=<id>` — queda sellado el campo `prueba` en cada fila y se borra con precisión después. Aviso honesto: `mko_test` **marca pero ningún reporte excluye** — el único filtro por esa columna en todo el repo del dashboard es hacia adentro (`landing-token.ts:474-475`). Y como el repo ya está en `SV = 12` (con `landing_url` en todos los eventos, no solo el pageview), también podés limpiar por `landing_url like '%vercel.app%'`.

**8. Agregá `multiplicatusresultados.com` y `www.…` como dominios del proyecto**, con la apex como primaria. Esto **no** dispara emisión de cert (el HTTP-01 falla contra Lovable) y **no** quema la opción de pre-generar. Ojo: la condición documentada es no tener ya un cert emitido, no "no haber agregado el dominio". No agregues el wildcard como dominio del proyecto — eso te obligaría a mover los nameservers a Vercel, que es muchísimo peor con anuncios corriendo.

**9-A. Bajá el TTL de `@` y de `www` a 600 y esperá >1 hora.** *Esto es el primer toque de DNS, y es aditivo/reversible: no mueve tráfico.* El TTL actual es 3600 en los dos (confirmado contra ns53 **y** ns54, o sea no es anomalía de un servidor). Ese número es tu ventana de rollback. Que 600 es aceptado en la zona no es suposición: el TXT del SPF ya corre a 600 en el mismo GoDaddy, y el negative-cache del SOA también es 600. **Reconsultá ns53 y ns54 y confirmá que devuelven 600 antes de empezar a contar la hora** — el reloj arranca cuando el TTL nuevo se sirve, no cuando apretás guardar.

**9-B. Pre-generá el certificado por DNS-01:**
```
vercel certs issue multiplicatusresultados.com www.multiplicatusresultados.com --challenge-only
```
Sin wildcard: no hay otros subdominios en juego y el wildcard solo agrega ambigüedad. Cargá los TXT `_acme-challenge` y `_acme-challenge.www` en GoDaddy y verificá. **Los TXT son aditivos: no mueven un byte de tráfico.** Terreno despejado, verificado: no hay CAA (consultado por DoH en apex, www, `com` y raíz — NODATA legítimo en todos), no hay DNSSEC (`delegationSigned: false`, DS y DNSKEY vacíos), no hay `_acme-challenge` residual (NXDOMAIN), no hay `_vercel` previo.

*Único punto sin verificar de todo el plan: que esa cuenta de Vercel no tenga ya un cert emitido para el dominio. Requiere `vercel certs ls` autenticado. La ausencia de `_vercel` y `_acme-challenge` en DNS lo sugiere fuerte, pero no lo prueba.*

**10. Verificá el cert CONTRA el edge de Vercel, sin tocar tráfico:**
```
curl -sI --resolve multiplicatusresultados.com:443:<IP-del-domain-card> \
  https://multiplicatusresultados.com -o /dev/null -w "%{http_code} %{ssl_verify_result}\n"
```
Y lo mismo para `www`. **Sin `-k`** — el `-k` desactiva exactamente lo único que estás midiendo; con un cert equivocado te da 200 y te manda al corte con una falsa luz verde. Tiene que dar `200 0`. La técnica está reproducida contra Vercel: `--resolve nextjs.org:443:216.150.1.1` → `200`, `verify=0`.

**Usá la IP que muestre el domain card del proyecto**, no la del doc (76.76.21.21) ni las de hola-mako.com (216.150.1.1 / 216.150.16.1 — esas las cargó Martín a mano en Porkbun, no son un default de Vercel; copiarlas puede dejar el dominio misconfigured).

Para verlo en el navegador: la misma jugada con una línea en `hosts`. Acordate de sacarla después.

### Fase C — El corte

**11. ACÁ se toca el DNS de verdad.** Cambiás los **dos** registros A en GoDaddy (apex y www) por lo que diga el domain card. Recordá que la forma cambia: Vercel normalmente quiere A en el apex y **CNAME** en www (formato `d1d4fc829fe7bc7c.vercel-dns-017.com`), no dos A.

**Checklist obligatorio antes de apretar guardar:**
- [ ] `vercel.json` mergeado y desplegado, y `/privacidad` responde 200 en la URL `*.vercel.app`
- [ ] `curl --resolve` sin `-k` devuelve `200 0` en **apex Y www**
- [ ] TTL 600 confirmado contra ns53 y ns54, hace más de una hora
- [ ] `bun.lockb` borrado o `installCommand` fijado
- [ ] El deploy de Vercel corresponde al SHA que anotaste en el paso 1
- [ ] Nadie tocó Lovable

No hay corte parcial: GoDaddy no hace ruteo ponderado. Técnicamente podrías poner dos A en la misma etiqueta y tener round-robin ~50/50, pero con dos backends sirviendo builds distintos bajo el mismo hostname te queda split-brain de cookies, cert y pixel. **Corte limpio.**

**12. Verificá inmediatamente:** los 3 headers de seguridad presentes, `/assets/*` con `immutable`, `/privacidad` con 200, el badge de Lovable ausente, `/~flock.js` ausente, y el pixel disparando. Baseline de comparación medido desde Buenos Aires: 200 siempre, total entre ~60 ms y ~630 ms con outliers de handshake de medio segundo (no "~50-67ms", esa ventana era demasiado angosta).

**13. NO toques Lovable por 48-72h.** Ni desvincular el dominio, ni bajar de plan, ni desconectar GitHub. (Sobre esto último: desconectar GitHub es irreversible — al reconectar, Lovable **crea un repo nuevo**, no vuelve al mismo.)

**14. Decidí la superficie de edición** antes de que se convierta en un problema. Opciones verificadas, todas con `main` como rama de producción:
- `git.deploymentEnabled: {"main": false}` en `vercel.json` → Lovable sigue comiteando y nada se despliega solo
- Deploy Hook (URL que anda por **GET**) → el "botón de publicar" puede ser un bookmark en el celular, un botón en el dashboard propio, un comando de WhatsApp
- Rama de producción distinta de `main` + "Promote" (mueve el botón al dashboard de Vercel, donde Mauricio no entra)

*Caveat documentado: los deploy hooks no disparan si está `github.enabled: false`. La doc no dice nada sobre la combinación con `git.deploymentEnabled`. Cada freno por separado está confirmado; los dos juntos, no.*

**15. Fuera de la migración pero más urgente que ella:** el dominio **vence el 2026-10-21**, en ~2 meses (RDAP de Verisign y de GoDaddy coinciden al segundo). Hay que confirmar el auto-renew y la tarjeta en GoDaddy — RDAP no lo expone. Agravante: el registrante está detrás de Domains By Proxy, así que los avisos llegan solo al mail de la cuenta de GoDaddy. Y no leas el `clientRenewProhibited` como riesgo: es un lock estándar del registrador contra comandos EPP externos, no bloquea el auto-renew que ejecuta GoDaddy.

---

## 4. Cómo se vuelve atrás

**Acción:** volver los **dos** registros (apex y www) a `A 185.158.133.1` en GoDaddy.

**Tiempo:** 2 minutos de trabajo + lo que diga el TTL vigente. **Con TTL en 600: ~10 minutos.** Con el 3600 actual: hasta 60. Ese es el motivo entero del paso 9-A.

Aclaración honesta: el TTL acota a los resolvers que lo respetan. La cola real (ISPs que clampean, caché de OS y de navegador) es más larga. 10 minutos es el número de planificación, no un techo duro.

**La condición que hace que el rollback exista:** que el dominio siga vinculado en Lovable. Si no, el ingress devuelve alert 40 y no hay a dónde volver. (En puerto 80 sí contesta — `409 Conflict`, `error code: 1001` — pero con HSTS pineado a un año ningún navegador que ya visitó va a intentar HTTP, así que en la práctica es una pared.)

**No hay caché HTTP que purgar.** El HTML sale con `no-cache, must-revalidate, max-age=0` y sin `cf-cache-status` ni `Age`. Los assets tienen hash en el nombre. Y descarté las tres vías por las que un cliente podría quedar pegado a la versión vieja: **no hay service worker** (`/sw.js` y `/service-worker.js` dan 404, cero menciones en el HTML), **no hay chunks lazy** (`App.tsx` importa las 3 páginas estáticamente, sin `manualChunks`, un solo bundle), y no hay `<meta http-equiv>` de caché. El único caché que importa en el corte es el de DNS.

**Lo que NO se revierte con el rollback:** las conversiones que hayas metido en Meta desde un preview. Eso no se borra. Por eso el paso 5 y la regla de no completar reservas.

---

## 5. Qué no mejora (o directamente empeora)

⚠️ **CORRECCIÓN del 2026-08-16, y cambia la mitad de este punto.** Lo de abajo asumía que
Lovable publica solo en cada push — era una de las seis cosas que la auditoría marcó como
sin verificar. Se midió: un push a `main` estuvo **~35 minutos sin salir**, y salió cuando el
dueño apretó Publicar a mano. Si publicar es siempre manual, migrar **sí** elimina un paso
real del día. Lo que sigue siendo cierto es la otra mitad: el botón no desaparece, se mueve —
y hay que elegir a dónde (paso 14).

**No elimina el paso de publicar. Elimina el control.** Esto hay que decirlo claro porque es la queja que originó todo. Hoy hay un freno: push a `main` y publicación son cosas distintas — durante la auditoría, `main` tenía `SV = 12` mientras producción servía `SV = 11`. Con Vercel enganchado a `main`, cada merge es un deploy a producción sobre los anuncios. Eso no es "sacar un paso": es sacar la única revisión humana entre el editor y el tráfico pago. Y si le ponés freno (paso 14), el botón no desaparece — **se mueve**. La pregunta real no es "¿migro para no apretar Publicar?" sino "¿dónde quiero que viva ese botón?".

**Lovable ya tiene staging.** `preview--mauricio-boost-landing.lovable.app` existe y es de este proyecto (un subdominio inventado devuelve 404 "Project not found"), redirige al login del proyecto y tiene `x-robots-tag: noindex`. La doc lo llama textualmente "staging environment", con links compartibles de 7 días. Lo que Vercel agrega **no** son "previews donde no había": son previews **inmutables por commit** (URL fija que no se mueve, versus el preview único de Lovable que siempre muestra lo último), sin login, sin vencimiento, más rollback instantáneo a un deploy anterior.

**Se pierde el analytics de Lovable.** `/~flock.js` (21.296 bytes, bundle de Parcel) postea a `/~api/analytics` (endpoint vivo, responde `202 Accepted`). Precisión: **no mide Web Vitals en este sitio** — el código de CLS/FCP/LCP/TTFB/INP está detrás de un gate que exige el atributo `web-vitals` o `data-web-vitals`, y el tag no lo tiene. Lo único que manda es `page_hit`. Es un contador de pageviews, redundante con Clarity, el pixel de MaKo y el propio Meta. *Salvedad honesta: "nadie mira flock" no se pudo verificar — nadie tuvo acceso al panel de Lovable.*

**El editor de Lovable sigue funcionando igual.** Editor, preview interno y chat son de Lovable, no del hosting; el repo es de Mauricio y la sync con GitHub sigue viva (disponible en todos los planes, incluido Free). Bajar de plan tampoco despublica ni desconecta dominios ya conectados — lo que no podés en Free es conectar dominios **nuevos**. Pero si además bajás a Free, el chat pasa a 5 créditos diarios / 30 mensuales: "igual" solo aplica si mantenés el plan.

**Quién edita hoy, no está resuelto.** Los últimos commits son de dos naturalezas distintas: `gpt-engineer-app[bot]` (7 de los últimos 8) y pushes humanos directos por la Contents API. Mirando *qué* tocan los del bot: 5 tocan solo `index.html` (el snippet de tracking de MaKo) y 2 tocan `VideoHeroSection.tsx` ("Corrigió VSLs"). Yendo hasta junio es lo mismo: "Ajustó tracking del VSL", "Capturó token lead en beacons". Es plomería de tracking — trabajo de Martín pegado por el editor de Lovable, no Mauricio editando copy. **El log no dice cómo edita Mauricio el copy. Eso hay que preguntárselo, no inferirlo.** Y el cambio más reciente esquivó Lovable por completo, lo cual prueba que el camino sin Lovable ya funciona.

**Migrar no es "reproducir el sitio actual".** El repo puede estar adelantado de producción el día del corte. Si al momento de migrar `main` tiene un commit sin publicar, ese cambio sale al aire **junto con** el cambio de hosting. Decidí explícitamente: o publicás desde Lovable primero para igualar, o lo aceptás como parte del cutover. No superpongas dos cambios sin querer.

**Se pierde el edge de Cloudflare que hoy pone Lovable gratis.** Medido: se setea `__cf_bm`, o sea hay bot management activo. **No medido y probablemente falso**: no apareció header `alt-svc` en ninguna respuesta ni registro HTTPS/SVCB en DNS, así que el HTTP/3 no está demostrado; y de reglas de WAF aplicadas a este hostname no hay absolutamente ninguna evidencia. Y no es quedarse sin nada: el edge de Vercel trae su propia mitigación. Es un cambio de proveedor de borde.

---

### Lo que quedó sin verificar (dilo antes de que muerda)

1. Si esa cuenta de Vercel ya tiene un cert emitido para el dominio → requiere `vercel certs ls`.
2. Si Lovable auto-publica en cada push o si alguien apretó Publicar → publicar no deja commit, así que las dos hipótesis son indistinguibles hacia atrás. Se cierra en una pasada: anotá el `x-deployment-id`, pusheá un comentario HTML inocuo, polleá el header **sin abrir Lovable**, y esperá ~30 min antes de concluir que no publicó (los dos deploys medidos tardaron ~20 y ≤33 min).
3. Si Meta exige la URL de política de privacidad en esta cuenta → nadie tuvo acceso al ad account.
4. Si el pixel tiene "Traffic Permissions" (allow-list de dominios) en Events Manager → por default viene sin restringir, hay que asumirlo abierto.
5. Si existe un forward tipo `contacto@multiplicatusresultados.com` → los MX (`smtp`/`mailstore1.secureserver.net`) y el SPF con `?all` son la plantilla por defecto de GoDaddy sin tocar, y no hay DKIM ni DMARC ni autodiscover. El mail real de Mauricio es `mbustos@elevate.com.mx`, en Google Workspace sobre nameservers de SiteGround: intocable desde este dominio. Pero un forward no deja rastro en DNS. Es una pregunta a Mauricio, no una alerta.
6. La combinación simultánea de `git.deploymentEnabled` + deploy hooks.