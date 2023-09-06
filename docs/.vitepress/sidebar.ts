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
      text: "Writing Tests",
      collapsed: false,
      base: "/guide/write/",
      items: [
        { text: "Quick Start", link: "quick-start" },
        { text: "Context Functions", link: "context-functions" },
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
    {
      text: "Guide Examples",
      collapsed: false,
      base: "/guide/",
      items: [
        { text: "Markdown Examples", link: "markdown-examples" },
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
        { text: "Global Config FIle", link: "moonwall-config" },
        { text: "Environments", link: "environment" },
        { text: "Dev Networks", link: "dev" },
        { text: "Read-only Networks", link: "read-only" },
        { text: "Chopsticks Networks", link: "chopsticks" },
        { text: "Zombienet Networks", link: "zombie" },
      ],
    },
  ];
}
