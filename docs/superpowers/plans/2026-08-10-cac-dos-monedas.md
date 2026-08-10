# El CAC en dos monedas — Plan de implementación

> **Para quien lo ejecute:** SUB-SKILL REQUERIDA — usar `superpowers:subagent-driven-development`
> (recomendado) o `superpowers:executing-plans` para implementar tarea por tarea.
> Los pasos usan checkbox (`- [ ]`) para el seguimiento.

**Goal:** Que la pantalla `/admin/dev/pricing` deje de sumar horas con dólares, y que
cada parte abra con su conclusión en castellano llano.

**Architecture:** Todo el dato vive en `app/admin/dev/pricing/modelo.ts` (sin
`server-only`, testeable). `Pricing.tsx` solo pinta. Las funciones derivadas
(`entraEn`, `horasDe`) van en `modelo.ts` para que los tests las importen — es el
mismo criterio que `exigirClienteDePrueba` en `lib/auth-session.ts`.

**Tech Stack:** Next.js 16 (App Router), TypeScript, `node:test` + `node:assert`
(ver `tests/model-registry.test.ts`), Playwright para verificación visual.

## Global Constraints

- **Nunca sumar horas y dólares.** No puede existir ningún campo que contenga la suma.
  Es la regla que origina todo el plan.
- **Todo número declara su `origen`**: `'medido' | 'publicado' | 'supuesto'`.
- **La palabra «techo» no aparece en pantalla.** `CAC` sí puede aparecer.
- **Español neutro de LATAM.** Nombres de producto en inglés, copy en español.
- **Sin subtítulos innecesarios.** Cada título dice la conclusión, no el tema.
- Commits con el trailer `Claude-Cuenta: claude2`.
- `npm run typecheck` y `npm test` en verde antes de cada commit.

---

## Estructura de archivos

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `app/admin/dev/pricing/modelo.ts` | Todos los datos y las funciones derivadas | Modificar |
| `app/admin/dev/pricing/Pricing.tsx` | Solo pintar | Modificar |
| `app/admin/dev/pricing/Piezas.tsx` | `Titular`, `Barras`, `Plegable` | Sin cambios |
| `tests/pricing-modelo.test.ts` | Guardas del modelo | **Crear** |

`modelo.ts` ya pasó los 150 KB. No se parte en este plan —sería un refactor no
pedido— pero si una tarea futura lo toca de nuevo, partirlo por parte de la pantalla
es el corte natural.

---

## Task 1: El tipo de dos monedas, con su guarda en test

**Files:**
- Modify: `app/admin/dev/pricing/modelo.ts` (bloque `CanalCac` / `CAC_CANALES`)
- Test: `tests/pricing-modelo.test.ts` (crear)

**Interfaces:**
- Produces: `type HorasCanal = { aMano: number; conMaKo: number; loHabilita: string | null }`
- Produces: `type CanalCac` con `plataPorCliente: number` y `horas: HorasCanal`
- Produces: `CAC_CANALES: CanalCac[]`

- [ ] **Step 1: Escribir el test que falla**

```ts
// tests/pricing-modelo.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { CAC_CANALES } from '../app/admin/dev/pricing/modelo';

test('ningún canal mezcla horas con dólares', () => {
  for (const c of CAC_CANALES) {
    assert.equal(typeof c.plataPorCliente, 'number', `${c.id}: falta plataPorCliente`);
    assert.equal(typeof c.horas.aMano, 'number', `${c.id}: falta horas.aMano`);
    // La guarda que importa: no puede sobrevivir ningún campo que sume las dos.
    assert.ok(!('cacUsd' in c), `${c.id}: cacUsd todavía existe y suma horas con plata`);
    assert.ok(!('horasDueno' in c), `${c.id}: horasDueno en dólares todavía existe`);
  }
});

test('las horas con MaKo nunca son más que a mano', () => {
  for (const c of CAC_CANALES) {
    assert.ok(c.horas.conMaKo <= c.horas.aMano,
      `${c.id}: conMaKo (${c.horas.conMaKo}) > aMano (${c.horas.aMano})`);
  }
});

test('si conMaKo es menor que aMano, dice qué feature lo habilita', () => {
  for (const c of CAC_CANALES) {
    if (c.horas.conMaKo < c.horas.aMano) {
      assert.ok(c.horas.loHabilita, `${c.id}: baja las horas y no dice con qué feature`);
    }
  }
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx tsx --test tests/pricing-modelo.test.ts`
Expected: FAIL — `falta plataPorCliente` (hoy el campo se llama `medios`).

- [ ] **Step 3: Reescribir el tipo y los cinco canales**

En `modelo.ts`, reemplazar el `type CanalCac` y `CAC_CANALES` por:

```ts
/**
 * Las horas que cuesta un cliente por este canal. NO se convierten a dólares:
 * las horas y la plata no son intercambiables, y menos para alguien que tiene
 * tiempo y no tiene capital. Sumarlas fue el error que dio «el único canal que
 * entra es referidos», que es absurdo.
 */
export type HorasCanal = {
  aMano: number;
  /** Con la feature de MaKo construida. Si no está, rige `aMano`. */
  conMaKo: number;
  /** Qué feature produce el salto. `null` si no hay ninguna. */
  loHabilita: string | null;
};

export type CanalCac = {
  id: string;
  nombre: string;
  cadena: string;
  /** Solo lo que sale del bolsillo: pauta, premios, IA. NUNCA horas. */
  plataPorCliente: number;
  horas: HorasCanal;
  /** Qué se acaba primero y frena el canal. */
  queLoLimita: 'presupuesto' | 'horas' | 'lista' | 'tiempo-hasta-señal';
  escalable: boolean;
  senalEn: string;
  confianza: 'alta' | 'media' | 'baja';
  veredicto: string;
  origen: Origen;
};
```

