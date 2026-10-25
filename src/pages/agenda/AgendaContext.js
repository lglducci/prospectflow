import { createContext, useContext } from "react";
export const AgendaContext = createContext(null);
export function useAgendaContext() {
  const c = useContext(AgendaContext);
  if (!c) throw Error("AgendaContext ausente.");
  return c;
}
