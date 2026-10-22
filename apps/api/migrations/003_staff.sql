CREATE TABLE staff_users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX staff_users_email_key ON staff_users (lower(email));

-- Só o hash do token fica no banco; o token em si vive no cookie.
CREATE TABLE staff_sessions (
  token_hash text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES staff_users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX staff_sessions_user_id_idx ON staff_sessions (user_id);
