import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import i18n from '../../i18n'
import { setLanguage as persistLanguage } from '../../lib/language'
import './LandingPage.css'

type LangCode = 'fr' | 'en' | 'pt'

interface Country {
  code: string
  flag: string
  name: Record<LangCode, string>
  lang: LangCode
  currency: string
  locale: string
}

const COUNTRIES: Country[] = [
  { code: 'FR', flag: '🇫🇷', name: { fr: 'France', en: 'France', pt: 'França' }, lang: 'fr', currency: 'EUR', locale: 'fr-FR' },
  { code: 'BE', flag: '🇧🇪', name: { fr: 'Belgique', en: 'Belgium', pt: 'Bélgica' }, lang: 'fr', currency: 'EUR', locale: 'fr-BE' },
  { code: 'CH', flag: '🇨🇭', name: { fr: 'Suisse', en: 'Switzerland', pt: 'Suíça' }, lang: 'fr', currency: 'CHF', locale: 'fr-CH' },
  { code: 'GN', flag: '🇬🇳', name: { fr: 'Guinée (Conakry)', en: 'Guinea', pt: 'Guiné' }, lang: 'fr', currency: 'GNF', locale: 'fr-GN' },
  { code: 'SN', flag: '🇸🇳', name: { fr: 'Sénégal', en: 'Senegal', pt: 'Senegal' }, lang: 'fr', currency: 'XOF', locale: 'fr-SN' },
  { code: 'CI', flag: '🇨🇮', name: { fr: "Côte d'Ivoire", en: 'Ivory Coast', pt: 'Costa do Marfim' }, lang: 'fr', currency: 'XOF', locale: 'fr-CI' },
  { code: 'ML', flag: '🇲🇱', name: { fr: 'Mali', en: 'Mali', pt: 'Mali' }, lang: 'fr', currency: 'XOF', locale: 'fr-ML' },
  { code: 'BF', flag: '🇧🇫', name: { fr: 'Burkina Faso', en: 'Burkina Faso', pt: 'Burquina Faso' }, lang: 'fr', currency: 'XOF', locale: 'fr-BF' },
  { code: 'BJ', flag: '🇧🇯', name: { fr: 'Bénin', en: 'Benin', pt: 'Benim' }, lang: 'fr', currency: 'XOF', locale: 'fr-BJ' },
  { code: 'TG', flag: '🇹🇬', name: { fr: 'Togo', en: 'Togo', pt: 'Togo' }, lang: 'fr', currency: 'XOF', locale: 'fr-TG' },
  { code: 'NE', flag: '🇳🇪', name: { fr: 'Niger', en: 'Niger', pt: 'Níger' }, lang: 'fr', currency: 'XOF', locale: 'fr-NE' },
  { code: 'GW', flag: '🇬🇼', name: { fr: 'Guinée-Bissau', en: 'Guinea-Bissau', pt: 'Guiné-Bissau' }, lang: 'pt', currency: 'XOF', locale: 'pt-GW' },
  { code: 'GH', flag: '🇬🇭', name: { fr: 'Ghana', en: 'Ghana', pt: 'Gana' }, lang: 'en', currency: 'GHS', locale: 'en-GH' },
  { code: 'NG', flag: '🇳🇬', name: { fr: 'Nigéria', en: 'Nigeria', pt: 'Nigéria' }, lang: 'en', currency: 'NGN', locale: 'en-NG' },
  { code: 'GM', flag: '🇬🇲', name: { fr: 'Gambie', en: 'Gambia', pt: 'Gâmbia' }, lang: 'en', currency: 'GMD', locale: 'en-GM' },
  { code: 'LR', flag: '🇱🇷', name: { fr: 'Liberia', en: 'Liberia', pt: 'Libéria' }, lang: 'en', currency: 'LRD', locale: 'en-LR' },
  { code: 'SL', flag: '🇸🇱', name: { fr: 'Sierra Leone', en: 'Sierra Leone', pt: 'Serra Leoa' }, lang: 'en', currency: 'SLE', locale: 'en-SL' },
  { code: 'CV', flag: '🇨🇻', name: { fr: 'Cap-Vert', en: 'Cape Verde', pt: 'Cabo Verde' }, lang: 'pt', currency: 'CVE', locale: 'pt-CV' },
  { code: 'CM', flag: '🇨🇲', name: { fr: 'Cameroun', en: 'Cameroon', pt: 'Camarões' }, lang: 'fr', currency: 'XAF', locale: 'fr-CM' },
  { code: 'GA', flag: '🇬🇦', name: { fr: 'Gabon', en: 'Gabon', pt: 'Gabão' }, lang: 'fr', currency: 'XAF', locale: 'fr-GA' },
  { code: 'MA', flag: '🇲🇦', name: { fr: 'Maroc', en: 'Morocco', pt: 'Marrocos' }, lang: 'fr', currency: 'MAD', locale: 'fr-MA' },
  { code: 'DZ', flag: '🇩🇿', name: { fr: 'Algérie', en: 'Algeria', pt: 'Argélia' }, lang: 'fr', currency: 'DZD', locale: 'fr-DZ' },
  { code: 'TN', flag: '🇹🇳', name: { fr: 'Tunisie', en: 'Tunisia', pt: 'Tunísia' }, lang: 'fr', currency: 'TND', locale: 'fr-TN' },
  { code: 'GB', flag: '🇬🇧', name: { fr: 'Royaume-Uni', en: 'United Kingdom', pt: 'Reino Unido' }, lang: 'en', currency: 'GBP', locale: 'en-GB' },
  { code: 'US', flag: '🇺🇸', name: { fr: 'États-Unis', en: 'United States', pt: 'Estados Unidos' }, lang: 'en', currency: 'USD', locale: 'en-US' },
  { code: 'CA', flag: '🇨🇦', name: { fr: 'Canada', en: 'Canada', pt: 'Canadá' }, lang: 'en', currency: 'CAD', locale: 'en-CA' },
  { code: 'BR', flag: '🇧🇷', name: { fr: 'Brésil', en: 'Brazil', pt: 'Brasil' }, lang: 'pt', currency: 'BRL', locale: 'pt-BR' },
  { code: 'PT', flag: '🇵🇹', name: { fr: 'Portugal', en: 'Portugal', pt: 'Portugal' }, lang: 'pt', currency: 'EUR', locale: 'pt-PT' },
  { code: 'AO', flag: '🇦🇴', name: { fr: 'Angola', en: 'Angola', pt: 'Angola' }, lang: 'pt', currency: 'AOA', locale: 'pt-AO' },
  { code: 'MZ', flag: '🇲🇿', name: { fr: 'Mozambique', en: 'Mozambique', pt: 'Moçambique' }, lang: 'pt', currency: 'MZN', locale: 'pt-MZ' },
  { code: 'ZA', flag: '🇿🇦', name: { fr: 'Afrique du Sud', en: 'South Africa', pt: 'África do Sul' }, lang: 'en', currency: 'ZAR', locale: 'en-ZA' },
  { code: 'BW', flag: '🇧🇼', name: { fr: 'Botswana', en: 'Botswana', pt: 'Botsuana' }, lang: 'en', currency: 'BWP', locale: 'en-BW' },
  { code: 'BI', flag: '🇧🇮', name: { fr: 'Burundi', en: 'Burundi', pt: 'Burúndi' }, lang: 'fr', currency: 'BIF', locale: 'fr-BI' },
  { code: 'KM', flag: '🇰🇲', name: { fr: 'Comores', en: 'Comoros', pt: 'Comores' }, lang: 'fr', currency: 'KMF', locale: 'fr-KM' },
  { code: 'CG', flag: '🇨🇬', name: { fr: 'Congo-Brazzaville', en: 'Republic of the Congo', pt: 'Congo-Brazzaville' }, lang: 'fr', currency: 'XAF', locale: 'fr-CG' },
  { code: 'CD', flag: '🇨🇩', name: { fr: 'RD Congo', en: 'DR Congo', pt: 'RD Congo' }, lang: 'fr', currency: 'CDF', locale: 'fr-CD' },
  { code: 'DJ', flag: '🇩🇯', name: { fr: 'Djibouti', en: 'Djibouti', pt: 'Jibuti' }, lang: 'fr', currency: 'DJF', locale: 'fr-DJ' },
  { code: 'EG', flag: '🇪🇬', name: { fr: 'Égypte', en: 'Egypt', pt: 'Egito' }, lang: 'en', currency: 'EGP', locale: 'en-EG' },
  { code: 'ER', flag: '🇪🇷', name: { fr: 'Érythrée', en: 'Eritrea', pt: 'Eritreia' }, lang: 'en', currency: 'ERN', locale: 'en-ER' },
  { code: 'SZ', flag: '🇸🇿', name: { fr: 'Eswatini', en: 'Eswatini', pt: 'Essuatíni' }, lang: 'en', currency: 'SZL', locale: 'en-SZ' },
  { code: 'ET', flag: '🇪🇹', name: { fr: 'Éthiopie', en: 'Ethiopia', pt: 'Etiópia' }, lang: 'en', currency: 'ETB', locale: 'en-ET' },
  { code: 'GQ', flag: '🇬🇶', name: { fr: 'Guinée équatoriale', en: 'Equatorial Guinea', pt: 'Guiné Equatorial' }, lang: 'fr', currency: 'XAF', locale: 'fr-GQ' },
  { code: 'KE', flag: '🇰🇪', name: { fr: 'Kenya', en: 'Kenya', pt: 'Quénia' }, lang: 'en', currency: 'KES', locale: 'en-KE' },
  { code: 'LS', flag: '🇱🇸', name: { fr: 'Lesotho', en: 'Lesotho', pt: 'Lesoto' }, lang: 'en', currency: 'LSL', locale: 'en-LS' },
  { code: 'LY', flag: '🇱🇾', name: { fr: 'Libye', en: 'Libya', pt: 'Líbia' }, lang: 'en', currency: 'LYD', locale: 'en-LY' },
  { code: 'MG', flag: '🇲🇬', name: { fr: 'Madagascar', en: 'Madagascar', pt: 'Madagáscar' }, lang: 'fr', currency: 'MGA', locale: 'fr-MG' },
  { code: 'MW', flag: '🇲🇼', name: { fr: 'Malawi', en: 'Malawi', pt: 'Maláui' }, lang: 'en', currency: 'MWK', locale: 'en-MW' },
  { code: 'MU', flag: '🇲🇺', name: { fr: 'Maurice', en: 'Mauritius', pt: 'Maurícia' }, lang: 'en', currency: 'MUR', locale: 'en-MU' },
  { code: 'MR', flag: '🇲🇷', name: { fr: 'Mauritanie', en: 'Mauritania', pt: 'Mauritânia' }, lang: 'fr', currency: 'MRU', locale: 'fr-MR' },
  { code: 'NA', flag: '🇳🇦', name: { fr: 'Namibie', en: 'Namibia', pt: 'Namíbia' }, lang: 'en', currency: 'NAD', locale: 'en-NA' },
  { code: 'UG', flag: '🇺🇬', name: { fr: 'Ouganda', en: 'Uganda', pt: 'Uganda' }, lang: 'en', currency: 'UGX', locale: 'en-UG' },
  { code: 'CF', flag: '🇨🇫', name: { fr: 'République centrafricaine', en: 'Central African Republic', pt: 'República Centro-Africana' }, lang: 'fr', currency: 'XAF', locale: 'fr-CF' },
  { code: 'RW', flag: '🇷🇼', name: { fr: 'Rwanda', en: 'Rwanda', pt: 'Ruanda' }, lang: 'fr', currency: 'RWF', locale: 'fr-RW' },
  { code: 'ST', flag: '🇸🇹', name: { fr: 'São Tomé-et-Príncipe', en: 'São Tomé and Príncipe', pt: 'São Tomé e Príncipe' }, lang: 'pt', currency: 'STN', locale: 'pt-ST' },
  { code: 'SC', flag: '🇸🇨', name: { fr: 'Seychelles', en: 'Seychelles', pt: 'Seicheles' }, lang: 'en', currency: 'SCR', locale: 'en-SC' },
  { code: 'SO', flag: '🇸🇴', name: { fr: 'Somalie', en: 'Somalia', pt: 'Somália' }, lang: 'en', currency: 'SOS', locale: 'en-SO' },
  { code: 'SD', flag: '🇸🇩', name: { fr: 'Soudan', en: 'Sudan', pt: 'Sudão' }, lang: 'en', currency: 'SDG', locale: 'en-SD' },
  { code: 'SS', flag: '🇸🇸', name: { fr: 'Soudan du Sud', en: 'South Sudan', pt: 'Sudão do Sul' }, lang: 'en', currency: 'SSP', locale: 'en-SS' },
  { code: 'TZ', flag: '🇹🇿', name: { fr: 'Tanzanie', en: 'Tanzania', pt: 'Tanzânia' }, lang: 'en', currency: 'TZS', locale: 'en-TZ' },
  { code: 'TD', flag: '🇹🇩', name: { fr: 'Tchad', en: 'Chad', pt: 'Chade' }, lang: 'fr', currency: 'XAF', locale: 'fr-TD' },
  { code: 'ZM', flag: '🇿🇲', name: { fr: 'Zambie', en: 'Zambia', pt: 'Zâmbia' }, lang: 'en', currency: 'ZMW', locale: 'en-ZM' },
  { code: 'ZW', flag: '🇿🇼', name: { fr: 'Zimbabwe', en: 'Zimbabwe', pt: 'Zimbábue' }, lang: 'en', currency: 'ZWG', locale: 'en-ZW' },
]

