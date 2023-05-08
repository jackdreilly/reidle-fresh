// DO NOT EDIT. This file is generated by fresh.
// This file SHOULD be checked into source version control.
// This file is automatically updated during development when running `dev.ts`.

import config from "./deno.json" assert { type: "json" };
import * as $0 from "./routes/_middleware.tsx";
import * as $1 from "./routes/account.tsx";
import * as $2 from "./routes/api/inngest.ts";
import * as $3 from "./routes/api/submit.ts";
import * as $4 from "./routes/api/unread_messages.ts";
import * as $5 from "./routes/battles.tsx";
import * as $6 from "./routes/battles/[battle_id].tsx";
import * as $7 from "./routes/battles/[battle_id]/restart.tsx";
import * as $8 from "./routes/challenges/challenge/[challenge_id]/index.tsx";
import * as $9 from "./routes/challenges/challenge/[challenge_id]/play.tsx";
import * as $10 from "./routes/challenges/index.tsx";
import * as $11 from "./routes/challenges/play.tsx";
import * as $12 from "./routes/index.tsx";
import * as $13 from "./routes/messages.tsx";
import * as $14 from "./routes/messages/[message_id]/delete.tsx";
import * as $15 from "./routes/play.tsx";
import * as $16 from "./routes/players/[name].tsx";
import * as $17 from "./routes/practice.tsx";
import * as $18 from "./routes/sign-in.tsx";
import * as $19 from "./routes/sign-out.tsx";
import * as $20 from "./routes/stats.tsx";
import * as $21 from "./routes/stats/daily/[date].tsx";
import * as $22 from "./routes/stats/past_winners.tsx";
import * as $23 from "./routes/stats/this_week.tsx";
import * as $24 from "./routes/stats/today.tsx";
import * as $25 from "./routes/stats/weekly/[startDay].tsx";
import * as $26 from "./routes/submissions/[submission_id]/playback.tsx";
import * as $27 from "./routes/unsubscribe.tsx";
import * as $$0 from "./islands/AllNotification.tsx";
import * as $$1 from "./islands/Battle.tsx";
import * as $$2 from "./islands/confetti.tsx";
import * as $$3 from "./islands/game.tsx";
import * as $$4 from "./islands/playback.tsx";

const manifest = {
  routes: {
    "./routes/_middleware.tsx": $0,
    "./routes/account.tsx": $1,
    "./routes/api/inngest.ts": $2,
    "./routes/api/submit.ts": $3,
    "./routes/api/unread_messages.ts": $4,
    "./routes/battles.tsx": $5,
    "./routes/battles/[battle_id].tsx": $6,
    "./routes/battles/[battle_id]/restart.tsx": $7,
    "./routes/challenges/challenge/[challenge_id]/index.tsx": $8,
    "./routes/challenges/challenge/[challenge_id]/play.tsx": $9,
    "./routes/challenges/index.tsx": $10,
    "./routes/challenges/play.tsx": $11,
    "./routes/index.tsx": $12,
    "./routes/messages.tsx": $13,
    "./routes/messages/[message_id]/delete.tsx": $14,
    "./routes/play.tsx": $15,
    "./routes/players/[name].tsx": $16,
    "./routes/practice.tsx": $17,
    "./routes/sign-in.tsx": $18,
    "./routes/sign-out.tsx": $19,
    "./routes/stats.tsx": $20,
    "./routes/stats/daily/[date].tsx": $21,
    "./routes/stats/past_winners.tsx": $22,
    "./routes/stats/this_week.tsx": $23,
    "./routes/stats/today.tsx": $24,
    "./routes/stats/weekly/[startDay].tsx": $25,
    "./routes/submissions/[submission_id]/playback.tsx": $26,
    "./routes/unsubscribe.tsx": $27,
  },
  islands: {
    "./islands/AllNotification.tsx": $$0,
    "./islands/Battle.tsx": $$1,
    "./islands/confetti.tsx": $$2,
    "./islands/game.tsx": $$3,
    "./islands/playback.tsx": $$4,
  },
  baseUrl: import.meta.url,
  config,
};

export default manifest;
