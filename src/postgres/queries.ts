// The complete allow-list of SQL that the live collector can send. There is no API that
// accepts SQL text from callers; the collector refers to queries by id only.
//
// - Every catalog object and function is schema-qualified with pg_catalog.
// - The schema filter is always a bound parameter ($1::pg_catalog.text[]).
// - No user table is referenced; no rows of user tables are read.

export const QUERIES = {
  begin: "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
  setSearchPath: "SET LOCAL search_path = pg_catalog, pg_temp",
  sessionInfo: `SELECT pg_catalog.current_setting('transaction_read_only') AS read_only,
       pg_catalog.current_setting('transaction_isolation') AS isolation,
       pg_catalog.current_setting('server_version_num') AS version_num,
       pg_catalog.current_setting('server_version') AS version,
       pg_catalog.current_setting('statement_timeout') AS statement_timeout,
       (SELECT r.rolsuper FROM pg_catalog.pg_roles r WHERE r.rolname OPERATOR(pg_catalog.=) CURRENT_USER) AS is_superuser`,
  schemas: `SELECT n.nspname::pg_catalog.text AS schema_name
FROM pg_catalog.pg_namespace n
WHERE n.nspname::pg_catalog.text OPERATOR(pg_catalog.=) ANY ($1::pg_catalog.text[])`,
  relations: `SELECT n.nspname::pg_catalog.text AS schema_name,
       c.relname::pg_catalog.text AS rel_name,
       c.relkind::pg_catalog.text AS relkind,
       c.relispartition AS is_partition,
       EXISTS (SELECT 1 FROM pg_catalog.pg_inherits i
               JOIN pg_catalog.pg_class ch ON ch.oid OPERATOR(pg_catalog.=) i.inhrelid
               WHERE i.inhparent OPERATOR(pg_catalog.=) c.oid AND NOT ch.relispartition) AS has_inheritance_children,
       ARRAY(SELECT pn.nspname::pg_catalog.text FROM pg_catalog.pg_inherits i
             JOIN pg_catalog.pg_class pc ON pc.oid OPERATOR(pg_catalog.=) i.inhparent
             JOIN pg_catalog.pg_namespace pn ON pn.oid OPERATOR(pg_catalog.=) pc.relnamespace
             WHERE i.inhrelid OPERATOR(pg_catalog.=) c.oid AND NOT c.relispartition ORDER BY i.inhseqno) AS parent_schemas,
       ARRAY(SELECT pc.relname::pg_catalog.text FROM pg_catalog.pg_inherits i
             JOIN pg_catalog.pg_class pc ON pc.oid OPERATOR(pg_catalog.=) i.inhparent
             WHERE i.inhrelid OPERATOR(pg_catalog.=) c.oid AND NOT c.relispartition ORDER BY i.inhseqno) AS parent_tables
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid OPERATOR(pg_catalog.=) c.relnamespace
WHERE n.nspname::pg_catalog.text OPERATOR(pg_catalog.=) ANY ($1::pg_catalog.text[])
  AND c.relkind::pg_catalog.text OPERATOR(pg_catalog.=) ANY (ARRAY['r','p','v','m','f']::pg_catalog.text[])`,
  columns: `SELECT n.nspname::pg_catalog.text AS schema_name,
       c.relname::pg_catalog.text AS rel_name,
       a.attname::pg_catalog.text AS column_name,
       a.attnum::pg_catalog.int4 AS attnum,
       a.attnotnull AS not_null,
       false AS not_null_unvalidated,
       (ty.typtype::pg_catalog.text OPERATOR(pg_catalog.=) 'd') AS is_domain
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_type ty ON ty.oid OPERATOR(pg_catalog.=) a.atttypid
JOIN pg_catalog.pg_class c ON c.oid OPERATOR(pg_catalog.=) a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid OPERATOR(pg_catalog.=) c.relnamespace
WHERE n.nspname::pg_catalog.text OPERATOR(pg_catalog.=) ANY ($1::pg_catalog.text[])
  AND c.relkind::pg_catalog.text OPERATOR(pg_catalog.=) ANY (ARRAY['r','p']::pg_catalog.text[])
  AND a.attnum OPERATOR(pg_catalog.>) 0 AND NOT a.attisdropped`,
  // PostgreSQL 18 can store NOT NULL constraints as NOT VALID (existing rows unchecked).
  columnsV18: `SELECT n.nspname::pg_catalog.text AS schema_name,
       c.relname::pg_catalog.text AS rel_name,
       a.attname::pg_catalog.text AS column_name,
       a.attnum::pg_catalog.int4 AS attnum,
       a.attnotnull AS not_null,
       EXISTS (SELECT 1 FROM pg_catalog.pg_constraint con
               WHERE con.conrelid OPERATOR(pg_catalog.=) a.attrelid
                 AND con.contype::pg_catalog.text OPERATOR(pg_catalog.=) 'n'
                 AND con.conkey[1] OPERATOR(pg_catalog.=) a.attnum
                 AND NOT con.convalidated) AS not_null_unvalidated,
       (ty.typtype::pg_catalog.text OPERATOR(pg_catalog.=) 'd') AS is_domain
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_type ty ON ty.oid OPERATOR(pg_catalog.=) a.atttypid
JOIN pg_catalog.pg_class c ON c.oid OPERATOR(pg_catalog.=) a.attrelid
JOIN pg_catalog.pg_namespace n ON n.oid OPERATOR(pg_catalog.=) c.relnamespace
WHERE n.nspname::pg_catalog.text OPERATOR(pg_catalog.=) ANY ($1::pg_catalog.text[])
  AND c.relkind::pg_catalog.text OPERATOR(pg_catalog.=) ANY (ARRAY['r','p']::pg_catalog.text[])
  AND a.attnum OPERATOR(pg_catalog.>) 0 AND NOT a.attisdropped`,
  constraints: constraintsQuery("true AS conenforced, false AS conperiod"),
  constraintsV18: constraintsQuery("con.conenforced AS conenforced, con.conperiod AS conperiod"),
  indexes: indexesQuery("false AS nulls_not_distinct"),
  indexesV15: indexesQuery("i.indnullsnotdistinct AS nulls_not_distinct"),
  rollback: "ROLLBACK",
} as const;

