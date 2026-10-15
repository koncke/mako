# Cuando se cae una clave de IA: el aviso y el freno (PLAN, 15/10/2026)

> Pedido de Martín (14/10/2026, por el chat «Estrategia 3 cuentas»): «Si se cae una clave debería aparecer una
> notificación en la app... Y frenar los llamados si detecta que se cayó hasta que se vuelva a subir.» El caso que lo
> motivó: la clave de Gemini del ws1 no contesta bien desde el 08/10 y algo la sigue llamando unas 300 veces por día.
> Hacía una semana que ese cliente no tenía IA propia y nadie se había enterado.
>
> **Estado: PLAN. Nada construido.** El umbral y el freno por clave están DECIDIDOS (§6, 15/10). Faltan las dos de Martín
> (a quién le llega el aviso y el primero del ws1), y coordinar el freno con el Web Generator, que acaba de tocar la cascada.

## 1. Lo medido (prod, 15/10/2026, sólo lectura)

`anthropic_usage` de los últimos 30 días sin Claude: 3.858 filas, 12 claves con algún 429.

| Clave (ws · proveedor · cuenta) | Buenas | Rebotes 429 | Última buena (UTC) | Rebotes desde la última buena |
|---|---|---|---|---|
| ws1 · Gemini · 1 | 346 | 2.147 | 08/10 20:45 | 2.147 (~335 por día) |
| ws1 · Mistral · 1 | 0 | 46 | — | 46 |
| ws9 · Gemini · 1, 2, 3 | 154-185 | 96-128 | 13/10 y 14/10 | 0 |
| ws10, ws11, ws13, ws15 · Gemini | 6-63 | 1-7 | 02/10 a 14/10 | 0 (ws13: 1) |

Cada regla de corte es «sin una respuesta buena en H horas y al menos N rebotes». Falso positivo = después del corte, la
misma clave volvió a contestar bien en menos de 24 h.

| Regla | Claves cortadas | Falsos positivos |
|---|---|---|
| 24 h y ≥ 10 | 2: ws1 Gemini y ws1 Mistral | 0 |
| 6 h y ≥ 10 | las mismas 2 | 0 |
| 12 h y ≥ 10 | 3 (suma ws9 Gemini 1) | **1** |
| cualquier H y ≥ 50 | 1: sólo ws1 Gemini (se le escapa Mistral) | 0 |

⚠️ **Lo que esa tabla NO ve, y por qué el freno no puede leer de ahí:**
- **Sólo se anotan los 429** (`anotarRebote429`). Una clave inválida (401), un proyecto bloqueado (el 403
  `PERMISSION_DENIED` del ws1 del 11/10, docs/hallazgos-ia.md) o una cuenta sin crédito no quedan en ninguna tabla. Por
  eso OpenAI y OpenRouter del ws1 ni aparecen.
- **La fila de uso lleva el ws del PEDIDO, no el del dueño de la clave** (`wsDeProveedor`). Cuando contesta la red de la
  plataforma, su respuesta buena queda en el ws del cliente, con el mismo proveedor y quizá el mismo número de cuenta. Si
  el freno leyera `anthropic_usage`, una clave muerta podría verse viva por la respuesta de otra. **Una clave se
  identifica por su HUELLA**, nunca por (ws, proveedor, cuenta).
- **Es una muestra chica**: 12 claves con rebotes en 30 días.

## 2. La forma

**Primero el registro: sin él no hay ni freno ni aviso.**
- Una fila por CLAVE, `ia_claves_salud`. La clave se identifica por su huella: el sha-256 de la clave, recortado; la
  clave nunca. Guarda:
  - de quién es: ws dueño, proveedor y cuenta;
  - cómo viene: la última respuesta buena, el primer fallo desde ahí, cuántos fallos van, y el último código y mensaje
    del proveedor (sin la clave);
  - el freno: estado, desde cuándo, por qué, la próxima prueba y si ya se avisó.
- **Cada corte y cada suelta, en `ia_claves_eventos`**: cuándo, por qué y con qué números. Sin eso, un corte no se
  distingue de «no se llamó a nadie», que es justo lo que pasó con el ws1.

**Tres estados, no dos.** Cuenta sólo lo que el PROVEEDOR CONTESTÓ:
- Un 200: buena. Pone el contador en cero.
- 429, 401, 402, 403, «API key not valid», «insufficient_quota», sin crédito: un fallo de ESA clave.
- 5xx, saturación, timeout o red: «no sé», y no suma ni resta.
- **Si no podemos leer o escribir el estado en la base, también es «no sé»: se llama como siempre.** Un freno que no
  puede leer no frena, y un fallo nuestro nunca marca una clave como caída.

**El freno es POR CLAVE, y NUNCA corta la red de la plataforma** (condición de Estrategia, 15/10).
- Si la clave del cliente está frenada, su pedido sigue por la red de MaKo, con su «⚠», como hoy cuando sus claves
  fallan. Si no, el freno convertiría una clave caída en una función apagada.
- Las claves de la plataforma se registran y se avisan (sólo a SuperAdmin), pero **no se frenan**: con una muerta, la red
  falla esa llamada y sigue a la siguiente, como hoy.