// Montants d'exemple du ticket de caisse (maquette), adaptés à chaque devise.
const CART_SAMPLES: Record<string, { item1: number; item2: number }> = {
  EUR: { item1: 80, item2: 14.5 },
  USD: { item1: 88, item2: 16 },
  GBP: { item1: 68, item2: 12.5 },
  CHF: { item1: 76, item2: 14 },
  CAD: { item1: 120, item2: 22 },
  BRL: { item1: 450, item2: 80 },
  XOF: { item1: 52000, item2: 9500 },
  XAF: { item1: 52000, item2: 9500 },
  GNF: { item1: 700000, item2: 125000 },
  MAD: { item1: 880, item2: 160 },
  DZD: { item1: 11000, item2: 2000 },
  TND: { item1: 270, item2: 50 },
  AOA: { item1: 75000, item2: 13500 },
  MZN: { item1: 5600, item2: 1000 },
  GHS: { item1: 1200, item2: 220 },
  NGN: { item1: 136000, item2: 24600 },
  GMD: { item1: 6000, item2: 1090 },
  LRD: { item1: 17000, item2: 3100 },
  SLE: { item1: 2100, item2: 380 },
  CVE: { item1: 8800, item2: 1600 },
  BWP: { item1: 1200, item2: 215 },
  BIF: { item1: 260000, item2: 46000 },
  KMF: { item1: 40000, item2: 7200 },
  CDF: { item1: 250000, item2: 45000 },
  DJF: { item1: 16000, item2: 2800 },
  EGP: { item1: 4400, item2: 800 },
  ERN: { item1: 1300, item2: 240 },
  SZL: { item1: 1600, item2: 290 },
  ETB: { item1: 12000, item2: 2200 },
  KES: { item1: 11000, item2: 2100 },
  LSL: { item1: 1600, item2: 290 },
  LYD: { item1: 440, item2: 80 },
  MGA: { item1: 400000, item2: 72000 },
  MWK: { item1: 150000, item2: 28000 },
  MUR: { item1: 4000, item2: 735 },
  MRU: { item1: 3500, item2: 640 },
  NAD: { item1: 1600, item2: 290 },
  UGX: { item1: 320000, item2: 58000 },
  RWF: { item1: 130000, item2: 23000 },
  STN: { item1: 1900, item2: 350 },
  SCR: { item1: 1200, item2: 225 },
  SOS: { item1: 50000, item2: 9100 },
  SDG: { item1: 53000, item2: 9600 },
  SSP: { item1: 400000, item2: 72000 },
  ZAR: { item1: 1600, item2: 290 },
  TZS: { item1: 230000, item2: 42000 },
  ZMW: { item1: 2200, item2: 400 },
  ZWG: { item1: 2300, item2: 415 },
}

function formatAmount(amount: number, locale: string): string {
  const decimals = amount >= 1000 ? 0 : 2
  try {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(amount)
  } catch {
    return amount.toFixed(decimals)
  }
}

