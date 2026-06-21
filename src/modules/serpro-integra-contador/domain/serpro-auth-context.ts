/** Contexto de autenticação SERPRO Integra Contador. */
export type SerproAuthContext = {
  accessToken: string;
  /** Header `jwt_token` — retornado pelo SAPI /authenticate com e-CNPJ (mTLS). */
  jwtToken?: string;
  /** Header `autenticar_procurador_token` — AUTENTICAPROCURADOR/ENVIOXMLASSINADO81 (procurador). */
  procuradorToken?: string;
};
