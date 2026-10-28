import { assertEquals } from "@std/assert";
import { calculerSalaireNetUrssaf } from "./server.ts";

Deno.test("calculerSalaireNetUrssaf: invalid or missing salaireBrut returns 400", async () => {
  const res = await calculerSalaireNetUrssaf(null);
  assertEquals(res.status, 400);
  assertEquals(await res.json(), {
    error: "Paramètre salaireBrut invalide ou manquant.",
  });
});

Deno.test("calculerSalaireNetUrssaf: non-positive salaireBrut returns 0", async () => {
  const res = await calculerSalaireNetUrssaf("0");
  assertEquals(res.status, 200);
  assertEquals(await res.json(), {
    salaireBrut: 0,
    estCadre: false,
    salaireNet: 0,
  });
});

Deno.test("calculerSalaireNetUrssaf: success formats result", async () => {
  const res = await calculerSalaireNetUrssaf("3000", "true");
  assertEquals(res.status, 200);
  assertEquals(await res.json(), {
    salaireBrut: 3000,
    estCadre: true,
    salaireNet: 2347.77,
  });
});

Deno.test("calculerSalaireNetUrssaf: api failure returns 502", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  console.error = () => {};
  globalThis.fetch =
    (() => Promise.resolve(new Response("", { status: 500 }))) as typeof fetch;
  try {
    const res = await calculerSalaireNetUrssaf("3000", "false");
    assertEquals(res.status, 502);
    assertEquals(await res.json(), {
      error: "Impossible de calculer le salaire net via l'API Urssaf.",
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

Deno.test("calculerSalaireNetUrssaf: cadre flags accepted", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ evaluate: [{ nodeValue: 100 }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )) as typeof fetch;
  try {
    for (const flag of ["1", "oui"]) {
      const res = await calculerSalaireNetUrssaf("1000", flag);
      assertEquals((await res.json()).estCadre, true);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
Deno.test("calculerSalaireNetUrssaf: network error returns 502", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  console.error = () => {};
  globalThis.fetch = (() => Promise.reject(new Error("boom"))) as typeof fetch;
  try {
    const res = await calculerSalaireNetUrssaf("3000", "false");
    assertEquals(res.status, 502);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

const realCases = [
  { salaireBrut: "1000", estCadre: "oui", salaireNet: 767.96 },
  { salaireBrut: "1000", estCadre: "non", salaireNet: 769.66 },
  { salaireBrut: "2000", estCadre: "oui", salaireNet: 1557.87 },
  { salaireBrut: "2000", estCadre: "non", salaireNet: 1561.26 },
  { salaireBrut: "3000", estCadre: "oui", salaireNet: 2347.77 },
  { salaireBrut: "3000", estCadre: "non", salaireNet: 2352.85 },
];

for (const { salaireBrut, estCadre, salaireNet } of realCases) {
  Deno.test(`calculerSalaireNetUrssaf: real case ${salaireBrut} ${estCadre}`, async () => {
    const res = await calculerSalaireNetUrssaf(salaireBrut, estCadre);
    assertEquals(res.status, 200);
    assertEquals(await res.json(), {
      salaireBrut: Number(salaireBrut),
      estCadre: estCadre === "oui",
      salaireNet,
    });
  });
}
