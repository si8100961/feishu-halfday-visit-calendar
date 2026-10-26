import { dateKey, shiftDate, weekDates } from './domain.mjs';

// Business dates keep using Shanghai, just like stored visit timestamps.
// The default/current-week view follows midnight; deliberate browsing does not.
export class CalendarNavigation {
  constructor(now = Date.now()) {
    this.today = dateKey(now); this.anchor = this.today; this.followToday = true;
  }
  sync(now = Date.now()) {
    const today = dateKey(now);
    if (today === this.today) return false;
    this.today = today;
    if (this.followToday) this.anchor = today;
    return true;
  }
  current(now = Date.now()) { this.today = dateKey(now); this.anchor = this.today; this.followToday = true; }
  move(date) { this.anchor = date; this.followToday = false; }
  shift(days) { this.move(shiftDate(this.anchor, days)); }
  saved(date, now = Date.now()) {
    this.today = dateKey(now);
    this.followToday = this.followToday && weekDates(date)[0] === weekDates(this.today)[0];
    this.anchor = date;
  }
}
