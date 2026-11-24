"use client";

import styles from "@/components/dashboard/registry.module.css";
import { linkProfessionalService, unlinkProfessionalService } from "@/features/schedule/actions";
import { TeamForm, TeamSelect } from "../../team-form";

export function LinkServiceForm({ professionalId, options }: {
  professionalId: string;
  options: { id: string; name: string }[];
}) {
  return (
    <TeamForm action={linkProfessionalService}>
      {(_state, pending) => (
        <>
          <input type="hidden" name="professional_id" value={professionalId} />
          <TeamSelect label="Serviço disponível" name="service_id">
            <option value="">Selecione um serviço</option>
            {options.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </TeamSelect>
          <div className={styles.actions}>
            <button type="submit" className="primary-button">{pending ? "Vinculando…" : "Vincular serviço"}</button>
          </div>
        </>
      )}
    </TeamForm>
  );
}

export function UnlinkServiceForm({ professionalId, serviceId }: { professionalId: string; serviceId: string }) {
  return (
    <TeamForm action={unlinkProfessionalService} compact>
      {(_state, pending) => (
        <>
          <input type="hidden" name="professional_id" value={professionalId} />
          <input type="hidden" name="service_id" value={serviceId} />
          <button type="submit" className={styles.secondary}>{pending ? "Desvinculando…" : "Desvincular"}</button>
        </>
      )}
    </TeamForm>
  );
}
