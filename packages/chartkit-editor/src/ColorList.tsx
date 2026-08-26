/**
 * Picking colors for one chart.
 *
 * Palettes belong in the site's stylesheet, and that stays the default: leave
 * every entry here alone and the chart takes `--chart-series-N` from the page,
 * so a site restyle repaints every chart at once and nobody types hex codes
 * into a CMS. This is for the chart that has something to say the house style
 * cannot - one series highlighted, red for the quarter that went wrong.
 *
 * So the list is per entry and each one is independently clearable. Anything
 * else would force a chart that wants one red to name every other color too,
 * and those colors would then be frozen against the next restyle.
 */

import { Box, Field, Flex, IconButton, Typography } from '@strapi/design-system';
import { Cross } from '@strapi/icons';
import { seriesColor } from '@qkix/chartkit-core';
import type { ChartSpec } from '@qkix/chartkit-core';
import * as React from 'react';

/** Chart types whose colors are slices rather than series. */
const RADIAL = new Set(['pie', 'donut']);

/**
 * The swatch shown for an entry with no color of its own.
 *
 * `seriesColor` returns a `var(--chart-series-N, #4269d0)`, which a native
 * color input cannot take - it only speaks `#rrggbb`. The fallback inside the
 * var is the honest thing to show: it is what the chart draws on a page that
 * defines no palette, and the admin panel is one such page.
 */
const defaultSwatch = (index: number): string =>
  /#[0-9a-f]{6}/i.exec(seriesColor(index))?.[0] ?? '#4269d0';

export type ColorListProps = {
  spec: ChartSpec;
  disabled?: boolean;
  onChange: (index: number, color: string | null) => void;
};

export function ColorList({ spec, disabled, onChange }: ColorListProps) {
  // Whatever the legend names is what a color belongs to - series for a bar or
  // line chart, slices for a pie. Anything else would offer three colors for a
  // pie of eight slices.
  const names = RADIAL.has(spec.type) ? spec.data.labels : spec.data.series.map((one) => one.name);

  if (names.length === 0) return null;

  const colors = spec.options?.colors ?? [];

  return (
    <Box>
      <Flex direction="column" alignItems="flex-start" gap={1} paddingBottom={2}>
        <Typography variant="delta" tag="h3">
          Colors
        </Typography>
        <Typography variant="pi" textColor="neutral600">
          Left alone, each one follows your site&apos;s palette. Set one to overrule it.
        </Typography>
      </Flex>

      <Flex gap={4} wrap="wrap">
        {names.map((name, index) => {
          const color = colors[index] ?? null;

          return (
            <Field.Root key={index} name={`chart-color-${index}`}>
              <Field.Label>{name || `Series ${index + 1}`}</Field.Label>
              <Flex gap={1} alignItems="center">
                <input
                  type="color"
                  aria-label={`Color for ${name || `series ${index + 1}`}`}
                  value={color ?? defaultSwatch(index)}
                  disabled={disabled}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    onChange(index, event.target.value)
                  }
                  style={{
                    width: 40,
                    height: 32,
                    padding: 2,
                    border: 0,
                    background: 'none',
                    cursor: disabled ? 'default' : 'pointer',
                  }}
                />
                {/*
                  Only shown once there is something to clear. A native color
                  input has no "unset" - it always reports a hex - so returning
                  an entry to the page's palette needs its own control.
                */}
                {color !== null && (
                  <IconButton
                    label={`Use the site's color for ${name || `series ${index + 1}`}`}
                    variant="ghost"
                    size="S"
                    disabled={disabled}
                    onClick={() => onChange(index, null)}
                  >
                    <Cross />
                  </IconButton>
                )}
              </Flex>
            </Field.Root>
          );
        })}
      </Flex>
    </Box>
  );
}
