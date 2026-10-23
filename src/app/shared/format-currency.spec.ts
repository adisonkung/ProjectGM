import { formatCurrency } from './format-currency';

describe('currency display', () => {
  it('keeps small balances exact and abbreviates large balances without overstating them', () => {
    for (const [value, expected] of [[0,'0'],[1,'1'],[100,'100'],[1000,'1,000'],[10000,'10,000'],[99999,'99,999'],[100000,'100k'],[100099,'100k'],[999999,'999.9k'],[1000000,'1m'],[1299999,'1.2m'],[1000000000,'1b']] as const) {
      expect(formatCurrency(value)).withContext(String(value)).toBe(expected);
    }
  });
});
