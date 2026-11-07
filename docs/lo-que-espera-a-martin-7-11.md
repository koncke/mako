# Lo que te espera a vos — 7/11/2026

**Qué es esto.** Del barrido de 634 pendientes, **266 están frenados** y **56 te nombran a vos**. Esta lista es
sólo ésos, agrupados **por lo que hace falta para destrabarlos**, no por área. Cada uno trae mi recomendación:
podés contestar «dale a todo» y seguimos, o vetar los que quieras.

**No están acá** los 20 que piden tocar producción ni los 12 que piden hablar con alguien: ésos los listo aparte
si querés. Empecé por lo que se contesta rápido.

---

## 🔴 Lo que está roto para los clientes AHORA, y sólo lo destrabás vos

**1. «Capturar» no existe para ningún cliente.** La tienda de Chrome sirve la **0.74.3**; la función vive en la
**0.76/0.77**, que nunca se publicó. O sea: construimos la captura de páginas de Spy y **nadie la tiene**. El
panel de la tienda pide re-verificar tu sesión de Google, así que sólo vos podés subirla. Después Google tarda
unos días en aprobar, así que cada día que pasa corre el reloj.
→ **Recomiendo: esto primero.** Es trabajo ya hecho que no llega.

**2. Dos chats de la nube están parados «esperando a un humano» desde ayer** y nadie se enteró: uno es
`punta/marketing-copilot`, que nunca llegó a main, y el otro es el del precio en pesos. Están quietos gastando
nada y sin avanzar.
→ **Recomiendo: mirarlos y destrabarlos o cerrarlos.** Trabajo a medias que no sirve a nadie.

---

## 💵 Decisiones de plata (un sí o un no cada una)

| | Mi recomendación |
|---|---|
| **Más claves de Apify**: ¿los topes por día de Spy escalan con la cantidad de claves? Es plata del negocio. | **Sí, pero medido**: primero confirmar que escalan de verdad antes de comprar la segunda. |
| **El alta del CRM usa sólo la clave 1 de Apify**: si se agota, deja de leer el @ mientras Spy sigue andando. | **Arreglarlo**: que use la misma rotación que Spy. No es plata nueva, es no desperdiciar la que hay. |
| **Stripe en modo real y precios en EUR** para cobrarle a la agencia de Thiago en España. Es tu clave. | **Esperar**: con la pasarela caída, abrir otro frente ahora dispersa. |
| **El precio en pesos sigue fijo al dólar blue del 31/10.** | **Actualizarlo ya**: una semana de atraso en el blue es plata real en cada venta. |
| **Reintentar las mediciones de producción** (P12, P13, P14, P16): cuesta crédito y borrar fotos escribe. | **Sí a las lecturas, no a los borrados** hasta que alguien mire qué se borra. |

---

## ⚖️ Excepciones a reglas que escribiste vos

Las dos van juntas y son la misma pregunta de fondo: **un negocio que no conectó su Gemini, ¿usa la clave de la
plataforma?** Tu regla del 22/10 dice que no («las claves de la plataforma nunca para un negocio»).

- Sin su Gemini, **no ve el guion de un video de YouTube** en Spy.
- Sin su Gemini, **no se transcribe YouTube**.

→ **Recomiendo mantener la regla.** Si la excepción se abre «sólo para esto», mañana hay tres. El camino bueno es
que la pantalla diga *«conectá tu IA y esto se prende»*, que ya es como funciona el resto.

---

## 📜 Trámites que sólo podés hacer vos (no son decisiones, son sesiones tuyas)

- **La enmienda III.L de YouTube.** Sin eso, el múltiplo y el VPH devuelven vacío por código. Y ojo: no es un
  `if` que podamos escribir — sus políticas **prohíben** un puntaje hecho con vistas o me gusta, y la sanción
  declarada es *«quota reduction or termination»* **sobre la misma clave que usa producción**. Es un acuerdo
  firmado, y tarda días.
- **Las capturas de Top Carousels.** La nube no abre el sitio y raspar el sitio puede cerrarnos la cuenta: las
  sacás vos a mano.
- **La pestaña abierta en tu cuenta de Canva**, del relevamiento que quedó a medias.

---

## 🗣️ Avisos a clientes que decidís vos

- **Código Inmobiliario (ws13) y P2P (ws14)**: hubo datos personales de sus leads en URLs. Avisarles y borrar es
  decisión tuya.
- **Leila**: su horario vive en dos valores (7-9 pm y 7:30-9:30 pm) y su precio en dos monedas. Si un anuncio
  sale con el viejo, alguien llega a las 7 y encuentra cerrado. Medido el 3/11, **sin verificar hoy**.
- **Mauricio**: la clave de correo ya está en la plataforma; nadie se lo dijo.

---

## Lo que ya no te espera a vos

Quedan **19 medianos** más que te nombran, casi todos decisiones de diseño que pueden esperar a que haya una
pantalla para mirar. No los puse acá para que esta lista se lea en cinco minutos.

**Y lo que no está en ninguna lista pero bloquea todo:** el pago de GitHub. Mientras no entre, nada de lo que
decidas acá llega a producción.
