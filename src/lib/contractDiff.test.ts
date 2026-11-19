// @ts-expect-error Bun supplies this module when focused tests are run.
import { describe, expect, test } from 'bun:test';
import { diffContract, formatLogValue } from './contractDiff';

describe('diffContract', () => {
  test('lists only fields that changed', () => {
    const changes = diffContract(
      { job_title: 'Cashier', salary_rate: '12.50', place_of_work: 'Shop' },
      { job_title: 'Supervisor', salary_rate: '12.50', place_of_work: 'Shop' }
    );
    expect(changes).toEqual([{ field: 'job_title', oldValue: 'Cashier', newValue: 'Supervisor' }]);
  });
  test('blank and missing are the same, number and text are the same', () => {
    expect(diffContract({ hours_per_week: 40 }, { hours_per_week: '40', vat_number: '' })).toEqual([]);
  });
  test('a filled-in value that was missing is a change', () => {
    expect(diffContract({}, { vat_number: 'GB123' })).toHaveLength(1);
  });
  test('log values are short and readable', () => {
    expect(formatLogValue(null)).toBe('(empty)');
    expect(formatLogValue('x'.repeat(100)).length).toBeLessThanOrEqual(58);
  });
});
