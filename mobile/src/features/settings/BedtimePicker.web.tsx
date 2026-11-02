import { createElement } from 'react';

export function BedtimePicker({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return createElement('input', {
    type: 'time', value, 'aria-label': label,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    style: { minHeight: 44, fontSize: 16, colorScheme: 'light dark' },
  });
}
