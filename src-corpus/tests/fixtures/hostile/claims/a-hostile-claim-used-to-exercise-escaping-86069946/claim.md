---
corpusSchemaVersion: 0.1.0
claimKind: claim
canonicalRestatement: |
  A hostile claim used to exercise escaping.
---

## Authored prose carrying markup

Inline script: <script>alert(1)</script>

Image with a handler: <img src=x onerror=alert(1)>

A link with a dangerous scheme: [click me](javascript:alert(document.cookie))

<iframe src="https://evil.example/frame"></iframe>

Quoted in code: `<script>alert(1)</script>`

> A quote containing <b>markup</b> and "quotes" & ampersands.