- En la rotación (`provDe` y `ordenarCuentas`, lib/ai-cheap.ts), una clave frenada del cliente se saltea como una agotada.
- No se corta al proveedor entero: el ws9 tiene tres de Gemini con 429 sueltos, y las tres contestan.
- Si un negocio se queda sin ninguna clave viva, la cascada lo dice con su causa en lib/fallo-ia-texto.ts («tu clave de
  Gemini no contesta desde el 08/10: cargá otra»), no «sin cuota».

**Suelta sola, por dos puertas:**
- **Se sube otra clave** en ese lugar: es otra huella y arranca limpia. Es el «hasta que se vuelva a subir».
- **La prueba espaciada.** Un pedido real de 1 token una hora después del corte, a las 3 h, y después cada 6 h. La corre un
  cron, como el vigilante de las líneas de WhatsApp (lib/lineas-vigilante.ts). Lo que suelta es un 200 de verdad. Pedir
  la lista de modelos no sirve: contesta 200 aunque la cuota esté en cero.

**El aviso: dos filas del catálogo, en `AVISOS_SOLO_SUPERADMIN`**, como la caída y la vuelta del WhatsApp:
`ia-clave-caida` e `ia-clave-volvio`.
- **Qué dice:** qué clave (proveedor, cuenta y los últimos 4 caracteres), de qué negocio, desde cuándo (la última buena)
  y cuántos intentos lleva.
- **Cuándo sale:** la caída repite cada 24 h mientras siga frenada. La vuelta sale sólo si la caída se avisó: un aviso de
  caída sin el de recuperación entrena a ignorarlo.
- **Por dónde:** `emitirDelCatalogo`, que lo deja en la campana de la app (la notificación que pidió) y en el grupo.

## 3. Dónde vive

| Pieza | Archivo |
|---|---|
| Clasificar la respuesta y decidir corte y suelta (puro, con test) | `lib/ia-claves-salud.ts` (nuevo) |
| El registro, y la tabla de eventos | `lib/ia-claves-registro.ts` (nuevo) + una migración |
| El freno en la rotación | `lib/ai-cheap.ts` (`provDe`, `ordenarCuentas`), `lib/anthropic.ts`, el doer y la transcripción: todo lo que llama a un proveedor. ⚠️ El Web Generator acaba de tocar la cascada (la red de la plataforma para el Diagnóstico): se coordina antes. |
| La prueba espaciada | un cron nuevo, cada 10 min, que sólo toca las claves con la prueba vencida |
| El aviso | `lib/avisos-catalogo.ts` (las dos filas y `AVISOS_SOLO_SUPERADMIN`) |
| La causa nueva para el cliente | `lib/fallo-ia-texto.ts` |

## 4. Riesgos y cómo se frenan

- **Lo que cuesta por llamada.** Leer el estado en cada pedido sería otra consulta: va con una caché por proceso de 60 s.
  Se escribe sólo cuando algo cambia: un fallo, o la primera respuesta buena después de fallos.
- **Un corte equivocado.** La primera prueba lo suelta en una hora. Y en 30 días la regla decidida no tuvo ninguno.
- **Las claves de la plataforma** (la red de la agencia) no se frenan: se registran, y su aviso va sólo a SuperAdmin.

## 5. El día del deploy

Con la regla decidida, la primera corrida deja frenadas Gemini y Mistral del ws1, y el aviso le llega a Mauricio, que
es un cliente. Por eso va como decisión (§6-4).

## 6. Lo que decide Martín

1. **El umbral. DECIDIDO (Estrategia, 15/10, con la medición de §1): «24 h sin una respuesta buena y al menos 10
   rebotes»**. Medido el 15/10/2026 sobre 30 días y 12 claves con rebotes: 0 falsos positivos. Quien lo quiera bajar,
   que mida de nuevo: a 12 h ya hubo 1. En 30 días corta las dos claves
   muertas del ws1 y ninguna de las que se recuperaban solas. «12 h» ya dio un falso positivo (una del ws9), y «≥ 50» deja
   pasar Mistral. Para los errores definitivos (clave inválida, proyecto bloqueado, sin crédito), la misma regla al
   principio: hoy no quedan en ninguna tabla y no se pueden medir. Con dos semanas de registro se mide una más rápida.
2. **¿Por clave o por proveedor? DECIDIDO (Estrategia, 15/10): por clave**. El ws9 tiene tres de Gemini con entre 96 y 128 rebotes
   cada una, y las tres siguieron contestando. Por proveedor, el día que una se cae se cortan las que funcionan.
3. **¿A quién le llega el aviso?** (Ticketera: `claves-aviso-a-quien`)
   - **A** (recomendado): al negocio dueño de la clave, en su app y en su grupo, y lo configura sólo SuperAdmin, como el
     WhatsApp caído. La clave es suya, y es él quien la cambia.
   - **B**: sólo a SuperAdmin.
   - **C**: a los dos.

   Una clave de la plataforma, siempre sólo a SuperAdmin.
4. **El ws1 el día del deploy:** ¿el aviso le llega a Mauricio en la primera corrida, o se lo contás vos antes y el
   primero sale sin aviso? (Ticketera: `claves-primer-aviso-mauricio`; Estrategia recomienda que Martín le avise antes:
   dos avisos de golpe sobre algo que viene pasando hace una semana se leen como un problema nuestro.)
