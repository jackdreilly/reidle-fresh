// DO NOT EDIT. This file is generated by fresh.
// This file SHOULD be checked into source version control.
// This file is automatically updated during development when running `dev.ts`.

import config from "./deno.json" assert { type: "json" };
import * as $0 from "./routes/_middleware.tsx";
import * as $1 from "./routes/api/played.ts";
import * as $2 from "./routes/api/submit.tsx";
import * as $3 from "./routes/index.tsx";
import * as $4 from "./routes/messages.tsx";
import * as $5 from "./routes/messages/[message_id]/delete.tsx";
import * as $6 from "./routes/play.tsx";
import * as $7 from "./routes/players/[name].tsx";
import * as $8 from "./routes/practice.tsx";
import * as $9 from "./routes/set-name.tsx";
import * as $10 from "./routes/stats/daily/[date].tsx";
import * as $11 from "./routes/stats/past_winners.tsx";
import * as $12 from "./routes/stats/this_week.tsx";
import * as $13 from "./routes/stats/today.tsx";
import * as $14 from "./routes/stats/weekly/[startDay].tsx";
import * as $15 from "./routes/submissions/[id]/playback.tsx";
import * as $16 from "./routes/test.tsx";
import * as $$0 from "./islands/drawer.tsx";
import * as $$1 from "./islands/game.tsx";
import * as $$2 from "./islands/playback.tsx";

const manifest = {
  routes: {
    "./routes/_middleware.tsx": $0,
    "./routes/api/played.ts": $1,
    "./routes/api/submit.tsx": $2,
    "./routes/index.tsx": $3,
    "./routes/messages.tsx": $4,
    "./routes/messages/[message_id]/delete.tsx": $5,
    "./routes/play.tsx": $6,
    "./routes/players/[name].tsx": $7,
    "./routes/practice.tsx": $8,
    "./routes/set-name.tsx": $9,
    "./routes/stats/daily/[date].tsx": $10,
    "./routes/stats/past_winners.tsx": $11,
    "./routes/stats/this_week.tsx": $12,
    "./routes/stats/today.tsx": $13,
    "./routes/stats/weekly/[startDay].tsx": $14,
    "./routes/submissions/[id]/playback.tsx": $15,
    "./routes/test.tsx": $16,
  },
  islands: {
    "./islands/drawer.tsx": $$0,
    "./islands/game.tsx": $$1,
    "./islands/playback.tsx": $$2,
  },
  baseUrl: import.meta.url,
  config,
};

export default manifest;
