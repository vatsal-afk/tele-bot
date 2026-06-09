import type { TimetableSlot } from '../db/index.js';

/**
 * Default IITR class schedule used when a user has not uploaded their timetable.
 * Applies Mon–Fri (days 0–4 in our 0=Mon scheme).
 * Times represent typical transition windows when students walk between buildings.
 */
export const IITR_DEFAULT_SLOTS: Omit<TimetableSlot, 'dayOfWeek'>[] = [
  { startTime: '08:00', endTime: '09:00', location: 'Lecture Hall Complex', description: 'Morning lecture' },
  { startTime: '09:00', endTime: '10:00', location: 'Lecture Hall Complex', description: 'Second lecture' },
  { startTime: '11:00', endTime: '12:00', location: 'Lecture Hall Complex', description: 'Late morning lecture' },
  { startTime: '14:00', endTime: '15:00', location: 'Lecture Hall Complex', description: 'Afternoon lecture' },
  { startTime: '15:00', endTime: '17:00', location: 'Laboratories', description: 'Lab session' },
];

/** Day index in our timetable: 0=Mon, 1=Tue, ..., 6=Sun */
export function getTodayIndex(): number {
  const jsDay = new Date().getDay(); // 0=Sun
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * Returns true if the current time is within 15 min BEFORE a slot starts,
 * meaning the user is likely transitioning between locations.
 */
export function isUserInTransition(slots: TimetableSlot[], now: Date): boolean {
  const todayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const todaySlots = slots.filter(s => s.dayOfWeek === todayIdx);

  const currentMins = now.getHours() * 60 + now.getMinutes();

  return todaySlots.some(slot => {
    const [h, m] = slot.startTime.split(':').map(Number);
    const slotStartMins = h * 60 + m;
    // Within 15 min before class start = transition window
    return currentMins >= slotStartMins - 15 && currentMins <= slotStartMins + 5;
  });
}

/**
 * Returns the location of the next upcoming slot today, or null if none.
 */
export function getNextLocation(slots: TimetableSlot[], now: Date): string | null {
  const todayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const todaySlots = slots
    .filter(s => s.dayOfWeek === todayIdx)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const currentMins = now.getHours() * 60 + now.getMinutes();

  for (const slot of todaySlots) {
    const [h, m] = slot.startTime.split(':').map(Number);
    const slotStartMins = h * 60 + m;
    if (slotStartMins > currentMins) {
      return slot.location;
    }
  }
  return null;
}

/**
 * Build full slot list: user's personal timetable OR default IITR slots
 * expanded for all weekdays (Mon–Fri).
 */
export function buildEffectiveSlots(userSlots: TimetableSlot[]): TimetableSlot[] {
  if (userSlots.length > 0) return userSlots;

  // Expand defaults to Mon–Fri
  const expanded: TimetableSlot[] = [];
  for (let day = 0; day <= 4; day++) { // 0=Mon ... 4=Fri
    for (const s of IITR_DEFAULT_SLOTS) {
      expanded.push({ dayOfWeek: day, ...s });
    }
  }
  return expanded;
}

/**
 * Parse free-text timetable input from the user into TimetableSlot objects.
 * Handles patterns like:
 *   "Monday 9am-11am ECE Block, lab"
 *   "Mon 14:00-15:30 LH2 Data Structures"
 *   "everyday 8-9 LHC lecture" → expands to all weekdays
 */
export function parseTimetableText(text: string): TimetableSlot[] {
  const slots: TimetableSlot[] = [];

  const DAY_MAP: Record<string, number[]> = {
    'monday': [0], 'mon': [0],
    'tuesday': [1], 'tue': [1],
    'wednesday': [2], 'wed': [2],
    'thursday': [3], 'thu': [3],
    'friday': [4], 'fri': [4],
    'saturday': [5], 'sat': [5],
    'sunday': [6], 'sun': [6],
    'everyday': [0,1,2,3,4,5,6],
    'weekday': [0,1,2,3,4],
    'weekdays': [0,1,2,3,4],
  };

  // Split input by newlines or semicolons
  const lines = text.split(/[\n;]+/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Find day(s)
    let days: number[] | null = null;
    let rest = line;
    for (const [key, val] of Object.entries(DAY_MAP)) {
      if (lower.startsWith(key)) {
        days = val;
        rest = line.slice(key.length).trim();
        break;
      }
    }
    if (!days) continue;

    // Find time range: 9am-11am, 14:00-15:30, 9-11, 9:30-11
    const timeMatch = rest.match(/(\d{1,2}(?::\d{2})?(?:am|pm)?)\s*[-–to]+\s*(\d{1,2}(?::\d{2})?(?:am|pm)?)/i);
    if (!timeMatch) continue;

    const parseTime = (t: string): string => {
      const isPM = /pm/i.test(t);
      const isAM = /am/i.test(t);
      t = t.replace(/[apm]/gi, '');
      const [hStr, mStr = '0'] = t.split(':');
      let h = parseInt(hStr);
      if (isPM && h < 12) h += 12;
      if (isAM && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${String(parseInt(mStr)).padStart(2, '0')}`;
    };

    const startTime = parseTime(timeMatch[1]);
    const endTime = parseTime(timeMatch[2]);

    // Rest is location + description
    const afterTime = rest.slice(timeMatch.index! + timeMatch[0].length).trim();
    const [locationRaw, ...descParts] = afterTime.split(',');
    const location = locationRaw.trim() || 'Campus';
    const description = descParts.join(',').trim() || 'Class';

    for (const day of days) {
      slots.push({ dayOfWeek: day, startTime, endTime, location, description });
    }
  }

  return slots;
}
