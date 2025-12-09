import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';

export function filterValidDates<T>(
  query: PostgrestFilterBuilder<any, any, T[]>
): PostgrestFilterBuilder<any, any, T[]> {
  return query.not('order_date', 'is', null);
}

export function filterValidDatesOrDefaultPeriod<T>(
  query: PostgrestFilterBuilder<any, any, T[]>
): PostgrestFilterBuilder<any, any, T[]> {
  return query.or('order_date.not.is.null,default_period.not.is.null');
}
