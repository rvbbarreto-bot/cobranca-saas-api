import {
  getProviderMeta,
  listAvailableProviders,
  type GatewayProviderMeta
} from "../../../platform/payment-gateway/provider-registry";

export function listGatewayProvidersUseCase(): GatewayProviderMeta[] {
  return listAvailableProviders();
}

export function getGatewayProviderSchemaUseCase(provider: string): GatewayProviderMeta {
  return getProviderMeta(provider);
}
