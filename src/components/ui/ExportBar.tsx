'use client';

import { useState } from 'react';
import {
  Download,
  X,
  FileJson,
  FileSpreadsheet,
  Mail,
  Copy,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function ExportBar() {
  const { selectedCandidates, clearSelectedCandidates, searchResults } = useAppStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  if (selectedCandidates.length === 0) {
    return null;
  }

  // Get full candidate data for selected candidates
  const getSelectedCandidateData = () => {
    return searchResults.filter((candidate) => {
      const { getPrimaryId } = require('@/lib/field-resolver');
      const id = getPrimaryId(candidate);
      return selectedCandidates.some((c) => c.id === id);
    });
  };

  const exportToCSV = () => {
    setIsExporting(true);
    try {
      const data = getSelectedCandidateData();
      if (data.length === 0) {
        // If no data in search results, export just the IDs and names
        const csvContent = [
          ['CandidateId', 'Name'],
          ...selectedCandidates.map((c) => [c.id, c.name]),
        ]
          .map((row) => row.map((cell) => `"${cell}"`).join(','))
          .join('\n');

        downloadFile(csvContent, 'candidates.csv', 'text/csv');
      } else {
        // Export full data
        const headers = Object.keys(data[0]);
        const csvContent = [
          headers,
          ...data.map((row) =>
            headers.map((header) => {
              const value = row[header];
              return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
            })
          ),
        ]
          .map((row) => row.join(','))
          .join('\n');

        downloadFile(csvContent, 'candidates.csv', 'text/csv');
      }
      showSuccess('Exported to CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToJSON = () => {
    setIsExporting(true);
    try {
      const data = getSelectedCandidateData();
      const jsonContent =
        data.length > 0
          ? JSON.stringify(data, null, 2)
          : JSON.stringify(selectedCandidates, null, 2);

      downloadFile(jsonContent, 'candidates.json', 'application/json');
      showSuccess('Exported to JSON');
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = async () => {
    setIsExporting(true);
    try {
      const text = selectedCandidates.map((c) => `${c.name} (${c.id})`).join('\n');
      await navigator.clipboard.writeText(text);
      showSuccess('Copied to clipboard');
    } catch (err) {
      console.error('Failed to copy:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const showSuccess = (message: string) => {
    setExportSuccess(message);
    setTimeout(() => setExportSuccess(null), 2000);
  };

  return (
    <div
      className={cn(
        'fixed bottom-12 left-16 right-0 z-40 bg-cdata-black text-white px-6 py-3',
        'flex items-center justify-between animate-in slide-in-from-bottom-4 duration-300'
      )}
    >
      {/* Left side - Selection info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-cdata-yellow">
            {selectedCandidates.length}
          </span>
          <span className="text-sm text-gray-300">
            candidate{selectedCandidates.length !== 1 ? 's' : ''} selected
          </span>
        </div>

        {/* Selected names preview */}
        <div className="hidden md:flex items-center gap-2 text-sm text-gray-400 max-w-md truncate">
          {selectedCandidates.slice(0, 3).map((c, i) => (
            <span key={c.id}>
              {c.name}
              {i < Math.min(selectedCandidates.length - 1, 2) && ','}
            </span>
          ))}
          {selectedCandidates.length > 3 && (
            <span>+{selectedCandidates.length - 3} more</span>
          )}
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        {/* Success message */}
        {exportSuccess && (
          <div className="flex items-center gap-2 text-green-400 text-sm mr-4 animate-in fade-in duration-200">
            <CheckCircle className="w-4 h-4" />
            {exportSuccess}
          </div>
        )}

        {/* Export buttons */}
        <button
          onClick={copyToClipboard}
          disabled={isExporting}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
        >
          <Copy className="w-4 h-4" />
          Copy
        </button>

        <button
          onClick={exportToCSV}
          disabled={isExporting}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
        >
          <FileSpreadsheet className="w-4 h-4" />
          CSV
        </button>

        <button
          onClick={exportToJSON}
          disabled={isExporting}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm"
        >
          <FileJson className="w-4 h-4" />
          JSON
        </button>

        <button
          onClick={exportToCSV}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-cdata-yellow text-cdata-black hover:bg-yellow-400 transition-colors text-sm font-medium"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Export
        </button>

        {/* Clear selection */}
        <button
          onClick={clearSelectedCandidates}
          className="ml-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          title="Clear selection"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
