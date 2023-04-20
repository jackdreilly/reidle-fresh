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