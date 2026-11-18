---
name: qa-usuarios
description: >
  Probar una tab de MaKo de punta a punta EN PRODUCCIÓN haciendo de cada tipo de usuario (super admin en el negocio de prueba,
  cliente mirando, teléfono, closer, Esencial contra Pro), MIRANDO cada pantalla con su captura a 1440 y a 375, y dejar el
  informe en docs/pruebas/<tab>-<dd-mm>.md con las fallas (arregladas con su test) y las propuestas para Martín. Usar cuando el
  pedido es «probá X como lo usaría cada persona», «textos rotos, botones rotos, diseño roto», «testeo profundo de X», o antes
  de dar por terminada una tab. Es el método de los informes del 10 al 13/11/2026 (AI Avatar, Spy, Dashboard, Image, Marketing
  CoPilot, Video Editor, Web Generator), hecho repetible.
---

# QA con Claude haciendo de usuario (el método de docs/pruebas/)

El pedido de Martín que lo originó (10/11/2026): *«testeos de todo tipo… si hay textos rotos, botones rotos, diseño roto,
funcionalidades que no funcionan… screenshot… feedback sobre cómo se podría mejorar… un testeo bastante profundo de todo»*. Y
el de la segunda vuelta (11/11), que es la mitad que más cuesta: *«deberían haber detectado esto… Quiero que prueben y miren
todo y detecten oportunidades de mejora»* y *«Una hoja vacía o con "Sin datos" en producción también es una falla»*.

Los informes que salieron de esto son el molde: `docs/pruebas/dashboard-10-11.md` (el más completo), `competitor-spy-10-11.md`
(cuatro vueltas), `web-generator-10-11.md`, `image-12-11.md`. Las trampas medidas, en `docs/hallazgos-pruebas.md`. **Leé uno de
esos informes entero antes de empezar**: el formato de abajo sale de ahí.

## 0. Antes de tocar nada (dos minutos, y sin esto no se arranca)

1. **¿Hay con qué probar?** Esto se hace en `hola-mako.com` con el navegador de la app de Claude (skill
   `anthropic-skills:built-in-browser`) y la sesión de Martín. **Una sesión de la nube no tiene ni navegador con sesión ni base:**
   ahí no se corre; se devuelve como «producción» al Cerebro, con la lista de tabs y casos.
2. **¿De quién es la sesión?** `hola-mako.com/api/auth/me` EN LA PESTAÑA PROPIA, cada vez (la sesión del navegador de la app no
   sobrevive a que se cierre la app). Tiene que decir Martín, super admin. **Nunca se dio por sabido de la mañana.**
3. ⛔ **El Chrome de la extensión (Claude in Chrome) suele tener la sesión de LEANDRO (ws 10), un cliente real**, y ahí el `?ws=`
   no hace nada. En ese Chrome no se toca nada. Si no hay sesión de Martín en ninguno de los dos, se pide (lo pide el Cerebro).
4. **¿Qué está desplegado?** El informe dice qué versión se probó (la hora del despliegue de Vercel, o el commit de main que
   trae). «En main» no es «en producción»: lo lleva el cron diario de las 08:05 de Argentina.

## 1. Dónde se escribe y dónde sólo se mira

| Negocio | Qué se hace | Por qué |
|---|---|---|
| **ws 3 «Cliente de Prueba»** | Todo lo que escribe: crear, editar, guardar, borrar lo propio | Es el único negocio para escribir. Antes de escribir, `/api/auth/me?ws=3` tiene que dar `ws: 3` e `impersonando: true` |
| **ws 9 (MaKo)** | Sólo lo que necesita IA (el ws 3 no tiene IA: «Replicar» deja guías y el chat pide instalar la app) | Corre con la red de la plataforma. Lo que se cambia ahí se deja **como estaba** y se dice en el informe |
| **Un negocio de cliente** (ws 1, ws 17…) | Sólo MIRAR, con una traba puesta | Ver abajo. No se escribe nada, ni por accidente |

**La traba para mirar un cliente sin riesgo** (docs/hallazgos-pruebas.md, «Probar el Dashboard en producción»): después de cargar,
se pisa `window.fetch` para que todo POST que guarde (en el Dashboard, `"accion":"guardar"` a /api/graficos) devuelva 500. Se va
con una recarga entera; una navegación de la app la conserva. Y un link que ya agrega algo al abrir (`?hoja=<plantilla>`) se
evita.