const I18N: Record<LangCode, Record<string, string>> = {
  fr: {
    'nav.features': 'Fonctionnalités', 'nav.offline': 'Hors-ligne', 'nav.download': 'Télécharger', 'nav.pricing': 'Tarifs', 'nav.reviews': 'Avis',
    'nav.contact': 'Contact', 'footer.contact': 'Nous contacter', 'footer.whatsapp': 'Discuter sur WhatsApp',
    'nav.login': 'Connexion', 'nav.cta': 'Créer ma boutique', 'nav.openMenu': 'Ouvrir le menu', 'nav.closeMenu': 'Fermer le menu',
    'dd.country': 'Pays & Devise', 'dd.search': 'Rechercher un pays...', 'dd.countUnit': 'pays',
    'hero.badge': 'Nouveau', 'hero.eyebrow': 'Paiements Mobile Money & Cartes intégrés (à venir)',
    'hero.t1': 'Ouvrez.', 'hero.t2': 'Partagez.', 'hero.t3': 'Vendez.',
    // « et boutique e-commerce synchronisée » retiré pour l'instant (à rétablir quand la boutique en ligne existe) :
    // 'combine caisse tactile ultra-rapide et boutique e-commerce synchronisée. Conçu pour encaisser et gérer vos stocks',
    'hero.lead.normal': 'combine caisse tactile ultra-rapide. Conçu pour encaisser et gérer vos stocks',
    'hero.lead.em': 'même en coupure internet',
    'hero.cta': 'Télécharger gratuitement →', 'hero.demo': 'Découvrir les modules',
    'hero.trust.count': '2 412 boutiques', 'hero.trust.suffix': "actives à travers l'Afrique et l'Europe",

    'mock.badge': 'CAISSE TACTILE V3.2', 'mock.syncStatus': 'SYNCHRO CLOUD ACTIVE',
    'mock.salesLabel': 'Ventes du jour', 'mock.growthSales': '▲ +24% vs hier',
    'mock.ordersLabel': 'Tickets encaissés', 'mock.growthOrders': '⚡ Débit: 3.2s / ticket',
    'mock.cartTitle': 'Ticket en cours (#4092)', 'mock.cartMode': 'Mode Espèces / MoMo',
    'mock.totalLabel': 'TOTAL À PAYER', 'mock.payBtn': 'Encaisser',
    'float.title': 'Indépendance réseau', 'float.sub': 'Continuez à scanner & imprimer hors-ligne',

    'marquee.m1': 'Conçu pour les commerçants', 'marquee.m2': 'Fonctionne 100% Hors-Ligne',
    'marquee.m3': 'Mobile Money Intégré (à venir)', 'marquee.m4': 'Multi-Dépôts & Dettes',
    'marquee.m5': 'Windows · à venir : macOS · Android · iOS', 'marquee.m6': 'Ticket 58mm & 80mm',

    'features.eyebrow': 'Ce qui change tout',
    'features.title.pre': 'Une architecture pensée pour le', 'features.title.em': 'terrain réel',
    'features.sub': "Fini les interfaces compliquées. Boutiklic simplifie la gestion de votre point de vente, de votre inventaire et de vos clients.",
    'features.big.title': 'Pilotez votre commerce du bout des doigts',
    'features.big.desc': "Que vous soyez au comptoir, en tournée de livraison ou au marché, votre catalogue produit reste disponible instantanément. Créez des promotions, scannez les codes-barres avec votre téléphone et suivez votre trésorerie.",
    'features.big.pill1': 'Encaissement en 2 clics', 'features.big.pill2': 'Gestion des crédits & dettes clients', 'features.big.pill3': 'Rapprochement de caisse fin de journée',
    'features.f2.t': 'Paiements Universels (à venir)', 'features.f2.d': 'Orange Money, MTN MoMo, Wave, cartes bancaires ou espèces : vos clients règlent sans friction.',
    'features.f3.t': 'Stocks & Alertes', 'features.f3.d': 'Seuils automatiques de réapprovisionnement, gestion de transferts entre dépôts.',
    'features.f4.t': 'Analytique Limpide', 'features.f4.d': "Identifiez instantanément vos produits stars, vos marges nettes et vos pics d'affluence journaliers.",
    'features.f5.t': 'Assistance Humaine 7j/7', 'features.f5.d': 'Une équipe technique dédiée vous répond directement sur WhatsApp ou par téléphone, sans bot.',

    'numbers.n1': 'Pour configurer votre boutique', 'numbers.n2suffix': 'coupure',
    'numbers.n2': 'Grâce au mode hors-ligne intégré', 'numbers.n3': "Vitesse moyenne d'émission d'un ticket",
    'numbers.n4': 'Sécurisé avec sauvegarde cloud automatique',

    'offline.eyebrow': 'Fiabilité Absolue', 'offline.title1': 'Internet coupe ?', 'offline.title2': 'Votre caisse continue.',
    'offline.sub': "Zones blanches, pannes d'opérateurs ou délestages : Boutiklic utilise une base de données locale sécurisée. Vos ventes, factures et stocks continuent d'être enregistrés sans interruption.",
    'offline.list1': 'Encaissez sans aucune connexion Internet',
    'offline.list2': 'Impression directe sur ticket thermique 58 & 80 mm',
    'offline.list3': "File d'attente automatique et synchronisation transparente",
    'offline.list4': 'Zéro risque de doublon ou de perte financière',
    'offline.engine': 'MOTEUR PERSISTANT SQLITE', 'offline.ready': 'MODE HORS-LIGNE PARÉ', 'offline.queue': 'FILE DE SYNCHRONISATION LOCALE',
    'offline.sync1': 'Ticket #1042 · Vente Comptoir', 'offline.sync2': 'Ticket #1043 · Règlement MoMo', 'offline.sync3': 'Ticket #1044 · Maj Stock Dépôt B',
    'offline.pending': 'En attente réseau (Prêt)', 'offline.footer': 'Synchronisation cloud chiffrée dès reconnexion',

    'dl.eyebrow': 'Toutes les plateformes', 'dl.title': "Téléchargez l'application officielle",
    'dl.sub': 'Installez Boutiklic sur votre PC de caisse, votre tablette tactile ou votre smartphone.',
    'dl.win.title': 'Application Bureau', 'dl.win.meta': 'Windows · Linux · macOS (à venir)', 'dl.win.btn': 'Télécharger pour bureau', 'dl.soon': 'Bientôt disponible',
    'dl.android.title': 'Android & TPE', 'dl.android.meta': 'Tablette, POS tactile · APK', 'dl.android.btn': 'Google Play / APK direct',
    'dl.apple.title': 'Apple iOS / Mac', 'dl.apple.meta': 'iPad, iPhone & Apple Silicon', 'dl.apple.btn': "Télécharger sur l'App Store",
    'dl.help.title': "Windows affiche un avertissement à l'installation ?",
    'dl.help.intro': "C'est normal : l'installateur est récent et Windows ne le connaît pas encore. Il vient bien de Boutiklic et votre ordinateur n'est pas en danger. Voici comment continuer :",
    'dl.help.s1': "Sur l'écran bleu « Windows a protégé votre ordinateur », cliquez sur « Informations complémentaires ».",
    'dl.help.s2': "Un nouveau bouton apparaît : cliquez sur « Exécuter quand même ».",
    'dl.help.s3': "Suivez l'assistant d'installation, puis ouvrez Boutiklic depuis le menu Démarrer.",
    'dl.help.note': "À faire une seule fois. Besoin d'aide ? Contactez-nous, nous vous guidons.",

    'pricing.eyebrow': 'Tarifs & Devises', 'pricing.title.pre': 'Simple, transparent,', 'pricing.title.em': 'sans engagement',
    'pricing.sub': "Commencez gratuitement, puis évoluez selon vos besoins : plusieurs dépôts, vente en ligne ou réseau de boutiques.",
    'pricing.quote': "Sur devis", 'pricing.badge': "Nouveau", 'pricing.note': "L'équipe dépend de la taille de votre boutique (petite : 3 membres, moyenne : 6, grande : illimitée), quelle que soit l'offre.", 'pricing.perMonth': "/ mois",
    'pricing.free.name': "GRATUIT", 'pricing.free.desc': "Pour démarrer : caisse tactile et suivi de stock, sans frais.",
    'pricing.free.l1': "Caisse tactile & encaissement espèces / mobile", 'pricing.free.l2': "Suivi des stocks et rapports avancés",
    'pricing.free.l3': "Jusqu'à 100 articles", 'pricing.free.l4': "Mises à jour automatiques de l’application", 'pricing.free.cta': "Commencer gratuitement",
    'pricing.gestion.name': "GESTION", 'pricing.gestion.desc': "Pour les boutiques qui grandissent : catalogue étendu et plusieurs dépôts.",
    'pricing.gestion.l1': "Jusqu'à 2 000 articles", 'pricing.gestion.l2': "Plusieurs dépôts et transferts de stock",
    'pricing.gestion.l3': "Caisse, stock et rapports avancés", 'pricing.gestion.l4': "Mises à jour automatiques de l’application", 'pricing.gestion.cta': "Demander un devis",
    'pricing.online.name': "ONLINE", 'pricing.online.desc': "Pour vendre aussi sur Internet : votre boutique en ligne avec commandes et livraison.",
    'pricing.online.l1': "1 site de vente en ligne (adresse en .boutiklic.com)", 'pricing.online.l2': "Jusqu'à 500 articles et 200 commandes par mois",
    'pricing.online.l3': "Livraison, retrait et suivi des commandes", 'pricing.online.l4': "Caisse, stock et rapports avancés", 'pricing.online.cta': "Demander un devis",
    'pricing.business.name': "BUSINESS", 'pricing.business.desc': "Pour les grandes boutiques et les réseaux : plusieurs sites et dépôts, sans limite de volume.",
    'pricing.business.l1': "Jusqu'à 5 sites de vente en ligne", 'pricing.business.l2': "Articles et commandes illimités",
    'pricing.business.l3': "Plusieurs dépôts et transferts de stock", 'pricing.business.l4': "Tout ce que contient l’offre Online", 'pricing.business.cta': "Contacter un conseiller",

    'reviews.eyebrow': 'Témoignages', 'reviews.title': 'Ils font tourner leur commerce avec Boutiklic.',
    'reviews.r1.text': "« Avant, on notait tout dans des cahiers de dettes et on perdait des sommes folles. Avec Boutiklic, chaque crédit est tracé au centime près. »",
    'reviews.r1.role': 'Grossiste Textile · Conakry',
    'reviews.r2.text': "« Les coupures de courant et d'internet ne nous arrêtent plus. La caisse imprime les reçus même sans réseau. C'est le logiciel le plus robuste qu'on ait testé. »",
    'reviews.r2.role': 'Supermarché Express · Dakar',
    'reviews.r3.text': "« Le support technique sur WhatsApp répond en moins de 3 minutes dès qu'on a besoin d'ajouter une imprimante thermique. Un service exceptionnel. »",
    'reviews.r3.role': 'Boutique Cosmétique & Parfumerie',

    'finalCta.title': 'Prêt à digitaliser votre caisse ?',
    'finalCta.sub': 'Rejoignez Boutiklic. Configuration instantanée en 5 minutes, sans carte bancaire requise.',
    'finalCta.cta': 'Créer mon compte maintenant →',

    'footer.brandDesc': "Le progiciel de caisse tactile et gestion des dettes conçu pour les commerçants exigeants. Données conservées localement et synchronisation cloud en temps réel.",
    'footer.location': 'Notre équipe est installée à Sonfonia, dans la commune de Ratoma, à Conakry (Guinée).', 'footer.presence': 'Agences & Support', 'footer.downloads': 'Téléchargements', 'footer.legalTitle': 'Conformité & Légal',
    'footer.dl1': 'Client Windows POS (Hors-ligne)', 'footer.dl2': 'Application Android Tablette & TPE',
    'footer.dl3': 'Pilotes Imprimante Thermique 58/80mm', 'footer.dl4': 'Module Orange Money & MTN MoMo (à venir)',
    'footer.legal1': 'Agrément officiel de facturation', 'footer.legal2': 'Mentions Légales',
    'footer.legal3': 'Protection des données marchandes', 'footer.legal4': 'Conditions Générales de Vente',
    'footer.copyright': '© 2026 Boutiklic kaatomi-laafou. Tous droits réservés.',
    'footer.madeWith': "Fait avec passion pour l'économie réelle · Devise active :",
  },
  en: {
    'nav.features': 'Features', 'nav.offline': 'Offline POS', 'nav.download': 'Download', 'nav.pricing': 'Pricing', 'nav.reviews': 'Reviews',
    'nav.contact': 'Contact', 'footer.contact': 'Contact us', 'footer.whatsapp': 'Chat on WhatsApp',
    'nav.login': 'Log in', 'nav.cta': 'Open my store', 'nav.openMenu': 'Open menu', 'nav.closeMenu': 'Close menu',
    'dd.country': 'Country & Currency', 'dd.search': 'Search country...', 'dd.countUnit': 'countries',
    'hero.badge': 'New', 'hero.eyebrow': 'Built-in Mobile Money & Card Payments (coming soon)',
    'hero.t1': 'Open.', 'hero.t2': 'Share.', 'hero.t3': 'Sell.',
    // « with a synced e-commerce store » retiré pour l'instant :
    // 'combines an ultra-fast touchscreen till with a synced e-commerce store, built to keep ringing up sales and managing your stock',
    'hero.lead.normal': 'combines an ultra-fast touchscreen till, built to keep ringing up sales and managing your stock',
    'hero.lead.em': 'even when the internet drops',
    'hero.cta': 'Download free trial →', 'hero.demo': 'Explore modules',
    'hero.trust.count': '2,412 stores', 'hero.trust.suffix': 'active across Africa and Europe',

    'mock.badge': 'TOUCH POS V3.2', 'mock.syncStatus': 'CLOUD SYNC ACTIVE',
    'mock.salesLabel': "Today's sales", 'mock.growthSales': '▲ +24% vs yesterday',
    'mock.ordersLabel': 'Tickets processed', 'mock.growthOrders': '⚡ Throughput: 3.2s / ticket',
    'mock.cartTitle': 'Current ticket (#4092)', 'mock.cartMode': 'Cash / MoMo mode',
    'mock.totalLabel': 'TOTAL DUE', 'mock.payBtn': 'Charge',
    'float.title': 'Network independence', 'float.sub': 'Keep scanning & printing while offline',

    'marquee.m1': 'Built for shopkeepers', 'marquee.m2': 'Works 100% Offline',
    'marquee.m3': 'Mobile Money Built-in (coming soon)', 'marquee.m4': 'Multi-Depot & Store Credit',
    'marquee.m5': 'Windows · coming soon: macOS · Android · iOS', 'marquee.m6': '58mm & 80mm Receipts',

    'features.eyebrow': 'What changes everything',
    'features.title.pre': 'An architecture built for', 'features.title.em': 'the real world',
    'features.sub': 'No more complicated interfaces. Boutiklic simplifies managing your point of sale, your inventory and your customers.',
    'features.big.title': 'Run your business from your fingertips',
    'features.big.desc': "Whether you're at the counter, on a delivery run or at the market, your product catalog stays available instantly. Create promotions, scan barcodes with your phone and track your cash flow.",
    'features.big.pill1': 'Checkout in 2 taps', 'features.big.pill2': 'Customer credit & store-tab tracking', 'features.big.pill3': 'End-of-day till reconciliation',
    'features.f2.t': 'Universal Payments (coming soon)', 'features.f2.d': 'Orange Money, MTN MoMo, Wave, cards or cash: your customers pay with zero friction.',
    'features.f3.t': 'Stock & Alerts', 'features.f3.d': 'Automatic reorder thresholds and management of transfers between depots.',
    'features.f4.t': 'Clear Analytics', 'features.f4.d': 'Instantly spot your best-selling products, net margins and daily traffic peaks.',
    'features.f5.t': 'Human Support 7 Days a Week', 'features.f5.d': 'A dedicated technical team answers you directly on WhatsApp or by phone, no bots.',

    'numbers.n1': 'To set up your shop', 'numbers.n2suffix': 'outages',
    'numbers.n2': 'Thanks to the built-in offline mode', 'numbers.n3': 'Average time to issue a receipt',
    'numbers.n4': 'Secured with automatic cloud backup',

    'offline.eyebrow': 'Absolute Reliability', 'offline.title1': 'Internet drops?', 'offline.title2': 'Your till keeps running.',
    'offline.sub': 'Dead zones, carrier outages or power cuts: Boutiklic runs on a secure local database. Your sales, invoices and stock keep recording without interruption.',
    'offline.list1': 'Take payments with no internet connection at all',
    'offline.list2': 'Print directly to 58 & 80 mm thermal receipts',
    'offline.list3': 'Automatic queue and seamless synchronization',
    'offline.list4': 'Zero risk of duplicates or lost revenue',
    'offline.engine': 'PERSISTENT SQLITE ENGINE', 'offline.ready': 'OFFLINE MODE READY', 'offline.queue': 'LOCAL SYNC QUEUE',
    'offline.sync1': 'Ticket #1042 · Counter Sale', 'offline.sync2': 'Ticket #1043 · MoMo Payment', 'offline.sync3': 'Ticket #1044 · Depot B Stock Update',
    'offline.pending': 'Waiting for network (Ready)', 'offline.footer': 'Encrypted cloud sync as soon as you reconnect',

    'dl.eyebrow': 'Every platform', 'dl.title': 'Download the official app',
    'dl.sub': 'Install Boutiklic on your till PC, your touchscreen tablet or your smartphone.',
    'dl.win.title': 'Desktop App', 'dl.win.meta': 'Windows · Linux · macOS (coming soon)', 'dl.win.btn': 'Download for desktop', 'dl.soon': 'Coming soon',
    'dl.android.title': 'Android & Terminals', 'dl.android.meta': 'Tablet, touch POS · APK', 'dl.android.btn': 'Google Play / direct APK',
    'dl.apple.title': 'Apple iOS / Mac', 'dl.apple.meta': 'iPad, iPhone & Apple Silicon', 'dl.apple.btn': 'Download on the App Store',
    'dl.help.title': 'Does Windows show a warning during installation?',
    'dl.help.intro': "That's expected: the installer is new and Windows doesn't know it yet. It does come from Boutiklic and your computer is not at risk. Here's how to continue:",
    'dl.help.s1': 'On the blue "Windows protected your PC" screen, click "More info".',
    'dl.help.s2': 'A new button appears: click "Run anyway".',
    'dl.help.s3': 'Follow the setup wizard, then open Boutiklic from the Start menu.',
    'dl.help.note': 'You only need to do this once. Need help? Contact us and we will guide you.',

    'pricing.eyebrow': 'Pricing & Currency', 'pricing.title.pre': 'Simple, transparent,', 'pricing.title.em': 'no commitment',
    'pricing.sub': "Start for free, then grow as you need: multiple depots, online selling or a network of shops.",
    'pricing.quote': "On request", 'pricing.badge': "New", 'pricing.note': "Team size depends on your shop size (small: 3 members, medium: 6, large: unlimited), whichever plan you pick.", 'pricing.perMonth': "/ month",
    'pricing.free.name': "FREE", 'pricing.free.desc': "To get started: touchscreen POS and stock tracking, at no cost.",
    'pricing.free.l1': "Touchscreen POS with cash & mobile checkout", 'pricing.free.l2': "Stock tracking and advanced reports",
    'pricing.free.l3': "Up to 100 products", 'pricing.free.l4': "Automatic app updates", 'pricing.free.cta': "Start for free",
    'pricing.gestion.name': "GESTION", 'pricing.gestion.desc': "For growing shops: a larger catalog and several depots.",
    'pricing.gestion.l1': "Up to 2,000 products", 'pricing.gestion.l2': "Multiple depots and stock transfers",
    'pricing.gestion.l3': "POS, stock and advanced reports", 'pricing.gestion.l4': "Automatic app updates", 'pricing.gestion.cta': "Request a quote",
    'pricing.online.name': "ONLINE", 'pricing.online.desc': "To also sell on the Internet: your online shop with orders and delivery.",
    'pricing.online.l1': "1 online store (on a .boutiklic.com address)", 'pricing.online.l2': "Up to 500 products and 200 orders per month",
    'pricing.online.l3': "Delivery, pickup and order tracking", 'pricing.online.l4': "POS, stock and advanced reports", 'pricing.online.cta': "Request a quote",
    'pricing.business.name': "BUSINESS", 'pricing.business.desc': "For large shops and networks: several sites and depots, no volume limits.",
    'pricing.business.l1': "Up to 5 online stores", 'pricing.business.l2': "Unlimited products and orders",
    'pricing.business.l3': "Multiple depots and stock transfers", 'pricing.business.l4': "Everything in the Online plan", 'pricing.business.cta': "Contact sales",

    'reviews.eyebrow': 'Testimonials', 'reviews.title': 'They run their business with Boutiklic.',
    'reviews.r1.text': '"We used to write everything down in credit notebooks and lost track of huge amounts. With Boutiklic, every credit is tracked to the last cent."',
    'reviews.r1.role': 'Textile Wholesaler · Conakry',
    'reviews.r2.text': '"Power and internet cuts don\'t stop us anymore. The till prints receipts even offline. It\'s the most reliable software we\'ve tested."',
    'reviews.r2.role': 'Express Supermarket · Dakar',
    'reviews.r3.text': '"WhatsApp support answers in under 3 minutes whenever we need to add a thermal printer. Outstanding service."',
    'reviews.r3.role': 'Cosmetics & Perfume Shop',

    'finalCta.title': 'Ready to go digital at the till?',
    'finalCta.sub': 'Join Boutiklic. Instant setup in 5 minutes, no credit card required.',
    'finalCta.cta': 'Create my account now →',

    'footer.brandDesc': 'The touchscreen POS and store-credit software built for demanding merchants. Data stored locally with real-time cloud sync.',
    'footer.location': 'Our team is based in Sonfonia, in the Ratoma commune of Conakry, Guinea.', 'footer.presence': 'Branches & Support', 'footer.downloads': 'Downloads', 'footer.legalTitle': 'Compliance & Legal',
    'footer.dl1': 'Windows POS Client (Offline)', 'footer.dl2': 'Android Tablet & Terminal App',
    'footer.dl3': 'Thermal Printer Drivers 58/80mm', 'footer.dl4': 'Orange Money & MTN MoMo Module (coming soon)',
    'footer.legal1': 'Official billing accreditation', 'footer.legal2': 'Legal Notice',
    'footer.legal3': 'Merchant data protection', 'footer.legal4': 'Terms & Conditions of Sale',
    'footer.copyright': '© 2026 Boutiklic kaatomi-laafou. All rights reserved.',
    'footer.madeWith': 'Made with passion for the real economy · Active currency:',
  },
  pt: {
    'nav.features': 'Recursos', 'nav.offline': 'Modo Offline', 'nav.download': 'Baixar', 'nav.pricing': 'Preços', 'nav.reviews': 'Opiniões',
    'nav.contact': 'Contacto', 'footer.contact': 'Fale connosco', 'footer.whatsapp': 'Falar no WhatsApp',
    'nav.login': 'Entrar', 'nav.cta': 'Criar minha loja', 'nav.openMenu': 'Abrir menu', 'nav.closeMenu': 'Fechar menu',
    'dd.country': 'País & Moeda', 'dd.search': 'Pesquisar país...', 'dd.countUnit': 'países',
    'hero.badge': 'Novo', 'hero.eyebrow': 'Pagamentos móveis e cartão integrados (em breve)',
    'hero.t1': 'Abra.', 'hero.t2': 'Compartilhe.', 'hero.t3': 'Venda.',
    // « com uma loja online sincronizada » retiré pour l'instant :
    // 'combina um caixa touchscreen ultrarrápido com uma loja online sincronizada, feito para continuar a vender e a gerir o seu stock',
    'hero.lead.normal': 'combina um caixa touchscreen ultrarrápido, feito para continuar a vender e a gerir o seu stock',
    'hero.lead.em': 'mesmo com a internet cortada',
    'hero.cta': 'Baixar grátis →', 'hero.demo': 'Ver módulos',
    'hero.trust.count': '2.412 lojas', 'hero.trust.suffix': 'ativas em toda a África e Europa',

    'mock.badge': 'CAIXA TÁTIL V3.2', 'mock.syncStatus': 'SINCRONIA CLOUD ATIVA',
    'mock.salesLabel': 'Vendas do dia', 'mock.growthSales': '▲ +24% vs ontem',
    'mock.ordersLabel': 'Tickets processados', 'mock.growthOrders': '⚡ Ritmo: 3.2s / ticket',
    'mock.cartTitle': 'Ticket atual (#4092)', 'mock.cartMode': 'Modo Dinheiro / MoMo',
    'mock.totalLabel': 'TOTAL A PAGAR', 'mock.payBtn': 'Cobrar',
    'float.title': 'Independência de rede', 'float.sub': 'Continue a digitalizar e a imprimir offline',

    'marquee.m1': 'Feito para comerciantes', 'marquee.m2': 'Funciona 100% Offline',
    'marquee.m3': 'Mobile Money Integrado (em breve)', 'marquee.m4': 'Multi-Armazém & Fiado',
    'marquee.m5': 'Windows · em breve: macOS · Android · iOS', 'marquee.m6': 'Talão 58mm & 80mm',

    'features.eyebrow': 'O que muda tudo',
    'features.title.pre': 'Uma arquitetura pensada para o', 'features.title.em': 'terreno real',
    'features.sub': 'Chega de interfaces complicadas. O Boutiklic simplifica a gestão do seu ponto de venda, do seu stock e dos seus clientes.',
    'features.big.title': 'Controle o seu negócio na ponta dos dedos',
    'features.big.desc': 'Quer esteja ao balcão, em entrega ou no mercado, o seu catálogo de produtos fica disponível instantaneamente. Crie promoções, digitalize códigos de barras com o telemóvel e acompanhe a sua tesouraria.',
    'features.big.pill1': 'Cobrança em 2 toques', 'features.big.pill2': 'Gestão de crédito e fiado dos clientes', 'features.big.pill3': 'Fecho de caixa ao final do dia',
    'features.f2.t': 'Pagamentos Universais (em breve)', 'features.f2.d': 'Orange Money, MTN MoMo, Wave, cartão ou dinheiro: os seus clientes pagam sem fricção.',
    'features.f3.t': 'Stock & Alertas', 'features.f3.d': 'Limiares automáticos de reabastecimento e gestão de transferências entre armazéns.',
    'features.f4.t': 'Análises Claras', 'features.f4.d': 'Identifique instantaneamente os seus produtos mais vendidos, margens líquidas e picos de movimento diários.',
    'features.f5.t': 'Suporte Humano 7 Dias por Semana', 'features.f5.d': 'Uma equipa técnica dedicada responde diretamente no WhatsApp ou por telefone, sem bots.',

    'numbers.n1': 'Para configurar a sua loja', 'numbers.n2suffix': 'interrupções',
    'numbers.n2': 'Graças ao modo offline integrado', 'numbers.n3': 'Tempo médio de emissão de um ticket',
    'numbers.n4': 'Protegido com cópia de segurança automática na cloud',

    'offline.eyebrow': 'Fiabilidade Absoluta', 'offline.title1': 'A internet caiu?', 'offline.title2': 'O seu caixa continua.',
    'offline.sub': 'Zonas sem cobertura, falhas de operadora ou cortes de energia: o Boutiklic usa uma base de dados local segura. As suas vendas, faturas e stock continuam a ser registados sem interrupção.',
    'offline.list1': 'Cobre sem qualquer ligação à Internet',
    'offline.list2': 'Impressão direta em talão térmico 58 & 80 mm',
    'offline.list3': 'Fila de espera automática e sincronização transparente',
    'offline.list4': 'Zero risco de duplicação ou perda financeira',
    'offline.engine': 'MOTOR PERSISTENTE SQLITE', 'offline.ready': 'MODO OFFLINE PRONTO', 'offline.queue': 'FILA DE SINCRONIZAÇÃO LOCAL',
    'offline.sync1': 'Ticket #1042 · Venda ao Balcão', 'offline.sync2': 'Ticket #1043 · Pagamento MoMo', 'offline.sync3': 'Ticket #1044 · Atualização Stock Armazém B',
    'offline.pending': 'Aguardando rede (Pronto)', 'offline.footer': 'Sincronização cloud cifrada assim que reconectar',

    'dl.eyebrow': 'Todas as plataformas', 'dl.title': 'Baixe a aplicação oficial',
    'dl.sub': 'Instale o Boutiklic no seu PC de caixa, tablet tátil ou smartphone.',
    'dl.win.title': 'Aplicação Desktop', 'dl.win.meta': 'Windows · Linux · macOS (em breve)', 'dl.win.btn': 'Baixar para desktop', 'dl.soon': 'Em breve',
    'dl.android.title': 'Android & Terminais', 'dl.android.meta': 'Tablet, POS tátil · APK', 'dl.android.btn': 'Google Play / APK direto',
    'dl.apple.title': 'Apple iOS / Mac', 'dl.apple.meta': 'iPad, iPhone & Apple Silicon', 'dl.apple.btn': 'Baixar na App Store',
    'dl.help.title': 'O Windows mostra um aviso durante a instalação?',
    'dl.help.intro': 'É normal: o instalador é recente e o Windows ainda não o conhece. Ele vem mesmo do Boutiklic e o seu computador não corre perigo. Veja como continuar:',
    'dl.help.s1': 'No ecrã azul "O Windows protegeu o seu computador", clique em "Mais informações".',
    'dl.help.s2': 'Aparece um novo botão: clique em "Executar mesmo assim".',
    'dl.help.s3': 'Siga o assistente de instalação e abra o Boutiklic a partir do menu Iniciar.',
    'dl.help.note': 'Só precisa de fazer isto uma vez. Precisa de ajuda? Contacte-nos e nós orientamos.',

    'pricing.eyebrow': 'Preços & Moedas', 'pricing.title.pre': 'Simples, transparente,', 'pricing.title.em': 'sem compromisso',
    'pricing.sub': "Comece de graça e evolua conforme a necessidade: vários depósitos, venda online ou rede de lojas.",
    'pricing.quote': "Sob consulta", 'pricing.badge': "Novo", 'pricing.note': "A equipa depende do tamanho da sua loja (pequena: 3 membros, média: 6, grande: ilimitada), seja qual for a oferta.", 'pricing.perMonth': "/ mês",
    'pricing.free.name': "GRÁTIS", 'pricing.free.desc': "Para começar: caixa tátil e controlo de stock, sem custos.",
    'pricing.free.l1': "Caixa tátil com cobrança em dinheiro e móvel", 'pricing.free.l2': "Controlo de stock e relatórios avançados",
    'pricing.free.l3': "Até 100 produtos", 'pricing.free.l4': "Atualizações automáticas da aplicação", 'pricing.free.cta': "Começar grátis",
    'pricing.gestion.name': "GESTÃO", 'pricing.gestion.desc': "Para lojas em crescimento: catálogo maior e vários depósitos.",
    'pricing.gestion.l1': "Até 2 000 produtos", 'pricing.gestion.l2': "Vários depósitos e transferências de stock",
    'pricing.gestion.l3': "Caixa, stock e relatórios avançados", 'pricing.gestion.l4': "Atualizações automáticas da aplicação", 'pricing.gestion.cta': "Pedir orçamento",
    'pricing.online.name': "ONLINE", 'pricing.online.desc': "Para vender também na Internet: a sua loja online com encomendas e entrega.",
    'pricing.online.l1': "1 loja online (endereço .boutiklic.com)", 'pricing.online.l2': "Até 500 produtos e 200 encomendas por mês",
    'pricing.online.l3': "Entrega, levantamento e acompanhamento de encomendas", 'pricing.online.l4': "Caixa, stock e relatórios avançados", 'pricing.online.cta': "Pedir orçamento",
    'pricing.business.name': "BUSINESS", 'pricing.business.desc': "Para grandes lojas e redes: vários sites e depósitos, sem limites de volume.",
    'pricing.business.l1': "Até 5 lojas online", 'pricing.business.l2': "Produtos e encomendas ilimitados",
    'pricing.business.l3': "Vários depósitos e transferências de stock", 'pricing.business.l4': "Tudo o que a oferta Online inclui", 'pricing.business.cta': "Falar com consultor",

    'reviews.eyebrow': 'Depoimentos', 'reviews.title': 'Eles gerem o seu negócio com o Boutiklic.',
    'reviews.r1.text': '"Antes, anotávamos tudo em cadernos de fiado e perdíamos somas enormes. Com o Boutiklic, cada crédito é rastreado ao cêntimo."',
    'reviews.r1.role': 'Grossista Têxtil · Conacri',
    'reviews.r2.text': '"Os cortes de energia e de internet já não nos param. O caixa imprime os recibos mesmo sem rede. É o software mais robusto que já testámos."',
    'reviews.r2.role': 'Supermercado Express · Dakar',
    'reviews.r3.text': '"O suporte técnico no WhatsApp responde em menos de 3 minutos sempre que precisamos de adicionar uma impressora térmica. Um serviço excecional."',
    'reviews.r3.role': 'Loja de Cosmética & Perfumaria',

    'finalCta.title': 'Pronto para digitalizar o seu caixa?',
    'finalCta.sub': 'Junte-se ao Boutiklic. Configuração instantânea em 5 minutos, sem cartão de crédito.',
    'finalCta.cta': 'Criar minha conta agora →',

    'footer.brandDesc': 'O software de caixa tátil e gestão de fiado feito para comerciantes exigentes. Dados guardados localmente e sincronização cloud em tempo real.',
    'footer.location': 'A nossa equipa está sediada em Sonfonia, no município de Ratoma, em Conacri (Guiné).', 'footer.presence': 'Agências & Suporte', 'footer.downloads': 'Downloads', 'footer.legalTitle': 'Conformidade & Legal',
    'footer.dl1': 'Cliente Windows POS (Offline)', 'footer.dl2': 'Aplicação Android Tablet & Terminal',
    'footer.dl3': 'Drivers Impressora Térmica 58/80mm', 'footer.dl4': 'Módulo Orange Money & MTN MoMo (em breve)',
    'footer.legal1': 'Credenciamento oficial de faturação', 'footer.legal2': 'Avisos Legais',
    'footer.legal3': 'Proteção de dados comerciais', 'footer.legal4': 'Termos e Condições Gerais de Venda',
    'footer.copyright': '© 2026 Boutiklic kaatomi-laafou. Todos os direitos reservados.',
    'footer.madeWith': 'Feito com paixão pela economia real · Moeda ativa:',
  },
}

