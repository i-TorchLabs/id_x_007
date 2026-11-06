"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { InputGroup, TextField } from "@heroui/react";
import { IoEyeOffOutline, IoEyeOutline } from "react-icons/io5";

interface PasswordInputProps {
  /** 前缀标签文案 */
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** 前缀标签宽度类（与所在表单其他字段对齐），默认 w-20 */
  labelClassName?: string;
  maxLength?: number;
}

/** 密码输入框：眼睛图标置于输入框内部右侧，点击切换明文/密文显示 */
export default function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
  labelClassName = "w-20",
  maxLength,
}: PasswordInputProps) {
  const t = useTranslations("common");
  const [visible, setVisible] = useState(false);

  return (
    <TextField value={value} onChange={onChange} type={visible ? "text" : "password"}>
      {/* relative：为按钮的绝对定位提供参照；输入框 pr-10 为图标预留空间 */}
      <InputGroup className="relative">
        <InputGroup.Prefix className={labelClassName}>{label}</InputGroup.Prefix>
        <InputGroup.Input className="pr-10" placeholder={placeholder} maxLength={maxLength} />
        {/* 不用 InputGroup.Suffix（其带左边框，视觉在输入框外）；
            stopPropagation 阻止 InputGroup 将点击转发为 input 聚焦（移动端弹键盘） */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setVisible((v) => !v);
          }}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          title={visible ? t("hidePassword") : t("showPassword")}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:text-[#5b2a86] hover:bg-black/5 transition-colors outline-none"
        >
          {visible ? <IoEyeOffOutline size={18} /> : <IoEyeOutline size={18} />}
        </button>
      </InputGroup>
    </TextField>
  );
}
