# Moonwall Docs Site

This is a [Vitepress](https://vitepress.dev/guide/what-is-vitepress) templated static docs site for Moonwall. 
Please consult their docs for syntax on how to format and use their templates.

## Dev Mode

To run this docs site in dev mode (live updates) you only need to:

```sh
pnpm docs:dev
```

and then visit the link shown:

```sh

  vitepress v1.0.0-rc.10

  ➜  Local:   http://localhost:5174/moonwall/
  ➜  Network: use --host to expose
  ➜  press h to show help
```

## Previewing changes (build and serve)

Before publishing to prod you may want to check it can be built and served correctly. This can be done via:

```sh
pnpm docs:build
pnpm docs:preview
```

> [!IMPORTANT]\
> This using preview will host the static files generated via build, and will be done so on a different port than running `dev`.
> It will also not be live updated based on changes made to the markdown files.

## Publishing to Prod

Any changes merged to main will automatically trigger a workflow which will build a new docs site and publish it to GitHub Pages. No additional interaction required.

> [!NOTE]\
> For the curious, this can be inspected at `.github/workflows/deploy.yml`.

---

## Changes to the site

### To add new pages and groups

Append to the list in `docs/.vitepress/sidebar.ts`. For example:

```typescript
    {
      text: "Utilities",
      collapsed: false,
      base: "/guide/util/",
      items: [
        { text: "My Cool New Page 💫", link: "coolness" },
        { text: "Common Helpers", link: "common" },
        { text: "Moonbeam Specific Helpers", link: "moonbeam" },
      ],
    },
```

Similarly you can just add whole new page groups by just adding to that overall list:

```typescript
    {
      text: "Utilities",
        ... // Rest of definition
    },
    {
      text: "Coolest Stuff",
      collapsed: false,
      base: "/guide/cool/",
      items: [
        { text: "The Coolest Page 🥶", link: "coolness" },
      ],
    },
```

### To add new Sections

Here you will see the various MarkDown pages and their locations. We have two separate lists for `guide` and `config`.

If more website sections are required they should be added as a new item in `docs/.vitepress/sidebar.ts` as a new function, and then imported to `docs/.vitepress/config.ts`

```typescript

import { sidebarGuide, sidebarConfig /* your new export function here */} from "./sidebar";

    ...
    // Rest of stuff
    
        nav: [
      { text: "Docs", link: "/guide/intro/getting-started" },
      { text: "Config", link: "/config/intro" },
      // Your new Section link here for the Nav bar
      { text: "FAQ", link: "/guide/troubleshooting/faq" },
      {
        text: `v${version}`,
        items: [
          {
            text: "Release Notes ",
            link: `https://github.com/Moonsong-Labs/moonwall/releases?q=${version}`,
          },
        ],
      },
    ],

    // Rest of stuff
    ...

    // sidebar: sidebar,
    sidebar: {
      "/guide/": { base: "/guide/", items: sidebarGuide() },
      "/config/": { base: "/config/", items: sidebarConfig() },
      // Your new section here
    },
```
