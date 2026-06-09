import {
  getTransmissionStepStates,
  TRANSMISSION_PIPELINE_STEPS,
  type StepVisualState
} from "../lib/processamento-fiscal-ui";

type ProcessamentoStepperProps = {
  status: string;
  protocolo_serpro?: string | null;
  recibo_disponivel?: boolean;
  guia_fiscal_id?: string | null;
};

function stepClass(state: StepVisualState): string {
  return `fiscal-stepper__item fiscal-stepper__item--${state}`;
}

export function ProcessamentoStepper(props: ProcessamentoStepperProps): JSX.Element {
  const states = getTransmissionStepStates({
    status: props.status,
    protocolo_serpro: props.protocolo_serpro,
    recibo_disponivel: props.recibo_disponivel,
    guia_fiscal_id: props.guia_fiscal_id
  });

  return (
    <ol className="fiscal-stepper" data-testid="fiscal-transmission-stepper" aria-label="Etapas do processamento">
      {TRANSMISSION_PIPELINE_STEPS.map((step, i) => (
        <li key={step.key} className={stepClass(states[i] ?? "pending")}>
          <span className="fiscal-stepper__marker" aria-hidden="true">
            {states[i] === "done" ? "✓" : states[i] === "error" ? "!" : i + 1}
          </span>
          <span className="fiscal-stepper__label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
