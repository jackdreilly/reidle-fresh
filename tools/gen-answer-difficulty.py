#!/usr/bin/env python3
"""Writes src/data/answer-difficulty.json for the /admin "Answer words" card.

  pip install wordfreq && python3 tools/gen-answer-difficulty.py

Each answer gets its wordfreq English Zipf score (1 = extremely rare, 3 = uncommon, 5+ = everyday). HARD is a
hand ranking of the 100 words least likely to be known (Jack, 2026-10-30), RUDE flags crude or offensive words.
Covers src/data/answers.csv plus PROD_ONLY: prod's answers table is its own data and has a few words the csv doesn't.
"""
import json, pathlib, wordfreq

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROD_ONLY = "asses barfs boner cunts dicks fucks poops pukes pussy shits sluts titty".split()
RUDE = set(PROD_ONLY) | set("bitch mammy gipsy gypsy semen sperm horny booby hymen pubic fecal urine enema".split())
HARD = """outgo|A noun for "expenditure"; almost nobody says it
caput|Latin anatomy term; people know "kaput", not this
axion|Hypothetical physics particle
parer|Rare agent noun; people say "peeler"
octal|Base-8 numbers; programmer jargon
sooth|Archaic "truth"; only survives in "soothsayer"
trice|Only lives in the idiom "in a trice"
ovate|Botany: egg-shaped
conic|Geometry ("conic section")
wrack|Seaweed, or "wrack and ruin"
synod|Church council
demur|Formal/legal verb
elate|Everyone knows "elated", not the verb
aider|Only in legal "aider and abettor"
snaky|Rare adjective
copse|British: a small wood
humus|Soil; confused with hummus
liege|Feudal ("my liege")
duchy|Feudal territory
datum|Singular of data; nobody says it
modal|Logic/music/UI jargon
zonal|Technical adjective
ester|Organic chemistry
savoy|Cabbage; reads as a proper name
tonga|Reads as the country
crump|British slang for a shell burst
smelt|A fish, or British past tense
islet|Small island
frond|Fern leaf
serif|Typography jargon
lathe|Machine-shop tool
triad|Music/chemistry jargon
theta|Greek letter
kappa|Greek letter
ombre|Hair-dye trend word
satyr|Greek mythology
harpy|Greek mythology
antic|People know "antics", rarely the singular
gazer|Only in "stargazer"
bilge|Nautical
tuber|Botany
lipid|Biochemistry
diode|Electronics
anode|Electronics/chemistry
ionic|Chemistry or column style
lymph|Medical
helix|Geometry/biology
mealy|Uncommon texture word
filmy|Rare adjective
warty|Rare adjective
wrest|Formal verb; confused with rest
smite|Biblical
cleft|Mostly "cleft palate/chin"
amity|Formal; people say friendship
quell|Formal/literary
forgo|Formal; clashes with "forego"
wreak|Only "wreak havoc"
daunt|People know "daunting"
abate|Formal/legal
endow|Formal; mostly "endowment"
rebut|Mostly "rebuttal"
lithe|Literary
vapid|Literary/SAT word
loath|Confused with "loathe"
wench|Archaic
stead|Only "instead"/"in good stead"
haute|French ("haute couture")
remit|British/business jargon
edict|Formal/historical
piety|Religious/formal
palsy|Medical, dated
epoch|Formal/scientific
inert|Science term
carat|Confused with carrot/caret/karat
rupee|Indian currency
ethos|Formal/academic
quasi|Usually a prefix
natal|Mostly "prenatal"
penal|Mostly "penal code"
plumb|Mostly "plumb line"
deuce|Tennis/cards; dated slang
chard|Leafy vegetable
crimp|Uncommon verb
inlay|Woodworking/dental term
clack|Uncommon sound word
plunk|Uncommon sound/verb
slosh|Uncommon verb
chafe|Rare in daily speech
knead|Baking verb; silent K
affix|Formal
sieve|Tricky spelling (IE)
nymph|Mythology/biology
cacao|Confused with cocoa
eying|Most people write "eyeing"
leant|British; Americans say "leaned"
unset|Technical; feels made up
aglow|Literary
afire|Literary
bylaw|Often written "by-law"
rebar|Construction jargon"""

words = sorted({l.strip().lower() for l in (ROOT / "src/data/answers.csv").read_text().split() if l.strip()} | set(PROD_ONLY))
hard = [l.split("|") for l in HARD.splitlines()]
assert len(hard) == 100 and len({w for w, _ in hard}) == 100
rank = {w: (i + 1, why) for i, (w, why) in enumerate(hard)}
out = {}
for w in words:
    e = {"z": round(wordfreq.zipf_frequency(w, "en"), 2)}
    if w in rank: e["rank"], e["why"] = rank[w]
    if w in RUDE: e["rude"] = 1
    out[w] = e
(ROOT / "src/data/answer-difficulty.json").write_text(json.dumps(out, separators=(",", ":")) + "\n")
print(len(out), "words")
