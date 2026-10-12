-- Synthetic fixture DDL for the disposable integration-test container only.
CREATE SCHEMA core;
CREATE SCHEMA reporting;

CREATE TYPE core.event_kind AS ENUM ('CREATED', 'UPDATED');

CREATE TABLE core.accounts (
  account_id    integer PRIMARY KEY,
  email_address text NOT NULL,
  manager_id    integer,
  CONSTRAINT accounts_email_address_key UNIQUE (email_address),
  CONSTRAINT accounts_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES core.accounts (account_id)
);

CREATE TABLE core.events (
  id         integer PRIMARY KEY,
  account_id integer NOT NULL REFERENCES core.accounts (account_id),
  kind       core.event_kind NOT NULL
);

-- Same table name, different schema.
CREATE TABLE reporting.events (
  event_id    integer PRIMARY KEY,
  owner_id    integer NOT NULL,
  reviewer_id integer,
  payload     jsonb,
  CONSTRAINT events_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES core.accounts (account_id),
  CONSTRAINT events_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES core.accounts (account_id)
);