const FONT_LINKS = [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;500;600&display=swap' },
]

function formatPrice(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

// Bucket OVH public dédié aux installeurs (dépôt privé → pas de GitHub Releases). URL en virtual-host :
// OVH refuse les lectures anonymes en path-style. Surchargeable via VITE_DESKTOP_DOWNLOAD_BASE.
// Fichiers publiés par .github/workflows/deploy-desktop.yml (input publish_to_downloads).
const DESKTOP_DOWNLOAD_BASE = (
  import.meta.env.VITE_DESKTOP_DOWNLOAD_BASE ?? 'https://boutiklic-downloads.s3.gra.io.cloud.ovh.net'
).replace(/\/$/, '')

// href: null = installeur pas encore publié (bouton désactivé "Bientôt")
const DESKTOP_DOWNLOADS: { os: string; label: string; ext: string; href: string | null }[] = [
  { os: 'windows', label: 'Windows', ext: '.exe', href: `${DESKTOP_DOWNLOAD_BASE}/desktop/Boutiklic-windows-x64.exe` },
  { os: 'linux', label: 'Linux', ext: '.AppImage / .deb', href: null },
  { os: 'macos', label: 'macOS', ext: '.dmg', href: null },
]

export default function LandingPage() {
  const [currentCountry, setCurrentCountry] = useState<Country>(COUNTRIES.find((c) => c.code === 'GN') ?? COUNTRIES[0])
  // Langue de départ = celle d'i18next (choix déjà fait sinon langue du navigateur) : la landing, la page Contact
  // et les pages légales restent ainsi dans la même langue.
  const [currentLang, setCurrentLang] = useState<LangCode>(() => {
    const code = (i18n.language ?? 'fr').slice(0, 2)
    return code === 'en' || code === 'pt' ? code : 'fr'
  })
  const [openDropdown, setOpenDropdown] = useState<'country' | 'lang' | null>(null)
  const [countrySearch, setCountrySearch] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Injecte les polices Google Fonts de la page (non chargées ailleurs dans l'app)
  useEffect(() => {
    const added: HTMLLinkElement[] = []
    FONT_LINKS.forEach(({ rel, href, crossOrigin }) => {
      if (document.querySelector(`link[href="${href}"]`)) return
      const link = document.createElement('link')
      link.rel = rel
      link.href = href
      if (crossOrigin) link.crossOrigin = crossOrigin
      document.head.appendChild(link)
      added.push(link)
    })
    return () => added.forEach((link) => link.remove())
  }, [])

  // Ferme les menus déroulants au clic en dehors (équivalent du listener document original)
  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) return
      setOpenDropdown(null)
      setMobileMenuOpen(false)
    }
    document.addEventListener('click', handleDocClick)
    return () => document.removeEventListener('click', handleDocClick)
  }, [])

  const dict = I18N[currentLang]
  const t = (key: string, fallback: string) => dict[key] ?? fallback

  const cart = CART_SAMPLES[currentCountry.currency] || CART_SAMPLES.EUR
  const cartLine1 = `${formatAmount(cart.item1, currentCountry.locale)} ${currentCountry.currency}`
  const cartLine2 = `${formatAmount(cart.item2, currentCountry.locale)} ${currentCountry.currency}`
  const cartTotal = `${formatAmount(cart.item1 + cart.item2, currentCountry.locale)} ${currentCountry.currency}`
  const priceFree = formatPrice(0, currentCountry.currency, currentCountry.locale)

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(
      (c) =>
        c.name[currentLang].toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q)
    )
  }, [countrySearch, currentLang])

  function toggleDropdown(dd: 'country' | 'lang', e: React.MouseEvent) {
    e.stopPropagation()
    setOpenDropdown((prev) => (prev === dd ? null : dd))
  }

  /** Applique la langue à la landing ET au reste du site (i18next + mémorisation) pour que Contact et les
   *  pages légales suivent le choix du visiteur. */
  function applyLang(lang: LangCode) {
    setCurrentLang(lang)
    persistLanguage(lang)
    void i18n.changeLanguage(lang)
  }

  function selectCountry(country: Country) {
    setCurrentCountry(country)
    applyLang(country.lang)
    setOpenDropdown(null)
  }

  function selectLang(lang: LangCode) {
    applyLang(lang)
    setOpenDropdown(null)
  }

  return (
    <div className="landing-page" ref={wrapperRef}>
      {/* EN-TÊTE */}
      <header>
        <div className="wrap">
          <nav className={mobileMenuOpen ? 'mobile-open' : ''}>
            <a href="#" className="brand">
              <span className="brand-mark">B</span>
              <span>Boutiklic</span>
            </a>

            <button
              type="button"
              className="mobile-toggle"
              aria-label={mobileMenuOpen ? t('nav.closeMenu', 'Fermer le menu') : t('nav.openMenu', 'Ouvrir le menu')}
              aria-expanded={mobileMenuOpen}
              onClick={(e) => { e.stopPropagation(); setMobileMenuOpen((v) => !v) }}
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>

            <div className="nav-links">
              <a href="#features">{t('nav.features', 'Fonctionnalités')}</a>
              <a href="#offline">{t('nav.offline', 'Hors-ligne')}</a>
              <a href="#download">{t('nav.download', 'Télécharger')}</a>
              <a href="#pricing">{t('nav.pricing', 'Tarifs')}</a>
              <Link to="/contact">{t('nav.contact', 'Contact')}</Link>
              {/* <a href="#avis">{t('nav.reviews', 'Avis')}</a> */}
            </div>

            <div className="nav-actions">
              {/* Sélecteur Pays / Devise */}
              <div className="locale-bar">
                <div className={`dd${openDropdown === 'country' ? ' open' : ''}`}>
                  <button
                    className="dd-trigger"
                    aria-haspopup="listbox"
                    aria-expanded={openDropdown === 'country'}
                    onClick={(e) => toggleDropdown('country', e)}
                  >
                    <span>{currentCountry.flag}</span>
                    <span className="mono">{currentCountry.code}</span>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span className="mono">{currentCountry.currency}</span>
                    <span className="caret">▼</span>
                  </button>
                  <div className="dd-panel" role="listbox">
                    <div className="dd-panel-head">
                      <h4>{t('dd.country', 'Pays & Devise')}</h4>
                      <span className="dd-hint">{filteredCountries.length} {t('dd.countUnit', 'pays')}</span>
                    </div>
                    <div className="dd-search">
                      <input
                        type="text"
                        placeholder={t('dd.search', 'Rechercher un pays...')}
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="dd-list">
                      {filteredCountries.map((c) => (
                        <button
                          key={c.code}
                          className={`dd-item${c.code === currentCountry.code ? ' selected' : ''}`}
                          onClick={() => selectCountry(c)}
                        >
                          <span className="flag">{c.flag}</span>
                          <span className="info">
                            <span className="name">{c.name[currentLang]}</span>
                            <span className="curr">{c.currency}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sélecteur Langue */}
                <div className={`dd${openDropdown === 'lang' ? ' open' : ''}`}>
                  <button
                    className="dd-trigger"
                    aria-haspopup="listbox"
                    aria-expanded={openDropdown === 'lang'}
                    onClick={(e) => toggleDropdown('lang', e)}
                  >
                    <span>{currentLang.toUpperCase()}</span>
                    <span className="caret">▼</span>
                  </button>
                  <div className="dd-panel lang-panel" role="listbox">
                    <button className="dd-item" onClick={() => selectLang('fr')}>
                      <span className="flag">🇫🇷</span>
                      <span className="info"><span className="name">Français</span><span className="curr">FR</span></span>
                    </button>
                    <button className="dd-item" onClick={() => selectLang('en')}>
                      <span className="flag">🇬🇧</span>
                      <span className="info"><span className="name">English</span><span className="curr">EN</span></span>
                    </button>
                    <button className="dd-item" onClick={() => selectLang('pt')}>
                      <span className="flag">🇵🇹</span>
                      <span className="info"><span className="name">Português</span><span className="curr">PT</span></span>
                    </button>
                  </div>
                </div>
              </div>

              <Link to="/login" className="btn btn-ghost" style={{ padding: '10px 18px', fontSize: '13.5px' }}>
                {t('nav.login', 'Connexion')}
              </Link>
              <Link to="/login?mode=signup" className="btn btn-primary">
                {t('nav.cta', 'Créer ma boutique')}
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* SECTION HERO */}
      <section className="hero">
        <div className="wrap">
          <div className="hero-grid">
            {/* Colonne Gauche : Pitch & CTA */}
            <div>
              <div className="hero-tag">
                <span className="badge">{t('hero.badge', 'Nouveau')}</span>
                <span className="text">{t('hero.eyebrow', 'Paiements Mobile Money & Cartes intégrés (à venir)')}</span>
              </div>

              <h1 className="display">
                <span>{t('hero.t1', 'Ouvrez.')}</span><br />
                <span className="highlight">{t('hero.t2', 'Partagez.')}</span><br />
                <span className="stroke">{t('hero.t3', 'Vendez.')}</span>
              </h1>

              <p className="hero-p">
                <strong>Boutiklic</strong> {t('hero.lead.normal', 'combine caisse tactile ultra-rapide. Conçu pour encaisser et gérer vos stocks')} <em>{t('hero.lead.em', 'même en coupure internet')}</em>.
              </p>

              <div className="hero-cta-group">
                <a href="#download" className="btn btn-primary" style={{ padding: '15px 30px', fontSize: '16px' }}>
                  {t('hero.cta', 'Télécharger gratuitement →')}
                </a>
                <a href="#features" className="btn btn-ghost">{t('hero.demo', 'Découvrir les modules')}</a>
              </div>

              {/* Masqué pour l'instant
              <div className="hero-trust">
                <div className="avatar-cluster">
                  <span className="av av-1">AK</span>
                  <span className="av av-2">JM</span>
                  <span className="av av-3">FS</span>
                  <span className="av av-4">BT</span>
                </div>
                <div className="trust-meta">
                  <div className="stars">★★★★★ <strong>4.9 / 5</strong></div>
                  <div><strong>{t('hero.trust.count', '2 412 boutiques')}</strong> {t('hero.trust.suffix', "actives à travers l'Afrique et l'Europe")}</div>
                </div>
              </div>
              */}
            </div>

            {/* Colonne Droite : Interface Caisse Live & Preview */}
            <div className="device-showcase">
              <div className="mockup-card">
                <div className="mock-header">
                  <div>
                    <div className="mono" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-300)' }}>{t('mock.badge', 'CAISSE TACTILE V3.2')}</div>
                    <div style={{ fontWeight: 700, fontSize: '16px', marginTop: '2px' }}>Boutique Centrale · Madina</div>
                  </div>
                  <div className="mock-status">
                    <span className="status-dot"></span>
                    <span>{t('mock.syncStatus', 'SYNCHRO CLOUD ACTIVE')}</span>
                  </div>
                </div>

                <div className="mock-kpis">
                  <div className="kpi-tile">
                    <div className="label">{t('mock.salesLabel', 'Ventes du jour')}</div>
                    <div className="val">1 248<span className="curr">{currentCountry.currency}</span></div>
                    <div className="growth">{t('mock.growthSales', '▲ +24% vs hier')}</div>
                  </div>
                  <div className="kpi-tile">
                    <div className="label">{t('mock.ordersLabel', 'Tickets encaissés')}</div>
                    <div className="val">42</div>
                    <div className="growth">{t('mock.growthOrders', '⚡ Débit: 3.2s / ticket')}</div>
                  </div>
                </div>

                <div className="pos-cart">
                  <div className="cart-head">
                    <span>{t('mock.cartTitle', 'Ticket en cours (#4092)')}</span>
                    <span>{t('mock.cartMode', 'Mode Espèces / MoMo')}</span>
                  </div>
                  <div className="cart-item">
                    <div><span className="qty">x2</span> Bazin Riche Supérieur</div>
                    <div className="mono" style={{ fontWeight: 600 }}>{cartLine1}</div>
                  </div>
                  <div className="cart-item">
                    <div><span className="qty">x1</span> Huile de palme raffinée 5L</div>
                    <div className="mono" style={{ fontWeight: 600 }}>{cartLine2}</div>
                  </div>
                  <div className="cart-action">
                    <div>
                      <div className="mono" style={{ fontSize: '10px', color: 'var(--ink-300)' }}>{t('mock.totalLabel', 'TOTAL À PAYER')}</div>
                      <div className="cart-total">{cartTotal}</div>
                    </div>
                    <button className="btn-pos-pay">
                      <span>⚡ {t('mock.payBtn', 'Encaisser')}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="float-badge">
                <div className="float-icon">📡</div>
                <div>
                  <div className="float-title">{t('float.title', 'Indépendance réseau')}</div>
                  <div className="float-sub">{t('float.sub', 'Continuez à scanner & imprimer hors-ligne')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE DÉFILANT */}
      <div className="marquee-wrap">
        <div className="marquee-track">
          <span>{t('marquee.m1', 'Conçu pour les commerçants')}</span>
          <span className="strong">{t('marquee.m2', 'Fonctionne 100% Hors-Ligne')}</span>
          <span>{t('marquee.m3', 'Mobile Money Intégré (à venir)')}</span>
          <span className="strong">{t('marquee.m4', 'Multi-Dépôts & Dettes')}</span>
          <span>{t('marquee.m5', 'Windows · à venir : macOS · Android · iOS')}</span>
          <span>{t('marquee.m6', 'Ticket 58mm & 80mm')}</span>
          <span>{t('marquee.m1', 'Conçu pour les commerçants')}</span>
          <span className="strong">{t('marquee.m2', 'Fonctionne 100% Hors-Ligne')}</span>
        </div>
      </div>

      {/* SECTION FONCTIONNALITÉS / BENTO */}
      <section id="features">
        <div className="wrap">
          <div className="sec-head">
            <span className="sec-tag">{t('features.eyebrow', 'Ce qui change tout')}</span>
            <h2 className="display">
              {t('features.title.pre', 'Une architecture pensée pour le')} <em>{t('features.title.em', 'terrain réel')}</em>.
            </h2>
            <p>{t('features.sub', "Fini les interfaces compliquées. Boutiklic simplifie la gestion de votre point de vente, de votre inventaire et de vos clients.")}</p>
          </div>

          <div className="bento">
            <div className="bento-card col-8 bento-dark">
              <div className="bento-card-icon">⚡</div>
              <p style={{ fontSize: '16px', maxWidth: '580px' }}>{t('features.big.desc', "Que vous soyez au comptoir, en tournée de livraison ou au marché, votre catalogue produit reste disponible instantanément. Créez des promotions, scannez les codes-barres avec votre téléphone et suivez votre trésorerie.")}</p>
              <h3 style={{ fontSize: '26px' }}>{t('features.big.title', 'Pilotez votre commerce du bout des doigts')}</h3>
              <div className="feature-pills">
                <span className="feature-pill">✦ {t('features.big.pill1', 'Encaissement en 2 clics')}</span>
                <span className="feature-pill">✦ {t('features.big.pill2', 'Gestion des crédits & dettes clients')}</span>
                <span className="feature-pill">✦ {t('features.big.pill3', 'Rapprochement de caisse fin de journée')}</span>
              </div>
            </div>

            <div className="bento-card col-4">
              <div className="bento-card-icon" style={{ background: 'var(--ochre-100)', color: 'var(--ochre-500)' }}>💳</div>
              <h3>{t('features.f2.t', 'Paiements Universels (à venir)')}</h3>
              <p>{t('features.f2.d', 'Orange Money, MTN MoMo, Wave, cartes bancaires ou espèces : vos clients règlent sans friction.')}</p>
            </div>

            <div className="bento-card col-4">
              <div className="bento-card-icon" style={{ background: '#E0F2FE', color: '#0284C7' }}>📦</div>
              <h3>{t('features.f3.t', 'Stocks & Alertes')}</h3>
              <p>{t('features.f3.d', 'Seuils automatiques de réapprovisionnement, gestion de transferts entre dépôts.')}</p>
            </div>

            <div className="bento-card col-4">
              <div className="bento-card-icon" style={{ background: '#DCFCE7', color: '#15803D' }}>📊</div>
              <h3>{t('features.f4.t', 'Analytique Limpide')}</h3>
              <p>{t('features.f4.d', "Identifiez instantanément vos produits stars, vos marges nettes et vos pics d'affluence journaliers.")}</p>
            </div>

            <div className="bento-card col-4">
              <div className="bento-card-icon" style={{ background: '#FEE2E2', color: '#B91C1C' }}>🤝</div>
              <h3>{t('features.f5.t', 'Assistance Humaine 7j/7')}</h3>
              <p>{t('features.f5.d', 'Une équipe technique dédiée vous répond directement sur WhatsApp ou par téléphone, sans bot.')}</p>
            </div>

            <div className="bento-card col-12" style={{ background: 'var(--sand-100)', borderColor: 'var(--line)', padding: '48px' }}>
              <div className="stats-banner" style={{ margin: 0, border: 'none', padding: 0, background: 'transparent' }}>
                <div className="stat-block">
                  <b>5<span> min</span></b>
                  <p>{t('numbers.n1', 'Pour configurer votre boutique')}</p>
                </div>
                <div className="stat-block">
                  <b>0<span> {t('numbers.n2suffix', 'coupure')}</span></b>
                  <p>{t('numbers.n2', 'Grâce au mode hors-ligne intégré')}</p>
                </div>
                <div className="stat-block">
                  <b>3.2<span>s</span></b>
                  <p>{t('numbers.n3', "Vitesse moyenne d'émission d'un ticket")}</p>
                </div>
                <div className="stat-block">
                  <b>100<span>%</span></b>
                  <p>{t('numbers.n4', 'Sécurisé avec sauvegarde cloud automatique')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION HORS-LIGNE */}
      <section id="offline" className="offline-section">
        <div className="wrap">
          <div className="offline-grid">
            <div>
              <span className="sec-tag">{t('offline.eyebrow', 'Fiabilité Absolue')}</span>
              <h2 className="display">
                {t('offline.title1', 'Internet coupe ?')}<br /><em>{t('offline.title2', 'Votre caisse continue.')}</em>
              </h2>
              <p style={{ fontSize: '17px', color: 'var(--ink-700)', marginTop: '16px' }}>
                {t('offline.sub', "Zones blanches, pannes d'opérateurs ou délestages : Boutiklic utilise une base de données locale sécurisée. Vos ventes, factures et stocks continuent d'être enregistrés sans interruption.")}
              </p>

              <ul className="check-list">
                <li><span className="ico">✓</span> <span>{t('offline.list1', 'Encaissez sans aucune connexion Internet')}</span></li>
                <li><span className="ico">✓</span> <span>{t('offline.list2', 'Impression directe sur ticket thermique 58 & 80 mm')}</span></li>
                <li><span className="ico">✓</span> <span>{t('offline.list3', "File d'attente automatique et synchronisation transparente")}</span></li>
                <li><span className="ico">✓</span> <span>{t('offline.list4', 'Zéro risque de doublon ou de perte financière')}</span></li>
              </ul>
            </div>

            <div>
              <div className="offline-card">
                <div className="offline-top">
                  <div className="mono" style={{ fontSize: '11px', color: 'var(--ink-300)' }}>{t('offline.engine', 'MOTEUR PERSISTANT SQLITE')}</div>
                  <div className="tag-offline">
                    <span className="pulse"></span>
                    <span>{t('offline.ready', 'MODE HORS-LIGNE PARÉ')}</span>
                  </div>
                </div>

                <div className="sync-stack">
                  <div className="mono" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-300)', marginBottom: '12px' }}>{t('offline.queue', 'FILE DE SYNCHRONISATION LOCALE')}</div>
                  <div className="sync-item">
                    <span>{t('offline.sync1', 'Ticket #1042 · Vente Comptoir')}</span>
                    <span className="badge-queue">{t('offline.pending', 'En attente réseau (Prêt)')}</span>
                  </div>
                  <div className="sync-item">
                    <span>{t('offline.sync2', 'Ticket #1043 · Règlement MoMo')}</span>
                    <span className="badge-queue">{t('offline.pending', 'En attente réseau (Prêt)')}</span>
                  </div>
                  <div className="sync-item">
                    <span>{t('offline.sync3', 'Ticket #1044 · Maj Stock Dépôt B')}</span>
                    <span className="badge-queue">{t('offline.pending', 'En attente réseau (Prêt)')}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--ink-300)' }} className="mono">
                  {t('offline.footer', 'Synchronisation cloud chiffrée dès reconnexion')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION TÉLÉCHARGEMENT MULTI-PLATEFORMES */}
      <section id="download">
        <div className="wrap">
          <div className="dl-hub">
            <div className="sec-head">
              <span className="sec-tag">{t('dl.eyebrow', 'Toutes les plateformes')}</span>
              <h2 className="display">{t('dl.title', "Téléchargez l'application officielle")}</h2>
              <p>{t('dl.sub', 'Installez Boutiklic sur votre PC de caisse, votre tablette tactile ou votre smartphone.')}</p>
            </div>

            <div className="dl-grid">
              {/* Windows */}
              <div className="dl-box">
                <div className="dl-box-top">
                  <div className="dl-os-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.5 10.5 4.5v7H3v-6zm0 13L10.5 19.5v-7H3v6zm8.5 1.2L21 21V12h-9.5v7.7zm0-15.4v7.7H21V3l-9.5 1.3z"></path></svg>
                  </div>
                  <div>
                    <div className="dl-title">{t('dl.win.title', 'Application Bureau')}</div>
                    <div className="dl-meta">{t('dl.win.meta', 'Windows · Linux · macOS (à venir)')}</div>
                  </div>
                </div>
                <button
                  className="btn btn-dark"
                  style={{ width: '100%' }}
                  aria-expanded={desktopMenuOpen}
                  onClick={(e) => { e.stopPropagation(); setDesktopMenuOpen((o) => !o) }}
                >
                  {t('dl.win.btn', 'Télécharger pour bureau')} {desktopMenuOpen ? '▴' : '▾'}
                </button>
                {desktopMenuOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    {DESKTOP_DOWNLOADS.map((d) =>
                      d.href ? (
                        <a
                          key={d.os}
                          className="btn btn-dark"
                          style={{ width: '100%', textAlign: 'center' }}
                          href={d.href}
                        >
                          {d.label} <span style={{ opacity: 0.7 }}>· {d.ext}</span>
                        </a>
                      ) : (
                        <button
                          key={d.os}
                          className="btn btn-dark"
                          style={{ width: '100%', opacity: 0.5, cursor: 'not-allowed' }}
                          disabled
                        >
                          {d.label} <span style={{ opacity: 0.7 }}>· {t('dl.soon', 'Bientôt disponible')}</span>
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>

              {/* Android & TPE */}
              <div className="dl-box">
                <div className="dl-box-top">
                  <div className="dl-os-icon" style={{ background: '#15803D' }}>
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 9.48l1.84-3.18a.5.5 0 0 0-.87-.5l-1.86 3.22a11.5 11.5 0 0 0-9.42 0L5.43 5.8a.5.5 0 1 0-.87.5L6.4 9.48A10.5 10.5 0 0 0 1.5 17h21a10.5 10.5 0 0 0-4.9-7.52zM7 14.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm10 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"></path></svg>
                  </div>
                  <div>
                    <div className="dl-title">{t('dl.android.title', 'Android & TPE')}</div>
                    <div className="dl-meta">{t('dl.android.meta', 'Tablette, POS tactile · APK')}</div>
                  </div>
                </div>
                <button className="btn btn-dark" style={{ width: '100%', opacity: 0.5, cursor: 'not-allowed', textAlign: 'center' }} disabled>{t('dl.android.btn', 'Google Play / APK direct')} <span style={{ display: 'block', opacity: 0.7, fontSize: '0.85em' }}>{t('dl.soon', 'Bientôt disponible')}</span></button>
              </div>

              {/* macOS & iOS */}
              <div className="dl-box">
                <div className="dl-box-top">
                  <div className="dl-os-icon" style={{ background: '#374151' }}>
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"></path></svg>
                  </div>
                  <div>
                    <div className="dl-title">{t('dl.apple.title', 'Apple iOS / Mac')}</div>
                    <div className="dl-meta">{t('dl.apple.meta', 'iPad, iPhone & Apple Silicon')}</div>
                  </div>
                </div>
                <button className="btn btn-dark" style={{ width: '100%', opacity: 0.5, cursor: 'not-allowed', textAlign: 'center' }} disabled>{t('dl.apple.btn', "Télécharger sur l'App Store")} <span style={{ display: 'block', opacity: 0.7, fontSize: '0.85em' }}>{t('dl.soon', 'Bientôt disponible')}</span></button>
              </div>
            </div>

            {/* Aide : avertissement SmartScreen tant que l'installateur Windows n'est pas signé */}
            <details className="dl-help">
              <summary>{t('dl.help.title', "Windows affiche un avertissement à l'installation ?")}</summary>
              <p>{t('dl.help.intro', "C'est normal : l'installateur est récent et Windows ne le connaît pas encore. Il vient bien de Boutiklic et votre ordinateur n'est pas en danger. Voici comment continuer :")}</p>
              <ol>
                <li>{t('dl.help.s1', "Sur l'écran bleu « Windows a protégé votre ordinateur », cliquez sur « Informations complémentaires ».")}</li>
                <li>{t('dl.help.s2', 'Un nouveau bouton apparaît : cliquez sur « Exécuter quand même ».')}</li>
                <li>{t('dl.help.s3', "Suivez l'assistant d'installation, puis ouvrez Boutiklic depuis le menu Démarrer.")}</li>
              </ol>
              <p className="dl-help-note">{t('dl.help.note', "À faire une seule fois. Besoin d'aide ? Contactez-nous, nous vous guidons.")}</p>
            </details>
          </div>
        </div>
      </section>

      {/* SECTION TARIFS DYNAMIQUES */}
      <section id="pricing">
        <div className="wrap">
          <div className="sec-head center">
            <span className="sec-tag">{t('pricing.eyebrow', 'Tarifs & Devises')}</span>
            <h2 className="display">{t('pricing.title.pre', 'Simple, transparent,')} <em>{t('pricing.title.em', 'sans engagement')}</em>.</h2>
            <p>{t('pricing.sub', "Commencez gratuitement. Évoluez au rythme de votre chiffre d'affaires.")}</p>
          </div>

          <div className="pricing-grid">
            <div className="pricing-card" tabIndex={0}>
              <div className="plan-tier">{t('pricing.free.name', "GRATUIT")}</div>
              <div className="price-wrapper">
                <div className="price-num">{priceFree}</div>
                <div className="price-period">{t('pricing.perMonth', '/ mois')}</div>
              </div>
              <p>{t('pricing.free.desc', "Pour démarrer : caisse tactile et suivi de stock, sans frais.")}</p>

              <ul>
                <li><span className="ck">✓</span> <span>{t('pricing.free.l1', "Caisse tactile & encaissement espèces / mobile")}</span></li>
                <li><span className="ck">✓</span> <span>{t('pricing.free.l2', "Suivi des stocks et rapports avancés")}</span></li>
                <li><span className="ck">✓</span> <span>{t('pricing.free.l3', "Jusqu'à 100 articles")}</span></li>
                <li><span className="ck">✓</span> <span>{t('pricing.free.l4', "Mises à jour automatiques de l’application")}</span></li>
              </ul>

              <Link to="/login?mode=signup" className="btn btn-ghost" style={{ width: '100%' }}>{t('pricing.free.cta', "Commencer gratuitement")}</Link>
            </div>

            <div className="pricing-card" tabIndex={0}>
              <div className="plan-tier">{t('pricing.gestion.name', "GESTION")}</div>
              <div className="price-wrapper">
                <div className="price-num price-quote">{t('pricing.quote', "Sur devis")}</div>
              </div>
              <p>{t('pricing.gestion.desc', "Pour les boutiques qui grandissent : catalogue étendu et plusieurs dépôts.")}</p>

              <ul>
                <li><span className="ck">✓</span> <span>{t('pricing.gestion.l1', "Jusqu'à 2 000 articles")}</span></li>
                <li><span className="ck">✓</span> <span>{t('pricing.gestion.l2', "Plusieurs dépôts et transferts de stock")}</span></li>
                <li><span className="ck">✓</span> <span>{t('pricing.gestion.l3', "Caisse, stock et rapports avancés")}</span></li>
                <li><span className="ck">✓</span> <span>{t('pricing.gestion.l4', "Mises à jour automatiques de l’application")}</span></li>
              </ul>

              <Link to="/contact" className="btn btn-ghost" style={{ width: '100%' }}>{t('pricing.gestion.cta', "Demander un devis")}</Link>
            </div>

            <div className="pricing-card featured" tabIndex={0}>
              <span className="pricing-badge">{t('pricing.badge', "Nouveau")}</span>
              <div className="plan-tier">{t('pricing.online.name', "ONLINE")}</div>
              <div className="price-wrapper">
                <div className="price-num price-quote">{t('pricing.quote', "Sur devis")}</div>
              </div>
              <p>{t('pricing.online.desc', "Pour vendre aussi sur Internet : votre boutique en ligne avec commandes et livraison.")}</p>

              <ul>
                <li><span className="ck">✓</span> <span>{t('pricing.online.l1', "1 site de vente en ligne (adresse en .boutiklic.com)")}</span></li>
                <li><span className="ck">✓</span> <span>{t('pricing.online.l2', "Jusqu'à 500 articles et 200 commandes par mois")}</span></li>
                <li><span className="ck">✓</span> <span>{t('pricing.online.l3', "Livraison, retrait et suivi des commandes")}</span></li>
                <li><span className="ck">✓</span> <span>{t('pricing.online.l4', "Caisse, stock et rapports avancés")}</span></li>
              </ul>

              <Link to="/contact" className="btn btn-primary" style={{ width: '100%' }}>{t('pricing.online.cta', "Demander un devis")}</Link>
            </div>

            <div className="pricing-card" tabIndex={0}>
              <div className="plan-tier">{t('pricing.business.name', "BUSINESS")}</div>
              <div className="price-wrapper">
                <div className="price-num price-quote">{t('pricing.quote', "Sur devis")}</div>
              </div>
              <p>{t('pricing.business.desc', "Pour les grandes boutiques et les réseaux : plusieurs sites et dépôts, sans limite de volume.")}</p>

              <ul>
                <li><span className="ck">✓</span> <span>{t('pricing.business.l1', "Jusqu'à 5 sites de vente en ligne")}</span></li>
                <li><span className="ck">✓</span> <span>{t('pricing.business.l2', "Articles et commandes illimités")}</span></li>
                <li><span className="ck">✓</span> <span>{t('pricing.business.l3', "Plusieurs dépôts et transferts de stock")}</span></li>
                <li><span className="ck">✓</span> <span>{t('pricing.business.l4', "Tout ce que contient l’offre Online")}</span></li>
              </ul>

              <Link to="/contact" className="btn btn-ghost" style={{ width: '100%' }}>{t('pricing.business.cta', "Contacter un conseiller")}</Link>
            </div>
          </div>
          <p className="pricing-note">{t('pricing.note', "L'équipe dépend de la taille de votre boutique (petite : 3 membres, moyenne : 6, grande : illimitée), quelle que soit l'offre.")}</p>
        </div>
      </section>

      {/* SECTION AVIS CLIENTS — masquée pour l'instant (lancement récent, pas encore de vrais témoignages)
      <section id="avis">
        <div className="wrap">
          <div className="sec-head">
            <span className="sec-tag">{t('reviews.eyebrow', 'Témoignages')}</span>
            <h2 className="display">{t('reviews.title', 'Ils font tourner leur commerce avec Boutiklic.')}</h2>
          </div>

          <div className="review-grid">
            <div className="review-card">
              <div className="stars">★★★★★</div>
              <p>{t('reviews.r1.text', "« Avant, on notait tout dans des cahiers de dettes et on perdait des sommes folles. Avec Boutiklic, chaque crédit est tracé au centime près. »")}</p>
              <div className="reviewer">
                <div className="rev-av">AK</div>
                <div>
                  <div className="rev-name">Aminata K.</div>
                  <div className="rev-role">{t('reviews.r1.role', 'Grossiste Textile · Conakry')}</div>
                </div>
              </div>
            </div>

            <div className="review-card">
              <div className="stars">★★★★★</div>
              <p>{t('reviews.r2.text', "« Les coupures de courant et d'internet ne nous arrêtent plus. La caisse imprime les reçus même sans réseau. C'est le logiciel le plus robuste qu'on ait testé. »")}</p>
              <div className="reviewer">
                <div className="rev-av" style={{ background: 'var(--terra-500)' }}>JM</div>
                <div>
                  <div className="rev-name">Jean-Marc D.</div>
                  <div className="rev-role">{t('reviews.r2.role', 'Supermarché Express · Dakar')}</div>
                </div>
              </div>
            </div>

            <div className="review-card">
              <div className="stars">★★★★★</div>
              <p>{t('reviews.r3.text', "« Le support technique sur WhatsApp répond en moins de 3 minutes dès qu'on a besoin d'ajouter une imprimante thermique. Un service exceptionnel. »")}</p>
              <div className="reviewer">
                <div className="rev-av" style={{ background: '#15803D' }}>FS</div>
                <div>
                  <div className="rev-name">Fatou S.</div>
                  <div className="rev-role">{t('reviews.r3.role', 'Boutique Cosmétique & Parfumerie')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      */}

      {/* BANNIÈRE CALL TO ACTION */}
      <section style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="final-cta">
            <h2 className="display">{t('finalCta.title', 'Prêt à digitaliser votre caisse ?')}</h2>
            <p>{t('finalCta.sub', 'Rejoignez Boutiklic. Configuration instantanée en 5 minutes, sans carte bancaire requise.')}</p>
            <Link to="/login?mode=signup" className="btn btn-primary" style={{ padding: '16px 36px', fontSize: '16px' }}>
              {t('finalCta.cta', 'Créer mon compte maintenant →')}
            </Link>
          </div>
        </div>
      </section>

      {/* PIED DE PAGE */}
      <footer>
        <div className="wrap">
          <div className="footer-grid">
            <div className="foot-col">
              <a href="#" className="brand" style={{ marginBottom: '16px' }}>
                <span className="brand-mark" style={{ background: 'var(--terra-500)' }}>B</span>
                <span>Boutiklic</span>
              </a>
              <p>{t('footer.brandDesc', "Le progiciel de caisse tactile et gestion des dettes conçu pour les commerçants exigeants. Données conservées localement et synchronisation cloud en temps réel.")}</p>
              <div style={{ fontSize: '12px', color: 'var(--ink-500)', marginTop: '16px' }} className="mono">
                RCCM / GN.TCC.2023.B.14890 · NIF: 489201948B
              </div>
            </div>

            <div className="foot-col">
              <h4>{t('footer.presence', 'Agences & Support')}</h4>
              <p>{t('footer.location', 'Notre équipe est installée à Sonfonia, dans la commune de Ratoma, à Conakry (Guinée).')}</p>
              <Link to="/contact">{t('footer.contact', 'Nous contacter')}</Link>
            </div>

            <div className="foot-col">
              <h4>{t('footer.downloads', 'Téléchargements')}</h4>
              <a href="#download">{t('footer.dl1', 'Client Windows POS (Hors-ligne)')}</a>
              <a href="#download">{t('footer.dl2', 'Application Android Tablette & TPE')}</a>
              <a href="#download">{t('footer.dl3', 'Pilotes Imprimante Thermique 58/80mm')}</a>
              <a href="#download">{t('footer.dl4', 'Module Orange Money & MTN MoMo (à venir)')}</a>
            </div>

            <div className="foot-col">
              <h4>{t('footer.legalTitle', 'Conformité & Légal')}</h4>
              <Link to="/conformite-facturation">{t('footer.legal1', 'Agrément officiel de facturation')}</Link>
              <Link to="/mentions-legales">{t('footer.legal2', 'Mentions Légales')}</Link>
              <Link to="/confidentialite">{t('footer.legal3', 'Protection des données marchandes')}</Link>
              <Link to="/cgv">{t('footer.legal4', 'Conditions Générales de Vente')}</Link>
            </div>
          </div>

          <div className="foot-bottom">
            <div>{t('footer.copyright', '© 2026 Boutiklic kaatomi-laafou. Tous droits réservés.')}</div>
            <div>{t('footer.madeWith', "Fait avec passion pour l'économie réelle · Devise active :")} <strong>{currentCountry.currency}</strong></div>
          </div>
        </div>
      </footer>
    </div>
  )
}
