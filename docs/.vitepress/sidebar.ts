import type { DefaultTheme } from "vitepress";

export const sidebarGuide = () =>
  [
    {
      text: "Introduction",
      collapsed: false,
      items: [
        { text: "What is Moonwall?", link: "/intro/what-is-a-moonwall" },
        { text: "Getting Started", link: "/intro/getting-started" },
        { text: "Foundations", link: "/intro/foundations" },
        { text: "Providers Supported", link: "/intro/providers" },
        { text: "Networks Supported", link: "/intro/networks" },
      ],
    },

    {
      text: "Running Tests",
      collapsed: false,
      items: [
        { text: "Quick Start", link: "/test/quick-start" },
        { text: "Test Reports", link: "/test/reporting" },
        { text: "Debugging Tests", link: "/test/debug" },
        { text: "For CI", link: "/test/ci" },
      ],
    },
    {
      text: "Writing Tests",
      collapsed: false,
      items: [
        { text: "Quick Start", link: "/write/quick-start" },
        { text: "Context Functions", link: "/write/context-functions" },
      ],
    },
    {
      text: "Commands",
      collapsed: false,
      items: [
        { text: "Introduction", link: "/cmd/intro" },
        { text: "init", link: "/cmd/init" },
        { text: "run", link: "/cmd/run" },
        { text: "test", link: "/cmd/test" },
        { text: "download", link: "/cmd/download" },
        { text: "The CLI", link: "/cmd/cli" },
      ],
    },
    {
      text: "Utilities",
      collapsed: false,
      items: [
        { text: "Common Helpers", link: "/util/common" },
        { text: "Moonbeam Specific Helpers", link: "/util/moonbeam" },
      ],
    },
    {
      text: "Troubleshooting",
      collapsed: false,
      items: [
        { text: "Errors", link: "/troubleshooting/errors" },
        { text: "FAQ", link: "/troubleshooting/faq" },
      ],
    },
    {
      text: "Guide Examples",
      collapsed: false,
      items: [
        { text: "Markdown Examples", link: "/markdown-examples" },
        { text: "Runtime API Examples", link: "/api-examples" },
      ],
    },
  ] satisfies DefaultTheme.Sidebar;

export const sidebarConfig = () =>
  [
    {
      text: "Global Config",
      collapsed: false,
      items: [
        { text: "Introduction", link: "config/intro" },
        { text: "Global Config FIle", link: "config/moonwall-config" },
        { text: "Environments", link: "config/environment" },
        { text: "Dev Foundation", link: "config/dev" },
        { text: "Read-only Foundation", link: "config/read-only" },
        { text: "Chopsticks Foundation", link: "config/chopsticks" },
        { text: "Zombienet Foundation", link: "config/zombie" },
        { text: "Runtime API Examples", link: "config/api-examples" },
      ],
    },
    {
      text: "Config Guide Examples",
      collapsed: false,
      items: [
        { text: "Markdown Examples", link: "/markdown-examples" },
        { text: "Runtime API Examples", link: "/api-examples" },
      ],
    },
  ] satisfies DefaultTheme.Sidebar;
