# GDD.md - Game Design Document: "Cartel GO" (Título Provisional)

## 1. Visión General
- **Género:** GPS Location-Based / Idle Tycoon.
- **Plataforma:** Web Móvil (PWA instalable en iOS y Android).
- **Estilo Visual:** Caricatura vibrante (estilo *Grand Theft Auto: Chinatown Wars* mezclado con *Simpsons: Tapped Out*). Trazos negros gruesos, colores saturados y tono de humor ácido.
- **Modo de Juego:** Fase 1 Single-Player (PvE contra la policía y el mercado) con arquitectura preparada para Fase 2 Multijugador Asíncrono (PvP territorial).

### Principios de diseño
Las decisiones de este documento salen de cinco ideas que se repiten en todo el juego:
1. **Arranque suave, ritmo idle después.** Los primeros minutos no tienen esperas: el jugador toca, ve avanzar todo y se engancha. Solo cuando ya entiende el juego los tiempos crecen hasta ritmos de horas o días (la curva de *Clash of Clans*: 30 segundos al principio, días al final). Ver §4 bis, «Arranque suave».
2. **La calle da ventajas; el HQ da comodidad.** Ir en persona siempre sale mejor (precio reducido, vender a mano, mejorar proveedores), pero tras el primer contacto nunca es obligatorio: todo se puede hacer desde casa, más caro o más lento. El GPS premia, no castiga.
3. **Todo dinero tiene destino.** El Dinero Sucio no es un paso intermedio que solo resta: sirve para pedir, sobornar, premiar a los camellos y comprar tapaderas. El Dinero Limpio no depende solo de blanquear: la tapadera factura y el empleo de fachada paga. Ver §4.
4. **Nadie se queda bloqueado.** Si un jugador no tiene un polígono industrial cerca, o se queda sin dinero, siempre hay salida (supermercados, farmacias, empleo de fachada, anuncio de rescate). Ver §4 quinquies.
5. **El riesgo paga.** La policía no es solo un obstáculo: acercarse a una comisaría es peligroso pero rentable. Ver §3 y §4 ter.

---

## 2. Bucle Principal (Core Loop)

### Fase A: En la Calle (Exploración GPS)
1. El jugador camina por su ciudad con el mapa abierto.
2. El radar (radio de interacción de **50 metros**) detecta Puntos de Interés (POIs) generados desde OpenStreetMap.
3. **Abastecimiento:** La **primera vez** el jugador tiene que ir en persona a una Zona Industrial, Farmacia o Supermercado para establecer contacto y convertirla en **Punto de Suministro**. A partir de ahí no hace falta volver: los pedidos de *Precursores* se hacen desde el HQ o desde cualquier sitio y un *Transportista* los trae (ver §4 bis).
4. **Distribución:** El jugador visita Parques, Bares o Discotecas a **vender a mano** el *Producto Terminado* (sacándolo del almacén del HQ, sin mochila) a cambio de **Dinero Sucio**, o para contratar a un *camello* que venda por él mientras no está. Vender a mano paga el precio completo pero sube el Heat; el camello es el paso al juego idle.
5. **Riesgo y recompensa:** Las Comisarías son zonas de alto riesgo de redada (suben el Heat mientras estás dentro), pero los Negocios Tapadera que hay dentro de su radio blanquean un 50 % más (ver §4 ter). El jugador decide cuándo merece la pena jugársela. Más adelante habrá también materiales exclusivos de zona caliente.

### Fase B: En el Cuartel General (Gestión Idle)
1. Desde casa (o cualquier lugar), el jugador abre la vista de su **Cuartel General (HQ)**.
2. **Producción:** Asigna *Precursores* a los **Laboratorios** para cocinar productos de mayor pureza y valor de forma pasiva.
3. **Automatización:** Contrata *Camellos (NPCs)* **en persona, en el parque o bar** donde van a trabajar: quedan asignados a ese punto y venden solos (pueden robar o adulterar, ver §4 quater). Contrata *Transportistas* en el HQ para que recojan los pedidos en los Puntos de Suministro y los lleven al almacén del HQ.
4. **Blanqueo:** Envía **Dinero Sucio** a sus *Negocios Tapadera* para convertirlo en **Dinero Limpio**, necesario para expandir infraestructuras.

