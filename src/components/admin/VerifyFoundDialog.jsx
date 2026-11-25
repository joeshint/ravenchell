import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useLocations } from '@/hooks/useLookups';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { FormField, Input, Select, Textarea } from '@/components/common/FormControls';
import { Alert } from '@/components/common/Feedback';

const MAX_QUESTIONS = 5;
const SUGGESTIONS = [
  'What brand or model is it?',
  'Describe any marks, stickers or damage.',
  'What was inside it?',
  'What is shown on the lock screen / wallpaper?',
  'What name or initials are written on it?',
];

/**
 * Verify a found item: set the questions claimants must answer (answers are
 * compared by an admin against the private identifying details) and confirm
 * where the item is kept. Mount with a `key` per item.
 */
export function VerifyFoundDialog({ open, onClose, item, privateDetails, onConfirm, loading }) {
  const [questions, setQuestions] = useState(item.verification_questions?.length ? item.verification_questions : ['']);
  const [custody, setCustody] = useState(item.custody_location_id ?? '');
  const [notes, setNotes] = useState('');
  const { data: locations = [] } = useLocations(item.campus_id, { activeOnly: true });
  const custodyOptions = locations.filter((l) => l.is_custody_point || l.id === item.custody_location_id);

  const update = (i, v) => setQuestions((qs) => qs.map((q, j) => (j === i ? v : q)));
  // Trimmed, non-empty and without (case-insensitive) duplicates.
  const filled = questions
    .map((q) => q.trim())
    .filter((q, i, all) => q && all.findIndex((o) => o.toLowerCase() === q.toLowerCase()) === i);

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      dismissible={!loading}
      size="lg"
      title={`Verify ${item.reference_no}`}
      description="The item will be listed publicly and become claimable."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button loading={loading} onClick={() => onConfirm({ questions: filled, custodyLocationId: custody, notes })}>
            Verify and publish
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Alert tone="info" title="Before publishing">
          Check that the public description and photo do not reveal identifying details (names, ID numbers, serial
          numbers, wallpaper). Those belong in the private details and the questions below.
        </Alert>

        {privateDetails?.identifying_details && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="text-xs font-medium text-slate-500">Finder's private identifying details</p>
            <p className="mt-1 whitespace-pre-line text-slate-800">{privateDetails.identifying_details}</p>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-slate-700">Verification questions</p>
          <p className="mb-3 text-xs text-slate-500">
            Claimants must answer these. Ask about details only the owner would know. Up to {MAX_QUESTIONS}.
          </p>
          <ol className="space-y-2">
            {questions.map((q, i) => (
              <li key={i} className="flex gap-2">
                <label className="sr-only" htmlFor={`vq-${i}`}>
                  Question {i + 1}
                </label>
                <Input id={`vq-${i}`} value={q} onChange={(e) => update(i, e.target.value)} placeholder={SUGGESTIONS[i % SUGGESTIONS.length]} maxLength={300} />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove question ${i + 1}`}
                  onClick={() => setQuestions((qs) => (qs.length === 1 ? [''] : qs.filter((_, j) => j !== i)))}
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ol>
          {questions.length < MAX_QUESTIONS && (
            <Button variant="ghost" size="sm" icon={Plus} className="mt-2" onClick={() => setQuestions((qs) => [...qs, ''])}>
              Add question
            </Button>
          )}
          {filled.length === 0 && (
            <p className="mt-2 text-xs text-amber-700">No questions: claimants will only describe ownership in their own words.</p>
          )}
        </div>

        <FormField label="Kept at" hint="Where claimants will pick up the item.">
          <Select value={custody} onChange={(e) => setCustody(e.target.value)} placeholder="Not specified">
            {custodyOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Internal note (optional)" hint="Saved in the status history; the finder can see it.">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}
