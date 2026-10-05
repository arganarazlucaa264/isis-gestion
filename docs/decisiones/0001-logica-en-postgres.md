# 0001 · La lógica de negocio crítica vive en PostgreSQL

**Estado:** aceptada

## Contexto

Vender, mover stock, operar la caja y recibir compras deben ser atómicos y consistentes aunque
haya varios usuarios simultáneos o un frontend con errores. El navegador no es confiable.

## Decisión

Las escrituras de negocio se hacen únicamente mediante funciones RPC (PL/pgSQL) transaccionales.
Las tablas transaccionales no tienen políticas RLS de INSERT/UPDATE/DELETE para el cliente.
Las funciones `SECURITY DEFINER` fijan `search_path` y verifican el rol del usuario adentro.

## Consecuencias

- Integridad garantizada por la base, independiente de la UI.
- Las reglas se testean con pgTAP.
- El frontend es más simple (llama RPC y muestra resultados), pero hay que escribir SQL con cuidado.