---

## 3. Mapeo del Mundo Real (OpenStreetMap -> Gameplay)

| Etiqueta OSM | Tipo de Lugar Real | Rol en el Juego | Mecánica Especial |
| :--- | :--- | :--- | :--- |
| `landuse=industrial` | Polígonos / Fábricas | **Almacén Clandestino** | Punto de Suministro: precursores al por mayor a bajo precio (todos los tipos). |
| `amenity=pharmacy` | Farmacias | **Suministro Químico** | Punto de Suministro legal: vende todos los precursores a precio normal (el almacén clandestino los da un 40 % más baratos) y se paga con **Dinero Limpio**. Si vas en persona hay descuento (§4 bis). |
| `shop=supermarket` | Supermercados | **Suministro Doméstico** | Punto de Suministro legal como la farmacia (Dinero Limpio, precio normal, descuento en persona), pero solo vende los precursores domésticos: fertilizantes y baterías. Hay supermercados en casi cualquier barrio, así que quien no tiene un polígono industrial cerca (por ejemplo, quien no tiene coche) también puede abastecerse. |
| `leisure=park` | Parques y Plazas | **Punto de Menudeo** | Venta rápida, bajo riesgo, margen de beneficio medio. |
| `amenity=bar` / `nightclub` | Bares y Discotecas | **Zona VIP** | Alta demanda y precio x2 entre las 20:00 y las 04:00. |
| `amenity=police` | Comisarías | **Zona Caliente** | Aumenta el medidor de "Búsqueda" (Heat) mientras estás dentro. Si llega al 100 %, la policía se lleva parte del almacén. A cambio, los Negocios Tapadera dentro de su radio blanquean un 50 % más. |
| `shop=laundry` / `car_wash` y otros comercios (talleres, peluquerías, panaderías, cafeterías, etc.) | Comercios de barrio | **Negocio Tapadera** | Permite comprar el local con Dinero Sucio para blanquear dinero automáticamente. Hasta 12 por celda. |

### Nombres de los lugares

Los nombres reales de OpenStreetMap **no se usan nunca** (no queremos marcas ni negocios de verdad en un juego satírico). Cada lugar recibe un nombre inventado, **temático** y **estable**:

- **Se arma juntando piezas** de varias listas con una plantilla: tipo de local + dueño ("Bar Paco"), + adjetivo ("Panadería Dorada"), + "de(l) sustantivo" ("Taller de la Tuerca") o los tres a la vez ("Bar del Gato Loco"). El género y los artículos concuerdan solos. Hay miles de combinaciones por tema.
- **Temático:** depende del tipo de negocio que dice el mapa (lavandería, taller, peluquería, panadería, carnicería, cafetería, heladería, librería, bar, pub, discoteca...). Una panadería saca palabras como *Miga*, *Horno* o *Hogaza*; una farmacia, *Jarabe*, *Receta* o *Probeta*. Almacenes, farmacias, parques y comisarías tienen sus propias listas.
- **Igual para todos y multi-idioma:** el servidor no guarda texto, solo un **código numérico** por lugar (tipo de local + semilla que sale de su id). Cada cliente lo traduce a su idioma con sus propias listas y plantillas, así todos ven el mismo lugar con el mismo nombre en su idioma y añadir un idioma no obliga a regenerar la caché. Las listas de tipos de local solo crecen por el final para no cambiar los nombres ya vistos.
- Los camellos y negocios guardan también ese código, no el texto, para traducirse al cambiar de idioma.
- Los nombres salen en los paneles de cada lugar, las fichas y las listas del HQ; no se dibujan sobre el mapa.

