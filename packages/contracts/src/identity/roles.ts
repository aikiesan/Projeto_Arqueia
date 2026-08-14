import { z } from 'zod';

export const laboratoryRoleSchema = z.enum([
  'USUARIO',
  'TECNICO',
  'RESPONSAVEL_CONTROLADOS',
]);

export const systemRoleSchema = z.enum(['ADMIN']);
export const roleSchema = z.union([laboratoryRoleSchema, systemRoleSchema]);
export const roleScopeSchema = z.enum(['LABORATORY', 'SYSTEM']);

export type LaboratoryRole = z.infer<typeof laboratoryRoleSchema>;
export type SystemRole = z.infer<typeof systemRoleSchema>;
export type Role = z.infer<typeof roleSchema>;
export type RoleScope = z.infer<typeof roleScopeSchema>;

export const ROLE_DEFINITIONS = [
  { role: 'USUARIO', scope: 'LABORATORY' },
  { role: 'TECNICO', scope: 'LABORATORY' },
  { role: 'RESPONSAVEL_CONTROLADOS', scope: 'LABORATORY' },
  { role: 'ADMIN', scope: 'SYSTEM' },
] as const satisfies ReadonlyArray<{ role: Role; scope: RoleScope }>;
