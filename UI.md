# UI.md - Reglas de interfaz de Cartel GO

Reglas que **de verdad se usan** en el código. Si algo de aquí deja de cumplirse, se arregla el código o se corrige este documento. El estilo es **cartoon / satírico**, pensado para una sola mano en el móvil. Complementa a `AGENTS.md` (convenciones de código) y `GDD.md` (diseño del juego).

## 1. Principios

1. **Mobile-first y una sola mano.** Se diseña para ~375 px de ancho. Las acciones principales van en el tercio inferior de la pantalla; arriba solo información (HUD).
2. **El mapa manda.** Los paneles ocupan como mucho la mitad inferior de la pantalla y el mapa sigue visible y tocable por encima.
3. **Lo importante primero.** Cada pantalla tiene una acción principal y un dato que debe verse antes que nada. El valor pesa más que su etiqueta (el "$1.240" más grande que "sucios").
4. **Mostrar solo lo útil.** Si un botón no se puede usar por falta de recursos, no se muestra o se explica por qué. Los cuadros de información que no aportan se quitan: más mercancía y menos cajas.
5. **Nada del sistema.** Prohibido `window.confirm`, `alert` y `prompt`. Todo aviso o confirmación es un popup propio con el estilo del juego (`useConfirmStore.ask(...)` y `ConfirmDialog`; las acciones del store devuelven `{ ok: false, confirm }` y la UI las pasa por `handleResult`).

## 2. Estilo visual cartoon

- **Bordes gruesos negros** de 4 px (`#111`) en botones, tarjetas y paneles.
- **Sombras duras**, sin difuminar y sin color: `4px 4px 0 #111` en botones y `5px 5px 0 #111` en tarjetas. Al pulsar un botón se desplaza hacia la sombra (efecto de pulsación).
- **Clases base** en `src/index.css`: `cartoon-btn` (amarillo `#fde047`, texto en negro 900) y `cartoon-card` (fondo blanco). Se reutilizan; no se inventan botones nuevos.
- **Esquinas:** los paneles inferiores llevan arriba `rounded-t-2xl`; las pestañas, `rounded-t-xl`. El resto, rectas.
- **Sin degradados, sin desenfoques, sin sombras suaves.** El estilo es plano y de contornos marcados.
- **Iconos:** Lucide, con trazo grueso. Los POIs se dibujan con un icono por tipo (`PoiBadge`) y el mismo icono en el mapa.

## 3. Color

Se usa poco color y siempre con significado:

| Uso | Color |
| :--- | :--- |
| Acción principal, botones, panel del HQ | Amarillo (`yellow-300` / `#fde047`) |
| Paneles y tarjetas | Blanco con borde negro |
| Pestaña inactiva | Amarillo claro (`yellow-100` / `yellow-200`) |
| Bien / fiable / ya tienes trato | Verde (`green-300`, `#4ade80` en el mapa) |
| Aviso / en preparación | Amarillo (`yellow-200`, `#facc15` en el mapa) |
| Peligro / error / falta algo | Rojo (`red-300`, `red-600` en texto) |
| Texto secundario | El mismo negro con `opacity-70` |

- El rojo se reserva para momentos que importan (peligro, error, "0" de un ingrediente que falta); si se usa en todo, no destaca.
- Un lugar **con el que tienes trato** (camello, negocio, punto de suministro con contacto o pedido) se ve a todo color y con un círculo; los demás, atenuados. El HQ lleva su propio círculo de borde grueso.

## 3 bis. Moneda

