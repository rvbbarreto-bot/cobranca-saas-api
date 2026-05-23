import { useRef, type FocusEvent } from "react";
import { CURRENCY_ZERO_BR, maskCurrencyBrInput, parseCurrencyBrInput } from "../lib/format-br";

type Props = {
  id: string;
  value: string;
  onChange: (display: string, amount: number | null) => void;
  disabled?: boolean;
  required?: boolean;
};

export function CurrencyInput({ id, value, onChange, disabled, required }: Props): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  function onFocus(e: FocusEvent<HTMLInputElement>): void {
    if (!value.trim()) {
      onChange(CURRENCY_ZERO_BR, 0);
    }
    e.target.select();
  }

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onFocus={onFocus}
      onChange={(e) => {
        const masked = maskCurrencyBrInput(e.target.value);
        onChange(masked, parseCurrencyBrInput(masked));
      }}
      disabled={disabled}
      required={required}
      placeholder={CURRENCY_ZERO_BR}
    />
  );
}
