import { ArqueiaIcon } from '@arqueia/ui';

import { GoodPracticesGuide } from '../components/good-practices/good-practices-guide';
import { withBasePath } from '../lib/base-path';

/**
 * Boas práticas de laboratório — página pública, sem login: quem ainda não tem
 * conta (aluno novo, visitante) também precisa das regras antes de entrar.
 */
export function BoasPraticasPublic(): React.JSX.Element {
  return (
    <main className="public-agenda gp-public">
      <header className="public-agenda-header">
        <a className="public-agenda-brand" href={withBasePath('/login')}>
          <span className="public-agenda-brand-mark" aria-hidden="true" />
          <span>
            <strong>Arqueia</strong>
            <small>Boas práticas de laboratório</small>
          </span>
        </a>
        <div className="public-agenda-actions">
          <a className="public-agenda-report" href={withBasePath('/informar')}>
            <ArqueiaIcon name="informar" size={18} />
            Informar
          </a>
          <a className="public-agenda-login" href={withBasePath('/agenda-publica')}>
            <ArqueiaIcon name="agenda" size={18} />
            Ver agenda
          </a>
        </div>
      </header>

      <section className="gp-public-intro">
        <span className="section-kicker">Segurança no laboratório · CP2b</span>
        <h1>Boas práticas de laboratório</h1>
        <p>
          O que fazer antes de entrar, durante o trabalho e em caso de acidente. Leia antes do
          primeiro uso e volte aqui sempre que tiver dúvida.
        </p>
      </section>

      <GoodPracticesGuide headingLevel={2} />

      <footer className="public-agenda-footer">
        <p>
          Esta página é pública. Dúvidas ou algo fora do lugar no laboratório? Use o Informar para
          avisar a coordenação.
        </p>
      </footer>
    </main>
  );
}
