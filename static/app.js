const lienOffre = "candidat.francetravail.fr/offres/recherche/detail/";
const urlOffre = (noOffre) => `/api/offres/${encodeURIComponent(noOffre)}`;
const urlSalaireNet = (salaireBrut, estCadre) => {
  const brut = encodeURIComponent(salaireBrut);
  const cadre = encodeURIComponent(estCadre);
  return `/api/salaire-net/${brut}/${cadre}`;
};

// calculerSalaireNet calcule le salaire net mensuel via l'API serveur.
const calculerSalaireNet = async (salaireBrut, estCadre) => {
  const response = await fetch(urlSalaireNet(salaireBrut, estCadre));
  if (!response.ok) {
    throw new Error(`Erreur HTTP ${response.status}`);
  }

  const { salaireNet } = await response.json();
  if (!Number.isFinite(salaireNet)) {
    throw new Error("Salaire net invalide");
  }

  return Math.ceil(salaireNet);
};

// Expose la fonction pour les tests et autres consommateurs.
globalThis.calculerSalaireNet = calculerSalaireNet;

const eltTblOffres = document.getElementById("tblOffres");
const eltTexte = document.getElementById("texte");
const eltPublication = document.getElementById("publication");
const tags = [
  "#offredemploi",
  "#jobs",
  "#job",
  "#recrutement",
  "#emploi",
  "#corse",
  "#corsica",
  "#travail",
  "#impiegu",
  "#carrière",
  "#rechercheemploi",
];
const periodicite = {
  horaire: "Horaire",
  mensuel: "Mensuel",
  annuel: "Annuel",
  inconnu: "inconnu",
};

const offres = new Map();

const salaireHoraireMax = 100;
const salaireMensuelMax = 10000;
const salaireDureeMax = 14;
const horaireHebdoDefaut = 35;
const semainesParMois = 52 / 12;

const reNoOffre = /[1-9]\d{2}[A-Z]{4}/gi;
const reGenre = /\s*\(?\s*[HF]\s*\/\s*[HF]\s*\)?/gi;
const reNet = /\bnets?\b/i;
const reHoraireHebdo = /(?<hh>\d{1,2})\s*h/i;
const reSalaire =
  /(?<n1>(?:\d{1,3}\s)?\d{2,}(?:[.,]\d{1,2})?)(?:\D+(?<n2>(?:\d{1,3}\s)?\d{2,}(?:[.,]\d{1,2})?))?(?:\D+(?<n3>\d{2,}(?:[.,]\d{1,2})?))?/i;

const estRenseigne = (valeur) => valeur !== undefined && valeur !== null;

const parseNombre = (valeur) => {
  const texte = String(valeur ?? "")
    .replaceAll(",", ".")
    .replaceAll(/\s/g, "");
  const nombre = Number.parseFloat(texte);
  return Number.isFinite(nombre) ? nombre : 0;
};

// extraireNoOffres extrait les numéros d'offre du texte.
const extraireNoOffres = (texte) => {
  offres.clear();
  for (const noOffre of texte.match(reNoOffre) ?? []) {
    offres.set(noOffre.toUpperCase(), null);
  }
};

// initOffres initialise les offres.
const initOffres = () => {
  const tbody = eltTblOffres.querySelector("tbody");
  tbody.replaceChildren();

  for (const noOffre of offres.keys()) {
    const newRow = tbody.insertRow();
    newRow.innerHTML = `
        <th scope="row">
            <a href="https://${lienOffre}${noOffre}" target="_blank">${noOffre}</a>
        </th>
        <td id="statut${noOffre}">Récupération en cours ...</td>`;
  }
};

const afficherStatutOffre = (noOffre) => {
  const elt = document.getElementById(`statut${noOffre}`);
  const statut = offres.get(noOffre)?.statut;
  if (elt && statut !== undefined) {
    elt.textContent = statut;
  }
};

