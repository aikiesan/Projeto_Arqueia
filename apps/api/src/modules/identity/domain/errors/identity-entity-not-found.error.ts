export type IdentityEntity =
  | 'User'
  | 'Laboratory'
  | 'Project'
  | 'Membership'
  | 'SystemRoleAssignment';

export class IdentityEntityNotFoundError extends Error {
  public constructor(
    public readonly entity: IdentityEntity,
    public readonly entityId: string,
  ) {
    super(`${entity} ${entityId} não encontrado.`);
    this.name = 'IdentityEntityNotFoundError';
  }
}
