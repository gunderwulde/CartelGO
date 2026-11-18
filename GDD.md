# GDD.md - Game Design Document: "Cartel GO" (Título Provisional)

## 1. Visión General
- **Género:** GPS Location-Based / Idle Tycoon.
- **Plataforma:** Web Móvil (PWA instalable en iOS y Android).
- **Estilo Visual:** Caricatura vibrante (estilo *Grand Theft Auto: Chinatown Wars* mezclado con *Simpsons: Tapped Out*). Trazos negros gruesos, colores saturados y tono de humor ácido.
- **Modo de Juego:** Fase 1 Single-Player (PvE contra la policía y el mercado) con arquitectura preparada para Fase 2 Multijugador Asíncrono (PvP territorial).

---

## 2. Bucle Principal (Core Loop)

### Fase A: En la Calle (Exploración GPS)
1. El jugador camina por su ciudad con el mapa abierto.
2. El radar (radio de interacción de **50 metros**) detecta Puntos de Interés (POIs) generados desde OpenStreetMap.
3. **Abastecimiento:** La **primera vez** el jugador tiene que ir en persona a una Zona Industrial o Farmacia para establecer contacto y convertirla en **Punto de Suministro**. A partir de ahí no hace falta volver: los pedidos de *Precursores* se hacen desde el HQ o desde cualquier sitio y un *Transportista* los trae (ver §4 bis).
4. **Distribución:** El jugador visita Parques, Bares o Discotecas para contratar a un *camello* que venda por él el *Producto Terminado* (no vende a mano) a cambio de **Dinero Sucio**.
5. **Evasión:** El jugador evita el radio de influencia de las Comisarías (zonas de alto riesgo de redada).

### Fase B: En el Cuartel General (Gestión Idle)
1. Desde casa (o cualquier lugar), el jugador abre la vista de su **Cuartel General (HQ)**.
2. **Producción:** Asigna *Precursores* a los **Laboratorios** para cocinar productos de mayor pureza y valor de forma pasiva.
3. **Automatización:** Contrata *Camellos (NPCs)* **en persona, en el parque o bar** donde van a trabajar: quedan asignados a ese punto y venden solos (pueden robar o adulterar, ver §4 quater). Contrata *Transportistas* para que recojan los pedidos en los Puntos de Suministro y los lleven al almacén del HQ.
4. **Blanqueo:** Envía **Dinero Sucio** a sus *Negocios Tapadera* para convertirlo en **Dinero Limpio**, necesario para expandir infraestructuras.

---

## 3. Mapeo del Mundo Real (OpenStreetMap -> Gameplay)

| Etiqueta OSM | Tipo de Lugar Real | Rol en el Juego | Mecánica Especial |
| :--- | :--- | :--- | :--- |
| `landuse=industrial` | Polígonos / Fábricas | **Almacén Clandestino** | Punto de Suministro: precursores al por mayor a bajo precio (todos los tipos). |
| `amenity=pharmacy` | Farmacias | **Suministro Químico** | Punto de Suministro: vende todos los precursores, pero a precio normal (el almacén clandestino los da un 40 % más baratos). Así ninguna zona se queda sin abastecimiento. |
| `leisure=park` | Parques y Plazas | **Punto de Menudeo** | Venta rápida, bajo riesgo, margen de beneficio medio. |
| `amenity=bar` / `nightclub` | Bares y Discotecas | **Zona VIP** | Alta demanda y precio x2 entre las 20:00 y las 04:00. |
| `amenity=police` | Comisarías | **Zona Caliente** | Aumenta el medidor de "Búsqueda" (Heat). Si llega al 100%, pierdes la mercancía que llevas encima. |
| `shop=laundry` / `car_wash` | Lavanderías / Autolavados | **Negocio Tapadera** | Permite comprar el local para blanquear dinero automáticamente. |

---

## 4. Economía y Recursos

1. **Precursores (Materia Prima):** Químicos básicos, fertilizantes, baterías. Se obtienen en la calle.
2. **Mercancía (Productos Ficticios):**
   - *Hierba Risona* (Tier 1 - Cultivo rápido, bajo valor).
   - *Cristal Azul* (Tier 2 - Requiere Laboratorio Básico, valor medio).
   - *Polvo Estelar* (Tier 3 - Requiere Laboratorio Avanzado, alto valor).
