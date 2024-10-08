// DO NOT EDIT. This file is generated by Fresh.
// This file SHOULD be checked into source version control.
// This file is automatically updated during development when running `dev.ts`.

import * as $_app from "./routes/_app.tsx";
import * as $_middleware from "./routes/_middleware.tsx";
import * as $account from "./routes/account.tsx";
import * as $api_checkpoint from "./routes/api/checkpoint.ts";
import * as $api_inngest from "./routes/api/inngest.ts";
import * as $api_rankings from "./routes/api/rankings.ts";
import * as $api_submit from "./routes/api/submit.ts";
import * as $api_unread_messages from "./routes/api/unread_messages.ts";
import * as $battles from "./routes/battles.tsx";
import * as $battles_battle_id_ from "./routes/battles/[battle_id].tsx";
import * as $battles_battle_id_restart from "./routes/battles/[battle_id]/restart.tsx";
import * as $battles_new from "./routes/battles/new.tsx";
import * as $battles_party_room from "./routes/battles/party_room.tsx";
import * as $challenges_challenge_challenge_id_index from "./routes/challenges/challenge/[challenge_id]/index.tsx";
import * as $challenges_challenge_challenge_id_play from "./routes/challenges/challenge/[challenge_id]/play.tsx";
import * as $challenges_index from "./routes/challenges/index.tsx";
import * as $challenges_play from "./routes/challenges/play.tsx";
import * as $index from "./routes/index.tsx";
import * as $messages from "./routes/messages.tsx";
import * as $messages_message_id_delete from "./routes/messages/[message_id]/delete.tsx";
import * as $messages_message_id_like from "./routes/messages/[message_id]/like.tsx";
import * as $play from "./routes/play.tsx";
import * as $players_name_ from "./routes/players/[name].tsx";
import * as $practice from "./routes/practice.tsx";
import * as $rankings from "./routes/rankings.tsx";
import * as $sign_in from "./routes/sign-in.tsx";
import * as $sign_out from "./routes/sign-out.tsx";
import * as $stats from "./routes/stats.tsx";
import * as $stats_daily_date_ from "./routes/stats/daily/[date].tsx";
import * as $stats_past_winners from "./routes/stats/past_winners.tsx";
import * as $stats_this_week from "./routes/stats/this_week.tsx";
import * as $stats_today from "./routes/stats/today.tsx";
import * as $stats_weekly_startDay_ from "./routes/stats/weekly/[startDay].tsx";
import * as $submissions_submission_id_playback from "./routes/submissions/[submission_id]/playback.tsx";
import * as $unsubscribe from "./routes/unsubscribe.tsx";
import * as $wrapped_name_0 from "./routes/wrapped/[name]/0.tsx";
import * as $wrapped_name_1 from "./routes/wrapped/[name]/1.tsx";
import * as $wrapped_name_2 from "./routes/wrapped/[name]/2.tsx";
import * as $wrapped_name_3 from "./routes/wrapped/[name]/3.tsx";
import * as $wrapped_name_4 from "./routes/wrapped/[name]/4.tsx";
import * as $wrapped_name_5 from "./routes/wrapped/[name]/5.tsx";
import * as $wrapped_name_6 from "./routes/wrapped/[name]/6.tsx";
import * as $wrapped_index from "./routes/wrapped/index.tsx";
import * as $AllNotification from "./islands/AllNotification.tsx";
import * as $Battle from "./islands/Battle.tsx";
import * as $Message from "./islands/Message.tsx";
import * as $Rankings from "./islands/Rankings.tsx";
import * as $confetti from "./islands/confetti.tsx";
import * as $game from "./islands/game.tsx";
import * as $playback from "./islands/playback.tsx";
import type { Manifest } from "$fresh/server.ts";

const manifest = {
  routes: {
    "./routes/_app.tsx": $_app,
    "./routes/_middleware.tsx": $_middleware,
    "./routes/account.tsx": $account,
    "./routes/api/checkpoint.ts": $api_checkpoint,
    "./routes/api/inngest.ts": $api_inngest,
    "./routes/api/rankings.ts": $api_rankings,
    "./routes/api/submit.ts": $api_submit,
    "./routes/api/unread_messages.ts": $api_unread_messages,
    "./routes/battles.tsx": $battles,
    "./routes/battles/[battle_id].tsx": $battles_battle_id_,
    "./routes/battles/[battle_id]/restart.tsx": $battles_battle_id_restart,
    "./routes/battles/new.tsx": $battles_new,
    "./routes/battles/party_room.tsx": $battles_party_room,
    "./routes/challenges/challenge/[challenge_id]/index.tsx":
      $challenges_challenge_challenge_id_index,
    "./routes/challenges/challenge/[challenge_id]/play.tsx":
      $challenges_challenge_challenge_id_play,
    "./routes/challenges/index.tsx": $challenges_index,
    "./routes/challenges/play.tsx": $challenges_play,
    "./routes/index.tsx": $index,
    "./routes/messages.tsx": $messages,
    "./routes/messages/[message_id]/delete.tsx": $messages_message_id_delete,
    "./routes/messages/[message_id]/like.tsx": $messages_message_id_like,
    "./routes/play.tsx": $play,
    "./routes/players/[name].tsx": $players_name_,
    "./routes/practice.tsx": $practice,
    "./routes/rankings.tsx": $rankings,
    "./routes/sign-in.tsx": $sign_in,
    "./routes/sign-out.tsx": $sign_out,
    "./routes/stats.tsx": $stats,
    "./routes/stats/daily/[date].tsx": $stats_daily_date_,
    "./routes/stats/past_winners.tsx": $stats_past_winners,
    "./routes/stats/this_week.tsx": $stats_this_week,
    "./routes/stats/today.tsx": $stats_today,
    "./routes/stats/weekly/[startDay].tsx": $stats_weekly_startDay_,
    "./routes/submissions/[submission_id]/playback.tsx":
      $submissions_submission_id_playback,
    "./routes/unsubscribe.tsx": $unsubscribe,
    "./routes/wrapped/[name]/0.tsx": $wrapped_name_0,
    "./routes/wrapped/[name]/1.tsx": $wrapped_name_1,
    "./routes/wrapped/[name]/2.tsx": $wrapped_name_2,
    "./routes/wrapped/[name]/3.tsx": $wrapped_name_3,
    "./routes/wrapped/[name]/4.tsx": $wrapped_name_4,
    "./routes/wrapped/[name]/5.tsx": $wrapped_name_5,
    "./routes/wrapped/[name]/6.tsx": $wrapped_name_6,
    "./routes/wrapped/index.tsx": $wrapped_index,
  },
  islands: {
    "./islands/AllNotification.tsx": $AllNotification,
    "./islands/Battle.tsx": $Battle,
    "./islands/Message.tsx": $Message,
    "./islands/Rankings.tsx": $Rankings,
    "./islands/confetti.tsx": $confetti,
    "./islands/game.tsx": $game,
    "./islands/playback.tsx": $playback,
  },
  baseUrl: import.meta.url,
} satisfies Manifest;

export default manifest;
