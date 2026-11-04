"use client";

import { Label, ListBox, ListBoxItem, Select } from "@heroui/react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** 下拉选择（HeroUI Select + ListBox 范式），value 为空串表示未选择 */
export default function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  className,
}: SelectFieldProps) {
  return (
    <div className="flex items-center gap-2">
      {label && <Label className="shrink-0">{label}</Label>}
      <Select
        aria-label={label || placeholder || "select"}
        className={className ?? "w-48"}
        selectedKey={value || null}
        onSelectionChange={(key) => onChange(key == null ? "" : String(key))}
        placeholder={placeholder}
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {options.map((opt) => (
              <ListBoxItem key={opt.value} id={opt.value} textValue={opt.label}>
                {opt.label}
              </ListBoxItem>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
