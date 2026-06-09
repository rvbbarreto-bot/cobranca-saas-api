export type ViaCepResult = {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
};

export async function fetchViaCep(cepDigits: string): Promise<ViaCepResult | null> {
  if (cepDigits.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
  if (!res.ok) return null;
  const data = (await res.json()) as ViaCepResult;
  if (data.erro) return null;
  return data;
}
