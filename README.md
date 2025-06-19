# Tool LP - Next.js Project

This project is built with [Next.js](https://nextjs.org) and bootstrapped using [create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 🚀 Getting Started

### 1. Clone the repository

git clone https://github.com/moonraisewg/tool-lp.git
cd tool-lp

### 2. Install dependencies

pnpm install

> Make sure you have [pnpm](https://pnpm.io) installed. You can install it globally with:

npm install -g pnpm

---

### 3. Configure environment variables

Create your own .env file by copying the example:

cp .env.example .env

Then run the encryption script:

pnpm encrypt

🔐 When prompted, enter your private key. The script will output an encrypted value like this:

ADMIN_PRIVATE_KEY_ENCRYPTED=your_encrypted_value_here

Paste this value into your .env file.

---

### 4. Run the development server

pnpm dev

Visit [http://localhost:3000](http://localhost:3000) in your browser to see the app.

---

## 📦 Available Commands

| Command      | Description                       |
| ------------ | --------------------------------- |
| pnpm dev     | Run the app in development mode   |
| pnpm build   | Build the app for production      |
| pnpm start   | Start the production build        |
| pnpm encrypt | Encrypt your private key for .env |

---

## 📝 Notes

- Edit the main page in app/page.tsx.
- This project uses [next/font](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) and the [Geist](https://vercel.com/font) font family.

---

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
- [Next.js GitHub](https://github.com/vercel/next.js)

---

## ☁️ Deploy on Vercel

Deploy easily with [Vercel](https://vercel.com/new?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app-readme).

See [deployment guide](https://nextjs.org/docs/app/building-your-application/deploying) for details.
