# /vsl/web-generator — los valores medidos de su referencia

**Referencia:** HighLevel AI Studio — https://www.gohighlevel.com/ai-studio
**Medido:** 11/11/2026 con Chromium (getComputedStyle a 1440 y 390) y **rehecho el 14/11/2026** contra la versión de hoy: su HTML
bajado con `curl` trae ADENTRO el CSS y los scripts de cada sección (son bloques de «código propio» del constructor de HighLevel),
así que las medidas, las curvas, las duraciones y los umbrales salen de ahí, no de una captura. Capturas, videos y hovers del
14/11: side-session-notes/…/referencias-landings/web-generator/ (relevo.md).
**Diseño copiado en:** `app/vsl/_competencia/disenos/web-generator.tsx`. **Contenido:** `app/vsl/_competencia/web-generator.ts`.
**Lo que se ve adentro de los marcos:** el banco `C:/dev/bancos-portada/banco-web-generator-landing` (generar.mts → capturar.mjs →
recortar.py): las landings que arma Web Generator con cada diseño y objetivo, LLENADAS con los textos de un negocio inventado por
objetivo (rellenos.mts, escritos a mano: ningún corchete a la vista), dibujadas con su render público (`htmlDePagina`,
`documentoExportable`) y fotografiadas. Sin IA, sin base. El video del hero: `panel/` (el Panel real grabado).

⚠️ Su HTML trae también «Built with AI Studio» y «Meet your 24/7 AI Team», pero esas dos secciones están escondidas en todos los
anchos (`desktop-only mobile-only tablet-hide`): no se copian.

## Fuentes y colores

- Todo en Poppins (400/500/600/700). En MaKo: Poppins 400, 600 y 700 (`public/vsl-assets/fuentes/poppins/`).
- Sus degradados violetas pasan al azul de MaKo: títulos `linear-gradient(96deg, #3B6FF6, #6D4AF0 55%, #7C3AED)` →
  `#2F6FED → #5B8CF0 → #1F57C8`; botón `linear-gradient(111deg, #7C3AED -2.59%, #3B82F6 54.66%, #A855F7 111.92%)` →
  `#1F57C8 → #2F6FED → #5B8CF0`; el naranja del deslizador (`#F97A16`) → el dorado de MaKo (`#F2B01E`).
- Hero `#07223D`; cápsula `#1C3249` con borde `#86CBFA`; titular `#F4F8FE`, segunda línea `linear-gradient(90deg, #7CC4FF, #A9D8FF
  55%, #D2E9FF)` (en MaKo `#8DB0F4 → #B4CBF8 → #DCE7FC`); bajada `#EEF4FC`. Tintas: `#101828` títulos, `#475467` texto, `#7A8697`
  apagado, `#E7EBF1` líneas, `#F8FAFD` lavado, verde `#0F7A45` sobre `#E8F6EF`.

## El botón (el mismo en todas las secciones)

`padding: 15px 34px`, radio 10, 15,5 px 600, `-0.01em`, `box-shadow: 0 12px 26px -12px rgba(79,70,229,.85)`;
`transition: transform .4s cubic-bezier(.25,1,.5,1), opacity .4s, box-shadow .4s`. Con el mouse (sólo con puntero fino):
`opacity .92; transform: translateY(0) scale(1.03); box-shadow: 0 18px 34px -12px rgba(79,70,229,.95)`. A 520 o menos, a lo ancho.
El del cierre es otro: sube 2 px en .3 s con rebote y baja a `scale(.98)` al apretar.

## Sección por sección

