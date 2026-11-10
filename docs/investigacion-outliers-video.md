# Outliers de video: de dónde sacarlos para la tab Video (9/11/2026)

**Pedido de Martín (9/11/2026):** «vas a ver tus outliers primero… vamos a meter reels, vamos a meter algunos anuncios,
outliers, que tenemos que investigar… ver cómo conseguirlo, ver si hay algún tipo de API o algo así que nos traiga tipo los
mayores outliers». Son lo primero que ve la tab Video (la arma el chat «Tab Video»): el usuario elige uno y lo replica con la
plantilla guiada de `docs/plantillas-video/mensaje-para/PROCESO.md` (rama `punta/creator-activo`).

Este chat sólo investigó: no escribió código ni gastó un centavo. Las reglas de fuentes que pesan acá:
- La regla de Martín: «fuentes sólo legales, nada de scraping masivo».
- Apify, aprobado por Martín para Competitors Spy (1/11) y usado, con la misma clave, por la biblioteca de carruseles (4/11).
- Las reglas de `docs/hallazgos-competitors-spy.md`.

---

## 1. La recomendación, en una tabla

| Orden | Qué | De dónde | Costo | Legal | Qué hace falta |
|---|---|---|---|---|---|
| **1. Ya** | Los outliers de las cuentas que el negocio sigue en Spy, más los «Sugeridos» de la plataforma (al sumarlos se copia lo ya leído, sin gastar su clave) | `spy_piezas` (reels, shorts, anuncios), con el «×» que ya existe | **US$0 nuevo** | Lo ya aprobado para Spy | Sólo leer y ordenar: es lo que la tab puede mostrar el primer día |
| **2. Lo grueso** | Una **biblioteca de reels de la plataforma** por nicho, la misma de carruseles pero quedándose con los reels | El actor `apify~instagram-scraper` que ya usa la biblioteca de carruseles, desde el script de la PC | **~US$0,0023 por publicación** (medido): ~US$0,09 por cuenta (40 publicaciones). Con las lecturas que la biblioteca de carruseles ya hace: **US$0 más**. Para ampliarla a 100 cuentas y 30 hashtags por semana, más 30 cuentas nuevas halladas por hashtag: **~US$50–60 por mes** | Mismo riesgo que Spy y Carruseles (Instagram §4.2) | **El sí de Martín** a extender Apify a reels: es gasto y es su regla |
| **3. Legal** | **Tus propios outliers**: los reels del negocio que le fueron mejor que a su mediana | Su Instagram por Zernio: `lib/zernio-organico.ts` ya trae sus publicaciones con `vistas`, `meGusta`, `compartidos` y `tipo: 'reel'`. Si se conecta, su TikTok (Display API) y su YouTube | US$0 de MaKo; el complemento de Analytics de Zernio lo paga el negocio (sin él contesta 402) | **Totalmente**: es su propia cuenta | Pasar esas publicaciones por `multiplosDe`. Si «tus outliers» era literal, éste es el primero |
| **4. Cuando se firme** | **YouTube Shorts** por canal y por nicho | YouTube Data API (`playlistItems` + `videos.list`; `search.list` sólo desde un script semanal) | US$0 (cuota) | Sí, con la enmienda III.L para mostrar el «×» | **Que Martín acepte la enmienda III.L** en el pedido de cuota (`ENMIENDA_III_L = false` hoy) |
| **5. Anuncios** | Los anuncios en video que más tiempo llevan al aire | Spy: `apify~facebook-ads-scraper` con la clave del negocio. Más la captura con la extensión desde la Biblioteca de Meta y el Creative Center de TikTok, con un toque de la persona | Spy: lo de siempre. Extensión: US$0 | Spy: lo aprobado. Extensión: es lo que la persona ya está mirando | Nada para Spy; el lector de la captura de TikTok, si se quiere |

**Lo que NO conviene**, con el porqué, está en la §5. En corto:
- **TikTok orgánico:** no tiene ningún camino legal para un SaaS.
- **Proveedores que venden el dato raspado** (Virlo, SociaVault, EnsembleData): Instagram prohíbe *comprar* lo raspado.
- **Las APIs oficiales «de investigación»:** son para academia, sin uso comercial.
- **La API de la Biblioteca de Meta:** fuera de la UE sólo trae anuncios políticos.
- **La búsqueda oficial de hashtags de Instagram:** no dice de quién es el reel.

---

