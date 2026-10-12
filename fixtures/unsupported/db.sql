-- Synthetic fixture DDL for the disposable integration-test container only.
CREATE TABLE public.customers (
  id         integer PRIMARY KEY,
  email      text NOT NULL,
  deleted_at timestamp(3)
);
CREATE UNIQUE INDEX customers_email_key ON public.customers (email) WHERE deleted_at IS NULL;

CREATE TABLE public.tags (
  id    integer PRIMARY KEY,
  label text NOT NULL
);

CREATE TABLE public."_CustomerToTag" (
  "A" integer NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  "B" integer NOT NULL REFERENCES public.tags (id) ON DELETE CASCADE,
  CONSTRAINT "_CustomerToTag_AB_pkey" PRIMARY KEY ("A", "B")
);
CREATE INDEX "_CustomerToTag_B_index" ON public."_CustomerToTag" ("B");

CREATE VIEW public.active_customers AS
  SELECT id, email FROM public.customers WHERE deleted_at IS NULL;
