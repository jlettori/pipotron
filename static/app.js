const lienOffre = "candidat.francetravail.fr/offres/recherche/detail/";
const apiOffre = "/api/offres/${noOffre}";

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
const avantagesDispo = [
  "Chèque repas",
  "Complémentaire santé",
  "CSE",
  "Indemnité transports",
  "Intéressement / participation",
  "Hébergement",
  "Mutuelle",
  "Ordinateur portable",
  "Paniers repas",
  "Pc portable",
  "Primes",
  "Prime de transport dès un an d'ancienneté continue dans la structure",
  "Restauration",
  "Salaire à négocier selon compétences",
  "Titres restaurant / Prime de panier",
];
const periodicite = {
  horaire: "Horaire",
  mensuel: "Mensuel",
  annuel: "Annuel",
  inconnu: "inconnu",
};

const offres = new Map();
let nbOffres = 0;

const salaireHoraireMax = 100;
const salaireMensuelMax = 10000;
const salaireDureeMax = 14;
const horaireHebdoDefaut = 35;

// extraireNoOffres extrait les numéros d'offre du texte.
const extraireNoOffres = (texte) => {
  const reOffre = /[1-9]\d{2}[A-Z]{4}/gi;
  const noOffres = texte.match(reOffre);

  offres.clear();
  for (const noOffre of noOffres) {
    offres.set(noOffre.toUpperCase(), null);
  }
};

// initOffres initialise les offres.
const initOffres = () => {
  nbOffres = 0;

  const tbody = eltTblOffres.querySelector("tbody");
  while (tbody.firstChild) {
    tbody.firstChild.remove();
  }

  for (const [noOffre] of offres) {
    const newRow = tbody.insertRow();
    newRow.innerHTML = `
        <th scope="row">
            <a href="https://${lienOffre}${noOffre}" target="_blank">${noOffre}</a>
        </th>
        <td id="statut${noOffre}">Récupération en cours ...</td>`;
  }
};

// fetchOffre récupère l'offre sur francetravail.fr.
const fetchOffre = async (noOffre) => {
  const urlOffre = apiOffre.replace("${noOffre}", noOffre);
  await fetch(urlOffre, {})
    .then((response) => {
      switch (response.status) {
        case 200:
          return response.text();
        case 500:
          return Promise.reject("Offre non disponible");
        default:
          return Promise.reject(`Erreur inconnue ${response.status})`);
      }
    })
    .then((text) => {
      const parser = new DOMParser();
      const body = parser.parseFromString(text, "text/html")?.body;
      if (body === undefined) {
        offres.set(noOffre, {
          ok: false,
          statut: "⛔ Impossible de lire l'offre",
        });
        return;
      }

      const offre = parseOffre(body);
      if (typeof offre === "string") {
        offres.set(noOffre, { ok: false, statut: `⛔ ${offre}` });
        return;
      }

      offres.set(noOffre, offre);
      nbOffres++;
    })
    .catch((error) => {
      offres.set(noOffre, { ok: false, statut: `⛔ ${error}` });
    });

  StatutOffre(noOffre);
};

const StatutOffre = (noOffre) => {
  const elt = document.getElementById(`statut${noOffre}`);
  elt.innerText = offres.get(noOffre).statut;
};

