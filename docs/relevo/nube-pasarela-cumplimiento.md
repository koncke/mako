# Encargo: lo que hay que cambiarle a MaKo para que una pasarela la acepte (7/11/2026)

**Quién lo pidió.** Martín, 7/11: «habíamos hablado muchísimo ayer sobre el tema de la pasarela de
pago y el diseño de eso», y la regla que dejó: **una tarea se despacha en el momento, no cuando
alguien se acuerda.** Esto es el despacho.

## Por qué existe este encargo

Creem rechazó la tienda el 5/11, de forma definitiva. dLocal Go cerró la cuenta el 6/11. El 7/11 a
las 22:28 salieron tres consultas —Whop, Paddle, Lemon Squeezy— desde `equipo@hola-mako.com`
(`docs/consulta-pasarelas-7-11.md`, con los ids de envío). **Las respuestas todavía no se leyeron.**

El estudio entero está en `docs/proveedores-de-cobro.md`. Su conclusión incómoda: **AI Avatar no es
la traba más grande.** Lo que más reglas choca es la línea no oficial de WhatsApp, extraer contactos
de grupos y Competitors Spy.

⚠️ **Lo que YA está hecho y no hay que volver a tocar** (lo verifiqué contra el código el 7/11):
- Las páginas legales (`/terminos`, `/privacidad`, `/reembolsos`, `/soporte`, `/aup`) ya no nombran
  a Creem como vendedor: lo único que queda son comentarios explicando qué se sacó y por qué.
- `pasarelasDelPais` (`lib/compra-plan-reglas.ts`) ya no cablea Creem: pregunta por capacidad
  (`CAPACIDADES_PASARELA`, `merchantOfRecord`), no por nombre.
- La moderación ya no cuelga de la clave de Creem: `lib/creem-moderacion-reglas.ts` dice
  explícitamente «⚠️ NUNCA `CREEM`».

## Lo que SÍ falta, y se puede hacer sin esperar a nadie

### 1. El reloj del 50 % de la landing reinicia en otro navegador

`docs/proveedores-de-cobro.md` §7 lo marca como «arreglar ya, sea cual sea el proveedor»: un
descuento con cuenta regresiva que se reinicia al abrir otro navegador **se lee como marketing
engañoso**, y es de las primeras cosas que mira un revisor de pasarela.

No lo pude ubicar con un `grep` desde la PC: hay que encontrarlo en la landing y decidir qué hace.
**Hecho =** o la oferta tiene un fin real y compartido (no por navegador), o deja de presentarse
como una cuenta regresiva. No sirve esconder el reloj y dejar el descuento permanente con otro
nombre: eso es el mismo problema con otra cara.

### 2. AI Avatar con consentimiento verificable

Es la decisión 4 de §7 y es la que abre más puertas. Tres piezas:
- **Video de consentimiento** al cargar una cara (el relevo de Creem dice que HeyGen lo exige).
- **Comparar la cara del video con la de la cuenta** antes de habilitar la generación.
- **Marca visible de IA** en lo generado.

Hoy `/aup` ya promete que sólo se usa la foto propia o la de alguien que dio permiso por escrito:
**la política existe y el control técnico no.** Un revisor que pruebe el producto ve esa distancia.

### 3. Dejar lista la bandera de «qué pasarela cobra» para que entrar sea un cambio de datos

Cuando una de las tres conteste que sí, lo que no puede pasar es que haya que escribir código. La
arquitectura ya está (`docs/diseno-pasarela-pagos.md`, migración `0255_cobros_pasarela.sql`,
`lib/cobros.ts` como único escritor): revisar que agregar un proveedor sea agregar una fila a
`CAPACIDADES_PASARELA` + sus credenciales, y que `pedirPlanSinPasarela` deje de ser el único camino
sin tocar una pantalla.

## Cómo se entrega

Una punta por tema: `git push origin HEAD:refs/heads/punta/<nombre>`. Llega sola a `main` con verde.
Nada de esto necesita leer producción.

## Lo que NO entra acá, porque lo decide Martín

Las otras cinco decisiones de §7 (Acelerador fuera de la pasarela, WhatsApp oficial por defecto,
sacar Extraer y Spy del plan cobrado, vender AI Avatar aparte, empresa propia con Stripe directo).
Están escritas en `docs/proveedores-de-cobro.md` §7 y esperan su sí.