**Resaltado en el mapa:** los lugares con los que tienes trato (camello contratado, negocio, punto de suministro con contacto o pedido en curso) llevan un círculo de color y el icono a pleno color; los demás se ven atenuados. El HQ lleva un círculo propio de borde grueso para localizarlo mejor.

---

## 4. Economía y Recursos

1. **Precursores (Materia Prima):** Químicos básicos, fertilizantes, baterías. Se obtienen en la calle.
2. **Mercancía (Productos Ficticios):**
   - *Hierba Risona* (Tier 1 - Cultivo rápido, bajo valor).
   - *Cristal Azul* (Tier 2 - Requiere Laboratorio Básico, valor medio).
   - *Polvo Estelar* (Tier 3 - Requiere Laboratorio Avanzado, alto valor).
3. **Dinero Sucio (Cash):** Se gana vendiendo, a mano o mediante camellos. No sirve para mejorar edificios principales y la policía puede quitártelo. Para que nunca sea «un paso intermedio que solo resta», tiene usos propios:
   - **Pedidos al Almacén Clandestino** (las farmacias y supermercados cobran en limpio).
   - **Comprar Negocios Tapadera** (es lo que luego lo blanquea).
   - **Prima de lealtad** a los camellos (§4 quater).
   - **Soborno a la policía:** ₡150 ponen el Heat a 0 sin gastar favores (§4 sexies).
   - **Materiales exclusivos** de las zonas calientes (más adelante).
3b. **Notación:** el Dinero Limpio se escribe con **$** y el Dinero Sucio con **₡** (en pantalla, además, en verde y marrón).
4. **Dinero Limpio (Banco):** Sirve para ampliar el HQ, contratar personal, mejorar proveedores y comprar en farmacias y supermercados. Se obtiene de tres formas: **blanqueando** Dinero Sucio, con la **facturación de cada Negocio Tapadera** (cobra una pequeña cantidad limpia por sí mismo) y con el **Empleo de fachada** (§4 quinquies). Así el limpio no depende de que el sucio llegue.
5. **Reputación (XP):** Sube al completar entregas y expandir territorio. Desbloquea nuevos Tiers.

---

## 4 bis. Cadena de Suministro (Puntos de Suministro y Transportistas)

El jugador no carga mercancía encima (no hay mochila: lo que vende a mano sale del almacén del HQ), así que el abastecimiento funciona como una cadena de tres piezas.

**1. Contacto inicial (en persona, obligatorio).** La primera vez hay que acercarse a un Almacén Clandestino o Farmacia (dentro del radio de interacción) y pulsar *Establecer contacto* (gratis). Desde ese momento es un **Punto de Suministro** del jugador para siempre. Sin contacto no se puede pedir nada ahí.

**2. Pedido (remoto, a precio normal).** Con el contacto hecho, el jugador pide desde el HQ o desde donde esté, pagando con **Dinero Sucio** (almacén clandestino) o **Dinero Limpio** (farmacia y supermercado: son comercio legal). **En persona sale más barato:** pedir estando junto a una farmacia o supermercado cuesta un **25 % menos**, con un máximo de **3 pedidos así al día** (para que sea un premio por salir y no una obligación). El Punto de Suministro **prepara la mercancía** (tiempo de preparación) y la deja lista para recoger. Cada punto atiende un pedido a la vez.

**3. Recogida y entrega (Transportistas).** Un **Transportista** libre va al Punto de Suministro, recoge el pedido y lo lleva al **almacén del HQ** (tiempo de viaje). Sin transportistas contratados no llega nada. Si el pedido es mayor que lo que cabe en un viaje, el transportista hace varios. Si el almacén está lleno, lo que no cabe espera en el punto hasta que haya sitio. El cálculo usa la hora real (`Date.now()`), así que sigue corriendo con la app cerrada.

**Mejoras (dos líneas independientes, 3 niveles cada una; cifras provisionales):**