3. **Dinero Sucio (Cash):** Se gana vendiendo en la calle o mediante camellos. No se puede usar para mejorar edificios principales y se pierde si te atrapa la policía.
4. **Dinero Limpio (Banco):** Se obtiene blanqueando Dinero Sucio. Sirve para ampliar el HQ, comprar negocios tapadera y desbloquear tecnologías.
5. **Reputación (XP):** Sube al completar entregas y expandir territorio. Desbloquea nuevos Tiers.

---

## 4 bis. Cadena de Suministro (Puntos de Suministro y Transportistas)

El jugador no carga mercancía encima (no hay mochila: se dedica a los negocios, no a vender en la calle), así que el abastecimiento funciona como una cadena de tres piezas.

**1. Contacto inicial (en persona, obligatorio).** La primera vez hay que acercarse a un Almacén Clandestino o Farmacia (dentro del radio de interacción) y pulsar *Establecer contacto* (gratis). Desde ese momento es un **Punto de Suministro** del jugador para siempre. Sin contacto no se puede pedir nada ahí.

**2. Pedido (remoto, a precio normal).** Con el contacto hecho, el jugador pide desde el HQ o desde donde esté, pagando con **Dinero Sucio**. El Punto de Suministro **prepara la mercancía** (tiempo de preparación) y la deja lista para recoger. Cada punto atiende un pedido a la vez.

**3. Recogida y entrega (Transportistas).** Un **Transportista** libre va al Punto de Suministro, recoge el pedido y lo lleva al **almacén del HQ** (tiempo de viaje). Sin transportistas contratados no llega nada. Si el pedido es mayor que lo que cabe en un viaje, el transportista hace varios. Si el almacén está lleno, lo que no cabe espera en el punto hasta que haya sitio. El cálculo usa la hora real (`Date.now()`), así que sigue corriendo con la app cerrada.

**Mejoras (dos líneas independientes, 3 niveles cada una; cifras provisionales):**

| Pieza | Qué mejora | Nivel 1 | Nivel 2 | Nivel 3 |
| :--- | :--- | :--- | :--- | :--- |
| **Punto de Suministro** | Tiempo de preparación y cantidad máxima por pedido | 6 min · 20 uds | 3 min · 50 uds | 1 min · 120 uds |
| **Transportista** | Duración del viaje y capacidad por viaje | 10 min · 20 uds | 5 min · 50 uds | 2 min · 120 uds |

- **Mejorar un Punto de Suministro:** se negocia **en persona** (hay que ir al sitio) al precio normal, o **por teléfono** (desde cualquier lugar) a un precio **x3**. Se paga con **Dinero Limpio**: Nivel 2 = $600, Nivel 3 = $2.000 (en persona).
- **Contratar y mejorar Transportistas:** se reclutan igual que los Camellos (coste en Dinero Limpio, huecos limitados por el nivel del HQ) y se mejoran con Dinero Limpio. Los transportistas se gestionan desde el HQ, sin ir a ningún sitio.
- **Cuello de botella:** el ritmo de abastecimiento lo marca el eslabón más lento (preparación, número de transportistas o capacidad de viaje), así que conviene mejorar toda la cadena.

---

## 4 ter. Balance y ritmo de progresión (provisional)

Cifras de partida: **$550 limpios** (justo un negocio tapadera + un transportista + un camello; con menos el jugador se bloquea porque sin negocio no entra Dinero Limpio) y $100 sucios.

**Costes en Dinero Limpio**

| Concepto | Nivel 2 | Nivel 3 |
| :--- | :--- | :--- |
| Cuartel General | $1.200 | $4.800 |
| Laboratorio | $1.600 | $6.000 |
| Almacén | $1.000 | $3.600 |
| Punto de Suministro / Transportista | $600 | $2.000 |

Camello $150 · Transportista $200 · Negocio tapadera: el primero $200 y luego $1.600, $2.400, $3.200…

**Cuello de botella:** el blanqueo (cada negocio convierte 30 sucios/min en 24 limpios/min). La producción supera pronto lo que se puede blanquear, por eso los negocios adicionales escalan fuerte.

**Cronograma de un jugador atento** (cifras de una simulación antigua en la que el jugador también vendía a mano; ahora todo lo venden los camellos y habrá que volver a simular):

| Momento | Hito |
| :--- | :--- |
| Minuto 0 | Primer negocio, transportista y camello. Empieza la Hierba Risona. |
| Primera hora | Segundo camello y transportista al nivel 2. |
| Horas 2-5 | HQ y laboratorio al nivel 2 (Laboratorio Básico), segundo negocio, camellos 3 y 4, almacén al nivel 2. |
| Día 1-2 | Reputación 100 vendiendo a mano: se desbloquea el **Cristal Azul**. |
| Horas 6-12 | Segundo transportista, HQ y laboratorio al nivel 3, camellos 5 y 6, negocios 3-5. Toda la infraestructura mejorada. |
| Día 4 | Reputación 500: se desbloquea el **Polvo Estelar**. |