## 2. Las personas

Una fila por persona, como en el informe del Dashboard. Las que no se pueden probar se escriben igual, con el porqué:

| Persona | Cómo | Qué mirar |
|---|---|---|
| Super admin en el negocio de prueba | ws 3, 1440, claro y oscuro | La tab entera: crear, editar, deshacer, exportar, compartir, vacíos |
| Cliente mirando su negocio | Su ws, con la traba | Que con SUS datos no haya textos rotos, ceros que parecen números ni tarjetas vacías |
| Teléfono | 375 (preset `mobile`, ANTES de navegar) | La pantalla de `app/m` de esa tab, o su «En la computadora» |
| Closer o setter | Sin probar: no hay «ver como» un rol y no se crean cuentas | Se dice qué regla del código lo fija (`hojaDeRol`, `requireRolWs`…) |
| Esencial contra Pro | Sin probar si cambiar el plan del ws 3 es tocar la cuenta | Qué cierra el plan (lib/topes-plan.ts) y si la pantalla lo dice |

## 3. Mirar, no leer (lo que se pagó el 11/11)

La primera vuelta del 10/11 leyó `innerText`, el DOM y el código, y Martín encontró al día siguiente un solo outlier, miniaturas
grises, títulos cortados y un gráfico sin una sola portada. **Cada pantalla se captura y se critica al lado de su referencia**
(la app de la que se copió: Looker para el Dashboard, Gamma para el Web Generator, Canva o Top Carousels para Image), abierta en
la misma sesión. La pregunta no es «¿anda?» sino «¿Martín diría que está vacío, cortado, roto o que no se entiende?».

- **Una pantalla vacía o con «Sin datos» en producción es una falla**, aunque el código haga lo que dice. Y un cero que parece
  un número (`US$0.00` de costo sin gasto, un `+US$0` en verde) también.
- **Se mira también sin la barra de agencia**: `document.documentElement.removeAttribute('data-barra-agencia')`. El super admin
  ve una ficha distinta de la del cliente.
- **Cada panel lateral se abre** (cambia el ancho del contenido, y lo que depende del ancho se rompe ahí).
- **Cada estado**: vacío, con muchos datos, con un error, en claro y en oscuro.

## 4. Las capturas con el navegador de la app (las trampas medidas)

El panel suele estar OCULTO (nadie tiene la sesión en una ventana): la página corre como pestaña de fondo. Lo que se midió:

- **La página entera a 1440:** `resize_window` 1440 × 900 y, EN EL MISMO LOTE y sin espera, `zoom` de `[0, 0, 1440, 900]`. Con
  una espera en el medio sale un RECORTE de la esquina que parece bueno. Si igual sale el pedazo de arriba a la izquierda:
  `document.documentElement.style.transform = 'scale(0.8)'` con `transformOrigin = '0 0'`, y se saca antes de hacer clic.
- **375:** `resize_window` con `preset: mobile` y DESPUÉS `navigate` (el servidor arma el teléfono por el agente). Al volver a
  1440 se navega otra vez.
- **La pintura llega tarde:** antes de cada captura, `document.getAnimations().forEach(a => a.finish())`; se mide el estado con JS
  (`[role=dialog]`, `naturalWidth` de las imágenes) y, si la captura sale negra, vieja o en blanco, se repite. Una captura así no
  prueba nada.
- **`loading="lazy"` no carga nada con el panel oculto**: no es una falla. Se miden las imágenes con `fetch` o pasándolas a
  `eager`.
- **Un botón que «no abre» puede ser una página sin hidratar**: `Object.keys(boton).some(k => k.startsWith('__react'))` antes de
  anotarlo. Y algunos controles escuchan `pointerdown`: se mandan `pointerdown`, `mousedown`, `pointerup`, `mouseup` y `click`.
- **Una espera con `setTimeout` en una pestaña de fondo puede no volver nunca**: se lee el DOM en llamadas separadas.
- **Lo que no responde con el panel oculto** (el guiado de «Editar» de Image) no se anota como falla hasta repetirlo con el panel
  a la vista o en otra carga.
- **Detalles chicos**: una captura achicada engaña para los dos lados. Se recorta a tamaño real o se lee el píxel.
- **Exportar sin bajar nada a la PC**: se pisan `URL.createObjectURL` y `HTMLAnchorElement.prototype.click` para anotar el nombre,
  el tipo y los bytes, y `window.print` para ver que el PDF arme su vista. Después se restauran.
