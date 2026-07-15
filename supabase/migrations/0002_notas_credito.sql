-- Permite anular una factura mediante una Nota de Crédito C que la referencia.
alter table invoices
  add column if not exists comprobante_asociado_id uuid references invoices(id);

create index if not exists invoices_comprobante_asociado_id_idx
  on invoices (comprobante_asociado_id);
