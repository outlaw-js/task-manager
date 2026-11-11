"use client";

import DatePicker, { DateObject } from "react-multi-date-picker";
import TimePicker from "react-multi-date-picker/plugins/time_picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

const toDate = (d: unknown) => (d instanceof DateObject ? d.toDate() : null);

/** A single Jalali date (and time) picker for task deadlines. */
export function DeadlinePicker({ value, onChange, id }: { value: string | null; onChange: (iso: string | null) => void; id?: string }) {
  return (
    <DatePicker
      id={id}
      value={value ? new Date(value) : null}
      onChange={(d) => {
        const date = toDate(d);
        onChange(date ? date.toISOString() : null);
      }}
      calendar={persian}
      locale={persian_fa}
      format="dddd D MMMM YYYY - HH:mm"
      plugins={[<TimePicker key="time" position="bottom" hideSeconds />]}
      calendarPosition="bottom-right"
      inputClass="input"
      placeholder="انتخاب تاریخ و ساعت"
      portal
      zIndex={80}
      editable={false}
    />
  );
}

/** A Jalali date range picker used by the deadline filter. */
export function RangePicker({ value, onChange }: { value: [string, string] | null; onChange: (range: [string, string] | null) => void }) {
  return (
    <DatePicker
      range
      rangeHover
      value={value ? value.map((v) => new Date(v)) : []}
      onChange={(dates) => {
        const list = Array.isArray(dates) ? dates : [];
        if (list.length === 2) onChange([list[0].toDate().toISOString(), list[1].toDate().toISOString()]);
        else if (list.length === 0) onChange(null);
      }}
      calendar={persian}
      locale={persian_fa}
      format="YYYY/MM/DD"
      dateSeparator=" تا "
      calendarPosition="bottom-right"
      inputClass="input !w-52 !py-1.5"
      placeholder="بازه تاریخ"
      portal
      zIndex={80}
      editable={false}
    />
  );
}
