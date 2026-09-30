/**
 * Campo-armadilha do formulário público de informes. Fica invisível para
 * pessoas; robôs que preenchem tudo o preenchem. Quando vem preenchido, o BFF
 * responde como se tivesse dado certo e não grava nada — o robô não aprende a
 * contornar. Compartilhado entre a página e a rota para não divergir.
 */
export const FIELD_REPORT_HONEYPOT_FIELD = 'website';
