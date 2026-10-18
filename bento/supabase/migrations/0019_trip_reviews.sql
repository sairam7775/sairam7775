-- Bento · 0019 · how the plan held up
--
-- After a trip ends, the traveller can say whether they could follow the
-- plan and what got in the way. One review per trip, changeable later. It
-- is the planner's report card: the answers come back to whoever curates
-- Bento (admin pages, service role), never to other travellers.
--
-- The answer keys are fixed here so a typo in the app can't invent a new
-- category that the admin page then can't count. The words for them live
-- in the app (copy.review).

create table trip_reviews (
  trip_id     uuid primary key references trips (id) on delete cascade,
  outcome     text not null check (outcome in ('as_planned', 'mostly', 'not_really')),
  challenges  text[] not null default '{}' check (
    challenges <@ array['too_much', 'travel_longer', 'place_closed', 'crowds', 'booking', 'walking', 'timing', 'other']::text[]
  ),
  -- The days that were hardest to follow. The app keeps them inside the
  -- trip's dates; a date change later doesn't rewrite what was said.
  hard_days   date[] not null default '{}' check (cardinality(hard_days) <= 60),
  note        text check (char_length(note) <= 2000),
  -- The route and every day's stops as they were when the traveller
  -- answered (lib/trips/review.ts planSnapshot). The trip can change
  -- afterwards; the answer is about the plan they followed.
  plan        jsonb check (plan is null or (jsonb_typeof(plan) = 'object' and pg_column_size(plan) <= 200000)),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trip_reviews_touch before update on trip_reviews
  for each row execute function touch_updated_at();

alter table trip_reviews enable row level security;

-- The traveller's own trips only, and only once the trip has ended: a
-- review of a plan nobody has followed yet is a guess.
create policy "own trip_reviews read" on trip_reviews
  for select to authenticated
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = (select auth.uid())));

create policy "own trip_reviews write" on trip_reviews
  for insert to authenticated
  with check (exists (
    select 1 from trips t
    where t.id = trip_id and t.user_id = (select auth.uid())
      and t.end_date is not null and t.end_date <= current_date
  ));

create policy "own trip_reviews change" on trip_reviews
  for update to authenticated
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = (select auth.uid())))
  with check (exists (
    select 1 from trips t
    where t.id = trip_id and t.user_id = (select auth.uid())
      and t.end_date is not null and t.end_date <= current_date
  ));

create policy "own trip_reviews delete" on trip_reviews
  for delete to authenticated
  using (exists (select 1 from trips t where t.id = trip_id and t.user_id = (select auth.uid())));