- **Dinero Limpio: «$»**, en verde oscuro. **Dinero Sucio: «₡»**, en marrón. Siempre con el símbolo, nunca un número suelto.
- Todo importe pasa por `money(cantidad, "clean" | "dirty")` (`services/money.ts`) en textos, o por el componente `<Money>` (con color) en la interfaz. No se escribe `${n}` a mano.
- La barra superior de la pantalla principal muestra los dos saldos: `# UI.md - Reglas de interfaz de Cartel GO

Reglas que **de verdad se usan** en el código. Si algo de aquí deja de cumplirse, se arregla el código o se corrige este documento. El estilo es **cartoon / satírico**, pensado para una sola mano en el móvil. Complementa a `AGENTS.md` (convenciones de código) y `GDD.md` (diseño del juego).

## 1. Principios

1. **Mobile-first y una sola mano.** Se diseña para ~375 px de ancho. Las acciones principales van en el tercio inferior de la pantalla; arriba solo información (HUD).
2. **El mapa manda.** Los paneles ocupan como mucho la mitad inferior de la pantalla y el mapa sigue visible y tocable por encima.
3. **Lo importante primero.** Cada pantalla tiene una acción principal y un dato que debe verse antes que nada. El valor pesa más que su etiqueta (el "$1.240" más grande que "sucios").
4. **Mostrar solo lo útil.** Si un botón no se puede usar por falta de recursos, no se muestra o se explica por qué. Los cuadros de información que no aportan se quitan: más mercancía y menos cajas.
5. **Nada del sistema.** Prohibido `window.confirm`, `alert` y `prompt`. Todo aviso o confirmación es un popup propio con el estilo del juego (`useConfirmStore.ask(...)` y `ConfirmDialog`; las acciones del store devuelven `{ ok: false, confirm }` y la UI las pasa por `handleResult`).

## 2. Estilo visual cartoon

- **Bordes gruesos negros** de 4 px (`#111`) en botones, tarjetas y paneles.
- **Sombras duras**, sin difuminar y sin color: `4px 4px 0 #111` en botones y `5px 5px 0 #111` en tarjetas. Al pulsar un botón se desplaza hacia la sombra (efecto de pulsación).
- **Clases base** en `src/index.css`: `cartoon-btn` (amarillo `#fde047`, texto en negro 900) y `cartoon-card` (fondo blanco). Se reutilizan; no se inventan botones nuevos.
- **Esquinas:** los paneles inferiores llevan arriba `rounded-t-2xl`; las pestañas, `rounded-t-xl`. El resto, rectas.
- **Sin degradados, sin desenfoques, sin sombras suaves.** El estilo es plano y de contornos marcados.
- **Iconos:** Lucide, con trazo grueso. Los POIs se dibujan con un icono por tipo (`PoiBadge`) y el mismo icono en el mapa.

## 3. Color

Se usa poco color y siempre con significado:

| Uso | Color |
| :--- | :--- |
| Acción principal, botones, panel del HQ | Amarillo (`yellow-300` / `#fde047`) |
| Paneles y tarjetas | Blanco con borde negro |
| Pestaña inactiva | Amarillo claro (`yellow-100` / `yellow-200`) |
| Bien / fiable / ya tienes trato | Verde (`green-300`, `#4ade80` en el mapa) |
| Aviso / en preparación | Amarillo (`yellow-200`, `#facc15` en el mapa) |
| Peligro / error / falta algo | Rojo (`red-300`, `red-600` en texto) |
| Texto secundario | El mismo negro con `opacity-70` |

- El rojo se reserva para momentos que importan (peligro, error, "0" de un ingrediente que falta); si se usa en todo, no destaca.
- Un lugar **con el que tienes trato** (camello, negocio, punto de suministro con contacto o pedido) se ve a todo color y con un círculo; los demás, atenuados. El HQ lleva su propio círculo de borde grueso.

 limpio y `₡` sucio.

## 4. Tipografía

- **Una sola familia:** la del sistema (`system-ui`). Sin fuentes externas.
- **Tamaños de Tailwind:** `text-xs` para datos secundarios, `text-sm` para el cuerpo, `text-base` para lo que debe leerse de un vistazo, `text-lg` para títulos de panel.
- **Pesos:** normal para el cuerpo, `font-bold` para etiquetas y `font-black` para títulos, botones y cifras.
- **Jerarquía** con tamaño, peso y opacidad (`opacity-70` para lo secundario), no solo con negrita.
- **Cifras** (dinero, cantidades, tiempos) con la clase `num` y `font-black`, para que no bailen al cambiar.
- Los textos de interfaz van **en castellano**, con tono satírico y frases cortas.

## 5. Espaciado y tamaños

- Se usan las escalas de Tailwind en múltiplos de 4 px: `gap-1`/`gap-2` entre elementos relacionados, `gap-3` entre bloques, `p-2` dentro de tarjetas y `px-4` como margen lateral de los paneles.
- Lo relacionado va junto y lo no relacionado, más separado.
- **Zona táctil mínima de 44 px** (`min-h-11`, `w-11 h-11`). Los botones pequeños se hacen más grandes, no se dejan en 28 px.
- Los iconos de cierre y las pestañas cumplen los 44 px aunque el dibujo sea menor.

