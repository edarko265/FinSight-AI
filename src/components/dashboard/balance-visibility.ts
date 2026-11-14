/** Whether the compact balance belongs in the header while the dashboard card is off screen. */
export function showHeaderBalance(dashboardBalanceVisible: boolean): boolean {
  return !dashboardBalanceVisible;
}
