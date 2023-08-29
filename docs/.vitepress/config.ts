import { defineConfig } from "vitepress";
import { sidebarGuide, sidebarConfig } from "./sidebar";
import { version } from "../../package.json";

const title = "Moonwall";
const description = "Run substrate networks and perform tests, with least fuss possible.";

export default defineConfig({
  lang: "en-US",

  base: "/moonwall/",

  title: title,
  titleTemplate: `:title · ${title}`,
  description: description,

  head: [
    ["meta", { name: "theme-color", content: "#729b1a" }],
    ["link", { rel: "icon", href: "/moonwall/logo.ico" }],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Exo:ital,wght@0,300;0,400;0,600;0,700;1,300&display=swap",
      },
    ],
  ],

  markdown: {
    theme: {
      light: "vitesse-light",
      dark: "vitesse-dark",
    },
  },

  themeConfig: {
    externalLinkIcon: true,

    logo: { light: "/MSL.svg", dark: "/MSL.svg", alt: "Moonsong Labs" },

    nav: [
      { text: "Docs", link: "/guide/intro/getting-started" },
      { text: "Config", link: "/config/intro" },
      { text: "FAQ", link: "/guide/troubleshooting/faq" },
      {
        text: `v${version}`,
        items: [
          {
            text: "Release Notes ",
            link: "releases link here",
          },
        ],
      },
    ],

    search: {
      provider: "local",
    },

    // sidebar: sidebar,
    sidebar: {
      "/guide/": { base: "/guide/", items: sidebarGuide() },
      "/config/": { base: "/config/", items: sidebarConfig() },
    },

    lastUpdated: {
      text: "Updated at",
      formatOptions: {
        dateStyle: "full",
        timeStyle: "medium",
      },
    },

    editLink: {
      pattern: "https://github.com/Moonsong-Labs/moonwall/edit/main/docs/:path",
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/Moonsong-Labs/moonwall" },
      { icon: "linkedin", link: "https://www.linkedin.com/company/moonsong-labs/" },
    ],
  },
});
