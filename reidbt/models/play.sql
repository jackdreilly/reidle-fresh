SELECT
    word.word AS "startingWord",
    word.answer AS "word",
    leader.name AS winner,
    leader.time AS "winnersTime"
FROM
    {{ ref('todays_leader') }} AS leader
FULL OUTER JOIN
    {{ ref("todays_word") }} AS word
    ON true