Los valores de los cinco canales se cargan en la Task 3. En esta tarea van con los
que ya existen, **separando** lo que estaba mezclado:

```ts
export const CAC_CANALES: CanalCac[] = [
  { id: 'referidos', nombre: 'Sistema de referidos',
    cadena: 'premio en crédito → el que recomienda trae → alta',
    plataPorCliente: 43.55, // 7,55 de premio + 36,00 de los Free que no pagan
    horas: { aMano: 0.05, conMaKo: 0.05, loHabilita: null },
    queLoLimita: 'lista', escalable: false,
    senalEn: 'meses — con 3 clientes la base produce ~0',
    confianza: 'media', origen: 'supuesto',
    veredicto: 'El premio (15.000 MT = US$7,55 de costo real) es el único componente MEDIDO de los cinco canales. El premio va al que RECOMIENDA, no al referido (Ryu & Feick, JM 71(1) 2007: vínculos débiles Y marcas débiles).' },

  { id: 'carrito', nombre: 'Campaña de ventas a la landing',
    cadena: 'pauta → landing → checkout → alta',
    plataPorCliente: 136.22, // 124,22 de medios + 12,00 de Free
    horas: { aMano: 0, conMaKo: 0, loHabilita: null },
    queLoLimita: 'presupuesto', escalable: true,
    senalEn: 'días — DESPUÉS de construirlo',
    confianza: 'media', origen: 'supuesto',
    veredicto: 'Hoy el canal está bloqueado por código, no por precio: no existen app/registro, app/checkout ni app/precios. Pasar la aprobación de 70% a 88% con rieles locales baja el costo 20% sin tocar el anuncio.' },

  { id: 'ctwa', nombre: 'Campañas de mensajes a WhatsApp',
    cadena: 'pauta → conversación → registro → alta',
    plataPorCliente: 176.00, // 100,00 de medios + 76,00 de Free
    horas: { aMano: 0.25, conMaKo: 0.02, loHabilita: 'Agente: Chatbot' },
    queLoLimita: 'presupuesto', escalable: true,
    senalEn: 'días — el único que da señal antes de que la decisión esté tomada',
    confianza: 'baja', origen: 'supuesto',
    veredicto: 'El 37,8% de su costo en plata es el de los Free que no pagan: un pago arrastra 20 registros y 19 no pagan nunca. Las dos palancas que lo cierran están identificadas: costo por conversación de US$1,50 a US$1,10, y free→pago de 5% a 8%.' },

  { id: 'prospeccion', nombre: 'Prospección con el chatbot',
    cadena: 'lista con permiso → MaKo escribe → conversación → alta',
    plataPorCliente: 0.03, // centavos de IA por contacto trabajado
    horas: { aMano: 0.30, conMaKo: 0.01, loHabilita: 'Agente: Chatbot' },
    queLoLimita: 'lista', escalable: false,
    senalEn: 'semanas',
    confianza: 'baja', origen: 'supuesto',
    veredicto: 'Casi no cuesta plata ni horas: lo que lo limita es de DÓNDE salen contactos con permiso. Meta exige opt-in (Messaging Policy §1b) y excluye textual el consentimiento «assumed… from a purchase», así que una base comprada está cerrada. Con vínculo previo se puede, escribiendo desde el número propio y no como campaña.' },

  { id: 'organico', nombre: 'Orgánico por Instagram y YouTube',
    cadena: 'contenido → audiencia → registro → alta',
    plataPorCliente: 0, // edición y música; no hay pauta
    horas: { aMano: 26, conMaKo: 26, loHabilita: null },
    queLoLimita: 'tiempo-hasta-señal', escalable: false,
    senalEn: '6-12 meses — el único que no puede dar señal antes de que la decisión ya esté tomada',
    confianza: 'baja', origen: 'supuesto',
    veredicto: 'No cuesta plata: cuesta horas. Sigue valiendo como PRUEBA SOCIAL y como fábrica de creativos para CTWA, que es otro uso y no compite por el mismo presupuesto — pero sí por las mismas horas.' },
];
```

⚠️ **Las 26 h del orgánico son el único número de este plan que NO se puede
derivar acá, y hay que frenar y preguntarle al dueño.** Salen de dividir los
US$2.601,60 del modelo roto por US$100/h, o sea que heredan el error. Las reales
salen de una pregunta de un minuto: *cuántas horas te lleva guionar, grabar y
editar un Reel, y cuántos Reels hacen falta para un cliente*. Hasta que conteste,
van marcadas `origen: 'supuesto'` y con el comentario diciendo que están heredadas.

Y los 1.000 contactos ya quedan separados: son `BASE_PROPIA` (evento de arranque,
mes 1-2) y `prospeccion` pasa a describir el canal recurrente con el chatbot. Deja
de contarse dos veces sin necesidad de una tarea aparte.

