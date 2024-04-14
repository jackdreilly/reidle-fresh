# %%
import os
from datetime import datetime
import plotly.express as px
import sqlalchemy
import streamlit as st
import pandas as pd

st.set_page_config(page_title="State of Reidle", layout="wide")

# %%

hour = datetime.now().replace(minute=0, second=0, microsecond=0)


@st.cache_resource
def postgres_connection():
    return sqlalchemy.create_engine(
        f"postgresql://postgres.kyxziusgsizkedxitbez:{os.environ['SUPABASE_PASSWORD']}@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
    )


@st.cache_data
def plays_df(hour: datetime):
    return pd.read_sql(
        "select day::TIMESTAMP as day, count(*) as count from submissions where challenge_id is null group by 1",
        postgres_connection(),
    )


@st.cache_data
def page_views_df(hour: datetime):
    return (
        pd.read_sql_table(
            "page_views",
            postgres_connection(),
        )
        .assign(url=lambda x: x.url.str.replace("https://reidle.deno.dev", ""))
        .assign(
            page=lambda df: df.url.apply(
                lambda x: next(
                    (
                        k.replace("/", "")
                        for k in (
                            "today",
                            "week",
                            "practice",
                            "challenges",
                            "playback",
                            "/messages",
                            "daily",
                            "sign-in",
                            "rankings",
                            "wrapped",
                            "battles",
                            "play",
                            "/api",
                        )
                        if k in x
                    ),
                    {"/": "home"}.get(x, "unknown"),
                )
            )
        )
    )


"""
# State of Reidle
"""
"""
## Page Views Daily
"""
st.plotly_chart(
    px.area(
        page_views_df(hour)
        .groupby(["page", pd.Grouper(key="created_at", freq="d")])
        .id.count()
        .reset_index()
        .rename(columns=dict(id="count"))[lambda df: ~df.page.isin({"api", "unknown"})],
        x="created_at",
        y="count",
        color="page",
    ),
    use_container_width=True,
)
"""
## Plays By Week
"""
st.plotly_chart(
    px.area(
        plays_df(hour)
        .groupby(pd.Grouper(key="day", freq="W"))["count"]
        .sum()
        .reset_index(),
        x="day",
        y="count",
    ),
    use_container_width=True,
)
"""
## Page Views Hourly
"""
st.plotly_chart(
    px.area(
        page_views_df(hour)
        .groupby(["page", pd.Grouper(key="created_at", freq="h")])
        .id.count()
        .reset_index()
        .rename(columns=dict(id="count"))[lambda df: ~df.page.isin({"api", "unknown"})],
        x="created_at",
        y="count",
        color="page",
    ),
    use_container_width=True,
)
"""
## Plays By Day
"""
st.plotly_chart(
    px.area(plays_df(hour), x="day", y="count"),
    use_container_width=True,
)
"""
## Reidle Addicts
"""
st.plotly_chart(
    px.area(
        page_views_df(hour)[lambda df: ~df.page.isin({"api", "unknown"})]
        .groupby(["name", pd.Grouper(key="created_at", freq="d")])
        .id.count()
        .reset_index()
        .rename(columns=dict(id="count")),
        x="created_at",
        y="count",
        color="name",
    ),
    use_container_width=True,
)
