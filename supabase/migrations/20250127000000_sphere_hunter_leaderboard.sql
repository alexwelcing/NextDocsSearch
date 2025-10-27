-- Create the Sphere Hunter game leaderboard table
create table "public"."sphere_hunter_scores" (
  id bigserial primary key,
  player_name text not null,
  score int not null,
  combo_max int default 0,
  accuracy float default 0,
  total_clicks int default 0,
  successful_clicks int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  session_id uuid default gen_random_uuid()
);

-- Create index for efficient leaderboard queries (top scores, most recent first)
create index idx_scores_leaderboard on sphere_hunter_scores(score desc, created_at asc);

-- Create index for session lookups
create index idx_session_id on sphere_hunter_scores(session_id);

-- Add comment to table
comment on table sphere_hunter_scores is 'Leaderboard for the Sphere Hunter 360 game';

-- Add RLS (Row Level Security) policies - allow all operations for now
-- In production, you may want to restrict this based on user authentication
alter table sphere_hunter_scores enable row level security;

-- Policy to allow anyone to read scores (for leaderboard display)
create policy "Allow public read access"
  on sphere_hunter_scores
  for select
  using (true);

-- Policy to allow anyone to insert scores (for score submission)
create policy "Allow public insert access"
  on sphere_hunter_scores
  for insert
  with check (true);
