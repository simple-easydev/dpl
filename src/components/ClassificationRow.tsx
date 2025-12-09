import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, ArrowUpRight, TrendingUp, TrendingDown, Minus, Wine, Store, HelpCircle, Info } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { BlitzAccount } from '../lib/salesBlitzAnalytics';
import CategoryBadgeWithReasoning from './CategoryBadgeWithReasoning';

interface ClassificationRowProps {
  category: string;
  label: string;
  description: string;
  color: string;
  icon: any;
  accounts: BlitzAccount[];
  totalCount: number;
}

export default function ClassificationRow({
  category,
  label,
  description,
  color,
  icon: Icon,
  accounts,
  totalCount,
}: ClassificationRowProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const iconBgClass = {
    teal: 'bg-gradient-teal shadow-glow-teal',
    blue: 'bg-gradient-blue shadow-glow-blue',
    red: 'bg-gradient-red shadow-glow-red',
    orange: 'bg-gradient-orange shadow-glow-orange',
    gray: 'bg-gradient-to-br from-gray-500 to-gray-600',
  }[color] || 'bg-gradient-blue';

  const glowClass = {
    teal: 'glow-hover-teal',
    blue: 'glow-hover-blue',
    red: 'glow-hover-red',
    orange: 'glow-hover-orange',
    gray: '',
  }[color] || '';

  return (
    <div className={`glass-card rounded-2xl overflow-hidden transition-all duration-300 ${glowClass}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 flex items-center gap-4 hover:bg-white/5 transition-colors duration-200"
      >
        <div className={`${iconBgClass} rounded-xl p-3 flex-shrink-0`}>
          <Icon className="w-6 h-6 text-white" />
        </div>

        <div className="flex-1 text-left">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-lg font-semibold text-theme-text">{label}</h3>
            <span className="px-3 py-1 rounded-full glass text-sm font-semibold text-theme-text">
              {totalCount}
            </span>
          </div>
          <p className="text-sm text-theme-muted">{description}</p>
        </div>

        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-theme-muted" />
          ) : (
            <ChevronDown className="w-5 h-5 text-theme-muted" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t table-border">
          {accounts.length === 0 ? (
            <div className="p-8 text-center">
              <Icon className="w-12 h-12 text-theme-muted opacity-50 mx-auto mb-3" />
              <p className="text-theme-muted">No accounts in this category</p>
              <p className="text-sm text-theme-muted mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="p-6 space-y-3">
              {accounts.map((account) => {
                const trendColor =
                  account.trendPercent > 0
                    ? 'text-teal-400'
                    : account.trendPercent < -25
                    ? 'text-red-400'
                    : 'text-theme-muted';
                const trendIcon =
                  account.trendPercent > 0
                    ? TrendingUp
                    : account.trendPercent < -25
                    ? TrendingDown
                    : Minus;
                const TrendIcon = trendIcon;

                return (
                  <div
                    key={account.accountId}
                    className="glass rounded-xl p-4 hover:bg-white/5 transition-all duration-200 border border-white/10"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-3">
                          <h4 className="font-semibold text-theme-text truncate">
                            {account.accountName}
                          </h4>
                          {account.premise_type === 'on_premise' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-blue text-white text-xs font-semibold flex-shrink-0">
                              <Wine className="w-3 h-3" />
                              On
                            </span>
                          )}
                          {account.premise_type === 'off_premise' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-teal text-white text-xs font-semibold flex-shrink-0">
                              <Store className="w-3 h-3" />
                              Off
                            </span>
                          )}
                          {account.premise_type === 'unclassified' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-500 text-white text-xs font-semibold flex-shrink-0">
                              <HelpCircle className="w-3 h-3" />
                              ?
                            </span>
                          )}
                          {account.isAiCategorized && account.aiReasoning && (
                            <div className="ml-auto">
                              <CategoryBadgeWithReasoning
                                category={account.category}
                                confidence={account.aiConfidence}
                                reasoning={account.aiReasoning}
                                isAiCategorized={account.isAiCategorized}
                                categorizedAt={account.categorizedAt}
                              />
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-theme-muted mb-1">Baseline Avg</p>
                            <p className="text-sm font-semibold text-theme-text">
                              {account.baselineAvg.toFixed(2)} cases
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-theme-muted mb-1">Recent Avg</p>
                            <p className="text-sm font-semibold text-theme-text">
                              {account.recentAvg.toFixed(2)} cases
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-theme-muted mb-1">Trend</p>
                            <div className="flex items-center gap-1">
                              <TrendIcon className={`w-4 h-4 ${trendColor}`} />
                              <p className={`text-sm font-semibold ${trendColor}`}>
                                {account.trendPercent > 0 ? '+' : ''}
                                {account.trendPercent.toFixed(1)}%
                              </p>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs text-theme-muted mb-1">Last Order</p>
                            <p className="text-sm font-medium text-theme-text">
                              {account.lastOrderDate
                                ? format(parseISO(account.lastOrderDate), 'MMM dd, yyyy')
                                : '-'}
                            </p>
                          </div>
                        </div>

                        {(account.distributor || account.region) && (
                          <div className="mt-3 flex items-center gap-4 flex-wrap">
                            {account.distributor && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-theme-muted">Distributor:</span>
                                <span className="text-xs font-medium text-theme-text">
                                  {account.distributor}
                                </span>
                              </div>
                            )}
                            {account.region && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-theme-muted">State:</span>
                                <span className="text-xs font-medium text-theme-text">
                                  {account.region}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => navigate(`/dashboard/accounts/${account.accountId}`)}
                        className="p-2 glass rounded-lg hover:bg-white/10 transition-all duration-300 text-theme-muted hover:text-theme-text flex-shrink-0"
                        title="View account details"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
