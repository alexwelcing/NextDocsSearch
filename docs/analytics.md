# Analytics & Retention Reporting

## Event Definitions

| Event | Trigger | Core Properties | Notes |
| --- | --- | --- | --- |
| `session_start` | App boot in `pages/_app.tsx` | `path`, `referrer` | One per session. |
| `chapter_unlock` | Quest completion in `components/JourneyContext.tsx` | `questId`, `phase`, `unlocks` | Used for journey progression reporting. |
| `ai_chat` | Chat submit in `components/TerminalInterface.tsx` | `messageLength` | Fires when the user sends a prompt. |
| `game_play` | Game start in `components/ThreeSixty.tsx` | `source` | Captures entry points like terminal or replay. |
| `game_finish` | Game end in `components/ThreeSixty.tsx` | `score`, `comboMax`, `accuracy`, `totalClicks`, `successfulClicks` | Use for leaderboard performance analytics. |
| `share` | Feedback share in `components/FeedbackPanel.tsx` | `method`, `location` | `method` is `copy_link` or `copy_failed`. |
| `feedback_submit` | Feedback widget submit in `components/FeedbackPanel.tsx` | `messageLength`, `source` | Currently sourced from terminal. |
| `performance_metrics` | R3F `useFrame` + `window.performance` | `fpsAverage`, `loadTimeMs`, `assetError` | Multiple payload shapes; see below. |

### Performance Metrics Payloads

`performance_metrics` is emitted in a few forms:

- **FPS average** (every ~20s while the canvas runs)
  - `fpsAverage`, `samples`, `windowMs`
- **Load timing** (on mount)
  - `loadTimeMs`, `domContentLoadedMs`, `firstByteMs`
- **Asset errors** (on resource error)
  - `assetError.tagName`, `assetError.url`

## Weekly Retention Dashboard

> Goal: understand 7-day and 28-day retention for the immersive experience.

### Option A: Supabase (SQL)

**Data requirements**
- Store events in a table like `analytics_events` with: `user_id`, `event_name`, `created_at`.

**Weekly retention query**
```sql
with cohort as (
  select
    user_id,
    date_trunc('week', min(created_at)) as cohort_week
  from analytics_events
  where event_name = 'session_start'
  group by user_id
),
activity as (
  select
    user_id,
    date_trunc('week', created_at) as activity_week
  from analytics_events
  where event_name = 'session_start'
)
select
  cohort_week,
  activity_week,
  count(distinct activity.user_id) as retained_users
from cohort
join activity using (user_id)
where activity_week >= cohort_week
group by cohort_week, activity_week
order by cohort_week, activity_week;
```

### Option B: PostHog

**Suggested insights**
- **Retention** report with `session_start` as the retention event.
- Break down by `chapter_unlock` to see progression impact.
- Use `ai_chat` and `game_finish` as secondary engagement filters.

## Validation Checklist

- Verify `session_start` fires on first load and route change tracking is unaffected.
- Confirm FPS averages are emitted in dev logs (development only).
- Ensure `feedback_submit` and `share` are present in analytics dashboards.
