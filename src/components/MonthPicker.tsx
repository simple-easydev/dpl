import { useState, useEffect } from 'react';
import { Calendar, ArrowLeftRight, Check } from 'lucide-react';
import { format, isBefore } from 'date-fns';
import { AvailableMonth, getAvailableMonths, groupMonthsByYear } from '../lib/monthUtils';
import { useOrganization } from '../contexts/OrganizationContext';
import { DateRange } from './PeriodSelector';

interface MonthPickerProps {
  onApply: (period1: DateRange, period2: DateRange) => void;
  onCancel: () => void;
}

export default function MonthPicker({ onApply, onCancel }: MonthPickerProps) {
  const { currentOrganization } = useOrganization();
  const [availableMonths, setAvailableMonths] = useState<AvailableMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth1, setSelectedMonth1] = useState<AvailableMonth | null>(null);
  const [selectedMonth2, setSelectedMonth2] = useState<AvailableMonth | null>(null);
  const [selectedYear1, setSelectedYear1] = useState<number | null>(null);
  const [selectedYear2, setSelectedYear2] = useState<number | null>(null);

  useEffect(() => {
    const fetchMonths = async () => {
      if (!currentOrganization) return;

      setLoading(true);
      const months = await getAvailableMonths(currentOrganization.id);
      setAvailableMonths(months);

      if (months.length > 0) {
        const latestYear = months[0].year;
        setSelectedYear1(latestYear);
        setSelectedYear2(latestYear);

        if (months.length >= 2) {
          setSelectedMonth1(months[0]);
          setSelectedMonth2(months[1]);
        } else if (months.length === 1) {
          setSelectedMonth1(months[0]);
        }
      }

      setLoading(false);
    };

    fetchMonths();
  }, [currentOrganization]);

  const monthsByYear = groupMonthsByYear(availableMonths);
  const availableYears = Array.from(monthsByYear.keys()).sort((a, b) => b - a);

  const getMonthsForYear = (year: number | null): AvailableMonth[] => {
    if (!year) return [];
    return monthsByYear.get(year) || [];
  };

  const handleSwap = () => {
    const temp1 = selectedMonth1;
    const tempYear1 = selectedYear1;
    setSelectedMonth1(selectedMonth2);
    setSelectedYear1(selectedYear2);
    setSelectedMonth2(temp1);
    setSelectedYear2(tempYear1);
  };

  const handleApply = () => {
    if (!selectedMonth1 || !selectedMonth2) return;

    const period1: DateRange = {
      startDate: selectedMonth1.startDate,
      endDate: selectedMonth1.endDate,
      label: selectedMonth1.label,
    };

    const period2: DateRange = {
      startDate: selectedMonth2.startDate,
      endDate: selectedMonth2.endDate,
      label: selectedMonth2.label,
    };

    const isPeriod1Earlier = isBefore(period1.startDate, period2.startDate);
    const earlierPeriod = isPeriod1Earlier ? period1 : period2;
    const laterPeriod = isPeriod1Earlier ? period2 : period1;

    onApply(laterPeriod, earlierPeriod);
  };

  const isMonthSelected = (month: AvailableMonth, columnIndex: 1 | 2): boolean => {
    const selectedMonth = columnIndex === 1 ? selectedMonth1 : selectedMonth2;
    return selectedMonth?.year === month.year && selectedMonth?.month === month.month;
  };

  const isSameMonthSelected = selectedMonth1 && selectedMonth2 &&
    selectedMonth1.year === selectedMonth2.year &&
    selectedMonth1.month === selectedMonth2.month;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 w-full max-w-4xl">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (availableMonths.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 w-full max-w-4xl">
        <div className="text-center text-slate-600">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-400" />
          <p className="font-medium">No data available</p>
          <p className="text-sm mt-1">Upload sales data to compare months</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 w-full max-w-4xl">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Select Months to Compare</h3>
          <button
            onClick={handleSwap}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Swap periods"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Swap
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-blue-600">Period A</label>
              <select
                value={selectedYear1 || ''}
                onChange={(e) => setSelectedYear1(Number(e.target.value))}
                className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-2">
              {getMonthsForYear(selectedYear1).map(month => (
                <button
                  key={`${month.year}-${month.month}`}
                  onClick={() => setSelectedMonth1(month)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    isMonthSelected(month, 1)
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="font-medium text-sm text-slate-900">
                      {format(month.startDate, 'MMM')}
                    </div>
                    {isMonthSelected(month, 1) && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {month.orderCount} orders
                  </div>
                  <div className="text-xs font-medium text-slate-700 mt-0.5">
                    ${(month.totalRevenue / 1000).toFixed(0)}k
                  </div>
                </button>
              ))}
            </div>

            {selectedMonth1 && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-900">{selectedMonth1.label}</p>
                <p className="text-xs text-blue-700 mt-1">
                  {format(selectedMonth1.startDate, 'MMM d')} - {format(selectedMonth1.endDate, 'MMM d, yyyy')}
                </p>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-green-600">Period B</label>
              <select
                value={selectedYear2 || ''}
                onChange={(e) => setSelectedYear2(Number(e.target.value))}
                className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-2">
              {getMonthsForYear(selectedYear2).map(month => (
                <button
                  key={`${month.year}-${month.month}`}
                  onClick={() => setSelectedMonth2(month)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    isMonthSelected(month, 2)
                      ? 'border-green-600 bg-green-50'
                      : 'border-slate-200 hover:border-green-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="font-medium text-sm text-slate-900">
                      {format(month.startDate, 'MMM')}
                    </div>
                    {isMonthSelected(month, 2) && (
                      <Check className="w-4 h-4 text-green-600" />
                    )}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {month.orderCount} orders
                  </div>
                  <div className="text-xs font-medium text-slate-700 mt-0.5">
                    ${(month.totalRevenue / 1000).toFixed(0)}k
                  </div>
                </button>
              ))}
            </div>

            {selectedMonth2 && (
              <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm font-medium text-green-900">{selectedMonth2.label}</p>
                <p className="text-xs text-green-700 mt-1">
                  {format(selectedMonth2.startDate, 'MMM d')} - {format(selectedMonth2.endDate, 'MMM d, yyyy')}
                </p>
              </div>
            )}
          </div>
        </div>

        {isSameMonthSelected && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              Please select different months for comparison
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-4 flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={!selectedMonth1 || !selectedMonth2 || isSameMonthSelected}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          Apply Selection
        </button>
      </div>
    </div>
  );
}
