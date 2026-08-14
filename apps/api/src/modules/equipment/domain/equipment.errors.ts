export class EquipmentNotFoundError extends Error {
  public constructor(equipmentId: string) {
    super(`Equipamento não encontrado: ${equipmentId}.`);
    this.name = 'EquipmentNotFoundError';
  }
}

export class EquipmentConflictError extends Error {
  public constructor() {
    super('Já existe um equipamento ativo com o código informado neste laboratório.');
    this.name = 'EquipmentConflictError';
  }
}

export class EquipmentReferenceError extends Error {
  public constructor() {
    super('Modelo, espaço ou bancada não é uma opção válida do laboratório informado.');
    this.name = 'EquipmentReferenceError';
  }
}
