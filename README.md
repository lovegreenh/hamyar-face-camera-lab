# Hamyar two-volunteer mobile camera lab

**Research-only isolated browser page. Not the HamyarOS production Edge matcher and not an approved attendance system.** Live HTTPS page: https://lovegreenh.github.io/hamyar-face-camera-lab/

## Two-person test on an Android phone

1. Use current Chrome over HTTPS; allow the camera only after explicitly clicking Start. The browser asks for permission.
2. Recruit **two consenting adults** only (not pupils). Each person must see the privacy explanation and agree to temporary local processing. This is an exploratory voluntary test, not school enrollment.
3. Load the three demo face-api.js models; click camera on.
4. Check A's consent and take **three separate captures** facing the camera, then repeat for B. Pause and slightly change angle/lighting between captures; only one person in view.
5. Select the actual person in the selector, place that person in front of the camera, then click **test current frame**. Test each of A and B at least three times in differing lighting/angles.
6. Inspect Euclidean distances for A/B, matches, mismatches and timing. The exploratory acceptance threshold of 0.50 and minimum margin of 0.05 are **not validated for biometric identity**.
7. Export the JSON (scores, pseudonyms A/B, no photos/descriptors), share the report for debugging, then click **clear all samples** and **camera off**.

**Suggested test grid:** A front, A angled, A in dimmer light; B front, B angled, B in dimmer light. Only accept a result as a preliminary *browser demonstration*, not proof of operational accuracy. Two people cannot establish false-accept or false-reject rates in a real school population.

## Privacy and security

- No name, face photo, facial descriptor or RTSP credential is collected by this repository or sent to HamyarOS, GitHub APIs or any server.
- Descriptors are kept in page memory only. Consent withdrawal clears the relevant descriptors and past scores. Page exit and reset clear session data; camera stop releases tracks.
- The public repo hosts only HTML/CSS/JavaScript. Pinned face-api.js v0.22.2 JavaScript is hosted on the same origin; model weights are fetched separately from jsDelivr CDN. **Network fetches for model weights expose ordinary network metadata (such as IP address) to the model CDN**, but not camera frames. Page CSP disallows outgoing connections except to its own origin and the model CDN.
- Hosting on GitHub Pages does not collect camera data. Server/CDN requests may still produce ordinary access logs. Do not enter participant names, use school records, or attempt real student attendance.
- Face-api.js model weights / training dataset provenance is not established for commercial redistribution. This is a limited preliminary voluntary evaluation only. No model weights are bundled into the GitHub repository.
- Do not silently move the model or descriptors into production. Production Edge remains fail-closed without separately licensed, offline, integrity-checked recognition models and validated camera/liveness and consent workflow.

## Technical verification (2026-11-08)

Headless Chrome/Edge on a 360px mobile viewport: HTTPS page HTTP 200, local face-api.js runtime loaded, all three models downloaded and initialized, synthetic browser camera started/stopped, viewport document scrollWidth == width 360. **No test with two actual human faces has yet been completed.**

Source code is public for audit; none of the actual test samples are public.
