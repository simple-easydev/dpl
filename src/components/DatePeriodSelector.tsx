import { useState, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';

interface DatePeriodSelectorProps {
  onConfirm: (period: string) => void;
  onSkip: () => void;
  recordCount: number;
  suggestedPeriod?: string | null;
}

export default function DatePeriodSelector({ onConfirm, onSkip, recordCount, suggestedPeriod }: DatePeriodSelectorProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState('');

  // Pre-populate from suggested period if available
  useEffect(() => {
    if (suggestedPeriod) {
      const [year, month] = suggestedPeriod.split('-');
      if (year && month) {
        setSelectedYear(year);
        setSelectedMonth(month);
        console.log(`✨ Pre-populated date selector with: ${year}-${month}`);
      }
    }
  }, [suggestedPeriod]);

  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
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

  const handleConfirm = () => {
    if (selectedYear && selectedMonth) {
      const period = `${selectedYear}-${selectedMonth}`;
      onConfirm(period);
    }
  };

  const isValid = selectedYear && selectedMonth;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-blue rounded-xl p-2 shadow-glow-blue">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Assign Default Period
              </h2>
              <p className="text-sm text-gray-600 dark:text-zinc-400 mt-0.5">
                {recordCount} records without dates
              </p>
            </div>
          </div>
          <button
            onClick={onSkip}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">
              This file doesn't include specific dates for each record. Select a default month and year
              to assign to all {recordCount} records. This helps organize your depletion data by time period.
            </p>
            {suggestedPeriod && (
              <p className="text-sm text-green-700 dark:text-green-300 mt-3 font-medium">
                ✨ Period detected from filename and pre-populated below
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent outline-none"
              >
                <option value="">-- Select Month --</option>
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-white/10 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent outline-none"
              >
                <option value="">-- Select Year --</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {isValid && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30 rounded-lg p-3">
                <p className="text-sm text-green-800 dark:text-green-300">
                  All records will be assigned to:{' '}
                  <span className="font-semibold">
                    {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-between">
          <button
            onClick={onSkip}
            className="px-4 py-2 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition text-sm"
          >
            Skip (Leave Undated)
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid}
            className="px-6 py-2 bg-blue-600 dark:bg-accent-primary text-white rounded-lg hover:bg-blue-700 dark:hover:bg-accent-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            Assign Period
          </button>
        </div>
      </div>
    </div>
  );
}
