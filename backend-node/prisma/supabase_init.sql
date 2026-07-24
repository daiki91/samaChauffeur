-- ============================================================================
-- samaChauffeur — script d'initialisation de la base Supabase (Postgres)
-- Généré à partir de backend-node/prisma/schema.prisma
--
-- À exécuter UNE FOIS dans Supabase Dashboard > SQL Editor > New query > Run
-- (ou via `psql` sur DIRECT_URL). Le script est idempotent : vous pouvez le
-- relancer sans casser une base déjà initialisée.
-- ============================================================================

-- ---------- ENUMS ----------

do $$ begin
  create type "Role" as enum ('CLIENT', 'CHAUFFEUR', 'ADMIN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type "Language" as enum ('fr', 'wo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type "VehicleType" as enum ('CAR', 'SEDAN', 'SUV', 'MINIBUS', 'BUS');
exception when duplicate_object then null; end $$;

do $$ begin
  create type "TripMode" as enum ('PRIVATE', 'SHARED', 'BUS');
exception when duplicate_object then null; end $$;

do $$ begin
  create type "TripStatus" as enum ('REQUESTED', 'ASSIGNED', 'ACCEPTED', 'STARTED', 'COMPLETED', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type "SupportTicketStatus" as enum ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type "TransactionMethod" as enum ('ORANGE', 'WAVE', 'FREE', 'CASH', 'CARD');
exception when duplicate_object then null; end $$;

do $$ begin
  create type "TransactionStatus" as enum ('PENDING', 'COMPLETED', 'FAILED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type "PayoutStatus" as enum ('SCHEDULED', 'PROCESSED', 'FAILED');
exception when duplicate_object then null; end $$;

-- ---------- accounts ----------

create table if not exists "users" (
  id             serial primary key,
  username       text not null unique,
  phone          text not null unique,
  password       text not null,
  role           "Role" not null default 'CLIENT',
  language       "Language" not null default 'fr',
  phone_verified boolean not null default false,
  is_staff       boolean not null default false,
  is_active      boolean not null default true,
  date_joined    timestamp(3) not null default now()
);

create table if not exists "refresh_tokens" (
  id         serial primary key,
  jti        text not null unique,
  user_id    integer not null references "users"(id) on delete cascade,
  revoked    boolean not null default false,
  expires_at timestamp(3) not null,
  created_at timestamp(3) not null default now()
);
create index if not exists "refresh_tokens_user_id_idx" on "refresh_tokens"("user_id");

create table if not exists "otps" (
  id         serial primary key,
  phone      text not null,
  code       text not null,
  created_at timestamp(3) not null default now(),
  expires_at timestamp(3) not null,
  is_used    boolean not null default false,
  attempts   integer not null default 0
);
create index if not exists "otps_phone_idx" on "otps"("phone");

-- ---------- chauffeurs ----------

create table if not exists "vehicles" (
  id           serial primary key,
  type         "VehicleType" not null,
  seats        integer not null,
  plate_number text not null unique
);

create table if not exists "chauffeurs" (
  id           serial primary key,
  user_id      integer not null unique references "users"(id) on delete cascade,
  vehicle_id   integer references "vehicles"(id) on delete set null,
  permit       text,
  insurance    text,
  is_verified  boolean not null default false,
  is_available boolean not null default true,
  latitude     double precision,
  longitude    double precision
);
create index if not exists "chauffeurs_vehicle_id_idx" on "chauffeurs"("vehicle_id");

-- ---------- courses (trips) ----------

create table if not exists "trips" (
  id                 serial primary key,
  passenger_id       integer not null references "users"(id) on delete cascade,
  driver_id          integer references "chauffeurs"(id) on delete set null,
  origin             text not null,
  origin_lat         double precision,
  origin_lng         double precision,
  destination        text not null,
  dest_lat           double precision,
  dest_lng           double precision,
  distance_km        double precision,
  estimated_duration integer,
  mode               "TripMode" not null default 'PRIVATE',
  price              integer,
  status             "TripStatus" not null default 'REQUESTED',
  created_at         timestamp(3) not null default now(),
  started_at         timestamp(3),
  ended_at           timestamp(3)
);
create index if not exists "trips_passenger_id_idx" on "trips"("passenger_id");
create index if not exists "trips_driver_id_idx" on "trips"("driver_id");

create table if not exists "trip_passengers" (
  id            serial primary key,
  trip_id       integer not null references "trips"(id) on delete cascade,
  passenger_id  integer not null references "users"(id) on delete cascade,
  seat_number   integer
);
create index if not exists "trip_passengers_trip_id_idx" on "trip_passengers"("trip_id");
create index if not exists "trip_passengers_passenger_id_idx" on "trip_passengers"("passenger_id");

-- ---------- pricing ----------

create table if not exists "pricing_rules" (
  id            serial primary key,
  vehicle_type  "VehicleType" not null,
  mode          "TripMode" not null default 'PRIVATE',
  region        text,
  price_per_km  numeric(10,2) not null,
  active        boolean not null default true
);

-- ---------- clients ----------

create table if not exists "client_profiles" (
  id         serial primary key,
  user_id    integer not null unique references "users"(id) on delete cascade,
  photo      text,
  is_active  boolean not null default true,
  language   "Language" not null default 'fr',
  created_at timestamp(3) not null default now()
);

create table if not exists "support_tickets" (
  id          serial primary key,
  client_id   integer not null references "client_profiles"(id) on delete cascade,
  trip_id     integer references "trips"(id) on delete set null,
  title       text not null,
  description text not null,
  status      "SupportTicketStatus" not null default 'OPEN',
  created_at  timestamp(3) not null default now()
);
create index if not exists "support_tickets_client_id_idx" on "support_tickets"("client_id");
create index if not exists "support_tickets_trip_id_idx" on "support_tickets"("trip_id");

-- ---------- payments ----------

create table if not exists "transactions" (
  id         serial primary key,
  client_id  integer references "client_profiles"(id) on delete set null,
  amount     numeric(12,2) not null,
  currency   text not null default 'XOF',
  method     "TransactionMethod" not null,
  status     "TransactionStatus" not null default 'PENDING',
  reference  text,
  metadata   jsonb,
  created_at timestamp(3) not null default now()
);
create index if not exists "transactions_client_id_idx" on "transactions"("client_id");

create table if not exists "payment_methods" (
  id         serial primary key,
  client_id  integer not null references "client_profiles"(id) on delete cascade,
  provider   text not null,
  details    jsonb,
  is_default boolean not null default false,
  created_at timestamp(3) not null default now()
);
create index if not exists "payment_methods_client_id_idx" on "payment_methods"("client_id");

create table if not exists "payouts" (
  id           serial primary key,
  chauffeur_id integer not null references "chauffeurs"(id) on delete cascade,
  amount       numeric(12,2) not null,
  status       "PayoutStatus" not null default 'SCHEDULED',
  scheduled_at timestamp(3),
  processed_at timestamp(3),
  metadata     jsonb
);
create index if not exists "payouts_chauffeur_id_idx" on "payouts"("chauffeur_id");

-- ---------- gares ----------

create table if not exists "stations" (
  id        serial primary key,
  name      text not null,
  city      text not null,
  latitude  double precision,
  longitude double precision
);

create table if not exists "lines" (
  id             serial primary key,
  name           text not null,
  origin_id      integer not null references "stations"(id) on delete cascade,
  destination_id integer not null references "stations"(id) on delete cascade
);
create index if not exists "lines_origin_id_idx" on "lines"("origin_id");
create index if not exists "lines_destination_id_idx" on "lines"("destination_id");

create table if not exists "line_stops" (
  id         serial primary key,
  line_id    integer not null references "lines"(id) on delete cascade,
  station_id integer not null references "stations"(id) on delete cascade,
  "order"    integer not null,
  unique (line_id, station_id)
);

create table if not exists "schedules" (
  id             serial primary key,
  line_id        integer not null references "lines"(id) on delete cascade,
  departure_time text not null,
  arrival_time   text not null,
  days_of_week   text not null default 'Mon-Fri',
  price_base     numeric(8,2) not null default 0
);
create index if not exists "schedules_line_id_idx" on "schedules"("line_id");

-- ---------- tickets (billets de gare, distincts des support_tickets) ----------

create table if not exists "tickets" (
  id           serial primary key,
  passenger_id integer not null references "client_profiles"(id) on delete cascade,
  line_id      integer not null references "lines"(id) on delete cascade,
  seat_number  text,
  status       text not null default 'ISSUED',
  issued_at    timestamp(3) not null default now(),
  price        numeric(10,2) not null
);
create index if not exists "tickets_passenger_id_idx" on "tickets"("passenger_id");
create index if not exists "tickets_line_id_idx" on "tickets"("line_id");

-- ---------- adminpanel ----------

create table if not exists "system_settings" (
  id    serial primary key,
  key   text not null unique,
  value text not null,
  type  text not null default 'string'
);

-- ---------- audit ----------

create table if not exists "audit_logs" (
  id          serial primary key,
  actor_id    integer references "users"(id) on delete set null,
  action_type text not null,
  object_type text,
  object_id   text,
  data        jsonb,
  created_at  timestamp(3) not null default now()
);
create index if not exists "audit_logs_actor_id_idx" on "audit_logs"("actor_id");

-- ============================================================================
-- Données de départ : règles de tarification par défaut
-- (nécessaires sinon /api/pricing/estimate/ et la création de course renvoient
--  une erreur "No pricing rule found" plutôt qu'un vrai 500 — mais autant les
--  avoir dès le départ)
-- ============================================================================

insert into "pricing_rules" (vehicle_type, mode, region, price_per_km, active)
select 'CAR', 'PRIVATE', null, 300, true
where not exists (select 1 from "pricing_rules" where vehicle_type = 'CAR' and mode = 'PRIVATE' and region is null);

insert into "pricing_rules" (vehicle_type, mode, region, price_per_km, active)
select 'CAR', 'SHARED', null, 150, true
where not exists (select 1 from "pricing_rules" where vehicle_type = 'CAR' and mode = 'SHARED' and region is null);

insert into "pricing_rules" (vehicle_type, mode, region, price_per_km, active)
select 'SEDAN', 'PRIVATE', null, 400, true
where not exists (select 1 from "pricing_rules" where vehicle_type = 'SEDAN' and mode = 'PRIVATE' and region is null);

insert into "pricing_rules" (vehicle_type, mode, region, price_per_km, active)
select 'SUV', 'PRIVATE', null, 500, true
where not exists (select 1 from "pricing_rules" where vehicle_type = 'SUV' and mode = 'PRIVATE' and region is null);

insert into "pricing_rules" (vehicle_type, mode, region, price_per_km, active)
select 'MINIBUS', 'SHARED', null, 100, true
where not exists (select 1 from "pricing_rules" where vehicle_type = 'MINIBUS' and mode = 'SHARED' and region is null);

insert into "pricing_rules" (vehicle_type, mode, region, price_per_km, active)
select 'BUS', 'BUS', null, 50, true
where not exists (select 1 from "pricing_rules" where vehicle_type = 'BUS' and mode = 'BUS' and region is null);

-- ============================================================================
-- Fin — vérification rapide
-- ============================================================================
-- select table_name from information_schema.tables where table_schema = 'public' order by 1;
