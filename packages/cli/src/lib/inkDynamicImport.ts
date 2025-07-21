/**
 * Dynamic import wrapper for ink to support CommonJS builds
 * This allows the CommonJS build to load the ESM-only ink library
 */

import type { render as RenderType } from "ink";
import type React from "react";

export interface InkComponents {
  render: typeof RenderType;
  Box: any;
  Text: any;
  useInput: any;
  useApp: any;
  Static: any;
  Spacer: any;
}

let inkCache: InkComponents | null = null;

/**
 * Dynamically imports ink and caches the result
 */
export async function getInkComponents(): Promise<InkComponents> {
  if (inkCache) {
    return inkCache;
  }

  const ink = await import("ink");
  inkCache = {
    render: ink.render,
    Box: ink.Box,
    Text: ink.Text,
    useInput: ink.useInput,
    useApp: ink.useApp,
    Static: ink.Static,
    Spacer: ink.Spacer,
  };

  return inkCache;
}

/**
 * Renders a React component using dynamically imported ink
 */
export async function renderWithInk(
  component: React.ReactElement,
  options?: Parameters<typeof RenderType>[1]
) {
  const { render } = await getInkComponents();
  return render(component, options);
}

/**
 * Creates a LogViewer component with dynamically imported ink dependencies
 */
export async function createLogViewer(): Promise<{
  LogViewer: any;
  inkComponents: InkComponents;
}> {
  // First import ink components
  const inkComponents = await getInkComponents();

  // Then import LogViewer which uses these components
  // We need to pass ink components to avoid direct imports in LogViewer
  const { LogViewer } = await import("../cmds/components/LogViewer");

  return { LogViewer, inkComponents };
}
