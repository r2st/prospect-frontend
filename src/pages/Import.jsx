import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Upload,
  FileText,
  Check,
  AlertCircle,
  Download,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Table,
  Loader2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import CSVUploader from '../components/CSVUploader';
import { useImportCSV } from '../hooks/useCompanies';

// Target fields the backend CSV importer accepts.
const TARGET_FIELDS = [
  { value: '', label: '-- Skip --' },
  { value: 'company_name', label: 'Company Name', required: true },
  { value: 'domain', label: 'Domain' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'country', label: 'Country' },
  { value: 'employee_count', label: 'Employee Count' },
  { value: 'contact_name', label: 'Contact Name' },
  { value: 'contact_email', label: 'Contact Email' },
  { value: 'contact_title', label: 'Contact Title' },
];

const TEMPLATE_HEADERS = [
  'company_name',
  'domain',
  'city',
  'state',
  'country',
  'employee_count',
  'contact_name',
  'contact_email',
  'contact_title',
];

const TEMPLATE_EXAMPLE_ROW = [
  'Acme Corp',
  'acme.com',
  'Detroit',
  'MI',
  'US',
  '500',
  'Jane Doe',
  'jane@acme.com',
  'VP Ops',
];

const STEPS = [
  { key: 'upload', label: 'Upload' },
  { key: 'map', label: 'Map Fields' },
  { key: 'preview', label: 'Preview' },
  { key: 'import', label: 'Import' },
  { key: 'summary', label: 'Summary' },
];

const DUPLICATE_OPTIONS = [
  { value: 'skip', label: 'Skip duplicates', description: 'Rows matching existing records will be skipped' },
  { value: 'update', label: 'Update existing', description: 'Existing records will be updated with new data' },
  { value: 'new', label: 'Import as new', description: 'All rows will be imported as new records' },
];

const IMPORT_HISTORY_KEY = 'landline.import_history';