| Pieza | Qué mejora | Nivel 1 | Nivel 2 | Nivel 3 |
| :--- | :--- | :--- | :--- | :--- |
| **Punto de Suministro** | Tiempo de preparación y cantidad máxima por pedido | 6 min · 20 uds | 3 min · 50 uds | 1 min · 120 uds |
| **Transportista** | Duración del viaje y capacidad por viaje | 10 min · 20 uds | 5 min · 50 uds | 2 min · 120 uds |

- **Mejorar un Punto de Suministro:** se negocia **en persona** (hay que ir al sitio) al precio normal, o **por teléfono** (desde cualquier lugar) a un precio **x3**. Se paga con **Dinero Limpio**: Nivel 2 = $800, Nivel 3 = $6.000 (en persona).
- **Contratar y mejorar Transportistas:** se reclutan igual que los Camellos (coste en Dinero Limpio, huecos limitados por el nivel del HQ) y se mejoran con Dinero Limpio. Los transportistas **no están ligados a ningún punto**: se contratan y mejoran en el HQ (pestaña *Suministro*) y el primero que esté libre recoge cualquier pedido listo. Los huecos totales dependen del nivel del HQ (1 / 2 / 3). Más adelante se añadirán los **comerciales** (ver «Ideas futuras» en PLAN.md): personal que pide y suministra materias de forma automática.
- **Arranque suave (primeros pedidos).** Los tiempos de la tabla son los normales, pero un jugador nuevo no puede esperar 6 min de preparación y 10 de viaje para ver su primer pedido: pierde el hilo. Por eso los **cuatro primeros pedidos de la partida** tienen tiempos reducidos: el **1.º** tarda unos 15 s de preparación y 30 s de viaje; el **2.º, 3.º y 4.º** tardan el 25 %, 50 % y 75 % del tiempo normal; a partir del **5.º** son los normales. La cuenta es por jugador (no por punto de suministro) y no se repite. Los favores (§4 sexies) siguen sirviendo para saltar los tiempos largos después.
- **Cuello de botella:** el ritmo de abastecimiento lo marca el eslabón más lento (preparación, número de transportistas o capacidad de viaje), así que conviene mejorar toda la cadena.

---

## 4 ter. Balance y ritmo de progresión

**Todas las cifras viven en `src/data/balance.json`** (precios, recetas, costes, tiempos, camellos, blanqueo, calor, favores, anuncio, GPS). Se tocan ahí y el juego las lee; los tiempos van en segundos o minutos (lo dice el nombre) y las listas se indexan por nivel (el primer valor es el nivel 1).

Para ver el efecto de un cambio: `npx vitest run balanceSim --reporter=verbose --silent=false`. Es una simulación con los motores reales de un jugador atento que sigue siempre el mismo plan de compras e imprime la línea de tiempo (y falla si el ritmo se sale de lo razonable).

Cifras de partida: **$500 limpios** (transportista $200 + primer pedido en farmacia + camello $150) y **₡300 sucios** (el primer negocio tapadera, que se paga con sucio). Así el tutorial se puede completar sin quedarse sin dinero. Durante el tutorial el pedido en farmacia se limita a lo que pide el paso (Fertilizante) para que el jugador nuevo no gaste el limpio en cosas inútiles; fuera del tutorial el pedido es libre.

**Costes en Dinero Limpio**

| Concepto | Nivel 2 | Nivel 3 |
| :--- | :--- | :--- |
| Cuartel General | $2.500 | $18.000 |
| Laboratorio | $3.500 | $24.000 |
| Almacén | $2.000 | $12.000 |
| Punto de Suministro / Transportista | $800 | $6.000 |

Camello $150 · Transportista $200 · Negocio tapadera (en **Dinero Sucio**): $200, $700, $1.500, $3.000, $5.500 y después ×1,8 cada uno.

**Qué da un Negocio Tapadera.** Además de blanquear, cada negocio **factura Dinero Limpio por sí mismo** (unos $2 por minuto, sin gastar sucio), de modo que tiene valor aunque no entre sucio. Y si está dentro del radio de una comisaría, **blanquea un 50 % más**. Comprarlo allí obliga a entrar en la zona (y a subir el Heat mientras estás), que es el precio de la ventaja.

