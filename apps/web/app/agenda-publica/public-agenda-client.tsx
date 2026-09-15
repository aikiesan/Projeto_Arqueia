'use client';

import type { PublicLaboratory, PublicScheduleResponse } from '@arqueia/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { basePathFetch, withBasePath } from '../lib/base-path';

/** Segunda-feira 00:00 da semana que contém a data, no fuso do navegador. */
function startOfWeek(reference: Date): Date {
  const date = new Date(reference);
  const weekday = (date.getDay() + 6) % 7; // 0 = segunda
  date.setDate(date.getDate() - weekday);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const dayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
const timeLabel = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const rangeLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function PublicAgendaClient(): React.JSX.Element {
  const [laboratories, setLaboratories] = useState<readonly PublicLaboratory[]>([]);
  const [laboratoryId, setLaboratoryId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [schedule, setSchedule] = useState<PublicScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  useEffect(() => {
    let active = true;
    basePathFetch('/api/public/laboratories', { cache: 'no-store' })
      .then((response) => (response.ok ? (response.json() as Promise<PublicLaboratory[]>) : []))
      .then((list) => {
        if (!active) return;
        setLaboratories(list);
        setLaboratoryId((current) => current ?? list[0]?.id ?? null);
        if (list.length === 0) {
          setLoading(false);
          setError('Nenhum laboratório disponível para consulta pública.');
        }
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          setError('Não foi possível carregar os laboratórios.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async (): Promise<void> => {
    if (!laboratoryId) return;
    setLoading(true);
    setError(null);

    const query = new URLSearchParams({
      laboratoryId,
      startsAt: weekStart.toISOString(),
      endsAt: weekEnd.toISOString(),
    });

    try {
      const response = await basePathFetch(`/api/public/schedule?${query.toString()}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        setSchedule(null);
        setError('Não foi possível carregar a agenda agora. Tente novamente em instantes.');
        return;
      }
      setSchedule((await response.json()) as PublicScheduleResponse);
    } catch {
      setSchedule(null);
      setError('Falha de conexão ao carregar a agenda.');
    } finally {
      setLoading(false);
    }
  }, [laboratoryId, weekStart, weekEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const days = useMemo(() => {
    const items = schedule?.items ?? [];
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(weekStart, index);
      const next = addDays(day, 1);
      return {
        day,
        items: items.filter((item) => {
          const start = new Date(item.startsAt);
          return start >= day && start < next;
        }),
      };
    });
  }, [schedule, weekStart]);

  const isCurrentWeek = startOfWeek(new Date()).getTime() === weekStart.getTime();

  return (
    <main className="public-agenda">
      <header className="public-agenda-header">
        <a className="public-agenda-brand" href={withBasePath('/login')}>
          <span className="public-agenda-brand-mark" aria-hidden="true" />
          <span>
            <strong>Arqueia</strong>
            <small>Agenda pública de equipamentos</small>
          </span>
        </a>
        <a className="public-agenda-login" href={withBasePath('/login')}>
          Entrar para reservar
        </a>
      </header>

      <section className="public-agenda-controls">
        {laboratories.length > 1 ? (
          <label className="public-agenda-lab">
            <span className="sr-only">Laboratório</span>
            <select
              onChange={(event) => setLaboratoryId(event.target.value)}
              value={laboratoryId ?? ''}
            >
              {laboratories.map((laboratory) => (
                <option key={laboratory.id} value={laboratory.id}>
                  {laboratory.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <h1>{schedule?.laboratory.name ?? 'Agenda de equipamentos'}</h1>
        )}

        <div className="public-agenda-nav">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} type="button">
            ‹ Semana anterior
          </button>
          <button
            disabled={isCurrentWeek}
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            type="button"
          >
            Esta semana
          </button>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} type="button">
            Próxima semana ›
          </button>
        </div>

        <p className="public-agenda-range">
          {rangeLabel.format(weekStart)} – {rangeLabel.format(addDays(weekStart, 6))}
        </p>
      </section>

      {error ? <p className="public-agenda-error">{error}</p> : null}

      {loading && !schedule ? (
        <p className="public-agenda-loading">Carregando agenda…</p>
      ) : (
        <div className="public-agenda-week">
          {days.map(({ day, items }) => (
            <section className="public-agenda-day" key={day.toISOString()}>
              <h2>{dayLabel.format(day)}</h2>
              {items.length === 0 ? (
                <p className="public-agenda-free">Sem reservas</p>
              ) : (
                <ul>
                  {items.map((item, index) => (
                    <li
                      className={item.type === 'TECHNICAL_BLOCK' ? 'is-block' : undefined}
                      key={`${item.startsAt}-${item.equipmentCode}-${index}`}
                    >
                      <span className="public-agenda-time">
                        {timeLabel.format(new Date(item.startsAt))}–
                        {timeLabel.format(new Date(item.endsAt))}
                      </span>
                      <span className="public-agenda-equipment">{item.equipmentName}</span>
                      <span className="public-agenda-who">
                        {item.type === 'TECHNICAL_BLOCK'
                          ? 'Bloqueio técnico'
                          : (item.reservedBy ?? 'Reservado')}
                        {item.inProgress ? <em> · em uso</em> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <footer className="public-agenda-footer">
        <p>
          Esta página é pública e mostra as reservas da semana. Para reservar um equipamento ou
          fazer check-in, entre no sistema.
        </p>
      </footer>
    </main>
  );
}
