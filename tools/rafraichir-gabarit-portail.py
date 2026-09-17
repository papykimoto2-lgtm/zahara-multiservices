#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Réencode portail-unique.html dans PORTAIL_TEMPLATE_B64 de index.html.

POURQUOI CE SCRIPT EXISTE
    L'ERP embarque une copie de portail-unique.html, encodée en base64, dont
    se sert « Générer un portail autonome » pour produire un fichier livrable
    à un hébergeur tiers ou à une autre société en marque blanche.

    Cette copie est FIGÉE. Rien ne la lie au fichier du dépôt : modifier
    portail-unique.html ne la met pas à jour, et aucune erreur ne le signale.
    Le 17/09/2026 elle retardait de 318 lignes — un gabarit antérieur à la
    boucle vidéo/diaporama de la bannière, à ses flèches de navigation et au
    Mot du DG. Générer aurait produit un portail amputé de tout cela, et le
    redéployer par-dessus la production l'aurait fait disparaître en silence.

    À lancer donc après CHAQUE modification de portail-unique.html :

        python3 tools/rafraichir-gabarit-portail.py

    Sans argument, le script vérifie seulement et n'écrit rien :

        python3 tools/rafraichir-gabarit-portail.py --verifier

CE QU'IL FAIT
    1. Lit portail-unique.html et remet les trois marqueurs que le générateur
       substitue à l'exécution : __SB_URL__, __SB_KEY__, __PORTAIL_BRAND__.
    2. Refuse d'écrire si une valeur propre à l'instance subsiste dans le
       gabarit — référence du projet Supabase, clé anon, raison sociale. Un
       gabarit qui les embarquerait livrerait la base d'une société à une
       autre.
    3. Réencode en base64 et remplace la valeur de PORTAIL_TEMPLATE_B64.
    4. Relit ce qu'il vient d'écrire et vérifie que le décodage redonne bien
       le gabarit attendu.
"""

import base64
import io
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORTAIL = os.path.join(RACINE, 'portail-unique.html')
ERP = os.path.join(RACINE, 'index.html')

# (motif de la valeur d'instance, texte du marqueur, libellé)
MARQUEURS = [
    (re.compile(r"var SB_URL='[^']*';"),                    "var SB_URL='__SB_URL__';",                        'SB_URL'),
    (re.compile(r"var SB_KEY='[^']*';"),                    "var SB_KEY='__SB_KEY__';",                        'SB_KEY'),
    (re.compile(r"PORTAIL_BRAND = JSON\.parse\('[^']*'\)"), "PORTAIL_BRAND = JSON.parse('__PORTAIL_BRAND__')", 'PORTAIL_BRAND'),
]

# Ce qui ne doit JAMAIS subsister dans le gabarit, avec la raison.
FUITES = [
    ('.supabase.co',   "référence d'un projet Supabase"),
    ('eyJhbGciOiJ',    "clé JWT (anon) en clair"),
    ('"nom":"',        "raison sociale figée dans PORTAIL_BRAND"),
]

DECL = re.compile(r'(PORTAIL_TEMPLATE_B64\s*=\s*")([A-Za-z0-9+/=]+)(")')


def construire_gabarit(portail):
    """Remplace les valeurs d'instance par leurs marqueurs. Lève sur anomalie."""
    for motif, cible, nom in MARQUEURS:
        trouves = motif.findall(portail)
        if len(trouves) != 1:
            raise SystemExit(
                "ARRET : %d correspondance(s) pour %s dans portail-unique.html, 1 attendue.\n"
                "        Le fichier a probablement change de forme — verifier a la main." % (len(trouves), nom))
        portail = motif.sub(lambda m: cible, portail, count=1)

    for marqueur in ('__SB_URL__', '__SB_KEY__', '__PORTAIL_BRAND__'):
        if portail.count(marqueur) != 1:
            raise SystemExit('ARRET : %s absent ou en double apres substitution.' % marqueur)

    for fuite, raison in FUITES:
        if fuite in portail:
            raise SystemExit(
                "ARRET : le gabarit contient encore une valeur d'instance (%s).\n"
                "        Fragment trouve : %r\n"
                "        Un gabarit qui l'embarque livrerait les donnees d'une societe a une autre." % (raison, fuite))
    return portail


def main():
    verifier_seulement = '--verifier' in sys.argv[1:]

    portail = io.open(PORTAIL, encoding='utf-8').read()
    erp_octets = io.open(ERP, 'rb').read()
    erp = erp_octets.decode('utf-8')

    decl = DECL.search(erp)
    if not decl:
        raise SystemExit('ARRET : PORTAIL_TEMPLATE_B64 introuvable dans index.html.')

    gabarit = construire_gabarit(portail)
    b64_neuf = base64.b64encode(gabarit.encode('utf-8')).decode('ascii')
    b64_actuel = decl.group(2)

    actuel = base64.b64decode(b64_actuel).decode('utf-8', 'replace')
    print('gabarit embarque : %6d lignes' % actuel.count('\n'))
    print('portail du depot : %6d lignes' % gabarit.count('\n'))

    if b64_neuf == b64_actuel:
        print('\nA JOUR — le gabarit embarque correspond au portail du depot.')
        return 0

    ecart = gabarit.count('\n') - actuel.count('\n')
    print('\nDECALAGE : %+d ligne(s), %+d octet(s) de base64.' % (ecart, len(b64_neuf) - len(b64_actuel)))

    if verifier_seulement:
        print("Rien n'a ete ecrit (--verifier). Relancer sans l'option pour rafraichir.")
        return 1

    # Les fins de ligne de index.html sont preservees : newline='' a
    # l'ecriture, et le base64 tient sur une seule ligne.
    erp = erp[:decl.start(2)] + b64_neuf + erp[decl.end(2):]
    io.open(ERP, 'w', encoding='utf-8', newline='').write(erp)

    # Relecture : on verifie ce qui a reellement ete ecrit, pas ce qu'on croit.
    relu = io.open(ERP, encoding='utf-8').read()
    decl2 = DECL.search(relu)
    if not decl2 or base64.b64decode(decl2.group(2)).decode('utf-8') != gabarit:
        raise SystemExit('ARRET : relecture incoherente apres ecriture — index.html est peut-etre corrompu.')

    print('RAFRAICHI — index.html reecrit, decodage verifie apres ecriture.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
