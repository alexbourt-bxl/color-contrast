import { Action, ActionPanel, Clipboard, Detail, environment } from "@raycast/api";
import Color from "colorjs.io";
import { useEffect, useMemo, useState } from "react";

import { parsePickedColor } from "./color";
import { computeApca } from "./contrastMetrics";
import { buildResultsText } from "./contrastText";
import { pickTwoPixelsWithResult } from "./picker";
import { buildSwatchMarkdown } from "./swatchMarkdown";
import { TagColors } from "./tagColors";
import { getApcaScaleColorKey, getApcaScaleWord } from "./apcaScale";
import { clearRememberedPick, loadRememberedPick, saveRememberedPick } from "./rememberedPick";

export default function Command()
{
  type TagItem =
  {
    key: string;
    text: string;
    color?: string;
  };

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

  const [foregroundHex, setForegroundHex] = useState("");
  const [backgroundHex, setBackgroundHex] = useState("");
  const [isPicking, setIsPicking] = useState(false);
 
  const foreground = useMemo(() =>
  {
    const trimmed = foregroundHex.trim();
    if (!trimmed)
    {
      return null;
    }
 
    try
    {
      return parsePickedColor(trimmed);
    }
    catch
    {
      return null;
    }
  }, [foregroundHex]);
 
  const background = useMemo(() =>
  {
    const trimmed = backgroundHex.trim();
    if (!trimmed)
    {
      return null;
    }
 
    try
    {
      return parsePickedColor(trimmed);
    }
    catch
    {
      return null;
    }
  }, [backgroundHex]);

  const results = useMemo(() =>
  {
    if (!foreground || !background)
    {
      return null;
    }

    const wcagRatio = Color.contrast(background.hex, foreground.hex, "WCAG21");
    const apca = computeApca(foreground.srgb8bit, background.srgb8bit);

    return (
    {
      wcagRatio,
      apca,
    });
  }, [foreground, background]);

  const resultsText = buildResultsText(
  {
    foreground,
    background,
    results,
  });

  const swatchMarkdown = useMemo(() =>
  {
    if (!foreground && !background)
    {
      return "";
    }

    const isDark = environment.appearance === "dark";
    const borderColor = isDark ? "#ffffff10" : "#00000008";

    const placeholderFg = isDark ? "#b0b0b0" : "#6a6a6a";
    const placeholderBg = isDark ? "#2a2a2a" : "#f2f2f2";

    const fgHex = foreground ? normalizeHex6(foreground.hex) : placeholderFg;
    const bgHex = background ? normalizeHex6(background.hex) : placeholderBg;

    const fgText = foreground ? `FG ${fgHex}` : "Pick foreground";
    const bgText = background ? `BG ${bgHex}` : "Pick background";

    return buildSwatchMarkdown(
    {
      foregroundHex: fgHex,
      backgroundHex: bgHex,
      label: "Aa",
      size: 140,
      borderColor,
      footerBadges:
      {
        foregroundHex: fgHex,
        backgroundHex: bgHex,
        foregroundText: fgText,
        backgroundText: bgText,
      },
      width: 420,
    });
  }, [foreground, background]);

  const disabledSwatchMarkdown = useMemo(() =>
  {
    if (foreground || background)
    {
      return "";
    }

    const isDark = environment.appearance === "dark";
    const borderColor = isDark ? "#ffffff10" : "#00000010";
    const fg = isDark ? "#b0b0b0" : "#6a6a6a";
    const bg = isDark ? "#2a2a2a" : "#f2f2f2";

    return buildSwatchMarkdown(
    {
      foregroundHex: fg,
      backgroundHex: bg,
      label: "Aa",
      size: 140,
      borderColor,
      footerBadges:
      {
        foregroundHex: fg,
        backgroundHex: bg,
        foregroundText: "Pick foreground",
        backgroundText: "Pick background",
      },
      width: 420,
    });
  }, [foreground, background]);

  const detailMarkdown = useMemo(() =>
  {
    if (swatchMarkdown)
    {
      return swatchMarkdown;
    }

    if (disabledSwatchMarkdown)
    {
      return disabledSwatchMarkdown;
    }

    return resultsText;
  }, [swatchMarkdown, disabledSwatchMarkdown, resultsText]);

  useEffect(() =>
  {
    let canceled = false;

    const run = async (): Promise<void> =>
    {
      const remembered = await loadRememberedPick();
      if (canceled)
      {
        return;
      }

      if (remembered)
      {
        setForegroundHex(remembered.foreground.hex);
        setBackgroundHex(remembered.background.hex);
        return;
      }

      const picked = await pickTwoPixelsWithResult(
      {
        setIsPicking,
        setForegroundHex,
        setBackgroundHex,
      });

      if (canceled)
      {
        return;
      }

      if (picked)
      {
        await saveRememberedPick(picked);
      }
    };

    void run();

    return () =>
    {
      canceled = true;
    };
  }, []);

  const wcagSummary = useMemo(() =>
  {
    if (!results)
    {
      return null;
    }

    const ratio = results.wcagRatio;
    return (
    {
      ratio,
      aaNormal: ratio >= 4.5,
      aaaNormal: ratio >= 7.0,
      aaLarge: ratio >= 3.0,
      aaaLarge: ratio >= 4.5,
    });
  }, [results]);

  const apcaSummary = useMemo(() =>
  {
    if (!results)
    {
      return null;
    }

    const lc = results.apca;
    const absLc = Math.abs(lc);

    return (
    {
      lc,
      absLc,
    });
  }, [results]);

  const wcagTagItems = useMemo((): TagItem[] | null =>
  {
    if (!wcagSummary)
    {
      return null;
    }

    const normalText = wcagSummary.aaaNormal ? "AAA normal" : "AA normal";
    const normalPass = wcagSummary.aaaNormal || wcagSummary.aaNormal;

    const largeText = wcagSummary.aaaLarge ? "AAA large" : "AA large";
    const largePass = wcagSummary.aaaLarge || wcagSummary.aaLarge;

    return (
    [
      {
        key: "normal",
        text: normalText,
        color: normalPass ? TagColors.pass : TagColors.fail,
      },
      {
        key: "large",
        text: largeText,
        color: largePass ? TagColors.pass : TagColors.fail,
      },
    ]);
  }, [wcagSummary]);

  const apcaColor = useMemo(() =>
  {
    if (!apcaSummary)
    {
      return undefined;
    }

    const key = getApcaScaleColorKey(apcaSummary.absLc);
    return TagColors.apca[key];
  }, [apcaSummary]);

  const apcaWord = useMemo((): string | null =>
  {
    if (!apcaSummary)
    {
      return null;
    }

    return getApcaScaleWord(apcaSummary.absLc);
  }, [apcaSummary]);

  const apcaTagItems = useMemo((): TagItem[] =>
  {
    if (!apcaSummary)
    {
      return (
      [
        {
          key: "apcaAbsLc",
          text: "—",
        },
      ]);
    }

    return (
    [
      {
        key: "apcaAbsLc",
        text: apcaWord ?? "—",
        color: apcaColor,
      },
    ]);
  }, [apcaSummary, apcaWord, apcaColor]);

  return (
    <Detail 
      markdown={detailMarkdown}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action
              title={isPicking ? "Picking…" : "Pick two pixels"}
              onAction={async () =>
              {
                const picked = await pickTwoPixelsWithResult(
                {
                  setIsPicking,
                  setForegroundHex,
                  setBackgroundHex,
                });

                if (picked)
                {
                  await saveRememberedPick(picked);
                }
              }}
            />
          </ActionPanel.Section>

          <ActionPanel.Section>
            <Action
              title="Copy foreground color"
              onAction={async () =>
              {
                if (!foreground)
                {
                  return;
                }

                await Clipboard.copy(foreground.hex.replace(/^#/, ""));
              }}
            />
            <Action
              title="Copy background color"
              onAction={async () =>
              {
                if (!background)
                {
                  return;
                }

                await Clipboard.copy(background.hex.replace(/^#/, ""));
              }}
            />
          </ActionPanel.Section>

          <ActionPanel.Section>
            <Action
              title="Swap foreground and background"
              onAction={() =>
              {
                if (!foregroundHex.trim() || !backgroundHex.trim())
                {
                  return;
                }

                const fg = foregroundHex;
                setForegroundHex(backgroundHex);
                setBackgroundHex(fg);
              }}
            />
            <Action
              title="Clear"
              onAction={async () =>
              {
                setForegroundHex("");
                setBackgroundHex("");
                await clearRememberedPick();
              }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
      metadata={
        <Detail.Metadata>
          {
            wcagSummary &&
            (
              <>
                <Detail.Metadata.Label title="WCAG" text={`${Math.round(wcagSummary.ratio * 100) / 100}`} />
                <Detail.Metadata.TagList title="">
                  {wcagTagItems?.map((item) =>
                  {
                    return <Detail.Metadata.TagList.Item key={item.key} text={item.text} color={item.color} />;
                  })}
                </Detail.Metadata.TagList>
                <Detail.Metadata.Separator />
              </>
            )
          }

          {apcaSummary && (
            <>
              <Detail.Metadata.Label title="APCA" text={apcaSummary ? String(Math.abs(Math.round(apcaSummary.lc))) : "—"} />
              <Detail.Metadata.TagList title="">
                {apcaTagItems.map((item) =>
                {
                  return <Detail.Metadata.TagList.Item key={item.key} text={item.text} color={item.color} />;
                })}
              </Detail.Metadata.TagList>
              <Detail.Metadata.Separator />
            </>
          )}
        </Detail.Metadata>
      }
    />

  );
}
