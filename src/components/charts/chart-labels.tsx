"use client";

import { createContext, useContext } from "react";

const ChartLabels = createContext(true);

/** Set to false to draw charts without their axis and tile text, e.g. on dashboard widgets. */
export const ChartLabelsProvider = ChartLabels.Provider;

export function useChartLabels(): boolean {
  return useContext(ChartLabels);
}
