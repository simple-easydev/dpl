import { useState, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { format } from 'date-fns';
import { AvailableMonth, getAvailableMonths, groupMonthsByYear } from '../lib/monthUtils';
import { useOrganization } from '../contexts/OrganizationContext';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

interface PeriodSelectorProps {
  onPeriodChange: (current: DateRange, previous: DateRange) => void;
  currentPeriod: DateRange;
  previousPeriod: DateRange;
}

export default function PeriodSelector({ onPeriodChange, currentPeriod, previousPeriod }: PeriodSelectorProps) {
  const { currentOrganization } = useOrganization();
  const [showDropdownA, setShowDropdownA] = useState(false);
  const [showDropdownB, setShowDropdownB] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<AvailableMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYearA, setSelectedYearA] = useState<number | null>(null);
  const [selectedYearB, setSelectedYearB] = useState<number | null>(null);

  useEffect(() => {
    const fetchMonths = async () => {
      if (!currentOrganization) return;

      setLoading(true);
      const months = await getAvailableMonths(currentOrganization.id);
      setAvailableMonths(months);

      if (months && months.length > 0 && months[0]) {
        const latestYear = months[0].year;
        setSelectedYearA(latestYear);
        setSelectedYearB(latestYear);
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

  const handleMonthSelectA = (month: AvailableMonth) => {
    const newPeriodA: DateRange = {
      startDate: month.startDate,
      endDate: month.endDate,
      label: month.label,
    };
    onPeriodChange(newPeriodA, previousPeriod);
    setShowDropdownA(false);
  };

  const handleMonthSelectB = (month: AvailableMonth) => {
    const newPeriodB: DateRange = {
      startDate: month.startDate,
      endDate: month.endDate,
      label: month.label,
    };
    onPeriodChange(currentPeriod, newPeriodB);
    setShowDropdownB(false);
  };

  const isMonthSelected = (month: AvailableMonth, period: DateRange): boolean => {
    return format(period.startDate, 'yyyy-MM') === `${month.year}-${month.month.toString().padStart(2, '0')}`;
  };

  const currentSelectedMonth = availableMonths.find(m => isMonthSelected(m, currentPeriod));
  const previousSelectedMonth = availableMonths.find(m => isMonthSelected(m, previousPeriod));

  const isSameMonthSelected = currentSelectedMonth && previousSelectedMonth &&
    currentSelectedMonth.year === previousSelectedMonth.year &&
    currentSelectedMonth.month === previousSelectedMonth.month;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <button
            onClick={() => {
              setShowDropdownA(!showDropdownA);
              setShowDropdownB(false);
            }}
            className="w-full flex items-center gap-2 px-4 py-3 bg-white dark:bg-zinc-800 border-2 border-blue-200 dark:border-blue-500/30 rounded-lg hover:border-blue-400 dark:hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
          >
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <div className="flex-1 text-left">
              <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-0.5">Period A</div>
              <div className="font-semibold text-gray-900 dark:text-white text-sm">
                {currentPeriod.label}
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-blue-600 dark:text-blue-400 transition-transform ${showDropdownA ? 'rotate-180' : ''}`} />
          </button>

          {showDropdownA && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdownA(false)}
              />
              <div className="absolute top-full left-0 mt-2 w-full min-w-[280px] max-w-[320px] bg-white dark:bg-zinc-800 rounded-lg shadow-xl border-2 border-blue-200 dark:border-blue-500/30 z-20">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : availableMonths.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500 dark:text-zinc-400">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No data available</p>
                  </div>
                ) : (
                  <>
                    {availableYears.length > 0 && (
                      <div className="px-4 py-3 border-b border-blue-200 dark:border-blue-500/30">
                        <select
                          value={selectedYearA || ''}
                          onChange={(e) => setSelectedYearA(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-500/50 rounded-lg text-gray-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="max-h-80 overflow-y-auto py-2">
                      {getMonthsForYear(selectedYearA).map(month => (
                        <button
                          key={`${month.year}-${month.month}`}
                          onClick={() => handleMonthSelectA(month)}
                          className={`w-full text-left py-3 text-gray-900 dark:text-white hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors relative ${
                            isMonthSelected(month, currentPeriod)
                              ? 'bg-blue-50 dark:bg-blue-900/20'
                              : ''
                          }`}
                        >
                          {isMonthSelected(month, currentPeriod) && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 dark:bg-blue-500" />
                          )}
                          <div className="flex items-center justify-between px-4">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold">{format(month.startDate, 'MMMM yyyy')}</div>
                              <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                                {month.orderCount} orders · ${(month.totalRevenue / 1000).toFixed(1)}k revenue
                              </div>
                            </div>
                            {isMonthSelected(month, currentPeriod) && (
                              <Check className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-3" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-center text-gray-400 dark:text-zinc-500 font-semibold text-sm sm:text-base">
          vs
        </div>

        <div className="relative flex-1">
          <button
            onClick={() => {
              setShowDropdownB(!showDropdownB);
              setShowDropdownA(false);
            }}
            className="w-full flex items-center gap-2 px-4 py-3 bg-white dark:bg-zinc-800 border-2 border-green-200 dark:border-green-500/30 rounded-lg hover:border-green-400 dark:hover:border-green-500/50 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all"
          >
            <Calendar className="w-4 h-4 text-green-600 dark:text-green-400" />
            <div className="flex-1 text-left">
              <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-0.5">Period B</div>
              <div className="font-semibold text-gray-900 dark:text-white text-sm">
                {previousPeriod.label}
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-green-600 dark:text-green-400 transition-transform ${showDropdownB ? 'rotate-180' : ''}`} />
          </button>

          {showDropdownB && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdownB(false)}
              />
              <div className="absolute top-full left-0 mt-2 w-full min-w-[280px] max-w-[320px] bg-white dark:bg-zinc-800 rounded-lg shadow-xl border-2 border-green-200 dark:border-green-500/30 z-20">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                  </div>
                ) : availableMonths.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500 dark:text-zinc-400">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No data available</p>
                  </div>
                ) : (
                  <>
                    {availableYears.length > 0 && (
                      <div className="px-4 py-3 border-b border-green-200 dark:border-green-500/30">
                        <select
                          value={selectedYearB || ''}
                          onChange={(e) => setSelectedYearB(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-500/50 rounded-lg text-gray-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-green-500"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="max-h-80 overflow-y-auto py-2">
                      {getMonthsForYear(selectedYearB).map(month => (
                        <button
                          key={`${month.year}-${month.month}`}
                          onClick={() => handleMonthSelectB(month)}
                          className={`w-full text-left py-3 text-gray-900 dark:text-white hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors relative ${
                            isMonthSelected(month, previousPeriod)
                              ? 'bg-green-50 dark:bg-green-900/20'
                              : ''
                          }`}
                        >
                          {isMonthSelected(month, previousPeriod) && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-600 dark:bg-green-500" />
                          )}
                          <div className="flex items-center justify-between px-4">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold">{format(month.startDate, 'MMMM yyyy')}</div>
                              <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                                {month.orderCount} orders · ${(month.totalRevenue / 1000).toFixed(1)}k revenue
                              </div>
                            </div>
                            {isMonthSelected(month, previousPeriod) && (
                              <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 ml-3" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800/50 rounded-lg px-4 py-3 border border-gray-200 dark:border-zinc-700">
        <span className="font-medium text-blue-600 dark:text-blue-400">Period A:</span>
        <span className="text-gray-900 dark:text-white font-medium">
          {format(currentPeriod.startDate, 'MMM d, yyyy')} - {format(currentPeriod.endDate, 'MMM d, yyyy')}
        </span>
        <span className="text-gray-400 dark:text-zinc-500 mx-1">vs</span>
        <span className="font-medium text-green-600 dark:text-green-400">Period B:</span>
        <span className="text-gray-900 dark:text-white font-medium">
          {format(previousPeriod.startDate, 'MMM d, yyyy')} - {format(previousPeriod.endDate, 'MMM d, yyyy')}
        </span>
      </div>
    </div>
  );
}
