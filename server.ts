import { type Route, route } from "@std/http/unstable-route";
import { serveDir, serveFile } from "@std/http/file-server";

const urlOffre =
  "https://candidat.francetravail.fr/api-descriptifoffre/offre/${noOffre}";
const urlReferrer =
  "https://candidat.francetravail.fr/offres/recherche/detail/${noOffre}";
const reNoOffre = /^[1-9]\d{2}[A-Z]{4}$/i;

const SEC_HEADERS = {
  "X-Content-Type-Options": "nosniff",
};

const FETCH_TIMEOUT = 10_000;

async function ProxyOffre(noOffre: string): Promise<Response> {
  if (!reNoOffre.test(noOffre)) {
    return new Response("Numéro d'offre invalide.", {
      status: 400,
      headers: {
        "Content-Type": "text/plain; charset=UTF-8",
        ...SEC_HEADERS,
      },
    });
  }

  try {
    const url = urlOffre.replace("${noOffre}", noOffre);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Referer: urlReferrer.replace("${noOffre}", noOffre),
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return new Response(
        `Échec de la récupération de l'offre (${response.status}).`,
        {
          status: response.status,
          headers: {
            "Content-Type": "text/plain; charset=UTF-8",
            ...SEC_HEADERS,
          },
        },
      );
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "text/html",
        "Access-Control-Allow-Origin": "*",
        ...SEC_HEADERS,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      `Erreur lors de la récupération de l'offre: ${message}`,
      {
        status: 502,
        headers: {
          "Content-Type": "text/plain; charset=UTF-8",
          ...SEC_HEADERS,
        },
      },
    );
  }
}

/**
 * Calcule le salaire net exact via l'API officielle de l'Urssaf.
 *
 * @param {number} salaireBrut - Montant du salaire brut mensuel.
 * @param {boolean} [estCadre=non] - Indique si le salarié a le statut cadre.
 * @returns {Promise<number>} Le salaire net mensuel avant impôt.
 */
export async function calculerSalaireNetUrssaf(
  salaireBrutRaw: string | null = null,
  estCadreRaw: string | null = null,
): Promise<Response> {
  const salaireBrut = Number(salaireBrutRaw);
  const estCadre = estCadreRaw === "true" || estCadreRaw === "1" ||
    estCadreRaw === "oui";

  if (salaireBrutRaw === null || isNaN(salaireBrut)) {
    return new Response(
      JSON.stringify({ error: "Paramètre salaireBrut invalide ou manquant." }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          ...SEC_HEADERS,
        },
      },
    );
  }

  if (salaireBrut <= 0) {
    return new Response(
      JSON.stringify({ salaireBrut, estCadre, salaireNet: 0.0 }),
      {
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          ...SEC_HEADERS,
        },
      },
    );
  }

  const url = "https://mon-entreprise.urssaf.fr/api/v1/evaluate";

  const payload = {
    expressions: [
      "salarié . rémunération . net . à payer avant impôt",
    ],
    situation: {
      "salarié . rémunération . brut": `${salaireBrut} €/mois`,
      "salarié . contrat . statut cadre": estCadre ? "oui" : "non",
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP : ${response.status}`);
    }

    const data = await response.json();

    // Extraction de la valeur numérique retournée par l'API
    const resultat = data.evaluate[0].nodeValue;
    const salaireNet = Math.round(resultat * 100) / 100;

    return new Response(
      JSON.stringify({ salaireBrut, estCadre, salaireNet }),
      {
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          ...SEC_HEADERS,
        },
      },
    );
  } catch (error) {
    console.error("Impossible de joindre l'API Urssaf :", error);
    return new Response(
      JSON.stringify({
        error: "Impossible de calculer le salaire net via l'API Urssaf.",
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          ...SEC_HEADERS,
        },
      },
    );
  }
}

const routes: Route[] = [
  {
    method: ["GET"],
    pattern: new URLPattern({ pathname: "/" }),
    handler: (req: Request) => {
      return serveFile(req, "./static/index.html");
    },
  },
  {
    method: ["GET"],
    pattern: new URLPattern({ pathname: "/static/*" }),
    handler: (req: Request) => {
      return serveDir(req);
    },
  },
  {
    method: ["GET"],
    pattern: new URLPattern({ pathname: "/api/offres/:noOffre" }),
    handler: (_req: Request, params) => {
      console.log("noOffre =", params?.pathname.groups.noOffre);
      return ProxyOffre(params?.pathname.groups.noOffre ?? "");
    },
  },
  {
    method: ["GET"],
    pattern: new URLPattern({
      pathname: "/api/salaire-net/:salaireBrut?/:estCadre?",
    }),
    handler: (req: Request, params) => {
      const url = new URL(req.url);
      const groups = params?.pathname.groups ?? {};
      return calculerSalaireNetUrssaf(
        groups.salaireBrut ?? url.searchParams.get("salaireBrut"),
        groups.estCadre ?? url.searchParams.get("estCadre"),
      );
    },
  },
];

function defaultHandler(req: Request) {
  return new Response(`Page non trouvée ${req.url}`, { status: 404 });
}

if (import.meta.main) {
  Deno.serve(route(routes, defaultHandler));
}
