-- Synthetic fixture DDL for the disposable integration-test container only.
-- relationMode = "prisma": intentionally no FOREIGN KEY constraints.
CREATE TABLE public.authors (
  id   integer PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.posts (
  id        integer PRIMARY KEY,
  title     text NOT NULL,
  author_id integer NOT NULL
);
CREATE INDEX posts_author_id_idx ON public.posts (author_id);
