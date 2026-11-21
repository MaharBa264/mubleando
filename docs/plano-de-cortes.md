# Plano de cortes

Cuántas **placas enteras** hay que comprar para un mueble o un proyecto, cómo salen las piezas de cada placa y cuánto cuestan. Está al final del **Despiece**, del mueble o del proyecto (el del proyecto junta las piezas de todos los muebles, con su cantidad).

> La maderera suele optimizar con el programa de su seccionadora y puede sacar un plano un poco distinto. El de la app sirve para saber, antes de pedir, cuántas placas hacen falta y cuánto cuestan, y para llevar un dibujo claro.

## Qué muestra

- Arriba, el total: placas y costo de las placas enteras.
- Por cada tablero: la medida de la placa, cuántas placas, el **aprovechamiento** (superficie de las piezas sobre la de las placas), el **sobrante** en m² y el costo.
- Un dibujo por placa: cada pieza con su **número de la lista agrupada** (G1, G2…) y su medida de corte (largo × ancho). **↻** = la pieza va girada en la placa. Pasando el mouse sobre una pieza chica se ve su número y medida. En los tableros con veta, unas rayas marcan su dirección.
- Si una pieza no entra ni en una placa vacía, un aviso rojo dice cuál.
- **Imprimir** del despiece incluye el plano, cada placa sin cortarse entre páginas. Para PDF, elegí «Guardar como PDF» al imprimir.

## Cómo acomoda las piezas

- **Cortes guillotina**: de lado a lado de la placa o del trozo que queda, como corta una seccionadora. Cada pieza que se acomoda deja el sobrante partido en dos rectángulos con un solo corte recto.
- Las medidas son las **de corte** (ya descontado el canto), las mismas de la lista.
- **Sierra** (de partida 4 mm): entre pieza y pieza queda el espesor de la sierra.
- **Refilado** (de partida 10 mm): se recorta cada borde de la placa para sacar el canto de fábrica, que suele venir golpeado.
- **Veta**: en los tableros con veta, el largo de la pieza va siempre a lo largo de la placa (no se gira). Los lisos se giran si así se aprovecha mejor.
- Cada material va en sus placas: la melamina de 18 por un lado, el fibrofácil de 3 de los fondos por otro.
- Prueba varios órdenes (por superficie, por el lado más largo, por largo y por ancho) y dos maneras de partir el sobrante, y se queda con el plano que usa **menos placas**. Si empatan, con el que deja la última placa más vacía, para que el sobrante quede junto y sirva como retazo.

Sierra y refilado se cambian arriba del plano y quedan guardados en ese navegador.

## Medida de la placa

En **Bibliotecas → Tableros**, cada tablero puede tener la medida de la placa que comprás (largo y ancho; la veta va a lo largo). Vacía, se usa la de partida:

| Espesor | Placa de partida |
| --- | --- |
| Hasta 6 mm (fibrofácil de fondos) | 2600 × 1830 |
| Más de 6 mm (melamina, aglomerado, MDF) | 2750 × 1830 |

## Costo

- **Placas enteras** = cantidad de placas × superficie de la placa × precio por m² del tablero. Es lo que se paga si la maderera vende placas enteras.
- El resumen del despiece sigue mostrando el costo **por m² de pieza**, que no cuenta el sobrante.

Ejemplo: con la melamina a $ 10.000 el m², una placa de 2750 × 1830 (5,0325 m²) cuesta $ 50.325.

## Código

- Motor: [`packages/engine/src/cutting.ts`](../packages/engine/src/cutting.ts): `nest(piezas, placa, opciones)` y `cuttingPlan(piezas del despiece, materiales, opciones)`.
- Pruebas: `packages/engine/test/cutting.test.ts`. Una placa llena justo con cuatro piezas (y con 1 mm más ya no entran), piezas que no entran, giro con y sin veta, y 200 listas al azar en las que se comprueba que ninguna pieza se superpone con otra (contando la sierra), que todas quedan dentro de la zona útil y que no se pierde ninguna.
- Pantalla: `apps/web/src/components/CuttingPlanView.tsx`, al final de `CutListView`.
- Base de datos: columnas `sheet_length` y `sheet_width` de `materials` (migración `20261121000001_medida_de_placa.sql`). Sin la migración, el plano funciona con las placas de partida.

## Pendiente

- Guardar los **retazos** que sobran para usarlos en otro trabajo (una biblioteca de retazos).
- Exportar el plano en el formato de los programas de las madereras.