- **Un audio**: el navegador de la app no da micrófono. Se reemplaza `navigator.mediaDevices.getUserMedia` por una voz
  sintetizada (receta en docs/hallazgos-pruebas.md, «Grabar un audio en el navegador de la app»).

Las capturas van a `docs/pruebas/<tab>-<dd-mm>/`, numeradas (`01-…-1440.jpg`, `20-…-375.jpg`), y el informe las nombra por número.

## 5. Lo que NO se hace en producción

- ⛔ **Escribir fuera del ws 3** (y del ws 9 sólo lo de IA, dejándolo como estaba). Si igual pasó, se dice en el informe con la
  hora y el id, y **no se borra** lo que quedó en una cuenta ajena: lo decide el Cerebro (pasó el 10/11 con una hoja «General» en
  el Dashboard propio de Martín, y con dos proyectos de prueba en el ws 10).
- ⛔ **Crear un link para compartir** (da acceso a los datos a cualquiera con el link) sin el sí de Martín.
- ⛔ **Cambiar el plan del ws 3, crear cuentas o tocar accesos de personas.**
- ⛔ **Gastar plata**: Apify, créditos de Flow o de ApiMart, una campaña de Meta. Lo que gasta se anota como «sin probar» con su
  costo, salvo OK de Martín. El informe dice cuánto se gastó (aunque sea US$0).
- ⛔ **Mandarle algo a una persona real**: un WhatsApp, un email, una invitación. Si el caso es «mandar», se prueba hasta el borrador.
- ⛔ **WebKit de Playwright con la página entera**: en Windows suena por los parlantes de Martín. Chromium, siempre `--mute-audio`.
- ⛔ **Bajar archivos a la PC** (se pisa el clic del `<a download>`, arriba).

## 6. Una falla se arregla, con su test, en la misma tanda

Lo que se encuentra y es técnico se arregla (AGENTS.md: «Nada se entrega sin autocrítica»), cada arreglo con su test que
EJECUTA el código, probado rompiéndolo («base N/0 → N-1/1» en el comentario del test), en una punta propia
(`punta/<tab>-pruebas`). Lo que cambia plata, lo que se le manda a un cliente o algo visual que Martín tiene que VER va a
«Propuestas (deciden Martín)», con su captura. Y después del despliegue se mira cada arreglo en producción: una vuelta más,
corta, con sus capturas («Mirar en producción después del despliegue»).

## 7. El informe: `docs/pruebas/<tab>-<dd-mm>.md`

En este orden, como `docs/pruebas/dashboard-10-11.md`:

1. **Título y pedido literal** de Martín (o del Cerebro, con sus palabras).
2. **Dónde y cómo**: producción y qué versión, qué navegador, qué sesión, qué negocios y para qué cada uno, anchos y modos.
3. **En números**: casos probados, fallas encontradas, cuántas arregladas, casos sin probar, propuestas. Y la plata gastada.
4. **Las personas y las pantallas** (la tabla del punto 2).
5. **Las fallas**: una por renglón numerado, con la captura, qué se veía, la causa y el arreglo con su archivo y su test.
6. **Los casos, uno por uno**: tabla `# · Caso · Resultado` («Pasa», «Falla → arreglado (n)»), agrupada por parte de la tab.
7. **Sin probar**, cada uno con su porqué.
8. **Propuestas de mejora (deciden Martín)**, en palabras de producto y con la referencia al lado cuando la hay.
9. **Lo que falta**: mirar los arreglos después del despliegue, lo que se dejó en el ws 3 para revisar, lo que no se chequeó.

Y la cosecha: lo que se aprendió del método (una trampa nueva del navegador, una regla) va a `docs/hallazgos-pruebas.md`; lo de la
tab, a su `docs/hallazgos-<área>.md`.

## 8. Las tabs que todavía no se recorrieron así (al 18/11/2026)

CRM, Automations, Plan, Ads Manager/Media Buyer, Copywriting, Offer, Classroom, Ops Center, Calendario, Email y Cobranza (las de
arriba ya tienen su informe en `docs/pruebas/`). Una tab que tiene su informe se vuelve a recorrer cuando cambia mucho: la segunda
vuelta encuentra lo que la primera leyó y no miró.
