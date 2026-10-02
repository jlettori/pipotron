<?php
// ancienne version : n'est plus utilisé

$noOffre = $_REQUEST["noOffre"];
if (!preg_match("/^[1-9]\d{2}[A-Z]{4}$/i", $noOffre)) {
    echo "'$noOffre' n'est pas un numéro d'offre.";
    return;
}

$url = "https://candidat.francetravail.fr/offres/recherche/detail/${noOffre}";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_HEADER, 0);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

$urlContent = curl_exec($ch);
if (!curl_errno($ch)) {
    $info = curl_getinfo($ch);
    header('Content-Type: ' . $info['content_type']);
    header('Access-Control-Allow-Origin: *');
    echo $urlContent;
}

curl_close($ch);
