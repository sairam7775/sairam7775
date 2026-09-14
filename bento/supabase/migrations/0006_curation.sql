-- Bento · 0006 · curation roles and open-data provenance
--
-- P2 adds the people who write the guide database, and the columns the
-- open-data importer fills in.

-- ---------------------------------------------------------------- admins
--
-- Curation writes never happen from the browser. The admin UI checks
-- membership here, then performs the write server-side through the service
-- role — which keeps `places` ungranted to `authenticated` and leaves the
-- verification gate intact.
create table app_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

alter table app_admins enable row level security;

-- An admin may confirm they are one. Nobody can read the full roster, and
-- nobody can write it over the API — membership is granted out of band.
create policy "see own admin row" on app_admins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------------- open-data provenance
--
-- The skeleton (name, coordinates, category, station) comes from Wikidata,
-- OpenStreetMap and Wikivoyage — free and openly licensed. Judgement fields
-- are never imported; they are drafted and then verified by a human.
alter table cities add column wikidata_id text;
alter table places add column wikidata_id text;
alter table places add column osm_id      text;

create unique index cities_wikidata_idx on cities (wikidata_id) where wikidata_id is not null;
create unique index places_wikidata_idx on places (wikidata_id) where wikidata_id is not null;

-- Wikivoyage is CC BY-SA, and ODPT and GTFS feeds carry their own terms.
-- Attribution obligations are easy to miss once data is in a database, so
-- every record records where it came from.
comment on column places.sources is
  'Provenance per record. Required for licence compliance: Wikivoyage is '
  'CC BY-SA and needs attribution, and open transit feeds carry their own '
  'terms. Populated by the importer, extended at verification.';

-- ------------------------------------------------- curation progress
--
-- What the admin UI opens on, and the honest answer to "how far along is
-- this". A city cannot be claimed as deep coverage on ten records.
create or replace view curation_progress
with (security_invoker = false) as
select
  c.id            as city_id,
  c.name,
  c.name_ja,
  c.coverage_tier,
  p.prefecture,
  p.region,
  count(pl.id)                                                as total_places,
  count(pl.id) filter (where pl.verification_status = 'verified') as verified_places,
  count(pl.id) filter (where pl.verification_status = 'draft')    as draft_places,
  max(pl.last_verified)                                       as last_verified
from cities c
join (
  select pf.id, pf.name as prefecture, r.name as region
  from prefectures pf join regions r on r.id = pf.region_id
) p on p.id = c.prefecture_id
left join places pl on pl.city_id = c.id
group by c.id, c.name, c.name_ja, c.coverage_tier, p.prefecture, p.region;

comment on view curation_progress is
  'Curation dashboard source. SECURITY DEFINER so it can count rows in '
  'places, which users hold no grant on; it exposes counts only, never '
  'judgement fields.';

revoke all on curation_progress from anon, authenticated;
