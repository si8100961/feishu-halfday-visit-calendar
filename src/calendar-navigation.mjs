import { dateKey, shiftDate, weekDates } from './domain.mjs';

// Business dates keep using Shanghai, just like stored visit timestamps.
// Sunday opens the coming Monday's week. Explicit browsing still takes priority.
function defaultAnchor(today) { return today === weekDates(today)[6] ? shiftDate(today, 1) : today; }
export class CalendarNavigation {
  constructor(now = Date.now()) {
    this.today = dateKey(now); this.anchor = defaultAnchor(this.today); this.followToday = true;
  }
  sync(now = Date.now()) {
    const today = dateKey(now);
    if (today === this.today) return false;
    this.today = today;
    if (this.followToday) this.anchor = defaultAnchor(today);
    return true;
  }
  // The explicit "This week" button remains literal, allowing Sunday visits to be viewed.
  current(now = Date.now()) { this.today = dateKey(now); this.anchor = this.today; this.followToday = this.today === defaultAnchor(this.today); }
  move(date) { this.anchor = date; this.followToday = false; }
  shift(days) { this.move(shiftDate(this.anchor, days)); }
  saved(date, now = Date.now()) {
    this.today = dateKey(now);
    this.followToday = this.followToday && weekDates(date)[0] === weekDates(defaultAnchor(this.today))[0];
    this.anchor = date;
  }
}
