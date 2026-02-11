'use client';

interface FormatSpecifierProps {
  inputFormat: string;
  constraints: string;
  onInputFormatChange: (value: string) => void;
  onConstraintsChange: (value: string) => void;
  disabled?: boolean;
}

export function FormatSpecifier({
  inputFormat,
  constraints,
  onInputFormatChange,
  onConstraintsChange,
  disabled,
}: FormatSpecifierProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Input Format <span className="text-red-500">*</span>
        </label>
        <textarea
          value={inputFormat}
          onChange={(e) => onInputFormatChange(e.target.value)}
          disabled={disabled}
          placeholder="Describe the input format, e.g.:
First line: integer n (number of elements)
Second line: n space-separated integers"
          className="w-full h-24 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     placeholder-gray-400 dark:placeholder-gray-500
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed
                     resize-none"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Describe how the input is structured (lines, data types, etc.)
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Constraints
        </label>
        <textarea
          value={constraints}
          onChange={(e) => onConstraintsChange(e.target.value)}
          disabled={disabled}
          placeholder="Specify value ranges, e.g.:
1 ≤ n ≤ 100000
-10^9 ≤ a[i] ≤ 10^9"
          className="w-full h-20 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     placeholder-gray-400 dark:placeholder-gray-500
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed
                     resize-none"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Optional: Helps generate better test cases
        </p>
      </div>
    </div>
  );
}
