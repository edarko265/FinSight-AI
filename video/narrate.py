"""Generates the narration for the demo film with an ElevenLabs voice.

Reads ELEVENLABS_API_KEY from ../.env.local (never printed). Run once, or again after
changing a line or the voice; then run build.py, which times each scene to its narration.

    python3 narrate.py            # all lines
    python3 narrate.py chat outro # only these
"""

import json
import pathlib
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
# Alice: clear, engaging, British. Any voice id from the ElevenLabs voice library works here.
VOICE_ID = "Xb7hH8MSUJpSbSDYk0k2"
MODEL = "eleven_multilingual_v2"

LINES = {
    "intro": "Meet FinSight A.I. A personal economic trainer you can talk to.",
    "dash": "It shows what is safe to spend this week, after your bills and a reserve for surprises.",
    "chat": "Ask in your own words. The A.I. picks the calculation, our server does the sum, and every answer opens the transactions behind it.",
    "voice": "Or just talk. In English, Finnish or Swedish, with exactly the same numbers.",
    "goals": "Describe a goal in one sentence, and get a plan built from what you usually have left.",
    "plans": "Share your plan with friends. They see the percentages, never your amounts.",
    "admin": "And the bank sees what customers need, never who asked, and can teach the coach new answers.",
    "outro": "FinSight A.I. Advice you can check.",
}


def api_key() -> str:
    for line in (HERE.parent / ".env.local").read_text().splitlines():
        if line.startswith("ELEVENLABS_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("ELEVENLABS_API_KEY is not set in .env.local")


def main() -> None:
    key = api_key()
    wanted = sys.argv[1:] or list(LINES)
    out = HERE / "assets" / "voice"
    out.mkdir(parents=True, exist_ok=True)
    for name in wanted:
        body = json.dumps(
            {
                "text": LINES[name],
                "model_id": MODEL,
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.2},
            }
        )
        target = out / f"{name}.mp3"
        # curl uses the system's certificates. The key goes in on standard input, so it never
        # appears in the process list.
        with tempfile.NamedTemporaryFile("w", suffix=".json") as payload:
            payload.write(body)
            payload.flush()
            subprocess.run(
                [
                    "curl", "--fail", "--silent", "--show-error", "--max-time", "90",
                    "-H", "@-", "-H", "Content-Type: application/json",
                    "--data-binary", f"@{payload.name}", "-o", str(target),
                    f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}?output_format=mp3_44100_128",
                ],
                input=f"xi-api-key: {key}\n",
                text=True,
                check=True,
            )
        print("wrote", f"assets/voice/{name}.mp3")


if __name__ == "__main__":
    main()