- [ ] **Step 4: Correr los tests**

Run: `npx tsx --test tests/pricing-modelo.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Compilar y commitear**

```bash
npm run --silent typecheck
git add app/admin/dev/pricing/modelo.ts tests/pricing-modelo.test.ts
git commit -m "pricing: el CAC se parte en dos monedas que nunca se suman

Claude-Cuenta: claude2"
```

---

## Task 2: El modelo de tiempo por fase

**Files:**
- Modify: `app/admin/dev/pricing/modelo.ts`
- Test: `tests/pricing-modelo.test.ts`

**Interfaces:**
- Produces: `HORAS_MES = 338`
- Produces: `type FaseTiempo = { id: 'desarrollo' | 'adquisicion' | 'regimen'; nombre: string; mes: string; pisoAdquisicion: number; topeDebug: number; topeAgencia: number; }`
- Produces: `FASES_TIEMPO: FaseTiempo[]`
- Produces: `horasLibres(f: FaseTiempo): number`
- Produces: `topeClientes1a1(f: FaseTiempo, horasPorCliente: number): number`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { FASES_TIEMPO, HORAS_MES, horasLibres, topeClientes1a1 } from '../app/admin/dev/pricing/modelo';

test('ninguna fase reparte más horas de las que hay', () => {
  for (const f of FASES_TIEMPO) {
    const usadas = f.pisoAdquisicion + f.topeDebug + f.topeAgencia;
    assert.ok(usadas <= HORAS_MES, `${f.id}: reparte ${usadas} de ${HORAS_MES}`);
  }
});

test('el tope de clientes 1a1 sale del residual, no se fija', () => {
  const regimen = FASES_TIEMPO.find((f) => f.id === 'regimen')!;
  // 19 h en 12 semanas ≈ 6,33 h/mes por cliente (HIGH_TICKET.entrega)
  const tope = topeClientes1a1(regimen, 6.33);
  assert.equal(tope, Math.floor(horasLibres(regimen) / 6.33));
  assert.ok(tope > 0, 'en régimen tiene que entrar al menos un cliente de high ticket');
});

test('en la fase de adquisición no entra ningún cliente de high ticket', () => {
  const adq = FASES_TIEMPO.find((f) => f.id === 'adquisicion')!;
  assert.equal(topeClientes1a1(adq, 6.33), 0,
    'septiembre es 100% adquisición: no puede haber horas de entrega');
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx tsx --test tests/pricing-modelo.test.ts`
Expected: FAIL — `Cannot find module` / `FASES_TIEMPO is not exported`.

- [ ] **Step 3: Implementar**

```ts
// ── EL MODELO DE TIEMPO ─────────────────────────────────────────────────────
// DECIDE: cuántos clientes de cada canal entran en un mes, y cuántos programas
// de high ticket se pueden entregar.
//
// El dueño trabaja ~12 h de lunes a sábado y ~6 el domingo. Las fases NO cambian
// el total: lo REPARTEN. Y el reparto sale de su regla, textual: «la parte de
// adquisición es la importante, no debo sacrificar nunca ese tiempo. Entonces
// puedo tener un tope de clientes high ticket y un tope de tiempo dedicado a
// debugear e implementar».
//
// ⚠️ SUPUESTO GRANDE Y DECLARADO: 12 h sentado no son 12 h efectivas, y hoy
// nadie lo mide. Todo esto se apoya en un factor de efectividad desconocido.

export const HORAS_MES = 338;
export const HORAS_MES_ORIGEN: Origen = 'supuesto';
export const HORAS_MES_COMO = '12 h de lunes a sábado + 6 h el domingo, × 4,33 semanas. Dicho por el dueño.';

export type FaseTiempo = {
  id: 'desarrollo' | 'adquisicion' | 'regimen';
  nombre: string;
  mes: string;
  /** Horas protegidas para conseguir clientes. NO se sacrifican. */
  pisoAdquisicion: number;
  topeDebug: number;
  topeAgencia: number;
};

export const FASES_TIEMPO: FaseTiempo[] = [
  { id: 'desarrollo', nombre: 'Desarrollo', mes: 'agosto',
    pisoAdquisicion: 0, topeDebug: 0, topeAgencia: 10 },
  { id: 'adquisicion', nombre: 'Adquisición', mes: 'septiembre',
    pisoAdquisicion: 328, topeDebug: 0, topeAgencia: 10 },
  { id: 'regimen', nombre: 'Adquisición y entrega', mes: 'octubre en adelante',
    pisoAdquisicion: 169, topeDebug: 60, topeAgencia: 10 },
];

/** Lo que queda después del piso y los topes. De acá sale el high ticket. */
export function horasLibres(f: FaseTiempo): number {
  return HORAS_MES - f.pisoAdquisicion - f.topeDebug - f.topeAgencia;
}

/**
 * El tope de clientes de high ticket. ⚠️ Es SALIDA, no entrada: el dueño lo dijo
 * así — «la cantidad de clientes lo puedes sacar de la promesa de horas que les
 * doy». En desarrollo y en adquisición da 0 a propósito.
 */
export function topeClientes1a1(f: FaseTiempo, horasPorClienteMes: number): number {
  if (f.id !== 'regimen') return 0;
  return Math.floor(horasLibres(f) / horasPorClienteMes);
}
```

