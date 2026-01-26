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
        { text: "Foundations", link: "foundations" },
        { text: "Providers", link: "intro/providers" },
      ],
    },
    {
      text: "Testing",
      collapsed: false,
      items: [
        { text: "Writing & Running Tests", link: "testing" },
        { text: "Context Functions", link: "write/context-functions" },
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
        { text: "Utilities", link: "utilities" },
        { text: "Migration from v5", link: "intro/migration-v1" },
        { text: "FAQ", link: "troubleshooting/faq" },
        { text: "Common Errors", link: "troubleshooting/errors" },
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
