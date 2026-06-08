import { PORTAL_MODULE_LABELS, type PortalModuleFlags, type PortalModuleKey } from "../../lib/exeq-api";

const MODULE_KEYS = Object.keys(PORTAL_MODULE_LABELS) as PortalModuleKey[];

type Props = {
  modules: PortalModuleFlags;
  compact?: boolean;
};

export function ExeqModulePills({ modules, compact = false }: Props): JSX.Element {
  const enabled = MODULE_KEYS.filter((k) => modules[k]);
  if (enabled.length === 0) {
    return <span className="exeq-pill exeq-pill--muted">Sem módulos</span>;
  }
  return (
    <div className={`exeq-module-pills${compact ? " exeq-module-pills--compact" : ""}`}>
      {enabled.map((key) => (
        <span key={key} className="exeq-pill exeq-pill--module" title={PORTAL_MODULE_LABELS[key]}>
          {compact ? key.replace("_", " ") : PORTAL_MODULE_LABELS[key]}
        </span>
      ))}
    </div>
  );
}