## 2. La fórmula del outlier: la que ya existe, no una nueva

**Se usa `lib/multiplo-rendimiento.ts` (`multiplosDe`, `chipDeMultiplo`, `explicarMultiplo`), tal cual.** Es la ÚNICA cuenta
del «3,7×» en MaKo desde el 5/11; tiene el test `tests/multiplo-rendimiento.test.ts`, que falla si aparece otra. Para un video:

```
veces = vistas del reel ÷ mediana de las vistas de HASTA 20 reels del mismo creador, en la misma red y el mismo formato,
        los publicados más cerca en el tiempo
```

- **Hacen falta al menos 7 para comparar.** Con menos no hay número (`pocas`), nunca uno inventado.
- **Ni se miden ni sirven de referencia:** lo de menos de 7 días (sus números todavía crecen), lo pagado (`#ad`,
  «colaboración pagada») y los sorteos.
- **«Fuerte» desde 2×** (`MULTIPLO_FUERTE`). Las franjas de vidIQ, si la tab quiere colores: 2–5×, 5–10× y más de 10×.
- **Anuncio:** sus **días al aire ÷ la mediana del anunciante**, con su rótulo propio («3× activo»). Es una señal, no un
  resultado: Meta no da los resultados de los anuncios de otro.
- **YouTube:** contesta `falta-enmienda` hasta que se firme la III.L. Recién ahí sale el número, con `LEYENDA_DERIVADA`.

**¿Contra la propia cuenta o contra el nicho? Contra la cuenta: el nicho es el FILTRO, no el denominador.**
- Contra la mediana del nicho ganan siempre las cuentas grandes. Una cuenta de 2 millones saca 400 mil vistas en un reel
  común; una de 8 mil que saca 150 mil es la que encontró algo, y es la que vale replicar.
- La comparación por cuenta normaliza el tamaño. Es lo que hacen vidIQ, Top Carousels y Virlo.
- Un detalle: la ayuda de vidIQ dice «el promedio» en un período parecido. MaKo usa la **mediana**, que no se infla con un
  solo viral, y se queda así.

**Un reel que llegó por un hashtag no tiene número hasta que se lee su cuenta** (`sin-cuenta`): lo que no se midió no se dice.
- Se ordena después de los medidos, por sus vistas, y se marca como «sin comparar».
- Para darle número: leer las últimas 40 publicaciones de ese creador. Cuesta ~US$0,09 y sólo vale la pena con los que ya
  traen muchas vistas.

**La vidriera** (lo primero que se ve):
- **Orden:** por `veces`, de mayor a menor.
- **Variedad:** como mucho 2 del mismo creador por cada 12 tarjetas (`conVariedad`, `lib/carruseles/variedad.ts`). Sin eso,
  la primera pantalla es de una sola cuenta (pasó con los carruseles el 6/11).
- **Ventana por defecto:** los últimos 90 días. Es una decisión de pantalla, no de la fórmula: un outlier viejo sigue siendo
  copiable, pero su audio y su tendencia ya pasaron.

---

## 3. El contrato de datos que la tab Video puede consumir

Una fila por outlier. Reusa los tipos de la casa en vez de copiarlos:
- `Multiplo` y `MotivoSinMultiplo`, de `lib/multiplo-rendimiento.ts`.
- `PiezaInstagram`, de `lib/instagram-perfil.ts`.

Los ids siguen la convención de Carruseles: **negativo = biblioteca de la plataforma, positivo = `spy_piezas` del negocio**
(`idDeBiblioteca`, `lib/carruseles/biblioteca.ts`). Con eso, los guardados, «Hacer el mío» y la API usan un solo número.

