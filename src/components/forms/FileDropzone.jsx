import { useEffect, useId, useMemo, useState } from 'react';
import { FileText, ImagePlus, Trash2, UploadCloud } from 'lucide-react';
import { cn } from '@/utils/cn';
import { UPLOAD_LIMITS } from '@/lib/constants';
import { validateFile } from '@/utils/storage';

/**
 * Single-file picker with drag & drop, preview and client-side validation.
 *  - file / onFileChange: the newly selected File (or null)
 *  - existingUrl / onRemoveExisting: a file already saved on the server
 * The bucket's limits are re-enforced by Supabase Storage on upload.
 */
export function FileDropzone({ bucket = 'item-images', file, onFileChange, existingUrl, onRemoveExisting, label, hint }) {
  const inputId = useId();
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const limits = UPLOAD_LIMITS[bucket];

  const previewUrl = useMemo(
    () => (file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const pick = (selected) => {
    if (!selected) return;
    const problem = validateFile(selected, bucket);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    onFileChange(selected);
  };

  const shownImage = previewUrl ?? (!file ? existingUrl : null);
  const allowed = limits.types.map((t) => t.split('/')[1].toUpperCase()).join(', ');
  const maxMb = Math.round(limits.maxBytes / 1024 / 1024);

  if (file || existingUrl) {
    return (
      <div className="space-y-1.5">
        {label && <p className="text-sm font-medium text-slate-700">{label}</p>}
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          {shownImage ? (
            <img src={shownImage} alt="Selected file preview" className="size-24 rounded-lg object-cover" />
          ) : (
            <div className="flex size-24 items-center justify-center rounded-lg bg-white text-slate-400">
              <FileText className="size-8" />
            </div>
          )}
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium text-slate-800">{file ? file.name : 'Current file'}</p>
            {file && <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <label
                htmlFor={inputId}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <ImagePlus className="size-3.5" /> Replace
              </label>
              <button
                type="button"
                onClick={() => (file ? onFileChange(null) : onRemoveExisting?.())}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                <Trash2 className="size-3.5" /> Remove
              </button>
            </div>
          </div>
          <input
            id={inputId}
            type="file"
            accept={limits.types.join(',')}
            className="sr-only"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {label && <p className="text-sm font-medium text-slate-700">{label}</p>}
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50/60 hover:border-brand-400 hover:bg-brand-50/40',
          error && 'border-red-300',
        )}
      >
        <UploadCloud className="size-8 text-slate-400" aria-hidden="true" />
        <span className="text-sm font-medium text-slate-700">
          <span className="text-brand-700">Choose a file</span> or drag it here
        </span>
        <span className="text-xs text-slate-500">
          {allowed} · up to {maxMb} MB
        </span>
        <input
          id={inputId}
          type="file"
          accept={limits.types.join(',')}
          className="sr-only"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      {error ? (
        <p className="text-xs text-red-600" role="alert">{error}</p>
      ) : (
        hint && <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}
