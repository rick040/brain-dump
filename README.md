# Brain Dump

Android share-target PWA. Deel alles naar Brain Dump, geef het een naam + tags, opgeslagen in Supabase.

---

## 1. Supabase setup (5 min)

Ga naar https://supabase.com, maak een project aan, open de SQL editor en run dit:

```sql
create table brain_dump (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  content text,
  url text,
  type text default 'tekst',
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- Zoek index
create index on brain_dump using gin(to_tsvector('dutch', coalesce(name,'') || ' ' || coalesce(content,'')));

-- Optioneel: Row Level Security uitschakelen (alleen als prive gebruik)
alter table brain_dump disable row level security;
```

Kopieer daarna je **Project URL** en **anon public key** uit Project Settings > API.

---

## 2. Lokaal draaien

```bash
cp .env.example .env.local
# Vul NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_ANON_KEY in

npm install
npm run dev
```

Ga naar http://localhost:3000

---

## 3. Deploy op Vercel

```bash
npx vercel
```

Of: push naar GitHub, importeer in https://vercel.com, voeg env vars toe in Project Settings > Environment Variables.

**Belangrijk:** voeg de Vercel domain toe als allowed origin in Supabase (Authentication > URL Configuration).

---

## 4. PWA installeren op Android (Chrome)

1. Ga naar jouw Vercel URL in Chrome op Android
2. Tap de drie puntjes rechtsboven
3. "Toevoegen aan beginscherm"
4. Brain Dump verschijnt nu als app IN je Android share sheet

---

## 5. Iconen (optioneel maar netjes)

Maak twee PNG iconen:
- `public/icon-192.png` - 192x192
- `public/icon-512.png` - 512x512

Gebruik https://maskable.app/editor voor maskable versie.

---

## Gebruik

- **Delen vanuit Android:** selecteer tekst/link/video/foto, tik Delen, kies Brain Dump
- **Direct openen:** tap het icoon op je beginscherm
- **Zoeken:** zoekbalk bovenaan dashboard
- **Filteren:** tap een tag in de tag-balk
- **Verwijderen:** tap x op een item, bevestig

---

## Standaard tags aanpassen

Bewerk `DEFAULT_TAGS` array in `pages/save.js`:

```js
const DEFAULT_TAGS = [
  "lezen", "idee", "link", "video", "inspiratie",
  "werk", "klant", "tool", "later", "urgent",
];
```

---

## Structuur

```
brain-dump/
├── pages/
│   ├── index.js         # Dashboard
│   ├── save.js          # Share target / snelle opslag UI
│   ├── _app.js          # Global styles + SW registratie
│   ├── _document.js     # PWA meta tags
│   └── api/
│       └── share.js     # POST handler voor Android share
├── lib/
│   └── supabase.js      # Supabase client
├── styles/
│   └── globals.css      # Design tokens + base styles
├── public/
│   ├── manifest.json    # PWA + share_target config
│   └── sw.js            # Service worker (offline)
└── .env.local           # Jouw Supabase credentials
```
