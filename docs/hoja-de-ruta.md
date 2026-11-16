# Hoja de ruta

Actualizada el 15 de noviembre de 2026.

## Decisiones que marcan el plan

- **Sin CNC.** El taller no tiene máquina de control numérico: las piezas se encargan cortadas a una **maderera**. Por eso la salida de producción prioritaria es una lista de corte clara (CSV, impresa o PDF) y, más adelante, un optimizador que diga cuántos tableros pedir. Los posprocesadores para máquinas CNC pasan a "quizá algún día".
- **Impresión 3D.** Exportar a STL, el mueble completo o pieza a pieza, a escala, con opciones para los cajones (integrados, aparte montados o pieza a pieza).
- **Repositorio público** en GitHub: <https://github.com/MaharBa264/mubleando>.
- **Documentación** siempre detallada y en español.

## Fase 1: el núcleo (hecha)

- Motor de cálculo: caja, trasera en ranura o clavada, estantes y divisores anidados, medidas fijas o repartidas, canto frontal, medidas de corte.
- Proyectos y muebles, editor 3D con estructura y propiedades, deshacer y rehacer, guardado automático con detección de conflictos.
- Despiece agrupado o pieza a pieza, por mueble y por proyecto; CSV; totales de material y coste.
- PWA (instalable, sin conexión en producción).
- Exportación STL para impresión 3D (añadida tras la fase 1).

## Fase 2: muebles completos (hecha)

- **Puertas**: una o dos hojas, superpuestas o encastradas, con holgura y bisagras a un lado u otro.
- **Cajones**: por número, con alturas fijas o repartidas; caja completa (laterales, trasera, contrafrente, fondo en ranura o clavado), holguras para guías y fondo redondeado a largos de guía.
- **Zócalo** con altura y retranqueo.
- **Bibliotecas editables**: tableros, cantos y precios; métodos de fabricación propios, con frentes y cajones.
- **Material y cantos por pieza**.
- Visor con frentes cerrados, abiertos u ocultos. STL con los cajones integrados, aparte o por piezas.

Pendiente de la fase 2, para más adelante:

- Zonas exteriores aparte del zócalo (cornisa, remates laterales).
- Puertas correderas y abatibles.
- Cajones interiores (detrás de una puerta) y cajones con frente doble.
- Tolerancias de encaje propias para los cajones impresos en 3D.

## Guardado en la nube

- Cuentas de usuario y proyectos sincronizados entre el ordenador y el móvil (Supabase: base de datos Postgres con permisos por fila).
- Las pantallas no cambian: se sustituye la capa de datos.
- Necesita una cuenta gratuita de Supabase.

## Comprobación contra listas reales

- Montar 2–3 muebles en el programa comercial que usa hoy el taller, exportar su lista de corte y dejarla en `replica/referencia/`.
- Se convierten en pruebas automáticas y se ajusta el motor hasta que las cifras coincidan.
- Puede hacerse en paralelo con cualquier fase.

## Fase 3: producción y presupuesto

- **Pedido a la maderera**: hoja de pedido lista para enviar (PDF), con piezas, cantos y observaciones; formato que pida tu maderera si tiene uno.
- **Optimizador de corte**: cuántos tableros hacen falta y cómo se colocan las piezas, respetando la veta.
- **Etiquetas** de piezas para identificarlas al montar.
- **Presupuesto en PDF** para el cliente.
- **Herrajes** (bisagras, correderas) con sus reglas de colocación y su lista de compra.
- **Planos** con cotas.
- DXF por pieza (útil si algún día se usa un servicio de corte por control numérico).

## Al final

- Diseño visual y marca propios.
- Publicación en un dominio propio (HTTPS, instalación en el móvil).

## Quizá algún día

- Muebles en L y rinconeros, forma libre.
- Estancia con varios muebles colocados, y exportarla a STL.
- Posprocesadores para máquinas CNC concretas.
- Compartir un proyecto con el cliente por enlace.
