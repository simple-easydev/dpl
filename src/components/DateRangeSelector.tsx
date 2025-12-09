import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { DateRange } from './PeriodSelector';
import { startOfMonth, endOfMonth, format, subMonths } from 'date-fns';

interface DateRangeSelectorProps {
  selectedPeriod: DateRange | null;
  onPeriodChange: (period: DateRange) => void;
  label: string;
}

export default function DateRangeSelector({
  selectedPeriod,
  onPeriodChange,
  label,
}: DateRangeSelectorProps) {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString().padStart(2, '0'));

  const years = Array.from({ length: 10 }, (_, i) => currentDate.getFullYear() - i);
  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  const handleApply = () => {
    if (selectedYear && selectedMonth) {
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth) - 1;
      const date = new Date(year, month, 1);

      const startDate = startOfMonth(date);
      const endDate = endOfMonth(date);
      const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';
      const label = `${monthLabel} ${year}`;

      onPeriodChange({
        startDate,
        endDate,
        label,
      });
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
        {label}
      </label>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleApply}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium flex items-center justify-center gap-2"
        >
          <Calendar className="w-4 h-4" />
          Apply Period
        </button>

        {selectedPeriod && (
          <div className="text-sm text-gray-600 dark:text-zinc-400 text-center">
            Selected: <span className="font-medium text-gray-900 dark:text-white">{selectedPeriod.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