```ts
export type OutlierVideo = {
  id: number;                       // < 0 biblioteca de la plataforma · > 0 spy_piezas del negocio
  procedencia: 'biblioteca' | 'spy' | 'propio' | 'captura';
  plataforma: 'instagram' | 'youtube' | 'tiktok' | 'meta-anuncios' | 'tiktok-anuncios';
  formato: 'reel' | 'short' | 'tiktok' | 'anuncio';
  url: string;                      // el enlace a la publicación ORIGINAL, siempre a la vista
  ref: string;                      // shortCode de Instagram · videoId de YouTube · id de la Biblioteca
  autor: {
    usuario: string | null;         // @ sin la arroba
    nombre: string | null;
    url: string | null;
    seguidores: number | null;      // null = no se leyó, nunca 0
  };
  publicado: string | null;         // ISO; un anuncio: cuándo empezó a circular
  duracionSeg: number | null;       // ⚠️ Instagram: hoy `piezaDeApify` NO lee `videoDuration` (ver §6)
  miniatura: string | null;         // una copia NUESTRA (bucket de Spy), nunca la URL del CDN: vence en días
  texto: string | null;             // el pie o el copy; se borra a los 30 días, como en Spy
  metricas: {                       // todos nullable: un contador oculto no es 0 (Apify manda -1 → null)
    vistas: number | null;
    megusta: number | null;
    comentarios: number | null;
    compartidos: number | null;
    diasActivo: number | null;      // sólo anuncios
    variantes: number | null;       // sólo anuncios: cuántos anuncios usan esa creatividad (ver §6)
  };
  outlier: Multiplo;                // { veces, formato, metrica, valor, mediana, comparadas } o { veces: null, motivo }
  chip: string | null;              // chipDeMultiplo(outlier): «3,7×» · «3× activo» · null
  explicacion: string;              // explicarMultiplo(outlier): la frase del porqué, también cuando no hay número
  nicho: { clave: string; nombre: string } | null;  // el tema de la biblioteca (TEMAS_INICIALES) o null
  fuente: 'apify-instagram' | 'meta-business-discovery' | 'zernio-organico' | 'youtube-data'
        | 'apify-anuncios' | 'extension' | 'tiktok-display-propio';
  leidoEn: string;                  // cuándo se leyeron los números
};
```

Para replicar, el paso 1 de `PROCESO.md` necesita el video. **El video no se guarda: se pide fresco al abrir la plantilla**,
como ya hace la transcripción de Spy:
- Spy pide UNA publicación por Apify (US$0,0023) con su `videoUrl`, que vence en días.
- Se analiza y se transcribe con la IA del negocio.
- Nunca se republica ni se ofrece para bajar.

**En la API de MaKo** (regla de Martín, 25/10/2026: «todo MaKo se debe poder utilizar por API») van dos lecturas:
- **Listar** los outliers, con filtros de nicho, formato, plataforma y «sólo los fuertes».
- **Ver** uno.

Va al final de su área, sin repetir las palabras del área en el id. Antes de entregar se corre `tests/ops-center-bateria.test.ts`.

---

## 4. Lo que da cada fuente (medido o leído el 9/11/2026)