## 6. Paneles inferiores (`Sheet`)

El panel común de comercios, puntos de suministro y HQ:

- Altura máxima del **50 %** de la pantalla; con `fixedHeight` es fija para que no salte al cambiar de pestaña.
- **Cabecera** con icono, nombre del lugar y datos (dinero). Botón de cerrar arriba a la derecha.
- **Pestañas de carpeta** (solo si hay más de una): la activa sube, toma el color del panel y se funde con el contenido.
- Contenido con scroll propio; el panel no mueve el mapa.
- El panel dentro de un lugar **no repite** lo que ya dice su cabecera: nada de icono y nombre duplicados dentro de una pestaña. Para eso, los componentes tienen una variante `bare` (sin caja, sin icono, sin nombre).
- Las pestañas se llaman por lo que contienen (Local, Personal, Transportistas, Lab, Mejoras...).

## 7. Botones y controles

- Una **acción principal** por pantalla o bloque; las secundarias van en blanco (`bg-white!`).
- Los botones desactivados se atenúan; si no se puede usar y no hay nada que explicar, mejor ocultarlo.
- Los pedidos y compras ofrecen **atajos** (Pedir 10, Máx) en vez de campos para escribir.
- Las acciones con coste importante (gasto grande, despedir, mejoras caras) piden confirmación con el popup propio.
- Mensajes de resultado tras cada acción (`handleResult`): texto corto y, si procede, sonido (`play("level")`, `play("error")`).

## 8. Estados vacíos, error y espera

- **Nunca un vacío mudo.** Un estado vacío (`EmptyState`) lleva título, una pista de qué hacer y un botón que lleva a ello ("Ir a la lavandería más cercana").
- **Esperas con línea de tiempo**, no con fechas en texto (`OrderTimeline`: pedido → preparado → transportista → entregado).
- Los errores dicen **qué pasa y cómo arreglarlo**, sin jerga.
- Los avisos de seguridad (modo conducción, calor) son visibles y no se pueden pasar por alto, pero no tapan el mapa entero.

## 9. Emoción y recompensa

- Los momentos importantes (subir de nivel, primer negocio, redada superada) tienen **celebración** (`Celebration`): animación breve, color y frase con gracia.
- El informe al volver (`AwayReport`) resume lo ocurrido mientras no estabas: es el final de cada sesión, y debe dejar ganas de volver.
- El HQ **brilla** cuando está trabajando (laboratorio o transportistas en marcha).
- Los tutoriales guían paso a paso con un paso activo cada vez y un premio (favor) al completarlo.

## 10. Comportamiento táctil

- El texto no se selecciona ni sale el menú de copiar al mantener pulsado (salvo en campos editables).
- Sin zoom accidental ni rebote del scroll: la página no se desplaza, solo los paneles.
- Los botones usan `touch-action: manipulation` para responder sin retardo.
- Los toques sobre iconos del mapa se escuchan en su capa (`poi-icons`) y los del HQ en su marcador.

## 11. Accesibilidad

- Los botones solo con icono llevan `aria-label` (Cerrar, Centrar en el HQ...). Los paneles, `role="dialog"` y un `aria-label`; las pestañas, `role="tab"` y `aria-selected`.
- Contraste alto por defecto: texto negro sobre blanco o amarillo.
- El color nunca es el único aviso: va con texto o icono (el "(0)" rojo lleva además el número).

## 12. Cosas que no hacemos

- Popups del sistema (`confirm`, `alert`, `prompt`).
- Sombras suaves, degradados o desenfoques.
- Cuadros con borde que repiten información de la cabecera.
- Más de una acción principal en un mismo bloque.
- Botones de menos de 44 px.
- Campos de texto para cantidades que se pueden elegir con un toque.
- Mostrar a otros jugadores o al servidor la posición exacta del HQ (ver `AGENTS.md`).
- Poner en pantalla nombres reales de drogas o de negocios reales: los nombres son inventados y satíricos (ver `GDD.md`).
