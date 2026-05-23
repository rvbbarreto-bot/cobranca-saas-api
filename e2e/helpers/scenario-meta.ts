/** Metadados BDD anexados ao título do teste (Feature / Cenário). */
export type ScenarioMeta = {
  feature: string;
  scenario: string;
  tags?: string[];
};

export function feature(name: string): { scenario: (title: string) => ScenarioMeta } {
  return {
    scenario: (scenario: string) => ({ feature: name, scenario })
  };
}
