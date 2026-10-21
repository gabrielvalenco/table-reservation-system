CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE tables (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number integer NOT NULL UNIQUE CHECK (number > 0),
  capacity integer NOT NULL CHECK (capacity > 0),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id integer NOT NULL REFERENCES tables (id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  party_size integer NOT NULL CHECK (party_size > 0),
  name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  EXCLUDE USING gist (table_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
    WHERE (status = 'confirmed')
);