// parseOffre lit les informations de l'offre.
const parseOffre = (body) => {
  const oTitre = body.querySelector('span[itemprop="title"]')?.innerText;
  if (oTitre === undefined) {
    return "Titre introuvable";
  }

  const titre = oTitre.replace(/\s*\(?\s*H\s*\/\s*F\s*\)?/gi, "") + " (H/F)";

  const oDescription = body.querySelector('div[itemprop="description"]')
    ?.innerText;
  if (oDescription === undefined) {
    return "Description introuvable";
  }

  const oLieu = body.querySelector('span[itemprop="name"]')?.innerText;
  if (oLieu === undefined) {
    return "Lieu introuvable";
  }

  const pos = oLieu.indexOf("-");
  const departement = pos === -1 ? "" : oLieu.substring(0, pos).trim();
  const lieu = pos === -1 ? oLieu : oLieu.substring(pos + 1).trim();

  const oContrat = body.querySelector('span[title="Type de contrat"]')
    ?.parentNode.nextSibling.childNodes[0].nodeValue;
  if (oContrat === undefined) {
    return "Type de contrat introuvable";
  }

  const contrat = oContrat.replaceAll("\n", "")
    .replace("Contrat à durée déterminée -", "CDD")
    .replace("Contrat à durée indéterminée", "CDI")
    .replace("Contrat travail saisonnier -", "contrat saisonnier");

  const oHoraireHebdo = body.querySelector('span[itemprop="employmentType"]')
    ?.nextSibling.textContent;
  if (oHoraireHebdo === undefined) {
    return "Horaire hebdo introuvable";
  }

  const reHoraireHebdo = /(?<hh>\d{1,2})h/i;
  const matchHoraire = oHoraireHebdo.match(reHoraireHebdo);
  if (matchHoraire === null) {
    return "Format horaire introuvable";
  }

  const horaireHebdo =
    parseFloat(matchHoraire.groups.hh?.replaceAll(",", ".")) ||
    horaireHebdoDefaut;

  const entreprise = body.querySelector(
    'span[itemprop="hiringOrganization"]>span[itemprop="name"]',
  )
    ?.getAttribute("content") || "";

  const pageEntreprise =
    body.querySelector("div.media-body>p>a")?.getAttribute("href") || "";

  const dateDebut = body.querySelector('span[itemprop="datePosted"]')
    ?.getAttribute("content");
  const dateFin = body.querySelector('span[itemprop="validThrough"]')
    ?.getAttribute("content");

  const avantages = [];
  let statut = `${titre} à ${lieu}`;
  let salaireMin = 0.0;
  let salaireMax = 0.0;
  let salaireDuree = 12;
  let salairePeriode = periodicite.inconnu;

  const oSalaire = body.querySelector('span[itemprop="baseSalary"]')?.parentNode
    .textContent;
  if (oSalaire === undefined) {
    return "Salaire introuvable";
  }

  const reNet = /\bnets?\b/i;
  const salaireNet = reNet.test(oSalaire);

  const reSalaire =
    /(?<n1>(?:\d{1,3}\s)?\d{2,}(?:[.,]\d{1,2})?)(?:\D+(?<n2>(?:\d{1,3}\s)?\d{2,}(?:[.,]\d{1,2})?))?(?:\D+(?<n3>\d{2,}(?:[.,]\d{1,2})?))?/i;
  const matchSal = oSalaire.match(reSalaire);
  if (matchSal === null) {
    statut = `⚠️ salaire non renseigné - ${statut}`;
  } else {
    const n1 = parseFloat(
      matchSal.groups.n1?.replaceAll(",", ".").replaceAll(" ", ""),
    ) ||
      0;
    const n2 = parseFloat(
      matchSal.groups.n2?.replaceAll(",", ".").replaceAll(" ", ""),
    ) ||
      0;
    const n3 = parseFloat(
      matchSal.groups.n3?.replaceAll(",", ".").replaceAll(" ", ""),
    ) ||
      0;

    if (n1 <= 0) {
      statut = `⚠️ salaire non identifié - ${statut}`;
    } else {
      salaireMin = n1;
      salaireMax = n1;

      if (n3 <= 0 && n2 <= 0) {
        // si ça arrive, pas de problème salaireMax = salaireMin et salaireDuree = 12
      } else if (n3 <= 0 && n2 > n1) {
        salaireMax = n2;
      } else if (n3 <= 0 && n2 >= 12 && n2 <= salaireDureeMax) {
        salaireDuree = n2;
      } else if (n2 > n1 && n3 >= 12 && n3 <= salaireDureeMax) {
        salaireMax = n2;
        salaireDuree = n3;
      } else {
        statut = `⚠️ salaire mal formaté ${n1}, ${n2}, ${n3} - ${statut}`;
      }

      // Tous les salaires sont convertis en salaires mensuels
      if (salaireMin > salaireMensuelMax) {
        salairePeriode = periodicite.annuel;
        salaireMin /= 12;
        salaireMax /= 12;
      } else if (salaireMin > salaireHoraireMax) {
        salairePeriode = periodicite.mensuel;
      } else if (salaireMin > 0) {
        salairePeriode = periodicite.horaire;
        const semainesParMois = 52 / 12;
        salaireMin *= horaireHebdo * semainesParMois;
        salaireMax *= horaireHebdo * semainesParMois;
      }

      salaireMin = Math.ceil(salaireMin);
      salaireMax = Math.ceil(salaireMax);

      if (salaireDuree > salaireDureeMax) {
        statut = `⚠️ salaire sur ${salaireDuree} mois incorrect - ${statut}`;
      } else if (salaireDuree > 12 && salaireDuree <= salaireDureeMax) {
        avantages.push(`salaire sur ${salaireDuree} mois`);
      }
    }
  }

  const debutant = body.querySelector('span[itemprop="experienceRequirements"]')
    ?.innerText;
  if (debutant === "Débutant accepté") {
    avantages.push("débutant(e) accepté(e)");
  }

  for (const avantage of avantagesDispo) {
    if (oSalaire.includes(avantage)) {
      avantages.push(avantage);
    }
  }

  return {
    statut: statut,
    ok: true,
    titre: titre,
    description: oDescription,
    contrat: contrat,
    horaireHebdo: horaireHebdo,
    departement: departement,
    lieu: lieu,
    salaireMin: salaireMin,
    salaireMax: salaireMax,
    salaireDuree: salaireDuree,
    salairePeriode: salairePeriode,
    salaireBrut: !salaireNet,
    entreprise: entreprise,
    pageEntreprise: pageEntreprise,
    avantages: avantages,
    debutant: debutant,
    dateDebut: dateDebut,
    dateFin: dateFin,
  };
};

