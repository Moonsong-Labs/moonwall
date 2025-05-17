import type { DefaultTheme } from "vitepress";

export function sidebarGuide(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: "Introduction",
      collapsed: false,
      base: "/guide/intro/",
      items: [
        { text: "What is Moonwall?", link: "what-is-a-moonwall" },
        { text: "Getting Started", link: "getting-started" },
        { text: "Foundations", link: "foundations" },
        { text: "Providers Supported", link: "providers" },
        { text: "Networks Supported", link: "networks" },
      ],
    },
    {
      text: "Writing Tests",
      collapsed: false,
      base: "/guide/write/",
      items: [
        { text: "Quick Start", link: "quick-start" },
        { text: "Context Functions", link: "context-functions" },
      ],
    },
    {
      text: "Running Tests",
      collapsed: false,
      base: "/guide/test/",
      items: [
        { text: "Quick Start", link: "quick-start" },
        { text: "Test Reports", link: "reporting" },
        { text: "Debugging Tests", link: "debug" },
        { text: "For CI", link: "ci" },
      ],
    },
    {
      text: "Config",
      collapsed: true,
      base: "/config/",
      items: [
        { text: "Environment", link: "environment" },
        { text: "Foundation", link: "foundation" },
        { text: "Chopsticks", link: "chopsticks" },
        { text: "Read-Only", link: "read-only" },
        { text: "Zombie", link: "zombie" },
        { text: "moonwall-config", link: "moonwall-config" },
      ],
    },
    {
      text: "Commands",
      collapsed: false,
      base: "/guide/cmd/",
      items: [
        { text: "Introduction", link: "intro" },
        { text: "Init", link: "init" },
        { text: "Run", link: "run" },
        { text: "Test", link: "test" },
        { text: "Download", link: "download" },
        { text: "The CLI", link: "cli" },
      ],
    },
    {
      text: "Utilities",
      collapsed: false,
      base: "/guide/util/",
      items: [
        { text: "Common Helpers", link: "common" },
        { text: "Moonbeam Specific Helpers", link: "moonbeam" },
      ],
    },
    {
      text: "Troubleshooting",
      collapsed: false,
      base: "/guide/troubleshooting/",
      items: [
        { text: "Errors", link: "errors" },
        { text: "FAQ", link: "faq" },
      ],
    },
  ];
}

export function sidebarConfig(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: "Global Config",
      collapsed: false,
      items: [
        { text: "Introduction", link: "intro" },
        { text: "Global Config File", link: "moonwall-config" },
        { text: "Environments", link: "environment" },
        { text: "Foundation", link: "foundation" },
        { text: "Dev Foundation", link: "dev" },
        { text: "Read-Only Foundation", link: "read-only" },
        { text: "Chopsticks Foundation", link: "chopsticks" },
        { text: "Zombie Foundation", link: "zombie" },
      ],
    },
  ];
}