- [ ] **Step 4: Correr los tests**

Run: `npx tsx --test tests/pricing-modelo.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commitear**

```bash
npm run --silent typecheck
git add app/admin/dev/pricing/modelo.ts tests/pricing-modelo.test.ts
git commit -m "pricing: las 338 h del mes y los topes que salen del residual

Claude-Cuenta: claude2"
```

---

> ⚠️ **Renombre aplicado sobre la marcha (2026-08-10).** El plan bautizaba `FASES` y
> `Fase`, y esos dos nombres YA EXISTEN en el repo con otro significado:
> `lib/fase-diagnostico.ts` (las fases 1-5 del negocio del cliente) y
> `lib/mako-fases.ts`. Peor: `modelo.ts` cita `FASES[0].noHacer` en su línea 1479,
> que es el OTRO `FASES` — el archivo se contradecía a sí mismo. Van como
> **`FASES_TIEMPO` / `FaseTiempo`**. Lo encontró el agente de la Task 2.

## Task 3: La matriz — qué canal entra en qué fase

**Files:**
- Modify: `app/admin/dev/pricing/modelo.ts`
- Test: `tests/pricing-modelo.test.ts`

**Interfaces:**
- Consumes: `CanalCac`, `FaseTiempo`, `horasLibres` (Tasks 1 y 2)
- Produces: `horasDe(c: CanalCac, construidas: string[]): number`
- Produces: `type Veredicto = { entra: boolean; clientesMax: number; porQueNo: string | null }`
- Produces: `entraEn(c: CanalCac, f: FaseTiempo, construidas: string[], limitePlata: number): Veredicto`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { CAC_CANALES, FASES_TIEMPO, entraEn, horasDe } from '../app/admin/dev/pricing/modelo';

const canal = (id: string) => CAC_CANALES.find((c) => c.id === id)!;
const fase = (id: string) => FASES_TIEMPO.find((f) => f.id === id)!;

test('sin la feature construida rige el costo a mano', () => {
  const p = canal('prospeccion');
  assert.equal(horasDe(p, []), p.horas.aMano);
  assert.equal(horasDe(p, ['Agente: Chatbot']), p.horas.conMaKo);
});

test('el orgánico NO entra en desarrollo y SÍ en adquisición', () => {
  const o = canal('organico');
  assert.equal(entraEn(o, fase('desarrollo'), [], 105.84).entra, false);
  assert.equal(entraEn(o, fase('adquisicion'), [], 105.84).entra, true);
});

test('un canal caro en plata no entra aunque sobren horas', () => {
  const c = canal('carrito'); // 136,22 contra un límite de 105,84
  const v = entraEn(c, fase('adquisicion'), [], 105.84);
  assert.equal(v.entra, false);
  assert.match(v.porQueNo!, /plata/);
});

test('el veredicto nunca compara horas contra el límite de plata', () => {
  const o = canal('organico'); // plata 0, horas 26
  const v = entraEn(o, fase('adquisicion'), [], 0.01);
  // Con plata 0 entra aunque el límite sea de un centavo: las horas no cuentan acá.
  assert.equal(v.entra, true);
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx tsx --test tests/pricing-modelo.test.ts`
Expected: FAIL — `entraEn is not exported`.

- [ ] **Step 3: Implementar**

```ts
/**
 * Las horas reales de un canal según lo que esté construido.
 *
 * El dueño: «pretendo utilizar MaKo para mi propio negocio, para vender MaKo… no
 * es lo mismo el tiempo que le voy a dedicar a la prospección cuando literal hay
 * un chatbot». Por eso terminar una feature no es solo producto: es capacidad de
 * venta del mes siguiente.
 */
export function horasDe(c: CanalCac, construidas: string[]): number {
  if (!c.horas.loHabilita) return c.horas.aMano;
  return construidas.includes(c.horas.loHabilita) ? c.horas.conMaKo : c.horas.aMano;
}

export type Veredicto = {
  entra: boolean;
  clientesMax: number;
  /** En castellano, para pintar tal cual. `null` si entra. */
  porQueNo: string | null;
};

/**
 * ⚠️ LAS DOS MONEDAS SE CHEQUEAN POR SEPARADO Y NUNCA SE SUMAN.
 * `limitePlata` se compara SOLO contra `plataPorCliente`; las horas se comparan
 * SOLO contra el piso de adquisición de la fase.
 */
export function entraEn(c: CanalCac, f: FaseTiempo, construidas: string[], limitePlata: number): Veredicto {
  const h = horasDe(c, construidas);
  const porHoras = h <= 0 ? Infinity : Math.floor(f.pisoAdquisicion / h);

  if (c.plataPorCliente > limitePlata) {
    return { entra: false, clientesMax: 0,
      porQueNo: `en plata cuesta ${c.plataPorCliente.toFixed(2)} y podés pagar hasta ${limitePlata.toFixed(2)}` };
  }
  if (porHoras < 1) {
    return { entra: false, clientesMax: 0,
      porQueNo: `te come ${h} horas por cliente y en ${f.mes} tenés ${f.pisoAdquisicion} para conseguir clientes` };
  }
  return { entra: true, clientesMax: porHoras === Infinity ? 0 : porHoras, porQueNo: null };
}
```

- [ ] **Step 4: Correr los tests**