| Fuente | Qué da | Costo | Términos | ¿Sirve en un SaaS multi-negocio? |
|---|---|---|---|---|
| **Instagram `business_discovery`** (Graph API) | Por @: los medios de una cuenta business o creator con `like_count`, `comments_count` y `view_count` de reels (sólo por esta vía) | Gratis | La única oficial para cuentas ajenas | Sí, por cuenta CONOCIDA y con la Meta del negocio. No descubre: hay que saber el @. ⚠️ Desde abril de 2026, `view_count` suma las vistas de Facebook si el reel se publicó en los dos lados |
| **Instagram hashtag search** (`top_media`) | Los medios populares de un hashtag | Gratis | App Review «Instagram Public Content Access»; usos permitidos: campañas propias, sentimiento, concursos | **No.** No se puede pedir el `username`: sin autor no hay mediana ni «replicar a este creador». Y 30 hashtags cada 7 días por cuenta |
| **Apify `apify~instagram-scraper`** | Por cuenta o por hashtag: reels con `videoViewCount`, me gusta, comentarios, autor, miniatura, `videoUrl` | **US$0,0023 por publicación** (medido en casa) | Va contra Instagram §4.2, que también prohíbe *comprar* lo raspado | Ya corre en Spy con la clave del negocio, y en la biblioteca de carruseles con la de la plataforma. Es el camino más corto |
| **Apify (TikTok, `clockworks`)** | Videos con `playCount`, por cuenta y por hashtag | ~US$1,70 cada mil (tienda de Apify, sin verificar acá) | Contra los términos de TikTok | Técnicamente sí; **Martín no lo aprobó**. Es la vía si algún día se quiere TikTok |
| **TikTok Research API** | Videos públicos con métricas | Gratis | **Sólo investigadores académicos sin fines de lucro**; prohíbe el uso comercial | No |
| **TikTok Display API** | Los videos de la PROPIA cuenta del usuario con vistas, me gusta, comentarios y compartidos | Gratis (App Review) | Oficial | **Sí, para «tus outliers»**; no para ajenos |
| **TikTok Creative Center (Top Ads)** | Anuncios que funcionan, con CTR, me gusta y presupuesto, por país y rubro | Gratis, sin login | **No hay API oficial**; los actores de Apify usan su API interna | Sólo lo que la persona mira, capturado con la extensión, como «Guardar en Spy» |
| **TikTok Commercial Content API** | Anuncios | Gratis | Sólo anuncios que llegaron a la UE, el Reino Unido, Suiza o Turquía; con solicitud | No para LATAM |
| **Meta Ad Library API** (`ads_archive`) | Anuncios activos | Gratis | Fuera de la UE y el Reino Unido devuelve **sólo anuncios políticos**, con HTTP 200 y lista vacía | No para LATAM (ya medido el 31/10) |
| **Meta Content Library** | Publicaciones públicas | Gratis | Sólo investigación sin fines de lucro | No |
| **YouTube Data API** | Por canal: Shorts (≤180 s, `SHORT_HASTA_SEGUNDOS`) con vistas, me gusta y comentarios | Gratis: 10.000 unidades/día; `search.list` tope de 100 llamadas/día para toda la app | III.E.4.h prohíbe un score derivado sin la enmienda III.L; títulos 30 días | Sí: por canal a escala; por nicho, sólo un script semanal de la plataforma |
| **Virlo** | 14,7 millones de outliers de TikTok, Reels y Shorts por nicho, ya puntuados contra su creador; API pay-as-you-go y MCP | Desde US$10 de saldo; búsqueda ~US$0,05 por página; el chequeo de outlier ~US$0,50 (no verificado) | Raspa; Instagram prohíbe comprarlo. Reventa a clientes: sin dato | **Es justo el producto pedido**, pero es comprar lo raspado. Sólo con el sí de Martín y un permiso escrito para mostrarlo |
| **SociaVault** | Reels, TikTok y hashtags sin OAuth | ~1 crédito por pedido; packs de US$29 a US$399 | Raspa | No (misma razón) |
| **EnsembleData** | TikTok e Instagram por hashtag y usuario | US$100–1.400 por mes en unidades diarias | Raspa | No (misma razón) |
| **Foreplay** | +100 millones de anuncios; API de 1 crédito por anuncio | Planes desde US$49–59 por mes con 10.000 créditos | Reventa: sin dato | Sólo para una biblioteca de anuncios de la plataforma, con permiso escrito (ya escrito en `docs/hallazgos-carruseles.md`) |
| **Atria, Minea, BigSpy** | Anuncios | US$9–159 por mes | Atria tiene API; Minea y BigSpy, sin API confirmada | No es una fuente para MaKo |

**Lo que se probó desde esta sesión, y lo que no se pudo.**
- La red de la nube **bloquea** `api.apify.com`, `graph.facebook.com`, `developers.facebook.com`, `ads.tiktok.com`,
  `www.tiktok.com`, `sociavault.com`, `ensembledata.com`, `open.tiktokapis.com` y `foreplay.co`: el proxy contesta 403 al
  conectar.
- `www.googleapis.com` responde **403 sin clave**: hace falta la clave que ya usa `lib/youtube.ts`.
- Por eso los precios y términos de afuera salen de buscadores y de las páginas que citan. **Se verifican antes de pagar.**
- Ninguna de las fuentes gratis se pudo probar desde acá. Si Martín quiere el dato medido, el Cerebro las corre desde la PC
  sin gastar nada:

```bash
curl -s "https://www.tiktok.com/oembed?url=https://www.tiktok.com/@scout2015/video/6718335390845095173"
```

```bash
curl -s "https://api.apify.com/v2/store?search=instagram%20reel&limit=10"
```

El primero dice si el oEmbed de TikTok da miniatura y autor sin clave (sirve para mostrar un link pegado, sin métricas). El
segundo lista los actores de reels de Apify con su precio, sin gastar crédito.

---

## 5. Lo que NO conviene, y por qué

- **TikTok orgánico ajeno.** No hay camino legal comercial:
  - Research API: académico y sin fines de lucro.
  - Display API: sólo los videos propios.
  - Commercial Content API: anuncios de Europa.
  - Lo único es raspar con Apify, y Martín aprobó Apify sólo para Instagram en Spy.