// ---------------------------------------------------------------------------
// CSV Parsing (client-side, no dependencies)
// ---------------------------------------------------------------------------
function parseCSV(text) {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function parseLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

// ---------------------------------------------------------------------------
// Auto-map a CSV header to the best matching target field
// ---------------------------------------------------------------------------
function autoMapHeader(header) {
  const normalized = header.toLowerCase().replace(/[\s_-]+/g, '_').trim();
  for (const field of TARGET_FIELDS) {
    if (!field.value) continue;
    if (normalized === field.value) return field.value;
  }
  // Fuzzy fallbacks
  const aliases = {
    company: 'company_name',
    company_name: 'company_name',
    name: 'company_name',
    business_name: 'company_name',
    organization: 'company_name',
    org: 'company_name',
    firm: 'company_name',
    website: 'domain',
    url: 'domain',
    domain: 'domain',
    site: 'domain',
    homepage: 'domain',
    web: 'domain',
    city: 'city',
    location: 'city',
    state: 'state',
    province: 'state',
    region: 'state',
    country: 'country',
    employees: 'employee_count',
    employee_count: 'employee_count',
    size: 'employee_count',
    staff: 'employee_count',
    headcount: 'employee_count',
    num_employees: 'employee_count',
    contact: 'contact_name',
    contact_name: 'contact_name',
    person: 'contact_name',
    full_name: 'contact_name',
    first_name: 'contact_name',
    email: 'contact_email',
    contact_email: 'contact_email',
    email_address: 'contact_email',
    mail: 'contact_email',
    title: 'contact_title',
    contact_title: 'contact_title',
    job_title: 'contact_title',
    role: 'contact_title',
    position: 'contact_title',
    designation: 'contact_title',
  };
  return aliases[normalized] || '';
}

// Simple email validation
function isValidEmail(str) {
  if (!str || typeof str !== 'string') return true; // empty is not "invalid email"
  const trimmed = str.trim();
  if (!trimmed) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

// ---------------------------------------------------------------------------
// Duplicate email detection
// ---------------------------------------------------------------------------
function findDuplicateEmails(rows, emailColIndex) {
  if (emailColIndex < 0) return 0;
  const seen = new Map();
  let count = 0;
  for (const row of rows) {
    const email = (row[emailColIndex] || '').toLowerCase().trim();
    if (!email) continue;
    if (seen.has(email)) {
      count++;
    } else {
      seen.set(email, true);
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// CSV generation helpers
// ---------------------------------------------------------------------------
function downloadCSV(filename, headerRow, dataRows) {
  const escape = (v) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headerRow.map(escape).join(',')];
  for (const row of dataRows) {
    lines.push(row.map(escape).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadTemplate() {
  downloadCSV('prospect_import_template.csv', TEMPLATE_HEADERS, [TEMPLATE_EXAMPLE_ROW]);
  toast.success('Template downloaded');
}

// ---------------------------------------------------------------------------
// Remap CSV file using field mappings, then wrap in FormData
// ---------------------------------------------------------------------------
function buildMappedFormData(file, headers, rows, mappings) {
  // Build header row from mappings
  const mappedHeaders = headers.map((_, i) => mappings[i] || '');
  const escape = (v) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [mappedHeaders.map(escape).join(',')];
  for (const row of rows) {
    const mapped = mappedHeaders.map((fieldName, i) => {
      if (!fieldName) return '';
      return escape(row[i] ?? '');
    });
    lines.push(mapped.join(','));
  }

  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const mappedFile = new File([blob], file.name, { type: 'text/csv' });

  const formData = new FormData();
  formData.append('file', mappedFile);
  return formData;
}

// ---------------------------------------------------------------------------
// Step Indicator Component
// ---------------------------------------------------------------------------
function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((step, idx) => {
        const isActive = idx === currentStep;
        const isCompleted = idx < currentStep;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : isCompleted
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : 'border-gray-300 bg-white text-gray-400'
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium ${
                  isActive ? 'text-blue-600' : isCompleted ? 'text-blue-500' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`mx-2 mb-5 h-0.5 w-10 sm:w-16 ${
                  isCompleted ? 'bg-blue-500' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import Progress Bar Component
// ---------------------------------------------------------------------------
function ImportProgressBar({ isImporting, isComplete, totalRows = 0 }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isImporting || isComplete) return;
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isImporting, isComplete]);

  const estimatedTotal = totalRows ? Math.max(5, Math.ceil(totalRows / 50)) : 30;
  const pct = isComplete ? 100 : Math.min(95, Math.round((elapsed / estimatedTotal) * 100));
  const remaining = Math.max(0, estimatedTotal - elapsed);

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">
          {isComplete ? 'Import complete' : 'Importing data...'}
        </span>
        <span className="text-gray-500">
          {isComplete ? '100%' : `${pct}% · ~${remaining}s remaining`}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            isComplete ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!isComplete && totalRows > 0 && (
        <p className="mt-1 text-xs text-gray-400">Processing {totalRows} rows...</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import History Component
// ---------------------------------------------------------------------------
function ImportHistory({ history }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (history.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-5 py-3.5"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">
            Import History ({history.length})
          </h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {isExpanded && (
        <div className="border-t border-gray-100 px-5 pb-4 pt-2">
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500">
                    File
                  </th>
                  <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500">
                    Date / Time
                  </th>
                  <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 text-right">
                    Companies
                  </th>
                  <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 text-right">
                    Contacts
                  </th>
                  <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 text-right">
                    Errors
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                  >
                    <td className="whitespace-nowrap border-b border-gray-100 px-3 py-2 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-gray-400" />
                        {entry.filename}
                      </div>
                    </td>
                    <td className="whitespace-nowrap border-b border-gray-100 px-3 py-2 text-sm text-gray-500">
                      {entry.datetime}
                    </td>
                    <td className="whitespace-nowrap border-b border-gray-100 px-3 py-2 text-sm text-green-600 text-right font-medium">
                      {entry.companies}
                    </td>
                    <td className="whitespace-nowrap border-b border-gray-100 px-3 py-2 text-sm text-blue-600 text-right font-medium">
                      {entry.contacts}
                    </td>
                    <td className="whitespace-nowrap border-b border-gray-100 px-3 py-2 text-sm text-right font-medium">
                      <span className={entry.errors > 0 ? 'text-red-600' : 'text-gray-400'}>
                        {entry.errors}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Main Import Component
// ===========================================================================
export default function Import() {
  const importCSV = useImportCSV();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedData, setParsedData] = useState(null); // { headers, rows }
  const [mappings, setMappings] = useState({}); // { colIndex: targetField }
  const [importResult, setImportResult] = useState(null);
  const [lastImportResult, setLastImportResult] = useState(null);
  const [duplicateHandling, setDuplicateHandling] = useState('skip');
  const [importHistory, setImportHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(IMPORT_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isImportRunning, setIsImportRunning] = useState(false);

  // Track which fields were auto-mapped for visual distinction
  const [autoMappedFields, setAutoMappedFields] = useState(new Set());

  // Persist import history to localStorage (keep last 50)
  useEffect(() => {
    try {
      localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(importHistory.slice(0, 50)));
    } catch { /* localStorage unavailable */ }
  }, [importHistory]);

  // Drag-and-drop state for the enhanced drop zone
  const [isDragOver, setIsDragOver] = useState(false);
  const dropZoneRef = useRef(null);

  // -----------------------------------------------------------------------
  // Drag-and-drop handlers for enhanced drop zone
  // -----------------------------------------------------------------------
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the drop zone entirely
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please drop a CSV file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }

    // Process the dropped file the same way CSVUploader does
    const formData = new FormData();
    formData.append('file', file);
    handleFileSelected(formData);
  }, []);

  // -----------------------------------------------------------------------
  // Step 1: File selected via CSVUploader or drag-and-drop
  // -----------------------------------------------------------------------
  const handleFileSelected = useCallback((formData) => {
    const file = formData.get('file');
    if (!file) return;

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const { headers, rows } = parseCSV(text);

      if (headers.length === 0) {
        toast.error('CSV appears to be empty');
        return;
      }

      setParsedData({ headers, rows });

      // Auto-map columns
      const autoMappings = {};
      const usedTargets = new Set();
      headers.forEach((header, idx) => {
        const mapped = autoMapHeader(header);
        // Prevent mapping the same target field twice
        if (mapped && !usedTargets.has(mapped)) {
          autoMappings[idx] = mapped;
          usedTargets.add(mapped);
        } else {
          autoMappings[idx] = '';
        }
      });
      setMappings(autoMappings);
      setAutoMappedFields(new Set(Object.entries(autoMappings).filter(([, v]) => v).map(([k]) => Number(k))));
      setCurrentStep(1);
    };
    reader.onerror = () => {
      toast.error('Failed to read the file');
    };
    reader.readAsText(file);
  }, []);

  // -----------------------------------------------------------------------
  // Step 2: Column mapping
  // -----------------------------------------------------------------------
  const handleMappingChange = useCallback(
    (colIndex, targetField) => {
      setMappings((prev) => {
        const next = { ...prev };
        // If another column was already mapped to this target, clear it
        if (targetField) {
          for (const key in next) {
            if (String(key) !== String(colIndex) && next[key] === targetField) {
              next[key] = '';
            }
          }
        }
        next[colIndex] = targetField;
        return next;
      });
    },
    [],
  );

  const isCompanyNameMapped = useMemo(() => {
    return Object.values(mappings).includes('company_name');
  }, [mappings]);

  const duplicateEmailCount = useMemo(() => {
    if (!parsedData) return 0;
    const emailColIndex = Object.entries(mappings).find(
      ([, v]) => v === 'contact_email',
    );
    if (!emailColIndex) return 0;
    return findDuplicateEmails(parsedData.rows, Number(emailColIndex[0]));
  }, [parsedData, mappings]);

  const previewRows = useMemo(() => {
    if (!parsedData) return [];
    return parsedData.rows.slice(0, 10);
  }, [parsedData]);

  // -----------------------------------------------------------------------
  // Step 4: Run Import
  // -----------------------------------------------------------------------
  const handleImport = useCallback(async () => {
    if (!selectedFile || !parsedData) return;

    setIsImportRunning(true);
    setCurrentStep(3); // Move to Import step with progress bar

    const formData = buildMappedFormData(
      selectedFile,
      parsedData.headers,
      parsedData.rows,
      mappings,
    );

    try {
      const result = await importCSV.mutateAsync(formData);
      setImportResult(result);
      setLastImportResult(result);
      setIsImportRunning(false);

      // Add to import history
      const now = new Date();
      setImportHistory((prev) => [
        {
          filename: selectedFile.name,
          datetime: now.toLocaleString(),
          companies: result.imported_companies ?? 0,
          contacts: result.imported_contacts ?? 0,
          errors: (result.errors || []).length,
        },
        ...prev,
      ]);

      setCurrentStep(4); // Move to Summary step
    } catch {
      // Error toast is shown by the mutation's onError handler
      setIsImportRunning(false);
      setCurrentStep(2); // Go back to Preview step on error
    }
  }, [selectedFile, parsedData, mappings, importCSV]);

  // -----------------------------------------------------------------------
  // Error report download
  // -----------------------------------------------------------------------
  const errors = importResult?.errors || [];

  const handleDownloadErrors = useCallback(() => {
    if (errors.length === 0) return;
    // Parse errors into row number + message where possible
    const errorRows = errors.map((err) => {
      const match = err.match(/^(?:Row\s+)?(\d+):?\s*(.*)$/i);
      if (match) return [match[1], match[2]];
      return ['', err];
    });
    downloadCSV('import_errors.csv', ['Row', 'Error'], errorRows);
    toast.success('Error report downloaded');
  }, [errors]);

  // -----------------------------------------------------------------------
  // Reset wizard
  // -----------------------------------------------------------------------
  const resetWizard = useCallback(() => {
    setCurrentStep(0);
    setSelectedFile(null);
    setParsedData(null);
    setMappings({});
    setImportResult(null);
    setDuplicateHandling('skip');
    setIsImportRunning(false);
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Step Indicator */}
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
        <StepIndicator currentStep={currentStep} />
      </div>

      {/* ================================================================= */}
      {/* Step 1: Upload                                                     */}
      {/* ================================================================= */}
      {currentStep === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Upload className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Upload CSV</h2>
                <p className="text-sm text-gray-500">
                  Bulk-import companies and their primary contacts
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Download Template
            </button>
          </div>

          {/* Enhanced drag-and-drop zone */}
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative mb-4 rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300 ease-in-out ${
              isDragOver
                ? 'border-blue-500 bg-blue-50 scale-[1.02] shadow-lg ring-4 ring-blue-100'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100/50'
            }`}
          >
            {isDragOver ? (
              <FileText
                className="mx-auto mb-3 h-12 w-12 text-blue-500 transition-all duration-300 animate-bounce"
              />
            ) : (
              <Upload
                className="mx-auto mb-3 h-12 w-12 text-gray-300 transition-all duration-300"
              />
            )}
            <p
              className={`text-base font-medium transition-colors ${
                isDragOver ? 'text-blue-600' : 'text-gray-600'
              }`}
            >
              {isDragOver ? 'Drop your CSV file here' : 'Drag & drop your CSV file here'}
            </p>
            <p className="mt-1 text-sm text-gray-400">CSV format, UTF-8 encoding, max 10MB</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-medium uppercase text-gray-400">or</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
          </div>

          <CSVUploader onUpload={handleFileSelected} isLoading={false} />

          {/* Instructions */}
          <div className="mt-6 border-t border-gray-100 pt-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Import Instructions</h3>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Supported Columns
                </h4>
                <div className="space-y-1">
                  {TARGET_FIELDS.filter((f) => f.value).map((col) => (
                    <div
                      key={col.value}
                      className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-gray-200 px-1.5 py-0.5 text-xs font-mono text-gray-700">
                          {col.value}
                        </code>
                        {col.required && (
                          <span className="text-xs font-medium text-red-500">required</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{col.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  File Requirements
                </h4>
                <ul className="space-y-2">
                  {[
                    'File must be in CSV (Comma-Separated Values) format',
                    'Encoding should be UTF-8',
                    'Maximum file size: 10MB',
                    'First row must contain column headers',
                    'Duplicate companies (same domain or name) are skipped',
                  ].map((req) => (
                    <li key={req} className="flex items-start gap-2 text-sm text-gray-600">
                      <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Step 2: Map Fields                                                 */}
      {/* ================================================================= */}
      {currentStep === 1 && parsedData && (
        <div className="space-y-5">
          {/* File info bar */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedFile?.name}</p>
                  <p className="text-xs text-gray-500">
                    {parsedData.rows.length} row{parsedData.rows.length !== 1 ? 's' : ''} detected
                    {' / '}
                    {parsedData.headers.length} column
                    {parsedData.headers.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetWizard}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Change file
              </button>
            </div>
          </div>

          {/* Duplicate warning */}
          {duplicateEmailCount > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                <span className="font-semibold">{duplicateEmailCount} duplicate email{duplicateEmailCount !== 1 ? 's' : ''}</span> found
                in your CSV — duplicates will be skipped.
              </p>
            </div>
          )}

          {/* Required field warning */}
          {!isCompanyNameMapped && (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-700">
                <span className="font-semibold">company_name</span> is required but not mapped to
                any column. Map it below to continue.
              </p>
            </div>
          )}

          {/* Column Mapping */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                <Table className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Column Mapping</h2>
                <p className="text-sm text-gray-500">
                  Map your CSV columns to DoAide Prospect fields
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {parsedData.headers.map((header, idx) => {
                const mapped = mappings[idx] || '';
                const targetField = TARGET_FIELDS.find((f) => f.value === mapped);
                const isRequired = targetField?.required;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5"
                  >
                    <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-sm font-mono text-gray-700 border border-gray-200">
                      {header}
                    </code>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
                    <select
                      value={mapped}
                      onChange={(e) => handleMappingChange(idx, e.target.value)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                        isRequired
                          ? 'border-blue-300 bg-blue-50 font-medium text-blue-700'
                          : autoMappedFields.has(idx) && mapped
                            ? 'border-blue-200 bg-blue-50/50 text-blue-600'
                            : mapped
                              ? 'border-gray-300 bg-white text-gray-700'
                              : 'border-gray-200 bg-white text-gray-400'
                      }`}
                    >
                      {TARGET_FIELDS.map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                          {field.required ? ' (required)' : ''}
                        </option>
                      ))}
                    </select>
                    {autoMappedFields.has(idx) && mapped && (
                      <span className="text-[10px] font-medium text-blue-500 whitespace-nowrap">Auto</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Duplicate Handling Options */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Duplicate Handling</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                Choose how to handle records that already exist in your database
              </p>
            </div>
            <div className="space-y-2">
              {DUPLICATE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
                    duplicateHandling === option.value
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="duplicateHandling"
                    value={option.value}
                    checked={duplicateHandling === option.value}
                    onChange={(e) => setDuplicateHandling(e.target.value)}
                    className="mt-0.5 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className={`text-sm font-medium ${
                      duplicateHandling === option.value ? 'text-blue-700' : 'text-gray-700'
                    }`}>
                      {option.label}
                    </p>
                    <p className="text-xs text-gray-500">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={resetWizard}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              disabled={!isCompanyNameMapped}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Preview Data
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Step 3: Preview                                                    */}
      {/* ================================================================= */}
      {currentStep === 2 && parsedData && (
        <div className="space-y-5">
          {/* File info bar */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedFile?.name}</p>
                  <p className="text-xs text-gray-500">
                    {parsedData.rows.length} row{parsedData.rows.length !== 1 ? 's' : ''} detected
                    {' / '}
                    {parsedData.headers.length} column
                    {parsedData.headers.length !== 1 ? 's' : ''}
                    {' / '}
                    Duplicate handling: {DUPLICATE_OPTIONS.find((o) => o.value === duplicateHandling)?.label}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Table */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">
              Preview (first {Math.min(previewRows.length, 10)} rows)
            </h3>

            {/* Validation summary */}
            {(() => {
              const emailColIdx = Object.entries(mappings).find(([, v]) => v === 'contact_email');
              const companyColIdx = Object.entries(mappings).find(([, v]) => v === 'company_name');
              let invalidEmails = 0;
              let emptyRequired = 0;
              for (const row of parsedData.rows) {
                if (emailColIdx) {
                  const val = row[Number(emailColIdx[0])] || '';
                  if (val.trim() && !isValidEmail(val)) invalidEmails++;
                }
                if (companyColIdx) {
                  const val = row[Number(companyColIdx[0])] || '';
                  if (!val.trim()) emptyRequired++;
                }
              }
              if (invalidEmails === 0 && emptyRequired === 0) return null;
              return (
                <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600" />
                  <span className="text-sm text-amber-800">Validation issues found:</span>
                  {invalidEmails > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                      {invalidEmails} invalid email{invalidEmails !== 1 ? 's' : ''}
                    </span>
                  )}
                  {emptyRequired > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                      {emptyRequired} empty company name{emptyRequired !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              );
            })()}

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500">
                      #
                    </th>
                    {parsedData.headers.map((header, idx) => {
                      const mapped = mappings[idx] || '';
                      const targetField = TARGET_FIELDS.find((f) => f.value === mapped);
                      return (
                        <th
                          key={idx}
                          className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500"
                        >
                          <div>{header}</div>
                          {mapped && (
                            <div
                              className={`mt-0.5 text-xs font-normal ${
                                targetField?.required ? 'text-blue-600' : 'text-green-600'
                              }`}
                            >
                              {'→'} {targetField?.label || mapped}
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIdx) => (
                    <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="whitespace-nowrap border-b border-gray-100 px-3 py-2 text-xs text-gray-400">
                        {rowIdx + 1}
                      </td>
                      {parsedData.headers.map((_, colIdx) => {
                        const cellValue = row[colIdx] || '';
                        const mappedField = mappings[colIdx] || '';
                        const isBadEmail = mappedField === 'contact_email' && cellValue.trim() && !isValidEmail(cellValue);
                        const isEmptyRequired = mappedField === 'company_name' && !cellValue.trim();
                        return (
                          <td
                            key={colIdx}
                            className={`whitespace-nowrap border-b border-gray-100 px-3 py-2 text-sm ${
                              isBadEmail
                                ? 'bg-red-50 text-red-700'
                                : isEmptyRequired
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'text-gray-700'
                            }`}
                            title={isBadEmail ? 'Invalid email format' : isEmptyRequired ? 'Required field is empty' : undefined}
                          >
                            {cellValue}
                            {isBadEmail && <AlertCircle className="ml-1 inline h-3 w-3 text-red-400" />}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedData.rows.length > 10 && (
              <p className="mt-2 text-xs text-gray-400">
                ...and {parsedData.rows.length - 10} more row
                {parsedData.rows.length - 10 !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Mapping
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!isCompanyNameMapped || importCSV.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importCSV.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting Import...
                </>
              ) : (
                <>
                  Start Import
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Step 4: Import Progress                                            */}
      {/* ================================================================= */}
      {currentStep === 3 && (
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900">Importing Your Data</h2>
              <p className="mb-6 text-sm text-gray-500">
                Processing {parsedData?.rows.length ?? 0} rows from {selectedFile?.name}...
              </p>
              <div className="w-full max-w-md">
                <ImportProgressBar isImporting={isImportRunning} isComplete={false} totalRows={parsedData?.rows.length ?? 0} />
              </div>
              <p className="mt-4 text-xs text-gray-400">
                Please do not close this page while the import is in progress.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Step 5: Summary                                                    */}
      {/* ================================================================= */}
      {currentStep === 4 && importResult && (
        <div className="space-y-5">
          {/* Success banner */}
          <div className="rounded-xl border border-green-200 bg-green-50 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-900">Import Complete</h3>
                <p className="text-sm text-green-700">Your CSV has been processed successfully.</p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-white p-3 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {importResult.imported_companies ?? 0}
                </p>
                <p className="text-xs text-gray-500">Companies</p>
              </div>
              <div className="rounded-lg bg-white p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {importResult.imported_contacts ?? 0}
                </p>
                <p className="text-xs text-gray-500">Contacts</p>
              </div>
              <div className="rounded-lg bg-white p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {importResult.skipped ?? 0}
                </p>
                <p className="text-xs text-gray-500">Skipped</p>
              </div>
              <div className="rounded-lg bg-white p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{errors.length}</p>
                <p className="text-xs text-gray-500">Errors</p>
              </div>
            </div>
          </div>

          {/* Error table */}
          {errors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <h3 className="text-sm font-semibold text-red-700">
                    {errors.length} Error{errors.length !== 1 ? 's' : ''}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadErrors}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Error Report
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-gray-50">
                      <th className="whitespace-nowrap border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500">
                        Row
                      </th>
                      <th className="border-b border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500">
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {errors.slice(0, 100).map((err, i) => {
                      const match = err.match(/^(?:Row\s+)?(\d+):?\s*(.*)$/i);
                      const rowNum = match ? match[1] : '-';
                      const message = match ? match[2] : err;
                      return (
                        <tr
                          key={i}
                          className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                        >
                          <td className="whitespace-nowrap border-b border-gray-100 px-3 py-2 font-mono text-xs text-gray-500">
                            {rowNum}
                          </td>
                          <td className="border-b border-gray-100 px-3 py-2 text-sm text-red-700">
                            {message}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {errors.length > 100 && (
                <p className="mt-2 text-xs text-gray-400">
                  Showing first 100 of {errors.length} errors. Download the full report above.
                </p>
              )}
            </div>
          )}

          {/* Import another */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={resetWizard}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4" />
              Import Another File
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Last Import Summary (persists across wizard resets)                */}
      {/* ================================================================= */}
      {currentStep === 0 && lastImportResult && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Check className="h-4 w-4 text-green-500" />
            Last Import
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-2.5 text-center">
              <p className="text-lg font-bold text-green-600">
                {lastImportResult.imported_companies ?? 0}
              </p>
              <p className="text-xs text-gray-500">Companies</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-2.5 text-center">
              <p className="text-lg font-bold text-blue-600">
                {lastImportResult.imported_contacts ?? 0}
              </p>
              <p className="text-xs text-gray-500">Contacts</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-2.5 text-center">
              <p className="text-lg font-bold text-yellow-600">
                {lastImportResult.skipped ?? 0}
              </p>
              <p className="text-xs text-gray-500">Skipped</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-2.5 text-center">
              <p className="text-lg font-bold text-red-600">
                {(lastImportResult.errors || []).length}
              </p>
              <p className="text-xs text-gray-500">Errors</p>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Import History (visible in all steps)                              */}
      {/* ================================================================= */}
      <ImportHistory history={importHistory} />
    </div>
  );
}