Run: `npx tsx --test tests/pricing-modelo.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commitear**

```bash
npm run --silent typecheck
git add app/admin/dev/pricing/modelo.ts tests/pricing-modelo.test.ts
git commit -m "pricing: el veredicto de un canal es por fase, y cada moneda va por su lado

Claude-Cuenta: claude2"
```

---

## Task 4: Pintar los canales con las dos monedas

**Files:**
- Modify: `app/admin/dev/pricing/Pricing.tsx` (sección «Solo un canal entra…»)
- Modify: `app/admin/dev/pricing/modelo.ts` (`FEATURES_CONSTRUIDAS`)

**Interfaces:**
- Consumes: `CAC_CANALES`, `FASES_TIEMPO`, `entraEn`, `horasDe`, `UNIT` (Tasks 1-3)
- Produces: `FEATURES_CONSTRUIDAS: string[]` — qué features están vivas hoy

- [ ] **Step 1: Agregar el catálogo de lo construido**

En `modelo.ts`:

```ts
/**
 * Qué features de MaKo están vivas HOY. Alimenta `horasDe`: sin la feature,
 * el canal cuesta las horas «a mano».
 * ⚠️ Se actualiza a mano. Si queda vieja, el modelo subestima las horas.
 */
export const FEATURES_CONSTRUIDAS: string[] = [];
export const FEATURES_CONSTRUIDAS_ORIGEN: Origen = 'supuesto';
```

- [ ] **Step 2: Reemplazar la tabla de canales**

En `Pricing.tsx`, dentro del `<Titular>` de la sección de canales, reemplazar la
`<Tabla>` de seis columnas por:

```tsx
<Tabla>
  <Fila head plantilla="minmax(0,1fr) 84px 84px minmax(0,1fr) 92px"
    cols={['Canal', 'Plata', 'Horas', 'Qué lo frena', `En ${faseActual.mes}`]} />
  {CAC_CANALES.map((c) => {
    const v = entraEn(c, faseActual, FEATURES_CONSTRUIDAS, limitePlata);
    return (
      <Fila key={c.id} plantilla="minmax(0,1fr) 84px 84px minmax(0,1fr) 92px"
        cols={[
          <div key="n">
            <div style={{ fontWeight: v.entra ? 600 : 400 }}>{c.nombre}</div>
            <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2, lineHeight: 1.45 }}>{c.cadena}</div>
          </div>,
          <Num key="p">{c.plataPorCliente ? usd(c.plataPorCliente, 0) : '—'}</Num>,
          <Num key="h">{horasDe(c, FEATURES_CONSTRUIDAS)} h</Num>,
          <span key="l" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{QUE_LO_FRENA[c.queLoLimita]}</span>,
          v.entra
            ? <Status key="v" tono="good">hasta {c.plataPorCliente === 0 && horasDe(c, FEATURES_CONSTRUIDAS) === 0 ? '—' : v.clientesMax}</Status>
            : <Status key="v" tono="bad">no entra</Status>,
        ]} />
    );
  })}
</Tabla>
```

Y arriba del componente, el diccionario que saca la jerga:

```tsx
/** El nombre técnico no va a pantalla: va lo que significa. */
const QUE_LO_FRENA: Record<CanalCac['queLoLimita'], string> = {
  presupuesto: 'la plata que puedas poner',
  horas: 'tus horas',
  lista: 'de dónde saques contactos con permiso',
  'tiempo-hasta-señal': 'que tarda 6 a 12 meses en dar señal',
};
```

- [ ] **Step 3: Borrar `barrasCac`, que graficaba la suma**

El gráfico de barras de la sección comparaba `c.cacUsd` contra `techoPro * 2`. Ese
campo ya no existe. Se reemplaza por dos gráficos, uno por moneda:

```tsx
const barrasPlata: Barra[] = [...CAC_CANALES]
  .sort((a, b) => a.plataPorCliente - b.plataPorCliente)
  .map((c) => ({
    id: c.id, label: c.nombre.split(' —')[0],
    nota: entraEn(c, faseActual, FEATURES_CONSTRUIDAS, limitePlata).porQueNo ?? 'entra',
    valor: c.plataPorCliente, texto: usd(c.plataPorCliente, 0),
    destacada: c.plataPorCliente <= limitePlata,
  }));

const barrasHoras: Barra[] = [...CAC_CANALES]
  .sort((a, b) => horasDe(a, FEATURES_CONSTRUIDAS) - horasDe(b, FEATURES_CONSTRUIDAS))
  .map((c) => ({
    id: c.id, label: c.nombre.split(' —')[0],
    nota: c.horas.loHabilita ? `con ${c.horas.loHabilita} baja a ${c.horas.conMaKo} h` : '',
    valor: horasDe(c, FEATURES_CONSTRUIDAS),
    texto: `${horasDe(c, FEATURES_CONSTRUIDAS)} h`,
    destacada: false,
  }));
