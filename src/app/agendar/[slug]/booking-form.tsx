"use client";

import { useRef, useState, type FormEvent } from "react";
import styles from "@/components/dashboard/registry.module.css";
import type { PublicCatalog, PublicConfirmation } from "@/features/public-booking/data";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function BookingForm({ slug, catalog, today, limit }: {
  slug: string; catalog: PublicCatalog; today: string; limit: string;
}) {
  const [selected, setSelected] = useState(catalog.offers.length === 1 ? "0" : "");
  const [day, setDay] = useState(today);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [start, setStart] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<PublicConfirmation | null>(null);
  const attempt = useRef<{ request: string; id: string } | null>(null);
  const busy = useRef(false);
  const offer = selected === "" ? null : catalog.offers[Number(selected)];
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit", minute: "2-digit", timeZoneName: "shortOffset", timeZone: catalog.timezone,
  });

  function resetSlots() {
    setSlots(null);
    setStart("");
    setMessage("");
    attempt.current = null;
  }

  async function send(event: FormEvent<HTMLFormElement>, reserve: boolean) {
    event.preventDefault();
    if (!offer || busy.current || (reserve && !start)) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    const selection = { service: offer.service, professional: offer.professional, day };
    const booking = { ...selection, start, name, phone, price: offer.price, minutes: offer.minutes };
    const request = JSON.stringify(booking);
    if (reserve && attempt.current?.request !== request) attempt.current = { request, id: crypto.randomUUID() };
    try {
      const response = await fetch(`/api/agendar/${slug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reserve ? { kind: "reserve", ...booking, attempt: attempt.current?.id } : { kind: "slots", ...selection }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message ?? "Não foi possível continuar. Tente novamente.");
        if (data.error === "conflict") {
          setSlots(null);
          setStart("");
          attempt.current = null;
        }
        return;
      }
      if (reserve) setResult(data);
      else {
        setSlots(data.slots);
        setStart("");
      }
    } catch {
      setMessage("A conexão falhou. Tente novamente.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (result) return <div role="status">
    <h2 className={styles.panelHeading}>Agendamento confirmado</h2>
    <p>{result.name} · {result.service} · {result.professional}</p>
    <p>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: result.timezone })
      .format(new Date(result.start))} · {currency.format(result.price / 100)}</p>
  </div>;

  return <>
    <form className={styles.form} aria-busy={pending} onSubmit={(event) => send(event, false)}>
      <div className={styles.field}>
        <label htmlFor="public-offer">Serviço e barbeiro</label>
        <select id="public-offer" required disabled={pending} value={selected}
          onChange={(event) => { setSelected(event.currentTarget.value); resetSlots(); }}>
          <option value="">Escolha uma opção</option>
          {catalog.offers.map((item, index) => <option key={`${item.service}-${item.professional}`} value={index}>
            {item.name} · {item.professionalName} · {currency.format(item.price / 100)}
          </option>)}
        </select>
        {offer && <p>{offer.minutes} min{offer.description && ` · ${offer.description}`}{offer.specialties && ` · ${offer.specialties}`}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="public-day">Data</label>
        <input id="public-day" type="date" value={day} min={today} max={limit} required disabled={pending}
          onChange={(event) => { setDay(event.currentTarget.value); resetSlots(); }} />
      </div>
      <button className={styles.secondary} disabled={pending}>Buscar horários</button>
    </form>
    {message && <p role="alert" className={`${styles.error} mt-4`}>{message}</p>}
    {slots?.length === 0 && <p role="status" className={`${styles.muted} mt-4`}>Nenhum horário disponível nessa data.</p>}
    {slots && slots.length > 0 && <form className={styles.form} aria-busy={pending} onSubmit={(event) => send(event, true)}>
      <div className={styles.field}>
        <label htmlFor="public-slot">Horário</label>
        <select id="public-slot" value={start} required disabled={pending} onChange={(event) => setStart(event.currentTarget.value)}>
          <option value="">Escolha um horário</option>
          {slots.map((slot) => <option key={slot} value={slot}>{time.format(new Date(slot))}</option>)}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="public-name">Seu nome</label>
        <input id="public-name" autoComplete="name" minLength={2} maxLength={100} required disabled={pending}
          value={name} onChange={(event) => setName(event.currentTarget.value)} />
      </div>
      <div className={styles.field}>
        <label htmlFor="public-phone">Telefone com DDD</label>
        <input id="public-phone" type="tel" autoComplete="tel" placeholder="(86) 99999-0000" required maxLength={32} disabled={pending}
          value={phone} onChange={(event) => setPhone(event.currentTarget.value)} />
      </div>
      {offer && start && <p>{offer.name} · {offer.professionalName} · {day.split("-").reverse().join("/")} às {time.format(new Date(start))} · {currency.format(offer.price / 100)}</p>}
      <button className="primary-button" disabled={pending}>{pending ? "Confirmando…" : "Confirmar agendamento"}</button>
    </form>}
  </>;
}
