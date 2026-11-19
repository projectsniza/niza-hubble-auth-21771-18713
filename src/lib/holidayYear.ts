// Holiday year runs 1 April to 31 March. These helpers work out the current one from today's date
// so nothing needs editing each April.

/** "YYYY-04-01" of the holiday year that contains `today`. */
export function currentHolidayYearStart(today: Date = new Date()): string {
  const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `${year}-04-01`;
}

export function holidayYearLabel(start: string): string {
  const y = parseInt(start.slice(0, 4), 10);
  const mon = (yr: number, m: string) => `${m} ${yr}`;
  return `${mon(y, 'Apr')} - ${mon(y + 1, 'Mar')}`;
}

/** Previous year, the current one and the next one, newest last. */
export function holidayYearOptions(today: Date = new Date()): { value: string; label: string }[] {
  const current = parseInt(currentHolidayYearStart(today).slice(0, 4), 10);
  return [current - 2, current - 1, current, current + 1].map((y) => {
    const value = `${y}-04-01`;
    return { value, label: holidayYearLabel(value) };
  });
}