La reputación sube con las ventas de los camellos (1 / 3 / 8 por unidad según producto): cuantos más camellos y producto, más rápido se avanza de Tier.

**Pendientes de balance:** pasadas las ~12 h todo está mejorado y el dinero se acumula sin uso. Hacen falta más sumideros (más niveles, prestigio, expansión territorial de la Fase 2). Los camellos dan el 25 % de la reputación por unidad vendida y la *Prima* (§4 quater) es un primer sumidero de Dinero Sucio.

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

**Reputación.** Cada venta de un camello da la reputación completa del producto (ya no existe la venta a mano).

**Redadas.** Sin mochila, la policía se lleva un 30 % de las existencias del almacén.

El cálculo es determinista (hash de camello + instante), así que sale igual offline y online y un servidor podrá reproducirlo (Fase 2).

---

## 4 quinquies. Red de seguridad (no quedarse sin dinero)

Los precursores se pagan con **Dinero Sucio**, pero el blanqueo automático lo convierte en limpio. Sin cuidado, el sucio llega a 0, no puedes pedir ingredientes, no produces y no entra más dinero (la simulación lo confirma: la partida no avanza). Cuatro piezas lo evitan:

1. **Ensuciar dinero.** El jugador puede cambiar Dinero Limpio por Dinero Sucio en el HQ (pestaña Mejoras). Un cambista se queda con la mitad: de cada $100 limpios salen $50 sucios. Es la salida de emergencia si el sucio se agota, y cara a propósito para que no sustituya al blanqueo normal. Los pedidos se pagan siempre con sucio.
2. **Reembolso al despedir.** Despedir a un camello devuelve el **50 %** de su coste de contratación, en Dinero Limpio (lo que pagaste).
3. **Aviso de bloqueo.** Si una compra en limpio (o ensuciar dinero) te deja sin los $200 necesarios para el primer negocio tapadera y aún no tienes ninguno, la app pregunta antes de ejecutarla.

4. **Anuncio de rescate.** Si el jugador tiene menos de $30 sucios y menos de $100 limpios, el juego le propone ver un anuncio a cambio de **$100 sucios**. El anuncio bloquea la pantalla 20 s (sin poder cerrarlo) y después paga. Hay una espera de 5 min entre rescates. De momento es un hueco de prueba («AD HERE»), sin red publicitaria; la recompensa es siempre en Dinero Sucio, nunca en limpio.

Pendiente de valorar: que ensuciar dinero también tenga un coste en Heat o un límite diario si se abusa.

---

## 4 sexies. Favores (saltar esperas)

Tercera moneda, aparte del Dinero Sucio y el Limpio, para no alterar la economía. Representa favores que te debe el hampa.

- **Qué salta:** el tiempo de preparación de un pedido, el viaje de un transportista y el lote que está cocinando el laboratorio. También despista a la policía (Heat a 0, 3 favores).
- **Precio:** 1 favor por cada 5 minutos de espera restantes, redondeando hacia arriba (mínimo 1). Una espera de 2 h cuesta 24.
- **Cómo se consiguen:** 5 de regalo al empezar y 1 por cada paso del tutorial. Más adelante: hitos de reputación, premio diario y anuncios con recompensa.
- **Dónde se ve:** en la barra superior y en la cabecera del HQ. Los botones de saltar aparecen junto a cada espera.

**Herramientas de prueba.** Con `?dev` en la URL aparece un panel (DEV) para dar dinero, favores y reputación, adelantar el reloj 1 h u 8 h y saltar o reiniciar el tutorial. No existe para los jugadores.

---

## 5. Infraestructuras del Imperio
- **Cuartel General (HQ):** El jugador lo coloca en el mapa al empezar (puede moverlo gratis cada 7 días). Determina el nivel máximo de los demás edificios.
- **Almacén:** Capacidad máxima de almacenamiento en la base.
- **Laboratorio:** Transforma Precursores en Mercancía automáticamente (mejorable en velocidad y pureza).
- **Red de Camellos:** Slots de NPCs, cada uno asignado al punto de venta donde se contrató; generan ingresos *Idle* con riesgo de robo/adulteración (ver §4 quater).
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
