select
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'challenge_id', last_two_days_challenges.challenge_id,
            'players', challenge_players.players,
            'winner', JSON_BUILD_OBJECT(
                'name', challenge_winners.winner,
                'time', challenge_winners.winner_time
            ),
            'answer', last_two_days_challenges.answer,
            'time', my_history.time
        )
        order by
            last_two_days_challenges.challenge_id desc
    ) as history
from
    {{ ref("my_history") }} as my_history
natural inner join
    {{ ref("challenge_winners") }} as challenge_winners
natural inner join
    {{ ref("challenge_players") }} as challenge_players
natural inner join
    {{ ref("last_two_days_challenges") }} as last_two_days_challenges