- **Hero** (`.ais`): fondo azul noche (`#04192C`) que a partir del 35 % del alto se aclara hasta el blanco (muestreado de su imagen
  de fondo: `#03264C` 46 %, `#055CAB` 66 %, `#0092E2` 76 %, `#ADE1F9` 86 %, blanco 96 %), y la tarjeta arranca 30 px debajo de la barra; grilla `1fr 1fr`, `gap: 3.5em`; cápsula 12px 32px, `clamp(14px, 1.7vw, 17px)`; titular `clamp(34px, 5.4vw,
  62px)` 600, `line-height 1.06`, `-0.035em`, la segunda línea en bloque; bajada `clamp(16px, 2vw, 21px)`, 1,5. A 760 o menos, una
  columna centrada.
  - **La tarjeta del constructor:** blanca al 96 %, `blur(16px)`, radio 26, `16px 16px 18px`, borde `rgba(154,196,255,.35)`, sombra
    `0 1px 2px rgba(7,20,40,.2), 0 34px 80px -20px rgba(7,20,40,.6)`, una raya de luz de 1 px arriba. Caja de pedido redonda
    (`6px 6px 6px 16px`, borde 1,5 px `#E1E8F2`; con foco, borde azul al 60 % y anillo de 4 px al 12 %), letra 15,5 px, botón
    redondo de 46 px que crece a 1,08 con el mouse y baja a ,94 al apretar. Cuatro tarjetas en grilla (12 px), `10px 10px 12px`,
    borde 1,5 px `#E7EDF5`, radio 16; con el mouse suben 3 px con rebote (`.3s cubic-bezier(.34,1.56,.64,1)`) y sombra; al apretar
    `scale(.97)`. Rótulo 12,5 px 600 y debajo 10,5 px `#98A2B3`.
  - **Al verse (umbral ,35)**, a los 600 ms se escribe solo el pedido de la primera tarjeta, **34 ms por letra**; 380 ms después
    las tarjetas salen (`.26s`, bajan 8 px y a ,98) y entra la ventana (`.55s` con rebote, desde 18 px abajo y ,98). La ventana: barra
    con los tres puntos de 10 px, la dirección al centro (11,5 px) y el estado a la derecha con su ruedita (0,8 s por vuelta);
    debajo, la barra de progreso de 2,5 px que se llena en **5,6 s lineales**. Los estados: «Reading your prompt…» (0),
    «Choosing a layout…» (550 ms), «Writing your copy…» (1100), «Building…» (1500, con el barrido de luz de 90 px que baja en
    2,6 s), el lavado de color que se abre en círculo desde arriba (1950, 1 s), el titular que se escribe a 30 ms por letra (2300) y
    las piezas que saltan (`.55s`, desde 14 px y ,96, con rebote); a los **5650 ms**, el borde azul, el destello que cruza (,9 s) y la
    pastilla verde «Ready to publish · 5.7s» que salta desde ,6. Aparece «Build another:» con seis chips (6px 13px, 12 px; con el
    mouse suben 1 px y se ponen azules).
  - **En MaKo:** la misma tarjeta y los mismos tiempos. El pedido que se escribe es un link (la caja de MaKo dice «Listo para
    replicar» al pegarlo) y la ventana muestra la **grabación real de Replicar** (`sitio/replicar.webm`), con «Con MaKo Pro»; los
    estados son los de la app («Leyendo la página…», «Replicando…»). Las cuatro tarjetas y los chips son los **diseños** de Web
    Generator: tocar uno arma, con los mismos tiempos, la landing que sale con ese diseño (su foto real, que se descubre de arriba
    abajo).
  - Debajo del hero, su **video de producto** (1080 de ancho, radio 20, corre solo y sin sonido, con «Enable sound»). En MaKo: el
    **Panel real de Web Generator grabado** (banco `banco-web-generator-landing/panel`: el `Inicio` de la app compilado con esbuild):
    se toca un diseño, sale «¿De qué quieres crearla?», se toca el objetivo y aparece la landing; en bucle, sin sonido, corre sólo a la
    vista. Sin la mascota («Highly»).
