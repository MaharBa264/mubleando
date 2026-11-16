# mueblesweb (nombre provisional)

App propia de diseño de muebles por paneles, para navegador y móvil (PWA). Planificación en `replica/`.

## Arrancar

```bash
npm install
npm run dev        # http://localhost:3100
npm test           # pruebas del motor y del CSV
npm run build      # compilación de producción (activa el modo sin conexión)
```

## Estructura

- `packages/engine`: motor paramétrico. Convierte un diseño (medidas + huecos) y un método de fabricación en piezas con medidas de corte, cantos y totales. Sin interfaz ni red. Todas las longitudes son enteros en centésimas de mm.
- `packages/exporters`: exportaciones (CSV de lista de corte).
- `apps/web`: Next.js. Proyectos, editor 3D (React Three Fiber), propiedades y despiece. Los datos se guardan hoy en el navegador (`src/data/local.ts`).
