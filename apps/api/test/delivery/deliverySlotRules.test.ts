import assert from 'node:assert/strict';
import test from 'node:test';
import type { DeliverySummary } from '@shop/contracts/delivery';
import {
  DELIVERY_SLOT_HORIZON_BUSINESS_DAYS,
  FREIGHT_BASE_LEAD_TIME_BUSINESS_DAYS,
  FREIGHT_HEAVY_LEAD_TIME_EXTRA_BUSINESS_DAYS,
  FREIGHT_HEAVY_WEIGHT_THRESHOLD_GRAMS,
  PARCEL_LEAD_TIME_BUSINESS_DAYS,
} from '@shop/contracts/delivery';
import {
  calculateLeadTime,
  isSlotBookable,
  listBookableSlots,
} from '../../src/features/delivery/deliverySlotRules.js';

/** 2026-07-20 is a Monday; 2026-07-24 is a Friday. Both midday UTC. */
const MONDAY = new Date('2026-07-20T12:00:00.000Z');
const FRIDAY = new Date('2026-07-24T12:00:00.000Z');

function freight(weightGrams: number): Pick<DeliverySummary, 'mode' | 'weightGrams'> {
  return { mode: 'freight', weightGrams };
}

function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

void test('delivery slot rules', async (t) => {
  await t.test('parcel uses the parcel ladder step', () => {
    const leadTime = calculateLeadTime({
      deliverySummary: { mode: 'parcel', weightGrams: 5_000 },
      now: MONDAY,
    });
    assert.equal(leadTime.businessDays, PARCEL_LEAD_TIME_BUSINESS_DAYS);
    assert.equal(leadTime.earliestDate, '2026-07-21');
  });

  await t.test('freight below the heavy threshold uses the base step', () => {
    const leadTime = calculateLeadTime({
      deliverySummary: freight(FREIGHT_HEAVY_WEIGHT_THRESHOLD_GRAMS - 1),
      now: MONDAY,
    });
    assert.equal(leadTime.businessDays, FREIGHT_BASE_LEAD_TIME_BUSINESS_DAYS);
    assert.equal(leadTime.earliestDate, '2026-07-23');
  });

  await t.test('freight at exactly the heavy threshold takes the heavy step', () => {
    const leadTime = calculateLeadTime({
      deliverySummary: freight(FREIGHT_HEAVY_WEIGHT_THRESHOLD_GRAMS),
      now: MONDAY,
    });
    assert.equal(
      leadTime.businessDays,
      FREIGHT_BASE_LEAD_TIME_BUSINESS_DAYS + FREIGHT_HEAVY_LEAD_TIME_EXTRA_BUSINESS_DAYS,
    );
    assert.equal(leadTime.earliestDate, '2026-07-27');
  });

  await t.test('reason is plain buyer-readable text without markup', () => {
    for (const summary of [
      { mode: 'parcel', weightGrams: 1 } as const,
      freight(500_000),
      freight(FREIGHT_HEAVY_WEIGHT_THRESHOLD_GRAMS),
    ]) {
      const { reason } = calculateLeadTime({ deliverySummary: summary, now: MONDAY });
      assert.ok(reason.length > 0 && reason.length <= 500);
      assert.ok(!/[<>]/.test(reason));
      assert.ok(!/grams|threshold|freight class|business days/i.test(reason));
    }
  });

  await t.test('weekend is skipped when counting from a Friday', () => {
    // Friday + 3 business days -> Mon, Tue, Wed.
    const leadTime = calculateLeadTime({ deliverySummary: freight(200_000), now: FRIDAY });
    assert.equal(leadTime.earliestDate, '2026-07-29');
    assert.equal(weekdayOf(leadTime.earliestDate), 3);
  });

  await t.test('slot list never contains a weekend date', () => {
    const leadTime = calculateLeadTime({ deliverySummary: freight(200_000), now: FRIDAY });
    const slots = listBookableSlots({ leadTime, now: FRIDAY });
    for (const slot of slots) {
      const weekday = weekdayOf(slot.date);
      assert.notEqual(weekday, 0);
      assert.notEqual(weekday, 6);
    }
  });

  await t.test('slot list spans the horizon inclusively with am and pm per day', () => {
    const leadTime = calculateLeadTime({ deliverySummary: freight(200_000), now: MONDAY });
    const slots = listBookableSlots({ leadTime, now: MONDAY });

    const dates = [...new Set(slots.map((slot) => slot.date))];
    assert.equal(dates.length, DELIVERY_SLOT_HORIZON_BUSINESS_DAYS);
    assert.equal(slots.length, DELIVERY_SLOT_HORIZON_BUSINESS_DAYS * 2);

    // earliest-date and horizon-last-day boundaries are both inclusive
    assert.equal(dates[0], leadTime.earliestDate);
    assert.equal(dates[dates.length - 1], leadTime.latestDate);

    // ascending, am before pm within a day
    const sorted = [...slots].sort((a, b) =>
      a.date === b.date ? a.window.localeCompare(b.window) : a.date.localeCompare(b.date),
    );
    assert.deepEqual(slots, sorted);
  });

  await t.test('repeat calls at one fixed instant are identical', () => {
    const leadTime = calculateLeadTime({ deliverySummary: freight(200_000), now: MONDAY });
    const first = listBookableSlots({ leadTime, now: MONDAY });
    const second = listBookableSlots({ leadTime, now: MONDAY });
    assert.deepEqual(first, second);
    assert.deepEqual(
      calculateLeadTime({ deliverySummary: freight(200_000), now: MONDAY }),
      leadTime,
    );
  });

  await t.test('drift guard: every generated slot re-validates as bookable', () => {
    for (const now of [MONDAY, FRIDAY]) {
      for (const summary of [
        { mode: 'parcel', weightGrams: 1 } as const,
        freight(200_000),
        freight(FREIGHT_HEAVY_WEIGHT_THRESHOLD_GRAMS),
      ]) {
        const leadTime = calculateLeadTime({ deliverySummary: summary, now });
        const slots = listBookableSlots({ leadTime, now });
        assert.ok(slots.length > 0);
        for (const slot of slots) {
          assert.equal(isSlotBookable(slot, leadTime, now), true);
        }
      }
    }
  });

  await t.test('isSlotBookable rejects out-of-range, weekend, past, and unknown input', () => {
    const leadTime = calculateLeadTime({ deliverySummary: freight(200_000), now: MONDAY });

    // day before earliest
    assert.equal(isSlotBookable({ date: '2026-07-22', window: 'am' }, leadTime, MONDAY), false);
    // earliest itself is inclusive
    assert.equal(
      isSlotBookable({ date: leadTime.earliestDate, window: 'am' }, leadTime, MONDAY),
      true,
    );
    // horizon last day is inclusive, day after is not
    assert.equal(
      isSlotBookable({ date: leadTime.latestDate, window: 'pm' }, leadTime, MONDAY),
      true,
    );
    const afterHorizon = new Date(`${leadTime.latestDate}T00:00:00.000Z`);
    afterHorizon.setUTCDate(afterHorizon.getUTCDate() + 3);
    assert.equal(
      isSlotBookable(
        { date: afterHorizon.toISOString().slice(0, 10), window: 'am' },
        leadTime,
        MONDAY,
      ),
      false,
    );
    // weekend inside the range
    assert.equal(isSlotBookable({ date: '2026-07-25', window: 'am' }, leadTime, MONDAY), false);
    // malformed and impossible dates
    assert.equal(isSlotBookable({ date: '2026-7-23', window: 'am' }, leadTime, MONDAY), false);
    assert.equal(isSlotBookable({ date: '2026-02-30', window: 'am' }, leadTime, MONDAY), false);
    // unknown window reaching the predicate from an untrusted payload
    assert.equal(
      isSlotBookable(
        { date: leadTime.earliestDate, window: 'evening' as unknown as 'am' },
        leadTime,
        MONDAY,
      ),
      false,
    );
  });

  await t.test('year boundary: the range crosses into the next calendar year', () => {
    // 2026-12-31 is a Thursday. Freight base = 3 working days: Fri 01-01, Mon 01-04, Tue 01-05.
    const now = new Date('2026-12-31T12:00:00.000Z');
    const leadTime = calculateLeadTime({ deliverySummary: freight(200_000), now });

    assert.equal(leadTime.earliestDate, '2027-01-05');
    assert.equal(weekdayOf(leadTime.earliestDate), 2);
    // 14 further working days closes the inclusive horizon on Monday 2027-01-25.
    assert.equal(leadTime.latestDate, '2027-01-25');
    assert.equal(weekdayOf(leadTime.latestDate), 1);

    const slots = listBookableSlots({ leadTime, now });
    const dates = [...new Set(slots.map((slot) => slot.date))];
    assert.equal(dates.length, DELIVERY_SLOT_HORIZON_BUSINESS_DAYS);
    assert.ok(dates.some((date) => date.startsWith('2026-')) === false);
    for (const slot of slots) assert.equal(isSlotBookable(slot, leadTime, now), true);
  });

  await t.test('month rollover across a leap day is counted as a real business day', () => {
    // 2028-02-25 is a Friday and 2028 is a leap year, so 2028-02-29 (Tuesday) exists.
    const now = new Date('2028-02-25T12:00:00.000Z');
    const leadTime = calculateLeadTime({ deliverySummary: freight(200_000), now });

    // Mon 02-28, Tue 02-29, Wed 03-01: the leap day is consumed as a working day.
    assert.equal(leadTime.earliestDate, '2028-03-01');
    assert.equal(leadTime.latestDate, '2028-03-21');

    // A parcel lands before the leap day, so 02-29 falls inside its bookable range.
    const parcelLeadTime = calculateLeadTime({
      deliverySummary: { mode: 'parcel', weightGrams: 1 },
      now,
    });
    assert.equal(parcelLeadTime.earliestDate, '2028-02-28');
    assert.equal(parcelLeadTime.latestDate, '2028-03-17');
    assert.equal(isSlotBookable({ date: '2028-02-29', window: 'am' }, parcelLeadTime, now), true);
    assert.ok(
      listBookableSlots({ leadTime: parcelLeadTime, now }).some(
        (slot) => slot.date === '2028-02-29',
      ),
    );
    // The same day number in a non-leap year is not a real date and must be refused.
    assert.equal(isSlotBookable({ date: '2027-02-29', window: 'am' }, parcelLeadTime, now), false);
  });

  await t.test('an order placed on a Saturday never earns a weekend earliest date', () => {
    const saturday = new Date('2026-07-25T12:00:00.000Z');
    assert.equal(weekdayOf('2026-07-25'), 6);

    for (const summary of [
      { mode: 'parcel', weightGrams: 1 } as const,
      freight(200_000),
      freight(FREIGHT_HEAVY_WEIGHT_THRESHOLD_GRAMS),
    ]) {
      const leadTime = calculateLeadTime({ deliverySummary: summary, now: saturday });
      const earliestWeekday = weekdayOf(leadTime.earliestDate);
      assert.notEqual(earliestWeekday, 0);
      assert.notEqual(earliestWeekday, 6);
      assert.ok(leadTime.earliestDate > '2026-07-25');
    }

    // Saturday snaps to Monday 07-27 before the ladder is counted: Tue, Wed, Thu.
    const freightLeadTime = calculateLeadTime({
      deliverySummary: freight(200_000),
      now: saturday,
    });
    assert.equal(freightLeadTime.earliestDate, '2026-07-30');
  });

  await t.test(
    'bidirectional drift: the predicate accepts exactly what the generator emits',
    () => {
      const padDays = 4;

      for (const now of [MONDAY, FRIDAY, new Date('2026-12-31T12:00:00.000Z')]) {
        for (const summary of [
          { mode: 'parcel', weightGrams: 1 } as const,
          freight(200_000),
          freight(FREIGHT_HEAVY_WEIGHT_THRESHOLD_GRAMS),
        ]) {
          const leadTime = calculateLeadTime({ deliverySummary: summary, now });
          const emitted = new Set(
            listBookableSlots({ leadTime, now }).map((slot) => `${slot.date}|${slot.window}`),
          );
          assert.ok(emitted.size > 0);

          const scanStart = new Date(`${leadTime.earliestDate}T00:00:00.000Z`);
          scanStart.setUTCDate(scanStart.getUTCDate() - padDays);
          const scanEnd = new Date(`${leadTime.latestDate}T00:00:00.000Z`);
          scanEnd.setUTCDate(scanEnd.getUTCDate() + padDays);

          let withheldBelow = 0;
          let withheldAbove = 0;
          for (
            const cursor = new Date(scanStart);
            cursor <= scanEnd;
            cursor.setUTCDate(cursor.getUTCDate() + 1)
          ) {
            const date = cursor.toISOString().slice(0, 10);
            for (const window of ['am', 'pm'] as const) {
              const expected = emitted.has(`${date}|${window}`);
              assert.equal(
                isSlotBookable({ date, window }, leadTime, now),
                expected,
                `${date} ${window} should be ${expected ? 'bookable' : 'refused'}`,
              );
              if (expected) continue;
              if (date < leadTime.earliestDate) withheldBelow += 1;
              if (date > leadTime.latestDate) withheldAbove += 1;
            }
          }

          // Proves the scan actually straddled both edges rather than only hitting slots.
          assert.ok(withheldBelow > 0);
          assert.ok(withheldAbove > 0);
        }
      }
    },
  );

  await t.test('a slot that has fallen into the past is rejected on re-validation', () => {
    const leadTime = calculateLeadTime({ deliverySummary: freight(200_000), now: MONDAY });
    const slot = { date: leadTime.earliestDate, window: 'am' } as const;
    assert.equal(isSlotBookable(slot, leadTime, MONDAY), true);

    // Same lead time replayed a fortnight later: the booked date is now history.
    const later = new Date('2026-08-10T09:00:00.000Z');
    assert.equal(isSlotBookable(slot, leadTime, later), false);
  });
});
