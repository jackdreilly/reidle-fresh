import sh

print("set up dbs")
print(
    sh.psql(
        _in="DROP DATABASE IF EXISTS reidle; DROP DATABASE IF EXISTS postgres; CREATE DATABASE postgres;"
    ),
)
print("dump")
sh.pg_dump(
    h="db.kyxziusgsizkedxitbez.supabase.co",
    f="dump.sql",
    x=True,
    U="postgres",
    C="postgres",
    schema="public",
)
print("load")
sh.psql(
    f="dump.sql",
    d="postgres",
)
print("hide emails")
sh.psql(
    d="postgres",
    _in="""
    update players set email = concat('jackdreilly+',email);
    update challenge_requests set email = concat('jackdreilly+',email);
    """,
)
print("clean up")
sh.rm("dump.sql")
