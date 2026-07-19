-- Soporte para Factura E (exportación de servicios) vía WSFEXv1.
-- WSFEXv1 es un webservice separado con su propio Ticket de Acceso (TA)
-- de WSAA; los TA no son intercambiables entre servicios.

-- Cada TA es por (usuario, ambiente, servicio). Agregamos `service` con
-- default 'wsfe' para no romper los ya cacheados.
alter table afip_tickets add column if not exists service text not null default 'wsfe';
alter table afip_tickets drop constraint if exists afip_tickets_pkey;
alter table afip_tickets add primary key (user_id, ambiente, service);

-- Campos adicionales para Factura E. En una Factura C todos quedan null
-- o con sus defaults (moneda='PES', cotización=1).
alter table invoices
  add column if not exists moneda_cotizacion numeric(14, 6) not null default 1,
  add column if not exists cliente_pais integer,
  add column if not exists cliente_domicilio text,
  add column if not exists cliente_id_impositivo text,
  add column if not exists tipo_expo smallint,
  add column if not exists idioma_cbte smallint;

-- En Factura E no hay doc_tipo/doc_nro (cliente extranjero) ni
-- condición IVA del receptor. Relajamos NOT NULL — la app garantiza
-- que estén completos cuando corresponde (Factura C).
alter table invoices alter column cliente_doc_tipo drop not null;
alter table invoices alter column cliente_doc_nro drop not null;
alter table invoices alter column condicion_iva_receptor_id drop not null;
