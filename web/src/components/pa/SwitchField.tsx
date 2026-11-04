"use client";

import { Switch } from "@heroui/react";

interface SwitchFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** 开关（HeroUI Switch 复合组件封装） */
export default function SwitchField({ label, checked, onChange, disabled }: SwitchFieldProps) {
  return (
    <Switch
      isSelected={checked}
      onChange={onChange}
      isDisabled={disabled}
      aria-label={label}
    >
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        {label}
      </Switch.Content>
    </Switch>
  );
}
