# Putting the private beta online

You'll do this once. It takes about 30 minutes on your Windows PC. Everything is free.

## 1. Supabase (the database), about 10 minutes

1. Go to **supabase.com** and click **Start your project**. Sign in with your GitHub account.
2. Click **New project**.
   - Name: `dahlia-dispatch`
   - Database password: click **Generate a password**. You won't need it again, but save it in your password manager anyway.
   - Region: **Canada (Central)**
   - Click **Create new project** and wait a minute or two.
3. In the left menu, open **SQL Editor**, then **New query**.
4. On GitHub, open your `dahlia-dispatch` repository, then `supabase` → `schema.sql`. Click the **copy** button (two squares, top right of the file), paste into Supabase, and click **Run**. It should say "Success. No rows returned".
5. Click **New query** again. Do the same with `supabase` → `seed.sql`. This adds the 23 farms, the variety list, sale dates and the first review questions.
6. In the left menu, open **Project Settings** → **API Keys** (or **Data API**). Copy two things into a note for the next steps:
   - **Project URL** (looks like `https://abcdxyz.supabase.co`)
   - The **secret** key (might be called `service_role`). Click **Reveal** to copy it. **Treat it like a password.** Never paste it anywhere except Vercel and GitHub secrets.

## 2. Vercel (the website), about 10 minutes

1. Go to **vercel.com**, click **Sign Up**, choose **Hobby**, and continue with GitHub.
2. Click **Add New…** → **Project**, find `dahlia-dispatch`, and click **Import**.
3. Open **Environment Variables** and add three:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | the Project URL |
   | `SUPABASE_SECRET_KEY` | the secret key |
   | `SITE_PASSWORD` | a password you make up for the beta site (you can share this one with testers) |
   | `ADMIN_PASSWORD` | a different password, only for you: it opens the review list and edit pages |

4. Click **Deploy** and wait about two minutes. Vercel gives you a web address like `dahlia-dispatch.vercel.app`.
5. Open it. Your browser asks for a user name and password. Type anything as the user name, and your `SITE_PASSWORD` as the password.

## 3. GitHub (the stock checker), about 5 minutes

1. On GitHub, open your repository. Click **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Add two secrets, with the same values as on Vercel: `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.
3. Click the **Actions** tab. If GitHub asks, click **I understand my workflows, go ahead and enable them**.
4. Click **Check farms** on the left, then **Run workflow**. Tick **Check every farm right now**, then click the green **Run workflow** button.
5. After a few minutes, refresh your site. Real prices and stock should appear. **Review list → Farms** shows any farm that had a problem.

From then on, the checker runs by itself:

| When | How often |
|---|---|
| Sale days (15 min before to 2 hours after a known opening time) | about every 10 minutes |
| November to May | about every hour |
| June to October | once a day |

GitHub may run it a few minutes late when it's busy.

## Changing words on the site

All the wording is in **`site-text.ts`**.

1. On GitHub, open the file and click the pencil ✏️.
2. Change the text between the quote marks.
3. Click **Commit changes**.

Vercel updates the site by itself in about two minutes. If something breaks, Vercel keeps showing the last working version, and you can tell me what you changed.

## Good to know

- **The review list** is only for you. Go to `/admin` (bookmark it) and sign in with your `ADMIN_PASSWORD`. Once signed in, **Review list** appears in the top menu and **Edit** buttons appear on pages. Testers with only the site password never see these. It's where you answer questions:
  - "Is this the same flower?"
  - Colour and form for new varieties
  - Three new farm suggestions each week

  "Ask me later" brings a question back after a week.
- **Sale dates:** when a farm announces an exact opening time, add it under **Review list → Sale dates**. That turns on fast checking for that farm.
- **Supabase free projects pause after a week with no visits.** If the site shows an error after a quiet spell, log in to Supabase and click **Restore project**. The checker visits it every 10 minutes, so this shouldn't happen while it's running.
