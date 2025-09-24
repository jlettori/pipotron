import { type Route, route } from "@std/http/unstable-route";
import { serveDir, serveFile } from "@std/http/file-server";

const urlOffre =
  "https://candidat.francetravail.fr/offres/recherche/detail/${noOffre}";
const reNoOffre = /^[1-9]\d{2}[A-Z]{4}$/i;

async function ProxyOffre(noOffre: string): Promise<Response> {
  if (!reNoOffre.test(noOffre)) {
    return new Response(`'${noOffre}' n'est pas un numéro d'offre.`, {
      status: 500,
    });
  }

  try {
    const url = urlOffre.replace("${noOffre}", noOffre);
    const response = await fetch(url);
    if (!response.ok) {
      return new Response(`Failed to fetch data. Status: ${response.status}`, {
        status: response.status,
      });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "text/html",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(`Error fetching data: ${error.message}`, {
      status: 500,
    });
  }
}

const routes: Route[] = [
  {
    pattern: new URLPattern({ pathname: "/" }),
    handler: (req: Request) => {
      console.log("pipo index.html");
      return serveFile(req, "./static/index.html");
    },
  },
  {
    pattern: new URLPattern({ pathname: "/static/*" }),
    handler: (req: Request) => {
      console.log("pipo static ", req.url);
      return serveDir(req);
    },
  },
  {
    method: ["GET"],
    pattern: new URLPattern({ pathname: "/api/offres/:id" }),
    handler: (req: Request, params) => {
      console.log("pipo id=", params?.pathname.groups.id);
      return ProxyOffre(params?.pathname.groups.id);
    },
  },
];

function defaultHandler(req: Request) {
  console.log("pipo defaultHandler", req.url);
  return new Response("pipo Not found", { status: 404 });
}

Deno.serve(route(routes, defaultHandler));
