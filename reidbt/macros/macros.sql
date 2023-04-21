{%- macro export_var(x) -%}
{%- if var("export") -%}
${{x}}
{%- else -%}
{{var(x)}}
{%- endif -%}
{%- endmacro -%}
{%- macro me() -%}
{{export_var('name')}}
{%- endmacro -%}

{%- macro or_array(x) -%}
COALESCE({{x}}, '[]')
{%- endmacro -%}

{%- macro lit(x) -%}
'{{x}}'
{%- endmacro -%}

{% macro is_previous_week(field) %}
date_trunc('week', {{field}}) = date_trunc('week', current_date - interval '1 week')
{% endmacro %}

{% macro is_current_week(field) %}
date_trunc('week', {{field}}) = date_trunc('week', current_date)
{% endmacro %}

{%- macro reidle(table) -%}
{{source('reidle', table)}}
{%- endmacro -%}
{%- macro week() -%}
{{export_var('week')}}::DATE
{%- endmacro -%}

{% macro challenge_id() %}
{{export_var('challenge_id')}}
{% endmacro %}

{% macro to_json(fields) %}
json_build_object(
    {% for field in fields %}
    '{{field}}', {{field}}{% if not loop.last %},{% endif %}
    {% endfor %}
)
{% endmacro %}

{% macro coalesce_tables(key, tables) %}
select
    coalesce(
        {% for table in tables %}
        {{table}}.{{key}}{% if not loop.last %},
        {% endif %}
        {% endfor %}
    ) as {{key}}
from
    {{tables[0]}}
{% for table in tables[1:] %}
FULL OUTER JOIN
    {{table}}
ON
    TRUE
{% endfor %}
{% endmacro %}