// fetchOffre récupère l'offre sur francetravail.fr.
const fetchOffre = async (noOffre) => {
  try {
    const response = await fetch(urlOffre(noOffre));

    if (response.status === 404) {
      throw new Error("Offre non disponible");
    }
    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status}`);
    }

    const infos = await parseOffre(await response.json());
    offres.set(
      noOffre,
      typeof infos === "string" ? { ok: false, statut: `⛔ ${infos}` } : infos,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    offres.set(noOffre, { ok: false, statut: `⛔ ${message}` });
  } finally {
    afficherStatutOffre(noOffre);
  }
};

// parseOffre lit les informations de l'offre renvoyées par l'API.
const parseOffre = async (offre) => {
  if (!estRenseigne(offre.intituleOffre)) {
    return "Titre introuvable";
  }
  const titre = `${offre.intituleOffre.replace(reGenre, "").trim()} (H/F)`;

  if (!estRenseigne(offre.descriptif)) {
    return "Description introuvable";
  }
  const description = offre.descriptif;

  const oLieu = offre.lieuTravail;
  if (!estRenseigne(oLieu)) {
    return "Lieu introuvable";
  }
  const commune = oLieu.libelleCommuneLieuTravail;
  const lieu = commune || oLieu.libelleLieuTravail || "";
  const lieuAEn = commune ? " à " : " en ";

  // syntheseContrat est du type "CDI - Contrat travail".
  const oContrat = offre.syntheseContrat;
  if (!estRenseigne(oContrat)) {
    return "Type de contrat introuvable";
  }
  const separateurContrat = oContrat.lastIndexOf(" - ");
  const contrat = separateurContrat === -1
    ? oContrat
    : oContrat.slice(0, separateurContrat);

  // listeLibelleTypeHoraire contient par exemple
  // ["Temps partiel - 18H/semaine", "Travail de nuit"].
  const libellesHoraire =
    offre.conditionTravailPoste?.listeLibelleTypeHoraire ??
      [];
  const matchHoraire = libellesHoraire.join(" - ").match(reHoraireHebdo);
  const horaireHebdo = parseNombre(matchHoraire?.groups?.hh) ||
    horaireHebdoDefaut;

  const entreprise = offre.codeTypeAffichageCoordonneesRecruteur !== "A"
    ? offre.etablissement?.libelleEnseigne || ""
    : "";

  const pageEntreprise = offre.etablissement?.urlEntreprise ||
    offre.pageEmployeurUrl ||
    "";

  const avantages = [];
  let statut = `${titre}${lieuAEn}${lieu}`;
  let salaireMin = 0;
  let salaireMax = 0;
  let salaireNetMin = 0;
  let salaireNetMax = 0;
  let salaireDuree = 12;
  let salairePeriode = periodicite.inconnu;

  const oSalaire = offre.salaire;
  const estSalaireBrut = !reNet.test(String(oSalaire ?? ""));
  const estCadre = String(offre.qualification ?? "").toLowerCase() === "cadre";

  const matchSalaire = oSalaire?.match(reSalaire);
  if (!estRenseigne(oSalaire)) {
    statut = `⚠️ salaire non renseigné - ${statut}`;
  } else if (matchSalaire === null) {
    statut = `⚠️ salaire non identifié - ${statut}`;
  } else {
    const n1 = parseNombre(matchSalaire.groups.n1);
    const n2 = parseNombre(matchSalaire.groups.n2);
    const n3 = parseNombre(matchSalaire.groups.n3);

    if (n1 <= 0) {
      statut = `⚠️ salaire non identifié - ${statut}`;
    } else {
      salaireMin = n1;
      salaireMax = n1;

      if (n3 <= 0 && n2 <= 0) {
        // salaireMax = salaireMin et salaireDuree = 12.
      } else if (n3 <= 0 && n2 > n1) {
        salaireMax = n2;
      } else if (n3 <= 0 && n2 >= 12 && n2 <= salaireDureeMax) {
        salaireDuree = n2;
      } else if (n2 >= n1 && n3 >= 12 && n3 <= salaireDureeMax) {
        salaireMax = n2;
        salaireDuree = n3;
      } else {
        statut = `⚠️ salaire mal formaté ${n1}, ${n2}, ${n3} - ${statut}`;
      }

      // Tous les salaires sont convertis en salaires mensuels.
      if (salaireMin > salaireMensuelMax) {
        salairePeriode = periodicite.annuel;
        salaireMin /= 12;
        salaireMax /= 12;
      } else if (salaireMin > salaireHoraireMax) {
        salairePeriode = periodicite.mensuel;
      } else if (salaireMin > 0) {
        salairePeriode = periodicite.horaire;
        salaireMin *= horaireHebdo * semainesParMois;
        salaireMax *= horaireHebdo * semainesParMois;
      }

      salaireMin = Math.ceil(salaireMin);
      salaireMax = Math.ceil(salaireMax);

      if (estSalaireBrut) {
        [salaireNetMin, salaireNetMax] = await Promise.all([
          calculerSalaireNet(salaireMin, estCadre),
          calculerSalaireNet(salaireMax, estCadre),
        ]);
      }

      if (salaireDuree > 12 && salaireDuree <= salaireDureeMax) {
        avantages.push(`salaire sur ${salaireDuree} mois`);
      }
    }
  }

  const debutant = offre.experienceProfil?.experience;
  if (debutant === "Débutant accepté") {
    avantages.push("débutant(e) accepté(e)");
  }

  avantages.push(...(offre.listeAvantages ?? []));

  return {
    ok: true,
    statut,
    titre,
    description,
    contrat,
    horaireHebdo,
    lieuAEn,
    lieu,
    salaireMin,
    salaireMax,
    salaireNetMin,
    salaireNetMax,
    salaireDuree,
    salairePeriode,
    estSalaireBrut,
    entreprise,
    pageEntreprise,
    avantages,
    debutant,
    dateDerniereModification: offre.dateDerniereModification,
  };
};

const formaterSalaire = (minimum, maximum) =>
  maximum - minimum > 10 ? `${minimum}€ à ${maximum}€` : `${minimum}€`;

const choisirTags = (nombre) => {
  const melange = [...tags];
  for (let i = melange.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [melange[i], melange[j]] = [melange[j], melange[i]];
  }
  return melange.slice(0, nombre).join(" ");
};

// creerPublication crée le texte de la publication à partir des offres.
const creerPublication = () => {
  const offresValides = [...offres.values()].filter((offre) => offre?.ok);
  if (offresValides.length === 0) {
    return "Aucune offre disponible";
  }

  const uneSeuleOffre = offresValides.length === 1;
  const lieux = [];
  let lieuAEn = "";
  let entreprise = "";
  let pageEntreprise = "";
  let pubOffres = "";
  let auMoinsUnSalaireBrut = false;

  for (const [noOffre, offre] of offres) {
    if (!offre?.ok) continue;

    if (!lieux.includes(offre.lieu)) {
      if (!lieuAEn) {
        lieuAEn = offre.lieuAEn;
      }
      lieux.push(offre.lieu);
    }

    if (!entreprise && offre.entreprise) {
      entreprise = offre.entreprise;
      pageEntreprise = offre.pageEntreprise;
    }

    pubOffres += `${uneSeuleOffre ? "" : "\n🔹 "}${offre.titre} ` +
      `📜 ${offre.contrat} ⌛ ${offre.horaireHebdo}h / semaine`;

    if (offre.salaireMin !== 0) {
      if (offre.estSalaireBrut) {
        auMoinsUnSalaireBrut = true;
        pubOffres += ` 💰 ${
          formaterSalaire(offre.salaireMin, offre.salaireMax)
        } BRUT / mois`;
        pubOffres += ` (💶 ${
          formaterSalaire(offre.salaireNetMin, offre.salaireNetMax)
        } NET / mois¹)`;
      } else {
        pubOffres += ` 💶 ${
          formaterSalaire(offre.salaireMin, offre.salaireMax)
        } NET / mois`;
      }
    }

    if (offre.avantages.length > 0) {
      pubOffres += ` ✅ ${offre.avantages.join(", ")}`;
    }

    if (uneSeuleOffre) {
      pubOffres += ".\nPour plus d'informations et pour postuler";
    }

    pubOffres += ` 👉 ${lienOffre}${noOffre}\n`;
  }

  let pubPied = "\n";
  if (pageEntreprise) {
    pubPied =
      `\nPour découvrir l'entreprise et toutes ses offres d'emploi 👉 ${pageEntreprise}`;
  }
  if (auMoinsUnSalaireBrut) {
    pubPied += "\n¹Le salaire NET est donné à titre indicatif.";
  }
  pubPied += `\n${choisirTags(3)}`;

  let pubEntete = `OFFRE${uneSeuleOffre ? "" : "S"} D'EMPLOI${lieuAEn}${
    lieux.sort().join(", ")
  }`;
  if (entreprise) {
    pubEntete += ` pour ${entreprise}`;
  }
  pubEntete += " : ";

  return pubEntete + pubOffres + pubPied;
};

// main
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    extraireNoOffres(eltTexte.value);
    initOffres();

    await Promise.allSettled([...offres.keys()].map(fetchOffre));

    const publication = creerPublication();
    eltPublication.value = publication;
    eltPublication.rows = publication.split("\n").length;
  });

  const copyButton = document.getElementById("btnCopyPublication");
  if (!copyButton || !eltPublication) return;

  copyButton.addEventListener("click", async () => {
    const originalLabel = copyButton.textContent;

    try {
      await navigator.clipboard.writeText(eltPublication.value);
      copyButton.textContent = "Copié !";
    } catch (error) {
      console.error("Erreur lors de la copie :", error);
    } finally {
      setTimeout(() => {
        copyButton.textContent = originalLabel;
      }, 2000);
    }
  });
});
