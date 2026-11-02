import { useState } from 'react';
import { Platform } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Button } from '@/components/ui/Button';
import { parseBedtime, formatBedtime, DEFAULT_BEDTIME } from './bedtime-value';

export function BedtimePicker({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [visible, setVisible] = useState(false);
  const bedtime = parseBedtime(value) ?? DEFAULT_BEDTIME;
  const date = new Date();
  date.setHours(bedtime.hour, bedtime.minute, 0, 0);
  const change = (next: Date) => onChange(formatBedtime({ hour: next.getHours(), minute: next.getMinutes() }));
  function open() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: date, mode: 'time', is24Hour: true, onChange: (event, next) => { if (event.type === 'set' && next) change(next); } });
    } else setVisible(!visible);
  }
  return <>
    <Button label={`${label}: ${value}`} onPress={open} />
    {visible && Platform.OS === 'ios' ? <DateTimePicker value={date} mode="time" display="spinner" onChange={(_event, next) => { if (next) change(next); }} /> : null}
  </>;
}
