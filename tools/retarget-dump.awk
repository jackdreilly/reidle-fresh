# Retargets a data-only `public` dump into schema `legacy`, dropping page_views and setvals.
/^COPY public\.page_views /     { skip = 1; next }
skip && /^\\\.$/                { skip = 0; next }
skip                            { next }
/^SELECT pg_catalog\.setval/    { next }
/^COPY public\./                { sub(/^COPY public\./, "COPY legacy.") }
                                { print }
