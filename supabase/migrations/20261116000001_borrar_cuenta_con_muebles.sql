-- ════════════════════════════════════════════════════════════════════════════
-- Arreglo: no se podía borrar una cuenta que tuviera muebles.
--
-- La clave foránea cabinets → methods era `on delete restrict`. Al borrar un usuario, Postgres
-- borra en cascada sus métodos y sus muebles, pero RESTRICT se comprueba en el momento de borrar
-- cada método, cuando sus muebles todavía no se han borrado, y la operación entera fallaba.
--
-- Con `no action` la comprobación se hace al final de la operación: al borrar la cuenta ya no
-- quedan muebles y todo se borra; al borrar a mano un método que usa algún mueble, sigue fallando
-- (error 23503), que es lo que queremos.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.cabinets drop constraint cabinets_user_id_method_id_fkey;

alter table public.cabinets
  add constraint cabinets_user_id_method_id_fkey
  foreign key (user_id, method_id) references public.methods (user_id, id)
  on delete no action on update cascade;
