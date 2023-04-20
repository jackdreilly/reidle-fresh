{% test gt(model, column_name, value) %}
SELECT
  *
FROM
  {{ model }}
WHERE
  {{ column_name }} <= {{ value }}
{% endtest %}
{% test ge(model, column_name, value) %}
SELECT
  *
FROM
  {{ model }}
WHERE
  {{ column_name }} < {{ value }}
{% endtest %}

{% test array_not_empty(model, column_name) %}
SELECT
  *
FROM
  {{ model }}
WHERE
  JSON_ARRAY_LENGTH({{ column_name }}) = 0
{% endtest %}

{% test not_empty(model) %}
SELECT COUNT(*) FROM {{ model }} HAVING COUNT(*) = 0
{% endtest %}
{% test single_row(model) %}
SELECT COUNT(*) FROM {{ model }} HAVING COUNT(*) != 1
{% endtest %}

{% test positive(model, column_name) %}
    {{ test_gt(model, column_name, 0) }}
{% endtest %}
{% test non_negative(model, column_name) %}
{{test_ge(model, column_name, 0)}}
{% endtest %}