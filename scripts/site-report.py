#!/usr/bin/env python3
"""json.fit website analytics report (first-party events, surface=web).

Monthly review: python3 -I scripts/site-report.py --days 30 --pull
Needs Ryan's aws CLI creds (ryan-admin). Event data is kept outside the repo.

Usage:  python3 report.py [--days 30] [--pull]
  --pull   sync the last N days from S3 first (needs Ryan's aws CLI creds)
Reads events/dt=YYYY-MM-DD/*.jsonl from ~/Desktop/Claude/scratch/site-analytics (outside the repo), keeps surface=web,
drops internal / headless / heavy / bot-looking traffic, prints the funnel
for this period and the one before it.
"""
import json, glob, os, re, sys, subprocess, collections, statistics, datetime as dt
HERE = os.path.expanduser('~/Desktop/Claude/scratch/site-analytics')
BUCKET = 's3://jsonfit-analytics-405045611723/events/'
args = sys.argv[1:]
DAYS = int(args[args.index('--days')+1]) if '--days' in args else 30
today = dt.date.today()
days = [today - dt.timedelta(d) for d in range(DAYS*2 + 1)]
if '--pull' in args:
    for d in days:
        subprocess.run(['aws','s3','sync',f'{BUCKET}dt={d}/',f'{HERE}/events/dt={d}','--quiet'],check=False)

BOT_UA = re.compile(r'bot|crawl|spider|headless|lighthouse|pingdom|facebookexternalhit|preview|curl|python|go-http', re.I)
ev = []
for d in days:
    for f in glob.glob(f'{HERE}/events/dt={d}/*.jsonl'):
        for line in open(f):
            try: e = json.loads(line)
            except Exception: continue
            c = e.get('context') or {}
            if c.get('surface') != 'web' or c.get('is_internal'): continue
            ev.append(e)

# Exact duplicates first: a browser that could not read the collector's response
# re-sent the same batch every ten seconds (double CORS header, fixed 14 Oct 2026),
# so one event could be stored hundreds of times. Later events carry event_id.
seen_ev = set(); dedup = []
for e in ev:
    k = e.get('event_id') or (e.get('anon_id'), e.get('session_id'), e.get('event'), e.get('timestamp'), json.dumps(e.get('properties'), sort_keys=True))
    if k in seen_ev: continue
    seen_ev.add(k); dedup.append(e)
DUPES = len(ev) - len(dedup); ev = dedup

# Per-user facts for filtering.
views = collections.Counter(e['anon_id'] for e in ev if e['event']=='page_viewed')
ua, tz = {}, {}
for e in ev:
    if e['event']=='session_started':
        ua[e['anon_id']] = e['properties'].get('user_agent') or ''
        tz[e['anon_id']] = e['properties'].get('timezone')
def excluded(a):
    if BOT_UA.search(ua.get(a,'')): return 'bot'
    if views[a] >= 40*max(1,DAYS//30): return 'heavy'      # Ryan's own browsers until ?internal=1 is set
    return None
drop = {a: r for a in views if (r:=excluded(a))}
ev = [e for e in ev if e['anon_id'] not in drop]

cut = dt.datetime.combine(today - dt.timedelta(DAYS), dt.time()).isoformat()
def period(e): return 'this' if e['timestamp'] >= cut else 'last'
P = {'this': [e for e in ev if period(e)=='this'], 'last': [e for e in ev if period(e)=='last']}
C = collections.Counter
def host(r):
    if not r: return '(direct)'
    m = re.match(r'https?://([^/]+)', r); h = m.group(1) if m else r
    return '(own site)' if h.endswith('json.fit') else h
def stats(E):
    s = {}
    ss = [e for e in E if e['event']=='session_started']
    s['visitors'] = len(set(e['anon_id'] for e in E))
    s['sessions'] = len(set(e['session_id'] for e in E))
    s['new visitors'] = len(set(e['anon_id'] for e in ss if e['properties'].get('is_first_visit')))
    s['page views'] = sum(1 for e in E if e['event']=='page_viewed')
    dl = [e for e in E if e['event'] in ('download_click','outbound_click')]
    s['store clicks'] = len(dl)
    s['cookbook emails'] = sum(1 for e in E if e['event']=='cookbook_email_submitted')
    home = set(e['session_id'] for e in E if e['event']=='page_viewed' and e['context'].get('path')=='/')
    for pct in (50,100):
        s[f'home sessions past {pct}%'] = len(set(e['session_id'] for e in E if e['event']=='scroll_depth' and e['context'].get('path')=='/' and e['properties'].get('percent')==pct))
    s['home sessions'] = len(home)
    eng = [e['properties']['engagement_time_ms']/1000 for e in E if e['event']=='page_engaged' and e['context'].get('path')=='/']
    s['home median seconds'] = round(statistics.median(eng)) if eng else 0
    return s
T, L = stats(P['this']), stats(P['last'])
print(f"json.fit — last {DAYS} days vs the {DAYS} before  (dropped {DUPES} duplicate events; excluded {sum(1 for r in drop.values() if r=='bot')} bot ids, {sum(1 for r in drop.values() if r=='heavy')} heavy ids)")
print(f"{'':28s}{'this':>8s}{'last':>8s}")
for k in T: print(f"{k:28s}{T[k]:8d}{L[k]:8d}")
E = P['this']
ss = [e for e in E if e['event']=='session_started']
def top(title, counter, n=10):
    print(f"\n{title}")
    for k, v in counter.most_common(n): print(f"  {v:5d}  {k}")
top('Landing pages', C(e['properties'].get('landing_page') for e in ss))
top('Referrers', C(host(e['properties'].get('referrer')) for e in ss))
top('Devices', C(e['properties'].get('device_type') for e in ss), 3)
top('Timezones', C(e['properties'].get('timezone') for e in ss), 6)
top('Pages viewed', C(e['context'].get('path') for e in E if e['event']=='page_viewed'), 15)
top('Store clicks by button', C(f"{e['properties'].get('store') or e['properties'].get('url')} / {e['properties'].get('button_location','?')}" for e in E if e['event'] in ('download_click','outbound_click')))
top('Other clicks', C(f"{e['event']} {json.dumps(e['properties'],sort_keys=True)[:70]}" for e in E if e['event'] in ('cta_clicked','meals_filter','meals_sort','video_opened')))
# Pages by exit: last page of each session
last = {}
for e in sorted(E, key=lambda e: e['timestamp']):
    if e['event']=='page_viewed': last[e['session_id']] = e['context'].get('path')
top('Last page of session', C(last.values()))
top('Sessions by day', C(e['timestamp'][:10] for e in ss), DAYS)
