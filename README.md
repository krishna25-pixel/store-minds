# 🧠 Store Minds

> **A Modern, Full-Stack Retail Management Solution.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D%2016-green.svg)
![React](https://img.shields.io/badge/react-18-blue.svg)
![Vite](https://img.shields.io/badge/vite-fast-yellow.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

Store Minds is a powerful and intuitive Point of Sale (POS) and inventory management application designed to help small businesses streamline their operations. Built with a robust Node.js backend and a dynamic React frontend, it offers real-time analytics, stock tracking, and a seamless checkout experience.

---

## 🌟 Key Features

| Feature | Description |
| :--- | :--- |
| **🛍️ Point of Sale (POS)** | Fast, efficient checkout system with cart management, payments, and receipt generation logic. |
| **📦 Inventory Control** | Complete CRUD operations for products, SKU tracking, category management, and low-stock alerts. |
| **📊 Real-Time Analytics** | Visual insights into sales trends, top-selling products, and daily performance using interactive charts. |
| **🚚 Supplier Management** | Keep track of vendors, contact details, and supply chains. |
| **⚡ Dashboard** | At-a-glance view of store health, recent activity logs, and key metrics. |
| **🔐 Admin Authentication** | Secure access control for store administrators. |

---

## 🛠️ Tech Stack

<details>
<summary><strong>Frontend</strong> (Click to expand)</summary>

-   **Framework**: React 18
-   **Build Tool**: Vite
-   **Routing**: React Router DOM
-   **Styling**: Custom CSS Variables & Utilities (Dark/Light mode ready)
-   **Icons**: Lucide React
-   **Charts**: Recharts
-   **Notifications**: React Hot Toast

</details>

<details>
<summary><strong>Backend</strong> (Click to expand)</summary>

-   **Runtime**: Node.js
-   **Framework**: Express.js
-   **Database**: SQLite (Local file-based)
-   **ORM/Driver**: `sqlite` & `sqlite3`
-   **Middleware**: CORS, Express JSON

</details>

---

## 🚀 Getting Started

Follow these steps to set up the project locally on your machine.

### Prerequisites

-   [Node.js](https://nodejs.org/) (v16 or higher)
-   npm (or yarn/pnpm)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/store-minds.git
    cd store-minds
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Start the Development Environment**
    You will need to run the backend and frontend servers concurrently.

    **Terminal 1: Backend Server**
    ```bash
    # Starts the Node.js/Express server on port 3000
    npm run start 
    # OR directly: node server/index.js
    ```

    **Terminal 2: Frontend Client**
    ```bash
    # Starts Vite dev server (proxies API requests to port 3000)
    npm run dev
    ```

4.  **Open the App**
    Visit `http://localhost:5173` in your browser.

---

## 📂 Project Structure

```text
store-minds/
├── server/              # Backend logic
│   ├── index.js         # Main Express server & API routes
│   ├── check_db.js      # Database utility scripts
│   └── storeminds.db    # SQLite database file (generated on start)
├── src/                 # Frontend React application
│   ├── components/      # Reusable UI components
│   ├── pages/           # Application views (Dashboard, POS, etc.)
│   ├── services/        # API calls and data fetching
│   ├── App.jsx          # Main routing & layout
│   └── index.css        # Global styles & variables
├── public/              # Static assets
└── package.json         # Dependencies & scripts
```

---

## ☁️ Deployment

### Vercel
This project is configured for Vercel deployment.

> [!WARNING]
> **Data Persistence Warning**: This app uses SQLite, a file-based database. On serverless platforms like Vercel, the filesystem is ephemeral. **Your data will be reset every time the app redeploys.** For production use, consider migrating the database to a cloud provider like Turso, Neon, or Supabase.

1.  Push your code to GitHub.
2.  Import the repository into Vercel.
3.  Vercel will automatically detect the **Vite** preset.
4.  Deploy!

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Made with ❤️ by Store Minds Team
</p>