- **Galería** («They typed a sentence…»): título 42/62,4 600 negro (42 px también en el teléfono: lo fija un `style` en línea), la segunda línea en degradado (119deg);
  debajo una línea en cursiva gris de 18 px. Son las únicas entradas de animate.css que quedan vivas: el título sube desde su alto
  en .6 s lineal y la línea hace fadeInUp en 1 s. La
  sección mide `--pin` = 3,2 × `--stage` (2,6 en el teléfono) y adentro la pared queda **fija** (`position: sticky`) en un escenario
  cuyo alto sale del contenido (la pared ocupa el 78 %, entre 42 y 100 vh). Ocho tarjetas en dos filas (`--w` en vw × `--cs`,
  `--ar` de cada imagen; 2,2 vw entre ellas, 4 vh entre filas; 2,1× de ancho y 4 vw a 760 o menos). **Con el scroll** (el 68 % del
  recorrido) pasan de desparramadas a su lugar: cada una con su corrimiento (en % del ancho y del escenario) y su giro (−20° a 13°),
  las más lejanas llegan últimas (20 % de demora), ease-out cúbico. Armadas, **corren**: arriba hacia la izquierda y abajo hacia la
  derecha, 38 px/s con un arranque de 900 ms, tres copias para que nunca se vea el borde. Cierre: «Yours could be next.» 17 px 500
  `#475467` y el botón a 22 px. Con «reducir movimiento», armadas y quietas.
  - **En MaKo:** las ocho tarjetas son landings reales de Web Generator (diseño × objetivo), con el nombre en una etiqueta.
- **Contadores** (`.hst`): `min(100% - 40px, 1150px)` entre dos rayas `#DADADA`, `80px 0 76px`; título `clamp(28px, 3.4vw, 42px)`,
  58 px abajo; tarjetas (30 px entre ellas) de 170 de alto, `26px 22px 28px`, radio 22, borde `#E4E4E4`; número `clamp(36px, 3.6vw,
  46px)` 700 con su degradado gris; rótulo 15 px, `.2em`, mayúsculas, 20 px arriba. **Cuentan al verse** (umbral ,5) en **1,6 s**
  con ease-out cúbico y terminan en el texto escrito; con el mouse, `scale(1.03)` en .4 s. 2 columnas a 980, 1 a 480.
- **¿Qué es?** (`.wis`): `min(100%, 1180px)`, `62px 20px 66px`; encabezado de 780 centrado (título `clamp(29px, 4.2vw, 46px)`,
  bajada `clamp(16px, 2vw, 19px)` 1,62); grilla `1fr 1.06fr`, 54 px. Bloques: título 19 px 600 azul, texto 15 px 1,66, 30 px entre
  ellos; el botón 26 px abajo. **El deslizador** (3:2, 4:3 a 940; radio 12): el «antes» (una caja de pedido blanca sobre azul
  noche) recortado con un **borde de papel rasgado** (un camino al azar con semilla 7, cada 12 px) dibujado en naranja de 4 px; un
  asa de 32 px con borde de 3 px (crece a 1,09 con el mouse); **chispas** de colores al arrastrar (canvas, mezcla «lighter»); al
  verse, a los 420 ms el corte viaja de 96 % a **47 % en 1,5 s**; se arrastra, se toca o se mueve con las flechas (2,5 %; 10 % con
  Mayús).
  - **En MaKo:** el «antes» es la pregunta de MaKo al crear desde un diseño («¿De qué quieres crearla?») con el objetivo elegido; el
    «después», la landing que sale.
- **¿Qué puede armar?** (`.wcb`): `min(100%, 1340px)`, `64px 20px`; título `clamp(28px, 4.2vw, 46px)`. ⚠️ Su CSS arma primero una
  lista vertical de 350 a la izquierda (con subtítulo y número) y AL FINAL del mismo bloque la pisa: lo que se ve es una **fila de
  pestañas centradas** (10 px entre ellas, `flex: 1 1 0`, mínimo 150, `16px 12px 18px`, radio 14, ícono de 42 en caja de radio 11,
  nombre 14 px 600, sin subtítulo ni número) y la ventana debajo a todo el ancho. La activa: fondo de su color suave, borde de su
  color, el ícono lleno y **una barra de 2,5 px abajo que se llena en 5,4 s**; entonces pasa sola a la siguiente (no pasa mientras el
  mouse está sobre la fila). La ventana (radio 16): barra «AI Studio preview», la **barra de pedido** donde se escribe a **19 ms por
  letra** con su cursor, y la vista (580 de alto, `34px 38px`, `#FBFCFE`): título y texto centrados (560) y la maqueta de 780 que
  entra pieza a pieza (`110 + 105 ms × i`, desde 9 px y ,985); al terminar, el borde de la ventana toma su color. A 1060 la fila se
  desliza; a 920 pestañas de 132 y la vista sin alto fijo.
  - **En MaKo:** siete tipos; lo que se escribe son los ejemplos de la caja de MaKo o el objetivo de la plantilla; lo que entra es la
    foto real de esa landing (la réplica, su grabación con «Con MaKo Pro»).