```

Los dos van uno abajo del otro dentro del plegable, con un `<Eyebrow>` cada uno
(«Lo que cuesta en plata» / «Lo que cuesta en horas»).

- [ ] **Step 4: Verificar en el navegador**

Levantar el preview y medir el desborde. El detector, entero:

```js
// scripts/_tmp-verificar.mjs — se BORRA después de usarlo (regla del repo:
// los temporales van en scripts/_tmp-* y no se commitean)
import { chromium } from 'file:///C:/Users/marti/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: process.env.CHROME });
for (const w of [1440, 1100, 820]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 1200 } });
  await ctx.addCookies([{ name: 'mako_session', value: process.argv[2], domain: 'localhost', path: '/' }]);
  const p = await ctx.newPage();
  await p.goto('http://localhost:3000/admin/dev/pricing', { waitUntil: 'networkidle', timeout: 90000 });
  await p.getByText(/An.lisis de costos/i).first().click({ timeout: 20000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
  await p.waitForTimeout(900);
  const bad = await p.evaluate(() => {
    const out = []; const docW = document.documentElement.clientWidth;
    const enScroll = (el) => { let n = el.parentElement; while (n) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll') return true; n = n.parentElement; } return false; };
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      const cs = getComputedStyle(el);
      const clip = el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && !enScroll(el);
      if (!clip && !(r.right > docW + 1 && !enScroll(el))) continue;
      const t = (el.textContent || '').trim().slice(0, 45); if (!t) continue;
      out.push(`<${el.tagName}> w=${Math.round(r.width)} sw=${el.scrollWidth} | ${t}`);
    }
    return out.slice(0, 8);
  });
  console.log(`=== ${w}px === desbordes: ${bad.length}`); bad.forEach((x) => console.log('  ' + x));
  await ctx.close();
}
await b.close();
```

El token de sesión se acuña firmando con `AUTH_SECRET` de `.env.local` (ver
`crearToken` en `lib/auth-session.ts`). Correr con:

```bash
CHROME="$LOCALAPPDATA/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe" node scripts/_tmp-verificar.mjs "<token>"
```

Expected: `desbordes: 0` en los tres anchos. Después `rm scripts/_tmp-verificar.mjs`.

- [ ] **Step 5: Commitear**

```bash
npm run --silent typecheck && npm test
git add app/admin/dev/pricing/Pricing.tsx app/admin/dev/pricing/modelo.ts
git commit -m "pricing: dos gráficos, uno por moneda, en vez de uno que las sumaba

Claude-Cuenta: claude2"
```

---

> ⚠️ **Lo que la Task 4 encontró mal en este plan (2026-08-10).** Al partir el CAC en
> dos monedas **el veredicto se dio vuelta**, y la prosa que el plan daba por buena
> salía del CAC mezclado. Contra los US$105,84 que vale un cliente Pro, comparando
> SOLO plata: prospección 0,03%, orgánico 0% y referidos 41% **entran**; carrito 129%
> y CTWA 166% no. **Entran tres de cinco, no uno.** Lo que se corrigió y lo que queda:
>
> - El título de la sección, el `<Titular>` y la `<Nota>` decían lo contrario del dato
>   y además usaban «techo». Reescritos; los porcentajes ahora se **derivan** de
>   `CAC_CANALES` en vez de estar en la prosa, que es de donde salió la contradicción.
> - `ctwa.veredicto` decía «el 37,8% de su costo en plata es el de los Free»: ese 37,8%
>   era 76/201 sobre el CAC mezclado. Sobre `plataPorCliente: 176` da **43,2%**.
> - **La fila 1 de la tabla de la Task 6 ya no aplica**: el string
>   `Solo un canal entra en el techo del Pro` no existe más, y su reemplazo
>   (`Solo un canal cuesta menos…`) también sería falso.
> - **La guarda de la Task 6 va a fallar por IDENTIFICADORES, no por texto de
>   pantalla.** Grepear `/techo/i` sobre el fuente sin comentarios engancha `techoIa`
>   (función importada de `modelo.ts`, línea 37) y `a.techo` (campo de un dato). Los
>   locales `techoPro`/`techoProAnual` ya se renombraron a `limitePlata`/
>   `limitePlataAnual`, pero los otros dos son nombres de otro módulo: la guarda tiene
>   que mirar solo strings y texto JSX, o exceptuarlos explícitamente.
> - **`clientesMax` no se puede pintar como «hasta N».** Sale SOLO de las horas, así
>   que para un canal que frena la lista —referidos en septiembre— da «hasta 6.560»,
>   un número que la parte 5 del mismo documento desmiente (160 clientes a 24 meses).
>   La tabla pinta «entra» salvo que lo que frene al canal sean las horas.
> - `entraEn().porQueNo` arma su texto con `toFixed(2)`, o sea punto decimal
>   («cuesta 136.22»), contra la regla de un solo formateador de esta pantalla. Por eso
>   la nota de las barras de plata no lo usa. Si alguna vez se pinta, hay que formatearlo.

## Task 5: La conclusión al principio de cada parte

**Files:**
- Modify: `app/admin/dev/pricing/modelo.ts` (`INDICE`)
- Modify: `app/admin/dev/pricing/Pricing.tsx` (`Parte`)

**Interfaces:**
- Consumes: `INDICE` (ya existe)
- Produces: `Pregunta` gana el campo `conclusion: string`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { INDICE } from '../app/admin/dev/pricing/modelo';

test('cada parte tiene una conclusión, y dice un número', () => {
  for (const q of INDICE) {
    assert.ok(q.conclusion, `parte ${q.n}: no tiene conclusión`);
    assert.match(q.conclusion, /\d/, `parte ${q.n}: la conclusión no dice ningún número`);
  }
});

test('ninguna conclusión usa la palabra «techo»', () => {
  for (const q of INDICE) {
    assert.ok(!/techo/i.test(q.conclusion), `parte ${q.n}: dice «techo»`);
    assert.ok(!/techo/i.test(q.bajada), `parte ${q.n}: la bajada dice «techo»`);
  }
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx tsx --test tests/pricing-modelo.test.ts`
Expected: FAIL — `parte 1: no tiene conclusión`.

- [ ] **Step 3: Agregar las conclusiones**

En `modelo.ts`, `type Pregunta` gana `conclusion: string`, y:

```ts
export const INDICE: Pregunta[] = [
  { n: '1', pregunta: '¿Cuánto cuesta?',
    bajada: 'Medido en producción, y proyectado con el producto entero construido.',
    conclusion: 'Un cliente Pro te cuesta US$10,90 de IA por mes, no US$2,52 — ese número asumía un ruteo barato que no tiene una sola línea escrita. Arreglarlo vale US$15.018 de caja. Y con el producto completo el costo deja de ser el texto: el 90% es video e imagen.' },
  { n: '2', pregunta: '¿Cuánto se le cobra?',
    bajada: 'La tarifa de MaKo Tokens, operación por operación.',
    conclusion: 'Cada operación cuesta lo que cuesta: un mensaje 1 MT, un Reel 2.000. Ese salto de 1 a 2.000 es todo el diseño de los planes, y es por lo que el video no puede ser una feature incluida sino algo que se mide.' },
  { n: '3', pregunta: '¿Cuánto cuesta conseguir un cliente?',
    bajada: 'El costo de cada canal en las dos monedas que tenés: plata y horas.',
    conclusion: 'Tus 1.000 contactos son lo más barato que tenés y se acaban en dos meses. La pauta se banca hasta US$1.940 por mes. Y el orgánico no cuesta un peso pero te come horas, así que entra o no según el mes — no está descartado, está en otra moneda.' },
  { n: '4', pregunta: '¿Cómo se empaqueta?',
    bajada: 'Los cuatro planes, y qué falta para poder cobrarlos.',
    conclusion: 'Vender el anual en vez del mensual multiplica la caja por 62, porque cobrás el año entero el día 0. Es la decisión más grande del documento, y el límite del descuento está en 19,5%: pasado eso, la pauta deja de cerrar.' },
  { n: '5', pregunta: '¿Y el plan? ¿Cuánto da?',
    bajada: 'El mes 1 real, los 24 meses, el programa de US$4.000 y la oferta anual.',
    conclusion: 'Los 30 clientes pagos del mes 1 no salen: salen 11, y las 19 que faltan no se compran a ningún precio. A 24 meses el plan da 160 clientes y US$69.150 sin poner capital — lo que pide son tus horas, no tu plata.' },
];
```

- [ ] **Step 4: Pintarla en `Parte`**

En `Pricing.tsx`, dentro de `Parte`, después de la bajada:

```tsx
<div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, marginTop: 12, paddingLeft: 29, fontWeight: 500 }}>
  {q.conclusion}
</div>
```

- [ ] **Step 5: Correr y commitear**

```bash
npx tsx --test tests/pricing-modelo.test.ts
npm run --silent typecheck && npm test
git add app/admin/dev/pricing/modelo.ts app/admin/dev/pricing/Pricing.tsx
git commit -m "pricing: cada parte abre diciendo qué concluye, no de qué habla

Claude-Cuenta: claude2"
```

---

## Task 6: Sacar la jerga de toda la pantalla

**Files:**
- Modify: `app/admin/dev/pricing/Pricing.tsx`
- Modify: `app/admin/dev/pricing/modelo.ts`
- Test: `tests/pricing-modelo.test.ts`

- [ ] **Step 1: Escribir la guarda**

```ts
import { readFileSync } from 'node:fs';

test('la pantalla no dice «techo»', () => {
  const src = readFileSync('app/admin/dev/pricing/Pricing.tsx', 'utf8');
  // Solo el texto visible: se ignoran los comentarios, donde la palabra sí sirve.
  const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/techo/i.test(sinComentarios), 'quedó «techo» en el texto de la pantalla');
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx tsx --test tests/pricing-modelo.test.ts`
Expected: FAIL — la palabra aparece en varios títulos y notas.

- [ ] **Step 3: Reemplazar, uno por uno**

| Buscar | Reemplazar |
|---|---|
| `Solo un canal entra en el techo del Pro` | `Solo un canal cuesta menos de lo que un cliente vale` |
| `techo {usd(techoPro)} · regla LTV:CAC 3:1` | `por un cliente de US$47/mes podés pagar hasta {usd(techoPro)}` |
| `Un solo techo por plan, y para el Pro son US$105,84` | `Por un cliente de US$47/mes podés pagar hasta US$105` |
| `La llamada 1a1 regalada no compra techo: lo baja` | `La llamada gratis te cuesta más de lo que te trae` |
| `% techo` (columna) | `% de lo que vale` |
| `bajo payback ≤3 meses` | `si querés recuperar la plata en 3 meses` |
| `contribución mensual` | `lo que te queda de cada cliente por mes` |
| `TECHO_MEZCLADO` (solo el rótulo en pantalla) | `Lo máximo que podés pagar` |

⚠️ Los **nombres de las constantes no se tocan** (`TECHO_MEZCLADO`, `cacMax3a1`):
renombrarlos es un refactor de otro alcance y rompería los tests de la Task 1-3. Lo
que cambia es lo que se pinta.

- [ ] **Step 4: Correr y commitear**

```bash
npx tsx --test tests/pricing-modelo.test.ts
npm run --silent typecheck && npm test
git add app/admin/dev/pricing/ tests/pricing-modelo.test.ts
git commit -m "pricing: sacar «techo» del texto, con un test que lo impide volver

Claude-Cuenta: claude2"
```

---

## Task 7: La conclusión general — se escribe ÚLTIMA

**Files:**
- Modify: `app/admin/dev/pricing/modelo.ts`
- Modify: `app/admin/dev/pricing/Pricing.tsx`

⚠️ **Esta tarea NO se puede adelantar.** Decisión del dueño: la conclusión general
se deriva de las de las 5 partes, que existen recién después de la Task 5. Escrita
antes, sale de lo que uno cree y después se fuerza a los datos.

- [ ] **Step 1: Escribir el test que falla**

```ts
import { INDICE, CONCLUSION_GENERAL } from '../app/admin/dev/pricing/modelo';

test('cada punto de la conclusión general apunta a una parte que existe', () => {
  for (const p of CONCLUSION_GENERAL) {
    assert.ok(INDICE.some((q) => q.n === p.parte),
      `«${p.que.slice(0, 40)}…» apunta a la parte ${p.parte}, que no existe`);
  }
});

test('la conclusión general no dice nada que su parte no diga', () => {
  for (const p of CONCLUSION_GENERAL) {
    const numeros = (p.que.match(/[\d.,]+/g) ?? []).filter((n) => n.length > 2);
    const parte = INDICE.find((q) => q.n === p.parte)!;
    for (const n of numeros) {
      assert.ok(parte.conclusion.includes(n),
        `el número ${n} está en la conclusión general y no en la parte ${p.parte}`);
    }
  }
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx tsx --test tests/pricing-modelo.test.ts`
Expected: FAIL — `CONCLUSION_GENERAL is not exported`.

- [ ] **Step 3: Derivarla de las cinco**

```ts
/**
 * ⚠️ SE ESCRIBE ÚLTIMA, derivada de las conclusiones de las cinco partes.
 * Decisión del dueño, y es un orden de trabajo, no de lectura: escrita antes,
 * sale de lo que uno cree y después se fuerza a los datos.
 * El test de arriba lo hace cumplir: ningún número puede aparecer acá si no está
 * en la conclusión de su parte.
 */
export const CONCLUSION_GENERAL: Array<{ que: string; parte: string }> = [
  { parte: '5', que: 'Los 30 clientes pagos del mes 1 no salen: salen 11, y las 19 que faltan no se compran a ningún precio.' },
  { parte: '4', que: 'Vender el anual en vez del mensual multiplica la caja por 62. Es la decisión más grande del documento.' },
  { parte: '1', que: 'Un cliente Pro te cuesta US$10,90 de IA por mes, no US$2,52. Arreglarlo vale US$15.018.' },
  { parte: '3', que: 'Tu límite no es la plata, son tus horas. Por eso cada canal tiene dos precios y nunca se suman.' },
  { parte: '5', que: 'A 24 meses: 160 clientes y US$69.150 de caja, sin poner capital.' },
];
```

- [ ] **Step 4: Pintarla arriba de todo, reemplazando el veredicto viejo**

En `Pricing.tsx`, la `<Section titulo="El veredicto, en tres números">` se reemplaza
por:

```tsx
<Section titulo="Lo que hay que saber" card>
  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: 'var(--ink)', lineHeight: 1.7 }}>
    {CONCLUSION_GENERAL.map((p) => (
      <li key={p.que} style={{ marginBottom: 9 }}>
        {p.que}{' '}
        <a href={`#${anclaParte(p.parte)}`} style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none', borderBottom: '1px solid var(--border-strong)' }}>
          parte {p.parte}
        </a>
      </li>
    ))}
  </ul>
