# Product demo video

A 50-second walkthrough of FinSight-AI, made with [HyperFrames](https://hyperframes.heygen.com):
the film is an HTML page with a GSAP timeline, rendered to MP4.

The rendered film is at [`docs/media/finsight-demo.mp4`](../docs/media/finsight-demo.mp4).

## Change it and render again

```bash
cd video
python3 build.py          # writes index.html from the scene list at the top of build.py
npm run check             # lint, layout, motion and contrast checks
npm run render            # writes renders/<name>.mp4 (kept out of git)
```

To update a scene, edit its line in `build.py`: the start time, length, screenshot,
headline and one sentence of text. The screenshots in `assets/` are of the app running on
the synthetic dataset; replace a file to change a picture.

The film has no sound. Add a music bed or narration as an `<audio>` clip in `index.html`
if you want one.
