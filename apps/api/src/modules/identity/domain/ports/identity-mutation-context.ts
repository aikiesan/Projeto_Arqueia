export interface IdentityMutationContext {
  readonly actorId: string;
  readonly origin: string;
  readonly requestId: string | null;
}
