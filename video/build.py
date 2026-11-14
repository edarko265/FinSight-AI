import json
import pathlib
import subprocess
scenes=[
 ("dash",4,6.5,"dashboard.png","phone","01 · Understand","Know what is safe to spend","Balance, bills due and a reserve for the unexpected, worked out to the cent."),
 ("chat",10.5,6.5,"chat-pie.png","phone","02 · Ask","Ask in your own words","The AI picks the calculation. Our server does the sum. Every answer opens its transactions."),
 ("steps",0,6.0,"steps.png","phone","03 · Check","See how it was worked out","Every answer shows its steps, in the order the calculation took them."),
 ("voice",17,6.5,"voice.png","phone","04 · Talk","English, Finnish or Swedish","A live voice call with the same numbers. The voice agent holds no data."),
 ("widgets",0,6.0,"widgets.png","phone","05 · Make it yours","Build your own dashboard","Fifteen chart types. Widgets you drag, resize and remove. A microphone always in reach."),
 ("goals",23.5,6.5,"goals.png","phone","06 · Improve","Goals you can watch grow","Set money aside and see your progress against the plan, month by month."),
 ("plans",30,6.5,"plans.png","phone","07 · Share","Share a plan, never an amount","Friends copy your percentages and see them on their own income."),
 ("accounts",0,6.0,"accounts.png","phone","08 · Everything","All your accounts in one view","Every figure covers them all. Other banks are simulated in this demo."),
 ("mortgage",0,6.0,"mortgage.png","wide","09 · Learn","A mortgage, explained","The steps, the time and the costs, taught from two hundred applications."),
 ("admin",36.5,6.5,"admin.png","wide","10 · For the bank","See what customers need, never who asked","Anonymous usage, staff roles, and a way to teach the coach."),
]

def spoken(name):
    """Length of a narration clip in seconds, or 0 if it has not been generated."""
    path = pathlib.Path(__file__).parent / "assets" / "voice" / f"{name}.mp3"
    if not path.exists():
        return 0.0
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    return float(out.strip())

# Each scene lasts as long as its narration plus room to breathe; none is shorter than its floor.
VOICE_LEAD = 0.5
r1 = lambda value: round(value * 10) / 10
INTRO = r1(max(4.0, spoken("intro") + 1.1))
cursor = INTRO
timed = []
for (sid, _start, floor, img, kind, kicker, headline, text) in scenes:
    duration = r1(max(floor - 0.5, spoken(sid) + VOICE_LEAD + 0.9))
    timed.append((sid, cursor, duration, img, kind, kicker, headline, text))
    cursor = r1(cursor + duration)
scenes = timed
OUT = cursor
OUT_D = r1(max(6.0, spoken("outro") + 3.6))
TOTAL = r1(OUT + OUT_D)
voices = [("intro", 0.4)] + [(s[0], r1(s[1] + VOICE_LEAD)) for s in scenes] + [("outro", r1(OUT + 0.6))]

