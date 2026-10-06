# 0003 · Costos en tablas separadas

**Estado:** aceptada

## Contexto

RLS filtra filas, no columnas, y en Supabase todos los usuarios usan el rol de base
`authenticated`. Un costo en `product_variants` sería legible por un vendedor vía la API.

## Decisión

El costo vive en `variant_costs` (y el costo histórico de ventas en `sale_item_costs`) con políticas
RLS que lo limitan a dueño, encargado y depósito. La UI usa vistas/RPC que unen los datos según el rol.

## Consecuencias

- Los vendedores no pueden leer costos ni márgenes por ningún camino.
- Un join adicional en pantallas que muestran costo.
