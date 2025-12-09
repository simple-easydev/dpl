import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Search } from 'lucide-react';

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export default function MultiSelectDropdown({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = 'All',
  className = ''
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current && isOpen) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    };

    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
    setSearchTerm('');
  };

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayText = selectedValues.length === 0
    ? placeholder
    : selectedValues.length === 1
    ? selectedValues[0]
    : `${selectedValues.length} selected`;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-2 uppercase tracking-wide">
        {label}
      </label>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-gray-50 dark:bg-zinc-800/50 border-2 border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-medium transition-all duration-200 hover:border-teal-300 dark:hover:border-teal-500/50 flex items-center justify-between"
      >
        <span className={selectedValues.length === 0 ? 'text-gray-500 dark:text-zinc-400' : ''}>
          {displayText}
        </span>
        <div className="flex items-center gap-2">
          {selectedValues.length > 0 && (
            <span className="px-2 py-0.5 bg-teal-500/20 text-teal-600 dark:text-teal-400 rounded-full text-xs font-bold">
              {selectedValues.length}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-white dark:bg-zinc-800 border-2 border-gray-200 dark:border-white/10 rounded-xl shadow-2xl max-h-80 overflow-hidden"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`
          }}
        >
          {options.length > 5 && (
            <div className="p-3 border-b border-gray-200 dark:border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-zinc-400 text-center">
                No options found
              </div>
            ) : (
              <>
                {selectedValues.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="w-full px-4 py-2 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border-b border-gray-200 dark:border-white/10 flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Clear All
                  </button>
                )}
                {filteredOptions.map(option => (
                  <label
                    key={option}
                    className="flex items-center px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-700/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedValues.includes(option)}
                      onChange={() => handleToggle(option)}
                      className="w-4 h-4 text-teal-600 bg-gray-100 dark:bg-zinc-700 border-gray-300 dark:border-zinc-600 rounded focus:ring-teal-500 focus:ring-2"
                    />
                    <span className="ml-3 text-sm text-gray-900 dark:text-white font-medium">
                      {option}
                    </span>
                  </label>
                ))}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