head='''<!doctype html>
<html lang="en" data-resolution="landscape">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      :root {
        --ground: #04291a;
        --ground-2: #0a3d27;
        --ink: #f3f7f4;
        --soft: #a9c4b5;
        --accent: #91fa9b;
        --font-display: "Helvetica Neue", Helvetica, Arial, sans-serif;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: var(--ground); }
      #root {
        position: relative; width: 1920px; height: 1080px; overflow: hidden;
        font-family: var(--font-display); color: var(--ink);
        background: radial-gradient(1200px 800px at 78% 40%, var(--ground-2), var(--ground) 70%);
      }
      .clip { position: absolute; inset: 0; }
      .scene { display: flex; align-items: center; padding: 0 140px; gap: 120px; }
      .copy { flex: 1; min-width: 0; }
      .kicker { font-size: 30px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
      .headline { margin-top: 26px; font-size: 96px; line-height: 1.04; font-weight: 700; letter-spacing: -0.03em; }
      .body { margin-top: 34px; max-width: 820px; font-size: 40px; line-height: 1.35; color: var(--soft); }
      .phone {
        flex: none; width: 436px; height: 944px; padding: 14px; border-radius: 62px; overflow: hidden;
        background: #0b0f0d; box-shadow: 0 50px 120px rgba(0,0,0,0.55), 0 0 0 2px rgba(145,250,155,0.18);
      }
      .phone .screen { width: 100%; height: 100%; border-radius: 48px; overflow: hidden; }
      .phone img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
      .browser {
        flex: none; width: 980px; border-radius: 22px; overflow: hidden; background: #0b0f0d;
        box-shadow: 0 50px 120px rgba(0,0,0,0.55), 0 0 0 2px rgba(145,250,155,0.18);
      }
      .browser .bar { height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 18px; background: #101614; }
      .browser .bar i { width: 13px; height: 13px; border-radius: 50%; background: #3a4a42; }
      .browser .screen { overflow: hidden; }
      .browser img { display: block; width: 100%; }
      .wide { gap: 80px; padding: 0 110px; }
      .wide .headline { font-size: 76px; }
      .wide .body { font-size: 36px; }
      .center { flex-direction: column; justify-content: center; text-align: center; gap: 0; }
      .mark { width: 200px; height: 200px; border-radius: 46px; box-shadow: 0 30px 80px rgba(0,0,0,0.5); }
      .title { margin-top: 48px; font-size: 150px; font-weight: 700; letter-spacing: -0.04em; }
      .tagline { margin-top: 26px; font-size: 52px; color: var(--soft); }
      .pills { margin-top: 70px; display: flex; flex-direction: column; gap: 26px; align-items: center; }
      .pill { padding: 24px 46px; border-radius: 999px; font-size: 44px; font-weight: 600; background: rgba(145,250,155,0.12); border: 2px solid rgba(145,250,155,0.35); }
      .foot { margin-top: 64px; font-size: 34px; color: var(--soft); }
      .progress { position: absolute; inset: auto 0 0 0; height: 8px; width: 1920px; background: var(--accent); transform-origin: left center; z-index: 5; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="@TOTAL@" data-width="1920" data-height="1080">
      <section id="intro" class="clip scene center" data-start="0" data-duration="@INTRO@" data-track-index="0">
        <img class="mark" src="assets/logo.svg" alt="" />
        <h1 class="title">FinSight-AI</h1>
        <p class="tagline">A personal economic trainer you can talk to</p>
      </section>
'''
body=""
for i,(sid,start,dur,img,kind,kicker,headline,text) in enumerate(scenes):
    if kind=="phone":
        frame=f'<div class="phone frame"><div class="screen" data-layout-allow-overflow><img src="assets/{img}" alt="" /></div></div>'
    else:
        frame=f'<div class="browser frame"><div class="bar"><i></i><i></i><i></i></div><div class="screen" data-layout-allow-overflow><img src="assets/{img}" alt="" /></div></div>'
    copy=f'<div class="copy"><p class="kicker">{kicker}</p><h2 class="headline">{headline}</h2><p class="body">{text}</p></div>'
    inner=(frame+"\n        "+copy) if i%2==0 else (copy+"\n        "+frame)
    cls="clip scene wide" if kind=="wide" else "clip scene"
    body+=f'      <section id="{sid}" class="{cls}" data-start="{start}" data-duration="{dur}" data-track-index="{(i+1)%2}">\n        {inner}\n      </section>\n'
