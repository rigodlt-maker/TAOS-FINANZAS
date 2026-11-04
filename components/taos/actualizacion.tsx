"use client";

// Actualizaciones de TAOS (igual en las 4 apps; estilos propios para no depender del diseño de cada una):
//   - "Novedades": la primera vez que abres la app después de que se actualizó, te dice qué hay de nuevo.
//   - "Hay una versión nueva": si TAOS ya publicó otra versión, avisa que se instala sola esta noche
//     (o al momento con "Actualizar ahora", que abre el botón de GitHub del comprador).
// La versión de esta app está en taos-version.json; la publicada, en el mismo archivo del repositorio de TAOS.
import { useEffect, useState } from "react";
import info from "@/taos-version.json";

type Version = { version: string; fecha?: string; novedades: string[] };

const VISTA = "taos-version-vista";
const OCULTA = "taos-version-oculta";

// "1.10.0" > "1.9.2"
export function esMasNueva(a: string, b: string): boolean {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

const leer = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const guardar = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

const ORO = "#d4af37";
const caja: React.CSSProperties = { border: `1px solid ${ORO}99`, background: "#151515", borderRadius: 16, padding: "14px 16px", margin: "0 0 16px", color: "#fff" };
const boton: React.CSSProperties = { minHeight: 44, borderRadius: 12, padding: "0 16px", fontWeight: 600, fontSize: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };

export function Actualizacion({ repo }: { repo: string }) {
  const actual = info as Version;
  const [novedades, setNovedades] = useState(false);
  const [nueva, setNueva] = useState<Version | null>(null);

  useEffect(() => {
    const vista = leer(VISTA);
    if (!vista) guardar(VISTA, actual.version); // recién instalada: no hay "novedades" que contar
    else if (esMasNueva(actual.version, vista)) setNovedades(true);
    // ¿Ya hay otra versión publicada?
    fetch(`https://raw.githubusercontent.com/rigodlt-maker/${repo}/main/taos-version.json`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((r: Version | null) => {
        if (r?.version && esMasNueva(r.version, actual.version) && leer(OCULTA) !== r.version) setNueva(r);
      })
      .catch(() => {});
  }, [actual.version, repo]);

  // El botón "Actualizar TAOS" vive en el GitHub del comprador (Vercel nos dice cuál es)
  const dueno = process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_OWNER;
  const nombre = process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG;
  const enlace = dueno && nombre ? `https://github.com/${dueno}/${nombre}/actions/workflows/actualizar.yml` : null;

  return (
    <>
      {nueva && (
        <div style={caja} role="status">
          <p style={{ margin: 0, fontWeight: 600 }}>✨ Hay una versión nueva ({nueva.version})</p>
          {nueva.novedades?.[0] && <p style={{ margin: "4px 0 0", fontSize: 14, color: "#ffffffb3" }}>{nueva.novedades[0]}</p>}
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#ffffff99" }}>Se instala sola esta noche. Tus datos no se tocan.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {enlace && (
              <a href={enlace} target="_blank" rel="noreferrer" style={{ ...boton, background: ORO, color: "#0a0a0a", textDecoration: "none" }}>
                Actualizar ahora
              </a>
            )}
            <button
              type="button"
              style={{ ...boton, background: "transparent", color: "#ffffffb3", border: "1px solid #ffffff26" }}
              onClick={() => {
                guardar(OCULTA, nueva.version);
                setNueva(null);
              }}
            >
              Ocultar
            </button>
          </div>
          {enlace && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#ffffff80" }}>En GitHub toca «Run workflow» y luego el botón verde. En 3 minutos ya la tienes.</p>}
        </div>
      )}
      {novedades && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, zIndex: 80, background: "#000000b3", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => {
            guardar(VISTA, actual.version);
            setNovedades(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ ...caja, margin: 0, width: "100%", maxWidth: 672, borderRadius: "24px 24px 0 0", padding: "24px 20px calc(24px + env(safe-area-inset-bottom))" }}
          >
            <p style={{ margin: 0, fontSize: 12, letterSpacing: ".15em", textTransform: "uppercase", color: ORO }}>Versión {actual.version}</p>
            <p style={{ margin: "6px 0 12px", fontSize: 22, fontWeight: 700 }}>Novedades de tu app ✨</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {actual.novedades.map((n) => (
                <li key={n} style={{ display: "flex", gap: 10, fontSize: 15, lineHeight: 1.4 }}>
                  <span style={{ color: ORO }}>✓</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              style={{ ...boton, width: "100%", marginTop: 18, minHeight: 48, background: ORO, color: "#0a0a0a", border: 0 }}
              onClick={() => {
                guardar(VISTA, actual.version);
                setNovedades(false);
              }}
            >
              ¡Entendido!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
