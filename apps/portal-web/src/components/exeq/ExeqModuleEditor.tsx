import { PORTAL_MODULE_LABELS, type PortalModuleFlags, type PortalModuleKey } from "../../lib/exeq-api";

const MODULE_KEYS = Object.keys(PORTAL_MODULE_LABELS) as PortalModuleKey[];

type Props = {
  modules: PortalModuleFlags;
  onChange: (next: PortalModuleFlags) => void;
  disabled?: boolean;
};

export function ExeqModuleEditor({ modules, onChange, disabled }: Props): JSX.Element {
  function toggle(key: PortalModuleKey): void {
    onChange({ ...modules, [key]: !modules[key] });
  }

  return (
    <div className="exeq-module-editor">
      {MODULE_KEYS.map((key) => (
        <label key={key} className={`exeq-module-card${modules[key] ? " exeq-module-card--on" : ""}`}>
          <input
            type="checkbox"
            checked={modules[key]}
            onChange={() => toggle(key)}
            disabled={disabled}
          />
          <span className="exeq-module-card__label">{PORTAL_MODULE_LABELS[key]}</span>
        </label>
      ))}
    </div>
  );
}