tail='''      <section id="outro" class="clip scene center" data-start="@OUT@" data-duration="@OUTD@" data-track-index="0">
        <h2 class="headline" style="margin-top: 0">Advice you can check</h2>
        <div class="pills">
          <p class="pill">Every answer backed by your own transactions</p>
          <p class="pill">Encrypted per customer, consent before AI</p>
          <p class="pill">Still works with the AI switched off</p>
        </div>
        <p class="foot">FinSight-AI · open source · built on synthetic data for Junction 2026</p>
      </section>
@AUDIO@      <div class="progress clip" data-start="0" data-duration="@TOTAL@" data-track-index="2"></div>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      const scenes = @SCENES@;

      tl.fromTo("#intro .mark", { scale: 0.86 }, { scale: 1, duration: 0.9, ease: "back.out(1.6)" }, 0);
      tl.fromTo("#intro .title", { opacity: 0.35, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0.3);
      tl.fromTo("#intro .tagline", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 1.2);
      tl.to("#intro", { opacity: 0, duration: 0.4, ease: "power2.in" }, @INTRO@ - 0.4);

      // Feature scenes: the frame rises, the words follow, the picture drifts slowly, then all leave.
      scenes.forEach(([id, start, duration], index) => {
        const s = "#" + id;
        const side = index % 2 === 0 ? -1 : 1;
        tl.fromTo(s + " .frame", { opacity: 0, y: 120, rotate: 3 * side }, { opacity: 1, y: 0, rotate: 0, duration: 0.8, ease: "power3.out" }, start + 0.05);
        tl.fromTo(s + " .frame img", { scale: 1.06 }, { scale: 1, duration: duration, ease: "none" }, start);
        tl.fromTo(s + " .kicker", { opacity: 0, x: -40 * side }, { opacity: 1, x: 0, duration: 0.5, ease: "power3.out" }, start + 0.35);
        tl.fromTo(s + " .headline", { opacity: 0, x: -60 * side }, { opacity: 1, x: 0, duration: 0.6, ease: "power3.out" }, start + 0.5);
        tl.fromTo(s + " .body", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, start + 0.9);
        tl.to(s, { opacity: 0, duration: 0.4, ease: "power2.in" }, start + duration - 0.4);
      });

      tl.fromTo("#outro .headline", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, @OUT@ + 0.2);
      tl.fromTo("#outro .pill", { opacity: 0, y: 40, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.4)", stagger: 0.35 }, @OUT@ + 0.9);
      tl.fromTo("#outro .foot", { opacity: 0 }, { opacity: 1, duration: 0.6 }, @OUT@ + 2.6);

      tl.fromTo(".progress", { scaleX: 0 }, { scaleX: 1, duration: @TOTAL@, ease: "none" }, 0);
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
'''
audio = "".join(
    f'      <audio id="vo-{name}" src="assets/voice/{name}.mp3" data-start="{start}" data-duration="{int(spoken(name) * 100) / 100}" data-track-index="3" data-volume="1"></audio>\n'
    for name, start in voices if spoken(name) > 0
)
music = pathlib.Path(__file__).parent / "assets" / "music.mp3"
# A soft, slow pad made from four sine tones: no samples, so nothing to license.
subprocess.run(
    [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "lavfi", "-i", f"sine=frequency=130.81:duration={TOTAL + 1}",
        "-f", "lavfi", "-i", f"sine=frequency=196.00:duration={TOTAL + 1}",
        "-f", "lavfi", "-i", f"sine=frequency=261.63:duration={TOTAL + 1}",
        "-f", "lavfi", "-i", f"sine=frequency=329.63:duration={TOTAL + 1}",
        "-filter_complex",
        "[0][1][2][3]amix=inputs=4:normalize=1,tremolo=f=0.15:d=0.5,lowpass=f=900,"
        "aecho=0.8:0.7:420|830:0.35|0.25,volume=0.5,"
        f"afade=t=in:d=2,afade=t=out:st={TOTAL - 2.5}:d=2.5",
        "-ac", "2", "-b:a", "128k", str(music),
    ],
    check=True,
)
audio += (
    f'      <audio id="music" src="assets/music.mp3" data-start="0" data-duration="{TOTAL}" '
    'data-track-index="4" data-volume="0.35"></audio>\n'
)
html=(head+body+tail).replace("@TOTAL@",str(TOTAL)).replace("@INTRO@",str(INTRO)).replace("@OUTD@",str(OUT_D)).replace("@OUT@",str(OUT)).replace("@AUDIO@",audio).replace("@SCENES@",json.dumps([[s[0],s[1],s[2]] for s in scenes]))
open("index.html","w").write(html)
