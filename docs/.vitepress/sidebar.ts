import type { DefaultTheme } from "vitepress";

export function sidebarGuide(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: "Getting Started",
      collapsed: false,
      base: "/guide/intro/",
      items: [
        { text: "What is Moonwall?", link: "what-is-a-moonwall" },
        { text: "Quick Start", link: "getting-started" },
        { text: "Architecture", link: "architecture" },
      ],
    },
    {
      text: "Core Concepts",
      collapsed: false,
      items: [
        { text: "Foundations", link: "/guide/foundations" },
        { text: "Providers", link: "/guide/intro/providers" },
      ],
    },
    {
      text: "Testing",
      collapsed: false,
      items: [
        { text: "Writing & Running Tests", link: "/guide/testing" },
        { text: "Context Functions", link: "/guide/write/context-functions" },
      ],
    },
    {
      text: "Configuration",
      collapsed: false,
      base: "/config/",
      items: [
        { text: "Config Reference", link: "moonwall-config" },
        { text: "Environment Options", link: "environment" },
      ],
    },
    {
      text: "Reference",
      collapsed: true,
      items: [
        { text: "Utilities", link: "/guide/utilities" },
        { text: "Migration from v5", link: "/guide/intro/migration-v1" },
        { text: "FAQ", link: "/guide/troubleshooting/faq" },
        { text: "Common Errors", link: "/guide/troubleshooting/errors" },
      ],
    },
  ];
}

export function sidebarConfig(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: "Configuration",
      collapsed: false,
      items: [
        { text: "Global Config File", link: "moonwall-config" },
        { text: "Environments", link: "environment" },
      ],
    },
  ];
}