// creerPublication crée le texte de la publication à partir des offres.
const creerPublication = () => {
  const lieux = [];
  let entreprise = "";
  let pageEntreprise = "";
  let pubOffres = "";
  let auMoinsUneOffre = false;

  for (const [noOffre, offre] of offres) {
    if (!offre.ok) continue;

    auMoinsUneOffre = true;

    if (lieux.indexOf(offre.lieu) === -1) {
      lieux.push(offre.lieu);
    }

    if (entreprise === "" && offre.entreprise !== "") {
      entreprise = offre.entreprise;
      pageEntreprise = offre.pageEntreprise;
    }

    pubOffres += (nbOffres === 1 ? "" : "🔹 ") +
      `${offre.titre} 📜 ${offre.contrat} ⌛ ${offre.horaireHebdo}h / semaine`;

    if (offre.salaireMin !== 0) {
      pubOffres += ` 💰 ${offre.salaireMin}€`;
      if (offre.salaireMax - offre.salaireMin > 10) {
        pubOffres += ` à ${offre.salaireMax}€`;
      }

      pubOffres += (offre.salaireBrut ? " BRUT" : " NET") + " / mois";
    }

    if (offre.avantages.length !== 0) {
      pubOffres += " ✅ " + offre.avantages.join(", ");
    }

    if (nbOffres === 1) {
      pubOffres += ".\nPour plus d'informations et pour postuler";
    }

    pubOffres += ` 👉 ${lienOffre}${noOffre}\n\n`;
  }

  if (!auMoinsUneOffre) {
    return "Aucune offre disponible";
  }

  let pubPied = "";
  if (pageEntreprise !== "") {
    pubPied =
      `Pour découvrir l'entreprise et toutes ses offres d'emploi 👉 ${pageEntreprise} \n\n`;
  }

  pubPied += tags.sort(() => 0.5 - Math.random()).slice(0, 3).join(" ");

  let pubEntete = "OFFRE" + (nbOffres === 1 ? "" : "S") + " D'EMPLOI à " +
    lieux.sort().join(", ");
  if (entreprise !== "") {
    pubEntete += ` pour ${entreprise}`;
  }

  pubEntete += " : " + (nbOffres === 1 ? "" : "\n");

  return pubEntete + pubOffres + pubPied;
};

const form = document.getElementById("form");
form.addEventListener("submit", (e) => {
  e.preventDefault();

  extraireNoOffres(eltTexte.value);
  initOffres();

  const promFetch = [];
  for (const [noOffre] of offres) {
    promFetch.push(fetchOffre(noOffre));
  }

  Promise.allSettled(promFetch)
    .then(() => {
      console.log("offres", offres);
      const pub = creerPublication();
      eltPublication.value = pub;
      eltPublication.rows = pub.match(/\n/g).length + 1;
    })
    .catch((error) => {
      console.log("error", error);
    });
});
