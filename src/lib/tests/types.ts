/** Test senaryosu tipleri (UI + saklama). */

export interface TestScenario {
  id: string;
  name: string;
  inputs: string;
  expected: string;
}

export function newScenarioId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function scenarioFrom(inputs = '', expected = '', name = ''): TestScenario {
  return { id: newScenarioId(), name, inputs, expected };
}
