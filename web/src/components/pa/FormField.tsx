"use client";

import { InputGroup, TextField } from "@heroui/react";

interface FormFieldProps {
  label: string;
  value: string;
  type?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

/** 弹窗表单单行输入（前缀标签 + 输入框范式） */
export default function FormField({ label, value, type, onChange, placeholder }: FormFieldProps) {
  return (
    <TextField value={value} onChange={onChange} aria-label={label}>
      <InputGroup>
        <InputGroup.Prefix className="w-24">{label}</InputGroup.Prefix>
        <InputGroup.Input
          type={type}
          placeholder={placeholder ?? (type ? undefined : `Please input ${label.toLowerCase()}`)}
        />
      </InputGroup>
    </TextField>
  );
}