- **Por qué** (`.why`): `min(100%, 1120px)`, `56px 20px 64px`; el título (660, `clamp(28px, 4vw, 44px)`) con el botón a la derecha;
  grilla `1.35fr 1fr`, 16 px: razón, cita, razón, cita… Razón: `26px 26px 24px`, radio 20, raya de color de 46 × 3 arriba, ícono de 42
  en su color suave, número 11,5 px, título 21 px, texto 14,5/1,64. **Entran al verse** (umbral ,2) de a una cada 100 ms (desde 14 px,
  `.55s` con rebote). Con el mouse la razón toma el borde de su color y una sombra larga, y el ícono sube 2 px. Cita: fondo suave de
  su color, comilla de 38 px al 28 %, texto 17 px 500, avatar de 34 con iniciales. Sus barras «The usual way 3 to 6 weeks / AI
  Studio Tonight» (la lenta se llena en 2 s, la rápida al 8 % con rebote) no van: son tiempos suyos.
- **¿Para quién?** (`.cir`): `min(100%, 1340px)`, `64px 24px`; pastillas `10px 20px` 13,5 px (la activa llena de su color con sombra;
  con el mouse suben 1 px); escenario `1fr 176px 1.02fr`: el navegador (radio 20, «Live» verde) con el formulario (título 17 px,
  campos de 52 con rótulo de 9,5 px en mayúsculas), el cable y la cadena. **Cada 9 s:** los campos se escriben (**25 ms por letra**,
  190 ms entre uno y otro, el campo activo con borde y anillo de su color), el botón se aprieta (,965), sale la tarjeta del lead,
  los cables se dibujan desde el botón (`.78s`) con un punto que los recorre y cada paso se prende con su tilde. A 1000 o menos, una
  columna sin cables.
  - **En MaKo:** las plantillas que captan (agendar, contactos, eventos) con SU formulario (campos y botón de la plantilla) y UN paso
    después: «Entra a tu CRM como lead». Sus cuatro pasos (cita, mensaje, recordatorios, cuadrilla) no se dicen.
- **Preguntas** (`.faq`): `min(100%, 1120px)`, `48px 20px`; dos columnas de 14 px; cada una `#EFF4FE`, radio 14, `18px 20px`, 15,5 px
  500; la abierta con borde azul al 35 %, con el mouse al 28 %; respuesta 14,5/1,65 `#56616F`. El ícono es un «+» que NO gira
  (su regla de «abierta» repite la de cerrada). La primera abierta. Una columna a 640.
- **Cierre** (`.cta`): `min(100%, 1080px)`; caja `#0C1322` de radio 28, `56px 40px 48px`, dos luces (violeta arriba a la izquierda y
  azul abajo a la derecha; en MaKo azul y dorado); título `clamp(30px, 4.4vw, 48px)` `#F4F8FE`; bajada `#B9C7DC`; un **pedido**
  redondo de 480 (link a la prueba) que sube 2 px con el mouse y su flecha crece a 1,08; el botón.
- **Pie:** `#07223D`; en producción va el del sitio (`PieGlobal`).

## Lo que no se copia

Su logo y su barra (en producción, la del sitio), su mascota, las publicaciones de sus usuarios en la galería,
sus contadores de uso (700K, 175K, 85K), sus testimonios, el ejemplo «Jasmine Rivera», sus cuatro pasos después del formulario, sus
barras de tiempo y su prueba de 14 días.