</Section>
```

- [ ] **Step 5: Verificar, correr y commitear**

```bash
npx tsx --test tests/pricing-modelo.test.ts
npm run --silent typecheck && npm test
node scripts/_tmp-verificar.mjs "<token>"   # 0 desbordes a 1440/1100/820
git add app/admin/dev/pricing/
git commit -m "pricing: la conclusión general, derivada de las cinco partes

Claude-Cuenta: claude2"
```

---

## Fuera de alcance de este plan

Va al borrador de `/plan` por el canal de `plan-tareas`, no acá:

- **Desglosar Landing Generator, VSL Generator, Image Generator y Video Generator.**
  Hoy tienen 1, 2, 4 y 1 tareas abiertas: no están planificadas. Hasta que se
  desglosen, el alcance de agosto está subestimado justo en lo que el dueño más
  quiere mostrar.
- **Sumar `Feature: WhatsApp de MaKo` al alcance de agosto** (decidido por el dueño).
- **Focus Tracker** y **Productivity Analyst**, que cierran el supuesto de
  efectividad del que depende todo el modelo de tiempo.
- **Mantener `FEATURES_CONSTRUIDAS` al día.** Arranca vacío; cada feature que se
  termina se suma ahí, y eso baja las horas por cliente del canal que habilita.
