import { Period } from '../types';

export type PeriodScheduleState = 'LIVE' | 'LUNCH' | 'PRE_COLLEGE' | 'CONCLUDED' | 'BREAK';

export interface PeriodScheduleStatus {
  state: PeriodScheduleState;
  activePeriod: Period | null;
  nextPeriod: Period | null;
  displayLabel: string;
  badgeLabel: string;
  badgeType: 'live' | 'lunch' | 'upcoming' | 'concluded' | 'break';
  isLive: boolean;
}

/**
 * Calculates current real-time period schedule state based on active period definitions.
 * Handles live classes, lunch break (12:50-13:30), pre-college morning hours, and post-college concluded hours.
 */
export function getPeriodScheduleStatus(periods: Period[], customDate: Date = new Date()): PeriodScheduleStatus {
  if (!periods || periods.length === 0) {
    return {
      state: 'CONCLUDED',
      activePeriod: null,
      nextPeriod: null,
      displayLabel: 'Schedule Unavailable',
      badgeLabel: 'Offline',
      badgeType: 'concluded',
      isLive: false,
    };
  }

  const activePeriods = periods
    .filter((p) => p.active === 1)
    .sort((a, b) => a.period_number - b.period_number);

  if (activePeriods.length === 0) {
    return {
      state: 'CONCLUDED',
      activePeriod: null,
      nextPeriod: null,
      displayLabel: 'Classes Inactive',
      badgeLabel: 'Inactive',
      badgeType: 'concluded',
      isLive: false,
    };
  }

  const curMinutes = `${String(customDate.getHours()).padStart(2, '0')}:${String(
    customDate.getMinutes()
  ).padStart(2, '0')}`;

  // 1. Check if currently inside an active period slot
  const currentLive = activePeriods.find(
    (p) => p.start_time <= curMinutes && curMinutes < p.end_time
  );

  if (currentLive) {
    const next = activePeriods.find((p) => p.period_number === currentLive.period_number + 1) || null;
    return {
      state: 'LIVE',
      activePeriod: currentLive,
      nextPeriod: next,
      displayLabel: `Period ${currentLive.period_number} (${currentLive.start_time} - ${currentLive.end_time})`,
      badgeLabel: `Period ${currentLive.period_number} • LIVE`,
      badgeType: 'live',
      isLive: true,
    };
  }

  // 2. Check Lunch Break (between Period 4 and Period 5)
  const p4 = activePeriods.find((p) => p.period_number === 4);
  const p5 = activePeriods.find((p) => p.period_number === 5);
  const lunchStart = p4?.end_time || '12:50';
  const lunchEnd = p5?.start_time || '13:30';

  if (curMinutes >= lunchStart && curMinutes < lunchEnd) {
    return {
      state: 'LUNCH',
      activePeriod: null,
      nextPeriod: p5 || null,
      displayLabel: `Lunch Break (${lunchStart} - ${lunchEnd})`,
      badgeLabel: `Lunch Break (${lunchStart} - ${lunchEnd})`,
      badgeType: 'lunch',
      isLive: false,
    };
  }

  // 3. Check Pre-College morning hours (before Period 1)
  const firstPeriod = activePeriods[0];
  if (firstPeriod && curMinutes < firstPeriod.start_time) {
    return {
      state: 'PRE_COLLEGE',
      activePeriod: null,
      nextPeriod: firstPeriod,
      displayLabel: `Upcoming: Period ${firstPeriod.period_number} (${firstPeriod.start_time} - ${firstPeriod.end_time})`,
      badgeLabel: `Next: Period ${firstPeriod.period_number} (${firstPeriod.start_time})`,
      badgeType: 'upcoming',
      isLive: false,
    };
  }

  // 4. Check Post-College concluded hours (after last period)
  const lastPeriod = activePeriods[activePeriods.length - 1];
  if (lastPeriod && curMinutes >= lastPeriod.end_time) {
    return {
      state: 'CONCLUDED',
      activePeriod: null,
      nextPeriod: null,
      displayLabel: `Classes Concluded for Today (${activePeriods.length} Periods Completed)`,
      badgeLabel: 'Classes Concluded',
      badgeType: 'concluded',
      isLive: false,
    };
  }

  // 5. Inter-period gap/break
  const nextUpcoming = activePeriods.find((p) => p.start_time > curMinutes) || null;
  return {
    state: 'BREAK',
    activePeriod: null,
    nextPeriod: nextUpcoming,
    displayLabel: nextUpcoming
      ? `Inter-Period Break • Next: Period ${nextUpcoming.period_number} (${nextUpcoming.start_time})`
      : 'Class Break',
    badgeLabel: nextUpcoming ? `Next: Period ${nextUpcoming.period_number} (${nextUpcoming.start_time})` : 'Class Break',
    badgeType: 'break',
    isLive: false,
  };
}