**Cuello de botella:** el blanqueo (cada negocio convierte 18 sucios/min en 14 limpios/min). Mientras tienes un solo negocio, blanquea todo el sucio que entra, así que ahorrar sucio para el segundo es difícil hasta que mejoras el suministro: es la tensión del arranque. Para que no frene al jugador nuevo, **durante las primeras 2 horas de partida el blanqueo no cobra comisión** (rinde el 100 %); después vuelve al 80 %. Más adelante la producción supera lo que se puede blanquear y los negocios adicionales son el sumidero de sucio.

**Ritmo medido en la simulación** (jugador atento, sin ir a la calle más que para contratar):

| Momento | Hito |
| :--- | :--- |
| Minuto 0 | Primer transportista, camello y negocio tapadera. Empieza la Hierba Risona. |
| Primera hora | Segundo camello. |
| Horas 2-4 | Transportista y proveedor al nivel 2; reputación 100: se puede desbloquear el **Cristal Azul** (falta el Laboratorio Básico). |
| Horas 5-9 | HQ y laboratorio al nivel 2, segundo negocio, camellos 3 y 4, segundo transportista. |
| Horas 10-20 | Mejoras de suministro, almacén 2, tercer negocio. |
| Horas 24-45 | HQ y laboratorio al nivel 3, camellos 5 y 6, tercer transportista, almacén 3, negocios 4-5. Toda la infraestructura mejorada (~44 h). |
| ~6 h | Reputación 500: el **Polvo Estelar** queda disponible en cuanto haya Laboratorio Avanzado. |

Dos atascos que la simulación sacó a la luz y están corregidos o vigilados: (1) el almacén lleno de precursores sobrantes dejaba al laboratorio sin sitio para el producto (ahora el tope del laboratorio cuenta solo producto terminado); (2) si el sucio llega a 0 con el blanqueo activo, no se puede pedir y la partida se para: la salida es ensuciar limpio en el HQ o el anuncio de rescate (§4 quinquies).

La reputación sube con las ventas de los camellos (1 / 3 / 8 por unidad según producto): cuantos más camellos y producto, más rápido se avanza de Tier.

**Pendientes de balance:** pasadas las ~44 h todo está mejorado y el dinero se acumula sin uso. Hacen falta más sumideros (más niveles, prestigio, expansión territorial de la Fase 2). La *Prima* (§4 quater) es un primer sumidero de Dinero Sucio.

---

## 4 quater. Camellos: lealtad, robo y adulteración

Los camellos se contratan **en persona** en un Parque, Bar o Discoteca ($150 limpios, huecos según nivel del HQ) y **quedan asociados a ese punto**. Venden 1 unidad cada 30 s del almacén y cobran su parte (80 %).

**Fiabilidad (0-100).** Cada camello tiene una fiabilidad oculta (30-90 al azar, determinista por punto). Cuanto más baja, más riesgo:

| Suceso | Probabilidad por venta | Efecto |
| :--- | :--- | :--- |
| **Robo** | 12 % × (1 − fiabilidad/100) | Se queda el 40 % de lo que sacó la venta |
| **Adulteración** | 10 % × (1 − fiabilidad/100) | Entrega el 70 % del importe, +5 Heat y −1 reputación (clientes quejosos) |

**Cómo se ve.** Cada camello tiene su ficha (en el HQ y al abrir su sitio en el mapa): ventas, cobrado, dinero perdido por robos/adulteraciones y nº de adulteraciones. La **fiabilidad real se revela tras 20 ventas** (antes aparece «?»). Además hay un **Informe de sucesos** en el HQ con los últimos incidentes.

**Qué se puede hacer.** Pagar una **Prima** ($200 Dinero Sucio, +15 fiabilidad; sumidero de dinero sucio) o **despedirlo**.

