# Site tests

The marketing site in `site/` has no build step and no test runner, and it is
deployed by a subtree push of `site/` alone. These tests therefore live here,
outside `site/`, so they are version controlled but never reach `gh-pages`.

Run them all:

    node --test tools/site-tests/

Run one file:

    node --test tools/site-tests/quiz-pure.test.mjs

`harness.mjs` reads the real shipped `site/data/config.js`,
`site/data/fleet.js` and `site/scripts/quiz.js` and evaluates them inside a
`node:vm` context with stub `window`, `document` and `navigator` globals. The
file under test is byte for byte the file that ships. `quiz.js` puts its pure
helpers on `window.TEX_QUIZ` and does all DOM work inside a `DOMContentLoaded`
handler, so nothing renders when the harness loads it.

`markup.test.mjs` makes static assertions about the shipped HTML, CSS and
sitemap. In a repo with no build step, that is the only automated guard against
a hand edit quietly undoing a decision from the spec.

Manual checks are served from `site/`:

    python3 -m http.server 8000 --directory site
