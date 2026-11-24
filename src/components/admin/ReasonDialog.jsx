import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { FormField, Textarea } from '@/components/common/FormControls';

/**
 * Confirmation that collects a note. `required` makes the note mandatory
 * (the database also rejects rejections without a reason).
 * Mount it with a `key` per target so the text resets between uses.
 */
export function ReasonDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  label = 'Notes',
  placeholder,
  required = false,
  confirmLabel = 'Confirm',
  tone = 'primary',
  loading = false,
  children,
}) {
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);
  const missing = required && !notes.trim();

  const submit = () => {
    setTouched(true);
    if (!missing) onConfirm(notes.trim());
  };

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      dismissible={!loading}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={submit} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {children}
        <FormField label={label} required={required} error={touched && missing ? 'This field is required' : undefined}>
          <Textarea rows={3} value={notes} placeholder={placeholder} onChange={(e) => setNotes(e.target.value)} data-autofocus />
        </FormField>
      </div>
    </Modal>
  );
}