**Venta a mano.** En un parque, bar o discoteca el jugador puede vender él mismo, sin camello, producto terminado del almacén del HQ (botones «Vender 10» y «Todo»; hay que estar allí). Cobra el **100 %** del precio (el camello se queda el 20 %), la discoteca sigue pagando x2 de noche, y cada unidad sube **0,3 de Heat** (`ventaManual` en balance.json): vender mucho de golpe atrae a la policía. Da la misma reputación que un camello. Así nadie depende de los camellos para cobrar; ellos aportan vender solos con la app cerrada. El primer paso del tutorial de venta se da por hecho con cualquier venta, a mano o de camello.

**Reputación.** Cada venta (de un camello o a mano) da la reputación completa del producto.

**Redadas.** Cuando el Heat llega al máximo, la policía se lleva un 30 % de las existencias del almacén. El jugador puede evitarlo calmando a la policía con favores o con un soborno (§4 sexies).

El cálculo es determinista (hash de camello + instante), así que sale igual offline y online y un servidor podrá reproducirlo (Fase 2).

---

## 4 quinquies. Red de seguridad (no quedarse sin dinero)

Los precursores se pagan con **Dinero Sucio**, pero el blanqueo automático lo convierte en limpio. Sin cuidado, el sucio llega a 0, no puedes pedir ingredientes, no produces y no entra más dinero (la simulación lo confirma: la partida no avanza). Cinco piezas lo evitan:

1. **Ensuciar dinero.** El jugador puede cambiar Dinero Limpio por Dinero Sucio en el HQ (pestaña Mejoras). Un cambista se queda con la mitad: de cada $100 limpios salen $50 sucios. Es la salida de emergencia si el sucio se agota, y cara a propósito para que no sustituya al blanqueo normal. Los pedidos al almacén se pagan con sucio; los de farmacia, con limpio.
2. **Reembolso al despedir.** Despedir a un camello devuelve el **50 %** de su coste de contratación, en Dinero Limpio (lo que pagaste).
3. **Negocio con sucio.** El negocio tapadera se paga con Dinero Sucio (no tendría sentido «blanquear» pagando con limpio). Si gastas todo el sucio en pedidos antes de tener el primero, la salida es ensuciar limpio en el HQ o esperar a las ventas del camello.

4. **Empleo de fachada.** El jugador tiene un trabajo legal que le sirve de tapadera y que **paga Dinero Limpio sin hacer nada**: unos $100 cada 30 min, acumulables hasta 4 pagos (2 h, también con la app cerrada), que se cobran con un toque en el HQ. Es el sueldo «gratis» que impide quedarse sin limpio, sin necesidad de un minijuego.
5. **Anuncio de rescate.** Si el jugador tiene menos de $30 sucios y menos de $100 limpios, el juego le propone ver un anuncio a cambio de **$100 sucios**. El anuncio bloquea la pantalla 20 s (sin poder cerrarlo) y después paga. Hay una espera de 5 min entre rescates. De momento es un hueco de prueba («AD HERE»), sin red publicitaria; la recompensa es siempre en Dinero Sucio, nunca en limpio.

Pendiente de valorar: que ensuciar dinero también tenga un coste en Heat o un límite diario si se abusa.

---

## 4 sexies. Favores (saltar esperas)

Tercera moneda, aparte del Dinero Sucio y el Limpio, para no alterar la economía. Representa favores que te debe el hampa.

- **Qué salta:** el tiempo de preparación de un pedido, el viaje de un transportista y el lote que está cocinando el laboratorio. También despista a la policía (Heat a 0): 3 favores o, con Dinero Sucio, un **soborno de ₡150**.
- **Precio:** 1 favor por cada 5 minutos de espera restantes, redondeando hacia arriba (mínimo 1). Una espera de 2 h cuesta 24.
- **Cómo se consiguen:** 5 de regalo al empezar y 1 por cada paso del tutorial. **Viendo un anuncio** (botón en la pestaña Mejoras del HQ): 20 s de anuncio y **+2 favores**, con una espera de 1 min entre anuncios (24 favores, una espera de 2 h, salen en unos 16 min: el 13 % de la espera) (`anuncio.favoresPorAnuncio` y `esperaFavorMinutos` en balance.json). Más adelante: hitos de reputación y premio diario.
- **Dónde se ve:** en la barra superior y en la cabecera del HQ. Los botones de saltar aparecen junto a cada espera.

