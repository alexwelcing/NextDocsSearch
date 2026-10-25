-- Sphere Hunter's public ledger (D1 'alexwelcing-game'). Read and written only through
-- lib/server/scores.ts; the checks repeat its validation so a bad row cannot land by any route.
create table sphere_hunter_scores (
  id integer primary key autoincrement,
  player_name text not null check (length(player_name) between 1 and 20),
  score integer not null check (score between 0 and 100000),
  combo_max integer not null default 0,
  accuracy real default 0,
  total_clicks integer default 0,
  successful_clicks integer default 0,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- The top-5 read walks this in order. Every SQLite index ends in the rowid, so the id tiebreak
-- for exact ties comes free.
create index scores_top on sphere_hunter_scores (score desc, created_at asc);