- **Comprar outliers ya hechos** (Virlo, SociaVault, EnsembleData).
  - Instagram §4.2: *«You can't sell, license, or purchase any account or data obtained from us»*.
  - Es la misma regla por la que no se usan los puntajes de Top Carousels (sus términos además prohíben recorrerlos).
  - Virlo es lo más parecido a lo pedido; si alguna vez se quiere, es una decisión de Martín con permiso escrito.
- **El hashtag search oficial de Instagram.**
  - Parece la salida legal y no sirve: no dice el autor.
  - Su App Review sólo acepta campañas propias, sentimiento y concursos, no «descubrir lo viral de un nicho».
- **La API de la Biblioteca de Meta para LATAM.** HTTP 200 con lista vacía sobre anuncios comerciales (ya pagado el 31/10).
- **Un «outlier contra el nicho» como número.** Premia a las cuentas grandes (§2).
- **Un puntaje de YouTube antes de la III.L.** La sanción declarada es recorte o baja de la clave, y es la misma de
  producción.
- **Guardar la URL del CDN o el video.** Las dos vencen, y guardar el video de otro para mostrarlo es republicarlo.

---

## 6. Trampas para el chat que la construye

- **La biblioteca de carruseles YA PAGA los reels y los tira.**
  - `filasDeLectura` descarta `formato === 'REELS'` y `medio === 'video'` (`lib/carruseles/biblioteca.ts`).
  - Medido el 4/11: de 40 publicaciones por cuenta quedaban 9 carruseles. El resto (reels e imágenes) se cobró a
    US$0,0023 cada una y se tiró.
  - Quedarse con los reels de esas mismas lecturas no cuesta un centavo más.
- **La tabla ya los acepta, y el explorador de carruseles se los comería.**
  - `carruseles_biblioteca_piezas` (mig 0392) ya tiene `vistas` y `medio in ('carrusel','imagen','video')`.
  - Pero `recortarBiblioteca` filtra `medio !== 'imagen'`, por descarte: un reel guardado ahí aparecería como carrusel.
  - Antes de guardar reels en esa tabla, ese filtro pasa a `medio === 'carrusel'` (regla de AGENTS.md: se filtra por los
    tipos de X, nunca por «todo menos Y»).
- **Lo propio entra a `multiplosDe` como un «competidor» más.** La función agrupa por `competidor_id`: los posts del negocio
  van con un id fijo suyo, que no choque con los de Spy ni con los negativos de la biblioteca.
- **La duración de un reel no se lee.** `piezaDeApify` (`lib/instagram-perfil.ts`) no mapea `videoDuration`. La plantilla la
  necesita (cuenta palabras por segundo). Verificar el nombre del campo con la primera corrida, no de memoria.
- **TikTok no tiene formato para el «×».** `formatoDeMultiplo` devuelve `null` para `canal === 'tiktok'`: un TikTok saldría
  `sin-formato` en silencio. Si entra TikTok, va su rama, y nunca comparado con reels de Instagram.
- **`variantes` de un anuncio** (cuántos anuncios usan la misma creatividad) no lo lee nadie hoy. La Biblioteca lo muestra
  («N anuncios usan esta creatividad»); el campo en la salida del actor se verifica con una corrida, no se supone.
- **Lo propio llega con 0 mientras Zernio sincroniza.** `PublicacionOrganica.sinMetricas = 'pendiente'` marca un post cuyo 0
  no es «nadie lo vio» (`lib/organico-reglas.ts`). Ése no entra a la mediana ni se mide: se trata como `sin-numero`.
- **El salto de abril de 2026.** El `view_count` de `business_discovery` suma Facebook desde entonces. Si se mezclan reels
  leídos por Meta y por Apify en la misma mediana, se comparan números con distinta definición. La mediana mira hasta 20
  vecinos cercanos en el tiempo, así que casi no se cruzan; igual, la fuente va en la fila.

---

## 7. Lo que decide Martín (una línea cada una)

1. **¿Extender Apify a una biblioteca de reels de la plataforma?** Mismo actor, misma clave y mismo script que la de
   carruseles: US$0 más con las cuentas que ya lee, ~US$50–60 por mes para ampliarla. Sin esto, la tab arranca sólo con lo
   de Spy y lo propio.
2. **¿Aceptar la enmienda III.L de YouTube?** Es el pedido de ampliación de cuota, §5 «Analytics & Reporting». Sin ella no hay
   «×» en Shorts.
3. **TikTok, Virlo o Foreplay: hoy no.** Si alguno se quiere, cada uno es una decisión aparte con su costo y su permiso.