**Herramientas de prueba.** Con `?dev` en la URL aparece un panel (DEV) para dar dinero, favores y reputación, adelantar el reloj 1 h u 8 h y saltar o reiniciar el tutorial. No existe para los jugadores.

---

## 5. Infraestructuras del Imperio
- **Cuartel General (HQ):** El jugador lo coloca en el mapa al empezar (puede moverlo gratis cada 7 días). Determina el nivel máximo de los demás edificios.
- **Almacén:** Capacidad máxima de almacenamiento en la base.
- **Laboratorio:** Transforma Precursores en Mercancía automáticamente (mejorable en velocidad y pureza).
- **Red de Camellos:** Slots de NPCs, cada uno asignado al punto de venta donde se contrató; generan ingresos *Idle* con riesgo de robo/adulteración (ver §4 quater).
- **Empleo de fachada:** trabajo legal del jugador que paga Dinero Limpio pasivo (ver §4 quinquies).
- **Red de Transportistas:** NPCs que llevan los pedidos de los Puntos de Suministro al almacén del HQ (ver §4 bis). Sus huecos dependen del nivel del HQ.

---

## 6. Preparación para Multijugador (Fase 2 - Guerra de Territorios)
- El mapa se divide usando **Uber H3 (Resolución 8 - aprox. 0.7 km² por hexágono)**.
- Cada venta realizada por el jugador suma **Puntos de Influencia** en ese hexágono.
- El jugador con mayor influencia domina el hexágono, tiñéndolo de su color y obteniendo un **+15% de beneficios** en todas las operaciones dentro de esa zona.
- Los jugadores pueden ver los hexágonos dominados por rivales y competir haciendo ventas en esa zona para arrebatar el control.

---

## 7. Roadmap de Desarrollo (MVP)
- **Sprint 1 (Core Técnico):** Setup Vite + PWA, integración de MapLibre con estilo cartoon, lectura de GPS real y movimiento del avatar.
- **Sprint 2 (Mundo Real):** Conexión con Overpass API para pintar Parques, Bares y Comisarías reales alrededor del jugador.
- **Sprint 3 (Loop de Calle):** Inventario básico, interacción al estar a <50m de un POI (comprar precursores y vender producto).
- **Sprint 4 (Base e Idle):** Creación del HQ, sistema de fabricación en laboratorio con cálculo de tiempo offline y blanqueo básico.
- **Sprint 5 (Pulido UI):** Efectos de sonido cartoon, notificaciones locales (ej. "Lote terminado en el laboratorio") y balanceo económico.
- **Sprint 7 (Cadena de Suministro):** Puntos de Suministro (contacto en persona), pedidos remotos, Transportistas contratables y mejoras de ambos (ver §4 bis).
- **Sprint 9 (Arranque y economía):** implementado en el juego: rampa de arranque de los cuatro primeros pedidos, blanqueo sin comisión las 2 primeras horas, supermercados como punto de suministro, descuento del 25 % en persona (máx. 3 al día), pedido limitado en el tutorial, facturación limpia de los negocios tapadera, bonus del 50 % en zona policial, soborno de ₡150, empleo de fachada, 2 favores por anuncio y venta a mano. **Pendiente de desplegar:** la función del servidor `poi-cell` con la clase de supermercado (hasta entonces los supermercados no aparecen en celdas ya cacheadas en el servidor). Pendiente de afinar con jugadores reales: las cifras provisionales ($2/min de facturación, $100 de empleo, −25 %, ₡150).
