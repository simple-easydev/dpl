import { supabase } from './supabase';
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns';

export interface AvailableMonth {
  year: number;
  month: number;
  label: string;
  startDate: Date;
  endDate: Date;
  orderCount: number;
  totalRevenue: number;
}

export async function getAvailableMonths(organizationId: string): Promise<AvailableMonth[]> {
  const { data: salesData, error } = await supabase
    .from('sales_data')
    .select('order_date, revenue')
    .eq('organization_id', organizationId)
    .order('order_date', { ascending: false });

  if (error || !salesData || salesData.length === 0) {
    return [];
  }

  const monthMap = new Map<string, { orderCount: number; totalRevenue: number }>();

  salesData.forEach(sale => {
    const date = parseISO(sale.order_date);
    const monthKey = format(date, 'yyyy-MM');

    const existing = monthMap.get(monthKey) || { orderCount: 0, totalRevenue: 0 };
    existing.orderCount += 1;
    existing.totalRevenue += Number(sale.revenue || 0);
    monthMap.set(monthKey, existing);
  });

  const months: AvailableMonth[] = Array.from(monthMap.entries())
    .map(([monthKey, stats]) => {
      const [year, month] = monthKey.split('-').map(Number);
      const date = new Date(year, month - 1, 1);

      return {
        year,
        month,
        label: format(date, 'MMMM yyyy'),
        startDate: startOfMonth(date),
        endDate: endOfMonth(date),
        orderCount: stats.orderCount,
        totalRevenue: stats.totalRevenue,
      };
    })
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

  return months;
}

export async function getAvailableMonthsAllBrands(): Promise<AvailableMonth[]> {
  const { data: salesData, error } = await supabase
    .from('sales_data')
    .select('order_date, revenue')
    .order('order_date', { ascending: false });

  if (error || !salesData || salesData.length === 0) {
    return [];
  }

  const monthMap = new Map<string, { orderCount: number; totalRevenue: number }>();

  salesData.forEach(sale => {
    const date = parseISO(sale.order_date);
    const monthKey = format(date, 'yyyy-MM');

    const existing = monthMap.get(monthKey) || { orderCount: 0, totalRevenue: 0 };
    existing.orderCount += 1;
    existing.totalRevenue += Number(sale.revenue || 0);
    monthMap.set(monthKey, existing);
  });

  const months: AvailableMonth[] = Array.from(monthMap.entries())
    .map(([monthKey, stats]) => {
      const [year, month] = monthKey.split('-').map(Number);
      const date = new Date(year, month - 1, 1);

      return {
        year,
        month,
        label: format(date, 'MMMM yyyy'),
        startDate: startOfMonth(date),
        endDate: endOfMonth(date),
        orderCount: stats.orderCount,
        totalRevenue: stats.totalRevenue,
      };
    })
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

  return months;
}

export function groupMonthsByYear(months: AvailableMonth[]): Map<number, AvailableMonth[]> {
  const yearMap = new Map<number, AvailableMonth[]>();

  months.forEach(month => {
    const existing = yearMap.get(month.year) || [];
    existing.push(month);
    yearMap.set(month.year, existing);
  });

  return yearMap;
}
