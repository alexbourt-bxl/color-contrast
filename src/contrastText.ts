import type { ContrastResults, PickedColor } from "./types";

export function buildResultsText(
  params:
  {
    foreground: PickedColor | null;
    background: PickedColor | null;
    results: ContrastResults | null;
  }
): string
{
  if (!params.results)
  {
    return (
    [
      "Pick foreground, then background color…",
    ]).join("<br />");
  }

  const foregroundHex = params.foreground ? normalizeHex6(params.foreground.hex) : "—";
  const backgroundHex = params.background ? normalizeHex6(params.background.hex) : "—";

  return (
  [
    `FG: ${foregroundHex}`,
    `BG: ${backgroundHex}`,
  ]).join("\n");
}

export function buildCopyText(
  params:
  {
    foreground: PickedColor | null;
    background: PickedColor | null;
    results: ContrastResults | null;
  }
): string
{
  const foregroundHex = params.foreground ? normalizeHex6(params.foreground.hex) : "";
  const backgroundHex = params.background ? normalizeHex6(params.background.hex) : "";

  if (!params.results)
  {
    return `Foreground: ${foregroundHex}\nBackground: ${backgroundHex}\n`;
  }

  const wcagRounded = Math.round(params.results.wcagRatio * 100) / 100;
  const apcaRounded = Math.round(params.results.apca);

  return (
  [
    `Foreground: ${foregroundHex}`,
    `Background: ${backgroundHex}`,
    `WCAG: ${wcagRounded}`,
    `APCA: ${Math.abs(apcaRounded)}`,
  ]).join("\n");
}

function normalizeHex6(hex: string): string
{
  const trimmed = hex.trim();
  if (trimmed.length === 4 && trimmed.startsWith("#"))
  {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return trimmed;
}
