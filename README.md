# Field Annotator — Kermap

PWA mobile/tablette pour ingénieurs terrain : consultation d'orthophotographies
et du flux **Nimbo** **hors ligne**, et logging de points d'observation
directement depuis la carte.

## Fonctionnalités

- **Carte** MapLibre GL, optimisée tactile (géolocalisation, échelle, zoom).
- **Orientation** : sur smartphone, un cône « faisceau » indique la direction
  regardée (boussole via l'API DeviceOrientation), affiché sur le point de position
  quand la géolocalisation est active.
- **Couches raster** : Ortho IGN (Géoplateforme), flux Nimbo, plan IGN — activables/désactivables.
- **Mode hors ligne** : pré-téléchargement des tuiles d'une zone pendant qu'on est
  connecté, puis consultation intégrale sans réseau.
- **Logging d'observations** : tap sur la carte → enregistrement d'un point
  `{ position, ingénieur en charge, date + heure, note }`.
- **Suivi** : panneau latéral listant toutes les observations, avec **export
  GeoJSON / CSV** et **import GeoJSON** (reprise d'un jeu existant, dédoublonné par `id`).
- **100 % local** : aucune donnée n'est envoyée à un serveur. Stockage IndexedDB (Dexie).
- **Stockage persistant** : l'app demande `navigator.storage.persist()` pour éviter
  l'éviction automatique des données terrain ; l'état + l'usage disque sont visibles
  dans « Zone offline ».

## Démarrage

```bash
npm install
npm run dev       # développement (http://localhost:5173)
npm run build     # build de production (génère le service worker PWA)
npm run preview   # sert le build (PWA active)
```

> Le service worker (offline) n'est **pas** actif en `dev`. Pour tester le mode
> hors ligne : `npm run build && npm run preview`, puis couper le réseau.

> **Contexte sécurisé requis sur mobile** : géolocalisation, boussole
> (orientation) et service worker n'utilisent l'API que sur `localhost` ou en
> **HTTPS**. Pour tester depuis une tablette/smartphone via l'IP du poste, servir
> l'app en HTTPS (déploiement ou tunnel TLS). Sur iOS 13+, l'accès à la boussole
> demande une autorisation, déclenchée au 1er appui sur le bouton de géolocalisation.

## Fonctionnement hors ligne

1. En ligne, l'ingénieur cadre la carte sur sa zone d'intervention et ouvre
   **« Zone offline »** (panneau latéral).
2. Il choisit la plage de zoom + les couches et lance le téléchargement.
3. L'app `fetch()` chaque tuile de l'emprise → le **service worker** (stratégie
   `CacheFirst`, voir `vite.config.ts`) les met en cache.
4. Hors ligne, la carte s'affiche depuis le cache et les observations sont
   enregistrées localement.

## À compléter avant mise en production

- **URL du flux Nimbo** : renseigner le vrai endpoint XYZ/WMTS dans
  `src/config/layers.ts` (entrée `id: 'nimbo'`), puis ajouter son hôte dans le
  `runtimeCaching` de `vite.config.ts` pour que le cache offline le prenne en charge.
- **Icônes PWA** : `public/icon.svg` / `public/favicon.svg` reprennent le logo Kermap.

## Architecture

```
src/
├── config/layers.ts     Configuration des couches raster + vue initiale
├── lib/
│   ├── db.ts            Schéma IndexedDB (Dexie) : observations, zones offline
│   ├── tiles.ts         Maths de tuiles XYZ (énumération d'une bbox)
│   ├── offline.ts       Orchestration du pré-téléchargement des tuiles d'une zone
│   ├── mapStyle.ts      Construction du style MapLibre
│   ├── import.ts        Import GeoJSON → observations (points)
│   └── export.ts        Export GeoJSON / CSV
├── stores/              Pinia : settings, observations, offline
├── components/          MapView, Sidebar, LogForm, DownloadManager
└── App.vue
```
