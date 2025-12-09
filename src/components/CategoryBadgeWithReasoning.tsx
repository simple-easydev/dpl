import { useState, useRef, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar, AlertCircle, Info, X } from 'lucide-react';
import { BlitzCategory } from '../lib/salesBlitzAnalytics';

interface CategoryBadgeWithReasoningProps {
  category: BlitzCategory;
  confidence?: number;
  reasoning?: string;
  isAiCategorized: boolean;
  categorizedAt?: string;
}

const CATEGORY_CONFIG = {
  large_active: {
    label: 'Large Active',
    color: 'teal',
    bgColor: 'bg-teal-100',
    textColor: 'text-teal-800',
    borderColor: 'border-teal-300',
    icon: TrendingUp,
  },
  small_active: {
    label: 'Small Active',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-300',
    icon: Minus,
  },
  large_loss: {
    label: 'Large Loss',
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-300',
    icon: TrendingDown,
  },
  small_loss: {
    label: 'Small Loss',
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-300',
    icon: AlertCircle,
  },
  one_time: {
    label: 'One-Time',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    borderColor: 'border-gray-300',
    icon: Calendar,
  },
  inactive: {
    label: 'Inactive',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    borderColor: 'border-gray-300',
    icon: Minus,
  },
};

export default function CategoryBadgeWithReasoning({
  category,
  confidence,
  reasoning,
  isAiCategorized,
  categorizedAt,
}: CategoryBadgeWithReasoningProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [popupPosition, setPopupPosition] = useState<'left' | 'right'>('left');
  const badgeRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;

  useEffect(() => {
    if (showDetails && badgeRef.current && popupRef.current) {
      const badgeRect = badgeRef.current.getBoundingClientRect();
      const popupWidth = 384; // w-96 = 24rem = 384px
      const viewportWidth = window.innerWidth;
      const spaceOnRight = viewportWidth - badgeRect.left;
      const spaceOnLeft = badgeRect.right;

      if (spaceOnRight < popupWidth && spaceOnLeft > spaceOnRight) {
        setPopupPosition('right');
      } else {
        setPopupPosition('left');
      }
    }
  }, [showDetails]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const getConfidenceColor = (conf?: number) => {
    if (!conf) return 'bg-gray-400';
    if (conf >= 0.8) return 'bg-green-500';
    if (conf >= 0.6) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div className="relative inline-block" ref={badgeRef}>
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bgColor} ${config.textColor} ${config.borderColor} cursor-pointer hover:shadow-md transition-shadow`}
        onClick={() => setShowDetails(!showDetails)}
      >
        <Icon className="w-4 h-4" />
        <span className="font-medium text-sm">{config.label}</span>
        {isAiCategorized && confidence !== undefined && (
          <div className="flex items-center gap-1">
            <div
              className={`w-2 h-2 rounded-full ${getConfidenceColor(confidence)}`}
              title={`${Math.round(confidence * 100)}% confidence`}
            />
          </div>
        )}
        <Info className="w-3.5 h-3.5 opacity-50" />
      </div>

      {showDetails && (
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setShowDetails(false)}
          />
          <div
            ref={popupRef}
            className={`absolute ${popupPosition === 'left' ? 'left-0' : 'right-0'} top-full mt-2 w-full sm:w-96 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-[9999] max-h-[80vh] overflow-y-auto`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${config.textColor}`} />
                  {config.label}
                </h3>
                {isAiCategorized && (
                  <p className="text-xs text-gray-700 mt-1 font-medium">
                    AI Categorized {formatDate(categorizedAt)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {confidence !== undefined && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">Confidence</span>
                  <span className="text-lg font-bold text-gray-900">
                    {Math.round(confidence * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-300 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${getConfidenceColor(confidence)}`}
                    style={{ width: `${confidence * 100}%` }}
                  />
                </div>
              </div>
            )}

            {reasoning && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-bold text-gray-900 mb-2">
                  Analysis
                </p>
                <p className="text-sm text-gray-800 leading-relaxed">
                  {reasoning}
                </p>
              </div>
            )}

            {!isAiCategorized && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-gray-800 font-medium">
                  Using rule-based categorization. Configure OpenAI in Settings for AI-powered insights.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
