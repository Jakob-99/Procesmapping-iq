"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/*
  Topbaren kender kun URL'en, ikke de rigtige navne bag id'erne i den (proces,
  underproces …). Siderne der har de navne — de har jo allerede hentet dem fra
  databasen — melder dem herind med <SetBreadcrumb>, så topbaren kan vise den
  fulde sti i stedet for bare sektionsnavnet.
*/

export type Crumb = { label: string; href?: string };

const BreadcrumbContext = createContext<{
  crumbs: Crumb[] | null;
  setCrumbs: (c: Crumb[] | null) => void;
} | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[] | null>(null);
  return (
    <BreadcrumbContext.Provider value={{ crumbs, setCrumbs }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumb() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) throw new Error("useBreadcrumb skal bruges inden i BreadcrumbProvider");
  return ctx.crumbs;
}

// Rendres af den enkelte side — rydder automatisk op igen når man navigerer væk.
export function SetBreadcrumb({ items }: { items: Crumb[] }) {
  const ctx = useContext(BreadcrumbContext);
  const key = JSON.stringify(items);

  useEffect(() => {
    ctx?.setCrumbs(items);
    return () => ctx?.setCrumbs(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
