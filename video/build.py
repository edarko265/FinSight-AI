import json
scenes=[
 ("dash",4,6.5,"dashboard.png","phone","01 · Understand","Know what is safe to spend","Balance, bills due and a reserve for the unexpected, worked out to the cent."),
 ("chat",10.5,6.5,"chat-pie.png","phone","02 · Ask","Ask in your own words","The AI picks the calculation. Our server does the sum. Every answer opens its transactions."),
 ("voice",17,6.5,"voice.png","phone","03 · Talk","English, Finnish or Swedish","A live voice call with the same numbers. The voice agent holds no data."),
 ("goals",23.5,6.5,"goals.png","phone","04 · Improve","Goals from a sentence","A plan from what you usually have left. Rewards for beating your own past."),
 ("plans",30,6.5,"plans.png","phone","05 · Share","Share a plan, never an amount","Friends copy your percentages and see them on their own income."),
 ("admin",36.5,6.5,"admin.png","wide","06 · For the bank","See what customers need, never who asked","Anonymous usage, staff roles, and a way to teach the coach."),
]
TOTAL=50
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
      <section id="intro" class="clip scene center" data-start="0" data-duration="4" data-track-index="0">
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
tail='''      <section id="outro" class="clip scene center" data-start="43" data-duration="7" data-track-index="0">
        <h2 class="headline" style="margin-top: 0">Advice you can check</h2>
        <div class="pills">
          <p class="pill">Every answer backed by your own transactions</p>
          <p class="pill">Encrypted per customer, consent before AI</p>
          <p class="pill">Still works with the AI switched off</p>
        </div>
        <p class="foot">FinSight-AI · open source · built on synthetic data for Junction 2026</p>
      </section>
      <div class="progress clip" data-start="0" data-duration="@TOTAL@" data-track-index="2"></div>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      const scenes = @SCENES@;

      tl.fromTo("#intro .mark", { scale: 0.86 }, { scale: 1, duration: 0.9, ease: "back.out(1.6)" }, 0);
      tl.fromTo("#intro .title", { opacity: 0.35, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0.3);
      tl.fromTo("#intro .tagline", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 1.2);
      tl.to("#intro", { opacity: 0, duration: 0.4, ease: "power2.in" }, 3.6);

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

      tl.fromTo("#outro .headline", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 43.2);
      tl.fromTo("#outro .pill", { opacity: 0, y: 40, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.4)", stagger: 0.35 }, 43.9);
      tl.fromTo("#outro .foot", { opacity: 0 }, { opacity: 1, duration: 0.6 }, 45.6);

      tl.fromTo(".progress", { scaleX: 0 }, { scaleX: 1, duration: @TOTAL@, ease: "none" }, 0);
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
'''
html=(head+body+tail).replace("@TOTAL@",str(TOTAL)).replace("@SCENES@",json.dumps([[s[0],s[1],s[2]] for s in scenes]))
open("index.html","w").write(html)