export type QueryId = keyof typeof QUERIES;

function constraintsQuery(versionColumns: string): string {
  return `SELECT n.nspname::pg_catalog.text AS schema_name,
       c.relname::pg_catalog.text AS rel_name,
       con.conname::pg_catalog.text AS con_name,
       con.contype::pg_catalog.text AS contype,
       con.condeferrable, con.condeferred, con.convalidated, ${versionColumns},
       con.conindid::pg_catalog.int8::pg_catalog.text AS index_oid,
       ARRAY(SELECT COALESCE(a.attname::pg_catalog.text, '')
             FROM pg_catalog.unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
             LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid OPERATOR(pg_catalog.=) con.conrelid AND a.attnum OPERATOR(pg_catalog.=) k.attnum
             ORDER BY k.ord) AS columns,
       rn.nspname::pg_catalog.text AS ref_schema,
       rc.relname::pg_catalog.text AS ref_table,
       ARRAY(SELECT COALESCE(a.attname::pg_catalog.text, '')
             FROM pg_catalog.unnest(con.confkey) WITH ORDINALITY AS k(attnum, ord)
             LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid OPERATOR(pg_catalog.=) con.confrelid AND a.attnum OPERATOR(pg_catalog.=) k.attnum
             ORDER BY k.ord) AS ref_columns
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class c ON c.oid OPERATOR(pg_catalog.=) con.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid OPERATOR(pg_catalog.=) c.relnamespace
LEFT JOIN pg_catalog.pg_class rc ON rc.oid OPERATOR(pg_catalog.=) con.confrelid
LEFT JOIN pg_catalog.pg_namespace rn ON rn.oid OPERATOR(pg_catalog.=) rc.relnamespace
WHERE n.nspname::pg_catalog.text OPERATOR(pg_catalog.=) ANY ($1::pg_catalog.text[])
  AND con.contype::pg_catalog.text OPERATOR(pg_catalog.=) ANY (ARRAY['p','u','f','x']::pg_catalog.text[])
  AND (con.conparentid OPERATOR(pg_catalog.=) 0
       OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint pcon
                      WHERE pcon.oid OPERATOR(pg_catalog.=) con.conparentid
                        AND pcon.conrelid OPERATOR(pg_catalog.=) con.conrelid))`;
}

function indexesQuery(nullsColumn: string): string {
  return `SELECT n.nspname::pg_catalog.text AS schema_name,
       c.relname::pg_catalog.text AS rel_name,
       ic.relname::pg_catalog.text AS index_name,
       i.indexrelid::pg_catalog.int8::pg_catalog.text AS index_oid,
       i.indisprimary, i.indisvalid, i.indisready, i.indislive, i.indimmediate,
       i.indnkeyatts::pg_catalog.int4 AS indnkeyatts,
       (i.indexprs IS NOT NULL) AS has_expressions,
       (i.indpred IS NOT NULL) AS is_partial,
       ${nullsColumn},
       ARRAY(SELECT COALESCE(a.attname::pg_catalog.text, '')
             FROM pg_catalog.unnest(i.indkey::pg_catalog.int2[]) WITH ORDINALITY AS k(attnum, ord)
             LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid OPERATOR(pg_catalog.=) i.indrelid AND a.attnum OPERATOR(pg_catalog.=) k.attnum
             ORDER BY k.ord) AS columns
FROM pg_catalog.pg_index i
JOIN pg_catalog.pg_class c ON c.oid OPERATOR(pg_catalog.=) i.indrelid
JOIN pg_catalog.pg_namespace n ON n.oid OPERATOR(pg_catalog.=) c.relnamespace
JOIN pg_catalog.pg_class ic ON ic.oid OPERATOR(pg_catalog.=) i.indexrelid
WHERE n.nspname::pg_catalog.text OPERATOR(pg_catalog.=) ANY ($1::pg_catalog.text[])
  AND i.indisunique
  AND c.relkind::pg_catalog.text OPERATOR(pg_catalog.=) ANY (ARRAY['r','p']::pg_catalog.text[])`;
}

export const ALLOWED_SQL: ReadonlySet<string> = new Set(Object.values(QUERIES));
