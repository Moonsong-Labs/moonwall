# Test Reporting & Outputs

Vitest – the underlying runner – comes with many **built-in reporters**.  Moonwall exposes them via the `reporters` and `reportFile` fields on the *environment* level so you can generate machine-readable artefacts for your CI or dashboards.

---

## 1 – Config fields

| Field           | Type                                             | Default | Description |
|-----------------|--------------------------------------------------|---------|-------------|
| `reporters`     | `string[]`                                       | `["basic"]` | Ordered list of Vitest reporters to enable.  Must be one of `basic`, `dot`, `verbose`, `json`, `html`, `junit`, … |
| `reportFile`    | `string \| { [reporterName]: string }`           | *none* | Output path(s) for reporters that write files (JSON, JUnit, HTML).  When you provide a **single string** it is used for the *first* file-based reporter. |

These properties belong *inside an environment* – they override the global default **per env**.

```jsonc
{
  "environments": [
    {
      "name": "ci_env",
      "reporters": ["junit", "basic"],
      "reportFile": { "junit": "tmp/junit.xml" },
      …
    }
  ]
}
```

---

## 2 – Supported reporters

| Name      | CLI friendly | Notes |
|-----------|--------------|-------|
| `basic`   | ✅            | The default – colourful and concise. |
| `dot`     | ✅            | 1 char per test.  Nice for **very** large suites. |
| `verbose` | ⚠️            | Upstream bug strikes out lines when >200 tests. |
| `json`    | ✅            | Produces a JSON summary.  Needs `reportFile`. |
| `html`    | ✅            | Generates a static HTML page.  Needs `reportFile` and you must **serve** the folder yourself, e.g. `npx serve ./tmp/report`. |
| `junit`   | ✅            | Perfect for CI systems that parse `junit.xml`. |

::: tip Using multiple reporters
You can specify multiple reporters in the array – Moonwall pipes the test stream to each reporter in the given order.  Combine e.g. `junit` + `basic` to get artefacts *and* human readable output.
:::

---

## 3 – Programmatic access

When you need to post-process the results inside the same Node process you can use the *promise* returned by `testCmd` (Moonwall public API):

```ts
import { testCmd } from "@moonwall/cli";

const passed = await testCmd("ci_env", { update: true });

if (!passed) {
  // send Slack message, upload artefacts, …
}
```

The function resolves to **`true`** when all suites passed.

---

## 4 – Example – HTML report in GitHub Pages

```yaml
- name: Run tests & build report
  run: |
    pnpm moonwall test devnet \
      --vitest "--coverage" \
      || echo "::set-output name=has-failures::true"

- name: Upload artefact
  if: always()
  uses: actions/upload-pages-artifact@v2
  with:
    # path must match reportFile above
    path: tmp/html-report

- name: Deploy to Pages
  if: always()
  id: deployment
  uses: actions/deploy-pages@v2
```

---

### Further reading

* [Vitest Reporter Docs](https://vitest.dev/guide/reporters)
* [CI guide](/guide/test/ci)
