import { type Route, route } from "@std/http/unstable-route";
import { serveDir, serveFile } from "@std/http/file-server";

const urlOffre =
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
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return new Response(`Échec de la récupération de l'offre (${response.status}).`, {
        status: response.status,
        headers: {
          "Content-Type": "text/plain; charset=UTF-8",
          ...SEC_HEADERS,
        },
      });
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
    return new Response(`Erreur lors de la récupération de l'offre: ${message}`, {
      status: 502,
      headers: {
        "Content-Type": "text/plain; charset=UTF-8",
        ...SEC_HEADERS,
      },
    });
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
];

function defaultHandler(req: Request) {
  return new Response(`Page non trouvée ${req.url}`, { status: 404 });
}

Deno.serve(route(routes, defaultHandler));
