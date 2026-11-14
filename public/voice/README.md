# Voice helper

`libsamplerate.worklet.js` is an unmodified copy of
[`@alexanderolsen/libsamplerate-js`](https://github.com/aolsenjazz/libsamplerate-js) 2.1.2
(`dist/libsamplerate.worklet.js`, MIT licence).

The voice-call library needs it on Safari, where the microphone cannot be asked for a
sample rate. By default the library downloads it from a public CDN; the app's content
security policy only allows scripts from this site, so the file is served from here.

SHA-256: `ca6e162f194d3ee5a2d2cd3c3b49641d31e56845aeae507feca1cdf8aa8116cb`

To update it, download the same path for the new version from the npm package, replace the
file, and update the version and checksum above.
